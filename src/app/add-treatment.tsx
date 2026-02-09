import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Audio } from "expo-av";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useTheme } from "../theme/useTheme";
import { Card } from "../components/ui/Card";
import { AppInput } from "../components/ui/AppInput";
import { Button } from "../components/ui/Button";
import { SegmentedControl } from "../components/ui/SegmentedControl";
import { VoiceMessageRecorder } from "../components/voice/VoiceMessageRecorder";
import { useCreateVisitTreatment } from "../features/treatments/hooks";
import { useCreateMediaFile } from "../features/media/hooks";
import { getBucketName } from "../services/sharedServicesApi";

export default function AddTreatmentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors } = useTheme();

  const visitId = params.visitId ? Number(params.visitId) : undefined;
  const createTreatmentMutation = useCreateVisitTreatment();
  const createMediaMutation = useCreateMediaFile();

  const [treatmentType, setTreatmentType] = useState<
    "MEDICATION" | "PROCEDURE" | "ADVICE"
  >("MEDICATION");
  const [treatmentStatus, setTreatmentStatus] = useState<
    "PLANNED" | "ONGOING" | "COMPLETED" | "STOPPED"
  >("PLANNED");
  const [medicineNameFree, setMedicineNameFree] = useState("");
  const [dose, setDose] = useState("");
  const [route, setRoute] = useState("");
  const [frequency, setFrequency] = useState("");
  const [durationDays, setDurationDays] = useState("");
  const [instructions, setInstructions] = useState("");
  const [voiceRecording, setVoiceRecording] = useState<{
    s3Key: string;
    rawText: string;
    improvedText?: string;
    localUri: string;
  } | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const handleVoiceRecordingComplete = useCallback(
    (
      s3Key: string,
      rawText: string,
      improvedText?: string,
      localUri?: string,
    ) => {
      setVoiceRecording({
        s3Key,
        rawText,
        improvedText,
        localUri: localUri || "",
      });
      // Populate instructions field with transcript
      const transcriptToUse = improvedText || rawText;
      setInstructions(transcriptToUse);
    },
    [],
  );

  const handleTranscriptReady = useCallback((transcript: string) => {
    setInstructions(transcript);
  }, []);

  const handlePlayPause = useCallback(async () => {
    if (!voiceRecording || !voiceRecording.localUri) {
      Alert.alert("Error", "Audio file not available for playback");
      return;
    }

    try {
      if (isPlaying && sound) {
        await sound.pauseAsync();
        setIsPlaying(false);
      } else {
        if (sound) {
          await sound.playAsync();
          setIsPlaying(true);
        } else {
          const { sound: newSound } = await Audio.Sound.createAsync(
            { uri: voiceRecording.localUri },
            { shouldPlay: true },
          );
          setSound(newSound);
          setIsPlaying(true);

          newSound.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded && status.didJustFinish) {
              setIsPlaying(false);
            }
          });
        }
      }
    } catch (error) {
      Alert.alert("Error", "Failed to play audio");
      if (__DEV__) {
        console.error("[AddTreatment] Playback error:", error);
      }
    }
  }, [voiceRecording, sound, isPlaying]);

  const handleStop = useCallback(async () => {
    if (sound) {
      await sound.stopAsync();
      setIsPlaying(false);
    }
  }, [sound]);

  const handleRecordAgain = useCallback(() => {
    setVoiceRecording(null);
    setInstructions("");
    if (sound) {
      sound.unloadAsync();
      setSound(null);
    }
    setIsPlaying(false);
  }, [sound]);

  const handleSave = async () => {
    if (!visitId) {
      Alert.alert("Error", "Visit ID is missing");
      return;
    }

    try {
      let mediaId: number | undefined = undefined;

      // If there's a voice recording, create MediaFile first
      if (voiceRecording?.s3Key) {
        const bucketName = getBucketName();
        const s3Url = `https://${bucketName}.s3.amazonaws.com/${voiceRecording.s3Key}`;

        const mediaFile = await createMediaMutation.mutateAsync({
          visitId,
          fileType: "AUDIO",
          s3Key: voiceRecording.s3Key,
          url: s3Url,
        });

        mediaId = mediaFile.mediaId;
      }

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
        ...(mediaId !== undefined && { mediaId: Number(mediaId) }),
      });

      // Navigate back to visit detail
      router.replace(`/visit-detail?visitId=${visitId}`);
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Failed to create treatment",
      );
    }
  };

  if (!visitId) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <StatusBar style="auto" />
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.text }]}>
            Invalid visit ID
          </Text>
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
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <StatusBar style="auto" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        <Text style={[styles.title, { color: colors.text }]}>
          Add Treatment
        </Text>

        {/* Treatment Type */}
        <Card style={styles.card}>
          <Text style={[styles.label, { color: colors.text }]}>
            Treatment Type
          </Text>
          <SegmentedControl
            options={[
              { label: "Medication", value: "MEDICATION" },
              { label: "Procedure", value: "PROCEDURE" },
              { label: "Advice", value: "ADVICE" },
            ]}
            selectedValue={treatmentType}
            onValueChange={(value) =>
              setTreatmentType(value as "MEDICATION" | "PROCEDURE" | "ADVICE")
            }
          />
        </Card>

        {/* Treatment Status */}
        <Card style={styles.card}>
          <Text style={[styles.label, { color: colors.text }]}>Status</Text>
          <SegmentedControl
            options={[
              { label: "Planned", value: "PLANNED" },
              { label: "Ongoing", value: "ONGOING" },
              { label: "Completed", value: "COMPLETED" },
              { label: "Stopped", value: "STOPPED" },
            ]}
            selectedValue={treatmentStatus}
            onValueChange={(value) =>
              setTreatmentStatus(
                value as "PLANNED" | "ONGOING" | "COMPLETED" | "STOPPED",
              )
            }
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

        {/* Instructions with Voice Input */}
        <Card style={styles.inputCard}>
          <Text style={[styles.label, { color: colors.text }]}>
            Instructions
          </Text>
          <View style={styles.inputContainer}>
            {/* Voice Recording Playback (if exists) */}
            {voiceRecording && (
              <View
                style={[
                  styles.voicePlaybackCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.voicePlaybackHeader}>
                  <FontAwesome
                    name="microphone"
                    size={14}
                    color={colors.primary}
                  />
                  <Text
                    style={[styles.voicePlaybackTitle, { color: colors.text }]}
                  >
                    Voice recorded
                  </Text>
                  <TouchableOpacity
                    onPress={handlePlayPause}
                    style={styles.playbackIconButton}
                  >
                    <FontAwesome
                      name={isPlaying ? "pause" : "play"}
                      size={12}
                      color={colors.primary}
                    />
                  </TouchableOpacity>
                  {isPlaying && (
                    <TouchableOpacity
                      onPress={handleStop}
                      style={styles.playbackIconButton}
                    >
                      <FontAwesome name="stop" size={12} color={colors.muted} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={handleRecordAgain}
                    style={styles.playbackIconButton}
                  >
                    <FontAwesome name="times" size={12} color={colors.muted} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Text Input Area */}
            <View style={styles.textInputWrapper}>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                value={instructions}
                onChangeText={setInstructions}
                placeholder="Type instructions or tap the microphone to record..."
                placeholderTextColor={colors.muted}
                multiline
                textAlignVertical="top"
              />
              {/* Microphone Button - Bottom Right */}
              <View style={styles.micButtonWrapper}>
                <VoiceMessageRecorder
                  onTranscriptReady={handleTranscriptReady}
                  onRecordingComplete={handleVoiceRecordingComplete}
                  onError={(error: Error) => {
                    Alert.alert("Error", error.message);
                  }}
                  buttonSize={32}
                  buttonColor={colors.primary}
                  visitId={visitId}
                />
              </View>
            </View>
          </View>
        </Card>

        {/* Save Button */}
        <Button
          title={
            createTreatmentMutation.isPending ? "Saving..." : "Save Treatment"
          }
          onPress={handleSave}
          variant="primary"
          disabled={
            createTreatmentMutation.isPending || createMediaMutation.isPending
          }
          loading={createTreatmentMutation.isPending || createMediaMutation.isPending}
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
    justifyContent: "center",
    alignItems: "center",
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
    fontWeight: "600",
    marginBottom: 24,
  },
  card: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 12,
  },
  inputCard: {
    marginBottom: 16,
    padding: 16,
  },
  inputContainer: {
    marginTop: 8,
  },
  voicePlaybackCard: {
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  voicePlaybackHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  voicePlaybackTitle: {
    fontSize: 12,
    fontWeight: "500",
    flex: 1,
  },
  playbackIconButton: {
    padding: 4,
  },
  textInputWrapper: {
    position: "relative",
    minHeight: 120,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 44,
    fontSize: 16,
    minHeight: 120,
    maxHeight: 300,
  },
  micButtonWrapper: {
    position: "absolute",
    bottom: 8,
    right: 8,
    zIndex: 10,
  },
  saveButton: {
    marginTop: 8,
  },
});
