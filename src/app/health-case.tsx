import { CaseFlowHeader } from "../features/farm-vitals/case-flow-header";
import { OutlinedField } from "../features/farm-vitals/outlined-field";
import { farmCard, farmButton } from "../features/farm-vitals/presentation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentRef,
} from "react";
import {
  ActivityIndicator,
  AppState,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  useAudioRecorder,
} from "expo-audio";
import Feather from "@expo/vector-icons/Feather";
import {
  getActiveTemplate,
  getFarmReview,
  getHealthCase,
  healthCaseAnswers,
  healthCaseValues,
  updateHealthCaseAnswers,
  type ActiveFarmTemplate,
  saveHealthCase,
  uploadHealthCaseMedia,
  type FarmAnimalReview,
  type FarmTemplateField,
  type HealthCase,
  type HealthCaseFile,
} from "../services/farmVitalsApi";

import { TemplateEntryForm } from "../features/farm-vitals/template-entry";

const colors = {
  background: "#F8F8F2",
  ink: "#173D32",
  muted: "#63766C",
  green: "#1E7F5C",
  border: "#E4EBE3",
  surface: "#FFFFFF",
  danger: "#B42318",
  mint: "#E7F5EE",
};

type Target = "conditionPhotos" | "evidence" | "media";

function attachmentTarget(field: FarmTemplateField): Target | undefined {
  if (field.key === "condition_photos" && field.type === "image")
    return "conditionPhotos";
  if (field.key === "evidence" && field.type === "upload") return "evidence";
}

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function when(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const extensionForKind: Record<HealthCaseFile["kind"], string> = {
  photo: "jpg",
  video: "mp4",
  audio: "m4a",
  file: "pdf",
};

function kindFor(
  name: string,
  fallback: HealthCaseFile["kind"],
): HealthCaseFile["kind"] {
  const lower = name.toLowerCase();
  if (lower.endsWith(".mp4") || lower.endsWith(".mov")) return "video";
  if (
    lower.endsWith(".m4a") ||
    lower.endsWith(".mp3") ||
    lower.endsWith(".wav")
  )
    return "audio";
  if (lower.endsWith(".pdf")) return "file";
  if (/\.(jpg|jpeg|png|webp|heic|gif)$/.test(lower)) return "photo";
  return fallback;
}

function blankCase(animalEntryId: string, animalName: string): HealthCase {
  return {
    entryId: `case-${Date.now()}`,
    animalEntryId,
    animalName,
    status: "draft",
    openedAt: new Date().toISOString(),
    complaint: "",
    symptoms: [],
    onset: "",
    duration: "",
    conditionPhotos: [],
    evidence: [],
    treatmentGiven: "",
    medicine: "",
    notes: "",
    followUp: "",
    media: [],
    updates: [],
  };
}

function refreshFieldWidths(
  fields: FarmTemplateField[],
  latest: FarmTemplateField[],
): FarmTemplateField[] {
  return fields.map((field) => {
    const saved = latest.find((item) => item.key === field.key);
    if (!saved) return field;
    return {
      ...field,
      fullWidth: saved.fullWidth === true,
      ...(field.fields && saved.fields
        ? { fields: refreshFieldWidths(field.fields, saved.fields) }
        : {}),
    };
  });
}

export default function HealthCaseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    farmId?: string;
    animalEntryId?: string;
    entryId?: string;
  }>();
  const farmId = param(params.farmId);
  const animalEntryId = param(params.animalEntryId);
  const entryId = param(params.entryId);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [health, setHealth] = useState<HealthCase>(() =>
    blankCase(animalEntryId, ""),
  );
  const [animals, setAnimals] = useState<FarmAnimalReview[]>([]);
  const [farmName, setFarmName] = useState("Farm");
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Target | null>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const saving = useRef(false);
  const drafts = useRef<Record<number, Record<string, unknown>>>({});
  const [template, setTemplate] = useState<ActiveFarmTemplate | null>(null);

  const needsAnimal = !animalEntryId && !entryId;
  const firstFormStep = needsAnimal ? 1 : 0;
  const activeStep = template?.form.steps[step - firstFormStep];
  const steps = [
    ...(needsAnimal ? ["Animal"] : []),
    ...(template?.form.steps.map((item) => item.title) ?? []),
    "Case Review",
  ];
  const choosingAnimal = needsAnimal && step === 0;
  const reviewing = template !== null && step === steps.length - 1;

  const layoutStepId = activeStep?.id;
  const layoutType = activeStep ? "health-case" : null;
  useEffect(() => {
    if (loading || !layoutStepId || !layoutType) return;
    const type = layoutType;
    let active = true;
    let request = 0;
    async function refreshLayout() {
      const sequence = ++request;
      try {
        const latest = await getActiveTemplate(type);
        if (!active || sequence !== request) return;
        const latestFields = latest.form.steps.flatMap((item) => item.fields);
        const applyWidths = (form: ActiveFarmTemplate["form"]) => ({
          ...form,
          steps: form.steps.map((item) =>
            item.id === layoutStepId
              ? {
                  ...item,
                  fields: refreshFieldWidths(item.fields, latestFields),
                }
              : item,
          ),
        });
        setTemplate((current) =>
          current ? { ...current, form: applyWidths(current.form) } : current,
        );
        setHealth((current) =>
          current.caseTemplate
            ? {
                ...current,
                caseTemplate: {
                  ...current.caseTemplate,
                  form: applyWidths(current.caseTemplate.form),
                },
              }
            : current,
        );
      } catch {
        // Keep the loaded layout and draft available when offline.
      }
    }
    void refreshLayout();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshLayout();
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, [loading, layoutStepId, layoutType]);

  const load = useCallback(async () => {
    if (!farmId) {
      setLoading(false);
      setError("Open a farm before adding a case.");
      return;
    }
    setLoading(true);
    setTemplate(null);
    drafts.current = {};
    setError(null);
    try {
      const saved = entryId ? await getHealthCase(farmId, entryId) : null;
      if (saved?.status === "saved") {
        router.replace({
          pathname: "/health-case-detail",
          params: { farmId, entryId: saved.entryId },
        });
        return;
      }
      const [review, active] = await Promise.all([
        getFarmReview(farmId),
        getActiveTemplate("health-case"),
      ]);
      const animal = review.animals.find(
        (item) => item.entryId === animalEntryId,
      );
      setFarmName(review.name);
      setAnimals(review.animals);
      setHealth({
        ...(saved ??
          blankCase(
            animalEntryId,
            animalEntryId ? (animal?.name ?? "Animal") : "",
          )),
        caseTemplate: { form: active.form, updatedAt: active.updatedAt },
        caseValues: saved?.caseValues ?? {},
      });
      setTemplate(active);
      const sameSteps =
        JSON.stringify(saved?.caseTemplate?.form.steps) ===
        JSON.stringify(active.form.steps);
      setStep(
        saved?.status === "draft" && sameSteps
          ? Math.max(
              0,
              Math.min(saved.draftStep ?? 0, active.form.steps.length),
            )
          : 0,
      );
      scroll.current?.scrollTo({ y: 0, animated: false });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The case could not be opened.",
      );
    } finally {
      setLoading(false);
    }
  }, [animalEntryId, entryId, farmId, router]);

  useEffect(() => {
    void load();
  }, [load]);

  function update(patch: Partial<HealthCase>) {
    setHealth((current) => ({ ...current, ...patch }));
  }

  async function storeFile(
    uri: string,
    name: string,
    kind: HealthCaseFile["kind"],
    target: Target,
  ) {
    setBusy("Uploading…");
    setError(null);
    try {
      const url = await uploadHealthCaseMedia(
        uri,
        name,
        farmId,
        extensionForKind[kind],
      );
      const file = { url, name: name || kind, kind: kindFor(name, kind) };
      setHealth((current) => ({
        ...current,
        [target]: [...current[target], file],
      }));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The file could not be uploaded.",
      );
    } finally {
      setBusy("");
    }
  }

  async function pickImages(target: Target, camera: boolean) {
    setSheet(null);
    const permission = camera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(
        camera
          ? "Allow camera access to add a photo."
          : "Allow photo access to add a photo.",
      );
      return;
    }
    const result = camera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          quality: 0.8,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsMultipleSelection: true,
          quality: 0.8,
          selectionLimit: 6,
        });
    if (result.canceled) return;
    for (const asset of result.assets) {
      if (!asset.uri) continue;
      await storeFile(
        asset.uri,
        asset.fileName ?? "photo.jpg",
        "photo",
        target,
      );
    }
  }

  async function pickVideo() {
    setSheet(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Allow photo access to add a video.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]?.uri) return;
    const asset = result.assets[0];
    await storeFile(asset.uri, asset.fileName ?? "video.mp4", "video", "media");
  }

  async function pickFile() {
    setSheet(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*"],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]?.uri) return;
    const asset = result.assets[0];
    await storeFile(
      asset.uri,
      asset.name,
      kindFor(asset.name, "file"),
      "evidence",
    );
  }

  async function toggleRecording() {
    setError(null);
    try {
      if (recording) {
        await recorder.stop();
        setRecording(false);
        if (recorder.uri)
          await storeFile(
            recorder.uri,
            `note-${Date.now()}.m4a`,
            "audio",
            "media",
          );
        return;
      }
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setError("Allow microphone access to record a note.");
        return;
      }
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
    } catch (cause) {
      setRecording(false);
      setError(
        cause instanceof Error
          ? cause.message
          : "The recording could not be saved.",
      );
    }
  }

  function removeFile(target: Target, url: string) {
    setHealth((current) => ({
      ...current,
      [target]: current[target].filter((item) => item.url !== url),
    }));
  }

  function goToStep(nextStep: number) {
    setError(null);
    setStep(nextStep);
    scroll.current?.scrollTo({ y: 0, animated: false });
  }

  async function writeCase(next: HealthCase): Promise<boolean> {
    if (saving.current || busy) return false;
    saving.current = true;
    setBusy(next.status === "saved" ? "Saving case…" : "Saving draft…");
    setError(null);
    try {
      await saveHealthCase(farmId, next);
      setHealth(next);
      return true;
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "The case could not be saved.",
      );
      return false;
    } finally {
      saving.current = false;
      setBusy("");
    }
  }

  async function continueStep(values?: Record<string, unknown>) {
    if (saving.current || busy) return;
    if (!health.animalEntryId) {
      setError("Choose an animal.");
      return;
    }
    const attachments = activeStep?.fields ?? [];
    const missing = attachments.find((field) => {
      const target = attachmentTarget(field);
      return target && field.rules.required && !health[target].length;
    });
    if (missing) {
      setError(`${missing.label} is required.`);
      return;
    }
    const nextStep = Math.min(step + 1, steps.length - 1);
    const submitted = { ...values };
    for (const field of attachments) {
      if (attachmentTarget(field)) delete submitted[field.key];
    }
    const next = {
      ...updateHealthCaseAnswers(health, submitted),
      draftStep: nextStep - firstFormStep,
    };
    if (next.status === "draft") {
      if (!(await writeCase(next))) return;
    } else {
      setHealth(next);
    }
    delete drafts.current[step];
    goToStep(nextStep);
  }

  async function persist(status: HealthCase["status"]) {
    const next = { ...health, status };
    if (!(await writeCase(next))) return;
    if (status === "draft") {
      router.back();
      return;
    }
    router.replace({
      pathname: "/health-case-detail",
      params: { farmId, entryId: next.entryId, saved: "1" },
    });
  }

  const summary = healthCaseAnswers(health);
  for (const field of template?.form.steps[0]?.fields ?? []) {
    const target = attachmentTarget(field);
    if (target && health[target].length)
      summary.push([field.label, String(health[target].length)]);
  }
  if (health.media.length) summary.push(["Media", String(health.media.length)]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView
        ref={scroll}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <CaseFlowHeader
          onBack={() => (step > 0 ? goToStep(step - 1) : router.back())}
          animalName={health.animalName}
          farmName={farmName}
          date={health.openedAt ? when(health.openedAt) : ""}
          steps={template ? steps : []}
          step={step}
          description={
            choosingAnimal
              ? "Select the animal this case is for."
              : reviewing
                ? "Check the details below before saving this case."
                : "Complete the Case details using the fields in the template."
          }
        />
        {loading ? <ActivityIndicator color={colors.green} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {choosingAnimal && template && !loading ? (
          <View style={styles.block}>
            {animals.map((animal) => {
              const selected = health.animalEntryId === animal.entryId;
              return (
                <Pressable
                  key={animal.entryId}
                  accessibilityRole="button"
                  onPress={() =>
                    update({
                      animalEntryId: animal.entryId,
                      animalName: animal.name,
                    })
                  }
                  style={[styles.animal, selected ? styles.animalOn : null]}
                >
                  <View style={styles.avatar}>
                    {animal.photos[0] ? (
                      <Image
                        source={{ uri: animal.photos[0] }}
                        style={styles.avatarImage}
                      />
                    ) : (
                      <Text style={styles.initial}>
                        {animal.name.slice(0, 1).toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <View style={styles.copy}>
                    <Text style={styles.animalName}>{animal.name}</Text>
                    <Text style={styles.help}>
                      {animal.species || "Animal"}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        {activeStep && template && !loading ? (
          <TemplateEntryForm
            key={step}
            template={{
              ...template,
              form: {
                ...template.form,
                description: "",
                steps: [
                  {
                    ...activeStep,
                    title: "",
                    fields: activeStep.fields.map((field) =>
                      attachmentTarget(field) ? { ...field, rules: {} } : field,
                    ),
                  },
                ],
              },
            }}
            farmId={farmId}
            initialValues={drafts.current[step] ?? healthCaseValues(health)}
            onDraftChange={(answers) => {
              drafts.current[step] = answers;
            }}
            submitLabel="Continue"
            saving={Boolean(busy)}
            onSubmit={continueStep}
            renderField={(field) => {
              const target = attachmentTarget(field);
              if (target) {
                const required = activeStep.fields.find(
                  (item) => item.key === field.key,
                )?.rules.required;
                return (
                  <OutlinedField
                    label={`${field.label}${required ? " *" : ""}`}
                  >
                    {field.helpText ? (
                      <Text style={styles.help}>{field.helpText}</Text>
                    ) : null}
                    <Pressable
                      accessibilityRole="button"
                      disabled={Boolean(busy)}
                      onPress={() => setSheet(target)}
                      style={styles.secondary}
                    >
                      <Feather
                        name={target === "evidence" ? "paperclip" : "camera"}
                        size={16}
                        color={colors.green}
                      />
                      <Text style={styles.secondaryText}>
                        {target === "evidence" ? "Add evidence" : "Add photos"}
                      </Text>
                    </Pressable>
                    <FileRow
                      files={health[target]}
                      onRemove={(url) => removeFile(target, url)}
                    />
                  </OutlinedField>
                );
              }
              return null;
            }}
          />
        ) : null}
        {reviewing ? (
          <View style={styles.card}>
            <Text accessibilityRole="header" style={styles.animalName}>
              Case summary
            </Text>
            {summary.map(([label, value], index) => (
              <OutlinedField key={index} label={label}>
                <Text style={styles.factValue}>{value}</Text>
              </OutlinedField>
            ))}
            {template?.form.steps.map((item, index) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                disabled={Boolean(busy)}
                onPress={() => goToStep(firstFormStep + index)}
              >
                <Text style={styles.link}>Edit {item.title.toLowerCase()}</Text>
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="button"
              disabled={Boolean(busy)}
              onPress={() => setSheet("media")}
              style={styles.secondary}
            >
              <Feather name="plus" size={16} color={colors.green} />
              <Text style={styles.secondaryText}>
                {recording ? "Stop recording" : "Add photo, video, or audio"}
              </Text>
            </Pressable>
            <FileRow
              files={health.media}
              onRemove={(url) => removeFile("media", url)}
            />
          </View>
        ) : null}
      </ScrollView>
      <View style={styles.footer}>
        {busy ? <Text style={styles.help}>{busy}</Text> : null}
        {reviewing ? (
          <View style={styles.footerRow}>
            {health.status === "draft" ? (
              <Pressable
                accessibilityRole="button"
                disabled={Boolean(busy)}
                onPress={() => void persist("draft")}
                style={styles.draft}
              >
                <Text style={styles.draftText}>Save draft</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={Boolean(busy)}
              onPress={() => void persist("saved")}
              style={styles.primary}
            >
              <Text style={styles.primaryText}>Save case</Text>
            </Pressable>
          </View>
        ) : choosingAnimal && template ? (
          <Pressable
            accessibilityRole="button"
            disabled={Boolean(busy) || loading}
            onPress={() => void continueStep()}
            style={styles.primary}
          >
            <Text style={styles.primaryText}>Continue</Text>
          </Pressable>
        ) : !loading && !template ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void load()}
            style={styles.primary}
          >
            <Text style={styles.primaryText}>Retry</Text>
          </Pressable>
        ) : null}
      </View>
      <Modal
        visible={Boolean(sheet)}
        transparent
        animationType="fade"
        onRequestClose={() => setSheet(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setSheet(null)}>
          <View style={styles.sheet}>
            <Text style={styles.animalName}>
              Add {sheet === "media" ? "media" : "photos"}
            </Text>
            {sheet !== "media" ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    void pickImages(sheet ?? "conditionPhotos", true)
                  }
                  style={styles.sheetRow}
                >
                  <Text style={styles.sheetText}>Camera</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    void pickImages(sheet ?? "conditionPhotos", false)
                  }
                  style={styles.sheetRow}
                >
                  <Text style={styles.sheetText}>Gallery</Text>
                </Pressable>
              </>
            ) : null}
            {sheet === "evidence" ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void pickFile()}
                style={styles.sheetRow}
              >
                <Text style={styles.sheetText}>File</Text>
              </Pressable>
            ) : null}
            {sheet === "media" ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void pickImages("media", false)}
                  style={styles.sheetRow}
                >
                  <Text style={styles.sheetText}>Photo</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void pickVideo()}
                  style={styles.sheetRow}
                >
                  <Text style={styles.sheetText}>Video</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setSheet(null);
                    void toggleRecording();
                  }}
                  style={styles.sheetRow}
                >
                  <Text style={styles.sheetText}>
                    {recording ? "Stop recording" : "Record audio"}
                  </Text>
                </Pressable>
              </>
            ) : null}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function FileRow({
  files,
  onRemove,
}: {
  files: HealthCaseFile[];
  onRemove: (url: string) => void;
}) {
  if (!files.length) return null;
  return (
    <View style={styles.files}>
      {files.map((file) => (
        <View key={file.url} style={styles.file}>
          {file.kind === "photo" ? (
            <Image source={{ uri: file.url }} style={styles.thumb} />
          ) : (
            <View style={styles.thumb}>
              <Feather
                name={file.kind === "audio" ? "mic" : "file"}
                size={16}
                color={colors.green}
              />
            </View>
          )}
          <Text numberOfLines={1} style={styles.fileName}>
            {file.name}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${file.name}`}
            onPress={() => onRemove(file.url)}
          >
            <Feather name="x" size={16} color={colors.danger} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 16, paddingBottom: 24, gap: 12 },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    minHeight: 36,
  },
  backText: { color: colors.green, fontSize: 15, fontWeight: "700" },
  help: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 13 },
  block: { gap: 10 },
  label: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  secondary: {
    minHeight: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    ...farmButton,
    backgroundColor: "#FFFFFF",
  },
  secondaryText: { color: colors.green, fontWeight: "700" },
  animal: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    ...farmCard,
  },
  animalOn: { borderColor: colors.green, backgroundColor: colors.mint },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.mint,
  },
  avatarImage: { width: 48, height: 48 },
  initial: { color: colors.green, fontSize: 18, fontWeight: "800" },
  copy: { flex: 1 },
  animalName: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  card: {
    padding: 14,
    gap: 8,
    ...farmCard,
  },
  fact: { gap: 2 },
  factLabel: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  factValue: { color: colors.ink, fontSize: 15 },
  link: { color: colors.green, fontWeight: "700", paddingVertical: 4 },
  files: { gap: 8 },
  file: { flexDirection: "row", alignItems: "center", gap: 8 },
  thumb: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.mint,
    alignItems: "center",
    justifyContent: "center",
  },
  fileName: { flex: 1, color: colors.ink, fontSize: 13 },
  footer: {
    padding: 16,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  footerRow: { flexDirection: "row", gap: 8 },
  primary: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
    ...farmButton,
  },
  primaryText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  draft: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
  draftText: { color: colors.green, fontSize: 16, fontWeight: "800" },
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(23, 61, 50, 0.28)",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    gap: 4,
  },
  sheetRow: { minHeight: 48, justifyContent: "center" },
  sheetText: { color: colors.ink, fontSize: 16, fontWeight: "700" },
});
