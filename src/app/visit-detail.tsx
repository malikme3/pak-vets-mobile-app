import { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../theme/useTheme';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useVisit } from '../features/visits/hooks';
import { useAnimal } from '../features/animals/hooks';
import { useCurrentDoctor } from '../features/doctors/hooks';
import { useVisitDiagnoses } from '../features/diagnoses/hooks';
import { useVisitTreatments } from '../features/treatments/hooks';
import { useVisitNotes } from '../features/notes/hooks';
import { useMediaFilesByVisit } from '../features/media/hooks';
import { ListRow } from '../components/ui/ListRow';
import { Image } from 'react-native';
import type { VisitDiagnosis, VisitTreatment, VisitNote, MediaFile } from '../types/api';

export default function VisitDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors } = useTheme();
  
  const visitId = params.visitId ? Number(params.visitId) : undefined;
  const { data: visit, isLoading: visitLoading } = useVisit(visitId || 0);
  const { data: animal, isLoading: animalLoading } = useAnimal(visit?.animalId || 0);
  const { data: doctor } = useCurrentDoctor();
  const { data: diagnoses = [], isLoading: diagnosesLoading, refetch: refetchDiagnoses } = useVisitDiagnoses(visitId || 0);
  const { data: treatments = [], isLoading: treatmentsLoading, refetch: refetchTreatments } = useVisitTreatments(visitId || 0);
  const { data: notes = [], isLoading: notesLoading, refetch: refetchNotes } = useVisitNotes(visitId || 0);
  const { data: mediaFiles = [], isLoading: mediaLoading, refetch: refetchMedia } = useMediaFilesByVisit(visitId || 0);
  
  // Refetch diagnoses, treatments, notes, and media when screen comes into focus (e.g., after adding)
  useFocusEffect(
    useCallback(() => {
      if (visitId) {
        refetchDiagnoses();
        refetchTreatments();
        refetchNotes();
        refetchMedia();
      }
    }, [visitId, refetchDiagnoses, refetchTreatments, refetchNotes, refetchMedia])
  );
  
  const isLoading = visitLoading || animalLoading || diagnosesLoading || treatmentsLoading || notesLoading || mediaLoading;

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar style="auto" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!visit) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar style="auto" />
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.text }]}>Visit not found</Text>
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
        <Text style={[styles.title, { color: colors.text }]}>Visit Details</Text>

        {/* Visit Information */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Visit Information</Text>
          <View style={styles.infoRow}>
            <Text style={[styles.label, { color: colors.muted }]}>Date & Time</Text>
            <Text style={[styles.value, { color: colors.text }]}>{formatDate(visit.visitDatetime)}</Text>
          </View>
          {visit.chiefComplaint && (
            <View style={styles.infoRow}>
              <Text style={[styles.label, { color: colors.muted }]}>Chief Complaint</Text>
              <Text style={[styles.value, { color: colors.text }]}>{visit.chiefComplaint}</Text>
            </View>
          )}
        </Card>

        {/* Animal Information */}
        {animal && (
          <Card style={styles.card}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Animal Information</Text>
            <View style={styles.infoRow}>
              <Text style={[styles.label, { color: colors.muted }]}>Species</Text>
              <Text style={[styles.value, { color: colors.text }]}>{animal.species}</Text>
            </View>
            {animal.breed && (
              <View style={styles.infoRow}>
                <Text style={[styles.label, { color: colors.muted }]}>Breed</Text>
                <Text style={[styles.value, { color: colors.text }]}>{animal.breed}</Text>
              </View>
            )}
            {animal.tagId && (
              <View style={styles.infoRow}>
                <Text style={[styles.label, { color: colors.muted }]}>Tag ID</Text>
                <Text style={[styles.value, { color: colors.text }]}>{animal.tagId}</Text>
              </View>
            )}
            {animal.ownerName && (
              <View style={styles.infoRow}>
                <Text style={[styles.label, { color: colors.muted }]}>Owner</Text>
                <Text style={[styles.value, { color: colors.text }]}>{animal.ownerName}</Text>
              </View>
            )}
            {animal.ownerPhone && (
              <View style={styles.infoRow}>
                <Text style={[styles.label, { color: colors.muted }]}>Owner Phone</Text>
                <Text style={[styles.value, { color: colors.text }]}>{animal.ownerPhone}</Text>
              </View>
            )}
            <Button
              title="View Animal Profile"
              onPress={() => router.push(`/animal-details?animalId=${animal.animalId}`)}
              variant="secondary"
              style={styles.actionButton}
            />
          </Card>
        )}

        {/* Diagnoses Section */}
        <Card style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Diagnoses</Text>
            <Button
              title="Add Diagnosis"
              onPress={() => {
                router.push(`/add-diagnosis?visitId=${visit?.visitId}`);
              }}
              variant="secondary"
              style={styles.addButton}
            />
          </View>
          {diagnoses.length > 0 ? (
            <View style={styles.listContainer}>
              {diagnoses.map((diagnosis) => (
                <View key={diagnosis.diagnosisId} style={[styles.diagnosisItem, { borderLeftColor: colors.primary }]}>
                  <View style={styles.diagnosisHeader}>
                    <Text style={[styles.diagnosisStatus, { 
                      color: diagnosis.status === 'CONFIRMED' ? colors.success : colors.warning 
                    }]}>
                      {diagnosis.status}
                    </Text>
                  </View>
                  <Text style={[styles.diagnosisText, { color: colors.text }]}>
                    {diagnosis.diagnosisText}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: colors.muted }]}>No diagnoses added yet</Text>
            </View>
          )}
        </Card>

        {/* Treatments Section */}
        <Card style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Treatments</Text>
            <Button
              title="Add Treatment"
              onPress={() => {
                router.push(`/add-treatment?visitId=${visit?.visitId}`);
              }}
              variant="secondary"
              style={styles.addButton}
            />
          </View>
          {treatments.length > 0 ? (
            <View style={styles.listContainer}>
              {treatments.map((treatment) => (
                <View key={treatment.treatmentId} style={[styles.treatmentItem, { borderLeftColor: colors.accent }]}>
                  <View style={styles.treatmentHeader}>
                    <Text style={[styles.treatmentType, { color: colors.primary }]}>
                      {treatment.treatmentType || 'Treatment'}
                    </Text>
                    <Text style={[styles.treatmentStatus, { 
                      color: treatment.treatmentStatus === 'COMPLETED' 
                        ? colors.success 
                        : treatment.treatmentStatus === 'STOPPED'
                        ? colors.danger
                        : colors.warning
                    }]}>
                      {treatment.treatmentStatus}
                    </Text>
                  </View>
                  {treatment.medicineNameFree && (
                    <Text style={[styles.treatmentText, { color: colors.text }]}>
                      <Text style={styles.bold}>Medicine:</Text> {treatment.medicineNameFree}
                    </Text>
                  )}
                  {treatment.dose && (
                    <Text style={[styles.treatmentText, { color: colors.text }]}>
                      <Text style={styles.bold}>Dose:</Text> {treatment.dose}
                    </Text>
                  )}
                  {treatment.route && (
                    <Text style={[styles.treatmentText, { color: colors.text }]}>
                      <Text style={styles.bold}>Route:</Text> {treatment.route}
                    </Text>
                  )}
                  {treatment.frequency && (
                    <Text style={[styles.treatmentText, { color: colors.text }]}>
                      <Text style={styles.bold}>Frequency:</Text> {treatment.frequency}
                    </Text>
                  )}
                  {treatment.durationDays && (
                    <Text style={[styles.treatmentText, { color: colors.text }]}>
                      <Text style={styles.bold}>Duration:</Text> {treatment.durationDays} days
                    </Text>
                  )}
                  {treatment.instructions && (
                    <Text style={[styles.treatmentText, { color: colors.text, marginTop: 4 }]}>
                      <Text style={styles.bold}>Instructions:</Text> {treatment.instructions}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: colors.muted }]}>No treatments added yet</Text>
              <Text style={[styles.emptySubtext, { color: colors.muted }]}>Treatments are optional</Text>
            </View>
          )}
        </Card>

        {/* Notes Section */}
        <Card style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Notes</Text>
            <Button
              title="Add Note"
              onPress={() => {
                router.push(`/add-note?visitId=${visit?.visitId}`);
              }}
              variant="secondary"
              style={styles.addButton}
            />
          </View>
          {notes.length > 0 ? (
            <View style={styles.listContainer}>
              {notes.map((note) => (
                <View key={note.noteId} style={[styles.noteItem, { borderLeftColor: colors.primary }]}>
                  <View style={styles.noteHeader}>
                    <Text style={[styles.noteType, { color: colors.primary }]}>
                      {note.noteType === 'VOICE_TRANSCRIPT' ? 'Voice Transcript' : 'Text Note'}
                    </Text>
                    <Text style={[styles.noteDate, { color: colors.muted }]}>
                      {new Date(note.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                  <Text style={[styles.noteText, { color: colors.text }]}>
                    {note.noteText}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: colors.muted }]}>No notes added yet</Text>
            </View>
          )}
        </Card>

        {/* Media Section */}
        <Card style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Media</Text>
            <Button
              title="Upload Media"
              onPress={() => {
                router.push(`/add-media?visitId=${visit?.visitId}`);
              }}
              variant="secondary"
              style={styles.addButton}
            />
          </View>
          {mediaFiles.length > 0 ? (
            <View style={styles.mediaContainer}>
              {mediaFiles.map((media) => {
                // Determine image URI - prefer url (which may be local file:// URI), fallback to s3Key-based URL
                const imageUri = media.fileType === 'IMAGE' && media.url 
                  ? media.url 
                  : media.fileType === 'IMAGE' && media.s3Key
                  ? `https://your-s3-bucket.s3.amazonaws.com/${media.s3Key}` // TODO: Replace with actual S3 bucket URL
                  : null;

                return (
                  <View key={media.mediaId} style={styles.mediaItem}>
                    {media.fileType === 'IMAGE' && imageUri ? (
                      <View style={[styles.imageWrapper, { backgroundColor: colors.border }]}>
                        <Image 
                          source={{ uri: imageUri }} 
                          style={styles.mediaImage}
                          resizeMode="cover"
                          onError={(error) => {
                            console.warn('Failed to load image:', imageUri, error);
                          }}
                          onLoad={() => {
                            console.log('Image loaded successfully:', imageUri);
                          }}
                        />
                        <View style={styles.imageOverlay}>
                          <Text style={[styles.imageLabel, { color: colors.surface }]}>IMAGE</Text>
                        </View>
                      </View>
                    ) : (
                      <View style={[styles.mediaPlaceholder, { backgroundColor: colors.border }]}>
                        <Text style={[styles.mediaType, { color: colors.text }]}>
                          {media.fileType}
                        </Text>
                      </View>
                    )}
                    <Text style={[styles.mediaDate, { color: colors.muted }]}>
                      {new Date(media.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: colors.muted }]}>No media uploaded yet</Text>
            </View>
          )}
        </Card>
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  addButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    flex: 1,
  },
  value: {
    fontSize: 14,
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  actionButton: {
    marginTop: 12,
  },
  emptyState: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    marginTop: 8,
  },
  diagnosisItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
    backgroundColor: 'transparent',
    borderLeftWidth: 3,
  },
  diagnosisHeader: {
    marginBottom: 8,
  },
  diagnosisStatus: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  diagnosisText: {
    fontSize: 14,
    lineHeight: 20,
  },
  treatmentItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    backgroundColor: 'transparent',
    borderLeftWidth: 3,
  },
  treatmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  treatmentType: {
    fontSize: 14,
    fontWeight: '600',
  },
  treatmentStatus: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  treatmentText: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  bold: {
    fontWeight: '600',
  },
  noteItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    backgroundColor: 'transparent',
    borderLeftWidth: 3,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  noteType: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  noteDate: {
    fontSize: 11,
  },
  noteText: {
    fontSize: 14,
    lineHeight: 20,
  },
  mediaContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  mediaItem: {
    width: '48%',
    marginBottom: 12,
  },
  imageWrapper: {
    position: 'relative',
    width: '100%',
    borderRadius: 8,
    overflow: 'hidden',
  },
  mediaImage: {
    width: '100%',
    height: 150,
    borderRadius: 8,
  },
  imageOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  imageLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  mediaPlaceholder: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaType: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  mediaDate: {
    fontSize: 11,
    marginTop: 6,
    textAlign: 'center',
  },
});
