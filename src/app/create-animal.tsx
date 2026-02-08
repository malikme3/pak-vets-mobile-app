import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useTheme } from "../theme/useTheme";
import { Card } from "../components/ui/Card";
import { AppInput } from "../components/ui/AppInput";
import { Button } from "../components/ui/Button";
import { useCreateAnimal } from "../features/animals/hooks";
import type { CreateAnimalRequest } from "../types/api";

export default function CreateAnimalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors } = useTheme();
  const returnTo = (params.returnTo as string) || "/create-visit";

  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [species, setSpecies] = useState("");
  const [breed, setBreed] = useState("");
  const [tagId, setTagId] = useState("");

  const createAnimalMutation = useCreateAnimal();

  const handleSave = async () => {
    if (!species.trim()) {
      Alert.alert("Error", "Species is required");
      return;
    }

    const request: CreateAnimalRequest = {
      ownerName: ownerName.trim() || undefined,
      ownerPhone: ownerPhone.trim() || undefined,
      species: species.trim(),
      breed: breed.trim() || undefined,
      tagId: tagId.trim() || undefined,
    };

    try {
      const createdAnimal = await createAnimalMutation.mutateAsync(request);

      // Navigate back to returnTo with the new animal ID
      if (!returnTo || typeof returnTo !== "string") {
        console.error("Invalid returnTo path:", returnTo);
        router.back();
        return;
      }
      router.push({
        pathname: returnTo as `/${string}`,
        params: { animalId: String(createdAnimal.animalId) },
      });
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Failed to create animal",
      );
    }
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
          Create New Animal
        </Text>

        {/* Owner Information */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Owner Information
          </Text>
          <AppInput
            label="Owner Name *"
            value={ownerName}
            onChangeText={setOwnerName}
            placeholder="Enter owner name"
          />
          <AppInput
            label="Owner Phone *"
            value={ownerPhone}
            onChangeText={setOwnerPhone}
            placeholder="Enter owner phone"
            keyboardType="phone-pad"
          />
        </Card>

        {/* Animal Information */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Animal Information
          </Text>
          <AppInput
            label="Species *"
            value={species}
            onChangeText={setSpecies}
            placeholder="e.g., Cattle, Goat, Buffalo"
          />
          <AppInput
            label="Breed"
            value={breed}
            onChangeText={setBreed}
            placeholder="Enter breed (optional)"
          />
          <AppInput
            label="Tag ID"
            value={tagId}
            onChangeText={setTagId}
            placeholder="Enter tag ID (optional)"
          />
        </Card>

        {/* Save Button */}
        <Button
          title={
            createAnimalMutation.isPending ? "Creating..." : "Create Animal"
          }
          onPress={handleSave}
          variant="primary"
          disabled={!species.trim() || createAnimalMutation.isPending}
          loading={createAnimalMutation.isPending}
          style={styles.saveButton}
        />
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
  },
  saveButton: {
    marginTop: 8,
  },
});
