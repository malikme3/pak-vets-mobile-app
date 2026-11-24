import { FormScrollView } from "../components/ui/FormScrollView";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { FlowPageHeading } from "../features/farm-vitals/flow-page-heading";
import { entryDefaults } from "../features/farm-vitals/entry-defaults";
import { TemplateEntryForm } from "../features/farm-vitals/template-entry";
import {
  createFarmRecord,
  getActiveTemplate,
  type ActiveFarmTemplate,
} from "../services/farmVitalsApi";

const colors = {
  background: "#F8F8F2",
  muted: "#63766C",
  green: "#1E7F5C",
  danger: "#B42318",
};

export default function CreateFarmScreen() {
  const router = useRouter();
  const [template, setTemplate] = useState<ActiveFarmTemplate | null>(null);
  const [initialValues, setInitialValues] = useState<Record<string, unknown>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await getActiveTemplate("farm");
      setInitialValues(await entryDefaults(loaded));
      setTemplate(loaded);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The farm template could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(values: Record<string, unknown>) {
    if (!template || saving) return;
    setSaving(true);
    setError(null);
    try {
      const farmId = await createFarmRecord(template, values);
      router.replace({ pathname: "/farm-dashboard", params: { farmId } });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "The farm could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <FormScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <FlowPageHeading
          onBack={() => router.dismissTo("/farm-board")}
          title="Add farm"
        />
        {loading ? (
          <View style={styles.status}>
            <ActivityIndicator color={colors.green} />
            <Text style={styles.help}>Loading the farm template…</Text>
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
        {template ? (
          <TemplateEntryForm
            template={template}
            initialValues={initialValues}
            showDescription={false}
            submitLabel="Add farm"
            saving={saving}
            onSubmit={submit}
          />
        ) : null}
      </FormScrollView>
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
