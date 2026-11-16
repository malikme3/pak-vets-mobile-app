import { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import type {
  ActiveFarmTemplate,
  FarmTemplateField,
} from "../../services/farmVitalsApi";

const colors = {
  ink: "#173D32",
  muted: "#63766C",
  green: "#1E7F5C",
  border: "#DFE6DC",
  surface: "#FFFFFF",
  danger: "#B42318",
};

type Answer = string | boolean | Answers;
type Answers = { [key: string]: Answer };

function isTemplateStatus(field: FarmTemplateField): boolean {
  const options = (field.rules.options ?? []).map((option) => option.trim());
  return (
    field.key === "active" ||
    (options.length === 2 &&
      options.includes("Active") &&
      options.includes("Inactive"))
  );
}

function entryFields(fields: FarmTemplateField[]): FarmTemplateField[] {
  return fields
    .filter((field) => !isTemplateStatus(field))
    .map((field) =>
      field.fields ? { ...field, fields: entryFields(field.fields) } : field,
    );
}

function isGroup(field: FarmTemplateField): boolean {
  return (
    field.type === "group" ||
    field.type === "contact" ||
    field.type === "location" ||
    Boolean(field.fields?.length)
  );
}

function patternExample(pattern: string): string | null {
  let source = pattern.trim();
  if (source.startsWith("^")) source = source.slice(1);
  if (source.endsWith("$")) source = source.slice(0, -1);
  let index = 0;
  let digit = 1;
  let example = "";
  while (index < source.length) {
    if (source.startsWith("\\d", index)) {
      index += 2;
      let count = 1;
      if (source[index] === "{") {
        const end = source.indexOf("}", index);
        const parsed = Number(source.slice(index + 1, end));
        if (!Number.isInteger(parsed) || end < 0) return null;
        count = parsed;
        index = end + 1;
      }
      for (let step = 0; step < count; step += 1) {
        example += String(digit);
        digit = digit === 9 ? 1 : digit + 1;
      }
      continue;
    }
    if (source[index] === "\\") {
      example += source[index + 1] ?? "";
      index += 2;
      continue;
    }
    if (/[A-Za-z0-9+\- .]/.test(source[index] ?? "")) {
      example += source[index];
      index += 1;
      continue;
    }
    return null;
  }
  return example || null;
}

function ruleNumber(value: number | string | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value)))
    return Number(value);
  return null;
}

function leafError(
  field: FarmTemplateField,
  value: Answer | undefined,
  required: boolean,
): string | null {
  if (field.type === "checkbox" || field.type === "switch")
    return required && value !== true ? "This field is required." : null;
  const empty =
    value === undefined ||
    value === "" ||
    (typeof value === "string" && !value.trim());
  if (empty) return required ? "This field is required." : null;
  const text = typeof value === "string" ? value.trim() : "";
  if (field.type === "number") {
    const amount = Number(text);
    if (!Number.isFinite(amount)) return "Enter a number.";
    const min = ruleNumber(field.rules.min);
    const max = ruleNumber(field.rules.max);
    if (min !== null && amount < min) return `Enter ${min} or more.`;
    if (max !== null && amount > max) return `Enter ${max} or less.`;
  }
  if (field.type === "date") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "Use YYYY-MM-DD.";
    if (typeof field.rules.min === "string" && text < field.rules.min)
      return `Choose ${field.rules.min} or later.`;
    if (typeof field.rules.max === "string" && text > field.rules.max)
      return `Choose ${field.rules.max} or earlier.`;
  }
  if (
    typeof field.rules.minLength === "number" &&
    text.length < field.rules.minLength
  )
    return `Enter at least ${field.rules.minLength} characters.`;
  if (
    typeof field.rules.maxLength === "number" &&
    text.length > field.rules.maxLength
  )
    return `Use ${field.rules.maxLength} characters or fewer.`;
  const options = (field.rules.options ?? [])
    .map((option) => option.trim())
    .filter(Boolean);
  if (
    (field.type === "select" || field.type === "radio") &&
    options.length > 0 &&
    !options.includes(text)
  )
    return "Choose one of the options.";
  if (field.rules.pattern) {
    try {
      if (!new RegExp(field.rules.pattern).test(text)) {
        const example = patternExample(field.rules.pattern);
        return example ? `Example: ${example}` : "Use the expected format.";
      }
    } catch {
      return "This value could not be checked.";
    }
  }
  return null;
}

function collectErrors(
  fields: FarmTemplateField[],
  answers: Answers,
  path: string,
  forceRequired: boolean,
  errors: Record<string, string>,
) {
  for (const field of fields) {
    const key = path ? `${path}.${field.key}` : field.key;
    const value = answers[field.key];
    const required = forceRequired || field.rules.required === true;
    if (isGroup(field)) {
      collectErrors(
        field.fields ?? [],
        typeof value === "object" ? value : {},
        key,
        required,
        errors,
      );
      continue;
    }
    const message = leafError(field, value, required);
    if (message) errors[key] = message;
  }
}

function collectValues(
  fields: FarmTemplateField[],
  answers: Answers,
): Record<string, unknown> {
  return Object.fromEntries(
    fields.map((field) => {
      const value = answers[field.key];
      if (isGroup(field)) {
        return [
          field.key,
          collectValues(
            field.fields ?? [],
            typeof value === "object" ? value : {},
          ),
        ];
      }
      if (field.type === "checkbox" || field.type === "switch")
        return [field.key, value === true];
      if (typeof value !== "string" || !value.trim()) return [field.key, null];
      return [
        field.key,
        field.type === "number" ? Number(value.trim()) : value.trim(),
      ];
    }),
  );
}

function answersFromValues(
  fields: FarmTemplateField[],
  values: Record<string, unknown>,
): Answers {
  const answers: Answers = {};
  for (const field of entryFields(fields)) {
    const value = values[field.key];
    if (isGroup(field)) {
      const nested =
        typeof value === "object" && value !== null && !Array.isArray(value)
          ? (value as Record<string, unknown>)
          : {};
      answers[field.key] = answersFromValues(field.fields ?? [], nested);
    } else if (field.type === "checkbox" || field.type === "switch") {
      answers[field.key] = value === true;
    } else if (typeof value === "number" && Number.isFinite(value)) {
      answers[field.key] = String(value);
    } else if (typeof value === "string") {
      answers[field.key] = value;
    }
  }
  return answers;
}

function choiceOptions(field: FarmTemplateField): string[] {
  return (field.rules.options ?? [])
    .map((option) => option.trim())
    .filter(Boolean);
}

function FieldControl({
  field,
  value,
  errors,
  path,
  forceRequired = false,
  onChange,
}: {
  field: FarmTemplateField;
  value: Answer | undefined;
  errors: Record<string, string>;
  path: string;
  forceRequired?: boolean;
  onChange: (value: Answer) => void;
}) {
  const [showDate, setShowDate] = useState(false);
  const required = forceRequired || field.rules.required === true;
  const error = errors[path];
  const text = typeof value === "string" ? value : "";
  const options = choiceOptions(field);
  const label = `${field.label || "Field"}${required ? " *" : ""}`;
  if (isGroup(field)) {
    const nested = typeof value === "object" ? value : {};
    return (
      <View style={styles.group}>
        <Text style={styles.groupLabel}>{label}</Text>
        {field.helpText ? <Text style={styles.help}>{field.helpText}</Text> : null}
        {(field.fields ?? []).map((child) => (
          <FieldControl
            key={child.id}
            field={child}
            value={nested[child.key]}
            errors={errors}
            path={`${path}.${child.key}`}
            forceRequired={required}
            onChange={(next) => onChange({ ...nested, [child.key]: next })}
          />
        ))}
      </View>
    );
  }
  if (field.type === "checkbox" || field.type === "switch") {
    const checked = value === true;
    return (
      <View style={styles.field}>
        <View style={styles.switchRow}>
          <Text style={styles.label}>{label}</Text>
          {field.type === "switch" ? (
            <Switch
              value={checked}
              onValueChange={onChange}
              trackColor={{ true: colors.green, false: colors.border }}
            />
          ) : (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              onPress={() => onChange(!checked)}
            >
              <View style={[styles.check, checked && styles.checkSelected]}>
                {checked ? (
                  <Feather name="check" size={14} color="#FFFFFF" />
                ) : null}
              </View>
            </Pressable>
          )}
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!error && field.helpText ? (
          <Text style={styles.help}>{field.helpText}</Text>
        ) : null}
      </View>
    );
  }
  if (
    (field.type === "select" || field.type === "radio" || options.length > 0) &&
    options.length > 0
  ) {
    return (
      <View style={styles.field}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.options}>
          {options.map((option) => {
            const selected = text === option;
            return (
              <Pressable
                key={option}
                accessibilityRole={field.type === "radio" ? "radio" : "button"}
                accessibilityState={{ selected }}
                onPress={() => onChange(option)}
                style={[styles.option, selected && styles.optionSelected]}
              >
                <Text
                  style={[
                    styles.optionText,
                    selected && styles.optionTextSelected,
                  ]}
                >
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!error && field.helpText ? (
          <Text style={styles.help}>{field.helpText}</Text>
        ) : null}
      </View>
    );
  }
  if (field.type === "date") {
    const current = /^\d{4}-\d{2}-\d{2}$/.test(text)
      ? new Date(`${text}T00:00:00`)
      : new Date();
    const minimum =
      typeof field.rules.min === "string"
        ? new Date(`${field.rules.min}T00:00:00`)
        : undefined;
    const maximum =
      typeof field.rules.max === "string"
        ? new Date(`${field.rules.max}T00:00:00`)
        : undefined;
    return (
      <View style={styles.field}>
        <Text style={styles.label}>{label}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setShowDate(true)}
          style={styles.input}
        >
          <Text style={text ? styles.inputValue : styles.placeholder}>
            {text || "Choose a date"}
          </Text>
        </Pressable>
        {showDate ? (
          <DateTimePicker
            value={Number.isNaN(current.getTime()) ? new Date() : current}
            mode="date"
            minimumDate={
              minimum && !Number.isNaN(minimum.getTime()) ? minimum : undefined
            }
            maximumDate={
              maximum && !Number.isNaN(maximum.getTime()) ? maximum : undefined
            }
            onChange={(_event, date) => {
              if (Platform.OS !== "ios") setShowDate(false);
              if (date) {
                const month = String(date.getMonth() + 1).padStart(2, "0");
                const day = String(date.getDate()).padStart(2, "0");
                onChange(`${date.getFullYear()}-${month}-${day}`);
              }
            }}
          />
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!error && field.helpText ? (
          <Text style={styles.help}>{field.helpText}</Text>
        ) : null}
      </View>
    );
  }
  const fileField = field.type === "upload" || field.type === "image";
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {fileField ? (
        <Pressable
          accessibilityRole="button"
          onPress={async () => {
            if (field.type === "image") {
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.8,
              });
              if (!result.canceled)
                onChange(result.assets[0]?.fileName || "photo.jpg");
              return;
            }
            const result = await DocumentPicker.getDocumentAsync({
              copyToCacheDirectory: false,
            });
            if (!result.canceled) onChange(result.assets[0]?.name || "file");
          }}
          style={styles.fileButton}
        >
          <Text style={styles.fileButtonText}>
            {text
              ? "Change file"
              : field.type === "image"
                ? "Choose photo"
                : "Choose file"}
          </Text>
        </Pressable>
      ) : (
        <TextInput
          value={text}
          onChangeText={onChange}
          placeholderTextColor={colors.muted}
          keyboardType={field.type === "number" ? "decimal-pad" : "default"}
          multiline={field.type === "textarea"}
          maxLength={field.rules.maxLength}
          style={[styles.input, field.type === "textarea" && styles.textarea]}
        />
      )}
      {text && fileField ? <Text style={styles.help}>{text}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!error && !fileField && field.helpText ? (
        <Text style={styles.help}>{field.helpText}</Text>
      ) : null}
    </View>
  );
}

export function TemplateEntryForm({
  template,
  submitLabel,
  saving,
  initialValues,
  onSubmit,
}: {
  template: ActiveFarmTemplate;
  submitLabel: string;
  saving: boolean;
  initialValues?: Record<string, unknown>;
  onSubmit: (values: Record<string, unknown>) => Promise<void> | void;
}) {
  const [answers, setAnswers] = useState<Answers>(() =>
    answersFromValues(
      template.form.steps.flatMap((step) => step.fields),
      initialValues ?? {},
    ),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submit() {
    const fields = entryFields(
      template.form.steps.flatMap((step) => step.fields),
    );
    const nextErrors: Record<string, string> = {};
    collectErrors(fields, answers, "", false, nextErrors);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length || saving) return;
    void onSubmit(collectValues(fields, answers));
  }

  return (
    <>
      {template.form.steps.map((step) => {
        const fields = entryFields(step.fields);
        if (!fields.length) return null;
        return (
          <View key={step.id} style={styles.step}>
            <Text style={styles.stepTitle}>{step.title}</Text>
            {template.form.description ? (
              <Text style={styles.help}>{template.form.description}</Text>
            ) : null}
            {fields.map((field) => (
              <FieldControl
                key={field.id}
                field={field}
                value={answers[field.key]}
                errors={errors}
                path={field.key}
                onChange={(value) =>
                  setAnswers((current) => ({
                    ...current,
                    [field.key]: value,
                  }))
                }
              />
            ))}
          </View>
        );
      })}
      <Pressable
        accessibilityRole="button"
        disabled={saving}
        onPress={submit}
        style={[styles.action, saving && styles.pressed]}
      >
        {saving ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.actionText}>{submitLabel}</Text>
        )}
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  step: { gap: 14 },
  stepTitle: { color: colors.ink, fontSize: 18, fontWeight: "700" },
  field: { gap: 6 },
  group: {
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  groupLabel: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  label: { color: colors.ink, fontSize: 14, fontWeight: "600" },
  help: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 13 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    color: colors.ink,
    paddingHorizontal: 14,
    fontSize: 16,
    justifyContent: "center",
  },
  inputValue: { color: colors.ink, fontSize: 16 },
  placeholder: { color: colors.muted, fontSize: 16 },
  check: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  checkSelected: { backgroundColor: colors.green, borderColor: colors.green },
  textarea: { minHeight: 96, paddingTop: 12, textAlignVertical: "top" },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.surface,
  },
  optionSelected: { borderColor: colors.green, backgroundColor: "#E7F5EE" },
  optionText: { color: colors.ink, fontSize: 14 },
  optionTextSelected: { color: colors.green, fontWeight: "700" },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  fileButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.green,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  fileButtonText: { color: colors.green, fontWeight: "700" },
  action: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  pressed: { opacity: 0.7 },
});
