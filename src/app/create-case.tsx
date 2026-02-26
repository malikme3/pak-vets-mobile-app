import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { File } from "expo-file-system";
import { useTheme } from "../theme/useTheme";
import { useCurrentDoctor } from "../features/doctors/hooks";
import { useCreateCase } from "../features/cases/hooks";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import {
  getBucketName,
  getUploadSignedUrl,
} from "../services/sharedServicesApi";

type DiseaseEvidenceType = "LAB_REPORT" | "VACINATION" | "X_RAY";

interface SelectedDiseaseEvidence {
  uri: string;
  name: string;
  mimeType?: string;
  imageType: DiseaseEvidenceType;
}

interface SelectedClinicalSignsFile {
  uri: string;
  name: string;
  mimeType?: string;
}

function sanitizeFileName(fileName: string) {
  return fileName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "");
}

function inferContentType(fileName: string, fallback?: string) {
  if (fallback?.trim()) return fallback;
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".heic") || lower.endsWith(".heif")) return "image/heic";
  return "image/jpeg";
}

export default function CreateCaseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors } = useTheme();
  const { data: doctor, isLoading: doctorLoading } = useCurrentDoctor();
  const createCaseMutation = useCreateCase();
  const didNavigateRef = useRef(false);
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [selectedDiseaseEvidenceType, setSelectedDiseaseEvidenceType] =
    useState<DiseaseEvidenceType>("LAB_REPORT");
  const [diseaseEvidenceFiles, setDiseaseEvidenceFiles] = useState<
    SelectedDiseaseEvidence[]
  >([]);
  const [clinicalSignsFiles, setClinicalSignsFiles] = useState<
    SelectedClinicalSignsFile[]
  >([]);
  const [submitting, setSubmitting] = useState(false);

  const rawAnimalId = params.animalId ?? params.AnimalId;
  const animalId =
    rawAnimalId != null && String(rawAnimalId).trim() !== ""
      ? Number(rawAnimalId)
      : undefined;

  useEffect(() => {
    if (didNavigateRef.current) return;
    if (doctorLoading) return;

    if (!doctor) {
      didNavigateRef.current = true;
      router.replace("/select-animal?createCaseAfterSelect=1");
      return;
    }

    if (!animalId || animalId <= 0 || !Number.isFinite(animalId)) {
      didNavigateRef.current = true;
      router.replace("/select-animal?createCaseAfterSelect=1");
    }
  }, [animalId, doctor, doctorLoading, router]);

  const complaintTrimmed = useMemo(() => chiefComplaint.trim(), [chiefComplaint]);
  const canContinue =
    Boolean(doctor?.doctorId) &&
    Boolean(animalId && animalId > 0 && Number.isFinite(animalId)) &&
    complaintTrimmed.length > 0 &&
    !createCaseMutation.isPending &&
    !submitting;

  const uploadFileToS3 = useCallback(
    async (fileUri: string, s3Key: string, contentType: string, tagValue?: string) => {
      const tags = tagValue ? `type=${tagValue}` : undefined;
      const bucketName = getBucketName();
      const { signedUrl } = await getUploadSignedUrl(bucketName, s3Key, tags);
      const fileInfo = await new File(fileUri).info();
      if (!fileInfo.exists) throw new Error("File does not exist");
      const fileBase64 = await FileSystem.readAsStringAsync(fileUri, {
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
        headers: { "Content-Type": contentType },
      });
      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        throw new Error(`S3 upload failed: ${errorText || response.statusText}`);
      }
    },
    [],
  );

  const requestGalleryPermissions = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "We need gallery access.");
      return false;
    }
    return true;
  }, []);

  const requestCameraPermissions = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "We need camera access.");
      return false;
    }
    return true;
  }, []);

  const addDiseaseEvidenceFromGallery = useCallback(async () => {
    const ok = await requestGalleryPermissions();
    if (!ok) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const name =
      asset.fileName ?? `gallery-${Date.now()}.${asset.uri.split(".").pop() ?? "jpg"}`;
    setDiseaseEvidenceFiles((prev) => [
      ...prev,
      {
        uri: asset.uri,
        name: sanitizeFileName(name),
        mimeType: asset.mimeType ?? "image/jpeg",
        imageType: selectedDiseaseEvidenceType,
      },
    ]);
  }, [requestGalleryPermissions, selectedDiseaseEvidenceType]);

  const addDiseaseEvidenceFromCamera = useCallback(async () => {
    const ok = await requestCameraPermissions();
    if (!ok) return;
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const name =
      asset.fileName ?? `camera-${Date.now()}.${asset.uri.split(".").pop() ?? "jpg"}`;
    setDiseaseEvidenceFiles((prev) => [
      ...prev,
      {
        uri: asset.uri,
        name: sanitizeFileName(name),
        mimeType: asset.mimeType ?? "image/jpeg",
        imageType: selectedDiseaseEvidenceType,
      },
    ]);
  }, [requestCameraPermissions, selectedDiseaseEvidenceType]);

  const addDiseaseEvidenceFile = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["image/*", "application/pdf"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setDiseaseEvidenceFiles((prev) => [
      ...prev,
      {
        uri: asset.uri,
        name: sanitizeFileName(asset.name || `file-${Date.now()}`),
        mimeType: asset.mimeType ?? undefined,
        imageType: selectedDiseaseEvidenceType,
      },
    ]);
  }, [selectedDiseaseEvidenceType]);

  const addClinicalFromGallery = useCallback(async () => {
    const ok = await requestGalleryPermissions();
    if (!ok) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const name =
      asset.fileName ?? `gallery-${Date.now()}.${asset.uri.split(".").pop() ?? "jpg"}`;
    setClinicalSignsFiles((prev) => [
      ...prev,
      {
        uri: asset.uri,
        name: sanitizeFileName(name),
        mimeType: asset.mimeType ?? "image/jpeg",
      },
    ]);
  }, [requestGalleryPermissions]);

  const addClinicalFromCamera = useCallback(async () => {
    const ok = await requestCameraPermissions();
    if (!ok) return;
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const name =
      asset.fileName ?? `camera-${Date.now()}.${asset.uri.split(".").pop() ?? "jpg"}`;
    setClinicalSignsFiles((prev) => [
      ...prev,
      {
        uri: asset.uri,
        name: sanitizeFileName(name),
        mimeType: asset.mimeType ?? "image/jpeg",
      },
    ]);
  }, [requestCameraPermissions]);

  const addClinicalFile = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["image/*"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setClinicalSignsFiles((prev) => [
      ...prev,
      {
        uri: asset.uri,
        name: sanitizeFileName(asset.name || `file-${Date.now()}`),
        mimeType: asset.mimeType ?? undefined,
      },
    ]);
  }, []);

  const handleNext = async () => {
    if (!doctor || !animalId || !complaintTrimmed) return;
    setSubmitting(true);
    try {
      const caseData = await createCaseMutation.mutateAsync({
        animalId,
        doctorId: doctor.doctorId,
        caseDatetime: new Date().toISOString(),
        chiefComplaint: complaintTrimmed,
        status: "IN_PROGRESS",
      });

      for (const evidence of diseaseEvidenceFiles) {
        const s3Key = `animal-disease-files/doctorId-${doctor.doctorId}_animalId-${animalId}_caseId-${caseData.caseId}_${evidence.imageType.toLowerCase()}_${Date.now()}_${sanitizeFileName(evidence.name)}`;
        await uploadFileToS3(
          evidence.uri,
          s3Key,
          inferContentType(evidence.name, evidence.mimeType),
          "animal-disease-evidence",
        );
      }

      for (const file of clinicalSignsFiles) {
        const s3Key = `animal-disease-files/doctorId-${doctor.doctorId}_animalId-${animalId}_caseId-${caseData.caseId}_clinical_signs_${Date.now()}_${sanitizeFileName(file.name)}`;
        await uploadFileToS3(
          file.uri,
          s3Key,
          inferContentType(file.name, file.mimeType),
          "clinical-signs",
        );
      }

      router.replace(`/case-detail?caseId=${caseData.caseId}&fromCreate=1`);
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Failed to create case",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (doctorLoading || !doctor || !animalId || !Number.isFinite(animalId)) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar style="auto" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>Disease Intake</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          Main complaint is required before proceeding to case details.
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              color: colors.text,
              borderColor: colors.border,
              backgroundColor: colors.surface,
            },
          ]}
          value={chiefComplaint}
          onChangeText={setChiefComplaint}
          placeholder="Enter main complaint"
          placeholderTextColor={colors.muted}
          multiline
        />

        <Card style={styles.sectionCard}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Lab Report / Disease Evidence</Text>
          <View style={styles.radioRow}>
            {(
              [
                ["LAB_REPORT", "Lab Report"],
                ["X_RAY", "X-ray"],
                ["VACINATION", "Vacination"],
              ] as const
            ).map(([value, label]) => {
              const selected = selectedDiseaseEvidenceType === value;
              return (
                <TouchableOpacity
                  key={value}
                  onPress={() => setSelectedDiseaseEvidenceType(value)}
                  style={[
                    styles.radioChip,
                    {
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? `${colors.primary}20` : colors.surface,
                    },
                  ]}
                >
                  <Text style={[styles.radioText, { color: colors.text }]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.buttonRow}>
            <Button title="Choose Image" onPress={addDiseaseEvidenceFromGallery} variant="secondary" style={styles.selectButton} />
            <Button title="Take Photo" onPress={addDiseaseEvidenceFromCamera} variant="secondary" style={styles.selectButton} />
          </View>
          <Button title="Pick File" onPress={addDiseaseEvidenceFile} variant="secondary" style={styles.sectionAction} />
          {diseaseEvidenceFiles.map((file, idx) => (
            <Text key={`${file.uri}-${idx}`} style={[styles.fileItem, { color: colors.muted }]} numberOfLines={1}>
              {file.imageType}: {file.name}
            </Text>
          ))}
        </Card>

        <Card style={styles.sectionCard}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Clinical Signs</Text>
          <View style={styles.buttonRow}>
            <Button title="Choose Image" onPress={addClinicalFromGallery} variant="secondary" style={styles.selectButton} />
            <Button title="Take Photo" onPress={addClinicalFromCamera} variant="secondary" style={styles.selectButton} />
          </View>
          <Button title="Pick File" onPress={addClinicalFile} variant="secondary" style={styles.sectionAction} />
          {clinicalSignsFiles.map((file, idx) => (
            <Text key={`${file.uri}-${idx}`} style={[styles.fileItem, { color: colors.muted }]} numberOfLines={1}>
              Clinical: {file.name}
            </Text>
          ))}
        </Card>

        <Button
          title={
            createCaseMutation.isPending || submitting
              ? "Creating..."
              : "Next: Case details"
          }
          onPress={handleNext}
          variant="primary"
          disabled={!canContinue}
          loading={createCaseMutation.isPending || submitting}
          style={styles.nextButton}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    padding: 20,
    paddingBottom: 28,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 13,
    marginTop: 6,
    marginBottom: 16,
  },
  input: {
    minHeight: 130,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: "top",
    fontSize: 14,
    marginBottom: 14,
  },
  sectionCard: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
  radioRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  radioChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    alignItems: "center",
  },
  radioText: {
    fontSize: 12,
    fontWeight: "600",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
  },
  selectButton: {
    flex: 1,
  },
  sectionAction: {
    marginTop: 8,
  },
  fileItem: {
    marginTop: 8,
    fontSize: 12,
  },
  nextButton: {
    marginTop: 16,
  },
});
