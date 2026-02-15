import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { useTheme } from "../theme/useTheme";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { useCreateMediaFile } from "../features/media/hooks";
import { mediaFileApi } from "../services/vetApi";
import type { ApiError } from "../services/apiClient";

export default function AddMediaScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors } = useTheme();

  const caseId = params.caseId ? Number(params.caseId) : undefined;
  const createMediaMutation = useCreateMediaFile();

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageName, setSelectedImageName] = useState<string | null>(
    null,
  );
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

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

  const pickImage = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
      setSelectedImageName(
        result.assets[0].fileName || `photo_${Date.now()}.jpg`,
      );
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Sorry, we need camera permissions to take photos!",
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
      setSelectedImageName(`photo_${Date.now()}.jpg`);
    }
  };

  const uploadToS3 = async (
    presignedUrl: string,
    fileUri: string,
  ): Promise<void> => {
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (!fileInfo.exists) {
      throw new Error("File does not exist");
    }

    // Read file as base64
    const fileBase64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Convert base64 to binary string for upload
    // React Native fetch can handle base64 directly, but we need to convert it properly
    const binaryString = atob(fileBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Upload to S3 using presigned URL with binary data
    const response = await fetch(presignedUrl, {
      method: "PUT",
      body: bytes,
      headers: {
        "Content-Type": "image/jpeg",
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`S3 upload failed: ${errorText || response.statusText}`);
    }
  };

  const handleUpload = async () => {
    if (!caseId) {
      Alert.alert("Error", "Case ID is missing");
      return;
    }

    if (!selectedImage || !selectedImageName) {
      Alert.alert("Error", "Please select a photo first");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Step 1: Get presigned URL from backend
      setUploadProgress(10);
      let s3Key: string | undefined;
      let url: string | undefined;

      try {
        const presignedResponse = await mediaFileApi.getPresignedUrl(
          caseId,
          "IMAGE",
          selectedImageName,
        );

        // Step 2: Upload file to S3
        setUploadProgress(30);
        await uploadToS3(presignedResponse.presignedUrl, selectedImage);
        setUploadProgress(70);

        s3Key = presignedResponse.s3Key;
        url = presignedResponse.url;
      } catch (presignedError: unknown) {
        // If presigned URL endpoint doesn't exist (404), create media file with local URI as fallback
        // This allows testing the UI flow while backend is being implemented
        console.warn(
          "Presigned URL endpoint not available, using fallback:",
          presignedError,
        );

        // Check if it's a 404 error (endpoint doesn't exist)
        const apiError = presignedError as ApiError;
        const is404 =
          apiError &&
          typeof apiError === "object" &&
          "status" in apiError &&
          apiError.status === 404;
        const is404Message =
          presignedError instanceof Error &&
          (presignedError.message.includes("404") ||
            presignedError.message.includes(
              "Request failed with status code 404",
            ));

        if (is404 || is404Message) {
          // Generate a temporary s3Key for testing
          s3Key = `cases/${caseId}/images/${Date.now()}_${selectedImageName}`;
          url = selectedImage; // Use local URI temporarily
          setUploadProgress(50); // Skip S3 upload step
        } else {
          // Re-throw if it's not a 404 error
          throw presignedError;
        }
      }

      // Step 3: Create media file record with s3Key
      setUploadProgress(80);
      await createMediaMutation.mutateAsync({
        caseId,
        fileType: "IMAGE",
        s3Key,
        url,
      });
      setUploadProgress(100);

      // Navigate back to case detail
      router.replace(`/case-detail?caseId=${caseId}`);
    } catch (error) {
      console.error("Upload error:", error);
      Alert.alert(
        "Upload Failed",
        error instanceof Error
          ? error.message
          : "Failed to upload media. Please try again.",
      );
      setUploading(false);
      setUploadProgress(0);
    }
  };

  if (!caseId) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <StatusBar style="auto" />
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.text }]}>
            Invalid case ID
          </Text>
          <Button
            title="Go Back"
            onPress={() => router.back()}
            variant="primary"
            style={styles.backButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <StatusBar style="auto" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        <Text style={[styles.title, { color: colors.text }]}>Add Media</Text>

        {/* Image Selection */}
        <Card style={styles.card}>
          <Text style={[styles.label, { color: colors.text }]}>
            Select Photo
          </Text>
          <View style={styles.buttonRow}>
            <Button
              title="Choose from Gallery"
              onPress={pickImage}
              variant="secondary"
              style={styles.selectButton}
              disabled={uploading || createMediaMutation.isPending}
            />
            <Button
              title="Take Photo"
              onPress={takePhoto}
              variant="secondary"
              style={styles.selectButton}
              disabled={uploading || createMediaMutation.isPending}
            />
          </View>

          {selectedImage && (
            <View style={styles.imageContainer}>
              <Image source={{ uri: selectedImage }} style={styles.image} />
              {uploadProgress > 0 && uploadProgress < 100 && (
                <View
                  style={[
                    styles.progressContainer,
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
                  <Text style={[styles.progressText, { color: colors.text }]}>
                    {Math.round(uploadProgress)}%
                  </Text>
                </View>
              )}
              <Button
                title="Remove"
                onPress={() => {
                  setSelectedImage(null);
                  setSelectedImageName(null);
                  setUploadProgress(0);
                }}
                variant="secondary"
                style={styles.removeButton}
                disabled={uploading || createMediaMutation.isPending}
              />
            </View>
          )}
        </Card>

        {/* Upload Button */}
        {selectedImage && (
          <Button
            title={
              uploading || createMediaMutation.isPending
                ? "Uploading..."
                : "Upload Photo"
            }
            onPress={handleUpload}
            variant="primary"
            disabled={uploading || createMediaMutation.isPending}
            loading={uploading || createMediaMutation.isPending}
            style={styles.uploadButton}
          />
        )}
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
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  errorText: {
    fontSize: 18,
    marginBottom: 16,
  },
  backButton: {
    marginTop: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 24,
  },
  card: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  selectButton: {
    flex: 1,
  },
  imageContainer: {
    marginTop: 16,
    alignItems: "center",
  },
  image: {
    width: "100%",
    height: 300,
    borderRadius: 8,
    marginBottom: 12,
    resizeMode: "cover",
  },
  removeButton: {
    marginTop: 8,
  },
  uploadButton: {
    marginTop: 8,
  },
  progressContainer: {
    width: "100%",
    height: 8,
    borderRadius: 4,
    marginTop: 12,
    marginBottom: 8,
    overflow: "hidden",
    position: "relative",
  },
  progressBar: {
    height: "100%",
    borderRadius: 4,
  },
  progressText: {
    position: "absolute",
    top: -20,
    right: 0,
    fontSize: 12,
    fontWeight: "600",
  },
});
