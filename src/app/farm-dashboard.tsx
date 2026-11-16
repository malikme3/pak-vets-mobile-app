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
  type SubmittedFarm,
} from "../services/farmVitalsApi";

const colors = {
  background: "#F8F8F2",
  ink: "#173D32",
  muted: "#63766C",
  green: "#1E7F5C",
  border: "#DFE6DC",
  surface: "#FFFFFF",
  danger: "#B42318",
};

function when(value: string | null): string {
  if (!value) return "Submission time unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function CollapseSection({
  title,
  subtitle,
  species,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  subtitle?: string;
  species?: string;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <View style={styles.collapse}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={styles.collapseHeader}
      >
        {species ? (
          <View style={styles.avatar}>
            <SpeciesIcon species={species} size={40} resizeMode="cover" />
          </View>
        ) : null}
        <View style={styles.cardCopy}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {subtitle ? <Text style={styles.help}>{subtitle}</Text> : null}
        </View>
        <Feather
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.green}
        />
      </Pressable>
      {expanded ? <View style={styles.collapseBody}>{children}</View> : null}
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
        <Text accessibilityRole="header" style={styles.title}>
          {review ? review.name : "Submitted farms"}
        </Text>
        <Text style={styles.subtitle}>
          {review
            ? when(review.submittedAt)
            : "Review the farms that have been registered."}
        </Text>
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
          farms.length ? (
            farms.map((farm) => (
              <Pressable
                key={farm.farmId}
                accessibilityRole="button"
                onPress={() => void openFarm(farm.farmId)}
                style={styles.card}
              >
                <View style={styles.cardCopy}>
                  <Text style={styles.cardTitle}>{farm.name}</Text>
                  <Text style={styles.help}>{when(farm.submittedAt)}</Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.green} />
              </Pressable>
            ))
          ) : (
            <Text style={styles.help}>No farms have been submitted yet.</Text>
          )
        ) : null}
        {review
          ? review.sections.map((section, index) => {
              const key = `farm-${index}`;
              const expanded = openSections[key] ?? true;
              return (
                <CollapseSection
                  key={key}
                  title={section.title}
                  expanded={expanded}
                  onToggle={() => toggleSection(key, true)}
                >
                  {section.rows.map((row) => (
                    <View key={`${key}-${row.label}`} style={styles.row}>
                      <Text style={styles.rowLabel}>{row.label}</Text>
                      <Text style={styles.rowValue}>{row.value}</Text>
                    </View>
                  ))}
                </CollapseSection>
              );
            })
          : null}
        {review ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Animals</Text>
            {review.animals.length ? (
              review.animals.map((animal) => {
                const key = `animal-${animal.entryId}`;
                const expanded = openSections[key] ?? false;
                return (
                  <CollapseSection
                    key={key}
                    title={animal.name}
                    subtitle={when(animal.submittedAt)}
                    species={animal.species}
                    expanded={expanded}
                    onToggle={() => toggleSection(key, false)}
                  >
                    {animal.sections.flatMap((section) =>
                      section.rows.map((row) => (
                        <View
                          key={`${key}-${section.title}-${row.label}`}
                          style={styles.row}
                        >
                          <Text style={styles.rowLabel}>{row.label}</Text>
                          <Text style={styles.rowValue}>{row.value}</Text>
                        </View>
                      )),
                    )}
                  </CollapseSection>
                );
              })
            ) : (
              <Text style={styles.help}>No animals have been added yet.</Text>
            )}
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: "/add-farm-animal",
                  params: { farmId: review.farmId },
                })
              }
              style={styles.action}
            >
              <Text style={styles.actionText}>Add Animal</Text>
            </Pressable>
          </View>
        ) : null}
        {!review ? (
          <Pressable accessibilityRole="button" onPress={() => void load()}>
            <Text style={styles.retry}>Refresh</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 24, paddingBottom: 40, gap: 14 },
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
  help: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 13 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  cardCopy: { flex: 1, gap: 4 },
  cardTitle: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  section: { gap: 10 },
  collapse: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  collapseHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E7F5EE",
  },
  collapseBody: { gap: 10, paddingHorizontal: 16, paddingBottom: 16 },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: "700" },
  row: {
    gap: 4,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowLabel: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  rowValue: { color: colors.ink, fontSize: 16 },
  retry: { color: colors.green, fontWeight: "700" },
  action: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});
