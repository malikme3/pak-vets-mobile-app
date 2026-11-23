import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { TemplateEntryForm, fullWidthFields } from "./template-entry";
import { inlineBreedFields } from "./breed-entry";
import { farmButton } from "./presentation";
import {
  updateAnimalSection,
  updateFarmSection,
  type FarmSectionDraft,
  type FarmTemplateField,
} from "../../services/farmVitalsApi";

export function FarmSectionEditor({
  farmId,
  animalEntryId,
  draft,
  fields,
  onCancel,
  onSaved,
}: {
  farmId: string;
  animalEntryId?: string;
  draft: FarmSectionDraft;
  fields: FarmTemplateField[];
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) {
  const entity = animalEntryId ? "animal" : "farm";
  const name = animalEntryId ? "Animal" : "Farm";
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save(values: Record<string, unknown>) {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const keys = fields.map((field) => field.key);
      const breed = inlineBreedFields(fields);
      if (breed) {
        keys.push(breed.nameKey);
        if (!breed.hasSpecies) keys.push(breed.speciesKey);
      }
      if (animalEntryId)
        await updateAnimalSection(
          farmId,
          animalEntryId,
          draft.revision,
          keys,
          values,
        );
      else await updateFarmSection(farmId, draft.revision, keys, values);
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
          type: entity,
          name,
          updatedAt: "",
          adminConfig: {},
          form: {
            id: "section",
            name,
            entity,
            description: "",
            steps: [
              {
                id: "section",
                title: "",
                fields: fullWidthFields(fields),
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
