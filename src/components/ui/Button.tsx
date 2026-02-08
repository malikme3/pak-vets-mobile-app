import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/useTheme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({ title, onPress, variant = 'primary', loading = false, disabled = false, style }: ButtonProps) {
  const { colors } = useTheme();
  const isPrimary = variant === 'primary';
  const isDisabled = disabled || loading;

  const handlePress = () => {
    if (!isDisabled) {
      onPress();
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        isPrimary
          ? { backgroundColor: colors.primary }
          : { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary },
        isDisabled && { opacity: 0.5 },
        style,
      ]}
      onPress={handlePress}
      disabled={isDisabled}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator size="small" color={isPrimary ? colors.surface : colors.primary} />
      ) : (
        <Text style={[styles.buttonText, { color: isPrimary ? colors.surface : colors.primary }]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
