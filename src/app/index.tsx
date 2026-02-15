import { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useTheme } from "../theme/useTheme";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { useCurrentDoctor } from "../features/doctors/hooks";
import { useCasesByDoctor, useDeleteCase } from "../features/cases/hooks";
import { useAnimalImages } from "../features/animals/hooks";
import type { Case } from "../types/api";

export default function DashboardScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const {
    data: doctor,
    isLoading: doctorLoading,
    error: doctorError,
    refetch: refetchDoctor,
  } = useCurrentDoctor();
  const { data: allCases, isLoading: casesLoading } = useCasesByDoctor(
    doctor?.doctorId || 0,
  );
  const deleteCaseMutation = useDeleteCase();

  const recentCases = allCases
    ? [...allCases]
        .sort(
          (a, b) =>
            new Date(b.caseDatetime).getTime() -
            new Date(a.caseDatetime).getTime(),
        )
        .slice(0, 5)
    : [];

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleCasePress = useCallback(
    (caseId: number) => {
      setTimeout(
        () => router.push(`/case-detail?caseId=${caseId}`),
        50,
      );
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
                  error instanceof Error ? error.message : "Failed to delete case",
                );
              }
            },
          },
        ],
      );
    },
    [deleteCaseMutation],
  );

  const renderCaseItem = ({ item }: { item: Case }) => {
    const subtitle = `${formatDate(item.caseDatetime)}${item.chiefComplaint ? ` • ${item.chiefComplaint}` : ""}`;
    return (
      <CaseRow
        animalId={item.animalId}
        title={`Case #${item.caseId}`}
        subtitle={subtitle}
        onPress={() => handleCasePress(item.caseId)}
        onDelete={() => handleDeleteCase(item)}
        isDeleting={deleteCaseMutation.isPending}
      />
    );
  };

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
            {/* <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text> */}
            <Button
              title="New Case"
              onPress={handleNewCase}
              variant="primary"
            />
          </View>

          {/* Recent Cases */}
          <View style={styles.recentCasesSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Recent Cases
            </Text>
            {recentCases.length > 0 ? (
              <Card style={styles.casesCard}>
                <FlatList
                  data={recentCases}
                  renderItem={renderCaseItem}
                  keyExtractor={(item) => String(item.caseId)}
                  scrollEnabled={false}
                  ItemSeparatorComponent={() => (
                    <View
                      style={[
                        styles.separator,
                        { backgroundColor: colors.border },
                      ]}
                    />
                  )}
                />
              </Card>
            ) : (
              <Card style={styles.emptyCard}>
                <Text style={[styles.emptyText, { color: colors.muted }]}>
                  No recent cases
                </Text>
              </Card>
            )}
          </View>
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
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
  },
  recentCasesSection: {
    marginTop: 24,
  },
  casesCard: {
    paddingVertical: 0,
  },
  separator: {
    height: 1,
    marginLeft: 16,
  },
  emptyCard: {
    paddingVertical: 24,
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
  caseRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 44,
  },
  caseRowTap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  caseDeleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  caseAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  caseAvatarImage: {
    width: "100%",
    height: "100%",
  },
  caseAvatarPlaceholder: {
    fontSize: 18,
    fontWeight: "600",
  },
  caseRowContent: {
    flex: 1,
    marginRight: 8,
  },
  caseRowTitle: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 4,
  },
  caseRowSubtitle: {
    fontSize: 14,
  },
  caseRowChevron: {
    fontSize: 24,
  },
});

// Row with animal face avatar for dashboard recent cases
interface CaseRowProps {
  animalId: number;
  title: string;
  subtitle: string;
  onPress: () => void;
  onDelete: () => void;
  isDeleting?: boolean;
}

function CaseRow({
  animalId,
  title,
  subtitle,
  onPress,
  onDelete,
  isDeleting,
}: CaseRowProps) {
  const { colors } = useTheme();
  const { data: animalImages = [] } = useAnimalImages(animalId);
  const faceUrl =
    animalImages.find((i) => i.imageType === "FACE")?.s3Url ?? null;

  return (
    <View style={styles.caseRow}>
      <TouchableOpacity
        style={styles.caseRowTap}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View
          style={[styles.caseAvatar, { backgroundColor: colors.border }]}
        >
          {faceUrl ? (
            <Image
              source={{ uri: faceUrl }}
              style={styles.caseAvatarImage}
              resizeMode="cover"
            />
          ) : (
            <Text
              style={[styles.caseAvatarPlaceholder, { color: colors.muted }]}
            >
              ?
            </Text>
          )}
        </View>
        <View style={styles.caseRowContent}>
          <Text style={[styles.caseRowTitle, { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={[styles.caseRowSubtitle, { color: colors.muted }]} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        <Text style={[styles.caseRowChevron, { color: colors.muted }]}>›</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onDelete}
        disabled={isDeleting}
        style={[
          styles.caseDeleteBtn,
          { borderColor: colors.danger },
          isDeleting && { opacity: 0.5 },
        ]}
        activeOpacity={0.7}
      >
        {isDeleting ? (
          <ActivityIndicator size="small" color={colors.danger} />
        ) : (
          <FontAwesome name="trash-o" size={16} color={colors.danger} />
        )}
      </TouchableOpacity>
    </View>
  );
}
