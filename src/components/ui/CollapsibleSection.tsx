import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useTheme } from "../../theme/useTheme";
import { Card } from "./Card";

export interface CollapsibleSectionProps {
  /** Section title */
  title: string;
  /** Optional subtitle or hint below title */
  subtitle?: string;
  /** FontAwesome icon name */
  icon?: string;
  /** Whether the section is expanded */
  expanded: boolean;
  /** Called when header is pressed to toggle */
  onToggle: () => void;
  /** Show checkmark (✓) in title when true */
  hasContent?: boolean;
  /** Optional thumbnail URI for collapsed preview */
  thumbnailUri?: string | null;
  /** Content shown when expanded */
  children: React.ReactNode;
  /** Style for the outer container */
  style?: StyleProp<ViewStyle>;
  /** Use Card wrapper (default true) */
  withCard?: boolean;
}

/**
 * Reusable collapsible section with tappable header, chevron, and optional thumbnail.
 * Used for Disease Evidence, Clinical Signs, CNIC scan, etc.
 */
export function CollapsibleSection({
  title,
  subtitle,
  icon = "folder",
  expanded,
  onToggle,
  hasContent = false,
  thumbnailUri,
  children,
  style,
  withCard = true,
}: CollapsibleSectionProps) {
  const { colors } = useTheme();

  const header = (
    <TouchableOpacity
      style={styles.header}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      {icon ? (
        <View
          style={[styles.iconWrap, { backgroundColor: colors.primary + "20" }]}
        >
          <FontAwesome
            name={icon as "folder" | "id-card" | "camera" | "file" | "image"}
            size={14}
            color={colors.primary}
          />
        </View>
      ) : null}
      <View style={styles.textWrap}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {title}
          {hasContent ? " ✓" : ""}
        </Text>
        {subtitle ? (
          <Text
            style={[styles.subtitle, { color: colors.muted }]}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {thumbnailUri ? (
        <Image
          source={{ uri: thumbnailUri }}
          style={styles.thumb}
          resizeMode="cover"
        />
      ) : null}
      <FontAwesome
        name={expanded ? "chevron-up" : "chevron-down"}
        size={14}
        color={colors.muted}
        style={styles.chevron}
      />
    </TouchableOpacity>
  );

  const content = expanded ? <View style={styles.content}>{children}</View> : null;

  const inner = (
    <>
      {header}
      {content}
    </>
  );

  if (withCard) {
    return (
      <Card
        style={[
          styles.card,
          { borderColor: colors.border },
          style,
        ]}
      >
        {inner}
      </Card>
    );
  }

  return (
    <View style={[styles.wrapper, style]}>
      {inner}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    padding: 0,
    overflow: "hidden",
    marginVertical: 0,
  },
  wrapper: {
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 10,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  textWrap: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  thumb: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  chevron: {
    marginLeft: 4,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
});
