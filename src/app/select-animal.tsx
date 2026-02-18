import { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Alert,
  Image,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { useTheme } from "../theme/useTheme";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { ListRow } from "../components/ui/ListRow";
import { SegmentedControl } from "../components/ui/SegmentedControl";
import {
  useSearchAnimals,
  useAnimals,
  useAnimalImages,
} from "../features/animals/hooks";
import { useCurrentDoctor } from "../features/doctors/hooks";
import { useCreateCase } from "../features/cases/hooks";
import { animalApi } from "../services/vetApi";
import {
  getUploadSignedUrl,
  getBucketName,
} from "../services/sharedServicesApi";
import type { Animal, MatchAnimalImageResponse } from "../types/api";

type SearchFilter = "tag" | "farmer_name" | "farmer_phone";
type ImageMatchType = "FACE" | "EAR" | "BODY";

export default function SelectAnimalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors } = useTheme();
  const returnTo = (params.returnTo as string) || "/create-case";
  const createCaseAfterSelect = params.createCaseAfterSelect === "1";
  const { data: doctor } = useCurrentDoctor();
  const createCaseMutation = useCreateCase();
  const creatingCaseRef = useRef(false);

  const [inputValue, setInputValue] = useState("");
  const [filter, setFilter] = useState<SearchFilter>("tag");
  const [imageMatchType, setImageMatchType] = useState<ImageMatchType>("FACE");
  const [matching, setMatching] = useState(false);
  const [matchResult, setMatchResult] =
    useState<MatchAnimalImageResponse | null>(null);
  const [matchedAnimal, setMatchedAnimal] = useState<Animal | null>(null);

  // Build effective search query: tag-001, 009-0333-6831-836, or raw for farmer name
  const searchQuery =
    filter === "tag"
      ? `tag-${inputValue}`
      : filter === "farmer_phone"
        ? `009-${inputValue}`
        : inputValue;

  const queryForSearch = inputValue.trim() ? searchQuery : "";
  const { data: searchResults, isLoading: searchLoading } =
    useSearchAnimals(queryForSearch);
  const { data: allAnimals, isLoading: animalsLoading } = useAnimals();
  const { data: matchedAnimalImages = [] } = useAnimalImages(
    matchedAnimal?.animalId ?? 0,
  );
  const matchedFaceUrl =
    matchedAnimalImages.find((i) => i.imageType === "FACE")?.s3Url ?? null;

  // Filter results based on selected filter type
  const results = inputValue.trim()
    ? (searchResults || []).filter((animal) => {
        const query = searchQuery.toLowerCase();
        switch (filter) {
          case "tag":
            return animal.tagId?.toLowerCase().includes(query);
          case "farmer_name":
            return animal.farmer?.fullName?.toLowerCase().includes(query);
          case "farmer_phone":
            return animal.farmer?.phoneNumber?.includes(searchQuery);
          default:
            return false;
        }
      })
    : [];

  // Format phone as user types: XXXX-XXXX-XXX
  const formatPhoneInput = (text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 4) return digits;
    if (digits.length <= 8) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    return `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8)}`;
  };

  const handleInputChange = useCallback(
    (text: string) => {
      if (filter === "farmer_phone") {
        setInputValue(formatPhoneInput(text));
      } else {
        setInputValue(text);
      }
    },
    [filter],
  );

  const handleFilterChange = useCallback((value: SearchFilter) => {
    setFilter(value);
    setInputValue("");
  }, []);

  const isLoading = searchLoading || animalsLoading;

  const handleAnimalSelect = useCallback(
    async (animal: Animal) => {
      if (createCaseAfterSelect && doctor) {
        if (creatingCaseRef.current) return;
        creatingCaseRef.current = true;
        try {
          const caseData = await createCaseMutation.mutateAsync({
            animalId: animal.animalId,
            doctorId: doctor.doctorId,
            caseDatetime: new Date().toISOString(),
            chiefComplaint: undefined,
            status: "COMPLETED",
          });
          router.replace(`/case-detail?caseId=${caseData.caseId}`);
        } catch (err) {
          creatingCaseRef.current = false;
          Alert.alert(
            "Error",
            err instanceof Error ? err.message : "Failed to create case",
          );
        }
        return;
      }
      if (!returnTo || typeof returnTo !== "string") {
        return;
      }
      router.push({
        pathname: returnTo as `/${string}`,
        params: { animalId: String(animal.animalId) },
      });
    },
    [createCaseAfterSelect, doctor, createCaseMutation, returnTo, router],
  );

  // ScrollView button pattern: delay press to avoid cancel (see development-guidelines.md)
  const handlePressAnimal = useCallback(
    (animal: Animal) => {
      handleAnimalSelect(animal);
    },
    [handleAnimalSelect],
  );

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
      if (
        response.matchStatus === "MATCH" &&
        response.matchedAnimalId != null
      ) {
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
  const formatAnimalSubtitle = (a: Animal) => {
    const parts: string[] = [];
    if (a.animalTagline) parts.push(a.animalTagline);
    parts.push(a.farmer?.fullName || "Unknown Farmer");
    if (a.farmer?.phoneNumber) parts.push(a.farmer.phoneNumber);
    return parts.join(" • ");
  };

  const renderAnimalItem = ({ item }: { item: Animal }) => (
    <ListRow
      title={formatAnimalTitle(item)}
      subtitle={formatAnimalSubtitle(item)}
      onPress={() => handlePressAnimal(item)}
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
            Choose face, ear, or body photo to match an enrolled animal
          </Text>
          <SegmentedControl
            options={[
              { label: "Face", value: "FACE" },
              { label: "Ear", value: "EAR" },
              { label: "Body", value: "BODY" },
            ]}
            selectedValue={imageMatchType}
            onValueChange={(value) => {
              setImageMatchType(value as ImageMatchType);
              clearMatchResult();
            }}
          />
          <Button
            title={
              matching
                ? "Matching…"
                : matchResult
                  ? "Try another photo"
                  : "Choose photo"
            }
            onPress={matchResult ? clearMatchResult : handleFindByImage}
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
            <View
              style={[styles.matchResult, { borderTopColor: colors.border }]}
            >
              {matchResult.matchStatus === "MATCH" && matchedAnimal ? (
                <>
                  <Text
                    style={[styles.matchStatusText, { color: colors.primary }]}
                  >
                    Match found ({(matchResult.bestScore * 100).toFixed(0)}%
                    match)
                  </Text>
                  <TouchableOpacity
                    style={styles.matchRow}
                    onPress={() => handleAnimalSelect(matchedAnimal)}
                    activeOpacity={0.7}
                  >
                    <TouchableOpacity
                      style={[
                        styles.matchAvatar,
                        { backgroundColor: colors.border },
                      ]}
                      onPress={() =>
                        router.push(
                          `/animal-details?animalId=${matchedAnimal.animalId}`,
                        )
                      }
                      activeOpacity={0.7}
                    >
                      {matchedFaceUrl ? (
                        <Image
                          source={{ uri: matchedFaceUrl }}
                          style={styles.matchAvatarImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <Text
                          style={[
                            styles.matchAvatarPlaceholder,
                            { color: colors.muted },
                          ]}
                        >
                          ?
                        </Text>
                      )}
                    </TouchableOpacity>
                    <View style={styles.matchRowContent}>
                      <Text
                        style={[styles.matchRowTitle, { color: colors.text }]}
                        numberOfLines={1}
                      >
                        {formatAnimalTitle(matchedAnimal)}
                      </Text>
                      <Text
                        style={[
                          styles.matchRowSubtitle,
                          { color: colors.muted },
                        ]}
                        numberOfLines={1}
                      >
                        {formatAnimalSubtitle(matchedAnimal)}
                      </Text>
                    </View>
                    <Text
                      style={[styles.matchRowChevron, { color: colors.muted }]}
                    >
                      ›
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={[styles.matchStatusText, { color: colors.muted }]}>
                  No match found
                </Text>
              )}
            </View>
          )}
        </Card>

        {/* Search section - filter first, then input */}
        <Card style={styles.card}>
          <Text style={[styles.filterLabel, { color: colors.text }]}>
            Search by
          </Text>
          <SegmentedControl
            options={[
              { label: "Tag ID", value: "tag" },
              { label: "Farmer Name", value: "farmer_name" },
              { label: "Phone", value: "farmer_phone" },
            ]}
            selectedValue={filter}
            onValueChange={(value) => handleFilterChange(value as SearchFilter)}
          />
          <View
            style={[
              styles.searchInputRow,
              { borderColor: colors.border, backgroundColor: colors.surface },
            ]}
          >
            {(filter === "tag" || filter === "farmer_phone") && (
              <Text style={[styles.searchPrefix, { color: colors.text }]}>
                {filter === "tag" ? "tag-" : "0092-"}
              </Text>
            )}
            <TextInput
              style={[
                styles.searchInputField,
                {
                  color: colors.text,
                },
                (filter === "tag" || filter === "farmer_phone") &&
                  styles.searchInputWithPrefix,
              ]}
              value={inputValue}
              onChangeText={handleInputChange}
              placeholder={
                filter === "tag"
                  ? "001"
                  : filter === "farmer_phone"
                    ? "0333-6831-836"
                    : "Farmer name"
              }
              placeholderTextColor={colors.muted}
            />
          </View>
        </Card>

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
  filterLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 12,
  },
  searchInputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
  },
  searchPrefix: {
    fontSize: 16,
    fontWeight: "500",
  },
  searchInputField: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 0,
  },
  searchInputWithPrefix: {
    marginLeft: 4,
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
  matchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 0,
    minHeight: 44,
  },
  matchAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  matchAvatarImage: {
    width: "100%",
    height: "100%",
  },
  matchAvatarPlaceholder: {
    fontSize: 18,
    fontWeight: "600",
  },
  matchRowContent: {
    flex: 1,
    marginRight: 8,
  },
  matchRowTitle: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 4,
  },
  matchRowSubtitle: {
    fontSize: 14,
  },
  matchRowChevron: {
    fontSize: 24,
  },
});
