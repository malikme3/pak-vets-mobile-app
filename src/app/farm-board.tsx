import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import {
  listFarmDashboard,
  type FarmDashboardEntry,
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

function isOwnerGroup(row: FarmDashboardEntry["rows"][number]): boolean {
  return /owner|contact/i.test(row.groupKey ?? "");
}

function ownerLine(farm: FarmDashboardEntry): FarmDashboardEntry["rows"] {
  const rows = farm.rows.filter((row) => row.value);
  const name = rows.find(
    (row) =>
      isOwnerGroup(row) &&
      (/^(full_name|owner_name)$/i.test(row.key ?? "") ||
        /full name|owner name/i.test(row.label)),
  );
  const phone = rows.find(
    (row) =>
      isOwnerGroup(row) &&
      (/^(phone|mobile)$/i.test(row.key ?? "") ||
        /\bphone\b|\bmobile\b/i.test(row.label)),
  );
  return [name, phone].flatMap((row) => (row ? [row] : []));
}

function landing(farm: FarmDashboardEntry): {
  title: string;
  highlights: FarmDashboardEntry["rows"];
  details: FarmDashboardEntry["rows"];
} {
  const name =
    farm.rows.find((row) => row.key === "farm_name" || row.key === "farmName") ??
    farm.rows.find((row) => /farm name/i.test(row.label));
  const highlights = ownerLine(farm);
  return {
    title: name?.value || farm.name,
    highlights,
    details: farm.rows.filter((row) => row !== name && !highlights.includes(row)),
  };
}

function filterId(row: FarmDashboardEntry["rows"][number]): string {
  return `${row.groupKey ?? ""}:${row.key ?? row.label}`;
}

function dashboardFilters(farms: FarmDashboardEntry[]): {
  id: string;
  label: string;
  values: string[];
}[] {
  const filters = new Map<string, { id: string; label: string; values: string[] }>();
  for (const farm of farms) {
    for (const row of farm.rows) {
      if (!row.filter) continue;
      const id = filterId(row);
      const current = filters.get(id) ?? { id, label: row.label, values: [] };
      if (row.value && !current.values.includes(row.value))
        current.values.push(row.value);
      filters.set(id, current);
    }
  }
  return [...filters.values()]
    .filter((filter) => filter.values.length > 0)
    .map((filter) => ({
      ...filter,
      values: [...filter.values].sort((left, right) => left.localeCompare(right)),
    }));
}

function matchesFilters(
  farm: FarmDashboardEntry,
  selected: Record<string, string>,
): boolean {
  return Object.entries(selected).every(([id, value]) => {
    if (!value) return true;
    return farm.rows.some(
      (row) => row.filter && filterId(row) === id && row.value === value,
    );
  });
}

function matches(farm: FarmDashboardEntry, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return farm.rows.some(
    (row) => row.filter && row.value.toLowerCase().includes(needle),
  );
}

export default function FarmBoardScreen() {
  const router = useRouter();
  const [farms, setFarms] = useState<FarmDashboardEntry[]>([]);
  const [query, setQuery] = useState("");
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setFarms(await listFarmDashboard());
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The farm dashboard could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filters = dashboardFilters(farms);
  const shown = farms.filter(
    (farm) => matches(farm, query) && matchesFilters(farm, selectedFilters),
  );
  const narrowing =
    Boolean(query.trim()) || Object.values(selectedFilters).some(Boolean);

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
          <Text style={styles.backText}>Farm Vitals</Text>
        </Pressable>
        <View style={styles.titleRow}>
          <View style={styles.titleCopy}>
            <Text accessibilityRole="header" style={styles.title}>
              Farm dashboard
            </Text>
            <Text style={styles.help}>
              Owner name and phone sit under the farm name when they are saved.
            </Text>
          </View>
        </View>
        <View style={styles.searchRow}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => Keyboard.dismiss()}
            placeholder="Search filtered fields"
            placeholderTextColor={colors.muted}
            returnKeyType="search"
            style={styles.searchInput}
            accessibilityLabel="Search farms"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Search"
            onPress={() => Keyboard.dismiss()}
            style={styles.searchButton}
          >
            <Feather name="search" size={16} color="#FFFFFF" />
            <Text style={styles.searchButtonText}>Search</Text>
          </Pressable>
        </View>
        {filters.map((filter) => (
          <View key={filter.id} style={styles.filterBlock}>
            <Text style={styles.filterLabel}>{filter.label}</Text>
            <ScrollView
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterChips}
            >
              {["", ...filter.values].map((value) => {
                const on = (selectedFilters[filter.id] ?? "") === value;
                return (
                  <Pressable
                    key={value || "all"}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    onPress={() =>
                      setSelectedFilters((current) => ({
                        ...current,
                        [filter.id]: value,
                      }))
                    }
                    style={[styles.chip, on ? styles.chipOn : null]}
                  >
                    <Text style={on ? styles.chipTextOn : styles.chipText}>
                      {value || "All"}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ))}
        {loading ? (
          <View style={styles.status}>
            <ActivityIndicator color={colors.green} />
            <Text style={styles.help}>Loading dashboard…</Text>
          </View>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!loading && !error && !shown.length ? (
          <Text style={styles.help}>
            {narrowing
              ? "No farms match that search."
              : "No dashboard fields are turned on yet."}
          </Text>
        ) : null}
        {shown.map((farm) => {
          const place = landing(farm);
          return (
            <Pressable
              key={farm.farmId}
              accessibilityRole="button"
              accessibilityLabel={`Open ${place.title}`}
              onPress={() =>
                router.push({
                  pathname: "/farm-dashboard",
                  params: { farmId: farm.farmId },
                })
              }
              style={styles.card}
            >
              <View
                style={[
                  styles.landing,
                  place.details.length ? styles.landingRule : null,
                ]}
              >
                <View style={styles.landingCopy}>
                  <Text numberOfLines={1} style={styles.farmName}>
                    {place.title}
                  </Text>
                  {place.highlights.length ? (
                    <Text numberOfLines={1} style={styles.subline}>
                      {place.highlights.map((row, index) => (
                        <Text
                          key={`${farm.farmId}-highlight-${row.key ?? row.label}-${index}`}
                          style={
                            /phone|mobile/i.test(`${row.key ?? ""} ${row.label}`)
                              ? styles.subPhone
                              : styles.subCity
                          }
                        >
                          {index ? "  ·  " : ""}
                          {row.value}
                        </Text>
                      ))}
                    </Text>
                  ) : null}
                </View>
                <Feather name="chevron-right" size={16} color="#A8B7AE" />
              </View>
              {place.details.map((row, index) => (
                <View
                  key={`${farm.farmId}-${row.key ?? row.label}-${index}`}
                  style={[styles.fact, index ? styles.factRule : null]}
                >
                  <Text numberOfLines={1} style={styles.factLabel}>
                    {row.label}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={row.value ? styles.factValue : styles.factEmpty}
                  >
                    {row.value || "—"}
                  </Text>
                </View>
              ))}
              {!farm.rows.length ? (
                <Text style={styles.emptyNote}>No dashboard fields saved.</Text>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 16, paddingBottom: 32, gap: 10 },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    minHeight: 36,
  },
  backText: { color: colors.green, fontSize: 15, fontWeight: "700" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  titleCopy: { flex: 1, gap: 2 },
  title: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  help: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  emptyNote: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  error: { color: colors.danger, fontSize: 13 },
  status: { flexDirection: "row", alignItems: "center", gap: 10 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  searchInput: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    color: colors.ink,
    fontSize: 15,
  },
  searchButton: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.green,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  searchButtonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },
  filterBlock: { gap: 6 },
  filterLabel: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  filterChips: { gap: 6, paddingRight: 4 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipOn: { backgroundColor: colors.green, borderColor: colors.green },
  chipText: { color: colors.ink, fontSize: 13, fontWeight: "600" },
  chipTextOn: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  landing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
  },
  landingRule: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  landingCopy: { flex: 1, gap: 2 },
  farmName: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  subline: { fontSize: 13, lineHeight: 18 },
  subCity: { color: colors.ink, fontWeight: "600" },
  subPhone: { color: colors.green, fontWeight: "700" },
  fact: {
    minHeight: 36,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  factRule: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  factLabel: {
    flex: 1,
    color: colors.muted,
    fontSize: 13,
    fontWeight: "500",
  },
  factValue: {
    flexShrink: 1,
    color: colors.ink,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "right",
  },
  factEmpty: {
    color: "#C5D0CA",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "right",
  },
});
