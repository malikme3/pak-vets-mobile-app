import React, { forwardRef } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  type TextInput as RNTextInput,
} from "react-native";
import { useTheme } from "../theme/useTheme";
import { VoiceMessageRecorder } from "./voice/VoiceMessageRecorder";

const HELP_EMPTY =
  "Please add the main signs and symptoms so our AI can suggest the most likely diagnosis.";
const HELP_FILLED =
  "Update the main signs and symptoms so our AI can suggest the most likely diagnosis.";

export interface ChiefComplaintFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  helpTextEmpty?: string;
  helpTextFilled?: string;
  /** When true, shows a microphone button to record voice and fill the field via transcription */
  showVoiceInput?: boolean;
  onRecordingComplete?: (
    s3Key: string,
    rawText: string,
    improvedText?: string,
    localUri?: string,
  ) => void;
  onTranscriptReady?: (transcript: string) => void;
  onVoiceError?: (error: Error) => void;
  caseId?: number;
}

export const ChiefComplaintField = forwardRef<
  RNTextInput,
  ChiefComplaintFieldProps
>(function ChiefComplaintField(
  {
    value,
    onChangeText,
    disabled = false,
    placeholder = "Tap to edit chief complaint…",
    helpTextEmpty = HELP_EMPTY,
    helpTextFilled = HELP_FILLED,
    showVoiceInput = false,
    onRecordingComplete,
    onTranscriptReady,
    onVoiceError,
    caseId,
  },
  ref,
) {
  const { colors } = useTheme();
  const hasValue = value.trim().length > 0;

  const inputContent = (
    <TouchableOpacity
      style={styles.touchable}
      onPress={() => (ref as React.RefObject<RNTextInput>)?.current?.focus()}
      activeOpacity={1}
      disabled={disabled}
    >
      <TextInput
        ref={ref}
        style={[
          styles.input,
          showVoiceInput && styles.inputWithMic,
          {
            color: colors.text,
            borderColor: colors.border,
            backgroundColor: colors.surface,
          },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={
          showVoiceInput
            ? "Type chief complaint or tap the microphone to record…"
            : placeholder
        }
        placeholderTextColor={colors.muted}
        multiline
        textAlignVertical="top"
        editable={!disabled}
      />
    </TouchableOpacity>
  );

  return (
    <View>
      {showVoiceInput ? (
        <View style={styles.inputWrapper}>
          {inputContent}
          {!disabled && (
            <View style={styles.micButtonWrapper}>
              <VoiceMessageRecorder
                onTranscriptReady={onTranscriptReady}
                onRecordingComplete={onRecordingComplete}
                onError={onVoiceError}
                buttonSize={32}
                buttonColor={colors.primary}
                caseId={caseId}
              />
            </View>
          )}
        </View>
      ) : (
        inputContent
      )}
      <Text style={[styles.help, { color: colors.muted }]}>
        {hasValue ? helpTextFilled : helpTextEmpty}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  touchable: {
    marginBottom: 4,
  },
  inputWrapper: {
    position: "relative",
    minHeight: 56,
  },
  input: {
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 24,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 56,
    maxHeight: 120,
  },
  inputWithMic: {
    paddingBottom: 44,
  },
  micButtonWrapper: {
    position: "absolute",
    bottom: 12,
    right: 12,
    zIndex: 10,
  },
  help: {
    fontSize: 12,
    marginTop: 0,
    marginBottom: 0,
  },
});
