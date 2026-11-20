import { useState, type ReactNode } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { farmBorder } from "./presentation";

export function OutlinedField({
  label,
  focused = false,
  children,
}: {
  label: string;
  focused?: boolean;
  children: ReactNode;
}) {
  return (
    <View style={styles.spacing}>
      <View style={[styles.field, focused && styles.focused]}>
        <Text
          numberOfLines={1}
          style={[styles.label, focused && styles.focusedLabel]}
        >
          {label}
        </Text>
        {children}
      </View>
    </View>
  );
}

export function OutlinedTextInput({
  label,
  style,
  onFocus,
  onBlur,
  ...props
}: TextInputProps & { label: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <OutlinedField label={label} focused={focused}>
      <TextInput
        {...props}
        accessibilityLabel={props.accessibilityLabel ?? label}
        style={[styles.input, style]}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
      />
    </OutlinedField>
  );
}
const styles = StyleSheet.create({
  spacing: { paddingTop: 8, width: "100%" },
  field: {
    position: "relative",
    borderWidth: 1.5,
    borderColor: farmBorder,
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
    padding: 14,
    minHeight: 56,
    gap: 8,
  },
  label: {
    position: "absolute",
    top: -9,
    left: 12,
    maxWidth: "90%",
    paddingHorizontal: 5,
    backgroundColor: "#FFFFFF",
    color: "#63766C",
    fontSize: 12,
    lineHeight: 16,
  },
  focused: { borderColor: "#3E7EAA" },
  focusedLabel: { color: "#3E7EAA" },
  input: { color: "#173D32", fontSize: 16, minHeight: 26, padding: 0 },
});
