import { useCallback, useState } from "react";
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
import { useRouter } from "expo-router";
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
  const { colors } = useTheme();
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
  const { data: allCases, isLoading: casesLoading } = useCasesByDoctor(
    doctor?.doctorId ?? 0,
  );
  const deleteCaseMutation = useDeleteCase();

  const activeCases = allCases
    ? [...allCases]
        .filter((c) => c.isActive)
        .sort(
          (a, b) =>
            new Date(b.caseDatetime).getTime() -
            new Date(a.caseDatetime).getTime(),
        )
        .slice(0, activeCasesLimit)
    : [];

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
          />
        </View>
      </SafeAreaView>
    );
  }

  const handleNewCase = () => {
    router.push("/create-case");
  };

  // Guard: ensure doctor exists before rendering
  if (!doctor) {
    return null;
  }

  return (
    <>
      <StatusBar style="auto" />
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
        >
          <Text style={[styles.welcomeText, { color: colors.text }]}>
            Welcome to Dashboard
          </Text>

          {/* Doctor Header Card */}
          <Card style={styles.doctorCard}>
            <View style={styles.doctorHeader}>
              <View style={styles.doctorInfo}>
                <Text style={[styles.doctorName, { color: colors.text }]}>
                  {doctor.fullName}
                </Text>
                {doctor.locationName && (
                  <Text
                    style={[styles.doctorLocation, { color: colors.muted }]}
                  >
                    {doctor.locationName}
                  </Text>
                )}
              </View>
            </View>
          </Card>

          {/* Quick Actions */}
          <View style={styles.quickActionsSection}>
            <Button
              title="New Case"
              onPress={handleNewCase}
              variant="primary"
            />
            <Button
              title={finding ? "Finding…" : "Find nearby cases"}
              onPress={findNearby}
              variant="secondary"
              style={styles.quickActionButton}
              disabled={finding}
            />
          </View>

          {/* Active Cases */}
          <View style={styles.recentCasesSection}>
            <View style={styles.sectionHeaderRow}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: colors.text, marginBottom: 0 },
                ]}
              >
                Active Cases
              </Text>
              <View style={styles.limitCounter}>
                <TouchableOpacity
                  onPress={() =>
                    setActiveCasesLimit((n) =>
                      Math.max(ACTIVE_CASES_LIMIT_MIN, n - 1),
                    )
                  }
                  style={[
                    styles.limitButton,
                    {
                      borderColor: colors.primary,
                      backgroundColor: colors.surface,
                    },
                  ]}
                  accessibilityLabel="Decrease limit"
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
                      borderColor: colors.primary,
                      backgroundColor: colors.surface,
                    },
                  ]}
                  accessibilityLabel="Increase limit"
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
                  No active cases
                </Text>
              </Card>
            )}
          </View>

          {/* Nearby cases (shown after "Find nearby cases" is used) */}
          {nearbyCases !== null && (
            <View style={styles.nearbySection}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: colors.text, marginBottom: 8 },
                ]}
              >
                Nearby cases
              </Text>
              {locationError && (
                <Text
                  style={[styles.nearbyError, { color: colors.danger }]}
                  numberOfLines={2}
                >
                  {locationError}
                </Text>
              )}
              <Text style={[styles.nearbyHint, { color: colors.muted }]}>
                Cases for animals within {NEARBY_RADIUS_KM} km of your location.
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
                    No cases for animals in this area
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
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 16,
  },
  doctorCard: {
    marginTop: 8,
  },
  doctorHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  doctorInfo: {
    flex: 1,
  },
  doctorName: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  doctorLocation: {
    fontSize: 16,
  },
  quickActionsSection: {
    marginTop: 16,
    gap: 12,
  },
  quickActionButton: {
    marginTop: 0,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 10,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  limitCounter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  limitButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  limitValue: {
    fontSize: 16,
    fontWeight: "600",
    minWidth: 24,
    textAlign: "center",
  },
  recentCasesSection: {
    marginTop: 16,
  },
  nearbySection: {
    marginTop: 24,
  },
  nearbyHint: {
    fontSize: 14,
    marginBottom: 10,
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
    paddingVertical: 16,
  },
  emptyText: {
    fontSize: 16,
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
    borderRadius: 12,
    overflow: "hidden",
    height: 60,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  caseCardPhoto: {
    width: 60,
    height: 60,
    backgroundColor: "#2a2a2a",
    justifyContent: "center",
    alignItems: "center",
  },
  caseCardPhotoImage: {
    width: 60,
    height: 60,
  },
  caseCardPhotoPlaceholder: {
    fontSize: 18,
    fontWeight: "600",
  },
  caseCardBody: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    justifyContent: "center",
    minWidth: 0,
  },
  caseCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
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
    borderRadius: 8,
    maxWidth: 80,
  },
  distanceBadgeIconWrap: {
    marginRight: 4,
  },
  distanceBadgeText: {
    fontSize: 11,
    fontWeight: "600",
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
    marginBottom: 0,
    opacity: 0.9,
  },
  caseCardMeta: {
    fontSize: 12,
    opacity: 0.75,
  },
  caseCardActions: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
  },
  caseCardDeleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});

// Modern case card: one side photo, other side case info + status icon
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
  const { colors } = useTheme();
  const { data: animalImages = [] } = useAnimalImages(caseItem.animalId);
  const { data: animal } = useAnimal(caseItem.animalId);
  const faceUrl =
    animalImages.find((i) => i.imageType === "FACE")?.s3Url ?? null;
  const ownerName = animal?.farmer?.fullName ?? "—";
  const status = caseItem.status ?? "IN_PROGRESS";
  const isCompleted = status === "COMPLETED";
  const distanceKm = getCaseDistanceKm(caseItem);
  const distanceLabel = formatCaseDistanceLabel(distanceKm);

  return (
    <View style={[styles.caseCard, { backgroundColor: colors.surface }]}>
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
            { borderColor: colors.danger },
            isDeleting && { opacity: 0.5 },
          ]}
          activeOpacity={0.7}
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color={colors.danger} />
          ) : (
            <FontAwesome name="trash-o" size={12} color={colors.danger} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
