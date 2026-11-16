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
  getFarmReview,
  readableFarmImage,
} from "../services/farmVitalsApi";

const colors = {
  background: "#F8F8F2",
  ink: "#173D32",
  muted: "#63766C",
  green: "#1E7F5C",
  surface: "#FFFFFF",
  danger: "#B42318",
  mint: "#E7F5EE",
};

export default function FarmPhotosScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const pageWidth = Math.max(width - 40, 1);
  const params = useLocalSearchParams<{
    farmId?: string;
    entryId?: string;
    index?: string;
  }>();
  const farmId = typeof params.farmId === "string" ? params.farmId : "";
  const entryId = typeof params.entryId === "string" ? params.entryId : "";
  const requested = Number(params.index);
  const [photos, setPhotos] = useState<string[]>([]);
  const [name, setName] = useState("Animal");
  const [index, setIndex] = useState(Number.isFinite(requested) ? requested : 0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<string>>(null);

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
      const signed = (
        await Promise.all(
          animal.photos.map((url) => readableFarmImage(url).catch(() => "")),
        )
      ).filter((url) => url.startsWith("http"));
      if (!signed.length) throw new Error("This animal has no photos to show.");
      const start = Math.min(
        Math.max(Number.isFinite(requested) ? requested : 0, 0),
        signed.length - 1,
      );
      setName(animal.name);
      setPhotos(signed);
      setIndex(start);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "These photos could not be opened.",
      );
    } finally {
      setLoading(false);
    }
  }, [entryId, farmId, requested]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function show(next: number) {
    const bounded = Math.min(Math.max(next, 0), photos.length - 1);
    setIndex(bounded);
    listRef.current?.scrollToIndex({ index: bounded, animated: true });
  }

  function onScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
    if (Number.isFinite(next)) setIndex(next);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.page}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.back}
        >
          <Feather name="arrow-left" size={18} color={colors.green} />
          <Text style={styles.backText}>{name}</Text>
        </Pressable>
        <View style={styles.heading}>
          <Text accessibilityRole="header" style={styles.title}>
            Photos
          </Text>
          {photos.length ? (
            <Text style={styles.count}>
              {index + 1} of {photos.length}
            </Text>
          ) : null}
        </View>
        {loading ? (
          <View style={styles.status}>
            <ActivityIndicator color={colors.green} />
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
        {photos.length ? (
          <>
            <FlatList
              ref={listRef}
              data={photos}
              horizontal
              pagingEnabled
              initialScrollIndex={Math.min(index, photos.length - 1)}
              getItemLayout={(_item, itemIndex) => ({
                length: pageWidth,
                offset: pageWidth * itemIndex,
                index: itemIndex,
              })}
              keyExtractor={(photo, photoIndex) => `${photoIndex}-${photo}`}
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onScrollEnd}
              onScrollToIndexFailed={({ index: failed }) => {
                listRef.current?.scrollToOffset({
                  offset: pageWidth * failed,
                  animated: false,
                });
              }}
              renderItem={({ item }) => (
                <View style={[styles.slide, { width: pageWidth }]}>
                  <Image
                    source={{ uri: item }}
                    style={styles.hero}
                    resizeMode="contain"
                    accessibilityLabel={`${name} photo ${index + 1}`}
                  />
                </View>
              )}
              style={styles.gallery}
            />
            <FlatList
              data={photos}
              horizontal
              keyExtractor={(photo, photoIndex) => `thumb-${photoIndex}-${photo}`}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbs}
              renderItem={({ item, index: photoIndex }) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Show photo ${photoIndex + 1}`}
                  onPress={() => show(photoIndex)}
                >
                  <Image
                    source={{ uri: item }}
                    style={[styles.thumb, photoIndex === index && styles.thumbActive]}
                  />
                </Pressable>
              )}
            />
          </>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  page: { flex: 1, padding: 20, gap: 16 },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    minHeight: 36,
  },
  backText: { color: colors.green, fontSize: 15, fontWeight: "700" },
  heading: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  title: { color: colors.ink, fontSize: 28, fontWeight: "800", letterSpacing: -0.4 },
  count: { color: colors.muted, fontSize: 14, fontWeight: "700" },
  status: { gap: 8 },
  help: { color: colors.muted, fontSize: 13 },
  error: { color: colors.danger, fontSize: 13 },
  retry: { color: colors.green, fontWeight: "700" },
  gallery: { flex: 1 },
  slide: { flex: 1 },
  hero: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  thumbs: { gap: 8, paddingBottom: 4 },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: colors.mint,
    borderWidth: 2,
    borderColor: "transparent",
  },
  thumbActive: { borderColor: colors.green },
});
