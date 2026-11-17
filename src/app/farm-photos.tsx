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
import {
  farmPhotoPairs,
  getFarmReview,
  readableFarmImage,
} from "../services/farmVitalsApi";

type PhotoPair = {
  original: string;
  enhanced: string;
};

type PhotoSide = "Original" | "AI";

const colors = {
  ink: "#173D32",
  muted: "#63766C",
  mint: "#E7F5EE",
};

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
  const [pairs, setPairs] = useState<PhotoPair[]>([]);
  const [missingAi, setMissingAi] = useState<Record<string, boolean>>({});
  const [name, setName] = useState("Animal");
  const [index, setIndex] = useState(startPair);
  const [side, setSide] = useState<PhotoSide>(startSide);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<PhotoPair>>(null);

  const load = useCallback(async () => {
    if (!farmId || !entryId) {
      setLoading(false);
      setError("Open photos from the animal.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const review = await getFarmReview(farmId);
      const animal = review.animals.find((item) => item.entryId === entryId);
      if (!animal) throw new Error("This animal is no longer on the farm.");
      const signed: PhotoPair[] = [];
      for (const pair of farmPhotoPairs(animal.photos)) {
        const [original, enhanced] = await Promise.all([
          readableFarmImage(pair.original).catch(() => ""),
          readableFarmImage(pair.enhanced).catch(() => ""),
        ]);
        if (!original.startsWith("http")) continue;
        signed.push({
          original,
          enhanced: enhanced.startsWith("http") ? enhanced : "",
        });
      }
      if (!signed.length) throw new Error("This animal has no photos to show.");
      setName(animal.name);
      setPairs(signed);
      setMissingAi({});
      setIndex(Math.min(Math.max(startPair, 0), signed.length - 1));
      setSide(startSide);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "These photos could not be opened.",
      );
    } finally {
      setLoading(false);
    }
  }, [entryId, farmId, startPair, startSide]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
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
          <Pressable accessibilityRole="button" onPress={() => void load()}>
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
            keyExtractor={(pair) => pair.original}
            extraData={`${side}:${Object.keys(missingAi).length}`}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onScrollEnd}
            onScrollToIndexFailed={({ index: failed }) => {
              listRef.current?.scrollToOffset({
                offset: width * failed,
                animated: false,
              });
            }}
            renderItem={({ item }) => {
              const url = side === "AI" ? item.enhanced : item.original;
              const unavailable = side === "AI" && (!url || missingAi[url]);
              return (
                <View style={[styles.slide, { width }]}>
                  {url && !unavailable ? (
                    <Image
                      source={{ uri: url }}
                      style={styles.hero}
                      resizeMode="contain"
                      accessibilityLabel={`${name} ${side} photo`}
                      onError={() => {
                        if (side !== "AI" || !url) return;
                        setMissingAi((currentMissing) => ({
                          ...currentMissing,
                          [url]: true,
                        }));
                      }}
                    />
                  ) : (
                    <View style={styles.pending}>
                      <Feather name="image" size={22} color="#D7E4DC" />
                      <Text style={styles.help}>No AI photo for this upload.</Text>
                    </View>
                  )}
                </View>
              );
            }}
            style={styles.gallery}
          />
          <View style={styles.versions}>
            <VersionChoice
              label="Original"
              url={current.original}
              selected={side === "Original"}
              onPress={() => setSide("Original")}
            />
            <VersionChoice
              label="AI"
              url={
                current.enhanced && !missingAi[current.enhanced]
                  ? current.enhanced
                  : ""
              }
              selected={side === "AI"}
              onPress={() => setSide("AI")}
            />
          </View>
          <FlatList
            data={pairs}
            horizontal
            keyExtractor={(pair) => `thumb-${pair.original}`}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.thumbs}
            renderItem={({ item, index: photoIndex }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Show photo ${photoIndex + 1}`}
                onPress={() => show(photoIndex)}
              >
                <Image
                  source={{ uri: item.original }}
                  style={[styles.thumb, photoIndex === index && styles.thumbActive]}
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
      {url ? (
        <Image source={{ uri: url }} style={styles.versionImage} />
      ) : (
        <View style={[styles.versionImage, styles.versionEmpty]}>
          <Feather name="image" size={16} color={colors.muted} />
        </View>
      )}
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
  pending: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 24 },
  versions: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  version: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 56,
    padding: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  versionOn: { borderColor: "#8DDCB4", backgroundColor: "rgba(141,220,180,0.16)" },
  versionImage: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.mint,
  },
  versionEmpty: { alignItems: "center", justifyContent: "center" },
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
