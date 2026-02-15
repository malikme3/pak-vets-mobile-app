import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  TouchableOpacity,
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
import { animalApi } from "../services/vetApi";
import {
  getUploadSignedUrl,
  getBucketName,
  analyzeAnimalImage,
} from "../services/sharedServicesApi";
import type { CreateAnimalRequest } from "../types/api";
import type { AnimalInfoFromImage } from "../services/sharedServicesApi";
import FontAwesome from "@expo/vector-icons/FontAwesome";

type Step = "owner" | "upload" | "attributes" | "summary";
type ImageType = "face" | "ear" | "body";

interface SelectedImage {
  uri: string;
  type: ImageType;
}

export default function CreateAnimalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors } = useTheme();
  const returnTo = (params.returnTo as string) || "/create-case";

  const [step, setStep] = useState<Step>("owner");

  // Step 1: Owner
  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");

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
  const [color, setColor] = useState("");
  const [sex, setSex] = useState("");
  const [tagId, setTagId] = useState("");
  const [aiSummary, setAiSummary] = useState("");

  const createAnimalMutation = useCreateAnimal();

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

  const handleConfirm = async () => {
    if (!species.trim()) {
      Alert.alert("Error", "Species is required");
      return;
    }
    if (!uploadedUrls) {
      Alert.alert("Error", "Image URLs are missing. Please go back to upload step.");
      return;
    }

    const request: CreateAnimalRequest = {
      ownerName: ownerName.trim() || undefined,
      ownerPhone: ownerPhone.trim() || undefined,
      species: species.trim(),
      breed: breed.trim() || undefined,
      tagId: tagId.trim() || undefined,
      sex: sex.trim() || undefined,
      color: color.trim() || undefined,
      ageMonths: ageMonths.trim() ? parseInt(ageMonths, 10) : undefined,
      weightKg: weightKg.trim() ? parseFloat(weightKg) : undefined,
      aiSummary: aiSummary.trim() || undefined,
    };

    try {
      const created = await createAnimalMutation.mutateAsync(request);
      await animalApi.enrollAnimalImages(created.animalId, {
        faceImageUrl: uploadedUrls.faceImageUrl,
        earImageUrl: uploadedUrls.earImageUrl,
        bodyImageUrl: uploadedUrls.bodyImageUrl,
        source: "Mobile App",
      });
      Alert.alert("Success", "Animal created and images enrolled.", [
        {
          text: "OK",
          onPress: () => {
            if (!returnTo || typeof returnTo !== "string") {
              router.back();
              return;
            }
            router.push({
              pathname: returnTo as `/${string}`,
              params: { animalId: String(created.animalId) },
            });
          },
        },
      ]);
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Failed to create animal",
      );
    }
  };

  const goBack = () => {
    if (step === "owner") router.back();
    else if (step === "upload") setStep("owner");
    else if (step === "attributes") setStep("upload");
    else setStep("attributes");
  };

  const hasAllThreeImages =
    selectedImages.some((i) => i.type === "face") &&
    selectedImages.some((i) => i.type === "ear") &&
    selectedImages.some((i) => i.type === "body");

  const renderHeader = (title: string) => (
    <View style={styles.header}>
      <TouchableOpacity onPress={goBack} style={styles.backButton}>
        <FontAwesome name="arrow-left" size={20} color={colors.primary} />
      </TouchableOpacity>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
    </View>
  );

  // Step 1: Owner Information
  if (step === "owner") {
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
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Step 1 of 4: Owner information
          </Text>
          <Card style={styles.card}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Owner Information
            </Text>
            <AppInput
              label="Owner Name"
              value={ownerName}
              onChangeText={setOwnerName}
              placeholder="Enter owner name (optional)"
            />
            <AppInput
              label="Phone Number"
              value={ownerPhone}
              onChangeText={setOwnerPhone}
              placeholder="Enter phone (optional)"
              keyboardType="phone-pad"
            />
          </Card>
          <Button
            title="Next"
            onPress={() => setStep("upload")}
            variant="primary"
            style={styles.primaryButton}
          />
        </ScrollView>
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
          {renderHeader("Upload Reference Images")}
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Step 2 of 4: Upload three images (Face, Ear, Body). We'll analyze
            them to suggest animal details.
          </Text>

          {(["face", "ear", "body"] as const).map((type) => (
            <Card key={type} style={styles.card}>
              <Text style={[styles.imageLabel, { color: colors.text }]}>
                {type.charAt(0).toUpperCase() + type.slice(1)} Image *
              </Text>
              {selectedImages.find((img) => img.type === type) ? (
                <View style={styles.imageContainer}>
                  <Image
                    source={{
                      uri: selectedImages.find((img) => img.type === type)
                        ?.uri,
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
            <Card style={styles.card}>
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
            title={
              uploading || analyzing
                ? "Processing..."
                : "Next"
            }
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
          {renderHeader("Animal Attributes")}
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Step 3 of 4: Review or edit the detected details. You can change
            any field.
          </Text>
          <Card style={styles.card}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Animal Information
            </Text>
            <AppInput
              label="Species *"
              value={species}
              onChangeText={setSpecies}
              placeholder="e.g., Cattle, Goat, Buffalo"
            />
            <AppInput
              label="Breed"
              value={breed}
              onChangeText={setBreed}
              placeholder="Enter breed (optional)"
            />
            <AppInput
              label="Age (months)"
              value={ageMonths}
              onChangeText={setAgeMonths}
              placeholder="e.g. 24"
              keyboardType="number-pad"
            />
            <AppInput
              label="Weight (kg)"
              value={weightKg}
              onChangeText={setWeightKg}
              placeholder="e.g. 150"
              keyboardType="decimal-pad"
            />
            <AppInput
              label="Color"
              value={color}
              onChangeText={setColor}
              placeholder="e.g. brown, white"
            />
            <AppInput
              label="Sex"
              value={sex}
              onChangeText={setSex}
              placeholder="male, female, unknown"
            />
            <AppInput
              label="Tag ID"
              value={tagId}
              onChangeText={setTagId}
              placeholder="Optional"
            />
            <AppInput
              label="AI Summary"
              value={aiSummary}
              onChangeText={setAiSummary}
              placeholder="Professional veterinary summary (auto-generated from images)"
              multiline
              numberOfLines={4}
            />
          </Card>
          <Button
            title="Next"
            onPress={() => setStep("summary")}
            variant="primary"
            style={styles.primaryButton}
            disabled={!species.trim()}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Step 4: Summary & Finalization
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <StatusBar style="auto" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        {renderHeader("Review & Confirm")}
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          Step 4 of 4: Verify and save the new animal.
        </Text>

        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Owner
          </Text>
          <Text style={[styles.summaryRow, { color: colors.text }]}>
            Name: {ownerName || "—"}
          </Text>
          <Text style={[styles.summaryRow, { color: colors.text }]}>
            Phone: {ownerPhone || "—"}
          </Text>
        </Card>

        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Animal
          </Text>
          <Text style={[styles.summaryRow, { color: colors.text }]}>
            Species: {species || "—"}
          </Text>
          <Text style={[styles.summaryRow, { color: colors.text }]}>
            Breed: {breed || "—"}
          </Text>
          <Text style={[styles.summaryRow, { color: colors.text }]}>
            Age (months): {ageMonths || "—"}
          </Text>
          <Text style={[styles.summaryRow, { color: colors.text }]}>
            Weight (kg): {weightKg || "—"}
          </Text>
          <Text style={[styles.summaryRow, { color: colors.text }]}>
            Color: {color || "—"}
          </Text>
          <Text style={[styles.summaryRow, { color: colors.text }]}>
            Sex: {sex || "—"}
          </Text>
          <Text style={[styles.summaryRow, { color: colors.text }]}>
            Tag ID: {tagId || "—"}
          </Text>
          {aiSummary ? (
            <Text style={[styles.summaryRow, styles.summaryBlock, { color: colors.text }]}>
              AI Summary: {aiSummary}
            </Text>
          ) : null}
        </Card>

        <Button
          title={createAnimalMutation.isPending ? "Saving..." : "Confirm"}
          onPress={handleConfirm}
          variant="primary"
          style={styles.primaryButton}
          disabled={createAnimalMutation.isPending}
          loading={createAnimalMutation.isPending}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  content: { padding: 16 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  backButton: { padding: 8, marginRight: 12 },
  title: { fontSize: 24, fontWeight: "600", marginBottom: 8, flex: 1 },
  subtitle: { fontSize: 14, marginBottom: 24, lineHeight: 20 },
  card: { marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: "600", marginBottom: 16 },
  imageLabel: { fontSize: 16, fontWeight: "500", marginBottom: 12 },
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
  primaryButton: { marginTop: 8 },
  summaryRow: { fontSize: 15, marginBottom: 8 },
  summaryBlock: { marginTop: 8, lineHeight: 22 },
});
