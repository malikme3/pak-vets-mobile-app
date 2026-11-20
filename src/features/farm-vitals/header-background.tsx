import { useState, type ReactNode } from "react";
import {
  Image,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

export function HeaderBackground({
  imageUrl,
  style,
  children,
}: {
  imageUrl?: string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const [failedUrl, setFailedUrl] = useState<string>();
  return (
    <View style={style}>
      {imageUrl && imageUrl !== failedUrl ? (
        <View pointerEvents="none" style={styles.background}>
          <Image
            accessible={false}
            source={{ uri: imageUrl }}
            resizeMode="cover"
            style={StyleSheet.absoluteFill}
            onError={() => setFailedUrl(imageUrl)}
          />
          <View style={styles.scrim} />
        </View>
      ) : null}
      {children}
    </View>
  );
}
const styles = StyleSheet.create({
  background: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: "hidden",
    borderRadius: 20,
  },
  scrim: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(255,255,255,0.84)",
  },
});
