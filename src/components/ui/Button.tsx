import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  StyleProp,
  ViewStyle,
} from "react-native";
import { useTheme } from "../../theme/useTheme";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function Button({
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  style,
  leftIcon,
  rightIcon,
}: ButtonProps) {
  const { colors, shape, shadow, isAltTheme } = useTheme();
  const isPrimary = variant === "primary";
  const isDisabled = disabled || loading;

  const handlePress = () => {
    if (!isDisabled) {
      setTimeout(() => onPress(), 50);
    }
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        isPrimary
          ? { backgroundColor: colors.primary }
          : {
              backgroundColor: `${colors.primary}12`,
              borderWidth: 1,
              borderColor: `${colors.primary}30`,
            },
        {
          borderRadius: shape.buttonRadius,
          shadowColor: colors.primary,
          shadowOpacity: shadow.buttonOpacity,
          shadowRadius: shadow.buttonRadius,
          shadowOffset: { width: 0, height: shadow.buttonOffsetY },
          elevation: shadow.buttonElevation,
        },
        pressed && !isDisabled && styles.buttonPressed,
        isDisabled && { opacity: 0.55 },
        style,
      ]}
      onPress={handlePress}
      disabled={isDisabled}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={isPrimary ? colors.onPrimary : colors.primary}
        />
      ) : (
        <View style={styles.content}>
          {leftIcon ? <View style={styles.iconWrap}>{leftIcon}</View> : null}
          <Text
            style={[
              styles.buttonText,
              isAltTheme && styles.altButtonText,
              { color: isPrimary ? colors.onPrimary : colors.primary },
            ]}
          >
            {title}
          </Text>
          {rightIcon ? <View style={styles.iconWrap}>{rightIcon}</View> : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    paddingVertical: 13,
    paddingHorizontal: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonPressed: {
    transform: [{ scale: 0.99 }],
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  iconWrap: {
    width: 16,
    alignItems: "center",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  altButtonText: {
    fontWeight: "800",
    fontSize: 15,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
});
