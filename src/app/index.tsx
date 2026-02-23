import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuthStore } from "../store/authStore";
import { StatusBar } from "expo-status-bar";
import * as Location from "expo-location";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useTheme } from "../theme/useTheme";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { useCurrentDoctor } from "../features/doctors/hooks";
import { useCasesByDoctor, useDeleteCase } from "../features/cases/hooks";
import { useAnimalImages, useAnimal } from "../features/animals/hooks";
import { caseApi } from "../services/vetApi";
import { getFirebaseAuth } from "../services/firebase";
import {
  getCaseDistanceKm,
  formatCaseDistanceLabel,
} from "../utils/formatDistance";
import type { Case } from "../types/api";

const ACTIVE_CASES_LIMIT_MIN = 1;
const ACTIVE_CASES_LIMIT_MAX = 100;
const ACTIVE_CASES_LIMIT_DEFAULT = 15;
const NEARBY_RADIUS_KM = 0.5;

export default function DashboardScreen() {
  const router = useRouter();
  const authStatus = useAuthStore((state) => state.status);
  const clearAuth = useAuthStore((state) => state.clear);
  const isAuthed = authStatus === "signedIn";
  const {
    colors,
    isAltTheme,
    variant,
    isNeonTheme,
    isEcoTheme,
    toggleThemeVariant,
    themeName,
    copy,
  } = useTheme();
  const [activeCasesLimit, setActiveCasesLimit] = useState(
    ACTIVE_CASES_LIMIT_DEFAULT,
  );
  const [finding, setFinding] = useState(false);
  const [nearbyCases, setNearbyCases] = useState<Case[] | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const {
    data: doctor,
    isLoading: doctorLoading,
    error: doctorError,
    refetch: refetchDoctor,
  } = useCurrentDoctor();
  const {
    data: allCases,
    isLoading: casesLoading,
    refetch: refetchCases,
  } = useCasesByDoctor(doctor?.doctorId ?? 0);
  const deleteCaseMutation = useDeleteCase();

  useFocusEffect(
    useCallback(() => {
      if (doctor?.doctorId) refetchCases();
    }, [doctor?.doctorId, refetchCases]),
  );

  const activeCases = useMemo(
    () =>
      allCases
        ? [...allCases]
            .filter((c) => c.isActive)
            .sort(
              (a, b) =>
                new Date(b.caseDatetime).getTime() -
                new Date(a.caseDatetime).getTime(),
            )
            .slice(0, activeCasesLimit)
        : [],
    [allCases, activeCasesLimit],
  );

  const findNearby = useCallback(async () => {
    if (!doctor) return;
    setLocationError(null);
    setFinding(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationError(
          "Location permission is required to find nearby cases.",
        );
        setFinding(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const cases = await caseApi.getCasesByDoctor(doctor.doctorId, {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        radiusKm: NEARBY_RADIUS_KM,
      });
      setNearbyCases(cases);
    } catch (err) {
      setLocationError(
        err instanceof Error ? err.message : "Could not get location",
      );
      setNearbyCases(null);
    } finally {
      setFinding(false);
    }
  }, [doctor]);

  const formatDate = useCallback((dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  const handleCasePress = useCallback(
    (caseId: number) => {
      router.push(`/case-detail?caseId=${caseId}`);
    },
    [router],
  );

  const handleDeleteCase = useCallback(
    (caseItem: Case) => {
      Alert.alert(
        "Delete Case",
        `Delete Case #${caseItem.caseId}? This will remove the case and all related diagnoses, treatments, and notes.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                await deleteCaseMutation.mutateAsync(caseItem.caseId);
              } catch (error) {
                Alert.alert(
                  "Error",
                  error instanceof Error
                    ? error.message
                    : "Failed to delete case",
                );
              }
            },
          },
        ],
      );
    },
    [deleteCaseMutation],
  );

  const renderCaseItem = useCallback(
    ({ item }: { item: Case }) => (
      <CaseRow
        caseItem={item}
        formatDate={formatDate}
        onPress={() => handleCasePress(item.caseId)}
        onDelete={() => handleDeleteCase(item)}
        isDeleting={deleteCaseMutation.isPending}
      />
    ),
    [
      formatDate,
      handleCasePress,
      handleDeleteCase,
      deleteCaseMutation.isPending,
    ],
  );

  if (!isAuthed) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <StatusBar style="auto" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (doctorLoading || casesLoading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <StatusBar style="auto" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!doctor && !doctorLoading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <StatusBar style="auto" />
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.text }]}>
            Failed to load doctor data
          </Text>
          {doctorError && (
            <Text style={[styles.errorDetail, { color: colors.muted }]}>
              {doctorError instanceof Error
                ? doctorError.message
                : "Unknown error"}
            </Text>
          )}
          <Button
            title="Retry"
            onPress={() => refetchDoctor()}
            variant="primary"
            style={styles.retryButton}
            leftIcon={
              <FontAwesome name="refresh" size={14} color={colors.onPrimary} />
            }
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!doctor) {
    return null;
  }

  const handleNewCase = () => {
    router.push("/create-case");
  };
  const nearbyHintText = copy.nearbyHint.replace(
    "{{radius}}",
    String(NEARBY_RADIUS_KM),
  );
  const nextThemeLabel =
    variant === "classic"
      ? "Neon Menagerie Orbit"
      : variant === "neonMenagerieOrbit"
        ? "Eco-Organic"
        : "Classic Clinical";
  const nextThemeIcon: keyof typeof FontAwesome.glyphMap =
    variant === "classic"
      ? "magic"
      : variant === "neonMenagerieOrbit"
        ? "leaf"
        : "sun-o";

  return (
    <>
      <StatusBar style="auto" />
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Card
            style={[
              styles.heroCard,
              isAltTheme && styles.heroCardAlt,
              {
                backgroundColor: `${colors.primary}14`,
                borderColor: isAltTheme ? `${colors.accent}88` : colors.border,
              },
            ]}
          >
            {isAltTheme ? (
              <>
                <View
                  style={[
                    styles.heroTextureBlob,
                    { backgroundColor: `${colors.accent}35` },
                  ]}
                />
                <View
                  style={[
                    styles.heroTextureRing,
                    { borderColor: `${colors.primary}5f` },
                  ]}
                />
              </>
            ) : null}
            <View style={styles.heroTop}>
              <View style={styles.heroBadge}>
                <FontAwesome
                  name="stethoscope"
                  size={14}
                  color={colors.primary}
                />
                <Text
                  style={[
                    styles.heroBadgeText,
                    isAltTheme && styles.heroBadgeTextAlt,
                    { color: colors.primary },
                  ]}
                >
                  {copy.dashboardLabel}
                </Text>
              </View>
              <View style={styles.heroTopActions}>
                <TouchableOpacity
                  style={[
                    styles.themeToggle,
                    {
                      backgroundColor: isAltTheme
                        ? `${colors.accent}2e`
                        : `${colors.primary}1a`,
                      borderColor: isAltTheme
                        ? `${colors.accent}a8`
                        : `${colors.primary}65`,
                    },
                  ]}
                  onPress={toggleThemeVariant}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`Switch theme from ${themeName} to ${nextThemeLabel}`}
                >
                  <FontAwesome
                    name={nextThemeIcon}
                    size={12}
                    color={isAltTheme ? colors.accent : colors.primary}
                  />
                  <Text
                    style={[
                      styles.themeToggleText,
                      { color: isAltTheme ? colors.accent : colors.primary },
                    ]}
                  >
                    {nextThemeLabel}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.logoutButton,
                    {
                      borderColor: `${colors.primary}50`,
                      backgroundColor: `${colors.primary}12`,
                    },
                  ]}
                  onPress={async () => {
                    const auth = getFirebaseAuth();
                    if (auth.currentUser) {
                      await auth.signOut();
                    }
                    await clearAuth();
                  }}
                  activeOpacity={0.8}
                >
                  <FontAwesome
                    name="sign-out"
                    size={12}
                    color={colors.primary}
                  />
                  <Text style={[styles.logoutText, { color: colors.primary }]}>
                    Logout
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            <Text
              style={[
                styles.heroTitle,
                isNeonTheme && styles.heroTitleAlt,
                { color: colors.text },
              ]}
            >
              Welcome back, {copy.dashboardGreetingPrefix} {doctor.fullName}
            </Text>
            <Text
              style={[
                styles.heroSubtitle,
                isNeonTheme && styles.heroSubtitleAlt,
                { color: colors.muted },
              ]}
            >
              {copy.dashboardSubtitle}
            </Text>
            {doctor.locationName ? (
              <View style={styles.locationRow}>
                <FontAwesome name="map-marker" size={13} color={colors.muted} />
                <Text
                  style={[
                    styles.locationText,
                    (isNeonTheme || isEcoTheme) && styles.locationTextAlt,
                    { color: colors.muted },
                  ]}
                >
                  {doctor.locationName}
                </Text>
              </View>
            ) : null}
          </Card>

          <View style={styles.quickActionsSection}>
            <Button
              title={copy.primaryActionTitle}
              onPress={handleNewCase}
              variant="primary"
              leftIcon={
                <FontAwesome name="plus" size={12} color={colors.onPrimary} />
              }
            />
            <Button
              title={
                finding ? copy.nearbyActionLoadingTitle : copy.nearbyActionTitle
              }
              onPress={findNearby}
              variant="secondary"
              style={styles.quickActionButton}
              disabled={finding}
              leftIcon={
                <FontAwesome
                  name="location-arrow"
                  size={12}
                  color={colors.primary}
                />
              }
            />
          </View>

          <View style={styles.recentCasesSection}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionHeaderTextWrap}>
                <Text
                  style={[
                    styles.sectionTitle,
                    (isNeonTheme || isEcoTheme) && styles.sectionTitleAlt,
                    { color: colors.text },
                  ]}
                >
                  {copy.openCasesTitle}
                </Text>
                <Text
                  style={[
                    styles.sectionCaption,
                    (isNeonTheme || isEcoTheme) && styles.sectionCaptionAlt,
                    styles.sectionCaptionNoUpper,
                    { color: colors.muted },
                  ]}
                >
                  {copy.openCasesCaption}
                </Text>
              </View>
              <View style={styles.limitCounter}>
                <View style={styles.limitHintWrap}>
                  <FontAwesome
                    name="info-circle"
                    size={11}
                    color={colors.muted}
                  />
                  <Text style={[styles.limitHintText, { color: colors.muted }]}>
                    Show up to
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() =>
                    setActiveCasesLimit((n) =>
                      Math.max(ACTIVE_CASES_LIMIT_MIN, n - 1),
                    )
                  }
                  style={[
                    styles.limitButton,
                    {
                      borderColor: `${colors.primary}44`,
                      backgroundColor: colors.surface,
                    },
                  ]}
                  accessibilityLabel="Decrease list limit"
                >
                  <FontAwesome name="minus" size={12} color={colors.primary} />
                </TouchableOpacity>
                <Text
                  style={[styles.limitValue, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {activeCasesLimit}
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    setActiveCasesLimit((n) =>
                      Math.min(ACTIVE_CASES_LIMIT_MAX, n + 1),
                    )
                  }
                  style={[
                    styles.limitButton,
                    {
                      borderColor: `${colors.primary}44`,
                      backgroundColor: colors.surface,
                    },
                  ]}
                  accessibilityLabel="Increase list limit"
                >
                  <FontAwesome name="plus" size={12} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </View>
            {activeCases.length > 0 ? (
              <View style={styles.casesList}>
                {activeCases.map((item) => (
                  <View key={item.caseId} style={styles.caseCardSpacer}>
                    {renderCaseItem({ item })}
                  </View>
                ))}
              </View>
            ) : (
              <Card style={styles.emptyCard}>
                <Text style={[styles.emptyText, { color: colors.muted }]}>
                  {copy.noCasesText}
                </Text>
              </Card>
            )}
          </View>

          {nearbyCases !== null && (
            <View style={styles.nearbySection}>
              <View style={styles.nearbyHeader}>
                <FontAwesome
                  name="crosshairs"
                  size={14}
                  color={colors.primary}
                />
                <Text
                  style={[
                    styles.sectionTitle,
                    (isNeonTheme || isEcoTheme) && styles.sectionTitleAlt,
                    { color: colors.text },
                  ]}
                >
                  {copy.nearbyTitle}
                </Text>
              </View>
              {locationError && (
                <Text
                  style={[styles.nearbyError, { color: colors.danger }]}
                  numberOfLines={2}
                >
                  {locationError}
                </Text>
              )}
              <Text
                style={[
                  styles.nearbyHint,
                  (isNeonTheme || isEcoTheme) && styles.nearbyHintAlt,
                  { color: colors.muted },
                ]}
              >
                {nearbyHintText}
              </Text>
              {nearbyCases.length > 0 ? (
                <View style={styles.casesList}>
                  {nearbyCases.map((item) => (
                    <View key={item.caseId} style={styles.caseCardSpacer}>
                      {renderCaseItem({ item })}
                    </View>
                  ))}
                </View>
              ) : (
                <Card style={styles.emptyCard}>
                  <Text style={[styles.emptyText, { color: colors.muted }]}>
                    {copy.noNearbyText}
                  </Text>
                </Card>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 28,
  },
  heroCard: {
    marginTop: 4,
    marginBottom: 8,
    borderWidth: 0,
    overflow: "hidden",
    position: "relative",
  },
  heroCardAlt: {
    borderWidth: 1,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  heroTextureBlob: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    top: -48,
    right: -50,
  },
  heroTextureRing: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 2,
    bottom: -96,
    left: -42,
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  heroBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  heroBadgeTextAlt: {
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  heroTopActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  themeToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  themeToggleText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  logoutText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: "700",
    lineHeight: 30,
  },
  heroTitleAlt: {
    fontSize: 26,
    lineHeight: 31,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  heroSubtitleAlt: {
    fontSize: 15,
    lineHeight: 21,
    letterSpacing: 0.2,
  },
  locationRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  locationText: {
    fontSize: 14,
    fontWeight: "500",
  },
  locationTextAlt: {
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  quickActionsSection: {
    marginTop: 14,
    gap: 12,
  },
  quickActionButton: {
    marginTop: 0,
  },
  recentCasesSection: {
    marginTop: 24,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "flex-start",
    flexWrap: "wrap",
    marginBottom: 12,
    gap: 10,
  },
  sectionHeaderTextWrap: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 0,
  },
  sectionTitleAlt: {
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: "800",
    fontSize: 17,
  },
  sectionCaption: {
    fontSize: 13,
    marginTop: 2,
  },
  sectionCaptionAlt: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  sectionCaptionNoUpper: {
    textTransform: "none",
    letterSpacing: 0,
  },
  limitCounter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
    marginLeft: "auto",
    marginTop: 2,
  },
  limitHintWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginRight: 2,
  },
  limitHintText: {
    fontSize: 11,
    fontWeight: "500",
  },
  limitButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  limitValue: {
    fontSize: 16,
    fontWeight: "700",
    minWidth: 22,
    textAlign: "center",
  },
  nearbySection: {
    marginTop: 26,
  },
  nearbyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  nearbyHint: {
    fontSize: 14,
    marginBottom: 10,
  },
  nearbyHintAlt: {
    fontSize: 13,
    letterSpacing: 0.25,
  },
  nearbyError: {
    fontSize: 14,
    marginBottom: 8,
  },
  casesList: {
    gap: 0,
  },
  caseCardSpacer: {
    marginBottom: 12,
  },
  emptyCard: {
    paddingVertical: 18,
  },
  emptyText: {
    fontSize: 15,
    textAlign: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  errorText: {
    fontSize: 16,
    marginBottom: 8,
  },
  errorDetail: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 8,
  },
  caseCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    overflow: "hidden",
    minHeight: 72,
    borderWidth: 1,
  },
  caseCardPhoto: {
    width: 72,
    height: 72,
    backgroundColor: "#2a2a2a",
    justifyContent: "center",
    alignItems: "center",
  },
  caseCardPhotoImage: {
    width: 72,
    height: 72,
  },
  caseCardPhotoPlaceholder: {
    fontSize: 20,
    fontWeight: "700",
  },
  caseCardBody: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    justifyContent: "center",
    minWidth: 0,
  },
  caseCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  caseCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
    marginRight: 6,
  },
  caseCardHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  distanceBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 9,
    maxWidth: 84,
  },
  distanceBadgeIconWrap: {
    marginRight: 4,
  },
  distanceBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  caseCardStatusIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  caseCardComplaint: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 1,
    opacity: 0.95,
  },
  caseCardMeta: {
    fontSize: 12,
    opacity: 0.78,
  },
  caseCardActions: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
    paddingRight: 10,
  },
  caseCardDeleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});

interface CaseRowProps {
  caseItem: Case;
  formatDate: (dateString: string) => string;
  onPress: () => void;
  onDelete: () => void;
  isDeleting?: boolean;
}

function CaseRow({
  caseItem,
  formatDate,
  onPress,
  onDelete,
  isDeleting,
}: CaseRowProps) {
  const { colors, isAltTheme } = useTheme();
  const { data: animalImages = [] } = useAnimalImages(caseItem.animalId);
  const { data: animal } = useAnimal(caseItem.animalId);
  const faceUrl =
    animalImages.find((i) => i.imageType === "FACE")?.s3Url ?? null;
  const ownerName = animal?.farmer?.fullName ?? "-";
  const status = caseItem.status ?? "IN_PROGRESS";
  const isCompleted = status === "COMPLETED";
  const distanceKm = getCaseDistanceKm(caseItem);
  const distanceLabel = formatCaseDistanceLabel(distanceKm);

  return (
    <View
      style={[
        styles.caseCard,
        {
          backgroundColor: colors.surface,
          borderColor: `${colors.border}`,
          shadowColor: isAltTheme ? colors.accent : "#0f172a",
          shadowOpacity: isAltTheme ? 0.18 : 0.07,
          shadowRadius: isAltTheme ? 11 : 7,
          shadowOffset: { width: 0, height: isAltTheme ? 8 : 3 },
          elevation: isAltTheme ? 5 : 2,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.caseCardPhoto}
        onPress={onPress}
        activeOpacity={0.85}
      >
        {faceUrl ? (
          <Image
            source={{ uri: faceUrl }}
            style={styles.caseCardPhotoImage}
            resizeMode="cover"
          />
        ) : (
          <Text
            style={[styles.caseCardPhotoPlaceholder, { color: colors.muted }]}
          >
            ?
          </Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.caseCardBody}
        onPress={onPress}
        activeOpacity={0.85}
      >
        <View>
          <View style={styles.caseCardHeader}>
            <Text
              style={[styles.caseCardTitle, { color: colors.text }]}
              numberOfLines={1}
            >
              Case #{caseItem.caseId}
            </Text>
            <View style={styles.caseCardHeaderRight}>
              {distanceLabel ? (
                <View
                  style={[
                    styles.distanceBadge,
                    { backgroundColor: `${colors.primary}18` },
                  ]}
                >
                  <View style={styles.distanceBadgeIconWrap}>
                    <FontAwesome
                      name="map-marker"
                      size={10}
                      color={colors.primary}
                    />
                  </View>
                  <Text
                    style={[
                      styles.distanceBadgeText,
                      { color: colors.primary },
                    ]}
                    numberOfLines={1}
                  >
                    {distanceLabel}
                  </Text>
                </View>
              ) : null}
              <View
                style={[
                  styles.caseCardStatusIcon,
                  {
                    backgroundColor: isCompleted
                      ? (colors.success ?? "#22c55e") + "22"
                      : (colors.warning ?? "#eab308") + "22",
                    borderWidth: isAltTheme ? 1 : 0,
                    borderColor: isCompleted
                      ? `${colors.success}67`
                      : `${colors.warning}67`,
                  },
                ]}
              >
                <FontAwesome
                  name={isCompleted ? "check-circle" : "clock-o"}
                  size={14}
                  color={isCompleted ? colors.success : colors.warning}
                />
              </View>
            </View>
          </View>
          {caseItem.chiefComplaint ? (
            <Text
              style={[styles.caseCardComplaint, { color: colors.text }]}
              numberOfLines={1}
            >
              {caseItem.chiefComplaint}
            </Text>
          ) : null}
          <Text
            style={[styles.caseCardMeta, { color: colors.muted }]}
            numberOfLines={1}
          >
            {ownerName} · {formatDate(caseItem.caseDatetime)}
          </Text>
        </View>
      </TouchableOpacity>
      <View style={styles.caseCardActions}>
        <TouchableOpacity
          onPress={onDelete}
          disabled={isDeleting}
          style={[
            styles.caseCardDeleteBtn,
            { borderColor: `${colors.danger}a3` },
            isDeleting && { opacity: 0.5 },
          ]}
          activeOpacity={0.7}
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color={colors.danger} />
          ) : (
            <FontAwesome name="trash-o" size={13} color={colors.danger} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
