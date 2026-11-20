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
import { useLocalSearchParams, useRouter } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import { TemplateEntryForm } from "../features/farm-vitals/template-entry";
import { farmButton, farmCard } from "../features/farm-vitals/presentation";
import {
  getFarmEditDraft,
  updateFarmRecord,
  type FarmEditDraft,
} from "../services/farmVitalsApi";

export default function EditFarmScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ farmId?: string }>();
  const farmId = typeof params.farmId === "string" ? params.farmId : "";
  const [draft, setDraft] = useState<FarmEditDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!farmId) throw new Error("Open a farm before editing its details.");
      setDraft(await getFarmEditDraft(farmId));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The farm could not be opened.",
      );
    } finally {
      setLoading(false);
    }
  }, [farmId]);
  useEffect(() => {
    void load();
  }, [load]);
  async function save(values: Record<string, unknown>) {
    if (!draft || saving) return;
    setSaving(true);
    setError(null);
    try {
      await updateFarmRecord(farmId, draft, values);
      router.back();
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
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          accessibilityRole="button"
          disabled={saving}
          onPress={() => router.back()}
          style={styles.back}
        >
          <Feather name="arrow-left" size={18} color="#1E7F5C" />
          <Text style={styles.link}>Farm details</Text>
        </Pressable>
        <View style={styles.heading}>
          <Text accessibilityRole="header" style={styles.title}>
            Edit farm
          </Text>
          <Text style={styles.help}>
            Update farm details, contacts, and location, then save your changes.
          </Text>
        </View>
        {loading ? <ActivityIndicator color="#1E7F5C" /> : null}
        {error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        ) : null}
        {!loading && !draft ? (
          <Pressable
            accessibilityRole="button"
            style={styles.retry}
            onPress={() => void load()}
          >
            <Text style={styles.link}>Retry</Text>
          </Pressable>
        ) : null}
        {!loading && draft ? (
          <TemplateEntryForm
            key={draft.revision}
            template={draft.template}
            initialValues={draft.values}
            farmId={farmId}
            saving={saving}
            submitLabel="Save farm changes"
            onSubmit={save}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8F8F2" },
  scroll: { padding: 20, paddingBottom: 36, gap: 14 },
  back: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44 },
  link: { color: "#1E7F5C", fontWeight: "700", fontSize: 15 },
  heading: { ...farmCard, padding: 14, gap: 6 },
  title: { color: "#173D32", fontSize: 26, fontWeight: "800" },
  help: { color: "#63766C", fontSize: 14, lineHeight: 20 },
  error: { color: "#B42318", fontSize: 14 },
  retry: {
    ...farmButton,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },
});
