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
import { useCreateCaseNote } from "../features/notes/hooks";
import { useCreateMediaFile } from "../features/media/hooks";
import { getBucketName } from "../services/sharedServicesApi";
import { VoiceMessageRecorder } from "../components/voice/VoiceMessageRecorder";

export default function AddNoteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors } = useTheme();

  const caseId = params.caseId ? Number(params.caseId) : undefined;
  const createNoteMutation = useCreateCaseNote();
  const createMediaMutation = useCreateMediaFile();

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
    setNoteType("TEXT");
  }, [sound]);

  const handleSave = async () => {
    if (!caseId) {
      Alert.alert("Error", "Case ID is missing");
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
      let mediaId: number | undefined;

      // For voice transcripts, create a MediaFile record first
      if (noteType === "VOICE_TRANSCRIPT" && voiceRecording?.s3Key) {
        const bucketName = getBucketName();
        // Construct the S3 URL for the audio file
        const s3Url = `https://${bucketName}.s3.amazonaws.com/${voiceRecording.s3Key}`;

        const mediaFile = await createMediaMutation.mutateAsync({
          caseId,
          fileType: "AUDIO",
          s3Key: voiceRecording.s3Key,
          url: s3Url,
        });

        mediaId = mediaFile.mediaId;
      }

      // Create the note with mediaId if it's a voice transcript
      await createNoteMutation.mutateAsync({
        caseId,
        noteType,
        noteText: noteText.trim(),
        ...(mediaId !== undefined && { mediaId: Number(mediaId) }),
      });

      // Cleanup audio
      if (sound) {
        await sound.unloadAsync();
      }

      // Navigate back to case detail
      router.replace(`/case-detail?caseId=&fromCreate=0`);
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Failed to create note",
      );
    }
  };

  if (!caseId) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <StatusBar style="auto" />
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.text }]}>
            Invalid case ID
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
                value={noteText}
                onChangeText={setNoteText}
                placeholder="Type your note or tap the microphone to record..."
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
                  caseId={caseId}
                />
              </View>
            </View>
          </View>
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
  saveButton: {
    marginTop: 8,
  },
});
