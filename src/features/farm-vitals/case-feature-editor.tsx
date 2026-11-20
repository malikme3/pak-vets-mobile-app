import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { TemplateEntryForm, fullWidthFields } from "./template-entry";
import { farmButton } from "./presentation";
import type { FarmTemplateField } from "../../services/farmVitalsApi";

export function CaseFeatureEditor({
  farmId,
  fields,
  values,
  onSave,
  onCancel,
}: {
  farmId: string;
  fields: FarmTemplateField[];
  values: Record<string, unknown>;
  onSave: (values: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save(next: Record<string, unknown>) {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(next);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The changes could not be saved.",
      );
      setSaving(false);
    }
  }
  return (
    <View style={styles.form}>
      <TemplateEntryForm
        template={{
          type: "health-case",
          name: "Case",
          updatedAt: "",
          adminConfig: {},
          form: {
            id: "feature",
            entity: "health-case",
            name: "Case",
            description: "",
            steps: [
              { id: "feature", title: "", fields: fullWidthFields(fields) },
            ],
          },
        }}
        initialValues={values}
        farmId={farmId}
        inlineGroups
        outlinedLabels
        saving={saving}
        submitLabel="Save changes"
        onSubmit={save}
      />
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        disabled={saving}
        onPress={onCancel}
        style={styles.cancel}
      >
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  form: { gap: 12, paddingTop: 8 },
  error: { color: "#B42318", fontSize: 13 },
  cancel: {
    ...farmButton,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: { color: "#1E7F5C", fontSize: 14, fontWeight: "700" },
});
