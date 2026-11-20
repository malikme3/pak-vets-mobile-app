import {
  farmBorder,
  farmCard,
  farmButton,
} from "../features/farm-vitals/presentation";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
  const [adding, setAdding] = useState(false);
  const [given, setGiven] = useState("");
  const [medicine, setMedicine] = useState("");
  const [notes, setNotes] = useState("");
  const [media, setMedia] = useState<HealthCaseFile[]>([]);

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
      await saveHealthCase(farmId, next);
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
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.back}
        >
          <Feather name="arrow-left" size={18} color={colors.green} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        {params.saved === "1" ? (
          <View style={styles.success}>
            <Feather name="check-circle" size={18} color={colors.green} />
            <Text style={styles.successText}>Case saved</Text>
          </View>
        ) : null}
        {loading ? <ActivityIndicator color={colors.green} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {health ? (
          <>
            <Text accessibilityRole="header" style={styles.title}>
              {health.animalName}
            </Text>
            <Text style={styles.help}>
              {health.status === "draft" ? "Draft" : "Saved"}
              {health.openedAt ? ` · ${when(health.openedAt)}` : ""}
            </Text>
            {healthCaseAnswers(health).map(([label, value], index) => (
              <Section key={index} title={label} body={value} />
            ))}
            <Files
              onOpen={(file) => void openAttachment(file)}
              title={attachmentLabel(
                health,
                "condition_photos",
                "Today's condition",
              )}
              files={health.conditionPhotos}
            />
            <Files
              onOpen={(file) => void openAttachment(file)}
              title={attachmentLabel(health, "evidence", "Clinical evidence")}
              files={health.evidence}
            />
            <Files
              onOpen={(file) => void openAttachment(file)}
              title="Media"
              files={health.media}
            />
            <Text style={styles.sectionTitle}>Treatment history</Text>
            {health.updates.length ? (
              health.updates.map((update) => (
                <View key={update.id} style={styles.card}>
                  <Text style={styles.help}>{when(update.at)}</Text>
                  {update.given ? (
                    <Text style={styles.body}>{update.given}</Text>
                  ) : null}
                  {update.medicine ? (
                    <Text style={styles.body}>{update.medicine}</Text>
                  ) : null}
                  {update.notes ? (
                    <Text style={styles.body}>{update.notes}</Text>
                  ) : null}
                  {update.media.length ? (
                    <Files
                      onOpen={(file) => void openAttachment(file)}
                      title="Photos"
                      files={update.media}
                    />
                  ) : null}
                </View>
              ))
            ) : (
              <Text style={styles.help}>No updates yet.</Text>
            )}
            {adding ? (
              <View style={styles.card}>
                <TextInput
                  value={given}
                  onChangeText={setGiven}
                  placeholder="Treatment"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                />
                <TextInput
                  value={medicine}
                  onChangeText={setMedicine}
                  placeholder="Medicine and dosage"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                />
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Progress notes"
                  placeholderTextColor={colors.muted}
                  multiline
                  style={[styles.input, styles.notes]}
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={saving}
                  onPress={() => void addPhoto()}
                >
                  <Text style={styles.link}>Add photo</Text>
                </Pressable>
                <Files
                  onOpen={(file) => void openAttachment(file)}
                  title="Update photos"
                  files={media}
                />
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
              </View>
            ) : health.status === "saved" ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setAdding(true)}
                style={styles.primary}
              >
                <Text style={styles.primaryText}>Add treatment update</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: "/health-case",
                  params: { farmId, entryId: health.entryId },
                })
              }
            >
              <Text style={styles.link}>
                {health.status === "draft" ? "Resume draft" : "Edit case"}
              </Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
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
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

function Files({
  title,
  files,
  onOpen,
}: {
  title: string;
  files: HealthCaseFile[];
  onOpen: (file: HealthCaseFile) => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {files.length ? (
        files.map((file) => (
          <Pressable
            key={file.url}
            accessibilityRole="button"
            accessibilityLabel={`Open ${file.name}`}
            onPress={() => onOpen(file)}
            style={styles.file}
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
            <Text numberOfLines={2} style={styles.body}>
              {file.name}
            </Text>
          </Pressable>
        ))
      ) : (
        <Text style={styles.help}>None added</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 16, paddingBottom: 32, gap: 12 },
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
    gap: 6,
    ...farmCard,
  },
  sectionTitle: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  body: { color: colors.ink, fontSize: 15, lineHeight: 21 },
  file: { flexDirection: "row", alignItems: "center", gap: 8 },
  thumb: { width: 48, height: 48, borderRadius: 8 },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: farmBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    color: colors.ink,
    fontSize: 15,
  },
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
