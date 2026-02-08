import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/useTheme';

interface ListRowProps {
  title: string;
  subtitle?: string;
  style?: ViewStyle;
}

export function ListRow({ title, subtitle, style }: ListRowProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.row, style]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text style={[styles.subtitle, { color: colors.muted }]} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      <Text style={[styles.chevron, { color: colors.muted }]}>›</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 44,
  },
  content: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
  },
  chevron: {
    fontSize: 24,
  },
});
