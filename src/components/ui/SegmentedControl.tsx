import { View, Text, Pressable, StyleSheet } from "react-native";
import { useTheme } from "../../theme/useTheme";

interface SegmentedControlProps {
  options: { label: string; value: string }[];
  selectedValue: string;
  onValueChange: (value: string) => void;
}

export function SegmentedControl({
  options,
  selectedValue,
  onValueChange,
}: SegmentedControlProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      {options.map((option, index) => {
        const isSelected = option.value === selectedValue;
        const isFirst = index === 0;
        const isLast = index === options.length - 1;
        const nextOption = options[index + 1];
        const isNextSelected = nextOption?.value === selectedValue;
        // Show separator if not last segment and neither current nor next is selected
        const showRightSeparator = !isLast && !isSelected && !isNextSelected;

        return (
          <View key={option.value} style={styles.segmentWrapper}>
            <Pressable
              style={({ pressed }) => [
                styles.segment,
                isFirst && styles.segmentFirst,
                isLast && styles.segmentLast,
                isSelected && { backgroundColor: colors.primary },
                !isSelected && { backgroundColor: colors.surface },
                pressed && !isSelected && { backgroundColor: `${colors.primary}12` },
              ]}
              onPress={() => onValueChange(option.value)}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: isSelected ? colors.surface : colors.text },
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
            {showRightSeparator && (
              <View
                style={[styles.separator, { backgroundColor: colors.border }]}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 48,
    overflow: "hidden",
  },
  segmentWrapper: {
    flex: 1,
    flexDirection: "row",
    position: "relative",
  },
  segment: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  segmentFirst: {
    borderTopLeftRadius: 7,
    borderBottomLeftRadius: 7,
  },
  segmentLast: {
    borderTopRightRadius: 7,
    borderBottomRightRadius: 7,
  },
  separator: {
    width: 1,
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
});
