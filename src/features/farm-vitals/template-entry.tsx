import { farmBorder, farmCard, farmButton } from "./presentation";
import { useEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { VoiceMessageRecorder } from "../../components/voice/VoiceMessageRecorder";
import { enhanceFieldText } from "../../services/sharedServicesApi";
import {
  getActiveTemplate,
  uploadFarmImage,
  type ActiveFarmTemplate,
  type FarmTemplateField,
} from "../../services/farmVitalsApi";

import {
  breedNameField,
  breedSpeciesField,
  inlineBreedFields,
  listedBreed,
  readBreedOptions,
  type BreedOption,
} from "./breed-entry";

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

export function singleEntryHeading(
  template: ActiveFarmTemplate | null,
  title: string,
) {
  const fields = template?.form.steps.flatMap((step) =>
    entryFields(step.fields),
  );
  if (fields?.length !== 1) return;
  const [field] = fields;
  if (isGroup(field) || field.optionSource) return;
  const sameLabel =
    field.label.trim().toLowerCase() === title.trim().toLowerCase();
  return sameLabel && field.rules.required ? `${title} *` : title;
}

function isUtilGroup(field: FarmTemplateField): boolean {
  return Boolean(field.source) && isGroup(field);
}

function hasAnswer(value: Answer | undefined): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "boolean") return value;
  if (value && typeof value === "object")
    return Object.values(value).some((item) => hasAnswer(item));
  return false;
}

function isGroup(field: FarmTemplateField): boolean {
  return (
    field.type === "group" ||
    field.type === "contact" ||
    field.type === "location" ||
    Boolean(field.fields?.length)
  );
}

function isPakistanPhone(field: FarmTemplateField): boolean {
  return field.rules.pattern === "^\\+92-\\d{3}-\\d{3}-\\d{4}$";
}

function isPakistanNic(field: FarmTemplateField): boolean {
  return field.rules.pattern === "^\\d{5}-\\d{7}-\\d{1}$";
}

function formatPakistanNic(input: string, previous = ""): string {
  let digits = input.replace(/\D/g, "");
  const previousDigits = previous.replace(/\D/g, "");
  const deleting = input.length < previous.length;
  if (deleting && digits.length >= previousDigits.length && digits.length > 0)
    digits = digits.slice(0, -1);
  digits = digits.slice(0, 13);
  if (!digits) return "";
  let formatted = digits.slice(0, Math.min(5, digits.length));
  if (digits.length < 5) return formatted;
  formatted += "-";
  if (digits.length === 5) return formatted;
  formatted += digits.slice(5, Math.min(12, digits.length));
  if (digits.length < 12) return formatted;
  formatted += "-";
  if (digits.length === 12) return formatted;
  return `${formatted}${digits.slice(12, 13)}`;
}

function formatPakistanPhone(input: string, previous = ""): string {
  let digits = input.replace(/\D/g, "");
  let previousDigits = previous.replace(/\D/g, "");
  if (digits.startsWith("92")) digits = digits.slice(2);
  if (previousDigits.startsWith("92")) previousDigits = previousDigits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (previousDigits.startsWith("0")) previousDigits = previousDigits.slice(1);
  const deleting = input.length < previous.length;
  if (deleting && digits.length >= previousDigits.length && digits.length > 0)
    digits = digits.slice(0, -1);
  digits = digits.slice(0, 10);
  if (!digits) return "+92-";
  let formatted = `+92-${digits.slice(0, Math.min(3, digits.length))}`;
  if (digits.length < 3) return formatted;
  formatted += "-";
  if (digits.length === 3) return formatted;
  formatted += digits.slice(3, Math.min(6, digits.length));
  if (digits.length < 6) return formatted;
  formatted += "-";
  if (digits.length === 6) return formatted;
  return `${formatted}${digits.slice(6, 10)}`;
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
  if (
    typeof value === "string" &&
    value.trim() &&
    Number.isFinite(Number(value))
  )
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
    (options.length > 0 || field.searchable) &&
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

export function savedGroupValues(
  field: FarmTemplateField,
  draft: Answers,
): Record<string, unknown> {
  return collectValues(field.fields ?? [], draft);
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

function selectedSpecies(answers: Answers): string {
  for (const [key, value] of Object.entries(answers)) {
    if (typeof value === "string" && value.trim() && /type|species/i.test(key))
      return value.trim();
    if (isAnswerGroup(value)) {
      const nested = selectedSpecies(value);
      if (nested) return nested;
    }
  }
  return "";
}

function isAnswerGroup(value: Answer | undefined): value is Answers {
  return typeof value === "object" && value !== null;
}

function imageFileName(asset: ImagePicker.ImagePickerAsset): string {
  const mime = asset.mimeType?.toLowerCase() ?? "";
  const extension = mime.includes("png")
    ? "png"
    : mime.includes("webp")
      ? "webp"
      : mime.includes("gif")
        ? "gif"
        : mime.includes("heic") || mime.includes("heif")
          ? "heic"
          : "jpg";
  const base = (asset.fileName || "photo").replace(/\.[^.]+$/, "") || "photo";
  return `${base}.${extension}`;
}

function choiceOptions(field: FarmTemplateField): string[] {
  return (field.rules.options ?? [])
    .map((option) => option.trim())
    .filter(Boolean);
}

function layoutRows(
  fields: FarmTemplateField[],
  separateUtils = false,
): FarmTemplateField[][] {
  const columns = 2;
  const rows: FarmTemplateField[][] = [];
  let compact: FarmTemplateField[] = [];
  const flush = () => {
    while (compact.length) {
      rows.push(compact.slice(0, columns));
      compact = compact.slice(columns);
    }
  };
  for (const field of fields) {
    if (
      separateUtils &&
      compact[0] &&
      isUtilGroup(field) !== isUtilGroup(compact[0])
    )
      flush();
    if (field.fullWidth === true) {
      flush();
      rows.push([field]);
    } else compact.push(field);
  }
  flush();
  return rows;
}

function FieldRow({
  fields,
  children,
  fillSingle = false,
}: {
  fields: FarmTemplateField[];
  children: ReactNode;
  fillSingle?: boolean;
}) {
  return (
    <View style={styles.fieldRow}>
      {children}
      {!fillSingle && fields.length === 1 && fields[0].fullWidth !== true ? (
        <View style={styles.fieldSlot} />
      ) : null}
    </View>
  );
}

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size)
    rows.push(items.slice(index, index + size));
  return rows;
}

function choiceColumns(labels: string[]): number {
  const longest = labels.reduce((max, label) => Math.max(max, label.length), 0);
  if (labels.length <= 2) return Math.max(labels.length, 1);
  if (longest >= 9) return 2;
  if (longest >= 8) return 3;
  return Math.min(4, labels.length);
}

function ChoiceTabs({
  options,
  value,
  onChange,
  radio = false,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  radio?: boolean;
}) {
  const perRow = choiceColumns(options.map((option) => option.label));
  return (
    <View style={styles.optionRows}>
      {chunk(options, perRow).map((row, rowIndex) => (
        <View key={rowIndex} style={styles.optionRow}>
          {row.map((option) => {
            const selected = value === option.id;
            return (
              <Pressable
                key={option.id}
                accessibilityRole={radio ? "radio" : "tab"}
                accessibilityState={{ selected }}
                onPress={() => onChange(option.id)}
                style={[styles.option, selected && styles.optionSelected]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.optionText,
                    styles.optionLabel,
                    selected && styles.optionTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function FieldControl({
  field,
  value,
  errors,
  path,
  forceRequired = false,
  columns,
  farmId,
  species,
  embedded = false,
  outlinedLabels = true,
  hideLabel = false,
  onChange,
}: {
  field: FarmTemplateField;
  value: Answer | undefined;
  errors: Record<string, string>;
  path: string;
  forceRequired?: boolean;
  columns: number;
  farmId: string;
  species: string;
  embedded?: boolean;
  outlinedLabels?: boolean;
  hideLabel?: boolean;
  onChange: (value: Answer) => void;
}) {
  const [choiceSearch, setChoiceSearch] = useState("");
  const [focused, setFocused] = useState(false);
  const [showDate, setShowDate] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [enhancing, setEnhancing] = useState(false);
  const [enhanceError, setEnhanceError] = useState<string | null>(null);
  const [enhancementSuggestion, setEnhancementSuggestion] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const required = forceRequired || field.rules.required === true;
  const error = errors[path];
  const text = typeof value === "string" ? value : "";
  const options = choiceOptions(field);
  const label = `${field.label || "Field"}${required ? " *" : ""}`;
  const supportsTextAssist = field.type === "text" || field.type === "textarea";
  async function requestEnhancement() {
    if (!field.aiEnhance || !supportsTextAssist || !text.trim() || enhancing)
      return;
    setEnhancing(true);
    setEnhanceError(null);
    setEnhancementSuggestion("");
    try {
      setEnhancementSuggestion(await enhanceFieldText(text, field.label));
    } catch (cause) {
      setEnhanceError(
        cause instanceof Error
          ? cause.message
          : "The text could not be enhanced.",
      );
    } finally {
      setEnhancing(false);
    }
  }
  if (isGroup(field)) {
    const nested = typeof value === "object" ? value : {};
    const hint = field.helpText.replace(/\.+$/, "").trim();
    const stacked = label.length > 16 || hint.length > 20;
    return (
      <View style={embedded ? styles.embedded : styles.group}>
        <View style={stacked ? styles.groupHeadStack : styles.groupHead}>
          <Text style={embedded ? styles.embeddedLabel : styles.groupLabel}>
            {label}
          </Text>
          {hint ? (
            <Text style={stacked ? styles.help : styles.optional}>{hint}</Text>
          ) : null}
        </View>
        {layoutRows(field.fields ?? []).map((row) => (
          <FieldRow key={row.map((child) => child.id).join("-")} fields={row}>
            {row.map((child) => (
              <View key={child.id} style={styles.fieldSlot}>
                <FieldControl
                  field={child}
                  value={nested[child.key]}
                  errors={errors}
                  path={`${path}.${child.key}`}
                  forceRequired={required}
                  columns={columns}
                  farmId={farmId}
                  species={species}
                  outlinedLabels={outlinedLabels}
                  embedded={isGroup(child)}
                  onChange={(next) =>
                    onChange({ ...nested, [child.key]: next })
                  }
                />
              </View>
            ))}
          </FieldRow>
        ))}
      </View>
    );
  }
  if (field.type === "checkbox" || field.type === "switch") {
    const checked = value === true;
    return (
      <View style={styles.field}>
        <View style={styles.switchRow}>
          {!hideLabel && <Text style={styles.label}>{label}</Text>}
          {field.type === "switch" ? (
            <Switch
              accessibilityLabel={label}
              value={checked}
              onValueChange={onChange}
              trackColor={{ true: colors.green, false: colors.border }}
            />
          ) : (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel={label}
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
  if (field.searchable) {
    const query = choiceSearch.trim().toLowerCase();
    const choices = options.filter((option) =>
      option.toLowerCase().includes(query),
    );
    return (
      <View style={styles.field}>
        {!hideLabel && <Text style={styles.label}>{label}</Text>}
        {options.length ? (
          <>
            <TextInput
              accessibilityLabel={`Search ${field.label.toLowerCase()}`}
              placeholder={`Search ${field.label.toLowerCase()}`}
              value={choiceSearch}
              onChangeText={setChoiceSearch}
              style={styles.input}
            />
            {choices.length ? (
              <ChoiceTabs
                radio
                value={text}
                onChange={onChange}
                options={choices.map((option) => ({
                  id: option,
                  label: option,
                }))}
              />
            ) : (
              <Text style={styles.help}>No matching options.</Text>
            )}
          </>
        ) : null}
        {error || field.helpText ? (
          <Text style={error ? styles.error : styles.help}>
            {error || field.helpText}
          </Text>
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
        {!hideLabel && <Text style={styles.label}>{label}</Text>}
        <ChoiceTabs
          radio={field.type === "radio"}
          value={text}
          onChange={onChange}
          options={options.map((option) => ({ id: option, label: option }))}
        />
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
      <View
        style={[
          styles.field,
          !hideLabel && outlinedLabels && styles.outlinedField,
        ]}
      >
        {!hideLabel && (
          <Text
            numberOfLines={outlinedLabels ? 1 : undefined}
            style={[styles.label, outlinedLabels && styles.outlinedLabel]}
          >
            {label}
          </Text>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
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
  async function pickImage() {
    setUploadError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        ...(field.promptKey || field.generateThumbnail
          ? {
              preferredAssetRepresentationMode:
                ImagePicker.UIImagePickerPreferredAssetRepresentationMode
                  .Compatible,
            }
          : {}),
      });
      if (result.canceled || !result.assets[0]?.uri) return;
      if (!farmId) {
        setUploadError("Open a farm before adding a photo.");
        return;
      }
      setUploading(true);
      onChange(
        await uploadFarmImage(
          result.assets[0].uri,
          imageFileName(result.assets[0]),
          farmId,
          species || "unknown",
          field.promptKey ?? "",
          field.generateThumbnail,
        ),
      );
    } catch (cause) {
      setUploadError(
        cause instanceof Error
          ? cause.message
          : "The image could not be uploaded.",
      );
    } finally {
      setUploading(false);
    }
  }

  const fileField = field.type === "upload" || field.type === "image";
  const phone = isPakistanPhone(field);
  const nic = isPakistanNic(field);
  return (
    <View
      style={[
        styles.field,
        !hideLabel && outlinedLabels && !fileField && styles.outlinedField,
      ]}
    >
      {!hideLabel && !fileField && (
        <Text
          numberOfLines={outlinedLabels && !fileField ? 1 : undefined}
          style={[
            styles.label,
            outlinedLabels && !fileField && styles.outlinedLabel,
            outlinedLabels && focused && styles.outlinedLabelFocused,
          ]}
        >
          {label}
        </Text>
      )}
      {fileField ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          disabled={uploading}
          onPress={() => void pickImage()}
          style={styles.fileButton}
        >
          {uploading ? (
            <ActivityIndicator color={colors.green} />
          ) : (
            <Text style={styles.fileButtonText}>
              {text ? "Change photo" : "Choose photo"}
            </Text>
          )}
        </Pressable>
      ) : (
        <TextInput
          accessibilityLabel={label}
          value={text}
          onChangeText={(next) =>
            onChange(
              phone
                ? formatPakistanPhone(next, text)
                : nic
                  ? formatPakistanNic(next, text)
                  : next,
            )
          }
          onFocus={() => {
            setFocused(true);
            if (phone && !text) onChange("+92-");
          }}
          onBlur={() => {
            setFocused(false);
            if (phone && (text === "+92-" || text === "+92")) onChange("");
          }}
          placeholder={
            phone ? "+92-300-000-0000" : nic ? "00000-0000000-0" : undefined
          }
          placeholderTextColor={colors.muted}
          keyboardType={
            phone
              ? "phone-pad"
              : nic
                ? "number-pad"
                : field.type === "number"
                  ? "decimal-pad"
                  : "default"
          }
          multiline={field.type === "textarea"}
          maxLength={phone ? 16 : nic ? 15 : field.rules.maxLength}
          style={[
            styles.input,
            field.type === "textarea" && styles.textarea,
            outlinedLabels && focused && styles.outlinedInputFocused,
          ]}
        />
      )}
      {supportsTextAssist && (field.aiEnhance || field.voiceInput) ? (
        <View style={styles.fieldAssistRow}>
          {field.aiEnhance ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Enhance ${field.label} with AI`}
              disabled={enhancing || !text.trim()}
              onPress={() => void requestEnhancement()}
              style={[
                styles.fieldAssistButton,
                (enhancing || !text.trim()) && styles.fieldAssistDisabled,
              ]}
            >
              {enhancing ? (
                <ActivityIndicator size="small" color={colors.green} />
              ) : (
                <Feather name="zap" size={15} color={colors.green} />
              )}
              <Text style={styles.fieldAssistText}>
                {enhancing ? "Enhancing…" : "AI Enhance"}
              </Text>
            </Pressable>
          ) : null}
          {field.voiceInput ? (
            <View style={styles.voiceInputButton}>
              <VoiceMessageRecorder
                buttonSize={34}
                buttonColor={colors.green}
                onTranscriptReady={(transcript) => {
                  onChange(transcript);
                  setEnhancementSuggestion("");
                  setVoiceError(null);
                }}
                onError={(cause) => setVoiceError(cause.message)}
              />
            </View>
          ) : null}
        </View>
      ) : null}
      {enhancementSuggestion ? (
        <View style={styles.enhancementCard}>
          <Text style={styles.enhancementTitle}>Review AI suggestion</Text>
          <Text style={styles.enhancementText}>{enhancementSuggestion}</Text>
          <View style={styles.enhancementActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setEnhancementSuggestion("")}
              style={styles.enhancementKeep}
            >
              <Text style={styles.enhancementKeepText}>Keep current</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                onChange(enhancementSuggestion);
                setEnhancementSuggestion("");
              }}
              style={styles.enhancementApply}
            >
              <Text style={styles.enhancementApplyText}>Use suggestion</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {field.voiceInput && supportsTextAssist ? (
        <Text style={styles.help}>
          Transcribed text appears in the field. Review and edit it before
          saving.
        </Text>
      ) : null}
      {enhanceError ? <Text style={styles.error}>{enhanceError}</Text> : null}
      {voiceError ? <Text style={styles.error}>{voiceError}</Text> : null}
      {text && fileField ? (
        <Text style={styles.help}>
          {text.startsWith("http") ? "Photo uploaded" : text}
        </Text>
      ) : null}
      {uploadError ? <Text style={styles.error}>{uploadError}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!error && !fileField && field.helpText ? (
        <Text style={styles.help}>{field.helpText}</Text>
      ) : null}
    </View>
  );
}

export function UtilSheet({
  field,
  value,
  columns,
  farmId,
  species,
  saving = false,
  saveError = null,
  onClose,
  onSave,
}: {
  field: FarmTemplateField;
  value: Answer | undefined;
  columns: number;
  farmId: string;
  species: string;
  saving?: boolean;
  saveError?: string | null;
  onClose: () => void;
  onSave: (value: Answers) => void;
}) {
  const [draft, setDraft] = useState<Answers>(
    typeof value === "object" ? value : {},
  );
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const { height } = useWindowDimensions();
  function save() {
    if (saving) return;
    const nextErrors: Record<string, string> = {};
    collectErrors(
      field.fields ?? [],
      draft,
      field.key,
      field.rules.required === true,
      nextErrors,
    );
    setLocalErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    onSave(draft);
  }
  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.modalRoot}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          style={styles.backdrop}
        />
        <SafeAreaView edges={["bottom"]} style={styles.modalCard}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHead}>
            <Text accessibilityRole="header" style={styles.modalTitle}>
              {field.label}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              style={styles.modalClose}
            >
              <Feather name="x" size={18} color={colors.ink} />
            </Pressable>
          </View>
          <ScrollView
            style={{ maxHeight: height * 0.62 }}
            contentContainerStyle={styles.sheetBody}
            keyboardShouldPersistTaps="handled"
          >
            {layoutRows(field.fields ?? []).map((row) => (
              <FieldRow
                key={row.map((child) => child.id).join("-")}
                fields={row}
              >
                {row.map((child) => (
                  <View key={child.id} style={styles.fieldSlot}>
                    <FieldControl
                      field={child}
                      value={draft[child.key]}
                      errors={localErrors}
                      path={`${field.key}.${child.key}`}
                      forceRequired={field.rules.required === true}
                      columns={columns}
                      farmId={farmId}
                      species={species}
                      embedded={isGroup(child)}
                      onChange={(next) =>
                        setDraft((current) => ({
                          ...current,
                          [child.key]: next,
                        }))
                      }
                    />
                  </View>
                ))}
              </FieldRow>
            ))}
          </ScrollView>
          {saveError ? <Text style={styles.error}>{saveError}</Text> : null}
          <View style={styles.modalActions}>
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={onClose}
              style={styles.modalCancel}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={save}
              style={styles.modalSave}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.actionText}>Save</Text>
              )}
            </Pressable>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function fullWidthFields(
  fields: FarmTemplateField[],
): FarmTemplateField[] {
  return fields.map((field) => ({
    ...field,
    fullWidth: true,
    ...(field.fields ? { fields: fullWidthFields(field.fields) } : {}),
  }));
}

export function TemplateEntryForm({
  template,
  submitLabel,
  saving,
  initialValues,
  inlineGroups = false,
  outlinedLabels = true,
  showDescription = true,
  compactTitle,
  showStepTitle = true,
  farmId = "",
  onSubmit,
  renderField,
  onDraftChange,
}: {
  template: ActiveFarmTemplate;
  submitLabel: string;
  saving: boolean;
  initialValues?: Record<string, unknown>;
  inlineGroups?: boolean;
  outlinedLabels?: boolean;
  showDescription?: boolean;
  compactTitle?: string;
  showStepTitle?: boolean;
  farmId?: string;
  onDraftChange?: (answers: Record<string, unknown>) => void;
  renderField?: (field: FarmTemplateField) => ReactNode;
  onSubmit: (values: Record<string, unknown>) => Promise<void> | void;
}) {
  const { width } = useWindowDimensions();
  const fieldColumns = width >= 840 ? 4 : width >= 560 ? 3 : 2;
  const fields = template.form.steps.flatMap((step) =>
    entryFields(step.fields),
  );
  const breed = inlineBreedFields(fields);
  const needsCatalog = Boolean(breed);
  const [breedOptions, setBreedOptions] = useState<BreedOption[] | null>(null);
  const [breedError, setBreedError] = useState(false);
  const [breedAttempt, setBreedAttempt] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>(() => {
    const initial = answersFromValues(fields, initialValues ?? {});
    if (breed) {
      for (const key of [breed.speciesKey, breed.nameKey]) {
        const value = initialValues?.[key];
        if (typeof value === "string") initial[key] = value;
      }
    }
    return initial;
  });
  useEffect(() => {
    if (!needsCatalog) return;
    let mounted = true;
    getActiveTemplate("breed")
      .then(readBreedOptions)
      .then((options) => {
        if (mounted) setBreedOptions(options);
      })
      .catch(() => {
        if (mounted) setBreedError(true);
      });
    return () => {
      mounted = false;
    };
  }, [needsCatalog, breedAttempt]);

  const category = breed ? answers[breed.category.key] : undefined;
  const listed = listedBreed(category);
  const species = breed ? answers[breed.speciesKey] : undefined;
  const detail =
    breed && typeof category === "string"
      ? breedNameField(
          breed.nameKey,
          breedOptions ?? [],
          typeof species === "string" ? species : "",
          category,
        )
      : undefined;
  const steps = template.form.steps
    .map((step) => ({
      ...step,
      fields: entryFields(step.fields).flatMap((field) =>
        breed && field.id === breed.category.id
          ? [
              field,
              ...(listed && !breed.hasSpecies && breedOptions
                ? [breedSpeciesField(breed.speciesKey, breedOptions)]
                : []),
              ...(detail && (!listed || breedOptions) ? [detail] : []),
            ]
          : [field],
      ).filter((field) => {
        const isLactation = `${field.key} ${field.label}`
          .toLowerCase()
          .includes("lactation");
        if (template.type !== "animal" || !isLactation) return true;
        const gender = Object.entries(answers).find(([key]) =>
          ["gender", "sex"].includes(key.toLowerCase()),
        )?.[1];
        return typeof gender === "string" && gender.trim().toLowerCase() === "female";
      }),
    }))
    .filter((step) => step.fields.length > 0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [openUtil, setOpenUtil] = useState<string | null>(null);
  const separateUtils =
    !inlineGroups && steps.some((step) => step.fields.some(isUtilGroup));
  const activeIndex = Math.min(stepIndex, Math.max(steps.length - 1, 0));
  const activeStep = steps[activeIndex];
  const openField =
    steps
      .flatMap((step) => step.fields)
      .find((field) => field.key === openUtil) ?? null;

  function changeAnswer(key: string, value: Answer) {
    const next = { ...answers, [key]: value };
    if (
      template.type === "animal" &&
      ["gender", "sex"].includes(key.toLowerCase()) &&
      (typeof value !== "string" || value.trim().toLowerCase() !== "female")
    ) {
      for (const field of fields) {
        if (`${field.key} ${field.label}`.toLowerCase().includes("lactation"))
          delete next[field.key];
      }
    }
    const inlineName =
      breed && (key === breed.category.key || key === breed.speciesKey)
        ? breed.nameKey
        : undefined;
    const detailKey =
      inlineName ??
      (template.type === "breed" &&
      onDraftChange &&
      (key === "breed" || key === "animalType")
        ? "breedName"
        : undefined);
    if (detailKey && answers[key] !== value) {
      delete next[detailKey];
      setErrors((current) => {
        const remaining = { ...current };
        delete remaining[detailKey];
        return remaining;
      });
    }
    setAnswers(next);
    onDraftChange?.(next);
  }

  function submit() {
    if (listed && !breedOptions) return;
    const fields = steps.flatMap((step) => step.fields);
    const nextErrors: Record<string, string> = {};
    collectErrors(fields, answers, "", false, nextErrors);
    if (template.type === "farm") {
      const normalized = (field: FarmTemplateField) =>
        `${field.key}${field.label}`.toLowerCase().replace(/[^a-z]/g, "");
      const findCount = (names: string[]) => {
        const field = fields.find((candidate) => names.some((name) => normalized(candidate).includes(name)));
        if (!field) return undefined;
        const value = answers[field.key];
        return typeof value === "string" && value.trim() ? Number(value) : undefined;
      };
      const totalField = fields.find((field) => normalized(field).includes("totalanimal"));
      const total = findCount(["totalanimal"]);
      const counts = ["milkinganimal", "dryanimal", "younganimal", "pregnantanimal"]
        .map((name) => findCount([name]))
        .filter((value): value is number => value !== undefined && Number.isFinite(value));
      if (totalField && total !== undefined && Number.isFinite(total)) {
        const categoryFields = fields.filter((field) =>
          ["milkinganimal", "dryanimal", "younganimal", "pregnantanimal"].some((name) => normalized(field).includes(name)),
        );
        for (const field of categoryFields) {
          const value = answers[field.key];
          if (typeof value === "string" && value.trim() && Number(value) > total) {
            nextErrors[field.key] = `Cannot exceed Total Animal (${total}).`;
          }
        }
        if (counts.length && counts.reduce((sum, value) => sum + value, 0) > total) {
          nextErrors[totalField.key] = "The animal category counts cannot add up to more than Total Animal.";
        }
      }
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      const found = steps.findIndex((step) =>
        step.fields.some((field) =>
          Object.keys(nextErrors).some(
            (key) => key === field.key || key.startsWith(`${field.key}.`),
          ),
        ),
      );
      if (found >= 0) setStepIndex(found);
      return;
    }
    if (saving) return;
    const values = collectValues(fields, answers);
    if (breed && !detail) values[breed.nameKey] = null;
    if (breed && !breed.hasSpecies && !listed) values[breed.speciesKey] = null;
    void onSubmit(values);
  }

  return (
    <View style={styles.form}>
      {!compactTitle && showDescription && template.form.description ? (
        <Text style={styles.help}>{template.form.description}</Text>
      ) : null}
      {steps.length > 1 ? (
        <ChoiceTabs
          value={activeStep?.id ?? ""}
          onChange={(id) => {
            const next = steps.findIndex((step) => step.id === id);
            if (next >= 0) setStepIndex(next);
          }}
          options={steps.map((step) => ({ id: step.id, label: step.title }))}
        />
      ) : null}
      {activeStep ? (
        <View style={styles.step}>
          {showStepTitle && !compactTitle && steps.length === 1 && activeStep.title ? (
            <Text style={styles.stepTitle}>{activeStep.title}</Text>
          ) : null}
          {layoutRows(activeStep.fields, separateUtils).map((row) => (
            <FieldRow
              key={row.map((field) => field.id).join("-")}
              fields={row}
              fillSingle={separateUtils && isUtilGroup(row[0])}
            >
              {row.map((field) => {
                if (separateUtils && isUtilGroup(field)) {
                  const saved = hasAnswer(answers[field.key]);
                  return (
                    <View key={field.id} style={styles.fieldSlot}>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => setOpenUtil(field.key)}
                        style={styles.utilButton}
                      >
                        <Feather
                          name={saved ? "check" : "plus"}
                          size={16}
                          color={colors.green}
                        />
                        <Text style={styles.utilText}>
                          {saved ? field.label : `Add ${field.label}`}
                        </Text>
                        {saved ? (
                          <Text style={styles.optional}>Edit</Text>
                        ) : null}
                      </Pressable>
                    </View>
                  );
                }
                const onChange = (value: Answer) =>
                  changeAnswer(field.key, value);
                return (
                  <View
                    key={
                      field.searchable
                        ? `${field.id}-${breed ? species : answers.animalType}-${breed ? category : answers.breed}`
                        : field.id
                    }
                    style={styles.fieldSlot}
                  >
                    {renderField?.(field) ?? (
                      <FieldControl
                        field={field}
                        value={answers[field.key]}
                        errors={errors}
                        path={field.key}
                        columns={fieldColumns}
                        farmId={farmId}
                        species={selectedSpecies(answers)}
                        outlinedLabels={outlinedLabels}
                        hideLabel={Boolean(
                          compactTitle &&
                          field.label.trim().toLowerCase() ===
                            compactTitle.trim().toLowerCase(),
                        )}
                        onChange={onChange}
                      />
                    )}
                  </View>
                );
              })}
            </FieldRow>
          ))}
        </View>
      ) : null}
      {listed && !breedOptions ? (
        breedError ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setBreedError(false);
              setBreedAttempt((current) => current + 1);
            }}
          >
            <Text style={styles.error}>
              Breed options could not be loaded. Tap to retry.
            </Text>
          </Pressable>
        ) : (
          <Text style={styles.help}>Loading breed options…</Text>
        )
      ) : null}
      <Pressable
        accessibilityRole="button"
        disabled={saving || (listed && !breedOptions)}
        onPress={submit}
        style={[styles.action, saving && styles.pressed]}
      >
        {saving ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.actionText}>{submitLabel}</Text>
        )}
      </Pressable>
      {openField ? (
        <UtilSheet
          field={openField}
          value={answers[openField.key]}
          columns={fieldColumns}
          farmId={farmId}
          species={selectedSpecies(answers)}
          onClose={() => setOpenUtil(null)}
          onSave={(value) => {
            changeAnswer(openField.key, value);
            setErrors((current) =>
              Object.fromEntries(
                Object.entries(current).filter(
                  ([key]) =>
                    key !== openField.key &&
                    !key.startsWith(`${openField.key}.`),
                ),
              ),
            );
            setOpenUtil(null);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 12, width: "100%" },
  utilButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.surface,
    ...farmButton,
  },
  utilText: { flex: 1, color: colors.ink, fontSize: 15, fontWeight: "700" },
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  backdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(23, 61, 50, 0.45)",
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 8,
  },
  modalHandle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D5DED6",
    marginBottom: 4,
  },
  modalHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  modalTitle: { flex: 1, color: colors.ink, fontSize: 20, fontWeight: "800" },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F6F2",
  },
  modalActions: { flexDirection: "row", gap: 8, paddingTop: 4 },
  modalCancel: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F6F2",
    ...farmButton,
  },
  modalCancelText: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  modalSave: {
    flex: 1.4,
    minHeight: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.green,
    ...farmButton,
  },
  sheetBody: { gap: 12, paddingTop: 8, paddingBottom: 8 },
  step: { gap: 16, width: "100%" },
  stepTitle: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  fieldRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    width: "100%",
  },
  fieldSlot: { flex: 1, minWidth: 0 },
  field: { gap: 6, width: "100%" },
  outlinedField: { paddingTop: 8 },
  outlinedLabel: {
    position: "absolute",
    top: 0,
    left: 12,
    zIndex: 1,
    maxWidth: "90%",
    paddingHorizontal: 5,
    backgroundColor: colors.surface,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
    color: colors.muted,
  },
  outlinedLabelFocused: { color: "#3E7EAA" },
  outlinedInputFocused: { borderColor: "#3E7EAA", borderWidth: 2 },
  group: {
    gap: 12,
    padding: 14,
    ...farmCard,
  },
  embedded: { gap: 8, width: "100%" },
  groupHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  groupHeadStack: { gap: 4, width: "100%" },
  groupLabel: {
    flexShrink: 1,
    color: colors.ink,
    fontSize: 15,
    fontWeight: "700",
  },
  embeddedLabel: {
    flexShrink: 1,
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
  },
  optional: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  label: { color: colors.ink, fontSize: 14, fontWeight: "600" },
  help: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 13 },
  fieldAssistRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
    minHeight: 38,
  },
  fieldAssistButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 34,
    borderRadius: 10,
    backgroundColor: "#E8F4ED",
    paddingHorizontal: 10,
  },
  fieldAssistDisabled: { opacity: 0.5 },
  fieldAssistText: { color: colors.green, fontSize: 12, fontWeight: "700" },
  voiceInputButton: {
    minWidth: 38,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  enhancementCard: {
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#B8D8C8",
    backgroundColor: "#F1F8F4",
    padding: 12,
  },
  enhancementTitle: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  enhancementText: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  enhancementActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 2,
  },
  enhancementKeep: { paddingHorizontal: 10, paddingVertical: 8 },
  enhancementKeepText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  enhancementApply: {
    borderRadius: 9,
    backgroundColor: colors.green,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  enhancementApplyText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  input: {
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: farmBorder,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
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
  optionRows: { gap: 8, width: "100%" },
  optionRow: { flexDirection: "row", gap: 8, width: "100%" },
  option: {
    flex: 1,
    minWidth: 0,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
  },
  optionSelected: { borderColor: colors.green, backgroundColor: "#E7F5EE" },
  optionLabel: { textAlign: "center" },
  optionText: { color: colors.ink, fontSize: 15, fontWeight: "600" },
  optionTextSelected: { color: colors.green, fontWeight: "700" },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  fileButton: {
    alignSelf: "stretch",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    ...farmButton,
    backgroundColor: colors.surface,
  },
  fileButtonText: { color: colors.green, fontWeight: "700" },
  action: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
    ...farmButton,
  },
  actionText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  pressed: { opacity: 0.7 },
});
