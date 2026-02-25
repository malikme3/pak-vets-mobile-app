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
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Location from "expo-location";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useTheme } from "../theme/useTheme";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { ListRow } from "../components/ui/ListRow";
import { SegmentedControl } from "../components/ui/SegmentedControl";
import {
  useSearchAnimalsPaginated,
  useAnimalImages,
} from "../features/animals/hooks";
import { useCurrentDoctor } from "../features/doctors/hooks";
import { useCreateCase } from "../features/cases/hooks";
import { animalApi } from "../services/vetApi";
import {
  getUploadSignedUrl,
  getDownloadSignedUrl,
  getBucketName,
} from "../services/sharedServicesApi";
import { formatDistance } from "../utils/formatDistance";
import { SpeciesIcon } from "../components/SpeciesIcon";
import type { Animal, MatchAnimalImageResponse } from "../types/api";

type OwnerSearchFilter = "farmer_phone" | "farmer_nic" | "farmer_name";
type ImageMatchType = "FACE" | "EAR" | "BODY";
type NearbyRadiusUnit = "ft" | "m" | "km";

const MATCH_BY_IMAGE_ERROR_TITLE = "Match failed";
const NEARBY_DEFAULT_RADIUS_FT = 500;

/** Convert user radius (value + unit) to km for API. */
function radiusToKm(value: number, unit: NearbyRadiusUnit): number {
  if (!Number.isFinite(value) || value <= 0) return 0.1524; // fallback ~500 ft
  switch (unit) {
    case "ft":
      return (value * 0.3048) / 1000;
    case "m":
      return value / 1000;
    case "km":
      return value;
    default:
      return value / 1000;
  }
}
const MATCH_BY_IMAGE_ERROR_FALLBACK =
  "Could not find animal by image. Try again.";

function getMatchErrorMessage(err: unknown): string {
  if (
    err &&
    typeof err === "object" &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string"
  ) {
    return (err as { message: string }).message;
  }
  return err instanceof Error ? err.message : MATCH_BY_IMAGE_ERROR_FALLBACK;
}

const nearbyAnimalRowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 0,
    minHeight: 44,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    marginRight: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  content: { flex: 1, marginRight: 8, minWidth: 0 },
  title: { fontSize: 15, fontWeight: "600", marginBottom: 2 },
  tagline: { fontSize: 13 },
  distanceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  distanceBadgeText: { fontSize: 12, fontWeight: "600" },
});

/** Single row for nearby list: avatar, species/breed, tag line (wrap), distance on right */
function NearbyAnimalRow({
  animal,
  onPress,
}: {
  animal: Animal;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const title = [animal.species, animal.breed].filter(Boolean).join(" • ");
  const distanceStr =
    animal.distanceKm != null ? formatDistance(animal.distanceKm) : "";
  return (
    <TouchableOpacity
      style={nearbyAnimalRowStyles.row}
      onPress={() => setTimeout(onPress, 50)}
      activeOpacity={0.7}
    >
      <View style={nearbyAnimalRowStyles.avatarContainer}>
        <SpeciesIcon species={animal.species} size={40} resizeMode="cover" />
      </View>
      <View style={nearbyAnimalRowStyles.content}>
        {title ? (
          <Text
            style={[nearbyAnimalRowStyles.title, { color: colors.text }]}
            numberOfLines={1}
          >
            {title}
          </Text>
        ) : null}
        {animal.animalTagline ? (
          <Text
            style={[nearbyAnimalRowStyles.tagline, { color: colors.muted }]}
            numberOfLines={2}
          >
            {animal.animalTagline}
          </Text>
        ) : null}
      </View>
      {distanceStr ? (
        <View
          style={[
            nearbyAnimalRowStyles.distanceBadge,
            { backgroundColor: colors.border },
          ]}
        >
          <FontAwesome name="map-marker" size={10} color={colors.primary} />
          <Text
            style={[
              nearbyAnimalRowStyles.distanceBadgeText,
              { color: colors.text },
            ]}
            numberOfLines={1}
          >
            {distanceStr}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const CREATE_ANIMAL_SPECIES_OPTIONS = [
  "Cow",
  "Buffalo",
  "Horse",
  "Camel",
  "Goat",
  "Sheep",
  "Other",
] as const;
type CreateAnimalSpeciesOption = (typeof CREATE_ANIMAL_SPECIES_OPTIONS)[number];

export default function SelectAnimalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors, isDark } = useTheme();
  const returnTo = (params.returnTo as string) || "/create-case";
  const createCaseAfterSelect = params.createCaseAfterSelect === "1";
  const { data: doctor } = useCurrentDoctor();
  const createCaseMutation = useCreateCase();
  const creatingCaseRef = useRef(false);

  const [ownerInputValue, setOwnerInputValue] = useState("");
  const [ownerFilter, setOwnerFilter] =
    useState<OwnerSearchFilter>("farmer_name");
  const [tagInputValue, setTagInputValue] = useState("");
  const [imageMatchType, setImageMatchType] = useState<ImageMatchType>("FACE");
  const [matching, setMatching] = useState(false);
  const [matchResult, setMatchResult] =
    useState<MatchAnimalImageResponse | null>(null);
  const [matchedAnimal, setMatchedAnimal] = useState<Animal | null>(null);

  // Create New Animal flow: species selection modal
  const [createAnimalModalVisible, setCreateAnimalModalVisible] =
    useState(false);
  const [selectedSpeciesOption, setSelectedSpeciesOption] =
    useState<CreateAnimalSpeciesOption | null>(null);
  const [otherSpeciesText, setOtherSpeciesText] = useState("");
  const [startUploadingLoading, setStartUploadingLoading] = useState(false);

  // Find nearby: default 500 ft, user can pick value + unit (ft, m, km)
  const [nearbyRadiusValue, setNearbyRadiusValue] = useState(
    String(NEARBY_DEFAULT_RADIUS_FT),
  );
  const [nearbyRadiusUnit, setNearbyRadiusUnit] =
    useState<NearbyRadiusUnit>("ft");
  const [nearbyAnimals, setNearbyAnimals] = useState<Animal[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);

  // Owner search query (phone with prefix, NIC and name as-is)
  const ownerQuery =
    ownerInputValue.trim() === ""
      ? ""
      : ownerFilter === "farmer_phone"
        ? `0092-${ownerInputValue}`
        : ownerInputValue.trim();

  const tagQuery =
    tagInputValue.trim() === "" ? "" : `tag-${tagInputValue.trim()}`;

  const {
    data: ownerSearchPages,
    isLoading: ownerSearchLoading,
    isFetchingNextPage: ownerFetchingNextPage,
    hasNextPage: ownerHasNextPage,
    fetchNextPage: fetchOwnerNextPage,
  } = useSearchAnimalsPaginated(ownerQuery, 20);
  const {
    data: tagSearchPages,
    isLoading: tagSearchLoading,
    isFetchingNextPage: tagFetchingNextPage,
    hasNextPage: tagHasNextPage,
    fetchNextPage: fetchTagNextPage,
  } = useSearchAnimalsPaginated(tagQuery, 20);
  const { data: matchedAnimalImages = [] } = useAnimalImages(
    matchedAnimal?.animalId ?? 0,
  );
  const matchedFaceUrl =
    matchedAnimalImages.find((i) => i.imageType === "FACE")?.s3Url ?? null;

  // Owner results: filter by selected owner field
  const ownerResults =
    ownerQuery === ""
      ? []
      : (ownerSearchPages?.pages.flatMap((page) => page.items) || []).filter(
          (animal) => {
            const q = ownerQuery.toLowerCase();
            switch (ownerFilter) {
              case "farmer_phone":
                return animal.farmer?.phoneNumber?.includes(ownerQuery);
              case "farmer_nic":
                return animal.farmer?.nicNo?.toLowerCase().includes(q);
              case "farmer_name":
                return animal.farmer?.fullName?.toLowerCase().includes(q);
              default:
                return false;
            }
          },
        );

  // Tag results: filter by tagId
  const tagResults =
    tagQuery === ""
      ? []
      : (tagSearchPages?.pages.flatMap((page) => page.items) || []).filter(
          (animal) =>
            animal.tagId?.toLowerCase().includes(tagQuery.toLowerCase()),
        );

  // Combined results, dedupe by animalId
  const resultsById = new Map<number, Animal>();
  ownerResults.forEach((a) => resultsById.set(a.animalId, a));
  tagResults.forEach((a) => resultsById.set(a.animalId, a));
  const results = Array.from(resultsById.values());

  // Format phone as user types: XXXX-XXXX-XXX
  const formatPhoneInput = (text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 4) return digits;
    if (digits.length <= 8) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    return `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8)}`;
  };

  const handleOwnerInputChange = useCallback(
    (text: string) => {
      if (ownerFilter === "farmer_phone") {
        setOwnerInputValue(formatPhoneInput(text));
      } else {
        setOwnerInputValue(text);
      }
    },
    [ownerFilter],
  );

  const handleOwnerFilterChange = useCallback((value: OwnerSearchFilter) => {
    setOwnerFilter(value);
    setOwnerInputValue("");
  }, []);

  const fetchNearbyAnimals = useCallback(async () => {
    setNearbyLoading(true);
    setNearbyAnimals([]);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Location required",
          "Please allow location access to find animals nearby.",
          [{ text: "OK" }],
        );
        setNearbyLoading(false);
        return;
      }
      let loc = await Location.getLastKnownPositionAsync({
        maxAge: 60_000,
      });
      if (!loc) {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Location timed out.")), 12_000),
        );
        loc = await Promise.race([
          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Low,
          }),
          timeoutPromise,
        ]);
      }
      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;
      const value = parseFloat(nearbyRadiusValue) || NEARBY_DEFAULT_RADIUS_FT;
      const radiusKm = radiusToKm(value, nearbyRadiusUnit);
      const list = await animalApi.getAllAnimals({
        latitude: lat,
        longitude: lng,
        radiusKm,
      });
      setNearbyAnimals(list);
    } catch (err) {
      Alert.alert(
        "Error",
        err instanceof Error
          ? err.message
          : "Failed to find animals nearby. Try again.",
      );
    } finally {
      setNearbyLoading(false);
    }
  }, [nearbyRadiusValue, nearbyRadiusUnit]);

  const isLoading = ownerSearchLoading || tagSearchLoading;
  const isLoadingMore = ownerFetchingNextPage || tagFetchingNextPage;
  const hasMoreResults = Boolean(ownerHasNextPage || tagHasNextPage);

  const handleLoadMoreResults = useCallback(async () => {
    await Promise.all([
      ownerHasNextPage ? fetchOwnerNextPage() : Promise.resolve(),
      tagHasNextPage ? fetchTagNextPage() : Promise.resolve(),
    ]);
  }, [ownerHasNextPage, tagHasNextPage, fetchOwnerNextPage, fetchTagNextPage]);

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
    setSelectedSpeciesOption(null);
    setOtherSpeciesText("");
    setCreateAnimalModalVisible(true);
  };

  const resolvedSpecies =
    selectedSpeciesOption === "Other"
      ? otherSpeciesText.trim()
      : (selectedSpeciesOption ?? "");

  const canStartUploading =
    selectedSpeciesOption != null &&
    (selectedSpeciesOption !== "Other" || otherSpeciesText.trim().length > 0);

  const LOCATION_MAX_AGE_MS = 60_000; // Use cached location up to 1 min old
  const LOCATION_TIMEOUT_MS = 12_000; // Don't wait for GPS longer than 12s

  const handleStartUploadingPhotos = async () => {
    if (!canStartUploading) return;
    setStartUploadingLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Location required",
          "Please allow location access to record where the animal is being registered.",
          [{ text: "OK" }],
        );
        setStartUploadingLoading(false);
        return;
      }
      // Prefer last known position (instant when available); fallback to current with low accuracy + timeout
      let loc = await Location.getLastKnownPositionAsync({
        maxAge: LOCATION_MAX_AGE_MS,
      });
      if (!loc) {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  "Location timed out. Try again with GPS or network enabled.",
                ),
              ),
            LOCATION_TIMEOUT_MS,
          ),
        );
        loc = await Promise.race([
          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Low,
          }),
          timeoutPromise,
        ]);
      }
      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;

      const created = await animalApi.createAnimal({
        species: resolvedSpecies,
        latitude: lat,
        longitude: lng,
      });

      setCreateAnimalModalVisible(false);
      setSelectedSpeciesOption(null);
      setOtherSpeciesText("");
      router.push({
        pathname: "/create-animal",
        params: {
          returnTo,
          animalId: String(created.animalId),
          species: resolvedSpecies,
          latitude: String(lat),
          longitude: String(lng),
          startAtUpload: "1",
        },
      });
    } catch (e) {
      if (__DEV__) console.error("[SelectAnimal] Create animal / location:", e);
      Alert.alert(
        "Error",
        e instanceof Error
          ? e.message
          : "Failed to create animal. Please try again.",
        [{ text: "OK" }],
      );
    } finally {
      setStartUploadingLoading(false);
    }
  };

  const uploadImageToS3 = async (
    imageUri: string,
    s3Key: string,
  ): Promise<{ fileUrl: string; s3Key: string }> => {
    const bucketName = getBucketName();
    const { signedUrl, fileUrl } = await getUploadSignedUrl(
      bucketName,
      s3Key,
      "type=match-query",
    );
    const fileInfo = await FileSystem.getInfoAsync(imageUri);
    if (!fileInfo.exists) throw new Error("File does not exist");
    const uploadResult = await FileSystem.uploadAsync(signedUrl, imageUri, {
      httpMethod: "PUT",
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: { "Content-Type": "image/jpeg" },
    });
    if (uploadResult.status !== 200) {
      throw new Error(`S3 upload failed with status ${uploadResult.status}`);
    }
    return { fileUrl, s3Key };
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

  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "We need camera access to take a photo.",
      );
      return false;
    }
    return true;
  };

  const processImageUriAndMatch = async (uri: string) => {
    const s3Key = `match-query/original-image/${Date.now()}-${imageMatchType.toLowerCase()}.jpg`;
    const { fileUrl } = await uploadImageToS3(uri, s3Key);
    const bucketName = getBucketName();
    let imageUrl = fileUrl;
    try {
      imageUrl = await getDownloadSignedUrl(bucketName, s3Key);
    } catch {
      // fallback to fileUrl if signed download fails
    }
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
  };

  const handleChoosePhoto = async () => {
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
      await processImageUriAndMatch(result.assets[0].uri);
    } catch (err) {
      Alert.alert(MATCH_BY_IMAGE_ERROR_TITLE, getMatchErrorMessage(err));
    } finally {
      setMatching(false);
    }
  };

  const handleTakePhoto = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;
    setMatching(true);
    setMatchResult(null);
    setMatchedAnimal(null);
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets[0]) {
        setMatching(false);
        return;
      }
      await processImageUriAndMatch(result.assets[0].uri);
    } catch (err) {
      Alert.alert(MATCH_BY_IMAGE_ERROR_TITLE, getMatchErrorMessage(err));
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
      edges={["top"]}
    >
      <StatusBar style={isDark ? "light" : "dark"} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>
            Select animal
          </Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Find by location, photo, or search
          </Text>
        </View>

        {/* Find nearby */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View
              style={[
                styles.sectionIconWrap,
                { backgroundColor: `${colors.primary}18` },
              ]}
            >
              <FontAwesome name="map-marker" size={16} color={colors.primary} />
            </View>
            <View style={styles.sectionTitleWrap}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Find nearby
              </Text>
              <Text style={[styles.sectionHint, { color: colors.muted }]}>
                Within radius · default 500 ft
              </Text>
            </View>
          </View>
          <View style={styles.nearbyRadiusRow}>
            <TextInput
              style={[
                styles.nearbyRadiusInput,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                  color: colors.text,
                },
              ]}
              value={nearbyRadiusValue}
              onChangeText={(text) => {
                const cleaned = text.replace(/[^0-9.]/g, "");
                setNearbyRadiusValue(cleaned);
              }}
              placeholder="500"
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
            />
            <View style={styles.nearbyUnitPillRow}>
              {(
                [
                  { value: "ft" as const, label: "Feet" },
                  { value: "m" as const, label: "Meter" },
                  { value: "km" as const, label: "Km" },
                ] as const
              ).map(({ value, label }) => (
                <TouchableOpacity
                  key={value}
                  onPress={() => setNearbyRadiusUnit(value)}
                  style={[
                    styles.nearbyUnitPill,
                    {
                      backgroundColor:
                        nearbyRadiusUnit === value
                          ? colors.primary
                          : "transparent",
                      borderColor:
                        nearbyRadiusUnit === value
                          ? colors.primary
                          : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.nearbyUnitPillText,
                      {
                        color:
                          nearbyRadiusUnit === value
                            ? (colors.onPrimary ?? "#fff")
                            : colors.text,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <Button
            title={nearbyLoading ? "Finding…" : "Find nearby"}
            onPress={fetchNearbyAnimals}
            variant="primary"
            style={styles.primaryActionButton}
            disabled={nearbyLoading}
          />
          {nearbyAnimals.length > 0 && (
            <View
              style={[styles.resultBlock, { borderTopColor: colors.border }]}
            >
              <Text style={[styles.resultCount, { color: colors.muted }]}>
                {nearbyAnimals.length}{" "}
                {nearbyAnimals.length === 1 ? "animal" : "animals"} in range
              </Text>
              <FlatList
                data={nearbyAnimals}
                keyExtractor={(item) => String(item.animalId)}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <NearbyAnimalRow
                    animal={item}
                    onPress={() => handlePressAnimal(item)}
                  />
                )}
                ItemSeparatorComponent={() => (
                  <View
                    style={[
                      styles.listSeparator,
                      { backgroundColor: colors.border },
                    ]}
                  />
                )}
              />
            </View>
          )}
        </Card>

        {/* Find by image */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View
              style={[
                styles.sectionIconWrap,
                { backgroundColor: `${colors.primary}18` },
              ]}
            >
              <FontAwesome name="camera" size={16} color={colors.primary} />
            </View>
            <View style={styles.sectionTitleWrap}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Find by image
              </Text>
              <Text style={[styles.sectionHint, { color: colors.muted }]}>
                Face, ear, or body photo
              </Text>
            </View>
          </View>
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
          {matching ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.loadingRowText, { color: colors.muted }]}>
                Finding animal…
              </Text>
            </View>
          ) : matchResult ? (
            <Button
              title="Try another photo"
              onPress={clearMatchResult}
              variant="secondary"
              style={styles.secondaryButton}
            />
          ) : (
            <View style={styles.twoButtonRow}>
              <Button
                title="Choose photo"
                onPress={handleChoosePhoto}
                variant="secondary"
                style={styles.halfButton}
              />
              <Button
                title="Take photo"
                onPress={handleTakePhoto}
                variant="secondary"
                style={styles.halfButton}
              />
            </View>
          )}
          {matchResult && !matching && (
            <View
              style={[styles.resultBlock, { borderTopColor: colors.border }]}
            >
              {matchResult.matchStatus === "MATCH" && matchedAnimal ? (
                <>
                  <Text
                    style={[styles.matchSuccessText, { color: colors.primary }]}
                  >
                    Match ({(matchResult.bestScore * 100).toFixed(0)}%)
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
                    <FontAwesome
                      name="chevron-right"
                      size={14}
                      color={colors.muted}
                    />
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={[styles.noMatchText, { color: colors.muted }]}>
                  No match found
                </Text>
              )}
            </View>
          )}
        </Card>

        {/* Find by Owner */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View
              style={[
                styles.sectionIconWrap,
                { backgroundColor: `${colors.primary}18` },
              ]}
            >
              <FontAwesome name="user" size={16} color={colors.primary} />
            </View>
            <View style={styles.sectionTitleWrap}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Find by Owner
              </Text>
              <Text style={[styles.sectionHint, { color: colors.muted }]}>
                Owner phone, NIC #, or name
              </Text>
            </View>
          </View>
          <SegmentedControl
            options={[
              { label: "Phone", value: "farmer_phone" },
              { label: "NIC #", value: "farmer_nic" },
              { label: "Name", value: "farmer_name" },
            ]}
            selectedValue={ownerFilter}
            onValueChange={(value) =>
              handleOwnerFilterChange(value as OwnerSearchFilter)
            }
          />
          <View
            style={[
              styles.searchInputRow,
              {
                borderColor: colors.border,
                backgroundColor: colors.background,
              },
            ]}
          >
            {ownerFilter === "farmer_phone" && (
              <Text style={[styles.searchPrefix, { color: colors.muted }]}>
                0092-
              </Text>
            )}
            <TextInput
              style={[
                styles.searchInputField,
                { color: colors.text },
                ownerFilter === "farmer_phone" && styles.searchInputWithPrefix,
              ]}
              value={ownerInputValue}
              onChangeText={handleOwnerInputChange}
              placeholder={
                ownerFilter === "farmer_phone"
                  ? "333-6831836"
                  : ownerFilter === "farmer_nic"
                    ? "NIC number"
                    : "Owner name"
              }
              placeholderTextColor={colors.muted}
            />
          </View>
        </Card>

        {/* Find by Tag */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View
              style={[
                styles.sectionIconWrap,
                { backgroundColor: `${colors.primary}18` },
              ]}
            >
              <FontAwesome name="tag" size={16} color={colors.primary} />
            </View>
            <View style={styles.sectionTitleWrap}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Find by Tag
              </Text>
              <Text style={[styles.sectionHint, { color: colors.muted }]}>
                Animal tag ID
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.searchInputRow,
              {
                borderColor: colors.border,
                backgroundColor: colors.background,
              },
            ]}
          >
            <Text style={[styles.searchPrefix, { color: colors.muted }]}>
              tag-
            </Text>
            <TextInput
              style={[
                styles.searchInputField,
                { color: colors.text },
                styles.searchInputWithPrefix,
              ]}
              value={tagInputValue}
              onChangeText={setTagInputValue}
              placeholder="e.g. 001"
              placeholderTextColor={colors.muted}
            />
          </View>
        </Card>

        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        )}

        {results.length > 0 && (
          <View style={styles.resultsSection}>
            <Text style={[styles.resultsTitle, { color: colors.muted }]}>
              {results.length} {results.length === 1 ? "result" : "results"}
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
                      styles.listSeparator,
                      { backgroundColor: colors.border },
                    ]}
                  />
                )}
              />
            </Card>
            {hasMoreResults && (
              <Button
                title={isLoadingMore ? "Loading more..." : "Load more results"}
                onPress={handleLoadMoreResults}
                disabled={isLoadingMore}
                variant="secondary"
                style={styles.loadMoreButton}
              />
            )}
          </View>
        )}

        <View style={styles.footer}>
          <Text style={[styles.footerLabel, { color: colors.muted }]}>
            Animal not in list?
          </Text>
          <Button
            title="Create new animal"
            onPress={handleCreateAnimal}
            variant="secondary"
            style={styles.footerButton}
          />
        </View>
      </ScrollView>

      <Modal
        visible={createAnimalModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCreateAnimalModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setCreateAnimalModalVisible(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={[styles.modalSheet, { backgroundColor: colors.surface }]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Create new animal
            </Text>
            <Text style={[styles.modalSubtitle, { color: colors.muted }]}>
              Choose species
            </Text>

            <View style={styles.radioGroup}>
              {CREATE_ANIMAL_SPECIES_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[styles.radioRow, { borderColor: colors.border }]}
                  onPress={() => setSelectedSpeciesOption(option)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.radioOuter,
                      {
                        borderColor:
                          selectedSpeciesOption === option
                            ? colors.primary
                            : colors.border,
                      },
                    ]}
                  >
                    {selectedSpeciesOption === option ? (
                      <View
                        style={[
                          styles.radioInner,
                          { backgroundColor: colors.primary },
                        ]}
                      />
                    ) : null}
                  </View>
                  <Text style={[styles.radioLabel, { color: colors.text }]}>
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {selectedSpeciesOption === "Other" ? (
              <View style={styles.otherSpeciesWrap}>
                <Text
                  style={[styles.otherSpeciesLabel, { color: colors.text }]}
                >
                  Species name
                </Text>
                <TextInput
                  style={[
                    styles.otherSpeciesInput,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  value={otherSpeciesText}
                  onChangeText={setOtherSpeciesText}
                  placeholder="Enter species"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="words"
                />
              </View>
            ) : null}

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setCreateAnimalModalVisible(false)}
                style={styles.modalCancelBtn}
              />
              <Button
                title={startUploadingLoading ? "Getting location…" : "Next"}
                variant="primary"
                onPress={handleStartUploadingPhotos}
                style={styles.modalNextBtn}
                disabled={!canStartUploading || startUploadingLoading}
              />
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    marginTop: 4,
    opacity: 0.85,
  },
  sectionCard: {
    marginBottom: 20,
    borderRadius: 16,
    padding: 20,
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  sectionTitleWrap: { flex: 1 },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  sectionHint: {
    fontSize: 13,
    marginTop: 2,
  },
  nearbyRadiusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  nearbyRadiusInput: {
    width: 72,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  nearbyUnitPillRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
    flex: 1,
  },
  nearbyUnitPill: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  nearbyUnitPillText: {
    fontSize: 13,
    fontWeight: "600",
  },
  primaryActionButton: {
    marginTop: 4,
  },
  secondaryButton: {
    marginTop: 12,
  },
  twoButtonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  halfButton: { flex: 1 },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
  },
  loadingRowText: {
    fontSize: 14,
  },
  resultBlock: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
  },
  resultCount: {
    fontSize: 13,
    marginBottom: 12,
  },
  matchSuccessText: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 12,
  },
  noMatchText: {
    fontSize: 15,
  },
  matchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    minHeight: 56,
  },
  matchAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: "hidden",
    marginRight: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  matchAvatarImage: { width: "100%", height: "100%" },
  matchAvatarPlaceholder: { fontSize: 20, fontWeight: "600" },
  matchRowContent: { flex: 1, marginRight: 10, minWidth: 0 },
  matchRowTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  matchRowSubtitle: { fontSize: 14 },
  searchInputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    minHeight: 48,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  searchPrefix: {
    fontSize: 15,
    fontWeight: "500",
  },
  searchInputField: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 0,
  },
  searchInputWithPrefix: { marginLeft: 6 },
  resultsSection: { marginTop: 8, marginBottom: 24 },
  resultsTitle: {
    fontSize: 13,
    marginBottom: 10,
  },
  resultsCard: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  loadMoreButton: {
    marginTop: 12,
  },
  listSeparator: {
    height: 1,
    marginLeft: 0,
  },
  loadingContainer: {
    paddingVertical: 20,
    alignItems: "center",
  },
  footer: {
    marginTop: 24,
    paddingTop: 8,
    alignItems: "center",
  },
  footerLabel: {
    fontSize: 14,
    marginBottom: 10,
  },
  footerButton: {
    minWidth: 200,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 15,
    marginBottom: 22,
  },
  radioGroup: { marginBottom: 20 },
  radioRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    marginRight: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  radioLabel: { fontSize: 16, fontWeight: "500" },
  otherSpeciesWrap: { marginBottom: 22 },
  otherSpeciesLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  otherSpeciesInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  modalCancelBtn: { flex: 1 },
  modalNextBtn: { flex: 1 },
});
