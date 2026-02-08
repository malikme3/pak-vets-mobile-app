import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../theme/useTheme';
import { Card } from '../components/ui/Card';
import { AppInput } from '../components/ui/AppInput';
import { Button } from '../components/ui/Button';
import { getCurrentDoctor, getAnimalById } from '../store/mockDb';

export default function CreateVisitScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors } = useTheme();
  const doctor = getCurrentDoctor();
  
  const animalId = params.animalId as string | undefined;
  const selectedAnimal = animalId ? getAnimalById(animalId) : undefined;
  
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [notes, setNotes] = useState('');
  const [visitDatetime, setVisitDatetime] = useState('');

  const handleSave = () => {
    if (!selectedAnimal) {
      console.log('Please select an animal first');
      return;
    }
    
    // TODO: Create visit via API
    console.log('Creating visit:', {
      animal_id: selectedAnimal.id,
      doctor_id: doctor.id,
      visit_datetime: visitDatetime || new Date().toISOString(),
      chief_complaint: chiefComplaint,
      notes: notes,
    });
    
    // Navigate back or to visit detail
    router.back();
  };

  const handleSelectAnimal = () => {
    router.push({
      pathname: '/select-animal',
      params: { returnTo: '/create-visit' },
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style="auto" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>Create New Visit</Text>

        {/* Animal Selection */}
        <Card style={styles.card}>
          <Text style={[styles.label, { color: colors.text }]}>Animal</Text>
          {selectedAnimal ? (
            <View style={styles.animalInfo}>
              <Text style={[styles.animalText, { color: colors.text }]}>
                {selectedAnimal.species}{selectedAnimal.breed ? ` - ${selectedAnimal.breed}` : ''}
                {selectedAnimal.tag_id ? ` (${selectedAnimal.tag_id})` : ''}
              </Text>
              <Text style={[styles.ownerText, { color: colors.muted }]}>
                Owner: {selectedAnimal.owner_name}
              </Text>
            </View>
          ) : (
            <Button
              title="Select Animal"
              onPress={handleSelectAnimal}
              variant="secondary"
              style={styles.selectButton}
            />
          )}
        </Card>

        {/* Visit Date/Time */}
        <Card style={styles.card}>
          <AppInput
            label="Visit Date & Time"
            value={visitDatetime}
            onChangeText={setVisitDatetime}
            placeholder="YYYY-MM-DD HH:MM (leave empty for now)"
          />
        </Card>

        {/* Chief Complaint */}
        <Card style={styles.card}>
          <AppInput
            label="Chief Complaint"
            value={chiefComplaint}
            onChangeText={setChiefComplaint}
            placeholder="Enter chief complaint"
            multiline
            numberOfLines={3}
          />
        </Card>

        {/* Notes */}
        <Card style={styles.card}>
          <AppInput
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            placeholder="Additional notes (optional)"
            multiline
            numberOfLines={4}
          />
        </Card>

        {/* Save Button */}
        <Button
          title="Create Visit"
          onPress={handleSave}
          variant="primary"
          disabled={!selectedAnimal}
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
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  animalInfo: {
    marginTop: 8,
  },
  animalText: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  ownerText: {
    fontSize: 14,
  },
  selectButton: {
    marginTop: 8,
  },
  saveButton: {
    marginTop: 8,
  },
});
