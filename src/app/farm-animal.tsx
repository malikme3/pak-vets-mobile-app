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
import { SpeciesIcon } from "../components/SpeciesIcon";
import {
  getFarmReview,
  type FarmAnimalReview,
  type FarmHistoryReview,
  type FarmReviewRow,
} from "../services/farmVitalsApi";

const colors = {
  background: "#F8F8F2",
  ink: "#173D32",
  muted: "#63766C",
  green: "#1E7F5C",
  border: "#E4EBE3",
  surface: "#FFFFFF",
  danger: "#B42318",
  mint: "#E7F5EE",
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

function provided(row: FarmReviewRow): boolean {
  return row.value !== "Not provided";
}

function isIdentity(label: string): boolean {
  return /name|tag|animal id|^id$|animal type|species/i.test(label);
}

function isHighlight(label: string): boolean {
  return /gender|health|purpose|breed/i.test(label);
}

function chipTone(value: string): { background: string; color: string } {
  const text = value.trim().toLowerCase();
  if (text === "sick") return { background: "#FDECEC", color: "#B42318" };
  if (text === "pregnant") return { background: "#FFF4E5", color: "#B45309" };
  if (text === "healthy") return { background: colors.mint, color: "#166534" };
  return { background: "#F3F6F1", color: colors.ink };
}

function HistoryList({
  title,
  records,
  onOpen,
}: {
  title: string;
  records: FarmHistoryReview[];
  onOpen: (entryId: string) => void;
}) {
  if (!records.length) return null;
  return (
    <View style={styles.history}>
      <Text style={styles.historyTitle}>{title}</Text>
      {records.map((record) => (
        <Pressable
          key={record.entryId}
          accessibilityRole="button"
          accessibilityLabel={`Open ${record.name}`}
          onPress={() => onOpen(record.entryId)}
          style={styles.historyRow}
        >
          <View style={styles.historyCopy}>
            <Text numberOfLines={1} style={styles.historyName}>
              {record.name}
            </Text>
            {when(record.submittedAt) ? (
              <Text style={styles.help}>{when(record.submittedAt)}</Text>
            ) : null}
          </View>
          <Feather name="chevron-right" size={18} color={colors.green} />
        </Pressable>
      ))}
    </View>
  );
}

export default function FarmAnimalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ farmId?: string; entryId?: string }>();
  const farmId = typeof params.farmId === "string" ? params.farmId : "";
  const entryId = typeof params.entryId === "string" ? params.entryId : "";
  const [animal, setAnimal] = useState<FarmAnimalReview | null>(null);
  const [farmName, setFarmName] = useState("Farm");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!farmId || !entryId) {
      setLoading(false);
      setError("Open this animal from its farm.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const review = await getFarmReview(farmId);
      const match = review.animals.find((item) => item.entryId === entryId);
      if (!match) throw new Error("This animal is no longer on the farm.");
      setFarmName(review.name);
      setAnimal(match);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "This animal could not be opened.",
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

  const rows = animal?.sections.flatMap((section) => section.rows) ?? [];
  const tag = rows.find(
    (row) => provided(row) && /tag|animal id|^id$/i.test(row.label),
  );
  const highlights = rows.filter((row) => provided(row) && isHighlight(row.label));
  const facts = rows.filter(
    (row) => !isIdentity(row.label) && !isHighlight(row.label),
  );
  const added = animal ? when(animal.submittedAt) : "";

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.back}
        >
          <Feather name="arrow-left" size={18} color={colors.green} />
          <Text style={styles.backText}>{farmName}</Text>
        </Pressable>
        {loading ? (
          <View style={styles.status}>
            <ActivityIndicator color={colors.green} />
            <Text style={styles.help}>Opening animal…</Text>
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
        {animal ? (
          <>
            <View style={styles.identity}>
              <View style={styles.avatar}>
                {animal.species ? (
                  <SpeciesIcon
                    species={animal.species}
                    size={64}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={styles.initial}>
                    {animal.name.slice(0, 1).toUpperCase()}
                  </Text>
                )}
              </View>
              <View style={styles.identityCopy}>
                <Text accessibilityRole="header" style={styles.name}>
                  {animal.name}
                </Text>
                <Text style={styles.meta}>
                  {[animal.species, tag?.value].filter(Boolean).join(" · ") ||
                    "Animal"}
                </Text>
                {added ? <Text style={styles.help}>Added {added}</Text> : null}
              </View>
            </View>
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  router.push({
                    pathname: "/add-farm-history",
                    params: {
                      farmId,
                      animalEntryId: animal.entryId,
                      kind: "medical-history",
                    },
                  })
                }
                style={styles.action}
              >
                <Text style={styles.actionText}>Add Medical History</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  router.push({
                    pathname: "/add-farm-history",
                    params: {
                      farmId,
                      animalEntryId: animal.entryId,
                      kind: "production-history",
                    },
                  })
                }
                style={styles.actionAlt}
              >
                <Text style={styles.actionAltText}>Add Production History</Text>
              </Pressable>
            </View>
            {highlights.length ? (
              <View style={styles.chips}>
                {highlights.map((row) => {
                  const tone = chipTone(row.value);
                  return (
                    <View
                      key={row.label}
                      style={[styles.chip, { backgroundColor: tone.background }]}
                    >
                      <Text style={styles.chipLabel}>{row.label}</Text>
                      <Text style={[styles.chipValue, { color: tone.color }]}>
                        {row.value}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : null}
            {facts.length ? (
              <View style={styles.card}>
                {facts.map((row, index) => (
                  <View
                    key={`${row.label}-${index}`}
                    style={[styles.fact, index > 0 && styles.factDivider]}
                  >
                    <Text style={styles.factLabel}>{row.label}</Text>
                    <Text style={styles.factValue}>{row.value}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            <HistoryList
              title="Medical history"
              records={animal.medicalHistory}
              onOpen={(historyId) =>
                router.push({
                  pathname: "/farm-history",
                  params: { farmId, entryId: historyId },
                })
              }
            />
            <HistoryList
              title="Production history"
              records={animal.productionHistory}
              onOpen={(historyId) =>
                router.push({
                  pathname: "/farm-history",
                  params: { farmId, entryId: historyId },
                })
              }
            />
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
  identity: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.mint,
  },
  identityCopy: { flex: 1, gap: 2 },
  initial: { color: colors.green, fontSize: 28, fontWeight: "800" },
  name: { color: colors.ink, fontSize: 28, fontWeight: "800", letterSpacing: -0.4 },
  meta: { color: colors.ink, fontSize: 15, fontWeight: "600" },
  actions: { flexDirection: "row", gap: 8 },
  action: {
    flex: 1,
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  actionText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  actionAlt: {
    flex: 1,
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  actionAltText: {
    color: colors.green,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  history: { gap: 8 },
  historyTitle: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  historyCopy: { flex: 1, gap: 2 },
  historyName: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 1,
  },
  chipLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  chipValue: { fontSize: 14, fontWeight: "700" },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
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
