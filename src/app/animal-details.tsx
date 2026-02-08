import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useTheme } from "../theme/useTheme";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { ListRow } from "../components/ui/ListRow";
import { useAnimal } from "../features/animals/hooks";
import { useVisitsByAnimal } from "../features/visits/hooks";
import type { Visit } from "../types/api";

export default function AnimalDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors } = useTheme();

  const animalId = params.animalId ? Number(params.animalId) : undefined;
  const { data: animal, isLoading: animalLoading } = useAnimal(animalId || 0);
  const { data: visits = [], isLoading: visitsLoading } = useVisitsByAnimal(
    animalId || 0,
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

  const renderVisitItem = ({ item }: { item: Visit }) => {
    const subtitle = `${formatDate(item.visitDatetime)}${item.chiefComplaint ? ` • ${item.chiefComplaint}` : ""}`;
    return (
      <ListRow
        title="Visit"
        subtitle={subtitle}
        onPress={() => router.push(`/visit-detail?visitId=${item.visitId}`)}
      />
    );
  };

  const handleCreateVisit = () => {
    router.push({
      pathname: "/create-visit",
      params: { animalId: String(animalId) },
    });
  };

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

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <StatusBar style="auto" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        {/* Animal Summary Card */}
        <Card style={styles.animalCard}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Animal Information
          </Text>
          <View style={styles.infoRow}>
            <Text style={[styles.label, { color: colors.muted }]}>
              Species:
            </Text>
            <Text style={[styles.value, { color: colors.text }]}>
              {animal.species}
            </Text>
          </View>
          {animal.breed && (
            <View style={styles.infoRow}>
              <Text style={[styles.label, { color: colors.muted }]}>
                Breed:
              </Text>
              <Text style={[styles.value, { color: colors.text }]}>
                {animal.breed}
              </Text>
            </View>
          )}
          {animal.tagId && (
            <View style={styles.infoRow}>
              <Text style={[styles.label, { color: colors.muted }]}>
                Tag ID:
              </Text>
              <Text style={[styles.value, { color: colors.text }]}>
                {animal.tagId}
              </Text>
            </View>
          )}
          {animal.ownerName && (
            <View style={styles.infoRow}>
              <Text style={[styles.label, { color: colors.muted }]}>
                Owner:
              </Text>
              <Text style={[styles.value, { color: colors.text }]}>
                {animal.ownerName}
              </Text>
            </View>
          )}
          {animal.ownerPhone && (
            <View style={styles.infoRow}>
              <Text style={[styles.label, { color: colors.muted }]}>
                Phone:
              </Text>
              <Text style={[styles.value, { color: colors.text }]}>
                {animal.ownerPhone}
              </Text>
            </View>
          )}
        </Card>

        {/* Create Visit Button */}
        <Button
          title="Create Visit"
          onPress={handleCreateVisit}
          variant="primary"
          style={styles.createVisitButton}
        />

        {/* Visit History */}
        <View style={styles.visitsSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Visit History
          </Text>
          {visits.length > 0 ? (
            <Card style={styles.visitsCard}>
              <FlatList
                data={visits}
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
                No visits recorded
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
  },
  animalCard: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: "row",
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    width: 80,
  },
  value: {
    fontSize: 14,
    flex: 1,
    fontWeight: "500",
  },
  createVisitButton: {
    marginBottom: 24,
  },
  visitsSection: {
    marginTop: 8,
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
});
