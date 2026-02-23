import React from "react";
import {
  View,
  Image,
  type ImageSourcePropType,
  type ViewStyle,
} from "react-native";
import { useTheme } from "../theme/useTheme";
import { getSpeciesImageSource } from "../utils/speciesImage";

type SpeciesIconProps = {
  species: string;
  size?: number;
  style?: ViewStyle;
  resizeMode?: "contain" | "cover";
};

/**
 * Species icon with theme-aware presentation.
 * When eco-organic theme is active, wraps the icon in a bright container with theme border for visibility.
 */
export function SpeciesIcon({
  species,
  size = 36,
  style,
  resizeMode = "contain",
}: SpeciesIconProps) {
  const { colors, variant } = useTheme();
  const source = getSpeciesImageSource(species, variant) as ImageSourcePropType;
  const isEcoOrganic = variant === "ecoOrganic";

  if (isEcoOrganic) {
    return (
      <View
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: colors.surface,
            borderWidth: 2,
            borderColor: colors.border,
            overflow: "hidden",
          },
          style,
        ]}
      >
        <Image
          source={source}
          style={{ width: size, height: size }}
          resizeMode="cover"
        />
      </View>
    );
  }

  return (
    <Image
      source={source}
      style={[{ width: size, height: size }, style]}
      resizeMode={resizeMode}
    />
  );
}
