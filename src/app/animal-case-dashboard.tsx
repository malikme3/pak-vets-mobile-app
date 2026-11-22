import { FlowPageHeading } from "../features/farm-vitals/flow-page-heading";
import { HeaderBackground } from "../features/farm-vitals/header-background";
import { farmCard, farmButton } from "../features/farm-vitals/presentation";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import {
  getFarmReview,
  type FarmAnimalReview,
} from "../services/farmVitalsApi";

const colors = {
  background: "#F8F8F2",
  surface: "#FFFFFF",
  ink: "#173D32",
  muted: "#63766C",
  green: "#1E7F5C",
  border: "#E4EBE3",
  danger: "#B42318",
};

export default function AnimalCaseDashboard() {
  const router = useRouter();
  const { farmId, animalEntryId } = useLocalSearchParams<{
    farmId: string;
    animalEntryId: string;
  }>();
  const [filter, setFilter] = useState<"all" | "draft" | "saved">("all");
  const [animal, setAnimal] = useState<FarmAnimalReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      setError("");
      setAnimal(null);

      async function load() {
        try {
          if (!farmId || !animalEntryId)
            throw new Error("Open the case dashboard from an animal page.");
          const farm = await getFarmReview(farmId);
          const selected = farm.animals.find(
            (item) => item.entryId === animalEntryId,
          );
          if (!selected)
            throw new Error("This animal is no longer on the farm.");
          if (!cancelled) setAnimal(selected);
        } catch (cause) {
          if (!cancelled)
            setError(
              cause instanceof Error
                ? cause.message
                : "The cases could not be loaded.",
            );
        } finally {
          if (!cancelled) setLoading(false);
        }
      }

      void load();
      return () => {
        cancelled = true;
      };
    }, [farmId, animalEntryId, attempt]),
  );

  const allCases = [...(animal?.cases ?? [])].sort(
    (left, right) =>
      (Date.parse(right.openedAt) || 0) - (Date.parse(left.openedAt) || 0),
  );
  const cases = allCases.filter(
    (item) => filter === "all" || item.status === filter,
  );
  const counts = {
    all: allCases.length,
    draft: allCases.filter((item) => item.status === "draft").length,
    saved: allCases.filter((item) => item.status === "saved").length,
  };
  const filters = [
    { key: "all", label: "All" },
    { key: "draft", label: "Drafts" },
    { key: "saved", label: "Saved" },
  ] as const;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <FlatList
        contentContainerStyle={styles.content}
        data={cases}
        keyExtractor={(item) => item.entryId}
        ListHeaderComponent={
          <View style={styles.header}>
            <FlowPageHeading
              onBack={() => router.back()}
              title="Case dashboard"
            />
            {animal ? (
              <>
                <HeaderBackground
                  imageUrl={animal.headerBackgroundImageUrl}
                  style={styles.animalCard}
                >
                  <View style={styles.animalIcon}>
                    <Feather name="heart" size={22} color={colors.green} />
                  </View>
                  <View style={styles.copy}>
                    <Text accessibilityRole="header" style={styles.animalName}>
                      {animal.name}
                    </Text>
                    <Text style={styles.subtitle}>
                      {animal.species || "Animal health records"}
                    </Text>
                  </View>
                  <View
                    accessible
                    accessibilityLabel={`${counts.all} ${counts.all === 1 ? "case" : "cases"}`}
                    style={styles.totalBadge}
                  >
                    <Text style={styles.totalNumber}>{counts.all}</Text>
                    <Text style={styles.totalLabel}>
                      {counts.all === 1 ? "case" : "cases"}
                    </Text>
                  </View>
                </HeaderBackground>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Add case"
                  onPress={() =>
                    router.push({
                      pathname: "/health-case",
                      params: { farmId, animalEntryId },
                    })
                  }
                  style={({ pressed }) => [
                    styles.action,
                    pressed && styles.pressed,
                  ]}
                >
                  <Feather name="plus" size={18} color={colors.surface} />
                  <Text style={styles.actionText}>Add case</Text>
                </Pressable>
                <View accessibilityRole="tablist" style={styles.filters}>
                  {filters.map((item) => (
                    <Pressable
                      key={item.key}
                      accessibilityRole="tab"
                      accessibilityLabel={`${item.label} cases, ${counts[item.key]}`}
                      accessibilityState={{ selected: filter === item.key }}
                      onPress={() => setFilter(item.key)}
                      style={[
                        styles.filter,
                        filter === item.key && styles.filterSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterText,
                          filter === item.key && styles.filterTextSelected,
                        ]}
                      >
                        {item.label}
                      </Text>
                      <View
                        style={[
                          styles.filterCount,
                          filter === item.key && styles.filterCountSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.filterNumber,
                            filter === item.key && styles.filterTextSelected,
                          ]}
                        >
                          {counts[item.key]}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.listHeading}>
                  <Text accessibilityRole="header" style={styles.listTitle}>
                    {filter === "all"
                      ? "Recent cases"
                      : filter === "draft"
                        ? "Draft cases"
                        : "Saved cases"}
                  </Text>
                  <Text style={styles.sortLabel}>Newest first</Text>
                </View>
              </>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator
              accessibilityLabel="Loading cases"
              color={colors.green}
            />
          ) : error ? (
            <View style={styles.status}>
              <Text style={styles.error}>{error}</Text>
              {farmId && animalEntryId ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setAttempt((current) => current + 1)}
                >
                  <Text style={styles.link}>Retry</Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <Feather
                  name={filter === "draft" ? "edit-3" : "clipboard"}
                  size={25}
                  color={colors.green}
                />
              </View>
              <Text style={styles.emptyTitle}>
                {filter === "all"
                  ? "No cases yet"
                  : filter === "draft"
                    ? "No drafts to resume"
                    : "No saved cases yet"}
              </Text>
              <Text style={styles.emptyText}>
                {filter === "all"
                  ? "Add a case to record symptoms, treatment, and progress for this animal."
                  : filter === "draft"
                    ? "Cases saved as drafts will appear here."
                    : "Completed case records will appear here."}
              </Text>
              {filter !== "all" ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setFilter("all")}
                  style={styles.showAll}
                >
                  <Text style={styles.link}>View all cases</Text>
                </Pressable>
              ) : null}
            </View>
          )
        }
        renderItem={({ item }) => {
          const opened = new Date(item.openedAt);
          const date = Number.isNaN(opened.getTime())
            ? ""
            : opened.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              });
          const status = item.status === "draft" ? "Draft" : "Saved";
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.complaint || (item.status === "draft" ? "Draft case" : "Health case")}, ${status}${date ? `, ${date}` : ""}`}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={() =>
                router.push({
                  pathname: "/health-case-detail",
                  params: { farmId, entryId: item.entryId },
                })
              }
            >
              <View style={styles.caseTop}>
                <View
                  style={[
                    styles.caseIcon,
                    item.status === "draft" && styles.draftIcon,
                  ]}
                >
                  <Feather
                    name={item.status === "draft" ? "edit-3" : "check-circle"}
                    size={18}
                    color={item.status === "draft" ? "#8A601C" : colors.green}
                  />
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    item.status === "draft" && styles.draftBadge,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      item.status === "draft" && styles.draftText,
                    ]}
                  >
                    {status}
                  </Text>
                </View>
              </View>
              <Text numberOfLines={2} style={styles.caseTitle}>
                {item.complaint ||
                  (item.status === "draft" ? "Untitled draft" : "Health case")}
              </Text>
              <View style={styles.caseFooter}>
                <View style={styles.dateRow}>
                  <Feather name="calendar" size={12} color={colors.muted} />
                  <Text style={styles.caseDate}>
                    {date || "Date not recorded"}
                  </Text>
                </View>
                {item.updates.length ? (
                  <View style={styles.dateRow}>
                    <Feather name="clock" size={12} color={colors.muted} />
                    <Text style={styles.caseDate}>
                      {item.updates.length}{" "}
                      {item.updates.length === 1 ? "update" : "updates"}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.chevron}>
                  <Feather
                    name="arrow-up-right"
                    size={16}
                    color={colors.green}
                  />
                </View>
              </View>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 36, gap: 12 },
  header: { gap: 14, marginBottom: 2 },
  back: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    minHeight: 44,
  },
  link: { color: colors.green, fontSize: 14, fontWeight: "700" },
  pageHeading: { gap: 4 },
  eyebrow: {
    color: colors.green,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  title: {
    color: colors.ink,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  subtitle: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  animalCard: {
    ...farmCard,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  animalIcon: {
    width: 44,
    height: 44,
    backgroundColor: "#E7F5EE",
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  animalName: { color: colors.ink, fontSize: 20, fontWeight: "800" },
  totalBadge: {
    backgroundColor: "#E7F5EE",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    alignItems: "center",
    minWidth: 50,
  },
  totalNumber: { color: colors.green, fontSize: 19, fontWeight: "800" },
  totalLabel: { color: colors.green, fontSize: 10, fontWeight: "600" },
  action: {
    ...farmButton,
    backgroundColor: colors.green,
    borderRadius: 12,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actionText: { color: colors.surface, fontSize: 15, fontWeight: "700" },
  filters: {
    flexDirection: "row",
    gap: 4,
    padding: 4,
    borderRadius: 14,
    backgroundColor: "#EAF0EB",
  },
  filter: {
    flex: 1,
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 10,
  },
  filterSelected: {
    backgroundColor: colors.surface,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  filterText: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  filterTextSelected: { color: colors.green, fontWeight: "800" },
  filterCount: {
    backgroundColor: "#DCE6DF",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  filterCountSelected: { backgroundColor: "#E7F5EE" },
  filterNumber: { color: colors.muted, fontSize: 10, fontWeight: "700" },
  listHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 2,
  },
  listTitle: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  sortLabel: { color: colors.muted, fontSize: 11 },
  row: { ...farmCard, padding: 10, gap: 6 },
  caseTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  caseIcon: {
    width: 22,
    height: 22,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E7F5EE",
  },
  draftIcon: { backgroundColor: "#FFF3DD" },
  statusBadge: {
    backgroundColor: "#E7F5EE",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: { color: colors.green, fontSize: 10, fontWeight: "800" },
  draftBadge: { backgroundColor: "#FFF3DD" },
  draftText: { color: "#8A601C" },
  copy: { flex: 1, minWidth: 0, gap: 3 },
  caseTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
  },
  caseFooter: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    paddingTop: 5,
  },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  caseDate: { color: colors.muted, fontSize: 10 },
  chevron: {
    marginLeft: "auto",
    width: 26,
    height: 26,
    borderRadius: 9,
    backgroundColor: "#F0F6F2",
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.85 },
  status: { gap: 8, padding: 14 },
  error: { color: colors.danger, fontSize: 14 },
  emptyCard: { ...farmCard, padding: 24, alignItems: "center", gap: 10 },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: "#E7F5EE",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center",
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  showAll: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
});
