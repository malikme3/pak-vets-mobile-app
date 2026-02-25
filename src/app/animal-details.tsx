import { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Image,
  ImageBackground,
  Alert,
  TouchableOpacity,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useTheme } from "../theme/useTheme";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { ListRow } from "../components/ui/ListRow";
import { useAnimal, useAnimalImages } from "../features/animals/hooks";
import { useCurrentDoctor } from "../features/doctors/hooks";
import { useCasesByAnimal, useCreateCase } from "../features/cases/hooks";
import type { Case } from "../types/api";

const capitalizeFirst = (s: string) =>
  s
    ? s
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ")
    : "";

export default function AnimalDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors } = useTheme();

  const animalId = params.animalId ? Number(params.animalId) : undefined;
  const { data: animal, isLoading: animalLoading } = useAnimal(animalId || 0);
  const {
    data: animalImages = [],
    isLoading: animalImagesLoading,
    refetch: refetchAnimalImages,
  } = useAnimalImages(animalId || 0);
  const { data: cases = [], isLoading: casesLoading } = useCasesByAnimal(
    animalId || 0,
  );
  const { data: doctor } = useCurrentDoctor();
  const createCaseMutation = useCreateCase();

  useFocusEffect(
    useCallback(() => {
      if (animalId) {
        refetchAnimalImages();
      }
    }, [animalId, refetchAnimalImages]),
  );

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

  const renderCaseItem = ({ item }: { item: Case }) => {
    const subtitle = `${formatDate(item.caseDatetime)}${item.chiefComplaint ? ` • ${item.chiefComplaint}` : ""}`;
    return (
      <ListRow
        title="Case"
        subtitle={subtitle}
        onPress={() => router.push(`/case-detail?caseId=${item.caseId}`)}
      />
    );
  };

  const handleCreateCase = useCallback(async () => {
    if (!animalId || !doctor) {
      Alert.alert("Error", "Unable to create case. Please try again.");
      return;
    }
    try {
      const caseData = await createCaseMutation.mutateAsync({
        animalId,
        doctorId: doctor.doctorId,
        caseDatetime: new Date().toISOString(),
        chiefComplaint: undefined,
        status: "COMPLETED",
      });
      router.replace(`/case-detail?caseId=${caseData.caseId}&fromCreate=1`);
    } catch (err) {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Failed to create case",
      );
    }
  }, [animalId, doctor, createCaseMutation, router]);

  const handleDialPhone = useCallback(async (phoneNumber: string) => {
    const sanitized = phoneNumber.replace(/[^\d+]/g, "");
    const url = `tel:${sanitized}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert("Dialer unavailable", "This device cannot place calls.");
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert("Error", "Unable to open the dialer.");
    }
  }, []);

  if (animalLoading) {
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

  if (!animal) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <StatusBar style="auto" />
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]}>
            Animal not found
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const faceImageUrl =
    animalImages.find((i) => i.imageType === "FACE")?.s3Url ?? null;
  const profileTitle = [
    capitalizeFirst(animal.species),
    animal.breed ? capitalizeFirst(animal.breed) : null,
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <StatusBar style="auto" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header - face image as background */}
        <View
          style={[
            styles.profileHeader,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              overflow: "hidden",
            },
          ]}
        >
          {faceImageUrl ? (
            <ImageBackground
              source={{ uri: faceImageUrl }}
              style={styles.profileHeaderBg}
              resizeMode="cover"
            >
              <View
                style={[
                  styles.profileHeaderOverlayTop,
                  { backgroundColor: "rgba(0,0,0,0.2)" },
                ]}
              />
              <View
                style={[
                  styles.profileHeaderOverlay,
                  { backgroundColor: "rgba(0,0,0,0.45)" },
                ]}
              />
              <View style={styles.profileHeaderContent}>
                <Text style={styles.profileTitle} numberOfLines={1}>
                  {profileTitle}
                </Text>
                {animal.tagId && (
                  <Text style={styles.profileTagId} numberOfLines={1}>
                    {animal.tagId}
                  </Text>
                )}
                {animal.animalTagline && (
                  <Text style={styles.taglineText} numberOfLines={2} selectable>
                    {animal.animalTagline}
                  </Text>
                )}
              </View>
            </ImageBackground>
          ) : (
            <View
              style={[
                styles.profileHeaderContent,
                styles.profileHeaderFallback,
              ]}
            >
              <FontAwesome name="paw" size={24} color={colors.muted} />
              <Text
                style={[styles.profileTitle, { color: colors.text }]}
                numberOfLines={1}
              >
                {profileTitle}
              </Text>
              {animal.tagId && (
                <Text
                  style={[styles.profileTagId, { color: colors.muted }]}
                  numberOfLines={1}
                >
                  {animal.tagId}
                </Text>
              )}
              {animal.animalTagline && (
                <Text
                  style={[styles.taglineText, { color: colors.text }]}
                  numberOfLines={2}
                  selectable
                >
                  {animal.animalTagline}
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Farmer (owner) section – theme-aware */}
        {(animal.farmer?.fullName || animal.farmer?.phoneNumber) && (
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <FontAwesome name="user" size={14} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Farmer
              </Text>
            </View>
            <View style={styles.farmerTopRow}>
              {animal.farmer?.fullName ? (
                <Text
                  style={[styles.farmerName, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {capitalizeFirst(animal.farmer.fullName)}
                </Text>
              ) : (
                <View />
              )}
              {animal.farmer?.phoneNumber ? (
                <TouchableOpacity
                  onPress={() =>
                    handleDialPhone(animal.farmer?.phoneNumber ?? "")
                  }
                  activeOpacity={0.75}
                >
                  <Text
                    style={[styles.farmerPhone, { color: colors.primary }]}
                    numberOfLines={1}
                  >
                    {animal.farmer.phoneNumber}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
            {animal.farmer?.villageName && (
              <Text style={[styles.farmerDetail, { color: colors.muted }]}>
                {animal.farmer.villageName}
              </Text>
            )}
          </Card>
        )}

        {/* Identification & Summary */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <FontAwesome name="info-circle" size={14} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Identification
            </Text>
          </View>
          {animal.aiShortSummary && (
            <Text
              style={[styles.summaryText, { color: colors.text }]}
              selectable
            >
              {animal.aiShortSummary}
            </Text>
          )}
          {animal.aiSummary && (
            <View style={[styles.aiBlock, { borderTopColor: colors.border }]}>
              <Text
                style={[styles.aiSummaryText, { color: colors.text }]}
                selectable
              >
                {animal.aiSummary}
              </Text>
            </View>
          )}
          {!animal.aiShortSummary && !animal.aiSummary && (
            <Text style={[styles.emptyHint, { color: colors.muted }]}>
              No identification details recorded
            </Text>
          )}
        </Card>

        {/* Reference Photos */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <FontAwesome name="camera" size={14} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Reference Photos
            </Text>
          </View>
          {animalImagesLoading ? (
            <View style={styles.animalPhotosLoading}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : animalImages.length > 0 ? (
            <View style={styles.animalPhotosGrid}>
              {(["FACE", "EAR", "BODY"] as const).map((imageType) => {
                const img = animalImages.find((i) => i.imageType === imageType);
                return (
                  <View
                    key={imageType}
                    style={[
                      styles.animalPhotoItem,
                      { backgroundColor: colors.border },
                    ]}
                  >
                    {img?.s3Url ? (
                      <Image
                        source={{ uri: img.s3Url }}
                        style={styles.animalPhotoImage}
                        resizeMode="cover"
                        onError={() => {}}
                      />
                    ) : (
                      <View
                        style={[
                          styles.animalPhotoPlaceholder,
                          { backgroundColor: colors.surface },
                        ]}
                      >
                        <FontAwesome
                          name="image"
                          size={24}
                          color={colors.muted}
                        />
                      </View>
                    )}
                    <Text
                      style={[styles.animalPhotoLabel, { color: colors.muted }]}
                    >
                      {imageType}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.animalPhotosEmpty}>
              <Text style={[styles.emptyText, { color: colors.muted }]}>
                No reference photos for this animal
              </Text>
            </View>
          )}
        </Card>

        {/* Create Case CTA */}
        <Button
          title={createCaseMutation.isPending ? "Creating…" : "Create New Case"}
          onPress={handleCreateCase}
          variant="primary"
          disabled={createCaseMutation.isPending}
          loading={createCaseMutation.isPending}
          style={styles.createCaseButton}
        />

        {/* Case History */}
        <View style={styles.casesSection}>
          <View style={styles.sectionHeader}>
            <FontAwesome name="folder-open" size={14} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Case History
            </Text>
            {cases.length > 0 && (
              <Text style={[styles.caseCount, { color: colors.muted }]}>
                {cases.length} {cases.length === 1 ? "case" : "cases"}
              </Text>
            )}
          </View>
          {cases.length > 0 ? (
            <Card style={styles.casesCard}>
              <FlatList
                data={cases}
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
                No cases recorded
              </Text>
            </Card>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
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
    paddingBottom: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
  },
  profileHeader: {
    height: 156,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 4,
  },
  profileHeaderBg: {
    flex: 1,
    justifyContent: "flex-end",
  },
  profileHeaderOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  profileHeaderOverlayTop: {
    ...StyleSheet.absoluteFillObject,
  },
  profileHeaderContent: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: "flex-end",
    flex: 1,
  },
  profileHeaderFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  profileTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 2,
  },
  profileTagId: {
    fontSize: 12,
    color: "rgba(255,255,255,0.85)",
    marginBottom: 4,
  },
  taglineText: {
    fontSize: 13,
    fontStyle: "italic",
    color: "rgba(255,255,255,0.95)",
    lineHeight: 18,
  },
  sectionCard: {
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  caseCount: {
    fontSize: 13,
    marginLeft: "auto",
  },
  ownerName: {
    fontSize: 17,
    fontWeight: "600",
    marginBottom: 4,
  },
  ownerPhone: {
    fontSize: 15,
  },
  farmerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  farmerName: {
    flex: 1,
    fontSize: 17,
    fontWeight: "600",
    marginBottom: 2,
  },
  farmerPhone: {
    fontSize: 15,
    fontWeight: "600",
    textAlign: "right",
    maxWidth: "48%",
  },
  farmerDetail: {
    fontSize: 15,
    marginTop: 4,
  },
  summaryText: {
    fontSize: 15,
    lineHeight: 22,
  },
  aiBlock: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  aiSummaryText: {
    fontSize: 14,
    lineHeight: 22,
  },
  emptyHint: {
    fontSize: 14,
    fontStyle: "italic",
  },
  createCaseButton: {
    marginBottom: 16,
  },
  casesSection: {
    marginTop: 4,
  },
  casesCard: {
    paddingVertical: 0,
  },
  separator: {
    height: 1,
    marginLeft: 16,
  },
  emptyCard: {
    paddingVertical: 16,
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
  animalPhotosLoading: {
    paddingVertical: 16,
    alignItems: "center",
  },
  animalPhotosGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 4,
  },
  animalPhotoItem: {
    width: "31%",
    borderRadius: 12,
    overflow: "hidden",
  },
  animalPhotoImage: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 12,
  },
  animalPhotoPlaceholder: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  animalPhotoLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    textAlign: "center",
    paddingVertical: 6,
  },
  animalPhotosEmpty: {
    paddingVertical: 16,
    alignItems: "center",
  },
});
