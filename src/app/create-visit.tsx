import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, Platform, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../theme/useTheme';
import { Card } from '../components/ui/Card';
import { AppInput } from '../components/ui/AppInput';
import { Button } from '../components/ui/Button';
import { useCurrentDoctor } from '../features/doctors/hooks';
import { useAnimal } from '../features/animals/hooks';
import { useCreateVisit } from '../features/visits/hooks';

export default function CreateVisitScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors } = useTheme();
  const { data: doctor, isLoading: doctorLoading } = useCurrentDoctor();
  
  const animalId = params.animalId ? Number(params.animalId) : undefined;
  const { data: selectedAnimal, isLoading: animalLoading } = useAnimal(animalId || 0);
  
  const createVisitMutation = useCreateVisit();
  
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [notes, setNotes] = useState('');
  const [visitDatetime, setVisitDatetime] = useState<Date>(new Date()); // Default to current time
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const formatDateTime = (date: Date): string => {
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).replace(',', '');
  };

  const handleDateChange = (event: unknown, selectedDate?: Date) => {
    const nativeEvent = event as { type: string };
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      if (nativeEvent.type === 'set' && selectedDate) {
        setVisitDatetime(selectedDate);
        // On Android, show time picker after date is selected
        setTimeout(() => setShowTimePicker(true), 300);
      }
    } else {
      // iOS: update date immediately
      if (selectedDate) {
        setVisitDatetime(selectedDate);
      }
    }
  };

  const handleTimeChange = (event: unknown, selectedTime?: Date) => {
    const nativeEvent = event as { type: string };
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
      if (nativeEvent.type === 'set' && selectedTime) {
        // Merge time with existing date
        const newDate = new Date(visitDatetime);
        newDate.setHours(selectedTime.getHours());
        newDate.setMinutes(selectedTime.getMinutes());
        setVisitDatetime(newDate);
      }
    } else {
      // iOS: update time immediately
      if (selectedTime) {
        const newDate = new Date(visitDatetime);
        newDate.setHours(selectedTime.getHours());
        newDate.setMinutes(selectedTime.getMinutes());
        setVisitDatetime(newDate);
      }
    }
  };

  const handleSave = async () => {
    if (!selectedAnimal || !doctor) {
      Alert.alert('Error', 'Please select an animal first');
      return;
    }
    
    try {
      const visit = await createVisitMutation.mutateAsync({
        animalId: selectedAnimal.animalId,
        doctorId: doctor.doctorId,
        visitDatetime: visitDatetime.toISOString(),
        chiefComplaint: chiefComplaint || undefined,
        notes: notes || undefined,
      });
      
      // Navigate to visit detail
      router.replace(`/visit-detail?visitId=${visit.visitId}`);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to create visit');
    }
  };

  const isLoading = doctorLoading || animalLoading || createVisitMutation.isPending;

  const handleSelectAnimal = () => {
    router.push({
      pathname: '/select-animal',
      params: { returnTo: '/create-visit' },
    });
  };

  if (isLoading && !selectedAnimal) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar style="auto" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

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
                {selectedAnimal.tagId ? ` (${selectedAnimal.tagId})` : ''}
              </Text>
              {selectedAnimal.ownerName && (
                <Text style={[styles.ownerText, { color: colors.muted }]}>
                  Owner: {selectedAnimal.ownerName}
                </Text>
              )}
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
          <Text style={[styles.label, { color: colors.text }]}>Visit Date & Time</Text>
          <TouchableOpacity
            onPress={() => {
              setShowDatePicker(true);
            }}
            style={[styles.datePickerButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
          >
            <Text style={[styles.datePickerText, { color: colors.text }]}>
              {formatDateTime(visitDatetime)}
            </Text>
            <Text style={[styles.datePickerHint, { color: colors.muted }]}>Tap to change</Text>
          </TouchableOpacity>
          
          {showDatePicker && (
            <DateTimePicker
              value={visitDatetime}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChange}
              minimumDate={new Date(2020, 0, 1)}
              maximumDate={new Date(2030, 11, 31)}
            />
          )}
          
          {Platform.OS === 'ios' && showDatePicker && (
            <View style={styles.timePickerContainer}>
              <DateTimePicker
                value={visitDatetime}
                mode="time"
                display="spinner"
                onChange={handleTimeChange}
                is24Hour={false}
              />
              <View style={styles.pickerButtons}>
                <Button
                  title="Done"
                  onPress={() => setShowDatePicker(false)}
                  variant="primary"
                  style={styles.pickerButton}
                />
              </View>
            </View>
          )}
          
          {Platform.OS === 'android' && showTimePicker && (
            <DateTimePicker
              value={visitDatetime}
              mode="time"
              display="default"
              onChange={handleTimeChange}
              is24Hour={false}
            />
          )}
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
          title={createVisitMutation.isPending ? "Creating..." : "Create Visit"}
          onPress={handleSave}
          variant="primary"
          disabled={!selectedAnimal || !doctor || createVisitMutation.isPending}
          loading={createVisitMutation.isPending}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  datePickerButton: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  datePickerText: {
    fontSize: 16,
    fontWeight: '500',
  },
  datePickerHint: {
    fontSize: 12,
  },
  timePickerContainer: {
    marginTop: 16,
  },
  pickerButtons: {
    marginTop: 16,
  },
  pickerButton: {
    marginTop: 8,
  },
});
