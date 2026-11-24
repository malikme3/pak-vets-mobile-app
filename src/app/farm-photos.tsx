import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import { getFarmReview } from "../services/farmVitalsApi";
import {
  loadPhotoVersions,
  photoSides,
  recordPhotoUrls,
  waitForAiFarmImage,
  type PhotoSide,
  type PhotoVersions,
} from "../features/farm-vitals/record-photo";

const colors = { ink: "#173D32", mint: "#E7F5EE" };

export default function FarmPhotosScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{
    farmId?: string;
    entryId?: string;
    index?: string;
  }>();
  const farmId = typeof params.farmId === "string" ? params.farmId : "";
  const entryId = typeof params.entryId === "string" ? params.entryId : "";
  const requested = Number(params.index);
  const startPair = Number.isFinite(requested) ? Math.floor(requested / 2) : 0;
  const startSide: PhotoSide =
    Number.isFinite(requested) && requested % 2 === 1 ? "AI" : "Original";
  const [pairs, setPairs] = useState<PhotoVersions[]>([]);
  const [missing, setMissing] = useState<Record<string, boolean>>({});
  const [name, setName] = useState("Animal");
  const [index, setIndex] = useState(startPair);
  const [side, setSide] = useState<PhotoSide>(startSide);
  const [retryCount, setRetryCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<PhotoVersions>>(null);

  const load = useCallback(async (isActive: () => boolean) => {
    if (!farmId || !entryId) {
      setLoading(false);
      setError("Open photos from the farm or animal record.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const review = await getFarmReview(farmId);
      const animal = review.animals.find((item) => item.entryId === entryId);
      const record =
        review.records.find((item) => item.entryId === entryId) ??
        review.animals
          .flatMap((item) => item.records)
          .find((item) => item.entryId === entryId);
      if (!animal && !record)
        throw new Error("This record is no longer available.");
      const urls = animal?.photos ?? recordPhotoUrls(record?.sections);
      if (!urls.length) throw new Error("This record has no photos to show.");
      const signed = await Promise.all(urls.map(loadPhotoVersions));
      if (!isActive()) return;
      setName(animal?.name ?? record?.name ?? "Photos");
      setPairs(signed);
      setMissing({});
      setIndex(Math.min(Math.max(startPair, 0), signed.length - 1));
      setSide(startSide);
      signed.forEach((photo, photoIndex) => {
        if (photo.AI) return;
        void waitForAiFarmImage(urls[photoIndex], isActive).then((enhanced) => {
          if (!enhanced || !isActive()) return;
          setPairs((current) =>
            current.map((item, index) =>
              index === photoIndex ? { ...item, AI: enhanced } : item,
            ),
          );
        });
      });
    } catch (cause) {
      if (!isActive()) return;
      setError(
        cause instanceof Error
          ? cause.message
          : "These photos could not be opened.",
      );
    } finally {
      if (isActive()) setLoading(false);
    }
  }, [entryId, farmId, startPair, startSide]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void load(() => active);
      return () => {
        active = false;
      };
    }, [load, retryCount]),
  );

  function show(next: number) {
    const bounded = Math.min(Math.max(next, 0), pairs.length - 1);
    setIndex(bounded);
    listRef.current?.scrollToIndex({ index: bounded, animated: true });
  }

  function onScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    if (Number.isFinite(next)) setIndex(next);
  }

  const current = pairs[index];
  function versionUrl(photo: PhotoVersions, version: PhotoSide) {
    const url = photo[version];
    return url && !missing[url] ? url : undefined;
  }
  const selectedVersion =
    current && versionUrl(current, side) ? side : "Original";

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.top}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.back}
        >
          <Feather name="arrow-left" size={18} color="#FFFFFF" />
          <Text style={styles.backText} numberOfLines={1}>
            {name}
          </Text>
        </Pressable>
        {pairs.length ? (
          <Text style={styles.count}>
            {index + 1} of {pairs.length}
          </Text>
        ) : null}
      </View>
      {loading ? (
        <View style={styles.status}>
          <ActivityIndicator color="#FFFFFF" />
          <Text style={styles.help}>Opening photos…</Text>
        </View>
      ) : null}
      {error ? (
        <View style={styles.status}>
          <Text style={styles.error}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={() => setRetryCount((current) => current + 1)}>
            <Text style={styles.retry}>Retry</Text>
          </Pressable>
        </View>
      ) : null}
      {current ? (
        <>
          <FlatList
            ref={listRef}
            data={pairs}
            horizontal
            pagingEnabled
            initialScrollIndex={Math.min(index, pairs.length - 1)}
            getItemLayout={(_item, itemIndex) => ({
              length: width,
              offset: width * itemIndex,
              index: itemIndex,
            })}
            keyExtractor={(pair) => pair.Original}
            extraData={`${side}:${Object.keys(missing).length}`}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onScrollEnd}
            onScrollToIndexFailed={({ index: failed }) => {
              listRef.current?.scrollToOffset({
                offset: width * failed,
                animated: false,
              });
            }}
            renderItem={({ item }) => {
              const version = versionUrl(item, selectedVersion)
                ? selectedVersion
                : "Original";
              const url = versionUrl(item, version);
              return (
                <View style={[styles.slide, { width }]}>
                  {url ? (
                    <Image
                      source={{ uri: url }}
                      style={styles.hero}
                      resizeMode="contain"
                      accessibilityLabel={`${name} ${version} photo`}
                      onError={() =>
                        setMissing((currentMissing) => ({
                          ...currentMissing,
                          [url]: true,
                        }))
                      }
                    />
                  ) : (
                    <View style={styles.pending}>
                      <Feather name="image" size={22} color="#D7E4DC" />
                      <Text style={styles.help}>Photo unavailable.</Text>
                    </View>
                  )}
                </View>
              );
            }}
            style={styles.gallery}
          />
          <View style={styles.versions}>
            {photoSides.flatMap((version) => {
              const url = versionUrl(current, version);
              return url
                ? [
                    <VersionChoice
                      key={version}
                      label={version}
                      url={url}
                      selected={selectedVersion === version}
                      onPress={() => setSide(version)}
                    />,
                  ]
                : [];
            })}
          </View>
          <FlatList
            data={pairs}
            horizontal
            keyExtractor={(pair) => `thumb-${pair.Original}`}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.thumbs}
            renderItem={({ item, index: photoIndex }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Show photo ${photoIndex + 1}`}
                onPress={() => show(photoIndex)}
              >
                <Image
                  source={{
                    uri: versionUrl(item, "Thumbnail") ?? item.Original,
                  }}
                  style={[
                    styles.thumb,
                    photoIndex === index && styles.thumbActive,
                  ]}
                />
              </Pressable>
            )}
          />
        </>
      ) : null}
    </SafeAreaView>
  );
}

function VersionChoice({
  label,
  url,
  selected,
  onPress,
}: {
  label: string;
  url: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.version, selected && styles.versionOn]}
    >
      <Image source={{ uri: url }} style={styles.versionImage} />
      <Text style={[styles.versionLabel, selected && styles.versionLabelOn]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  back: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 36,
  },
  backText: { flex: 1, color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  count: { color: "#D7E4DC", fontSize: 13, fontWeight: "700" },
  status: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  help: { color: "#D7E4DC", fontSize: 13, textAlign: "center" },
  error: { color: "#F7C1BC", fontSize: 13, textAlign: "center" },
  retry: { color: "#FFFFFF", fontWeight: "700" },
  gallery: { flex: 1 },
  slide: { flex: 1, justifyContent: "center" },
  hero: { flex: 1, width: "100%" },
  pending: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 24,
  },
  versions: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  version: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    minHeight: 56,
    padding: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  versionOn: {
    borderColor: "#8DDCB4",
    backgroundColor: "rgba(141,220,180,0.16)",
  },
  versionImage: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.mint,
  },
  versionLabel: { color: "#D7E4DC", fontSize: 13, fontWeight: "700" },
  versionLabelOn: { color: "#FFFFFF" },
  thumbs: { gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: colors.mint,
    borderWidth: 2,
    borderColor: "transparent",
  },
  thumbActive: { borderColor: "#8DDCB4" },
});
