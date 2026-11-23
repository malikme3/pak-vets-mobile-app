import { farmCard } from "../features/farm-vitals/presentation";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FlowPageHeading } from "../features/farm-vitals/flow-page-heading";
import { breedEntryTemplate } from "../features/farm-vitals/breed-entry";
import {
  singleEntryHeading,
  TemplateEntryForm,
} from "../features/farm-vitals/template-entry";
import {
  addAnimalHistory,
  formTypeTitle,
  getActiveTemplate,
  getAnimalHistoryDraft,
  getFarmReview,
  updateAnimalHistory,
  type ActiveFarmTemplate,
} from "../services/farmVitalsApi";

const colors = {
  background: "#F8F8F2",
  ink: "#173D32",
  muted: "#63766C",
  green: "#1E7F5C",
  danger: "#B42318",
};

function historyKind(value: string | undefined): string | null {
  if (
    value &&
    /^[a-z][a-z0-9_-]{0,39}$/.test(value) &&
    !/[-_]$/.test(value) &&
    !/[-_]{2}/.test(value)
  )
    return value;
  return null;
}

export default function AddFarmHistoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    farmId?: string;
    animalEntryId?: string;
    kind?: string;
    entryId?: string;
    species?: string;
    flowLabel?: string;
  }>();
  const farmId = typeof params.farmId === "string" ? params.farmId : "";
  const animalEntryId =
    typeof params.animalEntryId === "string" ? params.animalEntryId : "";
  const entryId = typeof params.entryId === "string" ? params.entryId : "";
  const requestedKind = historyKind(
    typeof params.kind === "string" ? params.kind : "",
  );
  const [kind, setKind] = useState<string | null>(requestedKind);
  const routeSpecies = typeof params.species === "string" ? params.species : "";
  const [species, setSpecies] = useState("");
  const [breedCategory, setBreedCategory] = useState("");
  const title =
    (typeof params.flowLabel === "string" && params.flowLabel.trim()) ||
    (kind ? formTypeTitle(kind) : "Record");
  const [template, setTemplate] = useState<ActiveFarmTemplate | null>(null);
  const [initialValues, setInitialValues] = useState<Record<string, unknown>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!farmId || (!entryId && (!animalEntryId || !requestedKind))) {
      setLoading(false);
      setError(
        entryId
          ? "Open a history record before editing it."
          : "Open an animal before adding history.",
      );
      return;
    }
    setLoading(true);
    setError(null);
    setTemplate(null);
    try {
      if (entryId) {
        const draft = await getAnimalHistoryDraft(farmId, entryId);
        setKind(draft.kind);
        setInitialValues(draft.values);
        if (draft.kind === "breed") {
          const selectedSpecies =
            typeof draft.values.animalType === "string"
              ? draft.values.animalType
              : ((await getFarmReview(farmId)).animals.find(
                  (animal) => animal.entryId === draft.animalEntryId,
                )?.species ?? "");
          const category =
            typeof draft.values.breed === "string" ? draft.values.breed : "";
          const loaded = await getActiveTemplate(draft.kind);
          breedEntryTemplate(loaded, selectedSpecies, category, draft.values);
          setSpecies(selectedSpecies);
          setBreedCategory(category);
          setTemplate(loaded);
        } else
          setTemplate({
            type: draft.kind,
            updatedAt: draft.updatedAt,
            name: draft.form.name,
            form: draft.form,
            adminConfig: {},
          });
      } else if (requestedKind) {
        setKind(requestedKind);
        setInitialValues({});
        const loaded = await getActiveTemplate(requestedKind);
        if (requestedKind === "breed") {
          const selectedSpecies =
            routeSpecies ||
            (await getFarmReview(farmId)).animals.find(
              (animal) => animal.entryId === animalEntryId,
            )?.species ||
            "";
          breedEntryTemplate(loaded, selectedSpecies, "", {});
          setSpecies(selectedSpecies);
          setBreedCategory("");
        }
        setTemplate(loaded);
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The history form could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [animalEntryId, entryId, farmId, requestedKind, routeSpecies]);

  useEffect(() => {
    void load();
  }, [load]);

  const entryTemplate =
    template?.type === "breed"
      ? breedEntryTemplate(template, species, breedCategory, initialValues)
      : template;

  const compactHeading = singleEntryHeading(entryTemplate, title);

  async function submit(values: Record<string, unknown>) {
    if (!entryTemplate || !kind || saving) return;
    setSaving(true);
    setError(null);
    try {
      const entryValues =
        kind === "breed" ? { ...values, animalType: species } : values;
      if (entryId)
        await updateAnimalHistory(
          farmId,
          entryId,
          entryValues,
          kind === "breed" ? entryTemplate.form : undefined,
        );
      else
        await addAnimalHistory(
          farmId,
          animalEntryId,
          entryTemplate,
          entryValues,
        );
      setSaved(true);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : `The ${title.toLowerCase()} could not be saved.`,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <FlowPageHeading
          onBack={() => router.back()}
          title={compactHeading ?? (entryId ? `Edit ${title}` : `Add ${title}`)}
        />
        {loading ? (
          <View style={styles.status}>
            <ActivityIndicator color={colors.green} />
            <Text style={styles.help}>Loading the template…</Text>
          </View>
        ) : null}
        {error ? (
          <View style={styles.alert}>
            <Text style={styles.error}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={() => void load()}>
              <Text style={styles.retry}>Retry</Text>
            </Pressable>
          </View>
        ) : null}
        {entryTemplate && !saved ? (
          <TemplateEntryForm
            key={entryId || "new"}
            template={entryTemplate}
            onDraftChange={
              kind === "breed"
                ? (values) =>
                    setBreedCategory(
                      typeof values.breed === "string" ? values.breed : "",
                    )
                : undefined
            }
            compactTitle={compactHeading ? title : undefined}
            submitLabel={entryId ? "Save changes" : "Save"}
            farmId={farmId}
            saving={saving}
            initialValues={initialValues}
            onSubmit={submit}
          />
        ) : null}
        {saved ? (
          <View style={styles.success}>
            <Text style={styles.stepTitle}>
              {entryId ? "Changes saved" : `${title} added`}
            </Text>
            <Pressable accessibilityRole="button" onPress={() => router.back()}>
              <Text style={styles.retry}>
                {entryId ? "Back to history" : "Back to animal"}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 16, paddingBottom: 32, gap: 10 },
  status: { flexDirection: "row", alignItems: "center", gap: 10 },
  alert: { gap: 8 },
  stepTitle: { color: colors.ink, fontSize: 18, fontWeight: "700" },
  help: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 13 },
  retry: { color: colors.green, fontWeight: "700" },
  success: { gap: 6, ...farmCard, padding: 14 },
});
