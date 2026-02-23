import {
  Pressable,
  View,
  Text,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useTheme } from "../../theme/useTheme";

interface ListRowProps {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function ListRow({ title, subtitle, onPress, style }: ListRowProps) {
  const { colors, isAltTheme } = useTheme();

  const handlePress = () => {
    if (onPress) {
      setTimeout(() => onPress(), 50);
    }
  };

  const content = (
    <View style={[styles.row, style]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text
            style={[styles.subtitle, { color: colors.muted }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        )}
      </View>
      <FontAwesome name="chevron-right" size={14} color={colors.muted} />
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.touchable,
          isAltTheme && styles.altTouchable,
          pressed && { backgroundColor: `${colors.primary}10` },
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  touchable: {
    minHeight: 44,
  },
  altTouchable: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#00000014",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 48,
  },
  content: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
  },
});
