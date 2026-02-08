import { useState, useEffect } from "react";
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
import { AppInput } from "../components/ui/AppInput";
import { Button } from "../components/ui/Button";
import { ListRow } from "../components/ui/ListRow";
import { SegmentedControl } from "../components/ui/SegmentedControl";
import { useSearchAnimals, useAnimals } from "../features/animals/hooks";
import type { Animal } from "../types/api";

type SearchFilter = "tag" | "owner_name" | "owner_phone";

export default function SelectAnimalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors } = useTheme();
  const returnTo = (params.returnTo as string) || "/create-visit";

  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<SearchFilter>("tag");

  // Use search hook when query exists, otherwise use all animals
  const { data: searchResults, isLoading: searchLoading } =
    useSearchAnimals(searchQuery);
  const { data: allAnimals, isLoading: animalsLoading } = useAnimals();

  // Filter results based on selected filter type
  const results = searchQuery.trim()
    ? (searchResults || []).filter((animal) => {
        const query = searchQuery.toLowerCase();
        switch (filter) {
          case "tag":
            return animal.tagId?.toLowerCase().includes(query);
          case "owner_name":
            return animal.ownerName?.toLowerCase().includes(query);
          case "owner_phone":
            return animal.ownerPhone?.includes(searchQuery);
          default:
            return false;
        }
      })
    : [];

  const isLoading = searchLoading || animalsLoading;

  const handleAnimalSelect = (animal: Animal) => {
    if (!returnTo || typeof returnTo !== "string") {
      console.error("Invalid returnTo path:", returnTo);
      return;
    }
    router.push({
      pathname: returnTo as `/${string}`,
      params: { animalId: String(animal.animalId) },
    });
  };

  const handleCreateAnimal = () => {
    router.push({
      pathname: "/create-animal",
      params: { returnTo },
    });
  };

  const renderAnimalItem = ({ item }: { item: Animal }) => {
    const subtitle = `${item.ownerName || "Unknown Owner"}${item.ownerPhone ? ` • ${item.ownerPhone}` : ""}`;
    return (
      <ListRow
        title={`${item.species}${item.breed ? ` - ${item.breed}` : ""}${item.tagId ? ` (${item.tagId})` : ""}`}
        subtitle={subtitle}
        onPress={() => handleAnimalSelect(item)}
      />
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <StatusBar style="auto" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        <Text style={[styles.title, { color: colors.text }]}>
          Search Animal
        </Text>

        {/* Search Input */}
        <Card style={styles.card}>
          <AppInput
            label="Search"
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={`Search by ${filter === "tag" ? "Tag ID" : filter === "owner_name" ? "Owner Name" : "Owner Phone"}`}
          />
        </Card>

        {/* Filter Segmented Control */}
        <View style={styles.filterSection}>
          <Text style={[styles.filterLabel, { color: colors.text }]}>
            Search by:
          </Text>
          <SegmentedControl
            options={[
              { label: "Tag ID", value: "tag" },
              { label: "Owner Name", value: "owner_name" },
              { label: "Phone", value: "owner_phone" },
            ]}
            selectedValue={filter}
            onValueChange={(value) => setFilter(value as SearchFilter)}
          />
        </View>

        {/* Loading State */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        )}

        {/* Results */}
        {results.length > 0 && (
          <View style={styles.resultsSection}>
            <Text style={[styles.resultsTitle, { color: colors.muted }]}>
              {results.length} {results.length === 1 ? "result" : "results"}{" "}
              found
            </Text>
            <Card style={styles.resultsCard}>
              <FlatList
                data={results}
                renderItem={renderAnimalItem}
                keyExtractor={(item) => String(item.animalId)}
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
          </View>
        )}

        {/* Create New Animal CTA */}
        <View style={styles.createSection}>
          <Text style={[styles.createLabel, { color: colors.muted }]}>
            Animal not found?
          </Text>
          <Button
            title="Create New Animal"
            onPress={handleCreateAnimal}
            variant="secondary"
            style={styles.createButton}
          />
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
  title: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 24,
  },
  card: {
    marginBottom: 16,
  },
  filterSection: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 12,
  },
  resultsSection: {
    marginBottom: 24,
  },
  resultsTitle: {
    fontSize: 14,
    marginBottom: 8,
  },
  resultsCard: {
    paddingVertical: 0,
  },
  separator: {
    height: 1,
    marginLeft: 16,
  },
  createSection: {
    marginTop: 8,
  },
  createLabel: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 8,
  },
  createButton: {
    marginTop: 8,
  },
  loadingContainer: {
    padding: 16,
    alignItems: "center",
  },
});
