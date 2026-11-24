import { FormScrollView } from "../components/ui/FormScrollView";
import { CollapseSection } from "../features/farm-vitals/collapse-section";
import { FarmSectionEditor } from "../features/farm-vitals/section-editor";
import {
  recordPhotoUrls,
  RecordPhoto,
  waitForAiFarmImage,
} from "../features/farm-vitals/record-photo";
import { FlowPageHeading } from "../features/farm-vitals/flow-page-heading";
import { HeaderBackground } from "../features/farm-vitals/header-background";
import {
  AdditionalFlowButton,
  farmButton,
  farmCard,
  findAnimalTag,
  formatFarmDate,
} from "../features/farm-vitals/presentation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import Feather from "@expo/vector-icons/Feather";
import { SpeciesIcon } from "../components/SpeciesIcon";
import {
  addAnimalPhotos,
  aiFarmImageUrl,
  animalPhotoUploadOptions,
  getFarmReview,
  listAdditionalFlows,
  readableFarmImage,
  removeAnimalPhoto,
  uploadFarmImage,
  type FarmAnimalReview,
  type AdditionalFlow,
  type FarmHistoryReview,
  type FarmReviewRow,
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

function provided(row: FarmReviewRow): boolean {
  return row.value !== "Not provided";
}

function isIdentity(label: string): boolean {
  return /name|tag|animal id|^id$|animal type|species/i.test(label);
}

function isHighlight(label: string): boolean {
  return /gender|health|purpose|breed/i.test(label);
}

function chipTone(value: string): { background: string; color: string } {
  const text = value.trim().toLowerCase();
  if (text === "sick") return { background: "#FDECEC", color: "#B42318" };
  if (text === "pregnant") return { background: "#FFF4E5", color: "#B45309" };
  if (text === "healthy") return { background: colors.mint, color: "#166534" };
  return { background: "#F3F6F1", color: colors.ink };
}

function photoFileName(asset: ImagePicker.ImagePickerAsset): string {
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

function DetailRows({ rows }: { rows: FarmReviewRow[] }) {
  return (
    <>
      {rows.map((row, index) => (
        <View
          key={`${row.label}-${index}`}
          style={[styles.fact, index > 0 && styles.factDivider]}
        >
          <Text style={styles.factLabel}>{row.label}</Text>
          <Text style={styles.factValue}>{row.value}</Text>
        </View>
      ))}
    </>
  );
}

function HistoryList({
  title,
  records,
  onAdd,
  onBrowse,
  onOpen,
  onOpenPhoto,
  compactRecord = false,
}: {
  title: string;
  records: FarmHistoryReview[];
  onAdd: () => void;
  onBrowse?: () => void;
  onOpen: (entryId: string) => void;
  onOpenPhoto: (record: FarmHistoryReview) => void;
  compactRecord?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const singleRecord =
    compactRecord && records.length === 1 ? records[0] : null;
  return (
    <View style={styles.card}>
      <View style={styles.sectionHeader}>
        {singleRecord ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${title}: ${singleRecord.name}`}
            onPress={() => onOpen(singleRecord.entryId)}
            style={styles.sectionToggle}
          >
            <Text style={[styles.historyTitle, styles.historyLabel]}>
              {title}
            </Text>
            <Text numberOfLines={1} style={styles.historyValue}>
              {singleRecord.name}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityState={onBrowse ? undefined : { expanded: open }}
            onPress={onBrowse ?? (() => setOpen((current) => !current))}
            style={styles.sectionToggle}
          >
            <Text style={styles.historyTitle}>{title}</Text>
            {!onBrowse || records.length ? (
              <Text style={styles.count}>{records.length}</Text>
            ) : null}
            <Feather
              name={
                onBrowse
                  ? "chevron-right"
                  : open
                    ? "chevron-up"
                    : "chevron-down"
              }
              size={16}
              color={colors.green}
            />
          </Pressable>
        )}
        {compactRecord && records.length ? null : (
          <AdditionalFlowButton label={title} onPress={onAdd} />
        )}
      </View>
      {open ? (
        records.length ? (
          records.map((record) => {
            const photo = recordPhotoUrls(record.sections)[0];
            return (
              <Pressable
                key={record.entryId}
                accessibilityRole="button"
                accessibilityLabel={
                  photo
                    ? `Edit ${record.name} and view photo versions`
                    : `Open ${record.name}`
                }
                onPress={() =>
                  photo ? onOpenPhoto(record) : onOpen(record.entryId)
                }
                style={styles.historyRow}
              >
                {photo && (
                  <RecordPhoto
                    key={photo}
                    url={photo}
                    label={record.name}
                    fallbackText={record.name.slice(0, 1).toUpperCase()}
                  />
                )}
                <View style={styles.historyCopy}>
                  <Text numberOfLines={1} style={styles.historyName}>
                    {record.name}
                  </Text>
                  {formatFarmDate(record.submittedAt) ? (
                    <Text style={styles.help}>
                      {formatFarmDate(record.submittedAt)}
                    </Text>
                  ) : null}
                </View>
                <Feather name="chevron-right" size={18} color={colors.green} />
              </Pressable>
            );
          })
        ) : (
          <Text style={styles.empty}>None yet.</Text>
        )
      ) : null}
    </View>
  );
}

export default function FarmAnimalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ farmId?: string; entryId?: string }>();
  const farmId = typeof params.farmId === "string" ? params.farmId : "";
  const entryId = typeof params.entryId === "string" ? params.entryId : "";
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);
  const [animal, setAnimal] = useState<FarmAnimalReview | null>(null);
  const [flows, setFlows] = useState<AdditionalFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [postPhotos, setPostPhotos] = useState<string[]>([]);
  const [addingPhotos, setAddingPhotos] = useState(false);
  const [removingPhoto, setRemovingPhoto] = useState<string | null>(null);
  const photoChangePending = useRef(false);
  const photoActionsDisabled =
    addingPhotos || removingPhoto !== null || editingDetails;
  const [photoPairs, setPhotoPairs] = useState<
    { url: string; original: string; enhanced: string; index: number }[]
  >([]);
  const [missingAi, setMissingAi] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (quiet = false) => {
      if (!farmId || !entryId) {
        setLoading(false);
        setError("Open this animal from its farm.");
        return;
      }
      if (!quiet) setLoading(true);
      setError(null);
      try {
        const [review, types] = await Promise.all([
          getFarmReview(farmId),
          listAdditionalFlows("animal"),
        ]);
        const match = review.animals.find((item) => item.entryId === entryId);
        if (!match) throw new Error("This animal is no longer on the farm.");
        setAnimal(match);
        setFlows(types);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "This animal could not be opened.",
        );
      } finally {
        setLoading(false);
      }
    },
    [entryId, farmId],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    const stored = animal?.photos ?? [];
    let cancelled = false;
    setPhotoPairs([]);
    setMissingAi({});
    void Promise.all(
      stored.map(async (url, index) => {
        const original = await readableFarmImage(url).catch(() => "");
        return { url, original, enhanced: "", index };
      }),
    ).then((pairs) => {
      if (cancelled) return;
      setPhotoPairs(pairs);
      for (const { url, index } of pairs) {
        void waitForAiFarmImage(url, () => !cancelled).then((enhanced) => {
          if (!enhanced || cancelled) return;
          setPhotoPairs((current) =>
            current.map((pair) =>
              pair.index === index ? { ...pair, enhanced } : pair,
            ),
          );
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [animal]);

  const rows = animal?.sections.flatMap((section) => section.rows) ?? [];
  const tag = findAnimalTag(rows);
  const highlights = rows.filter(
    (row) => provided(row) && isHighlight(row.label),
  );
  const facts = rows.filter(
    (row) =>
      provided(row) &&
      !isIdentity(row.label) &&
      !isHighlight(row.label) &&
      !/photo|image/i.test(row.label),
  );

  const avatarPhoto = photoPairs.find((pair) => pair.original || pair.enhanced);
  const avatarAi =
    avatarPhoto?.enhanced && !missingAi[avatarPhoto.enhanced]
      ? avatarPhoto.enhanced
      : undefined;
  const detailRows = rows.filter(
    (row) => provided(row) && !/photo|image/i.test(row.label),
  );

  function openPhotos(index: number) {
    if (!animal) return;
    router.push({
      pathname: "/farm-photos",
      params: { farmId, entryId: animal.entryId, index: String(index) },
    });
  }

  function openGallery(gallery: "original" | "ai") {
    router.push({
      pathname: "/farm-photos",
      params: { farmId, entryId, gallery },
    });
  }

  function postPhotoCheckbox(url: string, label: string, ai = false) {
    const selected = postPhotos.includes(url);
    const disabled = !selected && postPhotos.length >= 2;
    return (
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={label}
        accessibilityState={{ checked: selected, disabled }}
        disabled={disabled}
        hitSlop={6}
        onPress={() =>
          setPostPhotos((current) =>
            current.includes(url)
              ? current.filter((photo) => photo !== url)
              : current.length < 2
                ? [...current, url]
                : current,
          )
        }
        style={[
          styles.postPhotoCheckbox,
          ai ? styles.aiPostPhotoCheckbox : styles.originalPostPhotoCheckbox,
          selected && styles.postPhotoChecked,
          disabled && styles.removePhotoDisabled,
        ]}
      >
        {selected ? (
          <Feather name="check" size={16} color={colors.surface} />
        ) : null}
      </Pressable>
    );
  }

  async function addPhotos() {
    if (!animal || editingDetails || photoChangePending.current) return;
    photoChangePending.current = true;
    setAddingPhotos(true);
    setError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 8,
      });
      if (result.canceled || !result.assets.length) return;
      const { promptKey, generateThumbnail } = await animalPhotoUploadOptions();
      const urls: string[] = [];
      for (const asset of result.assets) {
        if (!asset.uri) continue;
        urls.push(
          await uploadFarmImage(
            asset.uri,
            photoFileName(asset),
            farmId,
            animal.species || "unknown",
            promptKey,
            generateThumbnail,
          ),
        );
      }
      await addAnimalPhotos(farmId, animal.entryId, urls);
      await load(true);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The photos could not be added.",
      );
    } finally {
      photoChangePending.current = false;
      setAddingPhotos(false);
    }
  }
  function confirmRemovePhoto(url: string) {
    if (!animal || photoActionsDisabled) return;
    const animalEntryId = animal.entryId;

    async function remove() {
      if (photoChangePending.current) return;
      photoChangePending.current = true;
      setRemovingPhoto(url);
      setError(null);
      try {
        const photos = await removeAnimalPhoto(farmId, animalEntryId, url);
        setPostPhotos((current) =>
          current.filter(
            (photo) => photo !== url && photo !== aiFarmImageUrl(url),
          ),
        );
        setAnimal((current) =>
          current?.entryId === animalEntryId ? { ...current, photos } : current,
        );
        await load(true);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "The photo could not be removed.",
        );
      } finally {
        photoChangePending.current = false;
        setRemovingPhoto(null);
      }
    }

    const message = "Remove this photo and its versions from the animal?";
    if (Platform.OS === "web") {
      const browser = globalThis as typeof globalThis & {
        confirm: (message: string) => boolean;
      };
      if (browser.confirm(message)) void remove();
      return;
    }
    Alert.alert("Remove photo?", message, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => void remove() },
    ]);
  }

  const added = animal ? formatFarmDate(animal.submittedAt) : "";
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <FormScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load(true).finally(() => setRefreshing(false));
            }}
          />
        }
      >
        <FlowPageHeading onBack={() => router.back()} title="Animal details" />
        {loading ? (
          <View style={styles.status}>
            <ActivityIndicator color={colors.green} />
            <Text style={styles.help}>Opening animal…</Text>
          </View>
        ) : null}
        {error ? (
          <View style={styles.status}>
            <Text style={styles.error}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={() => void load()}>
              <Text style={styles.retry}>Retry</Text>
            </Pressable>
          </View>
        ) : null}
        {animal ? (
          <>
            <HeaderBackground
              imageUrl={animal.headerBackgroundImageUrl}
              style={styles.identity}
            >
              <View style={styles.avatar}>
                {avatarPhoto ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${animal.name} photos`}
                    onPress={() => openPhotos(avatarPhoto.index * 2)}
                  >
                    <Image
                      source={{ uri: avatarAi || avatarPhoto.original }}
                      style={styles.avatarImage}
                      accessibilityLabel={`${animal.name} photo`}
                      onError={() => {
                        if (avatarAi)
                          setMissingAi((current) => ({
                            ...current,
                            [avatarAi]: true,
                          }));
                      }}
                    />
                  </Pressable>
                ) : animal.species ? (
                  <SpeciesIcon
                    species={animal.species}
                    size={64}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={styles.initial}>
                    {animal.name.slice(0, 1).toUpperCase()}
                  </Text>
                )}
              </View>
              <View style={styles.identityCopy}>
                <Text accessibilityRole="header" style={styles.name}>
                  {animal.name}
                </Text>
                <Text style={styles.meta}>
                  {[animal.species, tag].filter(Boolean).join(" · ") ||
                    "Animal"}
                </Text>
                {added ? <Text style={styles.help}>Added {added}</Text> : null}
              </View>
            </HeaderBackground>
            <Pressable
              accessibilityRole="button"
              disabled={photoActionsDisabled}
              onPress={() => void addPhotos()}
              style={styles.photoButton}
            >
              {addingPhotos ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="camera" size={16} color="#FFFFFF" />
                  <Text style={styles.actionText}>Add photos</Text>
                </>
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={addingPhotos || removingPhoto !== null}
              onPress={() =>
                router.push({
                  pathname: "/farm-post",
                  params: {
                    farmId,
                    entryId: animal.entryId,
                    ...(postPhotos.length
                      ? { postPhotos: JSON.stringify(postPhotos) }
                      : {}),
                  },
                })
              }
              style={styles.postButton}
            >
              <Feather name="share-2" size={16} color={colors.green} />
              <Text style={styles.postText}>
                {postPhotos.length
                  ? `Prepare post (${postPhotos.length})`
                  : "Prepare post"}
              </Text>
            </Pressable>
            {animal.photos.length ? (
              <View style={styles.photos}>
                <View style={styles.photosHeader}>
                  <Text style={styles.photosTitle}>Photos</Text>
                  <Text style={styles.count}>{animal.photos.length}</Text>
                </View>
                <View style={styles.galleryTabs}>
                  {(["original", "ai"] as const).map((gallery) => (
                    <Pressable
                      key={gallery}
                      accessibilityRole="button"
                      onPress={() => openGallery(gallery)}
                      style={styles.galleryTab}
                    >
                      <Feather
                        name={gallery === "original" ? "image" : "zap"}
                        size={16}
                        color={colors.green}
                      />
                      <Text style={styles.galleryTabLabel}>
                        {gallery === "original"
                          ? "Original Gallery"
                          : "AI Gallery"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.help}>
                  Select up to 2 photos for your post ({postPhotos.length}/2).
                </Text>
                {photoPairs.map((pair, photoIndex) => (
                  <View
                    key={`${pair.url}-${pair.index}`}
                    style={styles.photoCard}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Open original photo ${photoIndex + 1}`}
                      onPress={() => openPhotos(pair.index * 2)}
                      style={styles.photoCell}
                    >
                      {pair.original ? (
                        <Image
                          source={{ uri: pair.original }}
                          style={styles.photo}
                          accessibilityLabel="Original animal photo"
                        />
                      ) : (
                        <View style={[styles.photo, styles.photoPending]}>
                          <Text style={styles.photoPendingText}>
                            Photo unavailable
                          </Text>
                        </View>
                      )}
                      <View style={styles.photoBadge}>
                        <Text style={styles.photoBadgeText}>Original</Text>
                      </View>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Open AI photo ${photoIndex + 1}`}
                      onPress={() => openPhotos(pair.index * 2 + 1)}
                      style={styles.photoCell}
                    >
                      {pair.enhanced && !missingAi[pair.enhanced] ? (
                        <Image
                          source={{ uri: pair.enhanced }}
                          style={styles.photo}
                          accessibilityLabel="AI animal photo"
                          onError={() =>
                            setMissingAi((current) => ({
                              ...current,
                              [pair.enhanced]: true,
                            }))
                          }
                        />
                      ) : (
                        <View style={[styles.photo, styles.photoPending]}>
                          <Feather
                            name="image"
                            size={18}
                            color={colors.muted}
                          />
                          <Text style={styles.photoPendingText}>
                            No AI photo
                          </Text>
                        </View>
                      )}
                      <View style={styles.photoBadge}>
                        <Text style={styles.photoBadgeText}>AI</Text>
                      </View>
                    </Pressable>
                    {pair.original || postPhotos.includes(pair.url)
                      ? postPhotoCheckbox(
                          pair.url,
                          `Select original photo ${photoIndex + 1} for post`,
                        )
                      : null}
                    {pair.enhanced && !missingAi[pair.enhanced]
                      ? postPhotoCheckbox(
                          aiFarmImageUrl(pair.url),
                          `Select AI photo ${photoIndex + 1} for post`,
                          true,
                        )
                      : null}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove photo ${photoIndex + 1} and its AI version`}
                      accessibilityState={{ busy: removingPhoto === pair.url }}
                      disabled={photoActionsDisabled}
                      hitSlop={9}
                      onPress={() => confirmRemovePhoto(pair.url)}
                      style={[
                        styles.removePhotoButton,
                        photoActionsDisabled &&
                          removingPhoto !== pair.url &&
                          styles.removePhotoDisabled,
                      ]}
                    >
                      {removingPhoto === pair.url ? (
                        <ActivityIndicator size="small" color={colors.danger} />
                      ) : (
                        <Feather name="x" size={16} color={colors.danger} />
                      )}
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
            {highlights.length ? (
              <View style={styles.chips}>
                {highlights.map((row) => {
                  const tone = chipTone(row.value);
                  return (
                    <View
                      key={row.label}
                      style={[
                        styles.chip,
                        { backgroundColor: tone.background },
                      ]}
                    >
                      <Text style={styles.chipLabel}>{row.label}</Text>
                      <Text style={[styles.chipValue, { color: tone.color }]}>
                        {row.value}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : null}
            {facts.length ? (
              <View style={styles.card}>
                <DetailRows rows={facts} />
              </View>
            ) : null}
            <CollapseSection
              title="Animal details"
              count={detailRows.length}
              expanded={editingDetails || detailsOpen}
              onToggle={() => {
                if (!editingDetails) setDetailsOpen((current) => !current);
              }}
              onEdit={animal.edit ? () => setEditingDetails(true) : undefined}
              editDisabled={photoActionsDisabled}
            >
              {editingDetails && animal.edit ? (
                <FarmSectionEditor
                  farmId={farmId}
                  animalEntryId={animal.entryId}
                  draft={animal.edit}
                  fields={animal.edit.fields}
                  onCancel={() => setEditingDetails(false)}
                  onSaved={async () => {
                    setEditingDetails(false);
                    await load(true);
                  }}
                />
              ) : detailRows.length ? (
                <DetailRows rows={detailRows} />
              ) : (
                <Text style={styles.empty}>No details recorded.</Text>
              )}
            </CollapseSection>
            {flows.map((type) => (
              <HistoryList
                key={type.key}
                title={type.label}
                records={animal.records.filter(
                  (record) => record.kind === type.key,
                )}
                compactRecord={type.key === "breed"}
                onAdd={() => {
                  const params = {
                    farmId,
                    animalEntryId: animal.entryId,
                    flowLabel: type.label,
                  };
                  if (type.key === "health-case") {
                    router.push({ pathname: "/health-case", params });
                  } else {
                    router.push({
                      pathname: "/add-farm-history",
                      params: {
                        ...params,
                        kind: type.key,
                        species: animal.species,
                      },
                    });
                  }
                }}
                onBrowse={
                  type.key === "medical-history"
                    ? () => {
                        const records = animal.records.filter(
                          (record) => record.kind === type.key,
                        );
                        router.push({
                          pathname: "/farm-history",
                          params:
                            records.length === 1
                              ? { farmId, entryId: records[0].entryId }
                              : {
                                  farmId,
                                  animalEntryId: animal.entryId,
                                  kind: type.key,
                                  title: type.label,
                                },
                        });
                      }
                    : type.key === "health-case"
                      ? () =>
                          router.push({
                            pathname: "/animal-case-dashboard",
                            params: { farmId, animalEntryId: animal.entryId },
                          })
                      : undefined
                }
                onOpenPhoto={(history) =>
                  router.push({
                    pathname: "/add-farm-history",
                    params: {
                      farmId,
                      entryId: history.entryId,
                      kind: history.kind,
                    },
                  })
                }
                onOpen={(historyId) =>
                  router.push({
                    pathname: "/farm-history",
                    params: { farmId, entryId: historyId },
                  })
                }
              />
            ))}
          </>
        ) : null}
      </FormScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 20, paddingBottom: 36, gap: 16 },
  status: { gap: 8 },
  help: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 13 },
  retry: { color: colors.green, fontWeight: "700" },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    ...farmCard,
    padding: 14,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.mint,
  },
  avatarImage: { width: 72, height: 72 },
  identityCopy: { flex: 1, gap: 2 },
  initial: { color: colors.green, fontSize: 28, fontWeight: "800" },
  name: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  meta: { color: colors.ink, fontSize: 15, fontWeight: "600" },
  actionText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  photoButton: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    ...farmButton,
  },
  postButton: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    ...farmButton,
  },
  postText: { color: colors.green, fontSize: 13, fontWeight: "700" },
  photos: { gap: 10 },
  photosHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  photosTitle: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  galleryTabs: { flexDirection: "row", gap: 8 },
  galleryTab: {
    ...farmButton,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: colors.mint,
  },
  galleryTabLabel: { color: colors.green, fontSize: 13, fontWeight: "700" },
  photoCard: {
    flexDirection: "row",
    gap: 8,
    padding: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  postPhotoCheckbox: {
    position: "absolute",
    top: 12,
    width: 24,
    height: 24,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.green,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  originalPostPhotoCheckbox: { left: 12 },
  aiPostPhotoCheckbox: { right: 12 },
  postPhotoChecked: { backgroundColor: colors.green },
  removePhotoButton: {
    position: "absolute",
    top: 12,
    left: "50%",
    transform: [{ translateX: -12 }],
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "#9BAEA3",
  },
  removePhotoDisabled: { opacity: 0.5 },
  photoCell: { flex: 1, borderRadius: 12, overflow: "hidden" },
  photo: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: colors.mint,
  },
  photoBadge: {
    position: "absolute",
    left: 8,
    bottom: 8,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: "rgba(23, 61, 50, 0.78)",
  },
  photoBadgeText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },
  photoPending: { alignItems: "center", justifyContent: "center", gap: 4 },
  photoPendingText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 14,
    paddingRight: 10,
    paddingVertical: 8,
  },
  sectionToggle: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 36,
  },
  count: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  empty: {
    color: colors.muted,
    fontSize: 13,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  historyTitle: { flex: 1, color: colors.ink, fontSize: 16, fontWeight: "800" },
  historyLabel: { flex: 0 },
  historyValue: {
    flex: 1,
    color: colors.green,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "right",
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...farmCard,
  },
  historyCopy: { flex: 1, gap: 2 },
  historyName: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 1,
  },
  chipLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  chipValue: { fontSize: 14, fontWeight: "700" },
  card: {
    ...farmCard,
  },
  fact: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  factDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  factLabel: { flex: 1, color: colors.muted, fontSize: 13, fontWeight: "600" },
  factValue: {
    flex: 1,
    color: colors.ink,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "right",
  },
});
