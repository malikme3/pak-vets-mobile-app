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
import Feather from "@expo/vector-icons/Feather";
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
  const params = useLocalSearchParams<{ farmId?: string; kind?: string }>();
  const farmId = typeof params.farmId === "string" ? params.farmId : "";
  const kind =
    typeof params.kind === "string" && params.kind.trim() ? params.kind : "animal";
  const [template, setTemplate] = useState<ActiveFarmTemplate | null>(null);
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
      setTemplate(await getActiveTemplate(kind));
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

  async function submit(values: Record<string, unknown>) {
    if (!template || saving) return;
    setSaving(true);
    setError(null);
    try {
      await addAnimalRecord(farmId, template, values);
      router.back();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : `The ${formTypeTitle(kind).toLowerCase()} could not be saved.`,
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
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.back}
        >
          <Feather name="arrow-left" size={18} color={colors.green} />
          <Text style={styles.backText}>Farm</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>
          Add {formTypeTitle(kind)}
        </Text>
        <Text style={styles.subtitle}>
          {template?.form.name ?? `Enter the ${formTypeTitle(kind).toLowerCase()} details.`}
        </Text>
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
        {template ? (
          <TemplateEntryForm
            template={template}
            submitLabel="Add Animal"
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
  scroll: { padding: 24, paddingBottom: 40, gap: 16 },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
  },
  backText: { color: colors.green, fontSize: 15, fontWeight: "700" },
  title: { color: colors.ink, fontSize: 32, fontWeight: "800" },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  status: { flexDirection: "row", alignItems: "center", gap: 10 },
  alert: { gap: 8 },
  help: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 13 },
  retry: { color: colors.green, fontWeight: "700" },
});
