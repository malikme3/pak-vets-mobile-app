import { useCallback, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Audio } from "expo-av";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useTheme } from "../theme/useTheme";
import { Button } from "../components/ui/Button";
import { useCase } from "../features/cases/hooks";
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
import {
  getBucketName,
  getDownloadSignedUrl,
} from "../services/sharedServicesApi";
import { caseDiagnosisApi, caseTreatmentApi } from "../services/vetApi";
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

function AccordionSection({ title, icon, count, expanded, onToggle, colors, children, action }: AccordionSectionProps) {
  return (
    <View style={[styles.accordionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <TouchableOpacity style={styles.accordionHeader} onPress={onToggle} activeOpacity={0.7}>
        <View style={styles.accordionTitleRow}>
          <FontAwesome name={icon} size={ICON_SECTION} color={colors.primary} style={styles.sectionIcon} />
          <Text style={[styles.accordionTitle, { color: colors.text }]}>{title}</Text>
          {count != null && count > 0 && (
            <View style={[styles.countBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.countBadgeText}>{count}</Text>
            </View>
          )}
        </View>
        <View style={styles.accordionRight}>
          {action}
          <FontAwesome name={expanded ? "chevron-up" : "chevron-down"} size={ICON_CHEVRON} color={colors.muted} />
        </View>
      </TouchableOpacity>
      {expanded && <View style={[styles.accordionBody, { borderTopColor: colors.border }]}>{children}</View>}
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
  const [imageUri, setImageUri] = useState<string | null>(media.fileType === "IMAGE" && media.url ? media.url : null);

  useEffect(() => {
    if (media.fileType === "IMAGE" && media.s3Key && !media.url) {
      getDownloadSignedUrl(getBucketName(), media.s3Key).then(setImageUri).catch(() => setImageUri(null));
    }
  }, [media.mediaId, media.s3Key, media.url, media.fileType]);

  const uri = media.fileType === "IMAGE" && media.url ? media.url : imageUri;
  return (
    <View style={styles.mediaItem}>
      {media.fileType === "IMAGE" && uri ? (
        <View style={[styles.imageWrapper, { backgroundColor: colors.border }]}>
          <Image source={{ uri }} style={styles.mediaImage} resizeMode="cover" onError={() => setImageUri(null)} />
        </View>
      ) : (
        <View style={[styles.mediaPlaceholder, { backgroundColor: colors.border }]}>
          <FontAwesome name="image" size={24} color={colors.muted} />
          <Text style={[styles.mediaType, { color: colors.text }]}>{media.fileType}</Text>
        </View>
      )}
      <Text style={[styles.mediaDate, { color: colors.muted }]}>
        {new Date(media.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
      </Text>
    </View>
  );
}

// Accordion sections - Case, Animal, Diagnoses expanded by default
type AccordionKey = "case" | "animal" | "diagnoses" | "treatments" | "notes" | "media";
const DEFAULT_EXPANDED: AccordionKey[] = ["case", "animal", "diagnoses"];

export default function CaseDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors } = useTheme();

  const caseId = params.caseId ? Number(params.caseId) : undefined;
  const [expanded, setExpanded] = useState<Record<AccordionKey, boolean>>(() =>
    Object.fromEntries(
      (["case", "animal", "diagnoses", "treatments", "notes", "media"] as AccordionKey[]).map((k) => [
        k,
        DEFAULT_EXPANDED.includes(k),
      ])
    ) as Record<AccordionKey, boolean>
  );
  const [suggestedDiagnoses, setSuggestedDiagnoses] = useState<
    DiagnosisSuggestion[]
  >([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsRequestedByUser, setSuggestionsRequestedByUser] = useState(false);
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

  // Fetch AI-suggested diagnoses only after user taps "Suggested diagnoses"
  useEffect(() => {
    if (!suggestionsRequestedByUser || !caseData?.chiefComplaint?.trim()) {
      if (!suggestionsRequestedByUser) setSuggestedDiagnoses([]);
      return;
    }
    let cancelled = false;
    setSuggestionsLoading(true);
    caseDiagnosisApi
      .suggestDiagnoses(caseData.chiefComplaint.trim())
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
  }, [suggestionsRequestedByUser, caseData?.caseId, caseData?.chiefComplaint]);

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
  const [treatmentSuggestionsByDiagnosisId, setTreatmentSuggestionsByDiagnosisId] =
    useState<Record<number, TreatmentSuggestion[]>>({});
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
    setTimeout(() => setExpanded((prev) => ({ ...prev, [key]: !prev[key] })), 50);
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
        const suggestions = await caseTreatmentApi.suggestTreatments(
          diagnosisPayload,
        );
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
    setTimeout(
      () => router.push({ pathname: "/add-treatment", params }),
      50,
    );
  }, [
    caseData?.caseId,
    diagnoses,
    suggestedDiagnoses,
  ]);

  // Open diagnosis form pre-filled for editing
  const handleEditDiagnosis = useCallback(
    (diagnosis: CaseDiagnosis) => {
      const params: Record<string, string> = {
        caseId: String(caseData?.caseId ?? ""),
        diagnosisId: String(diagnosis.diagnosisId),
        diagnosisText: diagnosis.diagnosisText ?? "",
        status: diagnosis.status,
      };
      setTimeout(
        () => router.push({ pathname: "/add-diagnosis", params }),
        50,
      );
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
      setTimeout(
        () => router.push({ pathname: "/add-treatment", params }),
        50,
      );
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
        {/* Compact header */}
        <View style={[styles.header, { borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 16 }]}>
          <Text style={[styles.headerDate, { color: colors.muted }]}>
            {caseData ? formatDate(caseData.caseDatetime) : ""}
          </Text>
          {caseData?.chiefComplaint && (
            <Text style={[styles.headerComplaint, { color: colors.text }]} numberOfLines={2}>
              {caseData.chiefComplaint}
            </Text>
          )}
          {animal && (
            <Text style={[styles.headerAnimal, { color: colors.primary }]}>
              {animal.species}
              {animal.breed ? ` · ${animal.breed}` : ""}
            </Text>
          )}
        </View>

        {/* 1. Case Information */}
        <AccordionSection
          title="Case"
          icon="calendar"
          expanded={expanded.case}
          onToggle={() => toggleSection("case")}
          colors={colors}
        >
          <View style={styles.infoRow}>
            <Text style={[styles.label, { color: colors.muted }]}>Date & Time</Text>
            <Text style={[styles.value, { color: colors.text }]}>{formatDate(caseData.caseDatetime)}</Text>
          </View>
          {caseData.chiefComplaint && (
            <View style={styles.infoRow}>
              <Text style={[styles.label, { color: colors.muted }]}>Chief Complaint</Text>
              <Text style={[styles.value, { color: colors.text }]}>{caseData.chiefComplaint}</Text>
            </View>
          )}
        </AccordionSection>

        {/* 2. Animal Information */}
        {animal && (
          <AccordionSection
            title="Animal"
            icon="paw"
            expanded={expanded.animal}
            onToggle={() => toggleSection("animal")}
            colors={colors}
          >
            <View style={styles.infoRow}>
              <Text style={[styles.label, { color: colors.muted }]}>Species</Text>
              <Text style={[styles.value, { color: colors.text }]}>{animal.species}</Text>
            </View>
            {animal.breed && (
              <View style={styles.infoRow}>
                <Text style={[styles.label, { color: colors.muted }]}>Breed</Text>
                <Text style={[styles.value, { color: colors.text }]}>{animal.breed}</Text>
              </View>
            )}
            {animal.tagId && (
              <View style={styles.infoRow}>
                <Text style={[styles.label, { color: colors.muted }]}>Tag ID</Text>
                <Text style={[styles.value, { color: colors.text }]}>{animal.tagId}</Text>
              </View>
            )}
            {animal.animalTagline && (
              <View style={styles.infoRow}>
                <Text style={[styles.label, { color: colors.muted }]}>Tagline</Text>
                <Text style={[styles.value, { color: colors.text }]}>{animal.animalTagline}</Text>
              </View>
            )}
            {animal.aiShortSummary && (
              <View style={[styles.aiSummaryBlock, { borderTopColor: colors.border }]}>
                <Text style={[styles.label, { color: colors.muted }]}>Short Summary</Text>
                <Text style={[styles.aiSummaryText, { color: colors.text }]} selectable>
                  {animal.aiShortSummary}
                </Text>
              </View>
            )}
            {animal.farmer?.fullName && (
              <View style={styles.infoRow}>
                <Text style={[styles.label, { color: colors.muted }]}>Farmer</Text>
                <Text style={[styles.value, { color: colors.text }]}>{animal.farmer.fullName}</Text>
              </View>
            )}
            {animal.farmer?.phoneNumber && (
              <View style={styles.infoRow}>
                <Text style={[styles.label, { color: colors.muted }]}>Phone</Text>
                <Text style={[styles.value, { color: colors.text }]}>{animal.farmer.phoneNumber}</Text>
              </View>
            )}
            {animal.aiSummary && (
              <View style={[styles.aiSummaryBlock, { borderTopColor: colors.border }]}>
                <Text style={[styles.label, { color: colors.muted }]}>AI Summary</Text>
                <Text style={[styles.aiSummaryText, { color: colors.text }]} selectable>
                  {animal.aiSummary}
                </Text>
              </View>
            )}
            <TouchableOpacity
              onPress={() => router.push(`/animal-details?animalId=${animal.animalId}`)}
              style={[styles.linkButton, { borderColor: colors.primary }]}
              activeOpacity={0.7}
            >
              <FontAwesome name="external-link" size={12} color={colors.primary} />
              <Text style={[styles.linkButtonText, { color: colors.primary }]}>View profile</Text>
            </TouchableOpacity>
          </AccordionSection>
        )}

        {/* 3. Diagnoses (with AI suggestions inline) */}
        <AccordionSection
          title="Diagnoses"
          icon="stethoscope"
          count={diagnoses.length}
          expanded={expanded.diagnoses}
          onToggle={() => toggleSection("diagnoses")}
          colors={colors}
          action={
            <TouchableOpacity
              onPress={() => router.push(`/add-diagnosis?caseId=${caseData?.caseId}`)}
              style={[styles.addChip, { backgroundColor: colors.primary }]}
              activeOpacity={0.8}
            >
              <FontAwesome name="plus" size={12} color={colors.surface} />
              <Text style={[styles.addChipText, { color: colors.surface }]}>Add</Text>
            </TouchableOpacity>
          }
        >
          {/* AI Suggestions (inline) */}
          {caseData.chiefComplaint?.trim() && (
            <View style={[styles.aiBlock, { backgroundColor: colors.background, borderColor: colors.border }]}>
              {!suggestionsRequestedByUser ? (
                <TouchableOpacity
                  onPress={() => setSuggestionsRequestedByUser(true)}
                  style={styles.aiCta}
                  activeOpacity={0.8}
                >
                  <FontAwesome name="lightbulb-o" size={16} color={colors.primary} />
                  <Text style={[styles.aiCtaText, { color: colors.primary }]}>Get AI suggestions</Text>
                  <FontAwesome name="chevron-right" size={12} color={colors.primary} />
                </TouchableOpacity>
              ) : suggestionsLoading ? (
                <View style={styles.aiLoading}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[styles.aiLoadingText, { color: colors.muted }]}>Suggesting…</Text>
                </View>
              ) : suggestedDiagnoses.length > 0 ? (
                <View style={styles.suggestionsList}>
                  <TouchableOpacity
                    style={styles.suggestionsListHeader}
                    onPress={() => setSuggestionsListExpanded((v) => !v)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.aiLabel, { color: colors.muted, marginBottom: 0 }]}>
                      Suggested ({suggestedDiagnoses.length})
                    </Text>
                    <FontAwesome
                      name={suggestionsListExpanded ? "chevron-up" : "chevron-down"}
                      size={14}
                      color={colors.muted}
                    />
                  </TouchableOpacity>
                  {suggestionsListExpanded && suggestedDiagnoses.map((s, index) => (
                    <View key={`${s.diagnosis_text}-${index}`} style={[styles.suggestionRow, { borderLeftColor: colors.primary, backgroundColor: colors.surface }]}>
                      <Text style={[styles.suggestionText, { color: colors.text }]} numberOfLines={3}>{s.diagnosis_text}</Text>
                      <View style={styles.suggestionRowFooter}>
                        <View style={[styles.statusBadge, { backgroundColor: s.status === "CONFIRMED" ? colors.success : colors.warning }]}>
                          <Text style={styles.statusBadgeText}>{s.status}</Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => handleConfirmSuggestion(s, index)}
                          disabled={confirmingSuggestionIndex !== null && confirmingSuggestionIndex !== index}
                          style={[styles.addChip, { backgroundColor: colors.success, opacity: confirmingSuggestionIndex !== null && confirmingSuggestionIndex !== index ? 0.5 : 1 }]}
                          activeOpacity={0.8}
                        >
                          {confirmingSuggestionIndex === index ? (
                            <ActivityIndicator size="small" color={colors.surface} />
                          ) : (
                            <>
                              <FontAwesome name="plus" size={10} color={colors.surface} />
                              <Text style={[styles.addChipText, { color: colors.surface }]}>Add</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={[styles.aiEmptyText, { color: colors.muted }]}>No AI suggestions found</Text>
              )}
            </View>
          )}

          {/* Saved diagnoses */}
          {diagnoses.length > 0 ? (
            <View style={styles.diagnosesList}>
              {diagnoses.map((diagnosis) => {
                const audioMedia = diagnosis.mediaId ? mediaFiles.find((m) => m.mediaId === diagnosis.mediaId) : null;
                const suggestedForThis = treatmentSuggestionsByDiagnosisId[diagnosis.diagnosisId] ?? [];
                const loadingTreatments = loadingTreatmentForDiagnosisId === diagnosis.diagnosisId;
                return (
                  <View key={diagnosis.diagnosisId} style={[styles.diagnosisBlock, { borderColor: colors.border }]}>
                    <View style={styles.diagnosisBlockRow}>
                      <View style={styles.diagnosisBlockContent}>
                        <DiagnosisItem diagnosis={diagnosis} audioMedia={audioMedia} colors={colors} getAudioUrl={getAudioUrl} />
                      </View>
                      <View style={styles.diagnosisBlockActions}>
                        <TouchableOpacity onPress={() => handleEditDiagnosis(diagnosis)} style={[styles.iconBtn, { borderColor: colors.primary }]} activeOpacity={0.7}>
                          <FontAwesome name="pencil" size={ICON_ACTION} color={colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleFetchTreatmentsForDiagnosis(diagnosis)}
                          disabled={loadingTreatmentForDiagnosisId !== null}
                          style={[styles.iconBtn, { borderColor: colors.primary, opacity: loadingTreatmentForDiagnosisId !== null ? 0.5 : 1 }]}
                          activeOpacity={0.7}
                        >
                          {loadingTreatments ? <ActivityIndicator size="small" color={colors.primary} /> : <FontAwesome name="medkit" size={ICON_ACTION} color={colors.primary} />}
                        </TouchableOpacity>
                      </View>
                    </View>
                    {suggestedForThis.length > 0 && (
                      <View style={[styles.suggestedTreatmentsContainer, { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1 }]}>
                        <Text style={[styles.suggestedTreatmentsTitle, { color: colors.muted }]}>Suggested treatments</Text>
                        {suggestedForThis.map((sug, idx) => {
                          const confirmKey = `${diagnosis.diagnosisId}-${idx}`;
                          const isConfirming = confirmingTreatmentKey === confirmKey;
                          return (
                            <View key={idx} style={[styles.suggestedTreatmentRow, { borderLeftColor: colors.accent }]}>
                              <View style={styles.suggestedTreatmentRowContent}>
                                <Text style={[styles.suggestedTreatmentType, { color: colors.primary }]}>{sug.treatmentType}</Text>
                                {sug.medicineNameFree?.trim() && <Text style={[styles.suggestedTreatmentLine, { color: colors.text }]}><Text style={styles.bold}>Medicine: </Text>{sug.medicineNameFree}</Text>}
                                {sug.dose?.trim() && <Text style={[styles.suggestedTreatmentLine, { color: colors.text }]}><Text style={styles.bold}>Dose: </Text>{sug.dose}</Text>}
                                {sug.route?.trim() && <Text style={[styles.suggestedTreatmentLine, { color: colors.text }]}><Text style={styles.bold}>Route: </Text>{sug.route}</Text>}
                                {sug.frequency?.trim() && <Text style={[styles.suggestedTreatmentLine, { color: colors.text }]}><Text style={styles.bold}>Frequency: </Text>{sug.frequency}</Text>}
                                {sug.durationDays != null && <Text style={[styles.suggestedTreatmentLine, { color: colors.text }]}><Text style={styles.bold}>Duration: </Text>{sug.durationDays} days</Text>}
                                {sug.instructions?.trim() && <Text style={[styles.suggestedTreatmentLine, styles.suggestedTreatmentInstructions, { color: colors.text }]} numberOfLines={3}><Text style={styles.bold}>Instructions: </Text>{sug.instructions}</Text>}
                              </View>
                              <TouchableOpacity
                                onPress={() => handleConfirmTreatmentSuggestion(diagnosis.diagnosisId, sug, idx)}
                                disabled={confirmingTreatmentKey !== null && confirmingTreatmentKey !== confirmKey}
                                style={[styles.iconBtn, { borderColor: colors.success, opacity: confirmingTreatmentKey !== null && confirmingTreatmentKey !== confirmKey ? 0.5 : 1 }]}
                                activeOpacity={0.7}
                              >
                                {isConfirming ? <ActivityIndicator size="small" color={colors.success} /> : <FontAwesome name="check-circle" size={ICON_ACTION} color={colors.success} />}
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
              <FontAwesome name="clipboard" size={ICON_EMPTY} color={colors.muted} style={styles.emptyIcon} />
              <Text style={[styles.emptyText, { color: colors.muted }]}>No diagnoses yet</Text>
              <Text style={[styles.emptySubtext, { color: colors.muted }]}>Add from AI suggestions above or tap Add</Text>
            </View>
          )}
        </AccordionSection>

        {/* 4. Treatments */}
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
              style={[styles.addChip, { backgroundColor: colors.primary, opacity: treatmentSuggestionsLoading ? 0.6 : 1 }]}
              activeOpacity={0.8}
            >
              {treatmentSuggestionsLoading ? <ActivityIndicator size="small" color={colors.surface} /> : <FontAwesome name="plus" size={12} color={colors.surface} />}
              <Text style={[styles.addChipText, { color: colors.surface }]}>{treatmentSuggestionsLoading ? "…" : "Add"}</Text>
            </TouchableOpacity>
          }
        >
          {treatments.length > 0 ? (
            <View style={styles.listContainer}>
              {treatments.map((treatment) => {
                const audioMedia = treatment.mediaId ? mediaFiles.find((m) => m.mediaId === treatment.mediaId) : null;
                return (
                  <TreatmentItem key={treatment.treatmentId} treatment={treatment} audioMedia={audioMedia} colors={colors} getAudioUrl={getAudioUrl} onEdit={handleEditTreatment} />
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <FontAwesome name="medkit" size={ICON_EMPTY} color={colors.muted} style={styles.emptyIcon} />
              <Text style={[styles.emptyText, { color: colors.muted }]}>No treatments yet</Text>
            </View>
          )}
        </AccordionSection>

        {/* 5. Notes */}
        <AccordionSection
          title="Notes"
          icon="file-text-o"
          count={notes.length}
          expanded={expanded.notes}
          onToggle={() => toggleSection("notes")}
          colors={colors}
          action={
            <TouchableOpacity
              onPress={() => router.push(`/add-note?caseId=${caseData?.caseId}`)}
              style={[styles.addChip, { backgroundColor: colors.primary }]}
              activeOpacity={0.8}
            >
              <FontAwesome name="plus" size={12} color={colors.surface} />
              <Text style={[styles.addChipText, { color: colors.surface }]}>Add</Text>
            </TouchableOpacity>
          }
        >
          {notes.length > 0 ? (
            <View style={styles.listContainer}>
              {notes.map((note) => {
                let audioMedia: MediaFile | null | undefined = null;
                if (note.noteType === "VOICE_TRANSCRIPT") {
                  if (note.mediaId) audioMedia = mediaFiles.find((m) => m.mediaId === note.mediaId);
                  if (!audioMedia && caseId) {
                    const audioFiles = mediaFiles.filter((m) => m.fileType === "AUDIO" && m.caseId === caseId && m.s3Key?.includes(`cases/${caseId}/audio/`));
                    if (audioFiles.length > 0) {
                      const noteCreatedAt = new Date(note.createdAt).getTime();
                      audioMedia = audioFiles.reduce((closest, current) => {
                        const currentDiff = Math.abs(new Date(current.createdAt).getTime() - noteCreatedAt);
                        const closestDiff = Math.abs(new Date(closest.createdAt).getTime() - noteCreatedAt);
                        return currentDiff < closestDiff ? current : closest;
                      });
                    }
                  }
                }
                return <NoteItem key={note.noteId} note={note} audioMedia={audioMedia} colors={colors} getAudioUrl={getAudioUrl} />;
              })}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <FontAwesome name="file-text-o" size={ICON_EMPTY} color={colors.muted} style={styles.emptyIcon} />
              <Text style={[styles.emptyText, { color: colors.muted }]}>No notes yet</Text>
            </View>
          )}
        </AccordionSection>

        {/* 6. Media */}
        <AccordionSection
          title="Media"
          icon="image"
          count={mediaFiles.length}
          expanded={expanded.media}
          onToggle={() => toggleSection("media")}
          colors={colors}
          action={
            <TouchableOpacity
              onPress={() => router.push(`/add-media?caseId=${caseData?.caseId}`)}
              style={[styles.addChip, { backgroundColor: colors.primary }]}
              activeOpacity={0.8}
            >
              <FontAwesome name="plus" size={12} color={colors.surface} />
              <Text style={[styles.addChipText, { color: colors.surface }]}>Upload</Text>
            </TouchableOpacity>
          }
        >
          {mediaFiles.length > 0 ? (
            <View style={styles.mediaContainer}>
              {mediaFiles.map((media) => (
                <MediaThumbnail key={media.mediaId} media={media} colors={colors} getBucketName={getBucketName} getDownloadSignedUrl={getDownloadSignedUrl} />
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <FontAwesome name="image" size={ICON_EMPTY} color={colors.muted} style={styles.emptyIcon} />
              <Text style={[styles.emptyText, { color: colors.muted }]}>No media yet</Text>
            </View>
          )}
        </AccordionSection>

        {/* Save / Done - redirect to home */}
        <Button
          title="Save"
          onPress={() => router.replace("/")}
          variant="primary"
          style={styles.saveButton}
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
  header: {
    marginBottom: 20,
  },
  headerDate: {
    fontSize: 13,
    marginBottom: 4,
  },
  headerComplaint: {
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 24,
    marginBottom: 4,
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
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  linkButtonText: {
    fontSize: 14,
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
    <View
      style={[styles.diagnosisItem, { borderLeftColor: colors.primary }]}
    >
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
              style={[
                styles.editTreatmentBtn,
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
          style={[
            styles.treatmentText,
            { color: colors.text, marginTop: 4 },
          ]}
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
            name={
              "file-text"
            }
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
