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
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { useVisit } from "../features/visits/hooks";
import { useAnimal } from "../features/animals/hooks";
import {
  useVisitDiagnoses,
  useCreateVisitDiagnosis,
} from "../features/diagnoses/hooks";
import {
  useVisitTreatments,
  useCreateVisitTreatment,
} from "../features/treatments/hooks";
import { useVisitNotes } from "../features/notes/hooks";
import { useMediaFilesByVisit } from "../features/media/hooks";
import {
  getBucketName,
  getDownloadSignedUrl,
} from "../services/sharedServicesApi";
import { visitDiagnosisApi, visitTreatmentApi } from "../services/vetApi";
import type {
  VisitDiagnosis,
  VisitTreatment,
  VisitNote,
  MediaFile,
  DiagnosisSuggestion,
  TreatmentSuggestion,
} from "../types/api";

// Design system: consistent icon sizes across visit detail (fonts in StyleSheet)
const ICON_SECTION = 16;
const ICON_CHEVRON = 16;
const ICON_ACTION = 16;
const ICON_EMPTY = 28;

export default function VisitDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors } = useTheme();

  const visitId = params.visitId ? Number(params.visitId) : undefined;
  const [visitInfoExpanded, setVisitInfoExpanded] = useState(false);
  const [animalInfoExpanded, setAnimalInfoExpanded] = useState(false);
  const [suggestedDiagnoses, setSuggestedDiagnoses] = useState<
    DiagnosisSuggestion[]
  >([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const { data: visit, isLoading: visitLoading } = useVisit(visitId || 0);
  const { data: animal, isLoading: animalLoading } = useAnimal(
    visit?.animalId || 0,
  );
  const {
    data: diagnoses = [],
    isLoading: diagnosesLoading,
    refetch: refetchDiagnoses,
  } = useVisitDiagnoses(visitId || 0);
  const createDiagnosisMutation = useCreateVisitDiagnosis();
  const {
    data: treatments = [],
    isLoading: treatmentsLoading,
    refetch: refetchTreatments,
  } = useVisitTreatments(visitId || 0);
  const createTreatmentMutation = useCreateVisitTreatment();
  const {
    data: notes = [],
    isLoading: notesLoading,
    refetch: refetchNotes,
  } = useVisitNotes(visitId || 0);
  const {
    data: mediaFiles = [],
    isLoading: mediaLoading,
    refetch: refetchMedia,
  } = useMediaFilesByVisit(visitId || 0);

  // Fetch AI-suggested diagnoses when visit has chief complaint
  useEffect(() => {
    if (!visit?.chiefComplaint?.trim()) {
      setSuggestedDiagnoses([]);
      return;
    }
    let cancelled = false;
    setSuggestionsLoading(true);
    visitDiagnosisApi
      .suggestDiagnoses(visit.chiefComplaint.trim())
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
  }, [visit?.visitId, visit?.chiefComplaint]);

  // Refetch diagnoses, treatments, notes, and media when screen comes into focus (e.g., after adding)
  useFocusEffect(
    useCallback(() => {
      if (visitId) {
        refetchDiagnoses();
        refetchTreatments();
        refetchNotes();
        refetchMedia();
      }
    }, [
      visitId,
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
      const vid = visit?.visitId;
      if (!vid) return;
      setConfirmingSuggestionIndex(index);
      try {
        await createDiagnosisMutation.mutateAsync({
          visitId: vid,
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
    [visit?.visitId, createDiagnosisMutation, refetchDiagnoses],
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
    async (diagnosis: VisitDiagnosis) => {
      const vid = visit?.visitId;
      if (!vid) return;
      setLoadingTreatmentForDiagnosisId(diagnosis.diagnosisId);
      try {
        const suggestions = await visitTreatmentApi.suggestTreatments([
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
    [visit?.visitId],
  );

  const handleConfirmTreatmentSuggestion = useCallback(
    async (
      diagnosisId: number,
      suggestion: TreatmentSuggestion,
      index: number,
    ) => {
      const vid = visit?.visitId;
      if (!vid) return;
      const key = `${diagnosisId}-${index}`;
      setConfirmingTreatmentKey(key);
      try {
        await createTreatmentMutation.mutateAsync({
          visitId: vid,
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
    [visit?.visitId, createTreatmentMutation, refetchTreatments],
  );

  const isLoading =
    visitLoading ||
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

  // ScrollView-safe press (guideline: avoid onPress cancel inside ScrollView)
  const handleToggleVisitInfo = useCallback(() => {
    setTimeout(() => setVisitInfoExpanded((v) => !v), 50);
  }, []);
  const handleToggleAnimalInfo = useCallback(() => {
    setTimeout(() => setAnimalInfoExpanded((v) => !v), 50);
  }, []);

  // Add Treatment: suggest from diagnoses (saved or AI), then navigate with first suggestion to pre-fill
  const [treatmentSuggestionsLoading, setTreatmentSuggestionsLoading] =
    useState(false);
  const handleAddTreatment = useCallback(async () => {
    const vid = visit?.visitId;
    if (!vid) return;
    const diagnosisPayload = (
      diagnoses.length > 0 ? diagnoses : suggestedDiagnoses
    ).map((d) => ({
      diagnosis_text:
        "diagnosis_text" in d ? d.diagnosis_text : d.diagnosisText,
      status: d.status,
    }));
    const params: Record<string, string> = { visitId: String(vid) };
    if (diagnosisPayload.length > 0) {
      setTreatmentSuggestionsLoading(true);
      try {
        const suggestions = await visitTreatmentApi.suggestTreatments(
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
    visit?.visitId,
    diagnoses,
    suggestedDiagnoses,
  ]);

  // Open diagnosis form pre-filled for editing
  const handleEditDiagnosis = useCallback(
    (diagnosis: VisitDiagnosis) => {
      const params: Record<string, string> = {
        visitId: String(visit?.visitId ?? ""),
        diagnosisId: String(diagnosis.diagnosisId),
        diagnosisText: diagnosis.diagnosisText ?? "",
        status: diagnosis.status,
      };
      setTimeout(
        () => router.push({ pathname: "/add-diagnosis", params }),
        50,
      );
    },
    [visit?.visitId],
  );

  // Open treatment form pre-filled for editing
  const handleEditTreatment = useCallback(
    (treatment: VisitTreatment) => {
      const params: Record<string, string> = {
        visitId: String(visit?.visitId ?? ""),
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
    [visit?.visitId],
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

  if (!visit) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <StatusBar style="auto" />
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.text }]}>
            Visit not found
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
        <Text style={[styles.title, { color: colors.text }]}>
          Visit Details
        </Text>

        {/* Visit Information (accordion) */}
        <Card style={styles.card}>
          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={handleToggleVisitInfo}
            activeOpacity={0.7}
          >
            <View style={styles.accordionTitleRow}>
              <FontAwesome name="calendar" size={ICON_SECTION} color={colors.primary} style={styles.sectionIcon} />
              <Text style={[styles.accordionTitle, { color: colors.text }]}>
                Visit Information
              </Text>
            </View>
            <FontAwesome
              name={visitInfoExpanded ? "chevron-up" : "chevron-down"}
              size={ICON_CHEVRON}
              color={colors.muted}
            />
          </TouchableOpacity>
          {visitInfoExpanded && (
            <View style={styles.accordionBody}>
              <View style={styles.infoRow}>
                <Text style={[styles.label, { color: colors.muted }]}>
                  Date & Time
                </Text>
                <Text style={[styles.value, { color: colors.text }]}>
                  {formatDate(visit.visitDatetime)}
                </Text>
              </View>
              {visit.chiefComplaint && (
                <View style={styles.infoRow}>
                  <Text style={[styles.label, { color: colors.muted }]}>
                    Chief Complaint
                  </Text>
                  <Text style={[styles.value, { color: colors.text }]}>
                    {visit.chiefComplaint}
                  </Text>
                </View>
              )}
            </View>
          )}
        </Card>

        {/* Animal Information (accordion) */}
        {animal && (
          <Card style={styles.card}>
            <TouchableOpacity
              style={styles.accordionHeader}
              onPress={handleToggleAnimalInfo}
              activeOpacity={0.7}
            >
              <View style={styles.accordionTitleRow}>
                <FontAwesome name="paw" size={ICON_SECTION} color={colors.primary} style={styles.sectionIcon} />
                <Text style={[styles.accordionTitle, { color: colors.text }]}>
                  Animal Information
                </Text>
              </View>
              <FontAwesome
                name={animalInfoExpanded ? "chevron-up" : "chevron-down"}
                size={ICON_CHEVRON}
                color={colors.muted}
              />
            </TouchableOpacity>
            {animalInfoExpanded && (
              <View style={styles.accordionBody}>
                <View style={styles.infoRow}>
                  <Text style={[styles.label, { color: colors.muted }]}>
                    Species
                  </Text>
                  <Text style={[styles.value, { color: colors.text }]}>
                    {animal.species}
                  </Text>
                </View>
                {animal.breed && (
                  <View style={styles.infoRow}>
                    <Text style={[styles.label, { color: colors.muted }]}>
                      Breed
                    </Text>
                    <Text style={[styles.value, { color: colors.text }]}>
                      {animal.breed}
                    </Text>
                  </View>
                )}
                {animal.tagId && (
                  <View style={styles.infoRow}>
                    <Text style={[styles.label, { color: colors.muted }]}>
                      Tag ID
                    </Text>
                    <Text style={[styles.value, { color: colors.text }]}>
                      {animal.tagId}
                    </Text>
                  </View>
                )}
                {animal.ownerName && (
                  <View style={styles.infoRow}>
                    <Text style={[styles.label, { color: colors.muted }]}>
                      Owner
                    </Text>
                    <Text style={[styles.value, { color: colors.text }]}>
                      {animal.ownerName}
                    </Text>
                  </View>
                )}
                {animal.ownerPhone && (
                  <View style={styles.infoRow}>
                    <Text style={[styles.label, { color: colors.muted }]}>
                      Owner Phone
                    </Text>
                    <Text style={[styles.value, { color: colors.text }]}>
                      {animal.ownerPhone}
                    </Text>
                  </View>
                )}
                <Button
                  title="View Animal Profile"
                  onPress={() =>
                    router.push(`/animal-details?animalId=${animal.animalId}`)
                  }
                  variant="secondary"
                  style={styles.actionButton}
                />
              </View>
            )}
          </Card>
        )}

        {/* Suggested diagnoses (from chief complaint) */}
        {visit.chiefComplaint?.trim() && (
          <Card style={styles.card}>
            <View style={[styles.sectionTitleRow, styles.sectionTitleRowStandalone]}>
              <FontAwesome name="lightbulb-o" size={ICON_SECTION} color={colors.primary} style={styles.sectionIcon} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Suggested diagnoses
              </Text>
            </View>
            {suggestionsLoading ? (
              <View style={styles.suggestionsLoading}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.suggestionsLoadingText, { color: colors.muted }]}>
                  AI suggesting based on chief complaint…
                </Text>
              </View>
            ) : suggestedDiagnoses.length > 0 ? (
              <View style={styles.listContainer}>
                {suggestedDiagnoses.map((s, index) => (
                  <View
                    key={`${s.diagnosis_text}-${index}`}
                    style={[
                      styles.suggestionRow,
                      { borderLeftColor: colors.primary },
                    ]}
                  >
                    <View style={styles.suggestionRowContent}>
                      <Text
                        style={[styles.diagnosisText, { color: colors.text }]}
                        numberOfLines={3}
                      >
                        {s.diagnosis_text}
                      </Text>
                      <Text
                        style={[
                          styles.diagnosisStatus,
                          {
                            color:
                              s.status === "CONFIRMED"
                                ? colors.success
                                : colors.warning,
                          },
                        ]}
                      >
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
                        styles.suggestionYesButton,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.success,
                          opacity:
                            confirmingSuggestionIndex !== null &&
                              confirmingSuggestionIndex !== index
                              ? 0.5
                              : 1,
                        },
                      ]}
                      activeOpacity={0.7}
                    >
                      {confirmingSuggestionIndex === index ? (
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
                ))}
              </View>
            ) : null}
          </Card>
        )}

        {/* Diagnoses Section (saved); "Add Diagnosis" only when no suggestions) */}
        <Card style={styles.card}>
          <View style={styles.diagnosesSectionHeader}>
            <View style={styles.sectionTitleRow}>
              <FontAwesome name="stethoscope" size={ICON_SECTION} color={colors.primary} style={styles.sectionIcon} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Diagnoses
              </Text>
            </View>
            {suggestedDiagnoses.length === 0 && (
              <Button
                title="Add Diagnosis"
                onPress={() => {
                  router.push(`/add-diagnosis?visitId=${visit?.visitId}`);
                }}
                variant="secondary"
                style={styles.addButton}
              />
            )}
          </View>
          {diagnoses.length > 0 ? (
            <View style={styles.diagnosesList}>
              {diagnoses.map((diagnosis) => {
                const audioMedia = diagnosis.mediaId
                  ? mediaFiles.find((m) => m.mediaId === diagnosis.mediaId)
                  : null;
                const suggestedForThis =
                  treatmentSuggestionsByDiagnosisId[diagnosis.diagnosisId] ?? [];
                const loadingTreatments =
                  loadingTreatmentForDiagnosisId === diagnosis.diagnosisId;

                return (
                  <View
                    key={diagnosis.diagnosisId}
                    style={[styles.diagnosisBlock, { backgroundColor: colors.surface, borderColor: colors.border }]}
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
                            styles.editDiagnosisBtn,
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
                            styles.getTreatmentsIconBtn,
                            {
                              borderColor: colors.primary,
                              opacity:
                                loadingTreatmentForDiagnosisId !== null ? 0.5 : 1,
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
                      <View style={[styles.suggestedTreatmentsContainer, { backgroundColor: colors.background }]}>
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
                                {
                                  backgroundColor: colors.surface,
                                  borderLeftColor: colors.accent,
                                },
                              ]}
                            >
                              <View
                                style={
                                  styles.suggestedTreatmentRowContent
                                }
                              >
                                <Text
                                  style={[
                                    styles.suggestedTreatmentType,
                                    { color: colors.primary },
                                  ]}
                                >
                                  {sug.treatmentType}
                                </Text>
                                {sug.medicineNameFree != null && sug.medicineNameFree.trim() !== "" && (
                                  <Text style={[styles.suggestedTreatmentLine, { color: colors.text }]}>
                                    <Text style={styles.suggestedTreatmentLabel}>Medicine: </Text>
                                    {sug.medicineNameFree}
                                  </Text>
                                )}
                                {sug.dose != null && sug.dose.trim() !== "" && (
                                  <Text style={[styles.suggestedTreatmentLine, { color: colors.text }]}>
                                    <Text style={styles.suggestedTreatmentLabel}>Dose: </Text>
                                    {sug.dose}
                                  </Text>
                                )}
                                {sug.route != null && sug.route.trim() !== "" && (
                                  <Text style={[styles.suggestedTreatmentLine, { color: colors.text }]}>
                                    <Text style={styles.suggestedTreatmentLabel}>Route: </Text>
                                    {sug.route}
                                  </Text>
                                )}
                                {sug.frequency != null && sug.frequency.trim() !== "" && (
                                  <Text style={[styles.suggestedTreatmentLine, { color: colors.text }]}>
                                    <Text style={styles.suggestedTreatmentLabel}>Frequency: </Text>
                                    {sug.frequency}
                                  </Text>
                                )}
                                {sug.durationDays != null && (
                                  <Text style={[styles.suggestedTreatmentLine, { color: colors.text }]}>
                                    <Text style={styles.suggestedTreatmentLabel}>Duration: </Text>
                                    {sug.durationDays} days
                                  </Text>
                                )}
                                {sug.instructions != null && sug.instructions.trim() !== "" && (
                                  <Text
                                    style={[styles.suggestedTreatmentLine, styles.suggestedTreatmentInstructions, { color: colors.text }]}
                                    numberOfLines={4}
                                  >
                                    <Text style={styles.suggestedTreatmentLabel}>Instructions: </Text>
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
                                  styles.suggestionIconBtn,
                                  {
                                    borderColor: colors.success,
                                    backgroundColor: colors.surface,
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
            <View style={styles.diagnosesEmptyState}>
              <FontAwesome name="clipboard" size={ICON_EMPTY} color={colors.muted} style={styles.emptyIcon} />
              <Text style={[styles.emptyText, { color: colors.muted }]}>
                No diagnoses yet
              </Text>
              <Text style={[styles.emptySubtext, { color: colors.muted }]}>
                Add from suggestions above or tap Add Diagnosis
              </Text>
            </View>
          )}
        </Card>

        {/* Treatments Section */}
        <Card style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <FontAwesome name="medkit" size={ICON_SECTION} color={colors.primary} style={styles.sectionIcon} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Treatments
              </Text>
            </View>
            <Button
              title={
                treatmentSuggestionsLoading ? "Suggesting…" : "Add Treatment"
              }
              onPress={handleAddTreatment}
              variant="secondary"
              style={styles.addButton}
              disabled={treatmentSuggestionsLoading}
              loading={treatmentSuggestionsLoading}
            />
          </View>
          {treatments.length > 0 ? (
            <View style={styles.listContainer}>
              {treatments.map((treatment) => {
                // Find associated audio media file
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
              <FontAwesome name="medkit" size={ICON_EMPTY} color={colors.muted} style={styles.emptyIcon} />
              <Text style={[styles.emptyText, { color: colors.muted }]}>
                No treatments added yet
              </Text>
              <Text style={[styles.emptySubtext, { color: colors.muted }]}>
                Treatments are optional
              </Text>
            </View>
          )}
        </Card>

        {/* Notes Section */}
        <Card style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <FontAwesome name="file-text-o" size={ICON_SECTION} color={colors.primary} style={styles.sectionIcon} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Notes
              </Text>
            </View>
            <Button
              title="Add Note"
              onPress={() => {
                router.push(`/add-note?visitId=${visit?.visitId}`);
              }}
              variant="secondary"
              style={styles.addButton}
            />
          </View>
          {notes.length > 0 ? (
            <View style={styles.listContainer}>
              {notes.map((note) => {
                // Find associated media file for voice transcripts
                let audioMedia: MediaFile | null | undefined = null;

                if (note.noteType === "VOICE_TRANSCRIPT") {
                  // First try to find by mediaId (for new notes)
                  if (note.mediaId) {
                    audioMedia = mediaFiles.find(
                      (m) => m.mediaId === note.mediaId,
                    );
                  }

                  // Fallback: Find audio files for this visit that match the pattern
                  // Voice recordings are stored as visits/{visitId}/audio/{timestamp}-{random}.m4a
                  if (!audioMedia && visitId) {
                    const audioFiles = mediaFiles.filter(
                      (m) =>
                        m.fileType === "AUDIO" &&
                        m.visitId === visitId &&
                        m.s3Key?.includes(`visits/${visitId}/audio/`),
                    );
                    // If there's only one audio file for this visit, use it
                    // Otherwise, try to match by creation time (closest to note creation time)
                    if (audioFiles.length > 0) {
                      const noteCreatedAt = new Date(note.createdAt).getTime();
                      audioMedia =
                        audioFiles.reduce((closest, current) => {
                          const currentTime = new Date(
                            current.createdAt,
                          ).getTime();
                          const closestTime = new Date(
                            closest.createdAt,
                          ).getTime();
                          const currentDiff = Math.abs(
                            currentTime - noteCreatedAt,
                          );
                          const closestDiff = Math.abs(
                            closestTime - noteCreatedAt,
                          );
                          return currentDiff < closestDiff ? current : closest;
                        }) || audioFiles[0];
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
              <FontAwesome name="file-text-o" size={ICON_EMPTY} color={colors.muted} style={styles.emptyIcon} />
              <Text style={[styles.emptyText, { color: colors.muted }]}>
                No notes added yet
              </Text>
            </View>
          )}
        </Card>

        {/* Media Section */}
        <Card style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <FontAwesome name="image" size={ICON_SECTION} color={colors.primary} style={styles.sectionIcon} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Media
              </Text>
            </View>
            <Button
              title="Upload Media"
              onPress={() => {
                router.push(`/add-media?visitId=${visit?.visitId}`);
              }}
              variant="secondary"
              style={styles.addButton}
            />
          </View>
          {mediaFiles.length > 0 ? (
            <View style={styles.mediaContainer}>
              {mediaFiles.map((media) => {
                // Determine image URI - prefer url (which may be local file:// URI), fallback to s3Key-based URL
                const imageUri =
                  media.fileType === "IMAGE" && media.url
                    ? media.url
                    : media.fileType === "IMAGE" && media.s3Key
                      ? `https://your-s3-bucket.s3.amazonaws.com/${media.s3Key}` // TODO: Replace with actual S3 bucket URL
                      : null;

                return (
                  <View key={media.mediaId} style={styles.mediaItem}>
                    {media.fileType === "IMAGE" && imageUri ? (
                      <View
                        style={[
                          styles.imageWrapper,
                          { backgroundColor: colors.border },
                        ]}
                      >
                        <Image
                          source={{ uri: imageUri }}
                          style={styles.mediaImage}
                          resizeMode="cover"
                          onError={(error) => {
                            console.warn(
                              "Failed to load image:",
                              imageUri,
                              error,
                            );
                          }}
                        />
                        <View
                          style={[
                            styles.imageOverlay,
                            { backgroundColor: colors.overlay },
                          ]}
                        >
                          <Text
                            style={[
                              styles.imageLabel,
                              { color: colors.surface },
                            ]}
                          >
                            IMAGE
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <View
                        style={[
                          styles.mediaPlaceholder,
                          { backgroundColor: colors.border },
                        ]}
                      >
                        <Text
                          style={[styles.mediaType, { color: colors.text }]}
                        >
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
              })}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <FontAwesome name="image" size={ICON_EMPTY} color={colors.muted} style={styles.emptyIcon} />
              <Text style={[styles.emptyText, { color: colors.muted }]}>
                No media uploaded yet
              </Text>
            </View>
          )}
        </Card>
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
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 20,
  },
  card: {
    marginBottom: 14,
  },
  accordionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 0,
    minHeight: 44,
  },
  accordionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  accordionTitle: {
    fontSize: 17,
    fontWeight: "600",
    marginBottom: 0,
  },
  accordionBody: {
    marginTop: 12,
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
    marginBottom: 12,
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
  actionButton: {
    marginTop: 12,
  },
  emptyState: {
    paddingVertical: 24,
    alignItems: "center",
  },
  emptyIcon: {
    marginBottom: 10,
    opacity: 0.6,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: "500",
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 13,
    textAlign: "center",
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
    gap: 8,
    paddingVertical: 12,
  },
  suggestionsLoadingText: {
    fontSize: 13,
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 6,
    borderLeftWidth: 3,
    backgroundColor: "transparent",
  },
  suggestionRowContent: {
    flex: 1,
    marginRight: 10,
    minWidth: 0,
  },
  suggestionYesButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
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
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
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
  diagnosis: VisitDiagnosis;
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
  treatment: VisitTreatment;
  audioMedia: MediaFile | null | undefined;
  colors: ReturnType<typeof useTheme>["colors"];
  getAudioUrl: (media: MediaFile) => Promise<string | null>;
  onEdit?: (treatment: VisitTreatment) => void;
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
  note: VisitNote;
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
