import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/useTheme';

interface SegmentedControlProps {
  options: { label: string; value: string }[];
  selectedValue: string;
  onValueChange: (value: string) => void;
}

export function SegmentedControl({ options, selectedValue, onValueChange }: SegmentedControlProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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
            <TouchableOpacity
              style={[
                styles.segment,
                isFirst && styles.segmentFirst,
                isLast && styles.segmentLast,
                isSelected && { backgroundColor: colors.primary },
                !isSelected && { backgroundColor: colors.surface },
              ]}
              onPress={() => onValueChange(option.value)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: isSelected ? colors.surface : colors.text },
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
            {showRightSeparator && (
              <View style={[styles.separator, { backgroundColor: colors.border }]} />
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 44,
    overflow: 'hidden',
  },
  segmentWrapper: {
    flex: 1,
    flexDirection: 'row',
    position: 'relative',
  },
  segment: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
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
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
