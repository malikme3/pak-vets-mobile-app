import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { useTheme } from "../theme/useTheme";
import { Card } from "../components/ui/Card";
import { AppInput } from "../components/ui/AppInput";
import { Button } from "../components/ui/Button";
import { ListRow } from "../components/ui/ListRow";
import { SegmentedControl } from "../components/ui/SegmentedControl";
import { useSearchAnimals, useAnimals } from "../features/animals/hooks";
import { animalApi } from "../services/vetApi";
import { getUploadSignedUrl, getBucketName } from "../services/sharedServicesApi";
import type { Animal, MatchAnimalImageResponse } from "../types/api";

type SearchFilter = "tag" | "owner_name" | "owner_phone";
type ImageMatchType = "FACE" | "EAR" | "BODY";

export default function SelectAnimalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors } = useTheme();
  const returnTo = (params.returnTo as string) || "/create-visit";

  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<SearchFilter>("tag");
  const [imageMatchType, setImageMatchType] = useState<ImageMatchType>("BODY");
  const [matching, setMatching] = useState(false);
  const [matchResult, setMatchResult] = useState<MatchAnimalImageResponse | null>(null);
  const [matchedAnimal, setMatchedAnimal] = useState<Animal | null>(null);

  // Use search hook when query exists, otherwise use all animals
  const { data: searchResults, isLoading: searchLoading } =
    useSearchAnimals(searchQuery);
  const { data: allAnimals, isLoading: animalsLoading } = useAnimals();

  // Filter results based on selected filter type
  const results = searchQuery.trim()
    ? (searchResults || []).filter((animal) => {
        const query = searchQuery.toLowerCase();
        switch (filter) {
          case "tag":
            return animal.tagId?.toLowerCase().includes(query);
          case "owner_name":
            return animal.ownerName?.toLowerCase().includes(query);
          case "owner_phone":
            return animal.ownerPhone?.includes(searchQuery);
          default:
            return false;
        }
      })
    : [];

  const isLoading = searchLoading || animalsLoading;

  const handleAnimalSelect = (animal: Animal) => {
    if (!returnTo || typeof returnTo !== "string") {
      console.error("Invalid returnTo path:", returnTo);
      return;
    }
    router.push({
      pathname: returnTo as `/${string}`,
      params: { animalId: String(animal.animalId) },
    });
  };

  const handleCreateAnimal = () => {
    router.push({
      pathname: "/create-animal",
      params: { returnTo },
    });
  };

  const uploadImageToS3 = async (
    imageUri: string,
    s3Key: string,
  ): Promise<string> => {
    const bucketName = getBucketName();
    const { signedUrl, fileUrl } = await getUploadSignedUrl(
      bucketName,
      s3Key,
      "type=match-query",
    );
    const fileInfo = await FileSystem.getInfoAsync(imageUri);
    if (!fileInfo.exists) throw new Error("File does not exist");
    const fileBase64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const binaryString = atob(fileBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    await fetch(signedUrl, {
      method: "PUT",
      body: bytes,
      headers: { "Content-Type": "image/jpeg" },
    });
    return fileUrl;
  };

  const requestMediaPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "We need camera roll access to pick a photo.",
      );
      return false;
    }
    return true;
  };

  const handleFindByImage = async () => {
    const hasPermission = await requestMediaPermission();
    if (!hasPermission) return;
    setMatching(true);
    setMatchResult(null);
    setMatchedAnimal(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets[0]) {
        setMatching(false);
        return;
      }
      const uri = result.assets[0].uri;
      const s3Key = `match-query/${Date.now()}-${imageMatchType.toLowerCase()}.jpg`;
      const imageUrl = await uploadImageToS3(uri, s3Key);
      const response = await animalApi.matchAnimalImage({
        queryImageUrl: imageUrl,
        expectedType: imageMatchType,
        topK: 5,
      });
      setMatchResult(response);
      if (response.matchStatus === "MATCH" && response.matchedAnimalId != null) {
        const animal = await animalApi.getAnimal(response.matchedAnimalId);
        setMatchedAnimal(animal);
      }
    } catch (err) {
      Alert.alert(
        "Match failed",
        err instanceof Error
          ? err.message
          : "Could not find animal by image. Try again.",
      );
    } finally {
      setMatching(false);
    }
  };

  const clearMatchResult = () => {
    setMatchResult(null);
    setMatchedAnimal(null);
  };

  const formatAnimalTitle = (a: Animal) =>
    `${a.species}${a.breed ? ` - ${a.breed}` : ""}${a.tagId ? ` (${a.tagId})` : ""}`;
  const formatAnimalSubtitle = (a: Animal) =>
    `${a.ownerName || "Unknown Owner"}${a.ownerPhone ? ` • ${a.ownerPhone}` : ""}`;

  const renderAnimalItem = ({ item }: { item: Animal }) => (
    <ListRow
      title={formatAnimalTitle(item)}
      subtitle={formatAnimalSubtitle(item)}
      onPress={() => handleAnimalSelect(item)}
    />
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <StatusBar style="auto" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        <Text style={[styles.title, { color: colors.text }]}>
          Search Animal
        </Text>

        {/* Find by image */}
        <Card style={styles.card}>
          <Text style={[styles.filterLabel, { color: colors.text }]}>
            Find by image
          </Text>
          <Text style={[styles.findByImageHint, { color: colors.muted }]}>
            Choose body, ear, or face photo to match an enrolled animal
          </Text>
          <SegmentedControl
            options={[
              { label: "Body", value: "BODY" },
              { label: "Ear", value: "EAR" },
              { label: "Face", value: "FACE" },
            ]}
            selectedValue={imageMatchType}
            onValueChange={(value) => {
              setImageMatchType(value as ImageMatchType);
              clearMatchResult();
            }}
          />
          <Button
            title={matching ? "Matching…" : "Choose photo"}
            onPress={handleFindByImage}
            disabled={matching}
            variant="secondary"
            style={styles.findByImageButton}
          />
          {matching && (
            <View style={styles.matchLoading}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.matchLoadingText, { color: colors.muted }]}>
                Finding animal…
              </Text>
            </View>
          )}
          {matchResult && !matching && (
            <View style={[styles.matchResult, { borderTopColor: colors.border }]}>
              {matchResult.matchStatus === "MATCH" && matchedAnimal ? (
                <>
                  <Text style={[styles.matchStatusText, { color: colors.primary }]}>
                    Match found ({(matchResult.bestScore * 100).toFixed(0)}% match)
                  </Text>
                  <ListRow
                    title={formatAnimalTitle(matchedAnimal)}
                    subtitle={formatAnimalSubtitle(matchedAnimal)}
                    onPress={() => handleAnimalSelect(matchedAnimal)}
                  />
                </>
              ) : (
                <>
                  <Text style={[styles.matchStatusText, { color: colors.muted }]}>
                    No match found
                  </Text>
                  <Button
                    title="Try another photo"
                    onPress={clearMatchResult}
                    variant="secondary"
                    style={styles.tryAgainButton}
                  />
                </>
              )}
            </View>
          )}
        </Card>

        {/* Search Input */}
        <Card style={styles.card}>
          <AppInput
            label="Search"
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={
              filter === "tag"
                ? "Search by Tag ID"
                : filter === "owner_name"
                  ? "Search by Owner Name"
                  : "Search by Owner Phone"
            }
          />
        </Card>

        {/* Filter Segmented Control */}
        <View style={styles.filterSection}>
          <Text style={[styles.filterLabel, { color: colors.text }]}>
            Search by:
          </Text>
          <SegmentedControl
            options={[
              { label: "Tag ID", value: "tag" },
              { label: "Owner Name", value: "owner_name" },
              { label: "Phone", value: "owner_phone" },
            ]}
            selectedValue={filter}
            onValueChange={(value) => setFilter(value as SearchFilter)}
          />
        </View>

        {/* Loading State */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        )}

        {/* Results */}
        {results.length > 0 && (
          <View style={styles.resultsSection}>
            <Text style={[styles.resultsTitle, { color: colors.muted }]}>
              {results.length} {results.length === 1 ? "result" : "results"}{" "}
              found
            </Text>
            <Card style={styles.resultsCard}>
              <FlatList
                data={results}
                renderItem={renderAnimalItem}
                keyExtractor={(item) => String(item.animalId)}
                scrollEnabled={false}
                ItemSeparatorComponent={() => (
                  <View
                    style={[
                      styles.separator,
                      { backgroundColor: colors.border },
                    ]}
                  />
                )}
              />
            </Card>
          </View>
        )}

        {/* Create New Animal CTA */}
        <View style={styles.createSection}>
          <Text style={[styles.createLabel, { color: colors.muted }]}>
            Animal not found?
          </Text>
          <Button
            title="Create New Animal"
            onPress={handleCreateAnimal}
            variant="secondary"
            style={styles.createButton}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 24,
  },
  card: {
    marginBottom: 16,
  },
  filterSection: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 12,
  },
  resultsSection: {
    marginBottom: 24,
  },
  resultsTitle: {
    fontSize: 14,
    marginBottom: 8,
  },
  resultsCard: {
    paddingVertical: 0,
  },
  separator: {
    height: 1,
    marginLeft: 16,
  },
  createSection: {
    marginTop: 8,
  },
  createLabel: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 8,
  },
  createButton: {
    marginTop: 8,
  },
  loadingContainer: {
    padding: 16,
    alignItems: "center",
  },
  findByImageHint: {
    fontSize: 12,
    marginBottom: 12,
  },
  findByImageButton: {
    marginTop: 12,
  },
  matchLoading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
  },
  matchLoadingText: {
    fontSize: 14,
  },
  matchResult: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  matchStatusText: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  tryAgainButton: {
    marginTop: 8,
  },
});
