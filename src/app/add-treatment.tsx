import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
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
import { useCreateCaseTreatment, useUpdateCaseTreatment } from "../features/treatments/hooks";
import { useCreateMediaFile } from "../features/media/hooks";
import {
  getBucketName,
  processStructuredTranscription,
  getUploadSignedUrl,
} from "../services/sharedServicesApi";
import * as FileSystem from "expo-file-system/legacy";

export default function AddTreatmentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors } = useTheme();

  const caseId = params.caseId ? Number(params.caseId) : undefined;
  const param = (key: string) =>
    typeof params[key] === "string"
      ? params[key]
      : Array.isArray(params[key])
        ? (params[key] as string[])[0]
        : "";
  const paramTreatmentId = param("treatmentId");
  const treatmentId = paramTreatmentId ? Number(paramTreatmentId) : undefined;
  const isEditMode = treatmentId != null && treatmentId > 0;

  const paramTreatmentType = param("treatmentType");
  const validType: "MEDICATION" | "PROCEDURE" | "ADVICE" =
    paramTreatmentType === "PROCEDURE"
      ? "PROCEDURE"
      : paramTreatmentType === "ADVICE"
        ? "ADVICE"
        : "MEDICATION";
  const paramStatus = param("treatmentStatus");
  const validStatus: "PLANNED" | "ONGOING" | "COMPLETED" | "STOPPED" =
    paramStatus === "ONGOING"
      ? "ONGOING"
      : paramStatus === "COMPLETED"
        ? "COMPLETED"
        : paramStatus === "STOPPED"
          ? "STOPPED"
          : "PLANNED";

  const createTreatmentMutation = useCreateCaseTreatment();
  const updateTreatmentMutation = useUpdateCaseTreatment();
  const createMediaMutation = useCreateMediaFile();

  const [treatmentType, setTreatmentType] = useState<
    "MEDICATION" | "PROCEDURE" | "ADVICE"
  >(validType);
  const [treatmentStatus, setTreatmentStatus] = useState<
    "PLANNED" | "ONGOING" | "COMPLETED" | "STOPPED"
  >(validStatus);
  const [medicineNameFree, setMedicineNameFree] = useState(
    param("medicineNameFree"),
  );
  const [dose, setDose] = useState(param("dose"));
  const [route, setRoute] = useState(param("route"));
  const [frequency, setFrequency] = useState(param("frequency"));
  const [durationDays, setDurationDays] = useState(param("durationDays"));
  const [instructions, setInstructions] = useState(param("instructions"));
  const [voiceRecording, setVoiceRecording] = useState<{
    s3Key: string;
    rawText: string;
    improvedText?: string;
    localUri: string;
  } | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isProcessingStructured, setIsProcessingStructured] = useState(false);
  const [autoFillRecording, setAutoFillRecording] =
    useState<Audio.Recording | null>(null);
  const [isAutoFillRecording, setIsAutoFillRecording] = useState(false);

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

  const generateS3Key = useCallback((): string => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    const prefix = caseId ? `cases/${caseId}/audio` : "audio";
    return `${prefix}/${timestamp}-${random}.m4a`;
  }, [caseId]);

  const handleStartAutoFillRecording = useCallback(async () => {
    if (isAutoFillRecording || isProcessingStructured || !caseId) {
      console.log("******************Auto-fill from audio******************");
      console.log("[Auto-fill] Cannot start recording:", {
        isAutoFillRecording,
        isProcessingStructured,
        caseId,
      });
      return;
    }

    try {
      console.log("******************Auto-fill from audio******************");
      console.log("[Auto-fill] Starting recording...");
      setIsAutoFillRecording(true);

      // Request microphone permission
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== "granted") {
        console.log("[Auto-fill] Microphone permission denied");
        Alert.alert("Permission Denied", "Microphone access is required.");
        setIsAutoFillRecording(false);
        return;
      }

      console.log("[Auto-fill] Microphone permission granted");
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      // Stop any existing recording
      if (autoFillRecording) {
        try {
          console.log("[Auto-fill] Cleaning up existing recording");
          await autoFillRecording.stopAndUnloadAsync();
        } catch {
          // Ignore cleanup errors
        }
      }

      // Start new recording
      console.log("[Auto-fill] Creating new recording...");
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      setAutoFillRecording(recording);
      console.log("[Auto-fill] Recording started successfully");
    } catch (error) {
      console.error("[Auto-fill] Error starting recording:", error);
      Alert.alert(
        "Error",
        `Could not start recording: ${error instanceof Error ? error.message : String(error)}`,
      );
      setIsAutoFillRecording(false);
    }
  }, [isAutoFillRecording, isProcessingStructured, caseId, autoFillRecording]);

  const handleStopAutoFillRecording = useCallback(async () => {
    if (!autoFillRecording || !caseId) {
      console.log("******************Auto-fill from audio******************");
      console.log("[Auto-fill] Cannot stop recording:", {
        hasRecording: !!autoFillRecording,
        caseId,
      });
      return;
    }

    try {
      console.log("******************Auto-fill from audio******************");
      console.log("[Auto-fill] Stopping recording and processing...");
      setIsAutoFillRecording(false);
      setIsProcessingStructured(true);

      // Stop recording
      await autoFillRecording.stopAndUnloadAsync();
      const uri = autoFillRecording.getURI();

      if (!uri) {
        throw new Error("No recording URI available");
      }

      console.log("[Auto-fill] Recording stopped, URI:", uri);
      setAutoFillRecording(null);

      // Generate S3 key and upload
      const s3Key = generateS3Key();
      const bucketName = getBucketName();

      console.log("[Auto-fill] Generated S3 key:", { s3Key, bucketName });

      // Get presigned URL for upload
      console.log("[Auto-fill] Requesting presigned URL for upload...");
      const { signedUrl } = await getUploadSignedUrl(
        bucketName,
        s3Key,
        "type=audio-treatment-auto-fill",
      );
      console.log("[Auto-fill] Presigned URL received:", {
        signedUrlLength: signedUrl.length,
      });

      // Upload audio to S3
      console.log("[Auto-fill] Uploading audio to S3...");
      const uploadResult = await FileSystem.uploadAsync(signedUrl, uri, {
        httpMethod: "PUT",
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: { "Content-Type": "audio/m4a" },
      });

      if (uploadResult.status !== 200) {
        console.error("[Auto-fill] S3 upload failed:", {
          status: uploadResult.status,
          body: uploadResult.body,
        });
        throw new Error(`S3 upload failed with status ${uploadResult.status}`);
      }

      console.log("[Auto-fill] S3 upload successful:", {
        status: uploadResult.status,
        s3Key,
      });

      // Wait for S3 to process the file
      console.log("[Auto-fill] Waiting for S3 processing (2s)...");
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Process structured transcription
      const audioS3Url = `https://${bucketName}.s3.amazonaws.com/${s3Key}`;
      console.log("[Auto-fill] Audio S3 URL:", audioS3Url);

      const expectedSchema = {
        medicine_name: "string",
        dose: "string",
        route: "string",
        frequency: "string",
        instructions: "string",
        treatment_type: "string",
        status: "string",
      };

      console.log("[Auto-fill] Requesting structured transcription:", {
        audioS3Url,
        expectedSchema,
      });

      const result = await processStructuredTranscription({
        audioS3Url,
        expectedSchema,
      });

      console.log("******************Auto-fill from audio******************");
      console.log("[Auto-fill] Structured transcription response:", {
        status: result.status,
        audioTranscriptRaw:
          result.audioTranscriptRaw?.substring(0, 100) + "...",
        audioTranscriptEnriched:
          result.audioTranscriptEnriched?.substring(0, 100) + "...",
        audioTranscriptStructured: result.audioTranscriptStructured || null,
        hasStructuredData: !!result.audioTranscriptStructured,
      });

      if (
        result.status === "SUCCESS" &&
        result.audioTranscriptStructured &&
        typeof result.audioTranscriptStructured === "object"
      ) {
        const structured = result.audioTranscriptStructured;
        console.log("[Auto-fill] Auto-populating form fields...");

        const populatedFields: string[] = [];

        // Auto-populate form fields based on structured data
        if (
          structured.medicine_name &&
          typeof structured.medicine_name === "string"
        ) {
          console.log(
            "[Auto-fill] Setting medicine_name:",
            structured.medicine_name,
          );
          setMedicineNameFree(structured.medicine_name);
          populatedFields.push("medicine_name");
        }
        if (structured.dose && typeof structured.dose === "string") {
          console.log("[Auto-fill] Setting dose:", structured.dose);
          setDose(structured.dose);
          populatedFields.push("dose");
        }
        if (structured.route && typeof structured.route === "string") {
          console.log("[Auto-fill] Setting route:", structured.route);
          setRoute(structured.route);
          populatedFields.push("route");
        }
        if (structured.frequency && typeof structured.frequency === "string") {
          console.log("[Auto-fill] Setting frequency:", structured.frequency);
          setFrequency(structured.frequency);
          populatedFields.push("frequency");
        }
        if (
          structured.instructions &&
          typeof structured.instructions === "string"
        ) {
          console.log(
            "[Auto-fill] Setting instructions:",
            structured.instructions.substring(0, 50) + "...",
          );
          setInstructions(structured.instructions);
          populatedFields.push("instructions");
        }
        if (
          structured.treatment_type &&
          typeof structured.treatment_type === "string"
        ) {
          const treatmentTypeUpper = structured.treatment_type.toUpperCase();
          if (
            treatmentTypeUpper === "MEDICATION" ||
            treatmentTypeUpper === "PROCEDURE" ||
            treatmentTypeUpper === "ADVICE"
          ) {
            console.log(
              "[Auto-fill] Setting treatment_type:",
              treatmentTypeUpper,
            );
            setTreatmentType(
              treatmentTypeUpper as "MEDICATION" | "PROCEDURE" | "ADVICE",
            );
            populatedFields.push("treatment_type");
          }
        }
        if (structured.status && typeof structured.status === "string") {
          const statusUpper = structured.status.toUpperCase();
          if (
            statusUpper === "PLANNED" ||
            statusUpper === "ONGOING" ||
            statusUpper === "COMPLETED" ||
            statusUpper === "STOPPED"
          ) {
            console.log("[Auto-fill] Setting status:", statusUpper);
            setTreatmentStatus(
              statusUpper as "PLANNED" | "ONGOING" | "COMPLETED" | "STOPPED",
            );
            populatedFields.push("status");
          }
        }

        console.log(
          "[Auto-fill] Form auto-populated successfully. Fields populated:",
          populatedFields,
        );
        console.log("******************Auto-fill from audio******************");
        Alert.alert("Success", "Form auto-populated from audio transcription");
      } else {
        console.warn(
          "[Auto-fill] Failed to extract structured data. Status:",
          result.status,
        );
        console.log("******************Auto-fill from audio******************");
        Alert.alert(
          "Warning",
          "Could not extract structured data from audio. Please fill the form manually.",
        );
      }
    } catch (error) {
      console.error("******************Auto-fill from audio******************");
      console.error("[Auto-fill] Error processing structured transcription:", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      console.log("******************Auto-fill from audio******************");
      Alert.alert(
        "Error",
        error instanceof Error
          ? error.message
          : "Failed to process structured transcription",
      );
    } finally {
      setIsProcessingStructured(false);
      setAutoFillRecording(null);
      console.log("[Auto-fill] Processing completed, state reset");
    }
  }, [autoFillRecording, caseId, generateS3Key]);

  const handleAutoFillButtonPress = useCallback(() => {
    if (isAutoFillRecording) {
      handleStopAutoFillRecording();
    } else {
      handleStartAutoFillRecording();
    }
  }, [
    isAutoFillRecording,
    handleStartAutoFillRecording,
    handleStopAutoFillRecording,
  ]);

  const handleSave = async () => {
    if (!caseId) {
      Alert.alert("Error", "Case ID is missing");
      return;
    }

    try {
      let mediaId: number | undefined = undefined;

      // If there's a voice recording, create MediaFile first (new or edit)
      if (voiceRecording?.s3Key) {
        const bucketName = getBucketName();
        const s3Url = `https://${bucketName}.s3.amazonaws.com/${voiceRecording.s3Key}`;

        const mediaFile = await createMediaMutation.mutateAsync({
          caseId,
          fileType: "AUDIO",
          s3Key: voiceRecording.s3Key,
          url: s3Url,
        });

        mediaId = mediaFile.mediaId;
      }

      if (isEditMode && treatmentId != null) {
        await updateTreatmentMutation.mutateAsync({
          treatmentId,
          request: {
            treatmentType,
            treatmentStatus,
            medicineNameFree: medicineNameFree.trim() || undefined,
            dose: dose.trim() || undefined,
            route: route.trim() || undefined,
            frequency: frequency.trim() || undefined,
            durationDays: durationDays ? Number(durationDays) : undefined,
            instructions: instructions.trim() || undefined,
          },
        });
      } else {
        await createTreatmentMutation.mutateAsync({
          caseId,
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
      }

      // Navigate back to case detail
      router.replace(`/case-detail?caseId=${caseId}`);
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error
          ? error.message
          : isEditMode
            ? "Failed to update treatment"
            : "Failed to create treatment",
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
        <View style={styles.titleContainer}>
          <Text style={[styles.title, { color: colors.text }]}>
            {isEditMode ? "Edit Treatment" : "Add Treatment"}
          </Text>
          {/* Auto-fill from Audio Button */}
          <TouchableOpacity
            onPress={handleAutoFillButtonPress}
            disabled={isProcessingStructured}
            style={[
              styles.autoFillButton,
              {
                backgroundColor: isAutoFillRecording
                  ? colors.danger
                  : colors.primary,
                opacity: isProcessingStructured ? 0.6 : 1,
              },
            ]}
          >
            {isProcessingStructured ? (
              <ActivityIndicator size="small" color={colors.background} />
            ) : (
              <>
                <FontAwesome
                  name={isAutoFillRecording ? "stop" : "microphone"}
                  size={14}
                  color={colors.background}
                />
                <Text
                  style={[
                    styles.autoFillButtonText,
                    { color: colors.background },
                  ]}
                >
                  {isAutoFillRecording
                    ? "Stop & Auto-fill"
                    : "Auto-fill from audio"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

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
                  caseId={caseId}
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
          loading={
            createTreatmentMutation.isPending || createMediaMutation.isPending
          }
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
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    flex: 1,
  },
  autoFillButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    minWidth: 140,
  },
  autoFillButtonText: {
    fontSize: 12,
    fontWeight: "600",
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
    marginBottom: 8,
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
