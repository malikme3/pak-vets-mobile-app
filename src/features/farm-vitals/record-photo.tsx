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
  readableFarmImage,
  type FarmReviewSection,
} from "../../services/farmVitalsApi";

export function recordPhotoUrls(sections: FarmReviewSection[] = []): string[] {
  return sections.flatMap((section) =>
    section.rows.flatMap((row) => (row.imageUrl ? [row.imageUrl] : [])),
  );
}

export function RecordPhoto({
  url,
  label,
  fallbackText,
  onOpen,
}: {
  url?: string;
  label: string;
  fallbackText?: string;
  onOpen?: () => void;
}) {
  const [source, setSource] = useState("");
  const [failed, setFailed] = useState(false);
  const [useOriginal, setUseOriginal] = useState(false);
  const avatar = fallbackText !== undefined;
  const thumbnail = avatar && !useOriginal;

  useEffect(() => {
    if (!url) return;
    let current = true;
    setSource("");
    readableFarmImage(url, thumbnail ? "thumbnail" : "original")
      .then((uri) => {
        if (current) setSource(uri);
      })
      .catch(() => {
        if (!current) return;
        if (thumbnail) setUseOriginal(true);
        else setSource(url);
      });
    return () => {
      current = false;
    };
  }, [url, thumbnail]);
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
                if (thumbnail) setUseOriginal(true);
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
  if (!onOpen || !url) return content;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View ${label} photo versions`}
      onPress={(event) => {
        event.stopPropagation();
        onOpen();
      }}
    >
      {content}
    </Pressable>
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
  initial: { color: "#1E7F5C", fontWeight: "800", fontSize: 14 },
  help: { color: "#63766C", fontSize: 13 },
  photo: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 12,
    backgroundColor: "#F8F8F2",
  },
});
