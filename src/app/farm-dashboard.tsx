import { useCallback, useEffect, useState, type ReactNode } from "react";
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
import { useFocusEffect, useRouter } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import { SpeciesIcon } from "../components/SpeciesIcon";
import {
  getFarmReview,
  listSubmittedFarms,
  type FarmReview,
  type FarmReviewSection,
  type SubmittedFarm,
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

function visibleSections(review: FarmReview): FarmReviewSection[] {
  return review.sections
    .map((section) => ({
      ...section,
      rows: section.rows.filter((row) => row.value !== "Not provided"),
    }))
    .filter((section) => section.rows.length > 0);
}

function ownerLine(review: FarmReview): string {
  for (const section of review.sections) {
    const row = section.rows.find(
      (item) =>
        item.value !== "Not provided" &&
        /owner/i.test(item.label) &&
        /name/i.test(item.label),
    );
    if (row) return row.value;
  }
  return "";
}

function CollapseSection({
  title,
  count,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={styles.sectionHeader}
      >
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.count}>{count}</Text>
        <Feather
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16}
          color={colors.green}
        />
      </Pressable>
      {expanded ? children : null}
    </View>
  );
}

export default function FarmDashboardScreen() {
  const router = useRouter();
  const [farms, setFarms] = useState<SubmittedFarm[]>([]);
  const [review, setReview] = useState<FarmReview | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setFarms(await listSubmittedFarms());
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Submitted farms could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openFarm = useCallback(async (farmId: string, quiet = false) => {
    if (!quiet) setOpening(true);
    setReviewId(farmId);
    setError(null);
    try {
      const next = await getFarmReview(farmId);
      setReview(next);
      if (!quiet) setOpenSections({});
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "This farm could not be opened.",
      );
    } finally {
      if (!quiet) setOpening(false);
    }
  }, []);

  function toggleSection(key: string, fallback: boolean) {
    setOpenSections((current) => ({
      ...current,
      [key]: !(current[key] ?? fallback),
    }));
  }

  useFocusEffect(
    useCallback(() => {
      if (!reviewId) return;
      void openFarm(reviewId, true);
    }, [openFarm, reviewId]),
  );

  const sections = review ? visibleSections(review) : [];
  const owner = review ? ownerLine(review) : "";
  const registered = review ? when(review.submittedAt) : "";

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            if (review) {
              setReview(null);
              setReviewId(null);
              return;
            }
            router.back();
          }}
          style={styles.back}
        >
          <Feather name="arrow-left" size={18} color={colors.green} />
          <Text style={styles.backText}>
            {review ? "Submitted farms" : "Farm Vitals"}
          </Text>
        </Pressable>

        {loading || opening ? (
          <View style={styles.status}>
            <ActivityIndicator color={colors.green} />
            <Text style={styles.help}>
              {opening ? "Opening farm…" : "Loading farms…"}
            </Text>
          </View>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!review && !loading ? (
          <>
            <View style={styles.titleRow}>
              <View style={styles.titleCopy}>
                <Text accessibilityRole="header" style={styles.title}>
                  Submitted farms
                </Text>
                <Text style={styles.help}>
                  {farms.length
                    ? `${farms.length} registered`
                    : "No farms have been submitted yet."}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Refresh farms"
                onPress={() => void load()}
                style={styles.iconButton}
              >
                <Feather name="refresh-cw" size={16} color={colors.green} />
              </Pressable>
            </View>
            {farms.map((farm) => {
              const date = when(farm.submittedAt);
              return (
                <Pressable
                  key={farm.farmId}
                  accessibilityRole="button"
                  onPress={() => void openFarm(farm.farmId)}
                  style={styles.row}
                >
                  <View style={styles.mark}>
                    <Text style={styles.initial}>
                      {farm.name.slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.copy}>
                    <Text numberOfLines={1} style={styles.rowTitle}>
                      {farm.name}
                    </Text>
                    {date ? <Text style={styles.help}>{date}</Text> : null}
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.green} />
                </Pressable>
              );
            })}
          </>
        ) : null}

        {review && !opening ? (
          <>
            <View style={styles.identity}>
              <View style={styles.farmMark}>
                <Feather name="home" size={22} color={colors.green} />
              </View>
              <View style={styles.copy}>
                <Text accessibilityRole="header" style={styles.name}>
                  {review.name}
                </Text>
                <Text style={styles.meta}>
                  {[owner, registered ? `Registered ${registered}` : ""]
                    .filter(Boolean)
                    .join(" · ") || "Farm"}
                </Text>
              </View>
            </View>
            <View style={styles.stats}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{review.animals.length}</Text>
                <Text style={styles.statLabel}>Animals</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{sections.length}</Text>
                <Text style={styles.statLabel}>Sections</Text>
              </View>
            </View>
            {sections.map((section, index) => {
              const key = `farm-${index}`;
              const expanded = openSections[key] ?? index === 0;
              return (
                <CollapseSection
                  key={key}
                  title={section.title}
                  count={section.rows.length}
                  expanded={expanded}
                  onToggle={() => toggleSection(key, index === 0)}
                >
                  {section.rows.map((row) => (
                    <View key={`${key}-${row.label}`} style={styles.fact}>
                      <Text style={styles.factLabel}>{row.label}</Text>
                      <Text style={styles.factValue}>{row.value}</Text>
                    </View>
                  ))}
                </CollapseSection>
              );
            })}
            <View style={styles.animalHead}>
              <Text style={styles.sectionTitle}>Animals</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  router.push({
                    pathname: "/add-farm-animal",
                    params: { farmId: review.farmId },
                  })
                }
                style={styles.add}
              >
                <Feather name="plus" size={14} color="#FFFFFF" />
                <Text style={styles.addText}>Add</Text>
              </Pressable>
            </View>
            {review.animals.length ? (
              review.animals.map((animal) => {
                const date = when(animal.submittedAt);
                return (
                  <Pressable
                    key={animal.entryId}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${animal.name}`}
                    onPress={() =>
                      router.push({
                        pathname: "/farm-animal",
                        params: {
                          farmId: review.farmId,
                          entryId: animal.entryId,
                        },
                      })
                    }
                    style={styles.row}
                  >
                    <View style={styles.avatar}>
                      {animal.species ? (
                        <SpeciesIcon
                          species={animal.species}
                          size={36}
                          resizeMode="cover"
                        />
                      ) : (
                        <Text style={styles.initial}>
                          {animal.name.slice(0, 1).toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <View style={styles.copy}>
                      <Text numberOfLines={1} style={styles.rowTitle}>
                        {animal.name}
                      </Text>
                      <Text numberOfLines={1} style={styles.help}>
                        {[animal.species, date].filter(Boolean).join(" · ") ||
                          "Animal"}
                      </Text>
                    </View>
                    <Feather
                      name="chevron-right"
                      size={16}
                      color={colors.green}
                    />
                  </Pressable>
                );
              })
            ) : (
              <Text style={styles.help}>No animals have been added yet.</Text>
            )}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 20, paddingBottom: 36, gap: 12 },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    minHeight: 36,
  },
  backText: { color: colors.green, fontSize: 15, fontWeight: "700" },
  status: { flexDirection: "row", alignItems: "center", gap: 10 },
  help: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 13 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  titleCopy: { flex: 1, gap: 2 },
  title: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  identity: { flexDirection: "row", alignItems: "center", gap: 12 },
  farmMark: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.mint,
  },
  copy: { flex: 1, gap: 2 },
  name: {
    color: colors.ink,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  meta: { color: colors.ink, fontSize: 14, fontWeight: "600" },
  stats: { flexDirection: "row", gap: 8 },
  stat: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 1,
  },
  statValue: { color: colors.ink, fontSize: 20, fontWeight: "800" },
  statLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sectionTitle: { flex: 1, color: colors.ink, fontSize: 16, fontWeight: "800" },
  count: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  fact: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  factLabel: { flex: 1, color: colors.muted, fontSize: 13, fontWeight: "600" },
  factValue: {
    flex: 1,
    color: colors.ink,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "right",
  },
  animalHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  add: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: colors.green,
  },
  addText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowTitle: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  mark: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.mint,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.mint,
  },
  initial: { color: colors.green, fontSize: 15, fontWeight: "800" },
});
