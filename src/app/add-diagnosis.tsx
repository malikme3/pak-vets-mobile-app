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
import { Button } from "../components/ui/Button";
import { SegmentedControl } from "../components/ui/SegmentedControl";
import { VoiceMessageRecorder } from "../components/voice/VoiceMessageRecorder";
import { useCreateVisitDiagnosis } from "../features/diagnoses/hooks";
import { useCreateMediaFile } from "../features/media/hooks";
import { getBucketName } from "../services/sharedServicesApi";

export default function AddDiagnosisScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors } = useTheme();

  const visitId = params.visitId ? Number(params.visitId) : undefined;
  const paramText =
    typeof params.diagnosisText === "string"
      ? params.diagnosisText
      : Array.isArray(params.diagnosisText)
        ? params.diagnosisText[0] ?? ""
        : "";
  const paramStatus =
    typeof params.status === "string"
      ? params.status
      : Array.isArray(params.status)
        ? params.status[0]
        : "";
  const validStatus: "SUSPECTED" | "CONFIRMED" =
    paramStatus === "CONFIRMED" ? "CONFIRMED" : "SUSPECTED";

  const createDiagnosisMutation = useCreateVisitDiagnosis();
  const createMediaMutation = useCreateMediaFile();

  const [diagnosisText, setDiagnosisText] = useState(paramText);
  const [status, setStatus] = useState<"SUSPECTED" | "CONFIRMED">(validStatus);
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
      // Populate text field with transcript
      const transcriptToUse = improvedText || rawText;
      setDiagnosisText(transcriptToUse);
    },
    [],
  );

  const handleTranscriptReady = useCallback((transcript: string) => {
    setDiagnosisText(transcript);
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
        console.error("[AddDiagnosis] Playback error:", error);
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
    setDiagnosisText("");
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

    if (!diagnosisText.trim()) {
      Alert.alert("Error", "Please enter diagnosis text");
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

      await createDiagnosisMutation.mutateAsync({
        visitId,
        diagnosisText: diagnosisText.trim(),
        status,
        ...(mediaId !== undefined && { mediaId: Number(mediaId) }),
      });

      // Navigate back to visit detail - use replace to ensure fresh data load
      router.replace(`/visit-detail?visitId=${visitId}`);
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Failed to create diagnosis",
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
          Add Diagnosis
        </Text>

        {/* ChatGPT-style Input Area */}
        <Card style={styles.inputCard}>
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
                value={diagnosisText}
                onChangeText={setDiagnosisText}
                placeholder="Type diagnosis or tap the microphone to record..."
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

        {/* Status Selection */}
        <Card style={styles.card}>
          <Text style={[styles.label, { color: colors.text }]}>Status</Text>
          <SegmentedControl
            options={[
              { label: "Suspected", value: "SUSPECTED" },
              { label: "Confirmed", value: "CONFIRMED" },
            ]}
            selectedValue={status}
            onValueChange={(value) =>
              setStatus(value as "SUSPECTED" | "CONFIRMED")
            }
          />
        </Card>

        {/* Save Button */}
        <Button
          title={
            createDiagnosisMutation.isPending ? "Saving..." : "Save Diagnosis"
          }
          onPress={handleSave}
          variant="primary"
          disabled={
            !diagnosisText.trim() ||
            createDiagnosisMutation.isPending ||
            createMediaMutation.isPending
          }
          loading={createDiagnosisMutation.isPending || createMediaMutation.isPending}
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
  inputCard: {
    marginBottom: 16,
    padding: 0,
    overflow: "hidden",
  },
  inputContainer: {
    padding: 16,
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
  card: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 12,
  },
  saveButton: {
    marginTop: 8,
  },
});
