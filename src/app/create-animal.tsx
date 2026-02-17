import { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
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
import { useCreateAnimal } from "../features/animals/hooks";
import { animalApi, farmerApi } from "../services/vetApi";
import {
  getUploadSignedUrl,
  getBucketName,
  analyzeAnimalImage,
} from "../services/sharedServicesApi";
import {
  formatPhoneInput,
  normalizePhone,
  isValidPhone,
  formatPhoneDisplay,
} from "../utils/phone";
import type { CreateAnimalRequest, Farmer, AnimalStatus } from "../types/api";
import { estimateWeightKg } from "../utils/animalWeight";
import type { AnimalInfoFromImage } from "../services/sharedServicesApi";
import FontAwesome from "@expo/vector-icons/FontAwesome";

type Step = "farmer" | "upload" | "attributes";
type ImageType = "face" | "ear" | "body";

const STEPS: { key: Step; label: string; icon: string }[] = [
  { key: "farmer", label: "Farmer", icon: "user" },
  { key: "upload", label: "Upload", icon: "camera" },
  { key: "attributes", label: "Details", icon: "list" },
];

interface SelectedImage {
  uri: string;
  type: ImageType;
}

/** Label (with optional icon) and input on the same row. */
function InputRow({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  colors,
  multiline,
  icon,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "number-pad" | "phone-pad" | "decimal-pad";
  colors: {
    text: string;
    muted: string;
    border: string;
    surface: string;
    primary: string;
  };
  multiline?: boolean;
  icon?: string;
}) {
  return (
    <View style={inputRowStyles.row}>
      <View style={inputRowStyles.labelWrap}>
        {icon ? (
          <FontAwesome
            name={icon as "phone" | "user" | "id-card" | "map-marker"}
            size={14}
            color={colors.primary}
            style={inputRowStyles.labelIcon}
          />
        ) : null}
        <Text
          style={[inputRowStyles.label, { color: colors.text }]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
      <TextInput
        style={[
          inputRowStyles.input,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            color: colors.text,
          },
          multiline && inputRowStyles.inputMultiline,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={multiline ? 2 : 1}
      />
    </View>
  );
}

const inputRowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    gap: 12,
  },
  labelWrap: { flexDirection: "row", alignItems: "center", minWidth: 100 },
  labelIcon: { marginRight: 6 },
  label: {
    fontSize: 14,
    fontWeight: "600",
  },
  input: {
    flex: 1,
    minHeight: 46,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  inputMultiline: { minHeight: 72, textAlignVertical: "top" },
});

export default function CreateAnimalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors } = useTheme();
  const returnTo = (params.returnTo as string) || "/create-case";

  const [step, setStep] = useState<Step>("farmer");

  // Step 1: Farmer – phone, nic_no, name, address (village, teh, district); pick existing or create
  const [farmerPhone, setFarmerPhone] = useState("");
  const [farmerNicNo, setFarmerNicNo] = useState("");
  const [farmerName, setFarmerName] = useState("");
  const [farmerVillage, setFarmerVillage] = useState("");
  const [farmerTehName, setFarmerTehName] = useState("");
  const [farmerDistrict, setFarmerDistrict] = useState("");
  const [selectedFarmerId, setSelectedFarmerId] = useState<number | null>(null);
  const [farmerStepLoading, setFarmerStepLoading] = useState(false);
  const [existingFarmersModal, setExistingFarmersModal] = useState<
    Farmer[] | null
  >(null);
  const [farmersMatchingPhone, setFarmersMatchingPhone] = useState<Farmer[]>(
    [],
  );
  const [existingFarmerByNIC, setExistingFarmerByNIC] = useState<Farmer | null>(
    null,
  );
  const [checkingExistence, setCheckingExistence] = useState(false);
  const farmerCheckTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Step 2: Upload
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploadedUrls, setUploadedUrls] = useState<{
    faceImageUrl: string;
    earImageUrl: string;
    bodyImageUrl: string;
  } | null>(null);
  const [analyzedAnimal, setAnalyzedAnimal] =
    useState<AnimalInfoFromImage | null>(null);

  // Step 3: Animal attributes (editable, pre-filled from API)
  const [species, setSpecies] = useState("");
  const [breed, setBreed] = useState("");
  const [ageMonths, setAgeMonths] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [status, setStatus] = useState<AnimalStatus | "">("");
  const [otherStatusValue, setOtherStatusValue] = useState("");
  const [heartGirthCm, setHeartGirthCm] = useState("");
  const [bodyLengthCm, setBodyLengthCm] = useState("");
  const [color, setColor] = useState("");
  const [sex, setSex] = useState("");
  const [tagId, setTagId] = useState("");
  const [animalTagline, setAnimalTagline] = useState("");
  const [aiShortSummary, setAiShortSummary] = useState("");
  const [aiSummary, setAiSummary] = useState("");

  const [statusPickerOpen, setStatusPickerOpen] = useState(false);
  const [enrolling, setEnrolling] = useState(false);

  const createAnimalMutation = useCreateAnimal();

  // When species, heart girth, and body length are set, show estimated weight in the field (updates as user types).
  useEffect(() => {
    const g = heartGirthCm.trim() ? parseFloat(heartGirthCm) : NaN;
    const l = bodyLengthCm.trim() ? parseFloat(bodyLengthCm) : NaN;
    if (
      !species.trim() ||
      !Number.isFinite(g) ||
      !Number.isFinite(l) ||
      g <= 0 ||
      l <= 0
    )
      return;
    const estimated = estimateWeightKg(species.trim(), g, l);
    if (estimated != null) setWeightKg(String(estimated));
  }, [species, heartGirthCm, bodyLengthCm]);

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Sorry, we need camera roll permissions to upload photos!",
      );
      return false;
    }
    return true;
  };

  const requestCameraPermissions = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Sorry, we need camera permissions to take photos!",
      );
      return false;
    }
    return true;
  };

  const pickImage = async (type: ImageType) => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setSelectedImages((prev) => {
        const filtered = prev.filter((img) => img.type !== type);
        return [...filtered, { uri: result.assets[0].uri, type }];
      });
    }
  };

  const takePhoto = async (type: ImageType) => {
    const hasPermission = await requestCameraPermissions();
    if (!hasPermission) return;
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setSelectedImages((prev) => {
        const filtered = prev.filter((img) => img.type !== type);
        return [...filtered, { uri: result.assets[0].uri, type }];
      });
    }
  };

  const uploadImageToS3 = async (
    imageUri: string,
    s3Key: string,
  ): Promise<string> => {
    const bucketName = getBucketName();
    const { signedUrl, fileUrl } = await getUploadSignedUrl(
      bucketName,
      s3Key,
      "type=animal-reference-image",
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
    const response = await fetch(signedUrl, {
      method: "PUT",
      body: bytes,
      headers: { "Content-Type": "image/jpeg" },
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`S3 upload failed: ${errorText || response.statusText}`);
    }
    return fileUrl;
  };

  const handleNextFromUpload = async () => {
    const faceImage = selectedImages.find((img) => img.type === "face");
    const earImage = selectedImages.find((img) => img.type === "ear");
    const bodyImage = selectedImages.find((img) => img.type === "body");
    if (!faceImage || !earImage || !bodyImage) {
      Alert.alert(
        "Error",
        "Please upload all three images: Face, Ear, and Body",
      );
      return;
    }

    setUploading(true);
    setAnalyzing(false);
    setUploadProgress(0);
    try {
      const timestamp = Date.now();
      const faceKey = `create-animal-temp/${timestamp}-face.jpg`;
      const earKey = `create-animal-temp/${timestamp}-ear.jpg`;
      const bodyKey = `create-animal-temp/${timestamp}-body.jpg`;

      setUploadProgress(15);
      const faceImageUrl = await uploadImageToS3(faceImage.uri, faceKey);
      setUploadProgress(40);
      const earImageUrl = await uploadImageToS3(earImage.uri, earKey);
      setUploadProgress(65);
      const bodyImageUrl = await uploadImageToS3(bodyImage.uri, bodyKey);
      setUploadProgress(80);
      setUploadedUrls({ faceImageUrl, earImageUrl, bodyImageUrl });

      setAnalyzing(true);
      const animal = await analyzeAnimalImage({
        faceImageUrl,
        earImageUrl,
        bodyImageUrl,
      });
      setAnalyzedAnimal(animal);
      setUploadProgress(100);
      // Pre-fill step 3 form from API (null/empty stays editable)
      setSpecies(animal.species ?? "");
      setBreed(animal.breed ?? "");
      setAgeMonths(animal.age_months != null ? String(animal.age_months) : "");
      setWeightKg(animal.weight_kg != null ? String(animal.weight_kg) : "");
      setColor(animal.color ?? "");
      setSex(animal.sex ?? "");
      setAnimalTagline(animal.animal_tagline ?? "");
      setAiShortSummary(animal.ai_short_summary ?? "");
      setAiSummary(animal.ai_summary ?? "");
      setStep("attributes");
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error
          ? error.message
          : "Failed to upload or analyze images. Please try again.",
      );
    } finally {
      setUploading(false);
      setAnalyzing(false);
      setUploadProgress(0);
    }
  };

  const buildAnimalRequest = useCallback(
    (): CreateAnimalRequest => ({
      farmerId: selectedFarmerId ?? undefined,
      species: species.trim(),
      breed: breed.trim() || undefined,
      tagId: tagId.trim() || undefined,
      sex: sex.trim() || undefined,
      color: color.trim() || undefined,
      ageMonths: ageMonths.trim() ? parseInt(ageMonths, 10) : undefined,
      weightKg: weightKg.trim() ? parseFloat(weightKg) : undefined,
      status: status ? (status as AnimalStatus) : undefined,
      otherStatusValue:
        status === "OTHER" && otherStatusValue.trim()
          ? otherStatusValue.trim()
          : undefined,
      heartGirthCm: heartGirthCm.trim() ? parseFloat(heartGirthCm) : undefined,
      bodyLengthCm: bodyLengthCm.trim() ? parseFloat(bodyLengthCm) : undefined,
      animalTagline: animalTagline.trim() || undefined,
      aiShortSummary: aiShortSummary.trim() || undefined,
      aiSummary: aiSummary.trim() || undefined,
    }),
    [
      selectedFarmerId,
      species,
      breed,
      tagId,
      sex,
      color,
      ageMonths,
      weightKg,
      status,
      otherStatusValue,
      heartGirthCm,
      bodyLengthCm,
      animalTagline,
      aiShortSummary,
      aiSummary,
    ],
  );

  const handleNextFromAttributes = useCallback(async () => {
    if (!species.trim()) {
      Alert.alert("Error", "Species is required");
      return;
    }
    try {
      const request = buildAnimalRequest();
      const created = await createAnimalMutation.mutateAsync(request);
      const animalIdToUse = created.animalId;
      if (uploadedUrls) {
        setEnrolling(true);
        try {
          await animalApi.enrollAnimalImages(animalIdToUse, {
            faceImageUrl: uploadedUrls.faceImageUrl,
            earImageUrl: uploadedUrls.earImageUrl,
            bodyImageUrl: uploadedUrls.bodyImageUrl,
            source: "Mobile App",
          });
        } catch (err) {
          Alert.alert(
            "Error",
            err instanceof Error ? err.message : "Failed to enroll images",
          );
          setEnrolling(false);
          return;
        }
        setEnrolling(false);
      }
      if (returnTo && typeof returnTo === "string") {
        router.replace({
          pathname: returnTo as `/${string}`,
          params: { animalId: String(animalIdToUse) },
        });
      } else {
        router.back();
      }
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Failed to create animal",
      );
    }
  }, [
    species,
    buildAnimalRequest,
    createAnimalMutation,
    uploadedUrls,
    returnTo,
    router,
  ]);

  const goBack = () => {
    if (step === "farmer") router.back();
    else if (step === "upload") setStep("farmer");
    else setStep("upload");
  };

  const hasAllThreeImages =
    selectedImages.some((i) => i.type === "face") &&
    selectedImages.some((i) => i.type === "ear") &&
    selectedImages.some((i) => i.type === "body");

  const currentStepIndex = STEPS.findIndex((s) => s.key === step) + 1;

  const renderHeader = (title: string) => (
    <View style={[styles.header, { borderBottomColor: colors.border }]}>
      <TouchableOpacity
        onPress={goBack}
        style={[styles.backButton, { backgroundColor: colors.surface }]}
        activeOpacity={0.7}
      >
        <FontAwesome name="arrow-left" size={18} color={colors.primary} />
      </TouchableOpacity>
      <View style={styles.headerTitleWrap}>
        <FontAwesome
          name="paw"
          size={20}
          color={colors.primary}
          style={styles.headerTitleIcon}
        />
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      </View>
    </View>
  );

  const progressPercent = (currentStepIndex / STEPS.length) * 100;
  const renderStepper = () => (
    <View
      style={[
        styles.stepper,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.stepperTop}>
        <Text style={[styles.stepperTitle, { color: colors.muted }]}>
          Step {currentStepIndex} of {STEPS.length}
        </Text>
        <View
          style={[styles.stepperProgressBg, { backgroundColor: colors.border }]}
        >
          <View
            style={[
              styles.stepperProgressFill,
              { width: `${progressPercent}%`, backgroundColor: colors.primary },
            ]}
          />
        </View>
      </View>
      <View style={styles.stepperDots}>
        {STEPS.map((s, i) => {
          const isActive = s.key === step;
          const isPast = STEPS.findIndex((x) => x.key === step) > i;
          return (
            <View key={s.key} style={styles.stepperDotWrap}>
              <View
                style={[
                  styles.stepperDot,
                  {
                    backgroundColor:
                      isActive || isPast ? colors.primary : "transparent",
                    borderColor:
                      isActive || isPast ? colors.primary : colors.border,
                  },
                ]}
              >
                {isPast ? (
                  <FontAwesome
                    name="check"
                    size={11}
                    color={colors.onPrimary ?? "#FFF"}
                  />
                ) : (
                  <Text
                    style={[
                      styles.stepperDotText,
                      {
                        color: isActive
                          ? (colors.onPrimary ?? "#FFF")
                          : colors.muted,
                      },
                    ]}
                  >
                    {i + 1}
                  </Text>
                )}
              </View>
              {i < STEPS.length - 1 && (
                <View
                  style={[
                    styles.stepperLine,
                    { backgroundColor: colors.border },
                  ]}
                />
              )}
            </View>
          );
        })}
      </View>
      <View
        style={[styles.stepperPill, { backgroundColor: colors.primary + "18" }]}
      >
        <FontAwesome
          name={
            (STEPS[currentStepIndex - 1]?.icon ?? "circle") as
              | "user"
              | "camera"
              | "list"
              | "check"
              | "circle"
          }
          size={12}
          color={colors.primary}
        />
        <Text style={[styles.stepperLabel, { color: colors.primary }]}>
          {STEPS[currentStepIndex - 1]?.label}
        </Text>
      </View>
    </View>
  );

  const renderStepHeading = (
    icon: "user" | "camera" | "list" | "check",
    heading: string,
    subtext?: string,
  ) => (
    <View style={styles.stepHeading}>
      <View
        style={[
          styles.stepIconWrap,
          { backgroundColor: colors.primary + "18" },
        ]}
      >
        <FontAwesome name={icon} size={26} color={colors.primary} />
      </View>
      <View style={styles.stepHeadingText}>
        <Text style={[styles.stepHeadingTitle, { color: colors.text }]}>
          {heading}
        </Text>
        {subtext ? (
          <Text style={[styles.stepHeadingSub, { color: colors.muted }]}>
            {subtext}
          </Text>
        ) : null}
      </View>
    </View>
  );

  const handlePhoneChange = useCallback((text: string) => {
    setFarmerPhone(formatPhoneInput(text));
  }, []);

  // Debounced check: when user types phone or NIC, call backend to see if farmer already exists.
  // Phone: start lookup at 5 digits, then re-fetch at every 2 digits (5, 7, 9, 11).
  const DEBOUNCE_MS = 500;
  const MIN_NIC_LENGTH = 5;
  const MIN_PHONE_DIGITS_TO_SEARCH = 5;
  useEffect(() => {
    if (farmerCheckTimeoutRef.current) {
      clearTimeout(farmerCheckTimeoutRef.current);
      farmerCheckTimeoutRef.current = null;
    }
    const phoneDigits = farmerPhone.replace(/\D/g, "");
    const phoneDigitCount = phoneDigits.length;
    const shouldFetchByPhone =
      phoneDigitCount >= MIN_PHONE_DIGITS_TO_SEARCH &&
      phoneDigitCount <= 11 &&
      phoneDigitCount % 2 === 1; // 5, 7, 9, 11
    const normalized = normalizePhone(farmerPhone);
    const hasValidPhone = normalized != null && isValidPhone(normalized);
    const nicTrimmed = farmerNicNo.trim();
    const hasNic = nicTrimmed.length >= MIN_NIC_LENGTH;

    if (!shouldFetchByPhone && !hasNic) {
      setFarmersMatchingPhone([]);
      setExistingFarmerByNIC(null);
      return;
    }

    farmerCheckTimeoutRef.current = setTimeout(async () => {
      farmerCheckTimeoutRef.current = null;
      setCheckingExistence(true);
      try {
        const all = await farmerApi.getAllFarmers();
        if (shouldFetchByPhone && phoneDigits.length > 0) {
          const matches = all.filter((f) => {
            const fDigits =
              normalizePhone(f.phoneNumber) ??
              f.phoneNumber.replace(/\D/g, "").slice(0, 11);
            return (
              fDigits.length >= phoneDigits.length &&
              fDigits.startsWith(phoneDigits)
            );
          });
          setFarmersMatchingPhone(matches);
        } else {
          setFarmersMatchingPhone([]);
        }
        if (hasNic) {
          const nicLower = nicTrimmed.toLowerCase();
          const match = all.find(
            (f) => f.nicNo?.trim().toLowerCase() === nicLower,
          );
          setExistingFarmerByNIC(match ?? null);
        } else {
          setExistingFarmerByNIC(null);
        }
      } catch {
        setFarmersMatchingPhone([]);
        setExistingFarmerByNIC(null);
      } finally {
        setCheckingExistence(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (farmerCheckTimeoutRef.current) {
        clearTimeout(farmerCheckTimeoutRef.current);
      }
    };
  }, [farmerPhone, farmerNicNo]);

  const handleFarmerNext = useCallback(async () => {
    const hasPhone = farmerPhone.trim().length > 0;
    const hasNic = farmerNicNo.trim().length > 0;
    const hasName = farmerName.trim().length > 0;

    // Skip farmer step: go to upload without linking a farmer
    if (!hasPhone && !hasNic && !hasName) {
      setSelectedFarmerId(null);
      setStep("upload");
      return;
    }

    const normalized = normalizePhone(farmerPhone);
    if (hasPhone && !isValidPhone(normalized)) {
      Alert.alert(
        "Invalid phone",
        "Phone must be 11 digits starting with 0 (e.g. 0300 7087927). Less or more than 10 digits after 0 is invalid.",
      );
      return;
    }

    // To create a new farmer or match existing, phone + name are required
    if (hasPhone && !hasName) {
      Alert.alert("Name required", "Enter farmer name to save farmer details.");
      return;
    }
    if (hasName && !hasPhone) {
      Alert.alert(
        "Phone required",
        "Enter phone (e.g. 0300 7087927) to save farmer details.",
      );
      return;
    }

    setFarmerStepLoading(true);
    setExistingFarmersModal(null);
    try {
      const all = await farmerApi.getAllFarmers();
      const byPhone =
        normalized != null
          ? all.filter((f) => normalizePhone(f.phoneNumber) === normalized)
          : [];
      const byNic = hasNic
        ? all.filter(
            (f) =>
              f.nicNo?.trim().toLowerCase() ===
              farmerNicNo.trim().toLowerCase(),
          )
        : [];
      const combined = [...byPhone, ...byNic];
      const unique = combined.filter(
        (f, i, arr) => arr.findIndex((x) => x.farmerId === f.farmerId) === i,
      );

      if (unique.length > 0) {
        setExistingFarmersModal(unique);
        return;
      }

      // No duplicate and we have phone + name: call backend to create farmer, then pass new farmer ID to next step
      if (hasPhone && hasName && normalized) {
        const created = await farmerApi.createFarmer({
          fullName: farmerName.trim(),
          phoneNumber: normalized,
          nicNo: farmerNicNo.trim() || undefined,
          villageName: farmerVillage.trim() || undefined,
          tehName: farmerTehName.trim() || undefined,
          districtName: farmerDistrict.trim() || undefined,
        });
        setSelectedFarmerId(created.farmerId);
      }
      setStep("upload");
    } catch (err) {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Failed to create farmer",
      );
    } finally {
      setFarmerStepLoading(false);
    }
  }, [
    farmerPhone,
    farmerNicNo,
    farmerName,
    farmerVillage,
    farmerTehName,
    farmerDistrict,
  ]);

  const handlePickExistingFarmer = useCallback((farmer: Farmer) => {
    setSelectedFarmerId(farmer.farmerId);
    setFarmerName(farmer.fullName);
    setFarmerPhone(
      formatPhoneDisplay(
        normalizePhone(farmer.phoneNumber) ?? farmer.phoneNumber,
      ),
    );
    setFarmerNicNo(farmer.nicNo ?? "");
    setFarmerVillage(farmer.villageName ?? "");
    setFarmerTehName(farmer.tehName ?? "");
    setFarmerDistrict(farmer.districtName ?? "");
    setExistingFarmersModal(null);
    setTimeout(() => setStep("upload"), 50);
  }, []);

  // Step 1: Farmer – phone, nic_no, name, address; duplicate = pick existing
  if (step === "farmer") {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <StatusBar style="auto" />
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
        >
          {renderHeader("Create New Animal")}
          {renderStepper()}
          {renderStepHeading(
            "user",
            "Owner/Farmer: New or Existing",
            "Optional. Link to existing or add new.",
          )}
          <Card
            style={StyleSheet.flatten([
              styles.cardElevated,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ])}
          >
            <InputRow
              label="Phone"
              value={farmerPhone}
              onChangeText={handlePhoneChange}
              placeholder="0300 7087927"
              keyboardType="phone-pad"
              colors={colors}
              icon="phone"
            />
            {checkingExistence &&
            farmerPhone.replace(/\D/g, "").length >=
              MIN_PHONE_DIGITS_TO_SEARCH ? (
              <View
                style={[
                  styles.farmerCheckHint,
                  {
                    backgroundColor: colors.border + "25",
                    borderColor: colors.border + "50",
                  },
                ]}
              >
                <ActivityIndicator size="small" color={colors.primary} />
                <Text
                  style={[styles.farmerCheckHintText, { color: colors.muted }]}
                >
                  Looking up farmers…
                </Text>
              </View>
            ) : farmersMatchingPhone.length > 0 ? (
              <View style={styles.farmersMatchListWrap}>
                <Text
                  style={[
                    styles.farmersMatchListLabel,
                    { color: colors.muted },
                  ]}
                >
                  Matching farmers
                </Text>
                {farmersMatchingPhone.map((farmer) => (
                  <TouchableOpacity
                    key={farmer.farmerId}
                    onPress={() => handlePickExistingFarmer(farmer)}
                    activeOpacity={0.7}
                    style={[
                      styles.farmerMatchCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.farmerMatchCardIconWrap,
                        { backgroundColor: colors.primary + "18" },
                      ]}
                    >
                      <FontAwesome
                        name="users"
                        size={18}
                        color={colors.primary}
                      />
                    </View>
                    <Text
                      style={[
                        styles.farmerMatchCardContactLine,
                        { color: colors.text },
                      ]}
                      numberOfLines={1}
                    >
                      {farmer.fullName}
                      {"  ·  "}
                      <Text style={{ color: colors.muted }}>
                        {formatPhoneDisplay(
                          normalizePhone(farmer.phoneNumber) ??
                            farmer.phoneNumber,
                        )}
                      </Text>
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
            <InputRow
              label="NIC No"
              value={farmerNicNo}
              onChangeText={setFarmerNicNo}
              placeholder="42101-1234567-1"
              colors={colors}
              icon="id-card"
            />
            {checkingExistence &&
            farmerNicNo.trim().length >= MIN_NIC_LENGTH ? (
              <View
                style={[
                  styles.farmerCheckHint,
                  {
                    backgroundColor: colors.border + "25",
                    borderColor: colors.border + "50",
                  },
                ]}
              >
                <ActivityIndicator size="small" color={colors.primary} />
                <Text
                  style={[styles.farmerCheckHintText, { color: colors.muted }]}
                >
                  Looking up farmers…
                </Text>
              </View>
            ) : existingFarmerByNIC ? (
              <TouchableOpacity
                onPress={() => handlePickExistingFarmer(existingFarmerByNIC)}
                activeOpacity={0.7}
                style={[
                  styles.farmerMatchCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.farmerMatchCardIconWrap,
                    { backgroundColor: colors.primary + "18" },
                  ]}
                >
                  <FontAwesome
                    name="users"
                    size={18}
                    color={colors.primary}
                  />
                </View>
                <Text
                  style={[
                    styles.farmerMatchCardContactLine,
                    { color: colors.text },
                  ]}
                  numberOfLines={1}
                >
                  {existingFarmerByNIC.fullName}
                  {"  ·  "}
                  <Text style={{ color: colors.muted }}>
                    {formatPhoneDisplay(
                      normalizePhone(existingFarmerByNIC.phoneNumber) ??
                        existingFarmerByNIC.phoneNumber,
                    )}
                  </Text>
                </Text>
              </TouchableOpacity>
            ) : null}
            <InputRow
              label="Name"
              value={farmerName}
              onChangeText={setFarmerName}
              placeholder="Full name"
              colors={colors}
              icon="user"
            />
            <View
              style={[
                styles.addressLabelWrap,
                { borderTopColor: colors.border },
              ]}
            >
              <FontAwesome
                name="map-marker"
                size={14}
                color={colors.primary}
                style={styles.addressLabelIcon}
              />
              <Text style={[styles.addressLabel, { color: colors.muted }]}>
                Address
              </Text>
            </View>
            <InputRow
              label="Village"
              value={farmerVillage}
              onChangeText={setFarmerVillage}
              placeholder="Village name"
              colors={colors}
            />
            <InputRow
              label="Tehsil"
              value={farmerTehName}
              onChangeText={setFarmerTehName}
              placeholder="Tehsil name"
              colors={colors}
            />
            <InputRow
              label="District"
              value={farmerDistrict}
              onChangeText={setFarmerDistrict}
              placeholder="District name"
              colors={colors}
            />
          </Card>
          {farmerStepLoading ? (
            <View style={styles.farmerLoading}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.farmerLoadingText, { color: colors.muted }]}>
                Saving farmer…
              </Text>
            </View>
          ) : (
            <Button
              title="Next"
              onPress={() => setTimeout(handleFarmerNext, 50)}
              variant="primary"
              style={styles.primaryButton}
            />
          )}
        </ScrollView>

        <Modal
          visible={
            existingFarmersModal !== null && existingFarmersModal.length > 0
          }
          transparent
          animationType="fade"
          onRequestClose={() => setExistingFarmersModal(null)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setExistingFarmersModal(null)}
          >
            <View
              style={[styles.modalContent, { backgroundColor: colors.surface }]}
              onStartShouldSetResponder={() => true}
            >
              <View
                style={[
                  styles.modalHeader,
                  { borderBottomColor: colors.border },
                ]}
              >
                <View
                  style={[
                    styles.modalIconWrap,
                    { backgroundColor: colors.primary + "20" },
                  ]}
                >
                  <FontAwesome name="users" size={22} color={colors.primary} />
                </View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Farmer already exists
                </Text>
                <Text style={[styles.modalSubtitle, { color: colors.muted }]}>
                  Pick an existing farmer to link this animal.
                </Text>
              </View>
              <FlatList
                data={existingFarmersModal ?? []}
                keyExtractor={(item) => String(item.farmerId)}
                style={styles.farmerList}
                contentContainerStyle={styles.farmerListContent}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.farmerOption,
                      { borderColor: colors.border },
                    ]}
                    onPress={() => handlePickExistingFarmer(item)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[styles.farmerOptionName, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      {item.fullName}
                    </Text>
                    <Text
                      style={[
                        styles.farmerOptionPhone,
                        { color: colors.muted },
                      ]}
                    >
                      {formatPhoneDisplay(
                        normalizePhone(item.phoneNumber) ?? item.phoneNumber,
                      )}
                    </Text>
                    {item.nicNo ? (
                      <Text
                        style={[
                          styles.farmerOptionNic,
                          { color: colors.muted },
                        ]}
                      >
                        NIC: {item.nicNo}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                )}
              />
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setExistingFarmersModal(null)}
                style={styles.modalCancelButton}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      </SafeAreaView>
    );
  }

  // Step 2: Visual Documentation (Upload 3 images)
  if (step === "upload") {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <StatusBar style="auto" />
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
        >
          {renderHeader("Create New Animal")}
          {renderStepper()}
          {renderStepHeading(
            "camera",
            "Upload reference images",
            "Face, Ear and Body. We'll analyze to suggest details.",
          )}

          {(["face", "ear", "body"] as const).map((type) => (
            <Card
              key={type}
              style={StyleSheet.flatten([
                styles.cardElevated,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ])}
            >
              <View style={styles.imageLabelRow}>
                <FontAwesome
                  name="camera"
                  size={16}
                  color={colors.primary}
                  style={styles.imageLabelIcon}
                />
                <Text style={[styles.imageLabel, { color: colors.text }]}>
                  {type.charAt(0).toUpperCase() + type.slice(1)} Image *
                </Text>
              </View>
              {selectedImages.find((img) => img.type === type) ? (
                <View style={styles.imageContainer}>
                  <Image
                    source={{
                      uri: selectedImages.find((img) => img.type === type)?.uri,
                    }}
                    style={styles.image}
                  />
                  <Button
                    title="Change"
                    onPress={() => pickImage(type)}
                    variant="secondary"
                    style={styles.changeButton}
                    disabled={uploading || analyzing}
                  />
                </View>
              ) : (
                <View style={styles.buttonRow}>
                  <Button
                    title="Choose from Gallery"
                    onPress={() => pickImage(type)}
                    variant="secondary"
                    style={styles.selectButton}
                    disabled={uploading || analyzing}
                  />
                  <Button
                    title="Take Photo"
                    onPress={() => takePhoto(type)}
                    variant="secondary"
                    style={styles.selectButton}
                    disabled={uploading || analyzing}
                  />
                </View>
              )}
            </Card>
          ))}

          {(uploading || analyzing) && (
            <Card style={styles.cardElevated}>
              <View style={styles.progressContainer}>
                <Text style={[styles.progressLabel, { color: colors.text }]}>
                  {uploading
                    ? "Uploading images..."
                    : analyzing
                      ? "Analyzing animal..."
                      : "Processing..."}
                </Text>
                <View
                  style={[
                    styles.progressBarContainer,
                    { backgroundColor: colors.border },
                  ]}
                >
                  <View
                    style={[
                      styles.progressBar,
                      {
                        width: `${uploadProgress}%`,
                        backgroundColor: colors.primary,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.progressText, { color: colors.muted }]}>
                  {Math.round(uploadProgress)}%
                </Text>
              </View>
            </Card>
          )}

          <Button
            title={uploading || analyzing ? "Processing..." : "Next"}
            onPress={handleNextFromUpload}
            variant="primary"
            style={styles.primaryButton}
            disabled={!hasAllThreeImages || uploading || analyzing}
            loading={uploading || analyzing}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Step 3: Animal Attributes (auto-populated, editable)
  if (step === "attributes") {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <StatusBar style="auto" />
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
        >
          {renderHeader("Create New Animal")}
          {renderStepper()}
          {renderStepHeading(
            "list",
            "Animal details",
            "Fill in what you know. Species is required.",
          )}

          <View
            style={[
              styles.attributesBlock,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text
              style={[styles.attributesBlockTitle, { color: colors.primary }]}
            >
              Basic
            </Text>
            <InputRow
              label="Species *"
              value={species}
              onChangeText={setSpecies}
              placeholder="e.g. Cattle, Goat, Horse"
              colors={colors}
            />
            <InputRow
              label="Breed"
              value={breed}
              onChangeText={setBreed}
              placeholder="Optional"
              colors={colors}
            />
            <View style={inputRowStyles.row}>
              <Text style={[inputRowStyles.label, { color: colors.text }]}>
                Status
              </Text>
              <TouchableOpacity
                style={[
                  inputRowStyles.input,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    justifyContent: "center",
                    flexDirection: "row",
                    alignItems: "center",
                  },
                ]}
                onPress={() => setStatusPickerOpen(true)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.pickerButtonText,
                    { color: status ? colors.text : colors.muted },
                  ]}
                >
                  {status || "Select status"}
                </Text>
                <FontAwesome
                  name="chevron-down"
                  size={14}
                  color={colors.muted}
                  style={styles.pickerChevron}
                />
              </TouchableOpacity>
            </View>
            <Modal visible={statusPickerOpen} transparent animationType="fade">
              <TouchableOpacity
                style={styles.statusModalOverlay}
                activeOpacity={1}
                onPress={() => setStatusPickerOpen(false)}
              >
                <View
                  style={[
                    styles.statusModalContent,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[styles.statusModalTitle, { color: colors.text }]}
                  >
                    Status
                  </Text>
                  {(
                    [
                      "MILKING",
                      "DRY",
                      "PREGNANT",
                      "LACTATING",
                      "IN_HEAT",
                      "OTHER",
                    ] as const
                  ).map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[
                        styles.statusModalOption,
                        { borderBottomColor: colors.border },
                      ]}
                      onPress={() => {
                        setStatus(s);
                        setStatusPickerOpen(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.statusModalOptionText,
                          { color: colors.text },
                        ]}
                      >
                        {s.replace("_", " ")}
                      </Text>
                      {status === s && (
                        <FontAwesome
                          name="check"
                          size={14}
                          color={colors.primary}
                        />
                      )}
                    </TouchableOpacity>
                  ))}
                  <Button
                    title="Cancel"
                    onPress={() => setStatusPickerOpen(false)}
                    variant="secondary"
                    style={styles.statusModalCancel}
                  />
                </View>
              </TouchableOpacity>
            </Modal>
            {status === "OTHER" && (
              <InputRow
                label="Other (specify)"
                value={otherStatusValue}
                onChangeText={setOtherStatusValue}
                placeholder="Specify status"
                colors={colors}
              />
            )}
          </View>

          <View
            style={[
              styles.attributesBlock,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text
              style={[styles.attributesBlockTitle, { color: colors.primary }]}
            >
              Measurements
            </Text>
            <Text style={[styles.attributesBlockHint, { color: colors.muted }]}>
              Enter girth & length to see estimated weight (Cattle, Goat/Sheep,
              Horse).
            </Text>
            <InputRow
              label="Heart girth (cm)"
              value={heartGirthCm}
              onChangeText={setHeartGirthCm}
              placeholder="e.g. 177"
              keyboardType="decimal-pad"
              colors={colors}
            />
            <InputRow
              label="Body length (cm)"
              value={bodyLengthCm}
              onChangeText={setBodyLengthCm}
              placeholder="e.g. 198"
              keyboardType="decimal-pad"
              colors={colors}
            />
            <InputRow
              label="Weight (kg)"
              value={weightKg}
              onChangeText={setWeightKg}
              placeholder="Auto or enter"
              keyboardType="decimal-pad"
              colors={colors}
            />
          </View>

          <View
            style={[
              styles.attributesBlock,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text
              style={[styles.attributesBlockTitle, { color: colors.primary }]}
            >
              Other details
            </Text>
            <InputRow
              label="Age (months)"
              value={ageMonths}
              onChangeText={setAgeMonths}
              placeholder="e.g. 24"
              keyboardType="number-pad"
              colors={colors}
            />
            <InputRow
              label="Color"
              value={color}
              onChangeText={setColor}
              placeholder="e.g. brown, white"
              colors={colors}
            />
            <InputRow
              label="Sex"
              value={sex}
              onChangeText={setSex}
              placeholder="male, female, unknown"
              colors={colors}
            />
            <InputRow
              label="Tag ID"
              value={tagId}
              onChangeText={setTagId}
              placeholder="Optional"
              colors={colors}
            />
            <View style={inputRowStyles.row}>
              <Text style={[inputRowStyles.label, { color: colors.text }]}>
                Tagline
              </Text>
              <TextInput
                style={[
                  inputRowStyles.input,
                  inputRowStyles.inputMultiline,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                value={animalTagline}
                onChangeText={setAnimalTagline}
                placeholder="Short phrase"
                placeholderTextColor={colors.muted}
                multiline
                numberOfLines={2}
              />
            </View>
            <View style={[inputRowStyles.row, { alignItems: "flex-start" }]}>
              <Text style={[inputRowStyles.label, { color: colors.text }]}>
                Short summary
              </Text>
              <TextInput
                style={[
                  inputRowStyles.input,
                  inputRowStyles.inputMultiline,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                value={aiShortSummary}
                onChangeText={setAiShortSummary}
                placeholder="1–2 sentence summary"
                placeholderTextColor={colors.muted}
                multiline
                numberOfLines={2}
              />
            </View>
            <View style={[inputRowStyles.row, { alignItems: "flex-start" }]}>
              <Text style={[inputRowStyles.label, { color: colors.text }]}>
                AI Summary
              </Text>
              <TextInput
                style={[
                  inputRowStyles.input,
                  { minHeight: 80, textAlignVertical: "top" },
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                value={aiSummary}
                onChangeText={setAiSummary}
                placeholder="Auto-generated summary"
                placeholderTextColor={colors.muted}
                multiline
                numberOfLines={4}
              />
            </View>
          </View>
          <Button
            title={
              createAnimalMutation.isPending
                ? "Creating..."
                : enrolling
                  ? "Enrolling..."
                  : "Save & continue"
            }
            onPress={() => setTimeout(handleNextFromAttributes, 50)}
            variant="primary"
            style={styles.primaryButton}
            disabled={
              !species.trim() || createAnimalMutation.isPending || enrolling
            }
            loading={createAnimalMutation.isPending || enrolling}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  content: { padding: 20 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  headerTitleWrap: { flexDirection: "row", alignItems: "center", flex: 1 },
  headerTitleIcon: { marginRight: 10 },
  title: { fontSize: 22, fontWeight: "700", letterSpacing: 0.3 },
  subtitle: { fontSize: 14, marginBottom: 24, lineHeight: 20 },
  stepper: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1,
  },
  stepperTop: { marginBottom: 14 },
  stepperTitle: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  stepperProgressBg: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  stepperProgressFill: {
    height: "100%",
    borderRadius: 3,
  },
  stepperDots: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stepperDotWrap: {
    flexDirection: "row",
    alignItems: "center",
  },
  stepperDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperDotText: { fontSize: 13, fontWeight: "700" },
  stepperLine: {
    width: 24,
    height: 2,
    marginHorizontal: 4,
  },
  stepperPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginTop: 14,
    gap: 8,
  },
  stepperLabel: {
    fontSize: 14,
    fontWeight: "700",
  },
  stepHeading: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    gap: 14,
  },
  stepIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  stepHeadingText: { flex: 1 },
  stepHeadingTitle: { fontSize: 22, fontWeight: "800", letterSpacing: 0.2 },
  stepHeadingSub: { fontSize: 15, marginTop: 6, lineHeight: 22 },
  card: { marginBottom: 16 },
  cardElevated: {
    marginBottom: 24,
    borderRadius: 16,
    padding: 22,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryCard: { overflow: "hidden" },
  summarySectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 0,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  summaryIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryBody: { paddingTop: 16 },
  attributesBlock: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
  },
  attributesBlockTitle: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 14,
  },
  attributesBlockHint: {
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 18,
  },
  attributesSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700", flex: 1 },
  sectionTitleInline: { fontSize: 18, fontWeight: "700" },
  imageLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  imageLabelIcon: { marginRight: 10 },
  imageLabel: { fontSize: 16, fontWeight: "600" },
  buttonRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  selectButton: { flex: 1 },
  imageContainer: { marginTop: 8 },
  image: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    marginBottom: 12,
    resizeMode: "cover",
  },
  changeButton: { marginTop: 8 },
  progressContainer: { marginTop: 8 },
  progressLabel: { fontSize: 14, fontWeight: "500", marginBottom: 8 },
  progressBarContainer: {
    width: "100%",
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 4,
  },
  progressBar: { height: "100%", borderRadius: 4 },
  progressText: { fontSize: 12, textAlign: "right" },
  primaryButton: { marginTop: 24, minHeight: 52 },
  pickerButtonText: { fontSize: 15, flex: 1 },
  pickerChevron: { marginLeft: 8 },
  statusModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 24,
  },
  statusModalContent: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    maxHeight: "80%",
  },
  statusModalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 16 },
  statusModalOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  statusModalOptionText: { fontSize: 16 },
  statusModalCancel: { marginTop: 16 },
  summaryRow: { fontSize: 15, marginBottom: 8 },
  summaryBlock: { marginTop: 8, lineHeight: 22 },
  farmerLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
  },
  farmerLoadingText: { fontSize: 14 },
  farmerCheckHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 6,
    marginBottom: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  farmerCheckHintText: {
    fontSize: 14,
    letterSpacing: 0.2,
  },
  farmersMatchListWrap: {
    marginTop: 6,
    marginBottom: 16,
    gap: 10,
  },
  farmersMatchListLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.6,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  farmerMatchCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 24,
    borderWidth: 1,
  },
  farmerMatchCardIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  farmerMatchCardContactLine: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    minWidth: 0,
  },
  farmerMatchCardContent: {
    flex: 1,
    minWidth: 0,
  },
  farmerMatchCardName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  farmerMatchCardMeta: {
    fontSize: 13,
  },
  farmerMatchCardChevron: {
    marginLeft: 8,
  },
  existingFarmerHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  existingFarmerRow: {
    marginTop: 4,
    marginBottom: 14,
    gap: 10,
  },
  existingFarmerCard: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderLeftWidth: 4,
  },
  existingFarmerCardRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  existingFarmerCardIcon: { marginRight: 10 },
  existingFarmerCardTextWrap: { flex: 1 },
  existingFarmerText: { fontSize: 13 },
  existingFarmerName: { fontSize: 15, fontWeight: "700", marginTop: 2 },
  useFarmerButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  useFarmerButtonText: { fontSize: 14, color: "#fff", fontWeight: "700" },
  addressLabelWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 10,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  addressLabelIcon: { marginRight: 8 },
  addressLabel: {
    fontSize: 14,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 24,
  },
  modalContent: {
    borderRadius: 20,
    padding: 0,
    maxHeight: "75%",
    overflow: "hidden",
  },
  modalHeader: {
    padding: 22,
    paddingBottom: 18,
    borderBottomWidth: 1,
    alignItems: "center",
  },
  modalIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  modalTitle: { fontSize: 20, fontWeight: "700", marginBottom: 6 },
  modalSubtitle: { fontSize: 14, textAlign: "center", paddingHorizontal: 8 },
  farmerOption: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  farmerOptionName: { fontSize: 16, fontWeight: "600" },
  farmerOptionPhone: { fontSize: 14, marginTop: 4 },
  farmerOptionNic: { fontSize: 12, marginTop: 2 },
  farmerList: { maxHeight: 300 },
  farmerListContent: { paddingVertical: 16, paddingHorizontal: 4 },
  modalCancelButton: { marginHorizontal: 20, marginTop: 8, marginBottom: 22 },
});
