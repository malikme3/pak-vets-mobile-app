import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  aiFarmImageUrl,
  readableFarmImage,
  type FarmReviewSection,
} from "../../services/farmVitalsApi";

type PhotoVariant = "ai" | "thumbnail" | "original";
export const photoSides = ["Original", "AI", "Thumbnail"] as const;
export type PhotoSide = (typeof photoSides)[number];
export type PhotoVersions = {
  Original: string;
  AI?: string;
  Thumbnail?: string;
};

function nextVariant(variant: PhotoVariant): PhotoVariant | undefined {
  if (variant === "ai") return "thumbnail";
  if (variant === "thumbnail") return "original";
  return undefined;
}

export function recordPhotoUrls(sections: FarmReviewSection[] = []): string[] {
  return sections.flatMap((section) =>
    section.rows.flatMap((row) => (row.imageUrl ? [row.imageUrl] : [])),
  );
}

async function availableImage(uri: string): Promise<string | undefined> {
  if (!uri) return;
  try {
    await Image.getSize(uri);
    return uri;
  } catch {
    return undefined;
  }
}

export async function loadPhotoVersions(url: string): Promise<PhotoVersions> {
  const enhancedUrl = aiFarmImageUrl(url);
  const [original, enhanced, thumbnail] = await Promise.all([
    readableFarmImage(url).catch(() => url),
    enhancedUrl ? readableFarmImage(enhancedUrl).catch(() => "") : "",
    readableFarmImage(url, "thumbnail").catch(() => ""),
  ]);
  const distinctThumbnail =
    thumbnail && new URL(thumbnail).pathname !== new URL(original).pathname
      ? thumbnail
      : "";
  const [ai, thumb] = await Promise.all([
    availableImage(enhanced),
    availableImage(distinctThumbnail),
  ]);
  return { Original: original, AI: ai, Thumbnail: thumb };
}

export function PhotoVersionsPreview({
  urls,
}: {
  urls: string[];
}) {
  const [versions, setVersions] = useState<PhotoVersions[]>([]);
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const urlKey = urls.join("\n");

  useEffect(() => {
    let current = true;
    setVersions([]);
    setFailed({});
    const photoUrls = urlKey ? urlKey.split("\n") : [];
    void Promise.all(
      photoUrls.map((url) =>
        loadPhotoVersions(url).catch(() => ({ Original: url })),
      ),
    ).then((loaded) => {
      if (current) setVersions(loaded);
    });
    return () => {
      current = false;
    };
  }, [urlKey]);

  return (
    <View style={styles.previewList}>
      {versions.map((photo, index) => (
        <View key={photo.Original} style={styles.previewPhoto}>
          {urls.length > 1 ? (
            <Text style={styles.previewCaption}>Photo {index + 1}</Text>
          ) : null}
          <View style={styles.previewVersions}>
            {photoSides.flatMap((side) => {
              const uri = photo[side];
              if (!uri || failed[uri]) return [];
              return [
                <View key={side} style={styles.previewVersion}>
                  <Image
                    source={{ uri }}
                    style={styles.previewImage}
                    resizeMode="cover"
                    onError={() =>
                      setFailed((current) => ({ ...current, [uri]: true }))
                    }
                  />
                  <Text style={styles.previewLabel}>{side}</Text>
                </View>,
              ];
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

export function RecordPhoto({
  url,
  label,
  fallbackText,
  onOpen,
  tileBackground = false,
}: {
  url?: string;
  label: string;
  fallbackText?: string;
  onOpen?: () => void;
  tileBackground?: boolean;
}) {
  const [source, setSource] = useState("");
  const [failed, setFailed] = useState(false);
  const [variant, setVariant] = useState<PhotoVariant>("ai");
  const avatar = fallbackText !== undefined;

  useEffect(() => {
    if (!url) return;
    let current = true;
    setSource("");
    setFailed(false);
    const imageUrl = avatar && variant === "ai" ? aiFarmImageUrl(url) : url;
    if (avatar && variant === "ai" && !imageUrl) {
      setVariant("thumbnail");
      return () => {
        current = false;
      };
    }
    readableFarmImage(
      imageUrl,
      avatar && variant === "thumbnail" ? "thumbnail" : "original",
    )
      .then((uri) => {
        if (current) setSource(uri);
      })
      .catch(() => {
        if (!current) return;
        const next = avatar ? nextVariant(variant) : undefined;
        if (next) setVariant(next);
        else if (avatar) setFailed(true);
        else setSource(url);
      });
    return () => {
      current = false;
    };
  }, [avatar, url, variant]);
  function renderPhoto() {
    if (avatar)
      return (
        <View style={styles.avatar}>
          {source && !failed ? (
            <Image
              source={{ uri: source }}
              style={styles.avatarImage}
              resizeMode="cover"
              accessible={false}
              onError={() => {
                const next = nextVariant(variant);
                if (next) setVariant(next);
                else setFailed(true);
              }}
            />
          ) : (
            <Text style={styles.initial}>{fallbackText}</Text>
          )}
        </View>
      );
    if (failed) return <Text style={styles.help}>Photo unavailable.</Text>;
    return source ? (
      <Image
        source={{ uri: source }}
        style={styles.photo}
        resizeMode="contain"
        accessibilityLabel={label}
        onError={() => setFailed(true)}
      />
    ) : (
      <ActivityIndicator color="#1E7F5C" />
    );
  }
  const content = renderPhoto();
  const avatarContent =
    onOpen && url ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edit ${label} and view photo versions`}
        onPress={(event) => {
          event.stopPropagation();
          onOpen();
        }}
      >
        {content}
      </Pressable>
    ) : (
      content
    );
  if (!tileBackground || !avatar) return avatarContent;
  return (
    <>
      <View pointerEvents="none" style={styles.tileBackground}>
        {source && !failed ? (
          <Image
            source={{ uri: source }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            accessible={false}
          />
        ) : null}
        <View style={styles.tileOverlay} />
      </View>
      {avatarContent}
    </>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "#E7F5EE",
  },
  avatarImage: { width: "100%", height: "100%" },
  tileBackground: {
    ...StyleSheet.absoluteFill,
  },
  tileOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(248, 248, 242, 0.62)",
  },
  previewList: { gap: 12 },
  previewPhoto: { gap: 8 },
  previewCaption: { color: "#63766C", fontSize: 13, fontWeight: "700" },
  previewVersions: { flexDirection: "row", gap: 8 },
  previewVersion: { flex: 1, minWidth: 0, alignItems: "center", gap: 4 },
  previewImage: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 10,
    backgroundColor: "#E7F5EE",
  },
  previewLabel: { color: "#63766C", fontSize: 12, fontWeight: "600" },
  initial: { color: "#1E7F5C", fontWeight: "800", fontSize: 14 },
  help: { color: "#63766C", fontSize: 13 },
  photo: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 12,
    backgroundColor: "#F8F8F2",
  },
});
