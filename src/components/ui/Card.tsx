import { View, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { useTheme } from "../../theme/useTheme";

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Card({ children, style }: CardProps) {
  const { colors, shape, shadow, isAltTheme } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: shape.cardRadius,
          shadowColor: isAltTheme ? colors.accent : "#0f172a",
          shadowOffset: { width: 0, height: shadow.cardOffsetY },
          shadowOpacity: shadow.cardOpacity,
          shadowRadius: shadow.cardRadius,
          elevation: shadow.cardElevation,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 18,
    marginVertical: 8,
    borderWidth: 1,
  },
});
