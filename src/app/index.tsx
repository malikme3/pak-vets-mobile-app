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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useTheme } from "../theme/useTheme";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { useCurrentDoctor } from "../features/doctors/hooks";
import { useVisitsByDoctor } from "../features/visits/hooks";
import { useAnimalImages } from "../features/animals/hooks";
import type { Visit } from "../types/api";

export default function DashboardScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const {
    data: doctor,
    isLoading: doctorLoading,
    error: doctorError,
    refetch: refetchDoctor,
  } = useCurrentDoctor();
  const { data: allVisits, isLoading: visitsLoading } = useVisitsByDoctor(
    doctor?.doctorId || 0,
  );

  // Get recent 5 visits
  const recentVisits = allVisits
    ? [...allVisits]
        .sort(
          (a, b) =>
            new Date(b.visitDatetime).getTime() -
            new Date(a.visitDatetime).getTime(),
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

  const handleVisitPress = useCallback(
    (visitId: number) => {
      setTimeout(
        () => router.push(`/visit-detail?visitId=${visitId}`),
        50,
      );
    },
    [router],
  );

  const renderVisitItem = ({ item }: { item: Visit }) => {
    const subtitle = `${formatDate(item.visitDatetime)}${item.chiefComplaint ? ` • ${item.chiefComplaint}` : ""}`;
    return (
      <VisitRow
        animalId={item.animalId}
        title={`Visit #${item.visitId}`}
        subtitle={subtitle}
        onPress={() => handleVisitPress(item.visitId)}
      />
    );
  };

  if (doctorLoading || visitsLoading) {
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

  const handleNewVisit = () => {
    router.push("/create-visit");
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
              title="New Visit"
              onPress={handleNewVisit}
              variant="primary"
            />
          </View>

          {/* Recent Visits */}
          <View style={styles.recentVisitsSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Recent Visits
            </Text>
            {recentVisits.length > 0 ? (
              <Card style={styles.visitsCard}>
                <FlatList
                  data={recentVisits}
                  renderItem={renderVisitItem}
                  keyExtractor={(item) => String(item.visitId)}
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
                  No recent visits
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
  recentVisitsSection: {
    marginTop: 24,
  },
  visitsCard: {
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
  visitRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 44,
  },
  visitAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  visitAvatarImage: {
    width: "100%",
    height: "100%",
  },
  visitAvatarPlaceholder: {
    fontSize: 18,
    fontWeight: "600",
  },
  visitRowContent: {
    flex: 1,
    marginRight: 8,
  },
  visitRowTitle: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 4,
  },
  visitRowSubtitle: {
    fontSize: 14,
  },
  visitRowChevron: {
    fontSize: 24,
  },
});

// Row with animal face avatar for dashboard recent visits
interface VisitRowProps {
  animalId: number;
  title: string;
  subtitle: string;
  onPress: () => void;
}

function VisitRow({
  animalId,
  title,
  subtitle,
  onPress,
}: VisitRowProps) {
  const { colors } = useTheme();
  const { data: animalImages = [] } = useAnimalImages(animalId);
  const faceUrl =
    animalImages.find((i) => i.imageType === "FACE")?.s3Url ?? null;

  return (
    <TouchableOpacity
      style={styles.visitRow}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View
        style={[styles.visitAvatar, { backgroundColor: colors.border }]}
      >
        {faceUrl ? (
          <Image
            source={{ uri: faceUrl }}
            style={styles.visitAvatarImage}
            resizeMode="cover"
          />
        ) : (
          <Text
            style={[styles.visitAvatarPlaceholder, { color: colors.muted }]}
          >
            ?
          </Text>
        )}
      </View>
      <View style={styles.visitRowContent}>
        <Text style={[styles.visitRowTitle, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.visitRowSubtitle, { color: colors.muted }]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <Text style={[styles.visitRowChevron, { color: colors.muted }]}>›</Text>
    </TouchableOpacity>
  );
}
