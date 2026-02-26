import { useCallback, useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Image,
  ImageBackground,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { File } from "expo-file-system";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Audio } from "expo-av";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useTheme } from "../theme/useTheme";
import { Button } from "../components/ui/Button";
import { ChiefComplaintField } from "../components/ChiefComplaintField";
import { useCase, useUpdateCase } from "../features/cases/hooks";
import { useAnimal } from "../features/animals/hooks";
import {
  useCaseDiagnoses,
  useCreateCaseDiagnosis,
} from "../features/diagnoses/hooks";
import {
  useCaseTreatments,
  useCreateCaseTreatment,
} from "../features/treatments/hooks";
import { useCaseNotes } from "../features/notes/hooks";
import { useMediaFilesByCase } from "../features/media/hooks";
import { CollapsibleSection } from "../components/ui/CollapsibleSection";
import {
  getBucketName,
  getDownloadSignedUrl,
  getUploadSignedUrl,
} from "../services/sharedServicesApi";
import { caseDiagnosisApi, caseTreatmentApi } from "../services/vetApi";
import { SpeciesIcon } from "../components/SpeciesIcon";
import { getSpeciesHeroBannerSource } from "../utils/speciesImage";
import type {
  CaseDiagnosis,
  CaseTreatment,
  CaseNote,
  MediaFile,
  DiagnosisSuggestion,
  TreatmentSuggestion,
} from "../types/api";

const ICON_SECTION = 18;
const ICON_CHEVRON = 14;
const ICON_ACTION = 14;
const ICON_EMPTY = 24;

// --- Accordion Section (reusable) ---
interface AccordionSectionProps {
  title: string;
  icon: keyof typeof FontAwesome.glyphMap;
  count?: number;
  expanded: boolean;
  onToggle: () => void;
  colors: ReturnType<typeof useTheme>["colors"];
  children: React.ReactNode;
  action?: React.ReactNode;
}

function AccordionSection({
  title,
  icon,
  count,
  expanded,
  onToggle,
  colors,
  children,
  action,
}: AccordionSectionProps) {
  return (
    <View
      style={[
        styles.accordionCard,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <TouchableOpacity
        style={styles.accordionHeader}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <View style={styles.accordionTitleRow}>
          <FontAwesome
            name={icon}
            size={ICON_SECTION}
            color={colors.primary}
            style={styles.sectionIcon}
          />
          <Text style={[styles.accordionTitle, { color: colors.text }]}>
            {title}
          </Text>
          {count != null && count > 0 && (
            <View
              style={[styles.countBadge, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.countBadgeText}>{count}</Text>
            </View>
          )}
        </View>
        <View style={styles.accordionRight}>
          {action}
          <FontAwesome
            name={expanded ? "chevron-up" : "chevron-down"}
            size={ICON_CHEVRON}
            color={colors.muted}
          />
        </View>
      </TouchableOpacity>
      {expanded && (
        <View style={[styles.accordionBody, { borderTopColor: colors.border }]}>
          {children}
        </View>
      )}
    </View>
  );
}

// --- Media Thumbnail (loads signed URL for S3 images) ---
function MediaThumbnail({
  media,
  colors,
  getBucketName,
  getDownloadSignedUrl,
}: {
  media: MediaFile;
  colors: ReturnType<typeof useTheme>["colors"];
  getBucketName: () => string;
  getDownloadSignedUrl: (bucket: string, key: string) => Promise<string>;
}) {
  const [imageUri, setImageUri] = useState<string | null>(
    media.fileType === "IMAGE" && media.url ? media.url : null,
  );

  useEffect(() => {
    if (media.fileType === "IMAGE" && media.s3Key && !media.url) {
      getDownloadSignedUrl(getBucketName(), media.s3Key)
        .then(setImageUri)
        .catch(() => setImageUri(null));
    }
  }, [media.mediaId, media.s3Key, media.url, media.fileType]);

  const uri = media.fileType === "IMAGE" && media.url ? media.url : imageUri;
  return (
    <View style={styles.mediaItem}>
      {media.fileType === "IMAGE" && uri ? (
        <View style={[styles.imageWrapper, { backgroundColor: colors.border }]}>
          <Image
            source={{ uri }}
            style={styles.mediaImage}
            resizeMode="cover"
            onError={() => setImageUri(null)}
          />
        </View>
      ) : (
        <View
          style={[styles.mediaPlaceholder, { backgroundColor: colors.border }]}
        >
          <FontAwesome name="image" size={24} color={colors.muted} />
          <Text style={[styles.mediaType, { color: colors.text }]}>
            {media.fileType}
          </Text>
        </View>
      )}
      <Text style={[styles.mediaDate, { color: colors.muted }]}>
        {new Date(media.createdAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })}
      </Text>
    </View>
  );
}

// Disease Evidence types (matches create-animal)
type DiseaseEvidenceType = "LAB_REPORT" | "VACINATION" | "X_RAY";
interface SelectedDiseaseEvidence {
  uri: string;
  name: string;
  mimeType?: string;
  imageType: DiseaseEvidenceType;
  source: "gallery" | "camera" | "file";
}

interface SelectedClinicalSignsFile {
  uri: string;
  name: string;
  mimeType?: string;
}

// Accordion sections - Diagnoses expanded by default; Animal collapsed
type AccordionKey = "animal" | "diagnoses" | "treatments" | "notes" | "media";
const DEFAULT_EXPANDED: AccordionKey[] = ["diagnoses"];

export default function CaseDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors, variant } = useTheme();

  const caseId = params.caseId ? Number(params.caseId) : undefined;
  const fromCreate = params.fromCreate === "1" || params.fromCreate === "true";
  const [expanded, setExpanded] = useState<Record<AccordionKey, boolean>>(
    () =>
      Object.fromEntries(
        (
          [
            "animal",
            "diagnoses",
            "treatments",
            "notes",
            "media",
          ] as AccordionKey[]
        ).map((k) => [k, DEFAULT_EXPANDED.includes(k)]),
      ) as Record<AccordionKey, boolean>,
  );
  const [suggestedDiagnoses, setSuggestedDiagnoses] = useState<
    DiagnosisSuggestion[]
  >([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsRequestedByUser, setSuggestionsRequestedByUser] =
    useState(false);
  const [suggestionsListExpanded, setSuggestionsListExpanded] = useState(true);
  const { data: caseData, isLoading: caseLoading } = useCase(caseId || 0);
  const { data: animal, isLoading: animalLoading } = useAnimal(
    caseData?.animalId || 0,
  );
  const {
    data: diagnoses = [],
    isLoading: diagnosesLoading,
    refetch: refetchDiagnoses,
  } = useCaseDiagnoses(caseId || 0);
  const createDiagnosisMutation = useCreateCaseDiagnosis();
  const {
    data: treatments = [],
    isLoading: treatmentsLoading,
    refetch: refetchTreatments,
  } = useCaseTreatments(caseId || 0);
  const createTreatmentMutation = useCreateCaseTreatment();
  const {
    data: notes = [],
    isLoading: notesLoading,
    refetch: refetchNotes,
  } = useCaseNotes(caseId || 0);
  const {
    data: mediaFiles = [],
    isLoading: mediaLoading,
    refetch: refetchMedia,
  } = useMediaFilesByCase(caseId || 0);
  const updateCaseMutation = useUpdateCase();

  // Disease Evidence (lab reports, x-rays, vaccination) - shown when animal linked
  const [selectedDiseaseEvidenceType, setSelectedDiseaseEvidenceType] =
    useState<DiseaseEvidenceType>("LAB_REPORT");
  const [diseaseEvidenceFiles, setDiseaseEvidenceFiles] = useState<
    SelectedDiseaseEvidence[]
  >([]);
  const [uploadingDiseaseEvidence, setUploadingDiseaseEvidence] =
    useState(false);
  const [diseaseEvidenceExpanded, setDiseaseEvidenceExpanded] = useState(false);

  const [clinicalSignsFiles, setClinicalSignsFiles] = useState<
    SelectedClinicalSignsFile[]
  >([]);
  const [uploadingClinicalSigns, setUploadingClinicalSigns] = useState(false);
  const [clinicalSignsExpanded, setClinicalSignsExpanded] = useState(false);

  const sanitizeFileName = useCallback((fileName: string) => {
    return fileName
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9._-]/g, "");
  }, []);

  const inferContentType = useCallback(
    (fileName: string, fallback?: string) => {
      if (fallback?.trim()) return fallback;
      const lower = fileName.toLowerCase();
      if (lower.endsWith(".pdf")) return "application/pdf";
      if (lower.endsWith(".png")) return "image/png";
      if (lower.endsWith(".webp")) return "image/webp";
      if (lower.endsWith(".heic") || lower.endsWith(".heif"))
        return "image/heic";
      return "image/jpeg";
    },
    [],
  );

  const uploadFileToS3 = useCallback(
    async (
      fileUri: string,
      s3Key: string,
      contentType: string,
      tagValue?: string,
    ) => {
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

  const buildDiseaseEvidenceS3Key = useCallback(
    (
      doctorId: number,
      animalId: number,
      caseId: number,
      imageType: DiseaseEvidenceType,
      fileName: string,
    ) => {
      const safeName = sanitizeFileName(
        fileName || `evidence-${Date.now()}.jpg`,
      );
      const timestamp = Date.now();
      return `animal-disease-files/doctorId-${doctorId}_animalId-${animalId}_caseId-${caseId}_${imageType.toLowerCase()}_${timestamp}_${safeName}`;
    },
    [sanitizeFileName],
  );

  const buildClinicalSignsS3Key = useCallback(
    (doctorId: number, animalId: number, caseId: number, fileName: string) => {
      const safeName = sanitizeFileName(
        fileName || `clinical-sign-${Date.now()}.jpg`,
      );
      const timestamp = Date.now();
      return `animal-disease-files/doctorId-${doctorId}_animalId-${animalId}_caseId-${caseId}_clinical_signs_${timestamp}_${safeName}`;
    },
    [sanitizeFileName],
  );

  const addDiseaseEvidence = useCallback((entry: SelectedDiseaseEvidence) => {
    setDiseaseEvidenceFiles((prev) => [...prev, entry]);
  }, []);

  const requestPermissions = useCallback(async () => {
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

  const pickDiseaseEvidenceFromGallery = useCallback(async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const derivedName =
      asset.fileName ??
      `gallery-${Date.now()}.${asset.uri.split(".").pop() ?? "jpg"}`;
    addDiseaseEvidence({
      uri: asset.uri,
      name: sanitizeFileName(derivedName),
      mimeType: asset.mimeType ?? "image/jpeg",
      imageType: selectedDiseaseEvidenceType,
      source: "gallery",
    });
  }, [
    addDiseaseEvidence,
    requestPermissions,
    sanitizeFileName,
    selectedDiseaseEvidenceType,
  ]);

  const captureDiseaseEvidenceFromCamera = useCallback(async () => {
    const hasPermission = await requestCameraPermissions();
    if (!hasPermission) return;
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const derivedName =
      asset.fileName ??
      `camera-${Date.now()}.${asset.uri.split(".").pop() ?? "jpg"}`;
    addDiseaseEvidence({
      uri: asset.uri,
      name: sanitizeFileName(derivedName),
      mimeType: asset.mimeType ?? "image/jpeg",
      imageType: selectedDiseaseEvidenceType,
      source: "camera",
    });
  }, [
    addDiseaseEvidence,
    requestCameraPermissions,
    sanitizeFileName,
    selectedDiseaseEvidenceType,
  ]);

  const pickDiseaseEvidenceFile = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["image/*", "application/pdf"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    addDiseaseEvidence({
      uri: asset.uri,
      name: sanitizeFileName(asset.name || `file-${Date.now()}`),
      mimeType: asset.mimeType ?? undefined,
      imageType: selectedDiseaseEvidenceType,
      source: "file",
    });
  }, [addDiseaseEvidence, sanitizeFileName, selectedDiseaseEvidenceType]);

  const removeDiseaseEvidence = useCallback((index: number) => {
    setDiseaseEvidenceFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const addClinicalSigns = useCallback((entry: SelectedClinicalSignsFile) => {
    setClinicalSignsFiles((prev) => [...prev, entry]);
  }, []);

  const pickClinicalSignsFromGallery = useCallback(async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const derivedName =
      asset.fileName ??
      `gallery-${Date.now()}.${asset.uri.split(".").pop() ?? "jpg"}`;
    addClinicalSigns({
      uri: asset.uri,
      name: sanitizeFileName(derivedName),
      mimeType: asset.mimeType ?? "image/jpeg",
    });
  }, [addClinicalSigns, requestPermissions, sanitizeFileName]);

  const captureClinicalSignsFromCamera = useCallback(async () => {
    const hasPermission = await requestCameraPermissions();
    if (!hasPermission) return;
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const derivedName =
      asset.fileName ??
      `camera-${Date.now()}.${asset.uri.split(".").pop() ?? "jpg"}`;
    addClinicalSigns({
      uri: asset.uri,
      name: sanitizeFileName(derivedName),
      mimeType: asset.mimeType ?? "image/jpeg",
    });
  }, [addClinicalSigns, requestCameraPermissions, sanitizeFileName]);

  const pickClinicalSignsFile = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["image/*"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    addClinicalSigns({
      uri: asset.uri,
      name: sanitizeFileName(asset.name || `file-${Date.now()}`),
      mimeType: asset.mimeType ?? undefined,
    });
  }, [addClinicalSigns, sanitizeFileName]);

  const removeClinicalSigns = useCallback((index: number) => {
    setClinicalSignsFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmitReportImages = useCallback(async () => {
    if (!diseaseEvidenceFiles.length) {
      Alert.alert("No files", "Add report images first.");
      return;
    }
    const vid = caseData?.caseId;
    const animalId = caseData?.animalId;
    const doctorId = caseData?.doctorId;
    if (vid == null || animalId == null || doctorId == null) {
      Alert.alert(
        "Not available",
        "Case and animal must be linked to upload report images.",
      );
      return;
    }
    setUploadingDiseaseEvidence(true);
    try {
      for (const evidence of diseaseEvidenceFiles) {
        const s3Key = buildDiseaseEvidenceS3Key(
          doctorId,
          animalId,
          vid,
          evidence.imageType,
          evidence.name,
        );
        const contentType = inferContentType(
          evidence.name,
          evidence.mimeType,
        );
        await uploadFileToS3(
          evidence.uri,
          s3Key,
          contentType,
          "animal-disease-evidence",
        );
      }
      setDiseaseEvidenceFiles([]);
      setDiseaseEvidenceExpanded(false);
      Alert.alert("Submitted", "Report images have been uploaded.");
    } catch (err) {
      Alert.alert(
        "Upload failed",
        err instanceof Error ? err.message : "Failed to upload report images.",
      );
    } finally {
      setUploadingDiseaseEvidence(false);
    }
  }, [
    caseData?.caseId,
    caseData?.animalId,
    caseData?.doctorId,
    diseaseEvidenceFiles,
    buildDiseaseEvidenceS3Key,
    inferContentType,
    uploadFileToS3,
  ]);

  const handleSubmitClinicalSigns = useCallback(async () => {
    if (!clinicalSignsFiles.length) {
      Alert.alert("No files", "Add clinical sign images first.");
      return;
    }
    const vid = caseData?.caseId;
    const animalId = caseData?.animalId;
    const doctorId = caseData?.doctorId;
    if (vid == null || animalId == null || doctorId == null) {
      Alert.alert(
        "Not available",
        "Case and animal must be linked to upload clinical signs.",
      );
      return;
    }
    setUploadingClinicalSigns(true);
    try {
      for (const file of clinicalSignsFiles) {
        const s3Key = buildClinicalSignsS3Key(
          doctorId,
          animalId,
          vid,
          file.name,
        );
        const contentType = inferContentType(file.name, file.mimeType);
        await uploadFileToS3(
          file.uri,
          s3Key,
          contentType,
          "clinical-signs",
        );
      }
      setClinicalSignsFiles([]);
      setClinicalSignsExpanded(false);
      Alert.alert("Submitted", "Clinical sign images have been uploaded.");
    } catch (err) {
      Alert.alert(
        "Upload failed",
        err instanceof Error
          ? err.message
          : "Failed to upload clinical sign images.",
      );
    } finally {
      setUploadingClinicalSigns(false);
    }
  }, [
    caseData?.caseId,
    caseData?.animalId,
    caseData?.doctorId,
    clinicalSignsFiles,
    buildClinicalSignsS3Key,
    inferContentType,
    uploadFileToS3,
  ]);

  // Editable chief complaint (manual edit only); sync from case when loaded
  const [chiefComplaint, setChiefComplaint] = useState("");
  const chiefComplaintInputRef = useRef<TextInput>(null);
  useEffect(() => {
    if (caseData?.chiefComplaint !== undefined) {
      setChiefComplaint(caseData.chiefComplaint ?? "");
    }
  }, [caseData?.caseId, caseData?.chiefComplaint]);

  // Fetch AI-suggested diagnoses only after user taps "Suggested diagnoses"
  useEffect(() => {
    if (!suggestionsRequestedByUser || !chiefComplaint.trim()) {
      if (!suggestionsRequestedByUser) setSuggestedDiagnoses([]);
      return;
    }
    let cancelled = false;
    setSuggestionsLoading(true);
    caseDiagnosisApi
      .suggestDiagnoses(chiefComplaint.trim(), caseId)
      .then((data) => {
        if (!cancelled) setSuggestedDiagnoses(data || []);
      })
      .catch(() => {
        if (!cancelled) setSuggestedDiagnoses([]);
      })
      .finally(() => {
        if (!cancelled) setSuggestionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [suggestionsRequestedByUser, caseId, chiefComplaint]);

  // Refetch diagnoses, treatments, notes, and media when screen comes into focus (e.g., after adding)
  useFocusEffect(
    useCallback(() => {
      if (caseId) {
        refetchDiagnoses();
        refetchTreatments();
        refetchNotes();
        refetchMedia();
      }
    }, [
      caseId,
      refetchDiagnoses,
      refetchTreatments,
      refetchNotes,
      refetchMedia,
    ]),
  );

  // Remove suggestions that were already added as diagnoses (by matching text)
  useEffect(() => {
    if (diagnoses.length === 0 || suggestedDiagnoses.length === 0) return;
    const addedTexts = new Set(
      diagnoses.map((d) => d.diagnosisText.trim().toLowerCase()),
    );
    const stillSuggested = suggestedDiagnoses.filter(
      (s) => !addedTexts.has(s.diagnosis_text.trim().toLowerCase()),
    );
    if (stillSuggested.length < suggestedDiagnoses.length) {
      setSuggestedDiagnoses(stillSuggested);
    }
  }, [diagnoses, suggestedDiagnoses]);

  const [confirmingSuggestionIndex, setConfirmingSuggestionIndex] = useState<
    number | null
  >(null);

  const handleConfirmSuggestion = useCallback(
    async (s: DiagnosisSuggestion, index: number) => {
      const vid = caseData?.caseId;
      if (!vid) return;
      setConfirmingSuggestionIndex(index);
      try {
        await createDiagnosisMutation.mutateAsync({
          caseId: vid,
          diagnosisText: s.diagnosis_text.trim(),
          status: s.status,
        });
        setSuggestedDiagnoses((prev) => prev.filter((_, i) => i !== index));
        refetchDiagnoses();
      } catch (error) {
        Alert.alert(
          "Error",
          error instanceof Error ? error.message : "Failed to add diagnosis",
        );
      } finally {
        setConfirmingSuggestionIndex(null);
      }
    },
    [caseData?.caseId, createDiagnosisMutation, refetchDiagnoses],
  );

  // Per-diagnosis treatment suggestions: diagnosisId -> list of suggestions
  const [
    treatmentSuggestionsByDiagnosisId,
    setTreatmentSuggestionsByDiagnosisId,
  ] = useState<Record<number, TreatmentSuggestion[]>>({});
  const [loadingTreatmentForDiagnosisId, setLoadingTreatmentForDiagnosisId] =
    useState<number | null>(null);
  const [confirmingTreatmentKey, setConfirmingTreatmentKey] = useState<
    string | null
  >(null); // "diagnosisId-index"

  const handleFetchTreatmentsForDiagnosis = useCallback(
    async (diagnosis: CaseDiagnosis) => {
      const vid = caseData?.caseId;
      if (!vid) return;
      setLoadingTreatmentForDiagnosisId(diagnosis.diagnosisId);
      try {
        const suggestions = await caseTreatmentApi.suggestTreatments([
          {
            diagnosis_text: diagnosis.diagnosisText,
            status: diagnosis.status,
          },
        ]);
        setTreatmentSuggestionsByDiagnosisId((prev) => ({
          ...prev,
          [diagnosis.diagnosisId]: suggestions || [],
        }));
      } catch {
        Alert.alert("Error", "Failed to load treatment suggestions");
      } finally {
        setLoadingTreatmentForDiagnosisId(null);
      }
    },
    [caseData?.caseId],
  );

  const handleConfirmTreatmentSuggestion = useCallback(
    async (
      diagnosisId: number,
      suggestion: TreatmentSuggestion,
      index: number,
    ) => {
      const vid = caseData?.caseId;
      if (!vid) return;
      const key = `${diagnosisId}-${index}`;
      setConfirmingTreatmentKey(key);
      try {
        await createTreatmentMutation.mutateAsync({
          caseId: vid,
          treatmentType: suggestion.treatmentType,
          treatmentStatus: "PLANNED",
          medicineNameFree: suggestion.medicineNameFree ?? undefined,
          dose: suggestion.dose ?? undefined,
          route: suggestion.route ?? undefined,
          frequency: suggestion.frequency ?? undefined,
          durationDays: suggestion.durationDays ?? undefined,
          instructions: suggestion.instructions ?? undefined,
        });
        setTreatmentSuggestionsByDiagnosisId((prev) => {
          const list = prev[diagnosisId] ?? [];
          const next = list.filter((_, i) => i !== index);
          if (next.length === 0) {
            const { [diagnosisId]: _, ...rest } = prev;
            return rest;
          }
          return { ...prev, [diagnosisId]: next };
        });
        refetchTreatments();
      } catch (error) {
        Alert.alert(
          "Error",
          error instanceof Error ? error.message : "Failed to add treatment",
        );
      } finally {
        setConfirmingTreatmentKey(null);
      }
    },
    [caseData?.caseId, createTreatmentMutation, refetchTreatments],
  );

  const isLoading =
    caseLoading ||
    animalLoading ||
    diagnosesLoading ||
    treatmentsLoading ||
    notesLoading ||
    mediaLoading;

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const toggleSection = useCallback((key: AccordionKey) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // Add Treatment: suggest from diagnoses (saved or AI), then navigate with first suggestion to pre-fill
  const [treatmentSuggestionsLoading, setTreatmentSuggestionsLoading] =
    useState(false);
  const handleAddTreatment = useCallback(async () => {
    const vid = caseData?.caseId;
    if (!vid) return;
    const diagnosisPayload = (
      diagnoses.length > 0 ? diagnoses : suggestedDiagnoses
    ).map((d) => ({
      diagnosis_text:
        "diagnosis_text" in d ? d.diagnosis_text : d.diagnosisText,
      status: d.status,
    }));
    const params: Record<string, string> = { caseId: String(vid) };
    if (diagnosisPayload.length > 0) {
      setTreatmentSuggestionsLoading(true);
      try {
        const suggestions =
          await caseTreatmentApi.suggestTreatments(diagnosisPayload);
        const first = suggestions?.[0];
        if (first) {
          params.treatmentType = first.treatmentType;
          if (first.medicineNameFree != null)
            params.medicineNameFree = first.medicineNameFree;
          if (first.dose != null) params.dose = first.dose;
          if (first.route != null) params.route = first.route;
          if (first.frequency != null) params.frequency = first.frequency;
          if (first.durationDays != null)
            params.durationDays = String(first.durationDays);
          if (first.instructions != null)
            params.instructions = first.instructions;
        }
      } catch {
        // ignore; navigate without pre-fill
      } finally {
        setTreatmentSuggestionsLoading(false);
      }
    }
    router.push({ pathname: "/add-treatment", params });
  }, [caseData?.caseId, diagnoses, suggestedDiagnoses]);

  // Open diagnosis form pre-filled for editing
  const handleEditDiagnosis = useCallback(
    (diagnosis: CaseDiagnosis) => {
      const params: Record<string, string> = {
        caseId: String(caseData?.caseId ?? ""),
        diagnosisId: String(diagnosis.diagnosisId),
        diagnosisText: diagnosis.diagnosisText ?? "",
        status: diagnosis.status,
      };
      router.push({ pathname: "/add-diagnosis", params });
    },
    [caseData?.caseId],
  );

  // Open treatment form pre-filled for editing
  const handleEditTreatment = useCallback(
    (treatment: CaseTreatment) => {
      const params: Record<string, string> = {
        caseId: String(caseData?.caseId ?? ""),
        treatmentId: String(treatment.treatmentId),
        treatmentType: treatment.treatmentType ?? "MEDICATION",
        treatmentStatus: treatment.treatmentStatus,
      };
      if (treatment.medicineNameFree != null)
        params.medicineNameFree = treatment.medicineNameFree;
      if (treatment.dose != null) params.dose = treatment.dose;
      if (treatment.route != null) params.route = treatment.route;
      if (treatment.frequency != null) params.frequency = treatment.frequency;
      if (treatment.durationDays != null)
        params.durationDays = String(treatment.durationDays);
      if (treatment.instructions != null)
        params.instructions = treatment.instructions;
      router.push({ pathname: "/add-treatment", params });
    },
    [caseData?.caseId],
  );

  // Helper to get audio URL from media file
  const getAudioUrl = async (media: MediaFile): Promise<string | null> => {
    if (media.url) {
      return media.url;
    }
    if (media.s3Key) {
      try {
        const bucketName = getBucketName();
        const signedUrl = await getDownloadSignedUrl(bucketName, media.s3Key);
        return signedUrl;
      } catch (error) {
        console.error("Error getting audio signed URL:", error);
        return null;
      }
    }
    return null;
  };

  if (isLoading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <StatusBar style="auto" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!caseData) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <StatusBar style="auto" />
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.text }]}>
            Case not found
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
        showsVerticalScrollIndicator={false}
      >
        {/* Header: row 1 = date | species+icon, row 2 = tagline, row 3 = chief complaint (editable on tap) */}
        <ImageBackground
          source={getSpeciesHeroBannerSource(animal?.species ?? "", variant)}
          style={styles.headerHero}
          imageStyle={styles.headerHeroImage}
        >
          <View
            pointerEvents="none"
            style={[
              styles.headerScrim,
              {
                backgroundColor: colors.surface,
              },
            ]}
          />
          <View
            style={[
              styles.headerContent,
              {
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              },
            ]}
          >
            {/* Row 1: Species + icon (tappable to animal profile) */}
            <View style={styles.headerRow1}>
              {animal ? (
                <TouchableOpacity
                  style={styles.headerSpeciesRow}
                  onPress={() =>
                    router.push(`/animal-details?animalId=${animal.animalId}`)
                  }
                  activeOpacity={0.7}
                >
                  <SpeciesIcon
                    species={animal.species}
                    size={36}
                    style={styles.headerSpeciesAvatar}
                    resizeMode="contain"
                  />
                  <View style={styles.headerSpeciesTextBlock}>
                    <Text
                      style={[styles.headerSpeciesText, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      {animal.species}
                    </Text>
                    {animal.breed != null &&
                    animal.breed !== "null" &&
                    String(animal.breed).trim() !== "" ? (
                      <Text
                        style={[
                          styles.headerSpeciesText,
                          styles.headerBreedText,
                          { color: colors.text },
                        ]}
                        numberOfLines={1}
                      >
                        {animal.breed}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              ) : (
                <Text
                  style={[styles.headerSpeciesText, { color: colors.muted }]}
                >
                  —
                </Text>
              )}
            </View>
            {/* Row 2: Animal tagline */}
            {animal?.animalTagline ? (
              <Text
                style={[styles.headerTagline, { color: colors.muted }]}
                numberOfLines={2}
              >
                {animal.animalTagline}
              </Text>
            ) : null}
            {/* Row 3: Date (own row so always fully visible) */}
            <View style={styles.headerDateRow}>
              <Text style={[styles.headerDate, { color: colors.muted }]}>
                {caseData ? formatDate(caseData.caseDatetime) : ""}
              </Text>
            </View>
            {/* Row 4: Chief complaint — editable on tap */}
            <ChiefComplaintField
              ref={chiefComplaintInputRef}
              value={chiefComplaint}
              onChangeText={setChiefComplaint}
              disabled={isLoading}
              showVoiceInput
              onRecordingComplete={(_, rawText, improvedText) => {
                const text = (improvedText ?? rawText).trim();
                if (text !== "") setChiefComplaint(text);
              }}
              onTranscriptReady={(transcript) => setChiefComplaint(transcript)}
              onVoiceError={(error) => Alert.alert("Error", error.message)}
              caseId={caseData?.caseId}
            />
          </View>
        </ImageBackground>

        {/* Disease Evidence (optional) - before Diagnoses, only when animal linked. Hide when from create flow (user already filled in create-animal). */}
        {caseData?.animalId != null && !fromCreate && (
          <CollapsibleSection
            title="Disease Evidence (optional)"
            subtitle="Upload related images/files and classify by report type."
            icon="file"
            expanded={diseaseEvidenceExpanded}
            onToggle={() => setDiseaseEvidenceExpanded((v) => !v)}
            hasContent={diseaseEvidenceFiles.length > 0}
            thumbnailUri={
              diseaseEvidenceFiles[0]?.source !== "file"
                ? diseaseEvidenceFiles[0]?.uri
                : undefined
            }
            style={styles.diseaseEvidenceCard}
          >
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
                    activeOpacity={0.7}
                    onPress={() =>
                      setSelectedDiseaseEvidenceType(value as DiseaseEvidenceType)
                    }
                    style={[
                      styles.radioChip,
                      {
                        borderColor: selected
                          ? colors.primary
                          : colors.border,
                        backgroundColor: selected
                          ? `${colors.primary}22`
                          : colors.surface,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.radioDot,
                        {
                          borderColor: selected
                            ? colors.primary
                            : colors.muted,
                          backgroundColor: selected
                            ? colors.primary
                            : "transparent",
                        },
                      ]}
                    />
                    <Text style={[styles.radioText, { color: colors.text }]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.buttonRow}>
              <Button
                title="Choose Image"
                onPress={pickDiseaseEvidenceFromGallery}
                variant="secondary"
                style={styles.selectButton}
              />
              <Button
                title="Take Photo"
                onPress={captureDiseaseEvidenceFromCamera}
                variant="secondary"
                style={styles.selectButton}
              />
            </View>
            <Button
              title="Pick File"
              onPress={pickDiseaseEvidenceFile}
              variant="secondary"
              style={styles.primaryButton}
            />
            {diseaseEvidenceFiles.length > 0 ? (
              <>
                <View style={styles.evidenceList}>
                  {diseaseEvidenceFiles.map((evidence, index) => (
                    <View
                      key={`${evidence.uri}-${index}`}
                      style={[
                        styles.evidenceItem,
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.surface,
                        },
                      ]}
                    >
                      <View style={styles.evidenceItemBody}>
                        <Text
                          style={[
                            styles.evidenceType,
                            { color: colors.primary },
                          ]}
                        >
                          {evidence.imageType}
                        </Text>
                        <Text
                          style={[
                            styles.evidenceName,
                            { color: colors.text },
                          ]}
                          numberOfLines={1}
                        >
                          {evidence.name}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => removeDiseaseEvidence(index)}
                        style={styles.playbackIconButton}
                      >
                        <FontAwesome
                          name="times"
                          size={12}
                          color={colors.muted}
                        />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
                <Button
                  title={
                    uploadingDiseaseEvidence
                      ? "Uploading report images…"
                      : "Submit report images"
                  }
                  variant="primary"
                  onPress={handleSubmitReportImages}
                  style={styles.submitFilesButton}
                  disabled={uploadingDiseaseEvidence}
                />
              </>
            ) : null}
          </CollapsibleSection>
        )}

        {/* Clinical Signs (optional) - before Diagnoses, only when animal linked. Hide when from create flow (user already filled in create-animal). */}
        {caseData?.animalId != null && !fromCreate && (
          <CollapsibleSection
            title="Clinical Signs (optional)"
            subtitle="Add photos or images of clinical signs (e.g. lesions, swelling, discharge). Stored under your account."
            icon="image"
            expanded={clinicalSignsExpanded}
            onToggle={() => setClinicalSignsExpanded((v) => !v)}
            hasContent={clinicalSignsFiles.length > 0}
            thumbnailUri={clinicalSignsFiles[0]?.uri}
            style={styles.diseaseEvidenceCard}
          >
            <View style={styles.buttonRow}>
              <Button
                title="Choose Image"
                onPress={pickClinicalSignsFromGallery}
                variant="secondary"
                style={styles.selectButton}
              />
              <Button
                title="Take Photo"
                onPress={captureClinicalSignsFromCamera}
                variant="secondary"
                style={styles.selectButton}
              />
            </View>
            <Button
              title="Pick File"
              onPress={pickClinicalSignsFile}
              variant="secondary"
              style={styles.primaryButton}
            />
            {clinicalSignsFiles.length > 0 ? (
              <>
                <View style={styles.evidenceList}>
                  {clinicalSignsFiles.map((file, index) => (
                    <View
                      key={`${file.uri}-${index}`}
                      style={[
                        styles.evidenceItem,
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.surface,
                        },
                      ]}
                    >
                      <View style={styles.evidenceItemBody}>
                        <Text
                          style={[
                            styles.evidenceType,
                            { color: colors.primary },
                          ]}
                        >
                          Clinical sign
                        </Text>
                        <Text
                          style={[
                            styles.evidenceName,
                            { color: colors.text },
                          ]}
                          numberOfLines={1}
                        >
                          {file.name}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => removeClinicalSigns(index)}
                        style={styles.playbackIconButton}
                      >
                        <FontAwesome
                          name="times"
                          size={12}
                          color={colors.muted}
                        />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
                <Button
                  title={
                    uploadingClinicalSigns
                      ? "Uploading clinical signs…"
                      : "Submit clinical sign images"
                  }
                  variant="primary"
                  onPress={handleSubmitClinicalSigns}
                  style={styles.submitFilesButton}
                  disabled={uploadingClinicalSigns}
                />
              </>
            ) : null}
          </CollapsibleSection>
        )}

        {/* 1. Diagnoses (with AI suggestions inline) */}
        <AccordionSection
          title="Diagnoses"
          icon="stethoscope"
          count={diagnoses.length}
          expanded={expanded.diagnoses}
          onToggle={() => toggleSection("diagnoses")}
          colors={colors}
          action={
            <TouchableOpacity
              onPress={() =>
                router.push(`/add-diagnosis?caseId=${caseData?.caseId}`)
              }
              style={[styles.addChip, { backgroundColor: colors.primary }]}
              activeOpacity={0.8}
            >
              <FontAwesome name="plus" size={12} color={colors.surface} />
              <Text style={[styles.addChipText, { color: colors.surface }]}>
                Add
              </Text>
            </TouchableOpacity>
          }
        >
          {/* AI Suggestions (inline) */}
          {chiefComplaint.trim() && (
            <View
              style={[
                styles.aiBlock,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                },
              ]}
            >
              {!suggestionsRequestedByUser ? (
                <TouchableOpacity
                  onPress={() => setSuggestionsRequestedByUser(true)}
                  style={styles.aiCta}
                  activeOpacity={0.8}
                >
                  <FontAwesome
                    name="lightbulb-o"
                    size={16}
                    color={colors.primary}
                  />
                  <Text style={[styles.aiCtaText, { color: colors.primary }]}>
                    Get AI suggestions
                  </Text>
                  <FontAwesome
                    name="chevron-right"
                    size={12}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              ) : suggestionsLoading ? (
                <View style={styles.aiLoading}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[styles.aiLoadingText, { color: colors.muted }]}>
                    Suggesting…
                  </Text>
                </View>
              ) : suggestedDiagnoses.length > 0 ? (
                <View style={styles.suggestionsList}>
                  <TouchableOpacity
                    style={styles.suggestionsListHeader}
                    onPress={() => setSuggestionsListExpanded((v) => !v)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.aiLabel,
                        { color: colors.muted, marginBottom: 0 },
                      ]}
                    >
                      Suggested ({suggestedDiagnoses.length})
                    </Text>
                    <FontAwesome
                      name={
                        suggestionsListExpanded ? "chevron-up" : "chevron-down"
                      }
                      size={14}
                      color={colors.muted}
                    />
                  </TouchableOpacity>
                  {suggestionsListExpanded &&
                    suggestedDiagnoses.map((s, index) => (
                      <View
                        key={`${s.diagnosis_text}-${index}`}
                        style={[
                          styles.suggestionRow,
                          {
                            borderLeftColor: colors.primary,
                            backgroundColor: colors.surface,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.suggestionText,
                            { color: colors.text },
                          ]}
                          numberOfLines={3}
                        >
                          {s.diagnosis_text}
                        </Text>
                        <View style={styles.suggestionRowFooter}>
                          <View
                            style={[
                              styles.statusBadge,
                              {
                                backgroundColor:
                                  s.status === "CONFIRMED"
                                    ? colors.success
                                    : colors.warning,
                              },
                            ]}
                          >
                            <Text style={styles.statusBadgeText}>
                              {s.status}
                            </Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => handleConfirmSuggestion(s, index)}
                            disabled={
                              confirmingSuggestionIndex !== null &&
                              confirmingSuggestionIndex !== index
                            }
                            style={[
                              styles.addChip,
                              {
                                backgroundColor: colors.success,
                                opacity:
                                  confirmingSuggestionIndex !== null &&
                                  confirmingSuggestionIndex !== index
                                    ? 0.5
                                    : 1,
                              },
                            ]}
                            activeOpacity={0.8}
                          >
                            {confirmingSuggestionIndex === index ? (
                              <ActivityIndicator
                                size="small"
                                color={colors.surface}
                              />
                            ) : (
                              <>
                                <FontAwesome
                                  name="plus"
                                  size={10}
                                  color={colors.surface}
                                />
                                <Text
                                  style={[
                                    styles.addChipText,
                                    { color: colors.surface },
                                  ]}
                                >
                                  Add
                                </Text>
                              </>
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                </View>
              ) : (
                <Text style={[styles.aiEmptyText, { color: colors.muted }]}>
                  No AI suggestions found
                </Text>
              )}
            </View>
          )}

          {/* Saved diagnoses */}
          {diagnoses.length > 0 ? (
            <View style={styles.diagnosesList}>
              {diagnoses.map((diagnosis) => {
                const audioMedia = diagnosis.mediaId
                  ? mediaFiles.find((m) => m.mediaId === diagnosis.mediaId)
                  : null;
                const suggestedForThis =
                  treatmentSuggestionsByDiagnosisId[diagnosis.diagnosisId] ??
                  [];
                const loadingTreatments =
                  loadingTreatmentForDiagnosisId === diagnosis.diagnosisId;
                return (
                  <View
                    key={diagnosis.diagnosisId}
                    style={[
                      styles.diagnosisBlock,
                      { borderColor: colors.border },
                    ]}
                  >
                    <View style={styles.diagnosisBlockRow}>
                      <View style={styles.diagnosisBlockContent}>
                        <DiagnosisItem
                          diagnosis={diagnosis}
                          audioMedia={audioMedia}
                          colors={colors}
                          getAudioUrl={getAudioUrl}
                        />
                      </View>
                      <View style={styles.diagnosisBlockActions}>
                        <TouchableOpacity
                          onPress={() => handleEditDiagnosis(diagnosis)}
                          style={[
                            styles.iconBtn,
                            { borderColor: colors.primary },
                          ]}
                          activeOpacity={0.7}
                        >
                          <FontAwesome
                            name="pencil"
                            size={ICON_ACTION}
                            color={colors.primary}
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() =>
                            handleFetchTreatmentsForDiagnosis(diagnosis)
                          }
                          disabled={loadingTreatmentForDiagnosisId !== null}
                          style={[
                            styles.iconBtn,
                            {
                              borderColor: colors.primary,
                              opacity:
                                loadingTreatmentForDiagnosisId !== null
                                  ? 0.5
                                  : 1,
                            },
                          ]}
                          activeOpacity={0.7}
                        >
                          {loadingTreatments ? (
                            <ActivityIndicator
                              size="small"
                              color={colors.primary}
                            />
                          ) : (
                            <FontAwesome
                              name="medkit"
                              size={ICON_ACTION}
                              color={colors.primary}
                            />
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                    {suggestedForThis.length > 0 && (
                      <View
                        style={[
                          styles.suggestedTreatmentsContainer,
                          {
                            backgroundColor: colors.background,
                            borderColor: colors.border,
                            borderWidth: 1,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.suggestedTreatmentsTitle,
                            { color: colors.muted },
                          ]}
                        >
                          Suggested treatments
                        </Text>
                        {suggestedForThis.map((sug, idx) => {
                          const confirmKey = `${diagnosis.diagnosisId}-${idx}`;
                          const isConfirming =
                            confirmingTreatmentKey === confirmKey;
                          return (
                            <View
                              key={idx}
                              style={[
                                styles.suggestedTreatmentRow,
                                { borderLeftColor: colors.accent },
                              ]}
                            >
                              <View style={styles.suggestedTreatmentRowContent}>
                                <Text
                                  style={[
                                    styles.suggestedTreatmentType,
                                    { color: colors.primary },
                                  ]}
                                >
                                  {sug.treatmentType}
                                </Text>
                                {sug.medicineNameFree?.trim() && (
                                  <Text
                                    style={[
                                      styles.suggestedTreatmentLine,
                                      { color: colors.text },
                                    ]}
                                  >
                                    <Text style={styles.bold}>Medicine: </Text>
                                    {sug.medicineNameFree}
                                  </Text>
                                )}
                                {sug.dose?.trim() && (
                                  <Text
                                    style={[
                                      styles.suggestedTreatmentLine,
                                      { color: colors.text },
                                    ]}
                                  >
                                    <Text style={styles.bold}>Dose: </Text>
                                    {sug.dose}
                                  </Text>
                                )}
                                {sug.route?.trim() && (
                                  <Text
                                    style={[
                                      styles.suggestedTreatmentLine,
                                      { color: colors.text },
                                    ]}
                                  >
                                    <Text style={styles.bold}>Route: </Text>
                                    {sug.route}
                                  </Text>
                                )}
                                {sug.frequency?.trim() && (
                                  <Text
                                    style={[
                                      styles.suggestedTreatmentLine,
                                      { color: colors.text },
                                    ]}
                                  >
                                    <Text style={styles.bold}>Frequency: </Text>
                                    {sug.frequency}
                                  </Text>
                                )}
                                {sug.durationDays != null && (
                                  <Text
                                    style={[
                                      styles.suggestedTreatmentLine,
                                      { color: colors.text },
                                    ]}
                                  >
                                    <Text style={styles.bold}>Duration: </Text>
                                    {sug.durationDays} days
                                  </Text>
                                )}
                                {sug.instructions?.trim() && (
                                  <Text
                                    style={[
                                      styles.suggestedTreatmentLine,
                                      styles.suggestedTreatmentInstructions,
                                      { color: colors.text },
                                    ]}
                                    numberOfLines={3}
                                  >
                                    <Text style={styles.bold}>
                                      Instructions:{" "}
                                    </Text>
                                    {sug.instructions}
                                  </Text>
                                )}
                              </View>
                              <TouchableOpacity
                                onPress={() =>
                                  handleConfirmTreatmentSuggestion(
                                    diagnosis.diagnosisId,
                                    sug,
                                    idx,
                                  )
                                }
                                disabled={
                                  confirmingTreatmentKey !== null &&
                                  confirmingTreatmentKey !== confirmKey
                                }
                                style={[
                                  styles.iconBtn,
                                  {
                                    borderColor: colors.success,
                                    opacity:
                                      confirmingTreatmentKey !== null &&
                                      confirmingTreatmentKey !== confirmKey
                                        ? 0.5
                                        : 1,
                                  },
                                ]}
                                activeOpacity={0.7}
                              >
                                {isConfirming ? (
                                  <ActivityIndicator
                                    size="small"
                                    color={colors.success}
                                  />
                                ) : (
                                  <FontAwesome
                                    name="check-circle"
                                    size={ICON_ACTION}
                                    color={colors.success}
                                  />
                                )}
                              </TouchableOpacity>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <FontAwesome
                name="clipboard"
                size={ICON_EMPTY}
                color={colors.muted}
                style={styles.emptyIcon}
              />
              <Text style={[styles.emptyText, { color: colors.muted }]}>
                No diagnoses yet
              </Text>
              <Text style={[styles.emptySubtext, { color: colors.muted }]}>
                Add from AI suggestions above or tap Add
              </Text>
            </View>
          )}
        </AccordionSection>

        {/* 3. Treatments */}
        <AccordionSection
          title="Treatments"
          icon="medkit"
          count={treatments.length}
          expanded={expanded.treatments}
          onToggle={() => toggleSection("treatments")}
          colors={colors}
          action={
            <TouchableOpacity
              onPress={handleAddTreatment}
              disabled={treatmentSuggestionsLoading}
              style={[
                styles.addChip,
                {
                  backgroundColor: colors.primary,
                  opacity: treatmentSuggestionsLoading ? 0.6 : 1,
                },
              ]}
              activeOpacity={0.8}
            >
              {treatmentSuggestionsLoading ? (
                <ActivityIndicator size="small" color={colors.surface} />
              ) : (
                <FontAwesome name="plus" size={12} color={colors.surface} />
              )}
              <Text style={[styles.addChipText, { color: colors.surface }]}>
                {treatmentSuggestionsLoading ? "…" : "Add"}
              </Text>
            </TouchableOpacity>
          }
        >
          {treatments.length > 0 ? (
            <View style={styles.listContainer}>
              {treatments.map((treatment) => {
                const audioMedia = treatment.mediaId
                  ? mediaFiles.find((m) => m.mediaId === treatment.mediaId)
                  : null;
                return (
                  <TreatmentItem
                    key={treatment.treatmentId}
                    treatment={treatment}
                    audioMedia={audioMedia}
                    colors={colors}
                    getAudioUrl={getAudioUrl}
                    onEdit={handleEditTreatment}
                  />
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <FontAwesome
                name="medkit"
                size={ICON_EMPTY}
                color={colors.muted}
                style={styles.emptyIcon}
              />
              <Text style={[styles.emptyText, { color: colors.muted }]}>
                No treatments yet
              </Text>
            </View>
          )}
        </AccordionSection>

        {/* 4. Notes */}
        <AccordionSection
          title="Notes"
          icon="file-text-o"
          count={notes.length}
          expanded={expanded.notes}
          onToggle={() => toggleSection("notes")}
          colors={colors}
          action={
            <TouchableOpacity
              onPress={() =>
                router.push(`/add-note?caseId=${caseData?.caseId}`)
              }
              style={[styles.addChip, { backgroundColor: colors.primary }]}
              activeOpacity={0.8}
            >
              <FontAwesome name="plus" size={12} color={colors.surface} />
              <Text style={[styles.addChipText, { color: colors.surface }]}>
                Add
              </Text>
            </TouchableOpacity>
          }
        >
          {notes.length > 0 ? (
            <View style={styles.listContainer}>
              {notes.map((note) => {
                let audioMedia: MediaFile | null | undefined = null;
                if (note.noteType === "VOICE_TRANSCRIPT") {
                  if (note.mediaId)
                    audioMedia = mediaFiles.find(
                      (m) => m.mediaId === note.mediaId,
                    );
                  if (!audioMedia && caseId) {
                    const audioFiles = mediaFiles.filter(
                      (m) =>
                        m.fileType === "AUDIO" &&
                        m.caseId === caseId &&
                        m.s3Key?.includes(`cases/${caseId}/audio/`),
                    );
                    if (audioFiles.length > 0) {
                      const noteCreatedAt = new Date(note.createdAt).getTime();
                      audioMedia = audioFiles.reduce((closest, current) => {
                        const currentDiff = Math.abs(
                          new Date(current.createdAt).getTime() - noteCreatedAt,
                        );
                        const closestDiff = Math.abs(
                          new Date(closest.createdAt).getTime() - noteCreatedAt,
                        );
                        return currentDiff < closestDiff ? current : closest;
                      });
                    }
                  }
                }
                return (
                  <NoteItem
                    key={note.noteId}
                    note={note}
                    audioMedia={audioMedia}
                    colors={colors}
                    getAudioUrl={getAudioUrl}
                  />
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <FontAwesome
                name="file-text-o"
                size={ICON_EMPTY}
                color={colors.muted}
                style={styles.emptyIcon}
              />
              <Text style={[styles.emptyText, { color: colors.muted }]}>
                No notes yet
              </Text>
            </View>
          )}
        </AccordionSection>

        {/* 5. Media */}
        <AccordionSection
          title="Media"
          icon="image"
          count={mediaFiles.length}
          expanded={expanded.media}
          onToggle={() => toggleSection("media")}
          colors={colors}
          action={
            <TouchableOpacity
              onPress={() =>
                router.push(`/add-media?caseId=${caseData?.caseId}`)
              }
              style={[styles.addChip, { backgroundColor: colors.primary }]}
              activeOpacity={0.8}
            >
              <FontAwesome name="plus" size={12} color={colors.surface} />
              <Text style={[styles.addChipText, { color: colors.surface }]}>
                Upload
              </Text>
            </TouchableOpacity>
          }
        >
          {mediaFiles.length > 0 ? (
            <View style={styles.mediaContainer}>
              {mediaFiles.map((media) => (
                <MediaThumbnail
                  key={media.mediaId}
                  media={media}
                  colors={colors}
                  getBucketName={getBucketName}
                  getDownloadSignedUrl={getDownloadSignedUrl}
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <FontAwesome
                name="image"
                size={ICON_EMPTY}
                color={colors.muted}
                style={styles.emptyIcon}
              />
              <Text style={[styles.emptyText, { color: colors.muted }]}>
                No media yet
              </Text>
            </View>
          )}
        </AccordionSection>

        {/* Save / Done - set case COMPLETED; warn if no diagnosis or treatment yet */}
        <Button
          title={updateCaseMutation.isPending ? "Saving..." : "Save"}
          onPress={async () => {
            if (!caseId) return;
            const isComplete = diagnoses.length >= 1 && treatments.length >= 1;
            const doSave = async () => {
              try {
                await updateCaseMutation.mutateAsync({
                  caseId,
                  request: {
                    status: isComplete ? "COMPLETED" : "IN_PROGRESS",
                    chiefComplaint: chiefComplaint.trim() || undefined,
                  },
                });
                router.replace("/");
              } catch (e) {
                Alert.alert(
                  "Error",
                  e instanceof Error
                    ? e.message
                    : "Failed to update case status",
                );
              }
            };
            if (!isComplete) {
              Alert.alert(
                "Case unfinished",
                "You haven't added at least one diagnosis and one treatment. The case will still be saved. You can add them later.",
                [{ text: "OK", onPress: doSave }],
              );
              return;
            }
            await doSave();
          }}
          variant="primary"
          style={styles.saveButton}
          disabled={!caseId || updateCaseMutation.isPending}
          loading={updateCaseMutation.isPending}
        />
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
    padding: 20,
    paddingBottom: 32,
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
  saveButton: {
    marginTop: 24,
    marginBottom: 24,
  },
  headerHero: {
    marginBottom: 20,
    borderRadius: 16,
    overflow: "hidden",
    minHeight: 125,
  },
  headerHeroImage: {
    opacity: 0.65,
    resizeMode: "cover",
  },
  headerScrim: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.5,
  },
  headerContent: {
    padding: 16,
    paddingBottom: 16,
  },
  headerDate: {
    fontSize: 13,
    marginBottom: 0,
  },
  headerRow1: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    minWidth: 0,
  },
  headerSpeciesRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
  },
  headerDateRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 6,
  },
  headerSpeciesAvatar: {
    width: 36,
    height: 36,
    marginRight: 8,
    backgroundColor: "transparent",
  },
  headerSpeciesTextBlock: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  headerSpeciesText: {
    fontSize: 14,
    fontWeight: "600",
  },
  headerBreedText: {
    marginTop: 2,
  },
  headerTagline: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
    fontStyle: "italic",
    textAlign: "right",
  },
  headerAnimal: {
    fontSize: 14,
  },
  accordionCard: {
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    overflow: "hidden",
  },
  accordionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 0,
    minHeight: 48,
    paddingVertical: 4,
  },
  accordionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  accordionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 0,
  },
  accordionRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 22,
    alignItems: "center",
  },
  countBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  addChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addChipText: {
    fontSize: 14,
    fontWeight: "600",
  },
  accordionBody: {
    marginTop: 4,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionIcon: {
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  sectionTitleRowStandalone: {
    marginBottom: 12,
  },
  suggestionsCtaCard: {
    borderLeftWidth: 4,
    borderRadius: 12,
    padding: 18,
    overflow: "hidden",
    minHeight: 72,
    justifyContent: "center",
  },
  suggestionsCtaContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  suggestionsCtaIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  suggestionsCtaTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  suggestionsCtaTitle: {
    fontSize: 17,
    fontWeight: "600",
    marginBottom: 2,
  },
  suggestionsCtaSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  suggestionsSectionHeader: {
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: 1,
  },
  suggestionsList: {
    gap: 10,
  },
  suggestionCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: 14,
    overflow: "hidden",
  },
  suggestionCardContent: {
    minWidth: 0,
  },
  suggestionCardText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  suggestionCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  suggestionCardBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  suggestionCardBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  suggestionAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  suggestionAddBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  addButtonStandalone: {
    alignSelf: "flex-start",
  },
  suggestionsEmptyRequested: {
    paddingVertical: 16,
    alignItems: "center",
  },
  suggestionsEmptyText: {
    fontSize: 14,
    marginBottom: 12,
    textAlign: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  addButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    flex: 1,
  },
  value: {
    fontSize: 14,
    fontWeight: "500",
    flex: 2,
    textAlign: "right",
  },
  aiSummaryBlock: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  aiSummaryText: {
    fontSize: 14,
    lineHeight: 22,
    marginTop: 8,
  },
  linkButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1.5,
    alignSelf: "stretch",
  },
  linkButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  aiBlock: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  aiCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  aiCtaText: {
    fontSize: 15,
    fontWeight: "600",
  },
  aiLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  aiLoadingText: {
    fontSize: 14,
  },
  aiLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  suggestionsListHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  aiEmptyText: {
    fontSize: 14,
  },
  suggestionRow: {
    padding: 10,
    marginBottom: 8,
    borderRadius: 8,
    borderLeftWidth: 3,
  },
  suggestionText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  suggestionRowFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  emptyState: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  emptyIcon: {
    marginBottom: 12,
    opacity: 0.7,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 6,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContainer: {
    marginTop: 10,
  },
  suggestionsLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  suggestionsLoadingText: {
    fontSize: 14,
  },
  suggestionIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  diagnosesSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  diagnosesList: {
    gap: 8,
  },
  diagnosisBlock: {
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  diagnosisBlockRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  diagnosisBlockContent: {
    flex: 1,
    minWidth: 0,
  },
  diagnosisBlockActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: 8,
  },
  editDiagnosisBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  getTreatmentsIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  diagnosisItem: {
    paddingVertical: 4,
    paddingHorizontal: 0,
    paddingLeft: 10,
    marginBottom: 0,
    backgroundColor: "transparent",
    borderLeftWidth: 2,
  },
  suggestedTreatmentsContainer: {
    marginLeft: 0,
    marginTop: 10,
    padding: 8,
    borderRadius: 8,
  },
  suggestedTreatmentsTitle: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  suggestedTreatmentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderLeftWidth: 2,
    borderRadius: 8,
  },
  suggestedTreatmentRowContent: {
    flex: 1,
    marginRight: 10,
    minWidth: 0,
  },
  suggestedTreatmentType: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
  },
  suggestedTreatmentLine: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 2,
  },
  suggestedTreatmentLabel: {
    fontWeight: "600",
  },
  suggestedTreatmentInstructions: {
    marginTop: 4,
    opacity: 0.95,
  },
  suggestedTreatmentDetail: {
    fontSize: 12,
    marginTop: 2,
  },
  diagnosesEmptyState: {
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  diagnosisHeader: {
    marginBottom: 4,
  },
  diagnosisStatus: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  diagnosisText: {
    fontSize: 14,
    lineHeight: 20,
  },
  treatmentItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    backgroundColor: "transparent",
    borderLeftWidth: 2,
  },
  treatmentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  treatmentHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  editTreatmentBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  treatmentType: {
    fontSize: 14,
    fontWeight: "600",
  },
  treatmentStatus: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  treatmentText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  bold: {
    fontWeight: "600",
  },
  noteItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    backgroundColor: "transparent",
    borderLeftWidth: 2,
  },
  noteHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  noteHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  noteIcon: {
    marginRight: 0,
  },
  noteType: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  noteDate: {
    fontSize: 12,
  },
  audioPlayerCard: {
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    marginTop: 4,
    borderWidth: 1,
  },
  audioPlayerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  playButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  playIcon: {
    marginLeft: 1,
  },
  audioInfo: {
    flex: 1,
    justifyContent: "center",
  },
  audioInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  audioLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  audioDuration: {
    fontSize: 12,
  },
  stopButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  audioControls: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  audioButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    gap: 6,
  },
  audioButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  noteText: {
    fontSize: 14,
    lineHeight: 20,
  },
  mediaContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 8,
  },
  mediaItem: {
    width: "48%",
    marginBottom: 12,
  },
  imageWrapper: {
    position: "relative",
    width: "100%",
    borderRadius: 8,
    overflow: "hidden",
  },
  mediaImage: {
    width: "100%",
    height: 150,
    borderRadius: 8,
  },
  imageOverlay: {
    position: "absolute",
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  imageLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  mediaPlaceholder: {
    width: "100%",
    height: 150,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  mediaType: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  mediaDate: {
    fontSize: 12,
    marginTop: 6,
    textAlign: "center",
  },
  diseaseEvidenceCard: {
    marginBottom: 16,
    padding: 0,
    overflow: "hidden",
  },
  radioRow: {
    flexDirection: "row",
    marginTop: 8,
    marginBottom: 12,
    gap: 8,
  },
  radioChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    gap: 8,
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
  },
  radioText: {
    fontSize: 13,
    fontWeight: "600",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  selectButton: { flex: 1 },
  primaryButton: { marginTop: 8, minHeight: 48 },
  evidenceList: {
    marginTop: 12,
    gap: 8,
  },
  evidenceItem: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  evidenceItemBody: {
    flex: 1,
    minWidth: 0,
  },
  evidenceType: {
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4,
  },
  evidenceName: {
    fontSize: 13,
  },
  playbackIconButton: {
    padding: 4,
  },
  submitFilesButton: { marginTop: 14, minHeight: 48 },
});

// Diagnosis Item Component with Audio Playback
interface DiagnosisItemProps {
  diagnosis: CaseDiagnosis;
  audioMedia: MediaFile | null | undefined;
  colors: ReturnType<typeof useTheme>["colors"];
  getAudioUrl: (media: MediaFile) => Promise<string | null>;
}

function DiagnosisItem({
  diagnosis,
  audioMedia,
  colors,
  getAudioUrl,
}: DiagnosisItemProps) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Load audio URL when component mounts or audioMedia changes
  useEffect(() => {
    if (audioMedia) {
      getAudioUrl(audioMedia).then(setAudioUrl);
    } else {
      setAudioUrl(null);
    }
  }, [diagnosis.diagnosisId, audioMedia, getAudioUrl]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync().catch(console.error);
      }
    };
  }, [sound]);

  const handlePlayPause = useCallback(async () => {
    if (!audioUrl) {
      Alert.alert("Error", "Audio file not available");
      return;
    }

    try {
      if (isPlaying && sound) {
        await sound.pauseAsync();
        setIsPlaying(false);
      } else {
        setIsLoading(true);
        if (sound) {
          sound.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded && status.didJustFinish) {
              setIsPlaying(false);
            }
          });
          await sound.playAsync();
          setIsPlaying(true);
        } else {
          const { sound: newSound } = await Audio.Sound.createAsync(
            { uri: audioUrl },
            { shouldPlay: true },
          );
          setSound(newSound);
          setIsPlaying(true);

          newSound.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded && status.didJustFinish) {
              setIsPlaying(false);
            }
          });
        }
        setIsLoading(false);
      }
    } catch (error) {
      setIsLoading(false);
      Alert.alert("Error", "Failed to play audio");
      if (__DEV__) {
        console.error("Playback error:", error);
      }
    }
  }, [audioUrl, sound, isPlaying]);

  const handleStop = useCallback(async () => {
    if (sound) {
      await sound.stopAsync();
      setIsPlaying(false);
    }
  }, [sound]);

  return (
    <View style={[styles.diagnosisItem, { borderLeftColor: colors.primary }]}>
      <View style={styles.diagnosisHeader}>
        <Text
          style={[
            styles.diagnosisStatus,
            {
              color:
                diagnosis.status === "CONFIRMED"
                  ? colors.success
                  : colors.warning,
            },
          ]}
        >
          {diagnosis.status}
        </Text>
      </View>

      {/* Audio Playback Controls for Voice Recordings */}
      {audioMedia && (
        <View
          style={[
            styles.audioPlayerCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.audioPlayerHeader}>
            <TouchableOpacity
              style={[
                styles.playButton,
                {
                  backgroundColor: colors.primary,
                  opacity: audioUrl ? 1 : 0.5,
                },
              ]}
              onPress={handlePlayPause}
              disabled={!audioUrl || isLoading}
              activeOpacity={0.7}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <FontAwesome
                  name={isPlaying ? "pause" : "play"}
                  size={14}
                  color="#fff"
                  style={styles.playIcon}
                />
              )}
            </TouchableOpacity>

            <View style={styles.audioInfo}>
              <View style={styles.audioInfoRow}>
                <FontAwesome
                  name="microphone"
                  size={12}
                  color={colors.primary}
                />
                <Text
                  style={[styles.audioLabel, { color: colors.text }]}
                  numberOfLines={1}
                >
                  Voice Recording
                  {!audioUrl && (
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      {" "}
                      (Loading...)
                    </Text>
                  )}
                </Text>
              </View>
            </View>

            {isPlaying && (
              <TouchableOpacity
                style={[
                  styles.stopButton,
                  {
                    backgroundColor: colors.danger,
                  },
                ]}
                onPress={handleStop}
                activeOpacity={0.7}
              >
                <FontAwesome name="stop" size={12} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Diagnosis Text */}
      <Text style={[styles.diagnosisText, { color: colors.text }]}>
        {diagnosis.diagnosisText}
      </Text>
    </View>
  );
}

// Treatment Item Component with Audio Playback
interface TreatmentItemProps {
  treatment: CaseTreatment;
  audioMedia: MediaFile | null | undefined;
  colors: ReturnType<typeof useTheme>["colors"];
  getAudioUrl: (media: MediaFile) => Promise<string | null>;
  onEdit?: (treatment: CaseTreatment) => void;
}

function TreatmentItem({
  treatment,
  audioMedia,
  colors,
  getAudioUrl,
  onEdit,
}: TreatmentItemProps) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Load audio URL when component mounts or audioMedia changes
  useEffect(() => {
    if (audioMedia) {
      getAudioUrl(audioMedia).then(setAudioUrl);
    } else {
      setAudioUrl(null);
    }
  }, [treatment.treatmentId, audioMedia, getAudioUrl]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync().catch(console.error);
      }
    };
  }, [sound]);

  const handlePlayPause = useCallback(async () => {
    if (!audioUrl) {
      Alert.alert("Error", "Audio file not available");
      return;
    }

    try {
      if (isPlaying && sound) {
        await sound.pauseAsync();
        setIsPlaying(false);
      } else {
        setIsLoading(true);
        if (sound) {
          sound.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded && status.didJustFinish) {
              setIsPlaying(false);
            }
          });
          await sound.playAsync();
          setIsPlaying(true);
        } else {
          const { sound: newSound } = await Audio.Sound.createAsync(
            { uri: audioUrl },
            { shouldPlay: true },
          );
          setSound(newSound);
          setIsPlaying(true);

          newSound.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded && status.didJustFinish) {
              setIsPlaying(false);
            }
          });
        }
        setIsLoading(false);
      }
    } catch (error) {
      setIsLoading(false);
      Alert.alert("Error", "Failed to play audio");
      if (__DEV__) {
        console.error("Playback error:", error);
      }
    }
  }, [audioUrl, sound, isPlaying]);

  const handleStop = useCallback(async () => {
    if (sound) {
      await sound.stopAsync();
      setIsPlaying(false);
    }
  }, [sound]);

  return (
    <View style={[styles.treatmentItem, { borderLeftColor: colors.accent }]}>
      <View style={styles.treatmentHeader}>
        <Text style={[styles.treatmentType, { color: colors.primary }]}>
          {treatment.treatmentType || "Treatment"}
        </Text>
        <View style={styles.treatmentHeaderRight}>
          <Text
            style={[
              styles.treatmentStatus,
              {
                color:
                  treatment.treatmentStatus === "COMPLETED"
                    ? colors.success
                    : treatment.treatmentStatus === "STOPPED"
                      ? colors.danger
                      : colors.warning,
              },
            ]}
          >
            {treatment.treatmentStatus}
          </Text>
          {onEdit && (
            <TouchableOpacity
              onPress={() => onEdit(treatment)}
              style={[styles.editTreatmentBtn, { borderColor: colors.primary }]}
              activeOpacity={0.7}
            >
              <FontAwesome
                name="pencil"
                size={ICON_ACTION}
                color={colors.primary}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
      {treatment.medicineNameFree && (
        <Text style={[styles.treatmentText, { color: colors.text }]}>
          <Text style={styles.bold}>Medicine:</Text>{" "}
          {treatment.medicineNameFree}
        </Text>
      )}
      {treatment.dose && (
        <Text style={[styles.treatmentText, { color: colors.text }]}>
          <Text style={styles.bold}>Dose:</Text> {treatment.dose}
        </Text>
      )}
      {treatment.route && (
        <Text style={[styles.treatmentText, { color: colors.text }]}>
          <Text style={styles.bold}>Route:</Text> {treatment.route}
        </Text>
      )}
      {treatment.frequency && (
        <Text style={[styles.treatmentText, { color: colors.text }]}>
          <Text style={styles.bold}>Frequency:</Text> {treatment.frequency}
        </Text>
      )}
      {treatment.durationDays && (
        <Text style={[styles.treatmentText, { color: colors.text }]}>
          <Text style={styles.bold}>Duration:</Text> {treatment.durationDays}{" "}
          days
        </Text>
      )}

      {/* Audio Playback Controls for Voice Recordings */}
      {audioMedia && treatment.instructions && (
        <View
          style={[
            styles.audioPlayerCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              marginTop: 8,
            },
          ]}
        >
          <View style={styles.audioPlayerHeader}>
            <TouchableOpacity
              style={[
                styles.playButton,
                {
                  backgroundColor: colors.primary,
                  opacity: audioUrl ? 1 : 0.5,
                },
              ]}
              onPress={handlePlayPause}
              disabled={!audioUrl || isLoading}
              activeOpacity={0.7}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <FontAwesome
                  name={isPlaying ? "pause" : "play"}
                  size={14}
                  color="#fff"
                  style={styles.playIcon}
                />
              )}
            </TouchableOpacity>

            <View style={styles.audioInfo}>
              <View style={styles.audioInfoRow}>
                <FontAwesome
                  name="microphone"
                  size={12}
                  color={colors.primary}
                />
                <Text
                  style={[styles.audioLabel, { color: colors.text }]}
                  numberOfLines={1}
                >
                  Voice Instructions
                  {!audioUrl && (
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      {" "}
                      (Loading...)
                    </Text>
                  )}
                </Text>
              </View>
            </View>

            {isPlaying && (
              <TouchableOpacity
                style={[
                  styles.stopButton,
                  {
                    backgroundColor: colors.danger,
                  },
                ]}
                onPress={handleStop}
                activeOpacity={0.7}
              >
                <FontAwesome name="stop" size={12} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Instructions */}
      {treatment.instructions && (
        <Text
          style={[styles.treatmentText, { color: colors.text, marginTop: 4 }]}
        >
          <Text style={styles.bold}>Instructions:</Text>{" "}
          {treatment.instructions}
        </Text>
      )}
    </View>
  );
}

// Voice Note Item Component with Audio Playback
interface NoteItemProps {
  note: CaseNote;
  audioMedia: MediaFile | null | undefined;
  colors: ReturnType<typeof useTheme>["colors"];
  getAudioUrl: (media: MediaFile) => Promise<string | null>;
}

function NoteItem({ note, audioMedia, colors, getAudioUrl }: NoteItemProps) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Load audio URL when component mounts or audioMedia changes
  useEffect(() => {
    if (note.noteType === "VOICE_TRANSCRIPT") {
      if (audioMedia) {
        getAudioUrl(audioMedia).then(setAudioUrl);
      } else {
        // Reset audio URL if media is not found
        setAudioUrl(null);
      }
    }
  }, [note.noteId, audioMedia, getAudioUrl, note.noteType]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync().catch(console.error);
      }
    };
  }, [sound]);

  const handlePlayPause = useCallback(async () => {
    if (!audioUrl) {
      Alert.alert("Error", "Audio file not available");
      return;
    }

    try {
      if (isPlaying && sound) {
        await sound.pauseAsync();
        setIsPlaying(false);
      } else {
        setIsLoading(true);
        if (sound) {
          // Set up playback status updates for existing sound
          sound.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded && status.didJustFinish) {
              setIsPlaying(false);
            }
          });
          await sound.playAsync();
          setIsPlaying(true);
        } else {
          const { sound: newSound } = await Audio.Sound.createAsync(
            { uri: audioUrl },
            { shouldPlay: true },
          );
          setSound(newSound);
          setIsPlaying(true);

          // Set up playback status updates
          newSound.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded && status.didJustFinish) {
              setIsPlaying(false);
            }
          });
        }
        setIsLoading(false);
      }
    } catch (error) {
      setIsLoading(false);
      Alert.alert("Error", "Failed to play audio");
      if (__DEV__) {
        console.error("Playback error:", error);
      }
    }
  }, [audioUrl, sound, isPlaying]);

  const handleStop = useCallback(async () => {
    if (sound) {
      await sound.stopAsync();
      setIsPlaying(false);
    }
  }, [sound]);

  return (
    <View style={[styles.noteItem, { borderLeftColor: colors.primary }]}>
      <View style={styles.noteHeader}>
        <View style={styles.noteHeaderLeft}>
          <FontAwesome
            name={"file-text"}
            size={14}
            color={colors.primary}
            style={styles.noteIcon}
          />
          <Text style={[styles.noteType, { color: colors.primary }]}>
            Notes
          </Text>
        </View>
        <Text style={[styles.noteDate, { color: colors.muted }]}>
          {new Date(note.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>

      {/* Audio Playback Controls for Voice Transcripts */}
      {note.noteType === "VOICE_TRANSCRIPT" && (
        <View
          style={[
            styles.audioPlayerCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          {/* Main Play Button */}
          <View style={styles.audioPlayerHeader}>
            <TouchableOpacity
              style={[
                styles.playButton,
                {
                  backgroundColor: colors.primary,
                  opacity: audioUrl && audioMedia ? 1 : 0.5,
                },
              ]}
              onPress={handlePlayPause}
              disabled={!audioUrl || !audioMedia || isLoading}
              activeOpacity={0.7}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <FontAwesome
                  name={isPlaying ? "pause" : "play"}
                  size={14}
                  color="#fff"
                  style={styles.playIcon}
                />
              )}
            </TouchableOpacity>

            {/* Audio Info */}
            <View style={styles.audioInfo}>
              <View style={styles.audioInfoRow}>
                <FontAwesome
                  name="microphone"
                  size={12}
                  color={colors.primary}
                />
                <Text
                  style={[styles.audioLabel, { color: colors.text }]}
                  numberOfLines={1}
                >
                  Voice Recording
                  {!audioMedia && (
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      {" "}
                      (Loading...)
                    </Text>
                  )}
                </Text>
              </View>
            </View>

            {/* Stop Button (when playing) */}
            {isPlaying && (
              <TouchableOpacity
                style={[
                  styles.stopButton,
                  {
                    backgroundColor: colors.danger,
                  },
                ]}
                onPress={handleStop}
                activeOpacity={0.7}
              >
                <FontAwesome name="stop" size={12} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Note Text */}
      {note.noteText && (
        <Text style={[styles.noteText, { color: colors.text }]}>
          {note.noteText}
        </Text>
      )}
    </View>
  );
}
