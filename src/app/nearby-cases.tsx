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
import { useDeleteCase } from "../features/cases/hooks";
import { useAnimalImages, useAnimal } from "../features/animals/hooks";
import { caseApi } from "../services/vetApi";
import {
  getCaseDistanceKm,
  formatCaseDistanceLabel,
} from "../utils/formatDistance";
import type { Case } from "../types/api";

const NEARBY_RADIUS_KM = 0.5;

export default function NearbyCasesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [finding, setFinding] = useState(false);
  const [nearbyCases, setNearbyCases] = useState<Case[] | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const {
    data: doctor,
    isLoading: doctorLoading,
    error: doctorError,
    refetch: refetchDoctor,
  } = useCurrentDoctor();
  const deleteCaseMutation = useDeleteCase();

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
        `Delete Case #${caseItem.caseId}? This will remove the case and all related data.`,
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

  if (doctorLoading) {
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
          <Text style={[styles.title, { color: colors.text }]}>
            Nearby cases
          </Text>
          <Text style={[styles.hint, { color: colors.muted }]}>
            Find your cases for animals within {NEARBY_RADIUS_KM} km of your
            current location.
          </Text>

          <Button
            title={finding ? "Finding…" : "Find nearby cases"}
            onPress={findNearby}
            variant="primary"
            disabled={finding}
            style={styles.findButton}
          />
          {finding && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.muted }]}>
                Getting location and animals…
              </Text>
            </View>
          )}
          {locationError && (
            <Text style={[styles.errorText, { color: colors.danger }]}>
              {locationError}
            </Text>
          )}

          {nearbyCases !== null && !finding && (
            <View style={styles.resultsSection}>
              <Text
                style={[
                  styles.resultsTitle,
                  { color: colors.muted, marginTop: 16 },
                ]}
              >
                {nearbyCases.length}{" "}
                {nearbyCases.length === 1 ? "case" : "cases"} nearby
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
                    No cases found for animals in this area
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
  const distanceLabel = formatCaseDistanceLabel(
    distanceKm,
    `Within ${NEARBY_RADIUS_KM} km`,
  );

  return (
    <View style={[caseRowStyles.caseCard, { backgroundColor: colors.surface }]}>
      <TouchableOpacity
        style={caseRowStyles.caseCardPhoto}
        onPress={onPress}
        activeOpacity={0.85}
      >
        {faceUrl ? (
          <Image
            source={{ uri: faceUrl }}
            style={caseRowStyles.caseCardPhotoImage}
            resizeMode="cover"
          />
        ) : (
          <Text
            style={[
              caseRowStyles.caseCardPhotoPlaceholder,
              { color: colors.muted },
            ]}
          >
            ?
          </Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        style={caseRowStyles.caseCardBody}
        onPress={onPress}
        activeOpacity={0.85}
      >
        <View>
          <View style={caseRowStyles.caseCardHeader}>
            <Text
              style={[caseRowStyles.caseCardTitle, { color: colors.text }]}
              numberOfLines={1}
            >
              Case #{caseItem.caseId}
            </Text>
            <View style={caseRowStyles.caseCardHeaderRight}>
              <View
                style={[
                  caseRowStyles.distanceBadge,
                  { backgroundColor: `${colors.primary}18` },
                ]}
              >
                <View style={caseRowStyles.distanceBadgeIconWrap}>
                  <FontAwesome
                    name="map-marker"
                    size={10}
                    color={colors.primary}
                  />
                </View>
                <Text
                  style={[
                    caseRowStyles.distanceBadgeText,
                    { color: colors.primary },
                  ]}
                  numberOfLines={1}
                >
                  {distanceLabel}
                </Text>
              </View>
              <View
                style={[
                  caseRowStyles.caseCardStatusIcon,
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
              style={[caseRowStyles.caseCardComplaint, { color: colors.text }]}
              numberOfLines={1}
            >
              {caseItem.chiefComplaint}
            </Text>
          ) : null}
          <Text
            style={[caseRowStyles.caseCardMeta, { color: colors.muted }]}
            numberOfLines={1}
          >
            {ownerName} · {formatDate(caseItem.caseDatetime)}
          </Text>
        </View>
      </TouchableOpacity>
      <View style={caseRowStyles.caseCardActions}>
        <TouchableOpacity
          onPress={onDelete}
          disabled={isDeleting}
          style={[
            caseRowStyles.caseCardDeleteBtn,
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

const caseRowStyles = StyleSheet.create({
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
  title: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 8,
  },
  hint: {
    fontSize: 14,
    marginBottom: 16,
  },
  findButton: {
    marginTop: 0,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  resultsSection: {
    marginBottom: 24,
  },
  resultsTitle: {
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
});
