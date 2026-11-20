import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { TemplateEntryForm } from "./template-entry";
import { farmButton } from "./presentation";
import {
  updateFarmSection,
  type FarmSectionDraft,
  type FarmTemplateField,
} from "../../services/farmVitalsApi";

function editFields(fields: FarmTemplateField[]): FarmTemplateField[] {
  return fields.map((field) => ({
    ...field,
    fullWidth: true,
    ...(field.fields ? { fields: editFields(field.fields) } : {}),
  }));
}

export function FarmSectionEditor({
  farmId,
  draft,
  fields,
  onCancel,
  onSaved,
}: {
  farmId: string;
  draft: FarmSectionDraft;
  fields: FarmTemplateField[];
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save(values: Record<string, unknown>) {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await updateFarmSection(
        farmId,
        draft.revision,
        fields.map((field) => field.key),
        values,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The section could not be saved.",
      );
      setSaving(false);
      return;
    }
    await onSaved();
  }
  return (
    <View style={styles.editor}>
      <TemplateEntryForm
        template={{
          type: "farm",
          name: "Farm",
          updatedAt: "",
          adminConfig: {},
          form: {
            id: "section",
            name: "Farm",
            entity: "farm",
            description: "",
            steps: [
              {
                id: "section",
                title: "",
                fields: editFields(fields),
              },
            ],
          },
        }}
        initialValues={draft.values}
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
  editor: { padding: 14, gap: 10 },
  error: { color: "#B42318", fontSize: 13 },
  cancel: {
    ...farmButton,
    minHeight: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  cancelText: { color: "#173D32", fontWeight: "700", fontSize: 15 },
});
