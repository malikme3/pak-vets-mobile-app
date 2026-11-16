import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
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
  getFarmReview,
  listFormTypes,
  readableFarmImage,
  uploadFarmImage,
  childFormTypes,
  type FarmAnimalReview,
  type FarmFormType,
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

function when(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

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

function HistoryList({
  title,
  records,
  onAdd,
  onOpen,
}: {
  title: string;
  records: FarmHistoryReview[];
  onAdd: () => void;
  onOpen: (entryId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.card}>
      <View style={styles.sectionHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen((current) => !current)}
          style={styles.sectionToggle}
        >
          <Text style={styles.historyTitle}>{title}</Text>
          <Text style={styles.count}>{records.length}</Text>
          <Feather
            name={open ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.green}
          />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Add ${title}`}
          onPress={onAdd}
          style={styles.addIcon}
        >
          <Feather name="plus" size={16} color="#FFFFFF" />
        </Pressable>
      </View>
      {open
        ? records.length
          ? records.map((record) => (
              <Pressable
                key={record.entryId}
                accessibilityRole="button"
                accessibilityLabel={`Open ${record.name}`}
                onPress={() => onOpen(record.entryId)}
                style={styles.historyRow}
              >
                <View style={styles.historyCopy}>
                  <Text numberOfLines={1} style={styles.historyName}>
                    {record.name}
                  </Text>
                  {when(record.submittedAt) ? (
                    <Text style={styles.help}>{when(record.submittedAt)}</Text>
                  ) : null}
                </View>
                <Feather name="chevron-right" size={18} color={colors.green} />
              </Pressable>
            ))
          : (
            <Text style={styles.empty}>None yet.</Text>
          )
        : null}
    </View>
  );
}

export default function FarmAnimalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ farmId?: string; entryId?: string }>();
  const farmId = typeof params.farmId === "string" ? params.farmId : "";
  const entryId = typeof params.entryId === "string" ? params.entryId : "";
  const [animal, setAnimal] = useState<FarmAnimalReview | null>(null);
  const [formTypes, setFormTypes] = useState<FarmFormType[]>([]);
  const [farmName, setFarmName] = useState("Farm");
  const [loading, setLoading] = useState(true);
  const [addingPhotos, setAddingPhotos] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (quiet = false) => {
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
        listFormTypes(),
      ]);
      const match = review.animals.find((item) => item.entryId === entryId);
      if (!match) throw new Error("This animal is no longer on the farm.");
      setFarmName(review.name);
      setAnimal(match);
      setFormTypes(types);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "This animal could not be opened.",
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

  useEffect(() => {
    const stored = animal?.photos ?? [];
    if (!stored.length) {
      setPhotoUrls([]);
      return;
    }
    let cancelled = false;
    void Promise.all(
      stored.map((url) => readableFarmImage(url).catch(() => "")),
    ).then((urls) => {
      if (!cancelled) setPhotoUrls(urls.filter((url) => url.startsWith("http")));
    });
    return () => {
      cancelled = true;
    };
  }, [animal]);

  const rows = animal?.sections.flatMap((section) => section.rows) ?? [];
  const tag = rows.find(
    (row) => provided(row) && /tag|animal id|^id$/i.test(row.label),
  );
  const highlights = rows.filter((row) => provided(row) && isHighlight(row.label));
  const facts = rows.filter(
    (row) =>
      provided(row) &&
      !isIdentity(row.label) &&
      !isHighlight(row.label) &&
      !/photo|image/i.test(row.label),
  );

  function openPhotos(index: number) {
    if (!animal) return;
    router.push({
      pathname: "/farm-photos",
      params: { farmId, entryId: animal.entryId, index: String(index) },
    });
  }

  async function addPhotos() {
    if (!animal || addingPhotos) return;
    setError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 8,
      });
      if (result.canceled || !result.assets.length) return;
      setAddingPhotos(true);
      const urls: string[] = [];
      for (const asset of result.assets) {
        if (!asset.uri) continue;
        urls.push(
          await uploadFarmImage(
            asset.uri,
            photoFileName(asset),
            farmId,
            animal.species || "unknown",
          ),
        );
      }
      await addAnimalPhotos(farmId, animal.entryId, urls);
      await load(true);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "The photos could not be added.",
      );
    } finally {
      setAddingPhotos(false);
    }
  }
  const added = animal ? when(animal.submittedAt) : "";
  const childSections = childFormTypes(
    formTypes,
    "animal",
    animal?.records.map((record) => record.kind) ?? [],
  );

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
          <Text style={styles.backText}>{farmName}</Text>
        </Pressable>
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
            <View style={styles.identity}>
              <View style={styles.avatar}>
                {photoUrls[0] ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${animal.name} photos`}
                    onPress={() => openPhotos(0)}
                  >
                    <Image
                      source={{ uri: photoUrls[0] }}
                      style={styles.avatarImage}
                      accessibilityLabel={`${animal.name} photo`}
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
                  {[animal.species, tag?.value].filter(Boolean).join(" · ") ||
                    "Animal"}
                </Text>
                {added ? <Text style={styles.help}>Added {added}</Text> : null}
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={addingPhotos}
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
            {photoUrls.length ? (
              <View style={styles.photos}>
                {photoUrls.map((photo, photoIndex) => (
                  <Pressable
                    key={photo}
                    accessibilityRole="button"
                    accessibilityLabel={`Open photo ${photoIndex + 1}`}
                    onPress={() => openPhotos(photoIndex)}
                  >
                    <Image
                      source={{ uri: photo }}
                      style={styles.photo}
                      accessibilityLabel="Animal photo"
                    />
                  </Pressable>
                ))}
              </View>
            ) : animal.photos.length ? (
              <Text style={styles.help}>Photos could not be opened.</Text>
            ) : null}
            {highlights.length ? (
              <View style={styles.chips}>
                {highlights.map((row) => {
                  const tone = chipTone(row.value);
                  return (
                    <View
                      key={row.label}
                      style={[styles.chip, { backgroundColor: tone.background }]}
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
                {facts.map((row, index) => (
                  <View
                    key={`${row.label}-${index}`}
                    style={[styles.fact, index > 0 && styles.factDivider]}
                  >
                    <Text style={styles.factLabel}>{row.label}</Text>
                    <Text style={styles.factValue}>{row.value}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {childSections.map((type) => (
              <HistoryList
                key={type.key}
                title={type.label}
                records={animal.records.filter((record) => record.kind === type.key)}
                onAdd={() =>
                  router.push({
                    pathname: "/add-farm-history",
                    params: {
                      farmId,
                      animalEntryId: animal.entryId,
                      kind: type.key,
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 20, paddingBottom: 36, gap: 16 },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    minHeight: 36,
  },
  backText: { color: colors.green, fontSize: 15, fontWeight: "700" },
  status: { gap: 8 },
  help: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 13 },
  retry: { color: colors.green, fontWeight: "700" },
  identity: { flexDirection: "row", alignItems: "center", gap: 14 },
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
  name: { color: colors.ink, fontSize: 28, fontWeight: "800", letterSpacing: -0.4 },
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
  },
  photos: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  photo: {
    width: 84,
    height: 84,
    borderRadius: 12,
    backgroundColor: colors.mint,
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
  addIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.green,
  },
  count: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  empty: {
    color: colors.muted,
    fontSize: 13,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  historyTitle: { flex: 1, color: colors.ink, fontSize: 16, fontWeight: "800" },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
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
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
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
