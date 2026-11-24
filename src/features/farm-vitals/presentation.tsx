import Feather from "@expo/vector-icons/Feather";
import { Pressable, Text, type ViewStyle } from "react-native";
import type { FarmReview, FarmReviewRow } from "../../services/farmVitalsApi";

export function findAnimalTag(rows: FarmReviewRow[]): string | undefined {
  return rows.find(
    (row) => row.value !== "Not provided" && /tag|animal id|^id$/i.test(row.label),
  )?.value.trim() || undefined;
}

export function findFarmOwnerName(review: FarmReview): string {
  for (const section of review.sections) {
    for (const util of section.utils ?? []) {
      const row = util.rows.find(
        (item) => /name/i.test(item.label) && item.value !== "Not provided",
      );
      if (
        row &&
        (util.field?.source === "contact" || /owner|contact/i.test(util.label))
      )
        return row.value;
    }
  }
  return review.ownerName ?? "";
}

// Shared presentation for the template-driven Farm Vitals flow.
export const farmBorder = "#6F9DB8";
export const farmElevation = {
  shadowColor: "#173D32",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 5,
  elevation: 3,
} satisfies ViewStyle;

export const farmCard = {
  ...farmElevation,
  backgroundColor: "#FFFFFF",
  borderWidth: 1,
  borderColor: farmBorder,
  borderRadius: 20,
} satisfies ViewStyle;

export const farmButton = {
  ...farmElevation,
  borderWidth: 1,
  borderColor: farmBorder,
} satisfies ViewStyle;

const farmAddButton = {
  flexDirection: "row",
  alignItems: "center",
  gap: 4,
  minHeight: 32,
  paddingHorizontal: 12,
  borderRadius: 16,
  backgroundColor: "#1E7F5C",
  ...farmButton,
} satisfies ViewStyle;

export function AdditionalFlowButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Add ${label}`}
      onPress={onPress}
      style={farmAddButton}
    >
      <Feather name="plus" size={14} color="#FFFFFF" />
      <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "700" }}>
        Add
      </Text>
    </Pressable>
  );
}

export function formatFarmDate(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
