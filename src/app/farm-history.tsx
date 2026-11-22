import { farmCard, farmButton } from "../features/farm-vitals/presentation";
import { useCallback, useState } from "react";
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
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import { FlowPageHeading } from "../features/farm-vitals/flow-page-heading";
import {
  formTypeTitle,
  getFarmReview,
  type FarmHistoryReview,
} from "../services/farmVitalsApi";

const colors = {
  background: "#F8F8F2",
  ink: "#173D32",
  muted: "#63766C",
  green: "#1E7F5C",
  border: "#E4EBE3",
  surface: "#FFFFFF",
  danger: "#B42318",
};

function when(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function FarmHistoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ farmId?: string; entryId?: string }>();
  const farmId = typeof params.farmId === "string" ? params.farmId : "";
  const entryId = typeof params.entryId === "string" ? params.entryId : "";
  const [history, setHistory] = useState<FarmHistoryReview | null>(null);
  const [animalName, setAnimalName] = useState("Animal");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!farmId || !entryId) {
      setLoading(false);
      setError("Open this history from its animal.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const review = await getFarmReview(farmId);
      const match =
        review.animals.flatMap((animal) =>
          animal.records
            .filter((item) => item.entryId === entryId)
            .map((item) => ({ item, ownerName: animal.name })),
        )[0] ??
        review.records
          .filter((item) => item.entryId === entryId)
          .map((item) => ({ item, ownerName: review.name }))[0];
      if (!match) throw new Error("This record is no longer available.");
      setAnimalName(match.ownerName);
      setHistory(match.item);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "This history could not be opened.",
      );
    } finally {
      setLoading(false);
    }
  }, [entryId, farmId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const title = history ? formTypeTitle(history.kind) : "Record";
  const added = history ? when(history.submittedAt) : "";

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <FlowPageHeading onBack={() => router.back()} title="Record details" />
        {loading ? (
          <View style={styles.status}>
            <ActivityIndicator color={colors.green} />
            <Text style={styles.help}>Opening history…</Text>
          </View>
        ) : null}
        {error ? (
          <View style={styles.status}>
            <Text style={styles.error}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={() => void load()}>
              <Text style={styles.retry}>Retry</Text>
            </Pressable>
          </View>
        ) : null}
        {history ? (
          <>
            <View style={styles.recordIdentity}>
              <Text style={styles.name}>{history.name}</Text>
              <Text style={styles.help}>
                {[title, added].filter(Boolean).join(" · ")}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Edit ${history.name}`}
                onPress={() =>
                  router.push({
                    pathname: "/add-farm-history",
                    params: { farmId, entryId, kind: history.kind },
                  })
                }
                style={styles.edit}
              >
                <Feather name="edit-2" size={15} color={colors.green} />
                <Text style={styles.editText}>Edit</Text>
              </Pressable>
            </View>
            {history.sections.map((section) => (
              <View key={section.title} style={styles.card}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                {section.rows.map((row, index) => (
                  <View
                    key={`${row.label}-${index}`}
                    style={[styles.fact, index > 0 && styles.factDivider]}
                  >
                    <Text style={styles.factLabel}>{row.label}</Text>
                    <Text style={styles.factValue}>{row.value}</Text>
                  </View>
                ))}
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 20, paddingBottom: 36, gap: 16 },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    minHeight: 36,
  },
  backText: { color: colors.green, fontSize: 15, fontWeight: "700" },
  status: { gap: 8 },
  help: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 13 },
  retry: { color: colors.green, fontWeight: "700" },
  recordIdentity: { gap: 6, ...farmCard, padding: 14 },
  name: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  edit: {
    alignSelf: "flex-start",
    minHeight: 40,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    ...farmButton,
    backgroundColor: "#FFFFFF",
  },
  editText: { color: colors.green, fontSize: 15, fontWeight: "700" },
  card: {
    paddingTop: 12,
    ...farmCard,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "700",
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  fact: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  factDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  factLabel: { flex: 1, color: colors.muted, fontSize: 13, fontWeight: "600" },
  factValue: {
    flex: 1,
    color: colors.ink,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "right",
  },
});
