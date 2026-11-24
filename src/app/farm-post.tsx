import { FormScrollView } from "../components/ui/FormScrollView";
import {
  farmBorder,
  farmCard,
  farmButton,
  findAnimalTag,
  findFarmOwnerName,
} from "../features/farm-vitals/presentation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  TextInput,
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
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
import { FlowPageHeading } from "../features/farm-vitals/flow-page-heading";
import {
  aiFarmImageUrl,
  animalPhotoUploadOptions,
  deleteSocialPost,
  getFarmReview,
  listSocialPosts,
  prepareFarmPost,
  readableFarmImage,
  saveSocialPost,
  uploadFarmImage,
  type FarmAnimalReview,
  type SocialPost,
  type SocialPostStatus,
} from "../services/farmVitalsApi";

type DraftPhoto =
  { uri: string; fileName: string } | { uri: string; fileUrl: string };

function requestedPostPhotos(value: string): string[] {
  try {
    const urls: unknown = JSON.parse(value);
    if (Array.isArray(urls)) {
      return [
        ...new Set(
          urls.filter((url): url is string => typeof url === "string"),
        ),
      ].slice(0, 2);
    }
  } catch {
    return [];
  }
  return [];
}

function animalPostDetails(
  animal: FarmAnimalReview,
  farmName: string,
  ownerName?: string,
) {
  const rows = animal.sections
    .flatMap((section) => section.rows)
    .filter(
      (row) =>
        !row.imageUrl && row.value.trim() && row.value !== "Not provided",
    );
  const fieldValue = (names: string[]) =>
    rows
      .find((row) =>
        [row.key, row.label].some((field) =>
          names.includes(field?.toLowerCase().replace(/[^a-z]/g, "") ?? ""),
        ),
      )
      ?.value.trim();

  const type =
    fieldValue(["animaltype", "typeofanimal", "type"]) || animal.species;
  const speciesField = fieldValue(["species", "animalspecies"]);
  const species =
    speciesField && speciesField.toLowerCase() !== type.toLowerCase()
      ? speciesField
      : /^(cow|bull|heifer|steer)$/i.test(type)
        ? "Cattle"
        : "";
  const health = fieldValue([
    "healthstatus",
    "animalhealthstatus",
    "currenthealthstatus",
    "healthcondition",
    "animalhealth",
    "currenthealth",
    "health",
  ]);
  const tag = findAnimalTag(rows);
  const identity = [species, type, tag].filter(Boolean).join(" · ");
  const subject = [animal.name, identity && `(${identity})`]
    .filter(Boolean)
    .join(" ");
  const visit = farmName ? `Health check at ${farmName}` : "Health check";
  const tagline = `${visit}${subject ? ` — ${subject}` : ""}${health ? ` | ${health}` : ""}`;
  const captionIdentity = [
    species && `Species: ${species}`,
    type && `Animal Type: ${type}`,
    tag && `Tag: ${tag}`,
  ]
    .filter(Boolean)
    .join(", ");
  const captionSubject = `${animal.name || "the animal"}${captionIdentity ? ` (${captionIdentity})` : ""}`;
  const owner = ownerName?.trim();
  const captionLocation = farmName
    ? ` at ${farmName}${owner ? ` (owner: ${owner})` : ""}`
    : owner
      ? ` at ${owner}'s farm`
      : "";
  const healthStatus = health?.replace(/[.!?]+$/, "");
  const monitoring =
    "highlighting the importance of regular veterinary care and proactive livestock health monitoring.";
  const caption = [
    `A veterinary field visit was conducted${captionLocation} to assess the health of ${captionSubject}.`,
    healthStatus
      ? `The current health status is recorded as ${healthStatus}, ${monitoring}`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
  return {
    tagline: /[.!?]$/.test(tagline) ? tagline : `${tagline}.`,
    caption,
    farmLabel: [farmName, owner && `Owner: ${owner}`]
      .filter(Boolean)
      .join(" · "),
    summary: [
      animal.name,
      type && `Animal type: ${type}`,
      tag && `Tag: ${tag}`,
      health && `Health status: ${health}`,
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

const rewriteNoteLimit = 400;
const captionLimit = 1200;

function captionRewriteInput(caption: string) {
  if (caption.length <= rewriteNoteLimit)
    return { input: caption, remainder: "" };
  const boundary = caption.slice(0, rewriteNoteLimit + 1).search(/\s+\S*$/);
  const split = boundary > 0 ? boundary : rewriteNoteLimit;
  return {
    input: caption.slice(0, split).trimEnd(),
    remainder: caption.slice(split).trimStart(),
  };
}

function posterTagline(line: string): string {
  if (line.length <= 90) return line;
  const withoutPeriod = line.replace(/\.$/, "");
  if (withoutPeriod.length <= 90) return withoutPeriod;
  return `${line.slice(0, 89).trimEnd()}…`;
}

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
  const params = useLocalSearchParams<{
    farmId?: string;
    entryId?: string;
    postPhotos?: string;
  }>();
  const farmId = typeof params.farmId === "string" ? params.farmId : "";
  const entryId = typeof params.entryId === "string" ? params.entryId : "";
  const selectedPhotoParam =
    typeof params.postPhotos === "string" ? params.postPhotos : "";
  const photoLimit = selectedPhotoParam ? 2 : 4;
  const initializedPhotoSelection = useRef(false);
  const [farmName, setFarmName] = useState("");
  const [animalName, setAnimalName] = useState("");
  const [postDetails, setPostDetails] = useState({
    tagline: "",
    caption: "",
    farmLabel: "",
    summary: "",
  });
  const [species, setSpecies] = useState("");
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const [fileUrls, setFileUrls] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<SocialPost[]>([]);
  const [draftId, setDraftId] = useState("");
  const [postStatus, setPostStatus] = useState<SocialPostStatus | "">("");
  const [savedMark, setSavedMark] = useState("");
  const [savingAs, setSavingAs] = useState<SocialPostStatus | "">("");
  const [taglineEdit, setTagline] = useState<string>();
  const tagline = taglineEdit ?? postDetails.tagline;
  const [printedTagline, setPrintedTagline] = useState("");
  const [note, setNote] = useState("");
  const [posterUri, setPosterUri] = useState("");
  const [posterFileUrl, setPosterFileUrl] = useState("");
  const [postDate, setPostDate] = useState(todayLabel);
  const [captionEdit, setDescription] = useState<string>();
  const description = captionEdit ?? postDetails.caption;
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
      const owner = findFarmOwnerName(review);
      const details = animalPostDetails(animal, review.name, owner);
      setPostDetails(details);
      if (owner) {
        const previousCaption = animalPostDetails(animal, review.name).caption;
        setDescription((current) =>
          current === previousCaption ? details.caption : current,
        );
      }
      setSpecies(animal.species);
      if (selectedPhotoParam && !initializedPhotoSelection.current) {
        const available = new Set(
          animal.photos
            .flatMap((url) => [url, aiFarmImageUrl(url)])
            .filter(Boolean),
        );
        const selected = requestedPostPhotos(selectedPhotoParam).filter((url) =>
          available.has(url),
        );
        const previews = await Promise.all(
          selected.map(async (fileUrl) => ({
            fileUrl,
            uri: await readableFarmImage(fileUrl).catch(() => fileUrl),
          })),
        );
        initializedPhotoSelection.current = true;
        setPhotos(previews);
      }
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
  }, [entryId, farmId, selectedPhotoParam]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const posterDetails = [postDetails.farmLabel, postDetails.summary, postDate]
    .filter(Boolean)
    .join(" · ");

  async function addPhotos(source: "camera" | "library") {
    if (photos.length >= photoLimit) return;
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
              selectionLimit: photoLimit - photos.length,
            });
      if (result.canceled) return;
      const next = result.assets
        .filter((asset) => asset.uri)
        .slice(0, photoLimit - photos.length)
        .map((asset, index) => ({
          uri: asset.uri,
          fileName: photoFileName(asset, photos.length + index),
        }));
      setPhotos((current) => [...current, ...next].slice(0, photoLimit));
      setFileUrls([]);
      setDraftId("");
      setPostStatus("");
      setSavedMark("");
      setPosterUri("");
      setPosterFileUrl("");
      setPrintedTagline("");
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
    setPostDate(todayLabel());
  }

  async function prepare() {
    const line = tagline.trim();
    const caption = description.trim();
    if (!photos.length) {
      setError("Add at least one photo.");
      return;
    }
    if (!line) {
      setError("Add a tagline.");
      return;
    }
    if (!caption) {
      setError("Add a caption.");
      return;
    }
    setPreparing(true);
    setError(null);
    setNotice(null);
    try {
      const uploadOptions = photos.some((photo) => "fileName" in photo)
        ? await animalPhotoUploadOptions()
        : undefined;
      const sources: string[] = [];
      for (const photo of photos) {
        sources.push(
          "fileUrl" in photo
            ? photo.fileUrl
            : await uploadFarmImage(
                photo.uri,
                photo.fileName,
                farmId,
                species || "unknown",
                uploadOptions?.promptKey,
                uploadOptions?.generateThumbnail,
              ),
        );
      }
      const { input, remainder } = captionRewriteInput(caption);
      const post = await prepareFarmPost({
        fileUrls: sources,
        tagline: posterTagline(line),
        note: input,
        farmName,
        animalName,
        species,
        dateLabel: postDate,
        rewrite: true,
        description: caption,
      });
      setFileUrls(sources);
      setDraftId("");
      setPostStatus("");
      setSavedMark("");
      setTagline(post.tagline);
      setPrintedTagline(post.tagline);
      setPosterFileUrl(post.posterUrl);
      setPosterUri(await readableFarmImage(post.posterUrl));
      const rewritten = [post.description.trim(), remainder]
        .filter(Boolean)
        .join("\n\n");
      setDescription(rewritten.length <= captionLimit ? rewritten : caption);
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
      tagline: posterTagline(nextTagline),
      note: note.trim(),
      farmName,
      animalName,
      species,
      dateLabel: postDate,
      rewrite: false,
      description: caption,
    });
    const readable = await readableFarmImage(post.posterUrl);
    setPrintedTagline(post.tagline);
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
      tagline: posterTagline(line),
      printedTagline: printed || posterTagline(line),
      note: note.trim(),
      description: caption,
      posterUrl: poster,
      fileUrls,
      status,
    });
    setDraftId(saved.postId);
    setPosterFileUrl(saved.posterUrl);
    setPostStatus(saved.status);
    setSavedMark(contentMark(line, saved.description, saved.note));
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
      if (line && posterTagline(line) !== printedTagline && fileUrls.length) {
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
        await persist("shared", fileUrl, posterTagline(line));
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
  const taglineChanged = posterTagline(tagline.trim()) !== printedTagline;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <FormScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <FlowPageHeading onBack={() => router.back()} title="Prepare post" />
        <Text style={styles.help}>
          {ready
            ? shownStatus === "ready"
              ? "This post is ready to share."
              : shownStatus === "draft"
                ? "This post is a draft. Mark it ready when the wording is set."
                : "Save a draft or mark it ready to share."
            : "Review and edit the tagline and caption before preparing the post."}
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
                <Text style={styles.bandDetail}>
                  {posterDetails || "Farm details"}
                </Text>
              </View>
            </View>
            <Text style={styles.label}>Tagline</Text>
            <TextInput
              accessibilityLabel="Tagline on the photo"
              value={tagline}
              onChangeText={setTagline}
              placeholder="Edit the tagline"
              placeholderTextColor={colors.muted}
              maxLength={240}
              multiline
              style={[styles.input, styles.taglineInput]}
            />
            {taglineChanged ? (
              <Text style={styles.notice}>
                The new tagline is printed on the photo when you share.
              </Text>
            ) : null}
            <Text style={styles.label}>Caption</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              maxLength={captionLimit}
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
              {photos.length < photoLimit ? (
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
              placeholder="Enter a tagline"
              placeholderTextColor={colors.muted}
              maxLength={240}
              multiline
              style={[styles.input, styles.taglineInput]}
            />
            <Text style={styles.label}>Caption</Text>
            <TextInput
              accessibilityLabel="Caption"
              value={description}
              onChangeText={setDescription}
              placeholder="Enter a caption"
              placeholderTextColor={colors.muted}
              maxLength={captionLimit}
              multiline
              style={[styles.input, styles.captionInput]}
            />
            <View style={styles.card}>
              <Text style={styles.label}>Prompt</Text>
              <Text style={styles.placeholder}>Facebook post</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.label}>Printed on the photo</Text>
              <Text style={styles.placeholder}>
                {posterDetails || "Farm details"}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={
                preparing || loading || !tagline.trim() || !description.trim()
              }
              onPress={() => void prepare()}
              style={[
                styles.primary,
                (!tagline.trim() || !description.trim()) &&
                  styles.primaryDisabled,
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
      </FormScrollView>
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
  taglineInput: { minHeight: 96, lineHeight: 22, textAlignVertical: "top" },
  captionInput: { minHeight: 144, textAlignVertical: "top" },
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
  bandDetail: { color: colors.green, fontSize: 13, fontWeight: "600" },
});
