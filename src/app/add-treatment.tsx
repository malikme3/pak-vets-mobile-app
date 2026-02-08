import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../theme/useTheme';
import { Card } from '../components/ui/Card';
import { AppInput } from '../components/ui/AppInput';
import { Button } from '../components/ui/Button';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { useCreateVisitTreatment } from '../features/treatments/hooks';

export default function AddTreatmentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors } = useTheme();
  
  const visitId = params.visitId ? Number(params.visitId) : undefined;
  const createTreatmentMutation = useCreateVisitTreatment();
  
  const [treatmentType, setTreatmentType] = useState<'MEDICATION' | 'PROCEDURE' | 'ADVICE'>('MEDICATION');
  const [treatmentStatus, setTreatmentStatus] = useState<'PLANNED' | 'ONGOING' | 'COMPLETED' | 'STOPPED'>('PLANNED');
  const [medicineNameFree, setMedicineNameFree] = useState('');
  const [dose, setDose] = useState('');
  const [route, setRoute] = useState('');
  const [frequency, setFrequency] = useState('');
  const [durationDays, setDurationDays] = useState('');
  const [instructions, setInstructions] = useState('');

  const handleSave = async () => {
    if (!visitId) {
      Alert.alert('Error', 'Visit ID is missing');
      return;
    }

    try {
      await createTreatmentMutation.mutateAsync({
        visitId,
        treatmentType,
        treatmentStatus,
        medicineNameFree: medicineNameFree.trim() || undefined,
        dose: dose.trim() || undefined,
        route: route.trim() || undefined,
        frequency: frequency.trim() || undefined,
        durationDays: durationDays ? Number(durationDays) : undefined,
        instructions: instructions.trim() || undefined,
      });
      
      // Navigate back to visit detail
      router.replace(`/visit-detail?visitId=${visitId}`);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to create treatment');
    }
  };

  if (!visitId) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar style="auto" />
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.text }]}>Invalid visit ID</Text>
          <Button
            title="Go Back"
            onPress={() => router.back()}
            variant="primary"
            style={styles.backButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style="auto" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>Add Treatment</Text>

        {/* Treatment Type */}
        <Card style={styles.card}>
          <Text style={[styles.label, { color: colors.text }]}>Treatment Type</Text>
          <SegmentedControl
            options={[
              { label: 'Medication', value: 'MEDICATION' },
              { label: 'Procedure', value: 'PROCEDURE' },
              { label: 'Advice', value: 'ADVICE' },
            ]}
            selectedValue={treatmentType}
            onValueChange={(value) => setTreatmentType(value as 'MEDICATION' | 'PROCEDURE' | 'ADVICE')}
          />
        </Card>

        {/* Treatment Status */}
        <Card style={styles.card}>
          <Text style={[styles.label, { color: colors.text }]}>Status</Text>
          <SegmentedControl
            options={[
              { label: 'Planned', value: 'PLANNED' },
              { label: 'Ongoing', value: 'ONGOING' },
              { label: 'Completed', value: 'COMPLETED' },
              { label: 'Stopped', value: 'STOPPED' },
            ]}
            selectedValue={treatmentStatus}
            onValueChange={(value) => setTreatmentStatus(value as 'PLANNED' | 'ONGOING' | 'COMPLETED' | 'STOPPED')}
          />
        </Card>

        {/* Medicine Name (Free Text) */}
        <Card style={styles.card}>
          <AppInput
            label="Medicine Name"
            value={medicineNameFree}
            onChangeText={setMedicineNameFree}
            placeholder="Enter medicine name (optional)"
          />
        </Card>

        {/* Dose */}
        <Card style={styles.card}>
          <AppInput
            label="Dose"
            value={dose}
            onChangeText={setDose}
            placeholder="e.g., 500mg, 10ml (optional)"
          />
        </Card>

        {/* Route */}
        <Card style={styles.card}>
          <AppInput
            label="Route"
            value={route}
            onChangeText={setRoute}
            placeholder="e.g., Oral, IV, IM (optional)"
          />
        </Card>

        {/* Frequency */}
        <Card style={styles.card}>
          <AppInput
            label="Frequency"
            value={frequency}
            onChangeText={setFrequency}
            placeholder="e.g., Twice daily, Every 8 hours (optional)"
          />
        </Card>

        {/* Duration */}
        <Card style={styles.card}>
          <AppInput
            label="Duration (Days)"
            value={durationDays}
            onChangeText={setDurationDays}
            placeholder="Number of days (optional)"
            keyboardType="numeric"
          />
        </Card>

        {/* Instructions */}
        <Card style={styles.card}>
          <AppInput
            label="Instructions"
            value={instructions}
            onChangeText={setInstructions}
            placeholder="Additional instructions (optional)"
            multiline
            numberOfLines={4}
          />
        </Card>

        {/* Save Button */}
        <Button
          title={createTreatmentMutation.isPending ? "Saving..." : "Save Treatment"}
          onPress={handleSave}
          variant="primary"
          disabled={createTreatmentMutation.isPending}
          loading={createTreatmentMutation.isPending}
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  errorText: {
    fontSize: 18,
    marginBottom: 16,
  },
  backButton: {
    marginTop: 16,
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
    marginBottom: 12,
  },
  saveButton: {
    marginTop: 8,
  },
});
