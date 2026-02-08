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
import { useCreateVisitNote } from '../features/notes/hooks';

export default function AddNoteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors } = useTheme();
  
  const visitId = params.visitId ? Number(params.visitId) : undefined;
  const createNoteMutation = useCreateVisitNote();
  
  const [noteText, setNoteText] = useState('');
  const [noteType, setNoteType] = useState<'TEXT' | 'VOICE_TRANSCRIPT'>('TEXT');

  const handleSave = async () => {
    if (!visitId) {
      Alert.alert('Error', 'Visit ID is missing');
      return;
    }

    if (!noteText.trim()) {
      Alert.alert('Error', 'Please enter note text');
      return;
    }

    try {
      await createNoteMutation.mutateAsync({
        visitId,
        noteType,
        noteText: noteText.trim(),
      });
      
      // Navigate back to visit detail
      router.replace(`/visit-detail?visitId=${visitId}`);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to create note');
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
        <Text style={[styles.title, { color: colors.text }]}>Add Note</Text>

        {/* Note Type */}
        <Card style={styles.card}>
          <Text style={[styles.label, { color: colors.text }]}>Note Type</Text>
          <SegmentedControl
            options={[
              { label: 'Text', value: 'TEXT' },
              { label: 'Voice Transcript', value: 'VOICE_TRANSCRIPT' },
            ]}
            selectedValue={noteType}
            onValueChange={(value) => setNoteType(value as 'TEXT' | 'VOICE_TRANSCRIPT')}
          />
        </Card>

        {/* Note Text */}
        <Card style={styles.card}>
          <AppInput
            label="Note *"
            value={noteText}
            onChangeText={setNoteText}
            placeholder="Enter your note here..."
            multiline
            numberOfLines={8}
          />
        </Card>

        {/* Save Button */}
        <Button
          title={createNoteMutation.isPending ? "Saving..." : "Save Note"}
          onPress={handleSave}
          variant="primary"
          disabled={!noteText.trim() || createNoteMutation.isPending}
          loading={createNoteMutation.isPending}
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
