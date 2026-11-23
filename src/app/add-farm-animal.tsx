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
import { TemplateEntryForm } from "../features/farm-vitals/template-entry";
import {
  addAnimalRecord,
  formTypeTitle,
  getActiveTemplate,
  type ActiveFarmTemplate,
} from "../services/farmVitalsApi";

const colors = {
  background: "#F8F8F2",
  ink: "#173D32",
  muted: "#63766C",
  green: "#1E7F5C",
  danger: "#B42318",
};

export default function AddFarmAnimalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    farmId?: string;
    kind?: string;
    flowLabel?: string;
  }>();
  const farmId = typeof params.farmId === "string" ? params.farmId : "";
  const kind =
    typeof params.kind === "string" && params.kind.trim()
      ? params.kind
      : "animal";
  const label =
    (typeof params.flowLabel === "string" && params.flowLabel.trim()) ||
    formTypeTitle(kind);
  const [template, setTemplate] = useState<ActiveFarmTemplate | null>(null);
  const [breedAnswers, setBreedAnswers] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!farmId) {
      setLoading(false);
      setError("Open a farm before adding an animal.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const loaded = await getActiveTemplate(kind);
      if (kind === "breed") {
        breedEntryTemplate(loaded, "", "", {}, true);
        setBreedAnswers({});
      }
      setTemplate(loaded);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The animal template could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [farmId, kind]);

  useEffect(() => {
    void load();
  }, [load]);

  const entryTemplate =
    template?.type === "breed"
      ? breedEntryTemplate(
          template,
          typeof breedAnswers.animalType === "string"
            ? breedAnswers.animalType
            : "",
          typeof breedAnswers.breed === "string" ? breedAnswers.breed : "",
          {},
          true,
        )
      : template;

  async function submit(values: Record<string, unknown>) {
    if (!entryTemplate || saving) return;
    setSaving(true);
    setError(null);
    try {
      const entryId = await addAnimalRecord(farmId, entryTemplate, values);
      if (entryTemplate.type === "animal") {
        router.replace({ pathname: "/farm-animal", params: { farmId, entryId } });
      } else {
        router.back();
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : `The ${label.toLowerCase()} could not be saved.`,
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
        <FlowPageHeading onBack={() => router.back()} title={`Add ${label}`} />
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
        {entryTemplate ? (
          <TemplateEntryForm
            template={entryTemplate}
            onDraftChange={kind === "breed" ? setBreedAnswers : undefined}
            showDescription={false}
            submitLabel={`Add ${label}`}
            saving={saving}
            farmId={farmId}
            onSubmit={submit}
          />
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
  help: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 13 },
  retry: { color: colors.green, fontWeight: "700" },
});
