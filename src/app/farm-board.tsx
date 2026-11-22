import {
  farmBorder,
  farmCard,
  farmButton,
} from "../features/farm-vitals/presentation";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect, useRouter } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import * as Location from "expo-location";
import { FlowPageHeading } from "../features/farm-vitals/flow-page-heading";
import { distanceKm, type Coordinates } from "../utils/coordinates";
import { formatDistance } from "../utils/formatDistance";
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
  mint: "#E8F4ED",
  field: "#F5F7F3",
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

function farmNameRow(farm: FarmDashboardEntry) {
  return (
    farm.rows.find(
      (row) => row.key === "farm_name" || row.key === "farmName",
    ) ?? farm.rows.find((row) => /farm name/i.test(row.label))
  );
}

function landing(farm: FarmDashboardEntry): {
  title: string;
  highlights: FarmDashboardEntry["rows"];
  details: FarmDashboardEntry["rows"];
} {
  const name = farmNameRow(farm);
  const highlights = ownerLine(farm);
  return {
    title: name?.value.trim() || farm.name,
    highlights,
    details: farm.rows.filter(
      (row) => row.value.trim() && row !== name && !highlights.includes(row),
    ),
  };
}

function filterId(row: FarmDashboardEntry["rows"][number]): string {
  return `${row.groupKey ?? ""}:${row.key ?? row.label}`;
}

function withinOneEdit(left: string, right: string): boolean {
  if (Math.abs(left.length - right.length) > 1) return false;
  let index = 0;
  while (index < left.length && left[index] === right[index]) index++;
  if (left.length === right.length)
    return left.slice(index + 1) === right.slice(index + 1);
  return left.length > right.length
    ? left.slice(index + 1) === right.slice(index)
    : left.slice(index) === right.slice(index + 1);
}

function matches(farm: FarmDashboardEntry, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const name = farmNameRow(farm);
  return farm.rows.some((row) => {
    if (!row.filter) return false;
    const value = row === name ? row.value.trim() || farm.name : row.value;
    const searchable = value.toLowerCase();
    if (searchable.includes(needle)) return true;
    if (row !== name || needle.length < 4) return false;
    return (
      withinOneEdit(searchable, needle) ||
      searchable
        .split(/[^\p{L}\p{N}]+/u)
        .some((word) => withinOneEdit(word, needle))
    );
  });
}

export default function FarmBoardScreen() {
  const router = useRouter();
  const [radiusKm, setRadiusKm] = useState<5 | 25 | 50>(5);
  const [radiusOpen, setRadiusOpen] = useState(false);
  const [nearbyOrigin, setNearbyOrigin] = useState<Coordinates | null>(null);
  const [findingNearby, setFindingNearby] = useState(false);
  const [nearbyError, setNearbyError] = useState<string | null>(null);
  const [farms, setFarms] = useState<FarmDashboardEntry[]>([]);
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      setError(null);

      listFarmDashboard()
        .then((entries) => {
          if (!cancelled) setFarms(entries);
        })
        .catch((cause: unknown) => {
          if (!cancelled)
            setError(
              cause instanceof Error
                ? cause.message
                : "The farm dashboard could not be loaded.",
            );
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }, []),
  );

  const searchableFields = [
    ...new Set(
      farms.flatMap((farm) =>
        farm.rows.filter((row) => row.filter).map((row) => row.label),
      ),
    ),
  ];
  const canSearch = searchableFields.length > 0;
  const canSubmitSearch = canSearch && query.trim().length >= 3 && !searched;
  const searchQuery = canSearch ? appliedQuery : "";
  const located = farms.map((farm) => ({
    ...farm,
    distance:
      nearbyOrigin && farm.location
        ? distanceKm(nearbyOrigin, farm.location)
        : null,
  }));
  const shown = located.filter(
    (farm) =>
      matches(farm, searchQuery) &&
      (!nearbyOrigin || (farm.distance !== null && farm.distance <= radiusKm)),
  );
  if (nearbyOrigin)
    shown.sort(
      (left, right) =>
        (left.distance ?? Infinity) - (right.distance ?? Infinity),
    );
  const missingGps = farms.filter((farm) => !farm.location).length;

  async function searchNearby() {
    if (findingNearby) return;
    Keyboard.dismiss();
    setRadiusOpen(false);
    setFindingNearby(true);
    setNearbyError(null);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setNearbyError(
          "Allow location access in your device settings to search nearby farms.",
        );
        return;
      }
      const positionOptions = {
        accuracy: Location.Accuracy.Balanced,
        ...(Platform.OS === "web" ? { maximumAge: 0 } : {}),
      };
      const position = await Promise.race([
        Location.getCurrentPositionAsync(positionOptions),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new Error(
                  "Location took too long. Check that location services are on and try again.",
                ),
              ),
            20000,
          );
        }),
      ]);
      const origin = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      if (
        !Number.isFinite(origin.latitude) ||
        !Number.isFinite(origin.longitude) ||
        Math.abs(origin.latitude) > 90 ||
        Math.abs(origin.longitude) > 180
      )
        throw new Error(
          "Your location could not be determined. Please try again.",
        );
      setNearbyOrigin(origin);
    } catch {
      setNearbyError(
        "Could not get your location. Check location permissions and GPS, then try again.",
      );
    } finally {
      if (timer) clearTimeout(timer);
      setFindingNearby(false);
    }
  }

  function submitSearch() {
    if (!canSubmitSearch) return;
    setAppliedQuery(query.trim());
    setSearched(true);
    Keyboard.dismiss();
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <FlowPageHeading
          onBack={() => router.dismissTo("/farm-vitals")}
          title="Farm dashboard"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add farm"
          onPress={() => router.push("/create-farm")}
          style={styles.registerButton}
        >
          <Feather name="plus" size={18} color={colors.surface} />
          <Text style={styles.searchButtonText}>Add farm</Text>
        </Pressable>
        <View style={styles.searchRow}>
          <TextInput
            value={query}
            onChangeText={(value) => {
              setQuery(value);
              setSearched(false);
              if (!value.trim()) setAppliedQuery("");
            }}
            onSubmitEditing={submitSearch}
            editable={canSearch}
            placeholder="Search farms"
            placeholderTextColor={colors.muted}
            returnKeyType="search"
            style={styles.searchInput}
            accessibilityLabel="Search farms"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={searched ? "Search applied" : "Search"}
            onPress={submitSearch}
            disabled={!canSubmitSearch}
            style={[
              styles.searchButton,
              !canSubmitSearch && !searched && styles.searchDisabled,
            ]}
          >
            <Feather
              name={searched ? "check" : "search"}
              size={16}
              color="#FFFFFF"
            />
            <Text style={styles.searchButtonText}>Search</Text>
          </Pressable>
        </View>
        <View style={styles.nearbyPanel}>
          <View style={styles.nearbyRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Search nearby farms"
              disabled={loading || findingNearby}
              onPress={() => void searchNearby()}
              style={[
                styles.nearbyButton,
                (loading || findingNearby) && styles.searchDisabled,
              ]}
            >
              {findingNearby ? (
                <ActivityIndicator size="small" color={colors.green} />
              ) : (
                <Feather name="crosshair" size={17} color={colors.green} />
              )}
              <Text
                numberOfLines={1}
                style={[styles.nearbyButtonText, styles.nearbyButtonLabel]}
              >
                {findingNearby ? "Getting location…" : "Search nearby"}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose nearby radius"
              accessibilityState={{ expanded: radiusOpen }}
              aria-expanded={radiusOpen}
              onPress={() => setRadiusOpen((current) => !current)}
              style={styles.radiusPicker}
            >
              <Text style={styles.nearbyButtonText}>{radiusKm} km</Text>
              <Feather
                name={radiusOpen ? "chevron-up" : "chevron-down"}
                size={14}
                color={colors.green}
              />
            </Pressable>
            {nearbyOrigin ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear nearby search"
                disabled={findingNearby}
                onPress={() => {
                  setNearbyOrigin(null);
                  setNearbyError(null);
                  setRadiusOpen(false);
                }}
                style={styles.clearNearby}
              >
                <Feather name="x" size={17} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>
          {radiusOpen ? (
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel="Nearby search radius"
              style={styles.radiusRow}
            >
              {([5, 25, 50] as const).map((radius) => (
                <Pressable
                  key={radius}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: radiusKm === radius }}
                  aria-checked={radiusKm === radius}
                  accessibilityLabel={`${radius} km radius`}
                  onPress={() => {
                    setRadiusKm(radius);
                    setRadiusOpen(false);
                  }}
                  style={[
                    styles.radiusOption,
                    radiusKm === radius && styles.radiusSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.radiusText,
                      radiusKm === radius && styles.radiusSelectedText,
                    ]}
                  >
                    {radius} km
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {nearbyOrigin ? (
            <Text style={styles.help}>
              {shown.length} {shown.length === 1 ? "farm" : "farms"} within{" "}
              {radiusKm} km{searchQuery ? " matching your search" : ""} ·
              Nearest first
            </Text>
          ) : null}
          {nearbyOrigin && missingGps > 0 ? (
            <Text style={styles.help}>
              {missingGps} {missingGps === 1 ? "farm has" : "farms have"} no
              available GPS and {missingGps === 1 ? "is" : "are"} excluded.
            </Text>
          ) : null}
          {nearbyError ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {nearbyError}
            </Text>
          ) : null}
        </View>
        {!loading && !error && farms.length > 0 && !canSearch ? (
          <Text style={styles.help}>
            No fields are enabled for filtering in the farm template.
          </Text>
        ) : null}
        {canSearch ? (
          <Text style={styles.help}>
            Search by {searchableFields.join(", ")}.
          </Text>
        ) : null}
        {loading ? (
          <View style={styles.status}>
            <ActivityIndicator color={colors.green} />
            <Text style={styles.help}>Loading dashboard…</Text>
          </View>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!loading && !error && !shown.length ? (
          <Text style={styles.help}>
            {nearbyOrigin
              ? `No farms found within ${radiusKm} km${searchQuery ? " matching your search" : ""}. Try a larger radius or clear nearby search.`
              : searchQuery
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
              accessibilityLabel={[
                place.title,
                ...place.highlights.map((row) => row.value),
                ...place.details.map((row) => `${row.label}, ${row.value}`),
              ].join(". ")}
              accessibilityHint="Opens the farm"
              onPress={() =>
                router.push({
                  pathname: "/farm-dashboard",
                  params: { farmId: farm.farmId },
                })
              }
              style={({ pressed }) => [
                styles.card,
                pressed && styles.cardPressed,
              ]}
            >
              <View style={styles.landing}>
                <View style={styles.farmIcon} accessible={false}>
                  <Feather name="home" size={19} color={colors.green} />
                </View>
                <View style={styles.landingCopy}>
                  <Text style={styles.farmName}>{place.title}</Text>
                  {nearbyOrigin && farm.distance !== null ? (
                    <Text style={styles.distanceLabel}>
                      {formatDistance(farm.distance)} away
                    </Text>
                  ) : null}
                  {place.highlights.length ? (
                    <Text style={styles.subline}>
                      {place.highlights.map((row, index) => (
                        <Text
                          key={filterId(row)}
                          style={
                            /phone|mobile/i.test(
                              `${row.key ?? ""} ${row.label}`,
                            )
                              ? styles.subPhone
                              : undefined
                          }
                        >
                          {index ? "  ·  " : ""}
                          {row.value}
                        </Text>
                      ))}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.openIcon} accessible={false}>
                  <Feather
                    name="chevron-right"
                    size={18}
                    color={colors.green}
                  />
                </View>
              </View>
              {place.details.length ? (
                <View style={styles.facts}>
                  {place.details.map((row, index) => (
                    <View
                      key={`${filterId(row)}-${index}`}
                      style={[
                        styles.fact,
                        row.fullWidth === true && styles.factWide,
                      ]}
                    >
                      <Text style={styles.factLabel}>{row.label}</Text>
                      <Text style={styles.factValue}>{row.value}</Text>
                    </View>
                  ))}
                </View>
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
  title: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.3,
    textAlign: "center",
  },
  help: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 13 },
  status: { flexDirection: "row", alignItems: "center", gap: 10 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  searchInput: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: farmBorder,
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
    ...farmButton,
  },
  registerButton: {
    alignSelf: "stretch",
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.green,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...farmButton,
  },
  nearbyPanel: { gap: 6 },
  nearbyRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  nearbyButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    gap: 8,
    borderRadius: 12,
    backgroundColor: colors.mint,
    ...farmButton,
  },
  nearbyButtonLabel: { flexShrink: 1 },
  radiusPicker: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: colors.surface,
    ...farmButton,
  },
  nearbyButtonText: { color: colors.green, fontSize: 14, fontWeight: "700" },
  radiusRow: { flexDirection: "row", gap: 8 },
  radiusOption: {
    backgroundColor: colors.surface,
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    ...farmButton,
  },
  radiusSelected: { backgroundColor: colors.green, borderColor: colors.green },
  radiusText: { color: colors.muted, fontWeight: "600", fontSize: 14 },
  radiusSelectedText: { color: colors.surface },
  clearNearby: {
    minHeight: 44,
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderRadius: 12,
    ...farmButton,
  },
  distanceLabel: { color: colors.green, fontSize: 12, fontWeight: "600" },
  searchDisabled: { opacity: 0.5 },
  searchButtonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },
  card: {
    padding: 14,
    gap: 12,
    ...farmCard,
  },
  cardPressed: { borderColor: colors.green, backgroundColor: "#F4FAF6" },
  landing: { flexDirection: "row", alignItems: "center", gap: 10 },
  farmIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.mint,
  },
  landingCopy: { flex: 1, gap: 3 },
  farmName: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  subline: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  subPhone: { color: colors.green, fontWeight: "700" },
  openIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.field,
  },
  facts: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 8,
  },
  fact: {
    width: "49%",
    backgroundColor: colors.field,
    borderRadius: 11,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 3,
  },
  factWide: { width: "100%" },
  factLabel: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  factValue: { color: colors.ink, fontSize: 14, fontWeight: "700" },
});
