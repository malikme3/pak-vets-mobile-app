import { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Audio } from "expo-av";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTheme } from "../theme/useTheme";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { VoiceMessageRecorder } from "../components/voice/VoiceMessageRecorder";
import { useCurrentDoctor } from "../features/doctors/hooks";
import { useAnimal } from "../features/animals/hooks";
import { useCreateVisit } from "../features/visits/hooks";

type VoiceRecording = {
  s3Key: string;
  rawText: string;
  improvedText?: string;
  localUri: string;
};

export default function CreateVisitScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors } = useTheme();
  const { data: doctor, isLoading: doctorLoading } = useCurrentDoctor();

  const animalId = params.animalId ? Number(params.animalId) : undefined;
  const { data: selectedAnimal, isLoading: animalLoading } = useAnimal(
    animalId || 0,
  );

  const createVisitMutation = useCreateVisit();

  const [chiefComplaint, setChiefComplaint] = useState("");
  const [visitDatetime, setVisitDatetime] = useState<Date>(new Date()); // Default to current time
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [chiefComplaintVoiceRecording, setChiefComplaintVoiceRecording] =
    useState<VoiceRecording | null>(null);
  const [chiefComplaintSound, setChiefComplaintSound] =
    useState<Audio.Sound | null>(null);
  const [isPlayingChiefComplaint, setIsPlayingChiefComplaint] = useState(false);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      const cleanupAudio = async (sound: Audio.Sound | null) => {
        if (sound) {
          try {
            await sound.unloadAsync();
          } catch (error) {
            if (__DEV__) {
              console.error("[CreateVisit] Audio cleanup error:", error);
            }
          }
        }
      };

      cleanupAudio(chiefComplaintSound);
    };
  }, [chiefComplaintSound]);

  const formatDateTime = (date: Date): string => {
    return date
      .toLocaleString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
      .replace(",", "");
  };

  // Chief Complaint Voice Handlers
  const handleChiefComplaintVoiceRecordingComplete = useCallback(
    (
      s3Key: string,
      rawText: string,
      improvedText?: string,
      localUri?: string,
    ) => {
      setChiefComplaintVoiceRecording({
        s3Key,
        rawText,
        improvedText,
        localUri: localUri || "",
      });
      setChiefComplaint(improvedText || rawText);
    },
    [],
  );

  const handleChiefComplaintTranscriptReady = useCallback(
    (transcript: string) => {
      setChiefComplaint(transcript);
    },
    [],
  );

  const handleChiefComplaintPlayPause = useCallback(async () => {
    if (
      !chiefComplaintVoiceRecording ||
      !chiefComplaintVoiceRecording.localUri
    ) {
      Alert.alert("Error", "Audio file not available for playback");
      return;
    }

    try {
      if (isPlayingChiefComplaint && chiefComplaintSound) {
        await chiefComplaintSound.pauseAsync();
        setIsPlayingChiefComplaint(false);
      } else {
        if (chiefComplaintSound) {
          await chiefComplaintSound.playAsync();
          setIsPlayingChiefComplaint(true);
        } else {
          const { sound: newSound } = await Audio.Sound.createAsync(
            { uri: chiefComplaintVoiceRecording.localUri },
            { shouldPlay: true },
          );
          setChiefComplaintSound(newSound);
          setIsPlayingChiefComplaint(true);

          newSound.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded && status.didJustFinish) {
              setIsPlayingChiefComplaint(false);
            }
          });
        }
      }
    } catch (error) {
      Alert.alert("Error", "Failed to play audio");
      if (__DEV__) {
        console.error("[CreateVisit] Chief Complaint playback error:", error);
      }
    }
  }, [
    chiefComplaintVoiceRecording,
    chiefComplaintSound,
    isPlayingChiefComplaint,
  ]);

  const handleChiefComplaintStop = useCallback(async () => {
    if (chiefComplaintSound) {
      await chiefComplaintSound.stopAsync();
      setIsPlayingChiefComplaint(false);
    }
  }, [chiefComplaintSound]);

  const handleChiefComplaintRecordAgain = useCallback(() => {
    setChiefComplaintVoiceRecording(null);
    setChiefComplaint("");
    if (chiefComplaintSound) {
      chiefComplaintSound.unloadAsync();
      setChiefComplaintSound(null);
    }
    setIsPlayingChiefComplaint(false);
  }, [chiefComplaintSound]);

  const handleDateChange = (event: unknown, selectedDate?: Date) => {
    const nativeEvent = event as { type: string };
    if (Platform.OS === "android") {
      setShowDatePicker(false);
      if (nativeEvent.type === "set" && selectedDate) {
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
    if (Platform.OS === "android") {
      setShowTimePicker(false);
      if (nativeEvent.type === "set" && selectedTime) {
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
      Alert.alert("Error", "Please select an animal first");
      return;
    }

    try {
      // Cleanup audio before navigation
      if (chiefComplaintSound) {
        await chiefComplaintSound.unloadAsync();
      }

      const visit = await createVisitMutation.mutateAsync({
        animalId: selectedAnimal.animalId,
        doctorId: doctor.doctorId,
        visitDatetime: visitDatetime.toISOString(),
        chiefComplaint: chiefComplaint.trim() || undefined,
      });

      router.replace(`/visit-detail?visitId=${visit.visitId}`);
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Failed to create visit",
      );
    }
  };

  const isLoading =
    doctorLoading || animalLoading || createVisitMutation.isPending;
  const isDisabled = !selectedAnimal;

  const handleSelectAnimal = () => {
    router.push({
      pathname: "/select-animal",
      params: { returnTo: "/create-visit" },
    });
  };

  if (isLoading && !selectedAnimal) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <StatusBar style="auto" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
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
          Create New Visit
        </Text>

        {/* Animal Selection */}
        <Card style={styles.card}>
          <Text style={[styles.label, { color: colors.text }]}>Animal</Text>
          {selectedAnimal ? (
            <View style={styles.animalInfo}>
              <Text style={[styles.animalText, { color: colors.text }]}>
                {selectedAnimal.species}
                {selectedAnimal.breed ? ` - ${selectedAnimal.breed}` : ""}
                {selectedAnimal.tagId ? ` (${selectedAnimal.tagId})` : ""}
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
          <Text style={[styles.label, { color: colors.text }]}>
            Visit Date & Time
          </Text>
          <TouchableOpacity
            onPress={() => {
              if (!isDisabled) {
                setShowDatePicker(true);
              }
            }}
            disabled={isDisabled}
            style={[
              styles.datePickerButton,
              {
                borderColor: colors.border,
                backgroundColor: colors.surface,
                opacity: isDisabled ? 0.5 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.datePickerText,
                { color: isDisabled ? colors.muted : colors.text },
              ]}
            >
              {formatDateTime(visitDatetime)}
            </Text>
            <Text style={[styles.datePickerHint, { color: colors.muted }]}>
              Tap to change
            </Text>
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={visitDatetime}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={handleDateChange}
              minimumDate={new Date(2020, 0, 1)}
              maximumDate={new Date(2030, 11, 31)}
            />
          )}

          {Platform.OS === "ios" && showDatePicker && (
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

          {Platform.OS === "android" && showTimePicker && (
            <DateTimePicker
              value={visitDatetime}
              mode="time"
              display="default"
              onChange={handleTimeChange}
              is24Hour={false}
            />
          )}
        </Card>

        {/* Chief Complaint with Voice Input */}
        <Card style={styles.inputCard}>
          <Text style={[styles.label, { color: colors.text }]}>
            Chief Complaint
          </Text>
          <View style={styles.inputContainer}>
            {/* Voice Recording Playback (if exists) */}
            {chiefComplaintVoiceRecording && (
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
                    onPress={handleChiefComplaintPlayPause}
                    style={styles.playbackIconButton}
                  >
                    <FontAwesome
                      name={isPlayingChiefComplaint ? "pause" : "play"}
                      size={12}
                      color={colors.primary}
                    />
                  </TouchableOpacity>
                  {isPlayingChiefComplaint && (
                    <TouchableOpacity
                      onPress={handleChiefComplaintStop}
                      style={styles.playbackIconButton}
                    >
                      <FontAwesome name="stop" size={12} color={colors.muted} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={handleChiefComplaintRecordAgain}
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
                    color: isDisabled ? colors.muted : colors.text,
                    opacity: isDisabled ? 0.5 : 1,
                  },
                ]}
                value={chiefComplaint}
                onChangeText={setChiefComplaint}
                placeholder="Type chief complaint or tap the microphone to record..."
                placeholderTextColor={colors.muted}
                multiline
                textAlignVertical="top"
                editable={!isDisabled}
              />
              {/* Microphone Button - Bottom Right */}
              {!isDisabled && (
                <View style={styles.micButtonWrapper}>
                  <VoiceMessageRecorder
                    onTranscriptReady={handleChiefComplaintTranscriptReady}
                    onRecordingComplete={
                      handleChiefComplaintVoiceRecordingComplete
                    }
                    onError={(error: Error) => {
                      Alert.alert("Error", error.message);
                    }}
                    buttonSize={32}
                    buttonColor={colors.primary}
                    visitId={undefined}
                  />
                </View>
              )}
            </View>
          </View>
        </Card>

        {/* Save Button */}
        <Button
          title={createVisitMutation.isPending ? "Creating..." : "Create Visit"}
          onPress={handleSave}
          variant="primary"
          disabled={isDisabled || !doctor || createVisitMutation.isPending}
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
    fontWeight: "600",
    marginBottom: 24,
  },
  card: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 8,
  },
  animalInfo: {
    marginTop: 8,
  },
  animalText: {
    fontSize: 16,
    fontWeight: "500",
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
    justifyContent: "center",
    alignItems: "center",
  },
  datePickerButton: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  datePickerText: {
    fontSize: 16,
    fontWeight: "500",
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
  inputCard: {
    marginBottom: 16,
    padding: 0,
    overflow: "hidden",
  },
  inputContainer: {
    padding: 16,
    paddingTop: 8,
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
    minHeight: 100,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 44,
    fontSize: 16,
    minHeight: 100,
    maxHeight: 200,
  },
  micButtonWrapper: {
    position: "absolute",
    bottom: 8,
    right: 8,
    zIndex: 10,
  },
});
