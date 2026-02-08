import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../theme/useTheme';
import { Card } from '../components/ui/Card';
import { AppInput } from '../components/ui/AppInput';
import { Button } from '../components/ui/Button';
import { createAnimal } from '../store/mockDb';
import { Animal } from '../types/domain';

export default function CreateAnimalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors } = useTheme();
  const returnTo = (params.returnTo as string) || '/create-visit';
  
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [species, setSpecies] = useState('');
  const [breed, setBreed] = useState('');
  const [tagId, setTagId] = useState('');

  const handleSave = () => {
    if (!ownerName.trim() || !ownerPhone.trim() || !species.trim()) {
      console.log('Please fill required fields');
      return;
    }

    const newAnimal: Omit<Animal, 'id'> = {
      owner_name: ownerName,
      owner_phone: ownerPhone,
      species: species,
      breed: breed.trim() || undefined,
      tag_id: tagId.trim() || undefined,
    };

    const createdAnimal = createAnimal(newAnimal);
    
    console.log('Animal created:', createdAnimal);
    
    // Navigate back to returnTo with the new animal ID
    router.push({
      pathname: returnTo as any,
      params: { animalId: createdAnimal.id },
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style="auto" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>Create New Animal</Text>

        {/* Owner Information */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Owner Information</Text>
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
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Animal Information</Text>
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
          title="Create Animal"
          onPress={handleSave}
          variant="primary"
          disabled={!ownerName.trim() || !ownerPhone.trim() || !species.trim()}
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
    fontWeight: '600',
    marginBottom: 24,
  },
  card: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  saveButton: {
    marginTop: 8,
  },
});
