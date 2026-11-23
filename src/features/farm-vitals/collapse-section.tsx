import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { farmButton, farmCard } from "./presentation";

const colors = {
  ink: "#173D32",
  muted: "#63766C",
  green: "#1E7F5C",
  surface: "#FFFFFF",
};

export function CollapseSection({
  title,
  count,
  expanded,
  onToggle,
  onEdit,
  editDisabled,
  children,
}: {
  title: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  onEdit?: () => void;
  editDisabled?: boolean;
  children: ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.sectionHeading}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          aria-expanded={expanded}
          onPress={onToggle}
          style={styles.sectionHeader}
        >
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.count}>{count}</Text>
          <Feather
            name={expanded ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.green}
          />
        </Pressable>
        {onEdit ? (
          <EditSectionButton
            title={title}
            disabled={editDisabled}
            onPress={onEdit}
          />
        ) : null}
      </View>
      {expanded ? children : null}
    </View>
  );
}

export function EditSectionButton({
  title,
  disabled,
  onPress,
}: {
  title: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Edit ${title}`}
      disabled={disabled}
      onPress={onPress}
      style={[styles.editSection, disabled && { opacity: 0.45 }]}
    >
      <Feather name="edit-2" size={14} color={colors.green} />
      <Text style={styles.editText}>Edit</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    ...farmCard,
  },
  sectionHeader: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sectionTitle: { flex: 1, color: colors.ink, fontSize: 16, fontWeight: "800" },
  count: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 10,
    gap: 6,
  },
  editSection: {
    ...farmButton,
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  editText: { color: colors.green, fontSize: 13, fontWeight: "700" },
});
