import {
  farmBorder,
  farmCard,
  farmButton,
} from "../features/farm-vitals/presentation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewInstance,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import Feather from "@expo/vector-icons/Feather";
import {
  animalPhotoPromptKey,
  deleteSocialPost,
  getFarmReview,
  listSocialPosts,
  prepareFarmPost,
  readableFarmImage,
  saveSocialPost,
  uploadFarmImage,
  type SocialPost,
  type SocialPostStatus,
} from "../services/farmVitalsApi";

type DraftPhoto = { uri: string; fileName: string };

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

const SAMPLE_TAGLINE = "Healthy herd, checked today";
const SAMPLE_NOTE =
  "Checked the flock this morning. Temperature and appetite were normal. Gave the scheduled vaccination. No wounds or fever.";

const STATUS_LABEL: Record<SocialPostStatus, string> = {
  draft: "Draft",
  ready: "Ready to share",
  shared: "Shared",
  scheduled: "Scheduled",
};

function contentMark(line: string, caption: string, visit: string): string {
  return `${line.trim()}\n${caption.trim()}\n${visit.trim()}`;
}

function todayLabel(): string {
  return new Date().toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function savedLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function photoFileName(
  asset: ImagePicker.ImagePickerAsset,
  index: number,
): string {
  const mime = asset.mimeType?.toLowerCase() ?? "";
  const extension = mime.includes("png")
    ? "png"
    : mime.includes("webp")
      ? "webp"
      : "jpg";
  const base = (asset.fileName || `post-${index + 1}`).replace(/\.[^.]+$/, "");
  return `${base || "post"}.${extension}`;
}

export default function FarmPostScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ farmId?: string; entryId?: string }>();
  const farmId = typeof params.farmId === "string" ? params.farmId : "";
  const entryId = typeof params.entryId === "string" ? params.entryId : "";
  const [farmName, setFarmName] = useState("");
  const [animalName, setAnimalName] = useState("");
  const [species, setSpecies] = useState("");
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const [fileUrls, setFileUrls] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<SocialPost[]>([]);
  const [draftId, setDraftId] = useState("");
  const [postStatus, setPostStatus] = useState<SocialPostStatus | "">("");
  const [savedMark, setSavedMark] = useState("");
  const [savingAs, setSavingAs] = useState<SocialPostStatus | "">("");
  const [tagline, setTagline] = useState(SAMPLE_TAGLINE);
  const [printedTagline, setPrintedTagline] = useState("");
  const [note, setNote] = useState(SAMPLE_NOTE);
  const [posterUri, setPosterUri] = useState("");
  const [posterFileUrl, setPosterFileUrl] = useState("");
  const [postDate, setPostDate] = useState(todayLabel);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [preparing, setPreparing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const demoteMark = useRef("");

  const load = useCallback(async () => {
    if (!farmId || !entryId) {
      setLoading(false);
      setError("Open this page from an animal.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const review = await getFarmReview(farmId);
      const animal = review.animals.find((item) => item.entryId === entryId);
      if (!animal) throw new Error("This animal is no longer on the farm.");
      setFarmName(review.name);
      setAnimalName(animal.name);
      setSpecies(animal.species);
      setDrafts(await listSocialPosts(farmId, entryId).catch(() => []));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "This animal could not be opened.",
      );
    } finally {
      setLoading(false);
    }
  }, [entryId, farmId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const placeholder = [farmName, animalName, species, postDate]
    .filter(Boolean)
    .join(" · ");

  async function addPhotos(source: "camera" | "library") {
    if (photos.length >= 4) return;
    setError(null);
    setNotice(null);
    try {
      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ["images"],
              quality: 0.8,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ["images"],
              allowsMultipleSelection: true,
              quality: 0.8,
              selectionLimit: 4 - photos.length,
            });
      if (result.canceled) return;
      const next = result.assets
        .filter((asset) => asset.uri)
        .slice(0, 4 - photos.length)
        .map((asset, index) => ({
          uri: asset.uri,
          fileName: photoFileName(asset, photos.length + index),
        }));
      setPhotos((current) => [...current, ...next].slice(0, 4));
      setFileUrls([]);
      setDraftId("");
      setPostStatus("");
      setSavedMark("");
      setPosterUri("");
      setPosterFileUrl("");
      setPrintedTagline("");
      setDescription("");
    } catch {
      setError(
        source === "camera"
          ? "Allow camera access to take a photo."
          : "Allow photo access to choose pictures.",
      );
    }
  }

  function clearPost() {
    setFileUrls([]);
    setDraftId("");
    setPostStatus("");
    setSavedMark("");
    setPosterUri("");
    setPosterFileUrl("");
    setPrintedTagline("");
    setDescription("");
    setPostDate(todayLabel());
  }

  async function prepare() {
    const line = tagline.trim();
    if (!photos.length) {
      setError("Add at least one photo.");
      return;
    }
    if (!line) {
      setError("Add a tagline.");
      return;
    }
    if (line === SAMPLE_TAGLINE && note.trim() === SAMPLE_NOTE) {
      setError("Change the tagline or the note before preparing the post.");
      return;
    }
    setPreparing(true);
    setError(null);
    setNotice(null);
    try {
      const promptKey = await animalPhotoPromptKey();
      const uploaded: string[] = [];
      for (const photo of photos) {
        uploaded.push(
          await uploadFarmImage(
            photo.uri,
            photo.fileName,
            farmId,
            species || "unknown",
            promptKey,
          ),
        );
      }
      const post = await prepareFarmPost({
        fileUrls: uploaded,
        tagline: line,
        note: note.trim(),
        farmName,
        animalName,
        species,
        dateLabel: postDate,
        rewrite: true,
      });
      setFileUrls(uploaded);
      setDraftId("");
      setPostStatus("");
      setSavedMark("");
      setTagline(post.tagline);
      setPrintedTagline(post.tagline);
      setPosterFileUrl(post.posterUrl);
      setPosterUri(await readableFarmImage(post.posterUrl));
      setDescription(post.description);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The post could not be prepared.",
      );
    } finally {
      setPreparing(false);
    }
  }

  async function reprint(
    nextTagline: string,
    caption: string,
  ): Promise<{ readable: string; posterUrl: string }> {
    const post = await prepareFarmPost({
      fileUrls,
      tagline: nextTagline,
      note: note.trim(),
      farmName,
      animalName,
      species,
      dateLabel: postDate,
      rewrite: false,
      description: caption,
    });
    const readable = await readableFarmImage(post.posterUrl);
    setTagline(post.tagline);
    setPrintedTagline(post.tagline);
    setDescription(post.description);
    setPosterFileUrl(post.posterUrl);
    setPosterUri(readable);
    return { readable, posterUrl: post.posterUrl };
  }

  async function openDraft(draft: SocialPost) {
    setPreparing(true);
    setError(null);
    setNotice(null);
    try {
      const readable = await readableFarmImage(draft.posterUrl);
      setDraftId(draft.postId);
      setFileUrls(draft.fileUrls);
      setTagline(draft.tagline);
      setPrintedTagline(draft.printedTagline || draft.tagline);
      setNote(draft.note);
      setDescription(draft.description);
      setPostDate(draft.dateLabel || todayLabel());
      setPosterFileUrl(draft.posterUrl);
      setPosterUri(readable);
      setPostStatus(draft.status);
      setSavedMark(contentMark(draft.tagline, draft.description, draft.note));
      demoteMark.current = "";
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "This saved post could not be opened.",
      );
    } finally {
      setPreparing(false);
    }
  }

  async function persist(
    status: SocialPostStatus,
    poster = posterFileUrl,
    printed = printedTagline,
  ) {
    const caption = description.trim();
    const line = tagline.trim();
    if (!poster || !caption || !line) return null;
    const saved = await saveSocialPost({
      postId: draftId || undefined,
      farmId,
      entryId,
      farmName,
      animalName,
      species,
      dateLabel: postDate,
      tagline: line,
      printedTagline: printed || line,
      note: note.trim(),
      description: caption,
      posterUrl: poster,
      fileUrls,
      status,
    });
    setDraftId(saved.postId);
    setPosterFileUrl(saved.posterUrl);
    setPostStatus(saved.status);
    setSavedMark(contentMark(saved.tagline, saved.description, saved.note));
    demoteMark.current = "";
    setDrafts(await listSocialPosts(farmId, entryId).catch(() => []));
    return saved;
  }

  async function saveDraft(status: SocialPostStatus) {
    const movingBack =
      status === "draft" &&
      (postStatus === "ready" ||
        postStatus === "shared" ||
        postStatus === "scheduled");
    setSaving(true);
    setSavingAs(status);
    setError(null);
    setNotice(null);
    try {
      await persist(status);
      setNotice(
        status === "ready"
          ? "Ready to share."
          : movingBack
            ? "Moved back to a draft."
            : "Saved as a draft.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "The post could not be saved.",
      );
    } finally {
      setSaving(false);
      setSavingAs("");
    }
  }

  async function deleteDraft(id: string) {
    setError(null);
    try {
      await deleteSocialPost(id);
      setDrafts((current) => current.filter((item) => item.postId !== id));
      if (draftId === id) setDraftId("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The saved post could not be removed.",
      );
    }
  }

  async function share() {
    const caption = description.trim();
    const line = tagline.trim();
    if (!posterUri || !caption) return;
    setSharing(true);
    setError(null);
    setNotice(null);
    try {
      let image = posterUri;
      let fileUrl = posterFileUrl;
      if (line && line !== printedTagline && fileUrls.length) {
        const printed = await reprint(line, caption);
        image = printed.readable;
        fileUrl = printed.posterUrl;
      }
      await Clipboard.setStringAsync(caption);
      const available = await Sharing.isAvailableAsync();
      if (!available)
        throw new Error("Sharing is not available on this phone.");
      const file = await File.downloadFileAsync(
        image,
        new File(Paths.cache, `farm-post-${Date.now()}.jpg`),
      );
      await Sharing.shareAsync(file.uri, {
        mimeType: "image/jpeg",
        UTI: "public.jpeg",
        dialogTitle: "Share post",
      });
      try {
        await persist("shared", fileUrl, line);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "The shared status could not be saved.",
        );
      }
      setNotice("Caption copied. In Facebook, paste it under the photo.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The post could not be shared.",
      );
    } finally {
      setSharing(false);
    }
  }

  const currentMark = contentMark(tagline, description, note);
  const edited = savedMark !== "" && currentMark !== savedMark;
  const shownStatus: SocialPostStatus | "" = edited ? "draft" : postStatus;
  const draftHeld = shownStatus === "draft" && Boolean(draftId) && !edited;
  const readyHeld = shownStatus === "ready";

  useEffect(() => {
    if (!edited || saving || sharing || !draftId) return;
    if (
      postStatus !== "ready" &&
      postStatus !== "shared" &&
      postStatus !== "scheduled"
    )
      return;
    if (demoteMark.current === currentMark) return;
    demoteMark.current = currentMark;
    void saveDraft("draft");
  }, [currentMark, draftId, edited, postStatus, saving, sharing]);

  const ready = Boolean(posterUri);
  const taglineChanged = tagline.trim() !== printedTagline;
  const copyChanged =
    tagline.trim() !== SAMPLE_TAGLINE || note.trim() !== SAMPLE_NOTE;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.back}
        >
          <Feather name="arrow-left" size={18} color={colors.green} />
          <Text style={styles.backText}>{animalName || "Animal"}</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>
          {ready ? "Review post" : "Prepare post"}
        </Text>
        <Text style={styles.help}>
          {ready
            ? shownStatus === "ready"
              ? "This post is ready to share."
              : shownStatus === "draft"
                ? "This post is a draft. Mark it ready when the wording is set."
                : "Save a draft or mark it ready to share."
            : "A sample tagline and note are filled in. Change one of them, then prepare the post."}
        </Text>
        {loading ? <ActivityIndicator color={colors.green} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        {ready ? (
          <View style={styles.result}>
            <View style={styles.posterCard}>
              <View style={styles.photoFrame}>
                <Image source={{ uri: posterUri }} style={styles.posterImage} />
              </View>
              <View style={styles.band}>
                <TextInput
                  accessibilityLabel="Tagline on the photo"
                  value={tagline}
                  onChangeText={setTagline}
                  placeholder="Edit the tagline"
                  placeholderTextColor={colors.muted}
                  maxLength={90}
                  multiline
                  style={styles.bandInput}
                />
                <Text style={styles.bandDetail}>
                  {placeholder || "Farm details"}
                </Text>
              </View>
            </View>
            {taglineChanged ? (
              <Text style={styles.notice}>
                The new tagline is printed on the photo when you share.
              </Text>
            ) : null}
            <Text style={styles.label}>Caption</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              maxLength={1200}
              multiline
              style={[styles.input, styles.note]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: draftHeld }}
              disabled={
                saving ||
                sharing ||
                preparing ||
                !description.trim() ||
                !tagline.trim() ||
                draftHeld
              }
              onPress={() => void saveDraft("draft")}
              style={[styles.secondary, draftHeld ? styles.chosen : null]}
            >
              {savingAs === "draft" ? (
                <ActivityIndicator
                  color={draftHeld ? "#FFFFFF" : colors.green}
                />
              ) : (
                <>
                  {draftHeld ? (
                    <Feather name="check" size={16} color="#FFFFFF" />
                  ) : null}
                  <Text
                    style={[
                      styles.secondaryText,
                      draftHeld ? styles.chosenText : null,
                    ]}
                  >
                    {draftHeld ? "Draft" : "Save draft"}
                  </Text>
                </>
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: readyHeld }}
              disabled={
                saving ||
                sharing ||
                preparing ||
                !description.trim() ||
                !tagline.trim() ||
                readyHeld
              }
              onPress={() => void saveDraft("ready")}
              style={[styles.secondary, readyHeld ? styles.chosen : null]}
            >
              {savingAs === "ready" ? (
                <ActivityIndicator
                  color={readyHeld ? "#FFFFFF" : colors.green}
                />
              ) : (
                <>
                  {readyHeld ? (
                    <Feather name="check" size={16} color="#FFFFFF" />
                  ) : null}
                  <Text
                    style={[
                      styles.secondaryText,
                      readyHeld ? styles.chosenText : null,
                    ]}
                  >
                    Ready to share
                  </Text>
                </>
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={
                sharing ||
                saving ||
                preparing ||
                !description.trim() ||
                !tagline.trim()
              }
              onPress={() => void share()}
              style={styles.primary}
            >
              {sharing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="share-2" size={16} color="#FFFFFF" />
                  <Text style={styles.primaryText}>
                    {shownStatus === "shared" ? "Shared" : "Share to Facebook"}
                  </Text>
                </>
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={preparing || sharing || saving}
              onPress={clearPost}
              style={styles.secondary}
            >
              <Text style={styles.secondaryText}>Change photos</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {drafts.length ? (
              <View style={styles.drafts}>
                <Text style={styles.label}>Saved posts</Text>
                {drafts.map((draft) => (
                  <View key={draft.postId} style={styles.draftRow}>
                    <Pressable
                      accessibilityRole="button"
                      disabled={preparing}
                      onPress={() => void openDraft(draft)}
                      style={styles.draftMain}
                    >
                      <Text numberOfLines={1} style={styles.draftTitle}>
                        {draft.tagline}
                      </Text>
                      <Text style={styles.draftDate}>
                        {STATUS_LABEL[draft.status]}
                        {savedLabel(draft.updatedAt)
                          ? ` · ${savedLabel(draft.updatedAt)}`
                          : ""}
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Remove saved post"
                      disabled={preparing}
                      onPress={() => void deleteDraft(draft.postId)}
                      style={styles.draftRemove}
                    >
                      <Feather name="x" size={16} color={colors.muted} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
            <View style={styles.photoRow}>
              {photos.map((photo) => (
                <View key={photo.uri} style={styles.thumbWrap}>
                  <Image source={{ uri: photo.uri }} style={styles.thumb} />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Remove photo"
                    onPress={() => {
                      setPhotos((current) =>
                        current.filter((item) => item.uri !== photo.uri),
                      );
                      clearPost();
                    }}
                    style={styles.remove}
                  >
                    <Feather name="x" size={14} color="#FFFFFF" />
                  </Pressable>
                </View>
              ))}
              {photos.length < 4 ? (
                <View style={styles.adders}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void addPhotos("camera")}
                    style={styles.adder}
                  >
                    <Feather name="camera" size={18} color={colors.green} />
                    <Text style={styles.adderText}>Camera</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void addPhotos("library")}
                    style={styles.adder}
                  >
                    <Feather name="image" size={18} color={colors.green} />
                    <Text style={styles.adderText}>Library</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
            <Text style={styles.label}>Tagline</Text>
            <TextInput
              value={tagline}
              onChangeText={setTagline}
              placeholder="Healthy herd, checked today"
              placeholderTextColor={colors.muted}
              maxLength={90}
              style={styles.input}
            />
            <Text style={styles.label}>Note for the caption</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Checked the flock this morning. Temperature and appetite were normal. Gave the scheduled vaccination. No wounds or fever."
              placeholderTextColor={colors.muted}
              maxLength={400}
              multiline
              style={[styles.input, styles.note]}
            />
            <View style={styles.card}>
              <Text style={styles.label}>Prompt</Text>
              <Text style={styles.placeholder}>Facebook post</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.label}>Printed on the photo</Text>
              <Text style={styles.placeholder}>
                {placeholder || "Farm details"}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={preparing || loading || !copyChanged || !tagline.trim()}
              onPress={() => void prepare()}
              style={[
                styles.primary,
                (!copyChanged || !tagline.trim()) && styles.primaryDisabled,
              ]}
            >
              {preparing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryText}>Prepare post</Text>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 20, paddingBottom: 36, gap: 12 },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    minHeight: 36,
  },
  backText: { color: colors.green, fontSize: 15, fontWeight: "700" },
  title: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  help: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 13 },
  notice: { color: colors.green, fontSize: 13, fontWeight: "600" },
  photoRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  thumbWrap: { width: 84, height: 84 },
  thumb: {
    width: 84,
    height: 84,
    borderRadius: 12,
    backgroundColor: colors.mint,
  },
  remove: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(23, 61, 50, 0.82)",
  },
  adders: { flexDirection: "row", gap: 8 },
  adder: {
    width: 84,
    height: 84,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    ...farmButton,
  },
  adderText: { color: colors.green, fontSize: 11, fontWeight: "700" },
  label: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: farmBorder,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.ink,
    fontSize: 15,
  },
  note: { minHeight: 96, textAlignVertical: "top" },
  card: {
    padding: 14,
    gap: 4,
    ...farmCard,
  },
  placeholder: { color: colors.muted, fontSize: 14 },
  primary: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    ...farmButton,
  },
  primaryDisabled: { opacity: 0.4 },
  primaryText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  secondary: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    ...farmButton,
  },
  secondaryText: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  chosen: { backgroundColor: colors.green, borderColor: colors.green },
  chosenText: { color: "#FFFFFF" },
  result: { gap: 12 },
  drafts: { gap: 8 },
  draftRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    ...farmCard,
  },
  draftMain: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, gap: 2 },
  draftTitle: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  draftDate: { color: colors.muted, fontSize: 12 },
  draftRemove: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  posterCard: {
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#F8F8F2",
  },
  photoFrame: {
    width: "100%",
    aspectRatio: 1080 / 1040,
    overflow: "hidden",
    backgroundColor: colors.ink,
  },
  posterImage: {
    width: "100%",
    aspectRatio: 1080 / 1350,
  },
  band: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 6,
    backgroundColor: "#F8F8F2",
  },
  bandInput: {
    minHeight: 48,
    padding: 0,
    color: colors.ink,
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 26,
  },
  bandDetail: { color: colors.green, fontSize: 13, fontWeight: "600" },
});
