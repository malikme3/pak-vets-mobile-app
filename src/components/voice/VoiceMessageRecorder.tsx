import { useState, useCallback, useRef, useEffect } from "react";
import {
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { Audio } from "expo-av";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system/legacy";
import axios, { AxiosError } from "axios";
import {
  getUploadSignedUrl,
  transcribeAudio,
  getBucketName,
} from "../../services/sharedServicesApi";

type RecordingStatus = "idle" | "recording" | "processing";

interface VoiceMessageRecorderProps {
  onTranscriptReady?: (transcript: string) => void;
  onRecordingComplete?: (
    s3Key: string,
    rawText: string,
    improvedText?: string,
    localUri?: string,
  ) => void;
  onError?: (error: Error) => void;
  buttonSize?: number;
  buttonColor?: string;
  disabled?: boolean;
  caseId?: number;
}

// Constants
const RECORDING_OPTIONS = Audio.RecordingOptionsPresets.HIGH_QUALITY;
const AUDIO_TAG = "type=audio-note";
const S3_PROCESSING_DELAY_MS = 2000;
const BUTTON_DEBOUNCE_MS = 500;
const BUTTON_PRESS_DELAY_MS = 10;
const RECORDING_BUTTON_COLOR = "#ef4444";
const ACTIVITY_INDICATOR_COLOR = "#fff";

export function VoiceMessageRecorder({
  onTranscriptReady,
  onRecordingComplete,
  onError,
  buttonSize = 36,
  buttonColor = "#007AFF",
  disabled = false,
  caseId,
}: VoiceMessageRecorderProps) {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingStatus, setRecordingStatus] =
    useState<RecordingStatus>("idle");
  const [isProcessing, setIsProcessing] = useState(false);
  const isRecordingInProgressRef = useRef<boolean>(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const handleButtonPressRef = useRef(false);

  const cleanupAudio = useCallback(async () => {
    try {
      const rec = recordingRef.current;
      if (rec) {
        const status = await rec.getStatusAsync();
        if (status.isRecording || status.canRecord) {
          await rec.stopAndUnloadAsync();
        }
      }
    } catch (e) {
      console.log("[VoiceRecorder] Cleanup error (ignored):", e);
    } finally {
      setRecording(null);
      recordingRef.current = null;
    }
  }, []);

  const resetRecording = useCallback(async () => {
    isRecordingInProgressRef.current = false;
    await cleanupAudio();
    setRecordingStatus("idle");
  }, [cleanupAudio]);

  const generateS3Key = useCallback((): string => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    const prefix = caseId ? `cases/${caseId}/audio` : "audio";
    return `${prefix}/${timestamp}-${random}.m4a`;
  }, [caseId]);

  const startRecording = useCallback(async () => {
    if (
      isRecordingInProgressRef.current ||
      recordingStatus !== "idle" ||
      disabled
    ) {
      return;
    }

    isRecordingInProgressRef.current = true;

    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Permission Denied", "Microphone access is required.");
        isRecordingInProgressRef.current = false;
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      if (recordingRef.current) {
        try {
          await recordingRef.current.stopAndUnloadAsync();
        } catch {
          // Ignore cleanup errors
        }
        recordingRef.current = null;
      }

      const { recording: newRecording } =
        await Audio.Recording.createAsync(RECORDING_OPTIONS);

      recordingRef.current = newRecording;
      setRecording(newRecording);
      setRecordingStatus("recording");

      if (Platform.OS === "ios") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (error) {
      Alert.alert(
        "Error",
        `Could not start recording: ${error instanceof Error ? error.message : String(error)}`,
      );
      setRecordingStatus("idle");
      recordingRef.current = null;
    } finally {
      isRecordingInProgressRef.current = false;
    }
  }, [recordingStatus, disabled]);

  /**
   * Formats error messages for user-friendly display
   */
  const formatErrorMessage = useCallback((error: unknown): string => {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{
        error?: { message?: string };
        message?: string;
      }>;
      if (axiosError.response) {
        const responseData = axiosError.response.data;
        const message =
          responseData?.error?.message ||
          responseData?.message ||
          axiosError.message;
        return `API Error (${axiosError.response.status}): ${message}`;
      }
      if (axiosError.request) {
        return "Network error: Could not reach transcription service";
      }
    }
    return `Failed to process audio: ${
      error instanceof Error ? error.message : String(error)
    }`;
  }, []);

  const stopAndTranscribe = useCallback(async () => {
    const rec = recordingRef.current;

    if (!rec) {
      Alert.alert("Error", "No active recording found.");
      setRecordingStatus("idle");
      return;
    }

    try {
      isRecordingInProgressRef.current = false;
      setRecordingStatus("processing");

      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();

      if (!uri) {
        throw new Error("No recording URI available");
      }

      setRecording(null);
      recordingRef.current = null;
      setIsProcessing(true);

      // Generate S3 key and get bucket name based on stage
      const s3Key = generateS3Key();
      const bucketName = getBucketName();

      // Get presigned URL for upload
      console.log("[VoiceRecorder] Requesting presigned URL:", {
        bucketName,
        s3Key,
        tags: AUDIO_TAG,
      });
      const { signedUrl } = await getUploadSignedUrl(
        bucketName,
        s3Key,
        AUDIO_TAG,
      );
      console.log("[VoiceRecorder] Presigned URL received:", {
        signedUrlLength: signedUrl.length,
        bucketName,
        s3Key,
      });

      // Upload audio to S3
      console.log("[VoiceRecorder] Uploading to S3:", {
        s3Key,
        bucketName,
        uri,
        signedUrlPreview: signedUrl.substring(0, 200) + "...",
      });
      const uploadResult = await FileSystem.uploadAsync(signedUrl, uri, {
        httpMethod: "PUT",
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: { "Content-Type": "audio/m4a" },
      });

      // Verify upload was successful
      if (uploadResult.status !== 200) {
        const errorBody =
          typeof uploadResult.body === "string"
            ? uploadResult.body
            : JSON.stringify(uploadResult.body);
        console.error("[VoiceRecorder] S3 Upload Failed:", {
          status: uploadResult.status,
          headers: uploadResult.headers,
          body: errorBody,
          signedUrl: signedUrl.substring(0, 200) + "...",
          bucketName,
          s3Key,
        });
        throw new Error(
          `S3 upload failed with status ${uploadResult.status}: ${errorBody}`,
        );
      }
      console.log("[VoiceRecorder] S3 upload successful");

      // Wait for S3 to process the file before transcription
      console.log(
        `[VoiceRecorder] Waiting ${S3_PROCESSING_DELAY_MS}ms for S3 processing...`,
      );
      await new Promise((resolve) =>
        setTimeout(resolve, S3_PROCESSING_DELAY_MS),
      );

      // Transcribe audio using s3Key (backend will generate read URL internally)
      console.log("[VoiceRecorder] Calling transcription API with s3Key:", {
        s3Key,
        bucketName,
      });
      const result = await transcribeAudio(s3Key, bucketName);
      console.log("[VoiceRecorder] Transcription completed:", {
        status: result.status,
        hasRawText: !!result.transcript.rawText,
        rawTextLength: result.transcript.rawText?.length || 0,
        hasImprovedText: !!result.transcript.improvedText,
      });

      if (result.status === "REJECTED") {
        Alert.alert("Rejected", "Content not allowed.");
        await resetRecording();
        return;
      }

      const transcriptText =
        result.transcript.improvedText || result.transcript.rawText || "";

      // Handle empty transcription - could be silent audio or too short
      if (!transcriptText || transcriptText.trim().length === 0) {
        console.warn(
          "[VoiceRecorder] Empty transcription - audio may be silent or too short",
        );
        Alert.alert(
          "No Speech Detected",
          "The recording doesn't contain any detectable speech. Please try recording again.",
        );
        await resetRecording();
        return;
      }

      if (onTranscriptReady) {
        onTranscriptReady(transcriptText);
      }

      if (onRecordingComplete) {
        onRecordingComplete(
          s3Key,
          result.transcript.rawText || "",
          result.transcript.improvedText,
          uri, // Pass local URI for playback
        );
      }

      await resetRecording();
    } catch (error) {
      const errorObj =
        error instanceof Error ? error : new Error(String(error));

      console.error("[VoiceRecorder] Error in stopAndTranscribe:", {
        error: errorObj.message,
        stack: errorObj.stack,
      });

      // Format error message for user display
      const errorMessage = formatErrorMessage(error);

      if (onError) {
        onError(errorObj);
      } else {
        Alert.alert("Error", errorMessage);
      }
      await resetRecording();
    } finally {
      setIsProcessing(false);
    }
  }, [
    onTranscriptReady,
    onRecordingComplete,
    onError,
    resetRecording,
    generateS3Key,
    formatErrorMessage,
    caseId,
  ]);

  const handleButtonPress = useCallback(() => {
    if (handleButtonPressRef.current) {
      return;
    }

    handleButtonPressRef.current = true;
    setTimeout(() => {
      handleButtonPressRef.current = false;
    }, BUTTON_DEBOUNCE_MS);

    if (disabled || isProcessing) {
      handleButtonPressRef.current = false;
      return;
    }

    if (recordingStatus === "idle") {
      startRecording();
    } else if (recordingStatus === "recording") {
      stopAndTranscribe();
    } else {
      handleButtonPressRef.current = false;
    }
  }, [
    recordingStatus,
    disabled,
    isProcessing,
    startRecording,
    stopAndTranscribe,
  ]);

  useEffect(() => {
    return () => {
      isRecordingInProgressRef.current = false;
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
        recordingRef.current = null;
      }
    };
  }, []);

  return (
    <TouchableOpacity
      style={[
        styles.micButton,
        {
          width: buttonSize,
          height: buttonSize,
          borderRadius: buttonSize / 2,
          backgroundColor:
            recordingStatus === "recording"
              ? RECORDING_BUTTON_COLOR
              : buttonColor,
        },
        (disabled || isProcessing) && { opacity: 0.5 },
      ]}
      onPress={handleButtonPress}
      onPressIn={() => {
        if (!disabled && !isProcessing && !handleButtonPressRef.current) {
          setTimeout(() => {
            handleButtonPress();
          }, BUTTON_PRESS_DELAY_MS);
        }
      }}
      disabled={disabled || isProcessing}
      activeOpacity={0.7}
      hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
      delayPressIn={0}
      delayPressOut={0}
    >
      {isProcessing ? (
        <ActivityIndicator size="small" color={ACTIVITY_INDICATOR_COLOR} />
      ) : recordingStatus === "recording" ? (
        <FontAwesome
          name="stop"
          size={buttonSize * 0.45}
          color={ACTIVITY_INDICATOR_COLOR}
        />
      ) : (
        <FontAwesome
          name="microphone"
          size={buttonSize * 0.5}
          color={ACTIVITY_INDICATOR_COLOR}
        />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  micButton: {
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
});
