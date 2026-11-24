import {
  farmCard,
  farmButton,
  formatFarmDate,
} from "../features/farm-vitals/presentation";
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
import { RecordPhoto } from "../features/farm-vitals/record-photo";
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

export default function FarmHistoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    farmId?: string;
    entryId?: string;
    animalEntryId?: string;
    kind?: string;
    title?: string;
  }>();
  const farmId = typeof params.farmId === "string" ? params.farmId : "";
  const entryId = typeof params.entryId === "string" ? params.entryId : "";
  const animalEntryId =
    typeof params.animalEntryId === "string" ? params.animalEntryId : "";
  const kind = typeof params.kind === "string" ? params.kind : "";
  const browsing = !entryId && Boolean(animalEntryId && kind);
  const [records, setRecords] = useState<FarmHistoryReview[]>([]);
  const [history, setHistory] = useState<FarmHistoryReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!farmId || (!entryId && !browsing)) {
      setLoading(false);
      setError("Open this history from its animal.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const review = await getFarmReview(farmId);
      if (browsing) {
        const animal = review.animals.find(
          (item) => item.entryId === animalEntryId,
        );
        if (!animal) throw new Error("This animal is no longer on the farm.");
        setRecords(animal.records.filter((record) => record.kind === kind));
        return;
      }
      const match =
        review.records.find((record) => record.entryId === entryId) ??
        review.animals
          .flatMap((animal) => animal.records)
          .find((record) => record.entryId === entryId);
      if (!match) throw new Error("This record is no longer available.");
      setHistory(match);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "This history could not be opened.",
      );
    } finally {
      setLoading(false);
    }
  }, [animalEntryId, browsing, entryId, farmId, kind]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const title = history ? formTypeTitle(history.kind) : "Record";
  const medicalHistory = history?.kind === "medical-history";
  const metadata = history
    ? [history.name === title ? "" : title, formatFarmDate(history.submittedAt)]
        .filter(Boolean)
        .join(" · ")
    : "";
  const sections =
    history?.sections
      .map((section) => ({
        ...section,
        rows: medicalHistory
          ? section.rows.filter(
              (row) =>
                row.imageUrl ||
                (row.value.trim() && row.value !== "Not provided"),
            )
          : section.rows,
      }))
      .filter((section) => !medicalHistory || section.rows.length) ?? [];
  const editButton = history ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Edit ${medicalHistory ? title : history.name}`}
      onPress={() =>
        router.push({
          pathname: "/add-farm-history",
          params: {
            farmId,
            entryId,
            kind: history.kind,
            fromRecordDetails: "1",
          },
        })
      }
      style={styles.edit}
    >
      <Feather name="edit-2" size={15} color={colors.green} />
      <Text style={styles.editText}>Edit</Text>
    </Pressable>
  ) : null;
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <FlowPageHeading
          onBack={() => router.back()}
          title={
            browsing
              ? params.title || formTypeTitle(kind)
              : medicalHistory
                ? title
                : "Record details"
          }
        />
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
        {browsing && !loading && !error ? (
          records.length ? (
            records.map((record) => {
              const symptoms = record.sections
                .flatMap((section) => section.rows)
                .find(
                  (row) =>
                    /symptoms?/i.test(row.label) &&
                    row.value !== "Not provided",
                );
              return (
                <Pressable
                  key={record.entryId}
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname: "/farm-history",
                      params: { farmId, entryId: record.entryId },
                    })
                  }
                  style={[styles.card, styles.fact]}
                >
                  <View style={styles.listCopy}>
                    <Text numberOfLines={1} style={styles.listName}>
                      {record.name}
                    </Text>
                    <Text numberOfLines={1} style={styles.help}>
                      {symptoms
                        ? `Symptoms: ${symptoms.value}`
                        : formatFarmDate(record.submittedAt)}
                    </Text>
                  </View>
                  <Feather
                    name="chevron-right"
                    size={18}
                    color={colors.green}
                  />
                </Pressable>
              );
            })
          ) : (
            <Text style={styles.help}>No records yet.</Text>
          )
        ) : null}
        {!browsing && history ? (
          <>
            {!medicalHistory ? (
              <View style={styles.recordIdentity}>
                <Text style={styles.name}>{history.name}</Text>
                {metadata ? <Text style={styles.help}>{metadata}</Text> : null}
                {editButton}
              </View>
            ) : null}
            {sections.map((section) => (
              <View key={section.title} style={styles.card}>
                {!medicalHistory || sections.length > 1 ? (
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                ) : null}
                {section.rows.map((row, index) => {
                  const stacked =
                    medicalHistory && !/^\d{4}-\d{2}-\d{2}$/.test(row.value);
                  return (
                    <View
                      key={`${row.label}-${index}`}
                      style={[
                        row.imageUrl
                          ? styles.photoRow
                          : stacked
                            ? styles.stackedFact
                            : styles.fact,
                        index > 0 && styles.factDivider,
                      ]}
                    >
                      {row.imageUrl ? (
                        <>
                          {row.label !== section.title && (
                            <Text style={styles.photoLabel}>{row.label}</Text>
                          )}
                          <RecordPhoto
                            key={row.imageUrl}
                            url={row.imageUrl}
                            label={row.label}
                            onOpen={() =>
                              router.push({
                                pathname: "/add-farm-history",
                                params: {
                                  farmId,
                                  entryId,
                                  kind: history.kind,
                                  fromRecordDetails: "1",
                                },
                              })
                            }
                          />
                        </>
                      ) : (
                        <>
                          <Text
                            style={
                              stacked ? styles.photoLabel : styles.factLabel
                            }
                          >
                            {row.label}
                          </Text>
                          <Text
                            style={
                              stacked ? styles.stackedValue : styles.factValue
                            }
                          >
                            {row.value}
                          </Text>
                        </>
                      )}
                    </View>
                  );
                })}
              </View>
            ))}
            {medicalHistory ? (
              <>
                {!sections.length ? (
                  <Text style={styles.help}>No details recorded.</Text>
                ) : null}
                {editButton}
              </>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 20, paddingBottom: 36, gap: 16 },
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
    alignSelf: "stretch",
    minHeight: 40,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...farmButton,
    backgroundColor: "#FFFFFF",
  },
  editText: { color: colors.green, fontSize: 15, fontWeight: "700" },
  card: {
    paddingTop: 12,
    ...farmCard,
  },
  listCopy: { flex: 1, gap: 4 },
  listName: { color: colors.ink, fontSize: 15, fontWeight: "700" },
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
  stackedFact: { gap: 6, paddingHorizontal: 14, paddingVertical: 14 },
  stackedValue: { color: colors.ink, fontSize: 15, lineHeight: 22 },
  photoRow: { gap: 8, paddingHorizontal: 14, paddingBottom: 14 },
  photoLabel: { color: colors.muted, fontSize: 13, fontWeight: "600" },
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
