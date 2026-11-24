import { FormScrollView } from "../components/ui/FormScrollView";
import { CaseFeatureEditor } from "../features/farm-vitals/case-feature-editor";
import { FlowPageHeading } from "../features/farm-vitals/flow-page-heading";
import * as DocumentPicker from "expo-document-picker";
import { OutlinedTextInput } from "../features/farm-vitals/outlined-field";
import { farmCard, farmButton } from "../features/farm-vitals/presentation";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import Feather from "@expo/vector-icons/Feather";
import {
  getHealthCase,
  healthCaseAnswers,
  healthCaseValues,
  updateHealthCaseAnswers,
  type FarmTemplateField,
  readableFarmImage,
  saveHealthCase,
  uploadHealthCaseMedia,
  type HealthCase,
  type HealthCaseFile,
} from "../services/farmVitalsApi";

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

function leaf(key: string, label: string, type = "text"): FarmTemplateField {
  return { id: key, key, label, type, rules: {}, helpText: "" };
}
function hasSource(fields: FarmTemplateField[], source: string): boolean {
  return fields.some(
    (field) =>
      field.source === source ||
      (field.fields ? hasSource(field.fields, source) : false),
  );
}

function clinicalSections(health: HealthCase) {
  const template = health.caseTemplate;
  if (template)
    return template.form.steps
      .map((step, index) => ({
        id: `${step.id}-${index}`,
        title: step.title,
        section: step.caseSection,
        fields: step.fields.filter(
          (field) =>
            !(field.key === "condition_photos" && field.type === "image") &&
            !(field.key === "evidence" && field.type === "upload"),
        ),
        values: healthCaseValues(health, step.caseSection),
        rows: healthCaseAnswers({
          ...health,
          caseTemplate: {
            ...template,
            form: { ...template.form, steps: [step] },
          },
        }),
      }))
      .filter((section) => section.fields.length > 0);
  const sections = [
    {
      id: "initial",
      title: "Initial observations",
      fields: [
        leaf("complaint", "Reported Problem", "textarea"),
        leaf("symptoms", "Observed Symptoms", "textarea"),
        leaf("onset", "Symptoms First Noticed"),
        leaf("duration", "Symptom Duration"),
        leaf("notes", "Additional Observations", "textarea"),
        leaf("follow_up", "Follow-up"),
      ],
    },
    {
      id: "treatment",
      title: "Treatment",
      fields: [leaf("treatment", "Treatment", "textarea")],
    },
    {
      id: "medicine",
      title: "Medicine",
      fields: [leaf("medicine", "Medicine and dosage", "textarea")],
    },
  ];
  const values = healthCaseValues(health);
  return sections.map((section) => ({
    ...section,
    section: undefined,
    values,
    rows: section.fields.flatMap((field): [string, string][] => {
      const value = values[field.key];
      return typeof value === "string" && value.trim()
        ? [[field.label, value]]
        : [];
    }),
  }));
}
type AttachmentTarget = "conditionPhotos" | "evidence" | "media";

function FeatureEdit({
  title,
  disabled,
  onPress,
}: {
  title: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Edit ${title}`}
      disabled={disabled}
      onPress={onPress}
      style={[styles.featureEdit, disabled && { opacity: 0.4 }]}
    >
      <Feather name="edit-2" size={16} color={colors.green} />
    </Pressable>
  );
}

export default function HealthCaseDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    farmId?: string;
    entryId?: string;
    saved?: string;
  }>();
  const farmId = param(params.farmId);
  const entryId = param(params.entryId);
  const [health, setHealth] = useState<HealthCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [attachmentDraft, setAttachmentDraft] = useState<
    Record<AttachmentTarget, HealthCaseFile[]>
  >({ conditionPhotos: [], evidence: [], media: [] });
  const [adding, setAdding] = useState(false);
  const [given, setGiven] = useState("");
  const [medicine, setMedicine] = useState("");
  const [notes, setNotes] = useState("");
  const [media, setMedia] = useState<HealthCaseFile[]>([]);
  const treatmentConfigured =
    health?.caseTemplate?.form.steps.some((step) =>
      hasSource(step.fields, "treatment"),
    ) ?? false;

  const load = useCallback(async () => {
    if (!farmId || !entryId) {
      setLoading(false);
      setError("This case could not be opened.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setHealth(await getHealthCase(farmId, entryId));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "This case could not be opened.",
      );
    } finally {
      setLoading(false);
    }
  }, [entryId, farmId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openAttachment(file: HealthCaseFile) {
    setError(null);
    try {
      const url = await readableFarmImage(file.url);
      await Linking.openURL(url);
    } catch {
      setError("This attachment could not be opened.");
    }
  }

  async function addPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Allow photo access to add a photo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset?.uri) return;
    setSaving(true);
    setError(null);
    try {
      const url = await uploadHealthCaseMedia(
        asset.uri,
        asset.fileName ?? "",
        farmId,
        "jpg",
      );
      setMedia((current) => [
        ...current,
        { url, name: asset.fileName ?? "Photo", kind: "photo" },
      ]);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The photo could not be uploaded.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveFeature(next: HealthCase) {
    if (!health || saving) return;
    setSaving(true);
    try {
      await saveHealthCase(farmId, next, health);
      setHealth(next);
      setEditing(null);
    } finally {
      setSaving(false);
    }
  }
  async function addAttachment(target: AttachmentTarget) {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: target === "conditionPhotos" ? "image/*" : "*/*",
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const mime = asset.mimeType ?? "";
      const kind = mime.startsWith("image/")
        ? "photo"
        : mime.startsWith("video/")
          ? "video"
          : mime.startsWith("audio/")
            ? "audio"
            : "file";
      const url = await uploadHealthCaseMedia(
        asset.uri,
        asset.name,
        farmId,
        kind === "photo"
          ? "jpg"
          : kind === "video"
            ? "mp4"
            : kind === "audio"
              ? "m4a"
              : "pdf",
      );
      setAttachmentDraft((current) => ({
        ...current,
        [target]: [...current[target], { url, name: asset.name, kind }],
      }));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The attachment could not be added.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function addUpdate() {
    if (!health || health.status !== "saved" || saving) return;
    if (!given.trim() && !medicine.trim() && !notes.trim() && !media.length) {
      setError("Add a treatment, medicine, or note.");
      return;
    }
    setSaving(true);
    setError(null);
    const next: HealthCase = {
      ...health,
      updates: [
        ...health.updates,
        {
          id: `update-${Date.now()}`,
          at: new Date().toISOString(),
          given: given.trim(),
          medicine: medicine.trim(),
          notes: notes.trim(),
          media,
        },
      ],
    };
    try {
      await saveHealthCase(farmId, next, health);
      setHealth(next);
      setGiven("");
      setMedicine("");
      setNotes("");
      setMedia([]);
      setAdding(false);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The update could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <FormScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <FlowPageHeading onBack={() => router.back()} title="Case details" />
        {params.saved === "1" ? (
          <View style={styles.success}>
            <Feather name="check-circle" size={18} color={colors.green} />
            <Text style={styles.successText}>Case saved</Text>
          </View>
        ) : null}
        {loading ? <ActivityIndicator color={colors.green} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {health?.status === "draft" ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Resume draft"
            onPress={() =>
              router.push({
                pathname: "/health-case",
                params: { farmId, entryId: health.entryId },
              })
            }
            style={styles.editButton}
          >
            <Feather name="edit-2" size={14} color={colors.green} />
            <Text style={styles.editText}>Resume draft</Text>
          </Pressable>
        ) : null}
        {health ? (
          <>
            <View style={styles.hero}>
              <View style={styles.heroTop}>
                <View style={styles.animalIcon}>
                  <Feather name="heart" size={23} color={colors.green} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.animalName}>{health.animalName}</Text>
                  <Text style={styles.heroCaption}>Health record</Text>
                </View>
                <View
                  style={[
                    styles.badge,
                    health.status === "draft" && styles.draftBadge,
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      health.status === "draft" && styles.draftBadgeText,
                    ]}
                  >
                    {health.status === "draft" ? "Draft" : "Saved"}
                  </Text>
                </View>
              </View>
              {health.openedAt ? (
                <View style={styles.dateRow}>
                  <Feather name="calendar" size={14} color={colors.muted} />
                  <Text style={styles.help}>{when(health.openedAt)}</Text>
                </View>
              ) : null}
              <View style={styles.summaryRow}>
                {treatmentConfigured ? (
                  <>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryNumber}>
                        {health.updates.length}
                      </Text>
                      <Text style={styles.help}>Treatment updates</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                  </>
                ) : null}
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryNumber}>
                    {health.conditionPhotos.length +
                      health.evidence.length +
                      health.media.length +
                      (treatmentConfigured
                        ? health.updates.reduce(
                            (count, update) => count + update.media.length,
                            0,
                          )
                        : 0)}
                  </Text>
                  <Text style={styles.help}>Attachments</Text>
                </View>
              </View>
            </View>
            <View style={styles.blockHeading}>
              <Feather name="clipboard" size={18} color={colors.green} />
              <Text accessibilityRole="header" style={styles.sectionTitle}>
                Clinical summary
              </Text>
            </View>
            {clinicalSections(health).map((section) => (
              <View key={section.id} style={styles.card}>
                <View style={styles.featureHeading}>
                  <Text
                    accessibilityRole="header"
                    style={[styles.cardTitle, styles.flex]}
                  >
                    {section.title}
                  </Text>
                  <FeatureEdit
                    title={section.title}
                    disabled={editing !== null || adding || saving}
                    onPress={() => {
                      setError(null);
                      setEditing(section.id);
                    }}
                  />
                </View>
                {editing === section.id ? (
                  <CaseFeatureEditor
                    farmId={farmId}
                    fields={section.fields}
                    values={section.values}
                    onCancel={() => setEditing(null)}
                    onSave={async (values) => {
                      await saveFeature(
                        updateHealthCaseAnswers(
                          health,
                          values,
                          section.section,
                        ),
                      );
                    }}
                  />
                ) : section.rows.length ? (
                  section.rows.map(([label, value], index) => (
                    <Section key={index} title={label} body={value} />
                  ))
                ) : (
                  <Text style={styles.help}>Not recorded yet.</Text>
                )}
              </View>
            ))}
            <View style={styles.card}>
              <View style={styles.featureHeading}>
                <Feather name="paperclip" size={18} color={colors.green} />
                <Text
                  accessibilityRole="header"
                  style={[styles.sectionTitle, styles.flex]}
                >
                  Attachments
                </Text>
                <FeatureEdit
                  title="attachments"
                  disabled={editing !== null || adding || saving}
                  onPress={() => {
                    setError(null);
                    setAttachmentDraft({
                      conditionPhotos: health.conditionPhotos,
                      evidence: health.evidence,
                      media: health.media,
                    });
                    setEditing("attachments");
                  }}
                />
              </View>
              {(["conditionPhotos", "evidence", "media"] as const).map(
                (target) => (
                  <Files
                    key={target}
                    onOpen={(file) => void openAttachment(file)}
                    title={
                      target === "conditionPhotos"
                        ? attachmentLabel(
                            health,
                            "condition_photos",
                            "Symptom photos",
                          )
                        : target === "evidence"
                          ? attachmentLabel(
                              health,
                              "evidence",
                              "Clinical evidence",
                            )
                          : "Other media"
                    }
                    files={
                      editing === "attachments"
                        ? attachmentDraft[target]
                        : health[target]
                    }
                    onRemove={
                      editing === "attachments"
                        ? (url) =>
                            setAttachmentDraft((current) => ({
                              ...current,
                              [target]: current[target].filter(
                                (file) => file.url !== url,
                              ),
                            }))
                        : undefined
                    }
                    onAdd={
                      editing === "attachments"
                        ? () => void addAttachment(target)
                        : undefined
                    }
                    disabled={saving}
                  />
                ),
              )}
              {editing === "attachments" ? (
                <>
                  <Pressable
                    accessibilityRole="button"
                    disabled={saving}
                    onPress={() => {
                      void saveFeature({ ...health, ...attachmentDraft }).catch(
                        (cause: unknown) =>
                          setError(
                            cause instanceof Error
                              ? cause.message
                              : "The attachments could not be saved.",
                          ),
                      );
                    }}
                    style={styles.primary}
                  >
                    <Text style={styles.primaryText}>
                      {saving ? "Saving…" : "Save changes"}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={saving}
                    onPress={() => {
                      setEditing(null);
                      setError(null);
                    }}
                    style={styles.cancelButton}
                  >
                    <Text style={styles.editText}>Cancel</Text>
                  </Pressable>
                </>
              ) : null}
            </View>
            {treatmentConfigured ? (
              <>
                <View style={styles.blockHeading}>
                  <Feather name="clock" size={18} color={colors.green} />
                  <Text accessibilityRole="header" style={styles.sectionTitle}>
                    Treatment history
                  </Text>
                  <Text style={styles.historyCount}>
                    {health.updates.length}
                  </Text>
                </View>
                {health.updates.length ? (
                  [...health.updates].reverse().map((update, index) => (
                    <View key={update.id} style={styles.timelineRow}>
                      <View style={styles.timelineRail}>
                        <View style={styles.timelineDot} />
                        {index < health.updates.length - 1 ? (
                          <View style={styles.timelineLine} />
                        ) : null}
                      </View>
                      <View style={[styles.card, styles.timelineCard]}>
                        <Text style={styles.timelineCaption}>
                          {index === 0 ? "LATEST UPDATE" : "TREATMENT UPDATE"}
                        </Text>
                        <View style={styles.featureHeading}>
                          <Text style={[styles.updateDate, styles.flex]}>
                            {when(update.at)}
                          </Text>
                          <FeatureEdit
                            title={`update ${when(update.at)}`}
                            disabled={editing !== null || adding || saving}
                            onPress={() => setEditing(`update-${update.id}`)}
                          />
                        </View>
                        {editing === `update-${update.id}` ? (
                          <CaseFeatureEditor
                            farmId={farmId}
                            fields={[
                              leaf("given", "Treatment", "textarea"),
                              leaf(
                                "medicine",
                                "Medicine and dosage",
                                "textarea",
                              ),
                              leaf("notes", "Progress notes", "textarea"),
                            ]}
                            values={{
                              given: update.given,
                              medicine: update.medicine,
                              notes: update.notes,
                            }}
                            onCancel={() => setEditing(null)}
                            onSave={async (values) => {
                              await saveFeature({
                                ...health,
                                updates: health.updates.map((item) =>
                                  item.id === update.id
                                    ? {
                                        ...item,
                                        given: String(values.given ?? ""),
                                        medicine: String(values.medicine ?? ""),
                                        notes: String(values.notes ?? ""),
                                      }
                                    : item,
                                ),
                              });
                            }}
                          />
                        ) : (
                          <>
                            {update.given ? (
                              <Section title="Treatment" body={update.given} />
                            ) : null}
                            {update.medicine ? (
                              <Section
                                title="Medicine and dosage"
                                body={update.medicine}
                              />
                            ) : null}
                            {update.notes ? (
                              <Section
                                title="Progress notes"
                                body={update.notes}
                              />
                            ) : null}
                            {update.media.length ? (
                              <Files
                                onOpen={(file) => void openAttachment(file)}
                                title="Photos"
                                files={update.media}
                              />
                            ) : null}
                          </>
                        )}
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={styles.emptyState}>
                    <Feather name="clock" size={22} color={colors.muted} />
                    <View style={styles.flex}>
                      <Text style={styles.emptyTitle}>
                        No treatment updates yet
                      </Text>
                      <Text style={styles.help}>
                        Updates added to this case will appear here.
                      </Text>
                    </View>
                  </View>
                )}
                {adding ? (
                  <View style={styles.card}>
                    <Text accessibilityRole="header" style={styles.cardTitle}>
                      Add treatment update
                    </Text>
                    <Text style={styles.help}>
                      Record the treatment, medicine, or progress for this case.
                    </Text>
                    <OutlinedTextInput
                      value={given}
                      onChangeText={setGiven}
                      label="Treatment"
                      placeholderTextColor={colors.muted}
                    />
                    <OutlinedTextInput
                      value={medicine}
                      onChangeText={setMedicine}
                      label="Medicine and dosage"
                      placeholderTextColor={colors.muted}
                    />
                    <OutlinedTextInput
                      value={notes}
                      onChangeText={setNotes}
                      label="Progress notes"
                      placeholderTextColor={colors.muted}
                      multiline
                      style={styles.notes}
                    />
                    <Pressable
                      accessibilityRole="button"
                      disabled={saving}
                      onPress={() => void addPhoto()}
                    >
                      <Text style={styles.link}>Add photo</Text>
                    </Pressable>
                    {media.length ? (
                      <Files
                        onOpen={(file) => void openAttachment(file)}
                        title="Update photos"
                        files={media}
                      />
                    ) : null}
                    <Pressable
                      accessibilityRole="button"
                      disabled={saving}
                      onPress={() => void addUpdate()}
                      style={styles.primary}
                    >
                      <Text style={styles.primaryText}>
                        {saving ? "Saving…" : "Save update"}
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      disabled={saving}
                      onPress={() => {
                        setAdding(false);
                        setGiven("");
                        setMedicine("");
                        setNotes("");
                        setMedia([]);
                        setError(null);
                      }}
                      style={styles.cancelButton}
                    >
                      <Text style={styles.editText}>Cancel</Text>
                    </Pressable>
                  </View>
                ) : health.status === "saved" ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={editing !== null || saving}
                    onPress={() => setAdding(true)}
                    style={styles.primary}
                  >
                    <Text style={styles.primaryText}>Add treatment update</Text>
                  </Pressable>
                ) : null}
              </>
            ) : null}
          </>
        ) : null}
      </FormScrollView>
    </SafeAreaView>
  );
}

function attachmentLabel(
  health: HealthCase,
  key: string,
  fallback: string,
): string {
  return (
    health.caseTemplate?.form.steps
      .flatMap((step) => step.fields)
      .find((field) => field.key === key)?.label ?? fallback
  );
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{title}</Text>
      <Text selectable style={styles.body}>
        {body}
      </Text>
    </View>
  );
}

function Files({
  title,
  files,
  onOpen,
  onRemove,
  onAdd,
  disabled = false,
}: {
  title: string;
  files: HealthCaseFile[];
  onOpen: (file: HealthCaseFile) => void;
  onRemove?: (url: string) => void;
  onAdd?: () => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.fileGroup}>
      <View style={styles.fileGroupHeading}>
        <Text style={styles.detailLabel}>{title}</Text>
        <Text style={styles.help}>
          {files.length ? `${files.length} added` : "None added"}
        </Text>
      </View>
      {files.map((file) => (
        <View key={file.url} style={styles.file}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${file.name}`}
            onPress={() => onOpen(file)}
            style={[styles.file, styles.flex]}
          >
            {file.kind === "photo" ? (
              <Image source={{ uri: file.url }} style={styles.thumb} />
            ) : (
              <Feather
                name={file.kind === "audio" ? "mic" : "file"}
                size={16}
                color={colors.green}
              />
            )}
            <Text numberOfLines={2} style={[styles.body, styles.flex]}>
              {file.name}
            </Text>
          </Pressable>
          {onRemove ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${file.name}`}
              disabled={disabled}
              onPress={() => onRemove(file.url)}
              style={styles.featureEdit}
            >
              <Feather name="x" size={16} color={colors.danger} />
            </Pressable>
          ) : null}
        </View>
      ))}
      {onAdd ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Add ${title}`}
          disabled={disabled}
          onPress={onAdd}
          style={styles.cancelButton}
        >
          <Text style={styles.editText}>Add attachment</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  featureHeading: { flexDirection: "row", alignItems: "center", gap: 8 },
  featureEdit: {
    minWidth: 40,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: colors.mint,
  },
  flex: { flex: 1, minWidth: 0 },
  pageHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 2,
  },
  eyebrow: {
    color: colors.green,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 5,
  },
  editButton: {
    ...farmButton,
    backgroundColor: colors.surface,
    borderRadius: 12,
    minHeight: 42,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  editText: { color: colors.green, fontSize: 14, fontWeight: "700" },
  hero: { ...farmCard, padding: 16, gap: 14 },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  animalIcon: {
    backgroundColor: colors.mint,
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  animalName: { color: colors.ink, fontSize: 24, fontWeight: "800" },
  heroCaption: { color: colors.muted, fontSize: 12, marginTop: 3 },
  badge: {
    backgroundColor: colors.mint,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: { color: colors.green, fontSize: 11, fontWeight: "800" },
  draftBadge: { backgroundColor: "#FFF1D7" },
  draftBadgeText: { color: "#835914" },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  summaryRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    gap: 16,
  },
  summaryItem: { flex: 1, gap: 3 },
  summaryNumber: { color: colors.ink, fontSize: 21, fontWeight: "800" },
  summaryDivider: { width: 1, backgroundColor: colors.border },
  blockHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
    marginBottom: 2,
  },
  cardTitle: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  detailRow: {
    gap: 5,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    marginTop: 6,
  },
  detailLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    flexShrink: 1,
  },
  fileGroup: {
    gap: 8,
    paddingTop: 12,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  fileGroupHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  historyCount: {
    color: colors.green,
    fontSize: 12,
    fontWeight: "800",
    backgroundColor: colors.mint,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  timelineRow: { flexDirection: "row", alignItems: "stretch", gap: 10 },
  timelineRail: { width: 12, alignItems: "center", paddingTop: 20 },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.green,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: "#C6DDD1",
    marginTop: 5,
    marginBottom: -24,
  },
  timelineCard: { flex: 1, minWidth: 0 },
  timelineCaption: {
    color: colors.green,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  updateDate: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  emptyState: {
    backgroundColor: colors.mint,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  cancelButton: {
    ...farmButton,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },

  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 16, paddingBottom: 32, gap: 16 },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    minHeight: 36,
  },
  backText: { color: colors.green, fontSize: 15, fontWeight: "700" },
  title: { color: colors.ink, fontSize: 26, fontWeight: "800" },
  help: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 13 },
  success: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.mint,
    borderRadius: 12,
    padding: 12,
  },
  successText: { color: colors.green, fontWeight: "800" },
  card: {
    padding: 14,
    gap: 8,
    ...farmCard,
  },
  sectionTitle: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  body: { color: colors.ink, fontSize: 15, lineHeight: 21 },
  file: { flexDirection: "row", alignItems: "center", gap: 8 },
  thumb: { width: 48, height: 48, borderRadius: 8 },
  notes: { minHeight: 80, paddingTop: 10, textAlignVertical: "top" },
  primary: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
    ...farmButton,
  },
  primaryText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  link: {
    color: colors.green,
    fontWeight: "700",
    textAlign: "center",
    paddingVertical: 8,
  },
});
