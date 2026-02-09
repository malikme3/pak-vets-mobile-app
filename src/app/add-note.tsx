import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
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
import { useCreateVisitNote } from "../features/notes/hooks";

export default function AddNoteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors } = useTheme();

  const visitId = params.visitId ? Number(params.visitId) : undefined;
  const createNoteMutation = useCreateVisitNote();

  const [noteText, setNoteText] = useState("");
  const [noteType, setNoteType] = useState<"TEXT" | "VOICE_TRANSCRIPT">("TEXT");
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
      setNoteText(transcriptToUse);
      setNoteType("VOICE_TRANSCRIPT");
    },
    [],
  );

  const handleTranscriptReady = useCallback((transcript: string) => {
    setNoteText(transcript);
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
        console.error("Playback error:", error);
      }
    }
  }, [voiceRecording, sound, isPlaying]);

  const handleStop = useCallback(async () => {
    if (sound) {
      await sound.stopAsync();
      setIsPlaying(false);
    }
  }, [sound]);

  const handleRecordAgain = useCallback(async () => {
    if (sound) {
      await sound.unloadAsync();
      setSound(null);
      setIsPlaying(false);
    }
    setVoiceRecording(null);
    setNoteText("");
  }, [sound]);

  const handleSave = async () => {
    if (!visitId) {
      Alert.alert("Error", "Visit ID is missing");
      return;
    }

    if (noteType === "VOICE_TRANSCRIPT" && !voiceRecording) {
      Alert.alert("Error", "Please record a voice message first");
      return;
    }

    if (!noteText.trim()) {
      Alert.alert("Error", "Please enter note text");
      return;
    }

    try {
      await createNoteMutation.mutateAsync({
        visitId,
        noteType,
        noteText: noteText.trim(),
      });

      // Cleanup audio
      if (sound) {
        await sound.unloadAsync();
      }

      // Navigate back to visit detail
      router.replace(`/visit-detail?visitId=${visitId}`);
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Failed to create note",
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
        <Text style={[styles.title, { color: colors.text }]}>Add Note</Text>

        {/* Note Type */}
        <Card style={styles.card}>
          <Text style={[styles.label, { color: colors.text }]}>Note Type</Text>
          <SegmentedControl
            options={[
              { label: "Text", value: "TEXT" },
              { label: "Voice Transcript", value: "VOICE_TRANSCRIPT" },
            ]}
            selectedValue={noteType}
            onValueChange={(value) =>
              setNoteType(value as "TEXT" | "VOICE_TRANSCRIPT")
            }
          />
        </Card>

        {/* Voice Recording Section */}
        {noteType === "VOICE_TRANSCRIPT" && (
          <Card style={styles.card}>
            <Text style={[styles.label, { color: colors.text }]}>
              Voice Recording
            </Text>
            {!voiceRecording ? (
              <View style={styles.recordSection}>
                <Text style={[styles.instructionText, { color: colors.muted }]}>
                  Tap the microphone to start recording
                </Text>
                <View style={styles.recordButtonContainer}>
                  <VoiceMessageRecorder
                    onRecordingComplete={handleVoiceRecordingComplete}
                    onTranscriptReady={handleTranscriptReady}
                    buttonSize={64}
                    buttonColor={colors.primary}
                    visitId={visitId}
                  />
                </View>
              </View>
            ) : (
              <View style={styles.playbackSection}>
                <View
                  style={[
                    styles.voiceMessageCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View style={styles.voiceMessageHeader}>
                    <FontAwesome
                      name="microphone"
                      size={16}
                      color={colors.primary}
                    />
                    <Text
                      style={[styles.voiceMessageTitle, { color: colors.text }]}
                    >
                      Voice Message Recorded
                    </Text>
                  </View>
                  {voiceRecording.rawText && (
                    <Text
                      style={[styles.transcriptText, { color: colors.muted }]}
                      numberOfLines={3}
                    >
                      {voiceRecording.rawText}
                    </Text>
                  )}
                </View>

                <View style={styles.playbackControls}>
                  <TouchableOpacity
                    style={[
                      styles.playbackButton,
                      { backgroundColor: colors.primary },
                    ]}
                    onPress={handlePlayPause}
                  >
                    <FontAwesome
                      name={isPlaying ? "pause" : "play"}
                      size={16}
                      color="#fff"
                    />
                    <Text style={styles.playbackButtonText}>
                      {isPlaying ? "Pause" : "Play"}
                    </Text>
                  </TouchableOpacity>
                  {isPlaying && (
                    <TouchableOpacity
                      style={[
                        styles.playbackButton,
                        {
                          backgroundColor: colors.muted,
                          borderColor: colors.border,
                        },
                      ]}
                      onPress={handleStop}
                    >
                      <FontAwesome name="stop" size={16} color="#fff" />
                      <Text style={styles.playbackButtonText}>Stop</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[
                      styles.playbackButton,
                      {
                        backgroundColor: colors.muted,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={handleRecordAgain}
                  >
                    <FontAwesome name="repeat" size={16} color="#fff" />
                    <Text style={styles.playbackButtonText}>Record Again</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </Card>
        )}

        {/* Note Text */}
        <Card style={styles.card}>
          <View style={styles.inputHeader}>
            <Text style={[styles.label, { color: colors.text }]}>Note *</Text>
            {noteType === "TEXT" && (
              <View style={styles.micButtonContainer}>
                <VoiceMessageRecorder
                  onTranscriptReady={handleTranscriptReady}
                  onRecordingComplete={handleVoiceRecordingComplete}
                  buttonSize={36}
                  buttonColor={colors.primary}
                  visitId={visitId}
                />
              </View>
            )}
          </View>
          <AppInput
            value={noteText}
            onChangeText={setNoteText}
            placeholder="Enter your note here..."
            multiline
            numberOfLines={8}
            style={noteType === "TEXT" ? styles.textAreaWithIcon : undefined}
          />
        </Card>

        {/* Save Button */}
        <Button
          title={createNoteMutation.isPending ? "Saving..." : "Save Note"}
          onPress={handleSave}
          variant="primary"
          disabled={
            !noteText.trim() ||
            createNoteMutation.isPending ||
            (noteType === "VOICE_TRANSCRIPT" && !voiceRecording)
          }
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
  saveButton: {
    marginTop: 8,
  },
  recordSection: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },
  instructionText: {
    fontSize: 14,
    marginBottom: 20,
    textAlign: "center",
  },
  recordButtonContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  playbackSection: {
    gap: 16,
  },
  voiceMessageCard: {
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
  },
  voiceMessageHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  voiceMessageTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  transcriptText: {
    fontSize: 12,
    lineHeight: 16,
    marginLeft: 24,
  },
  playbackControls: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  playbackButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
    flex: 1,
    minWidth: 100,
  },
  playbackButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  inputHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  micButtonContainer: {
    zIndex: 10,
  },
  textAreaWithIcon: {
    paddingRight: 50,
  },
});
