import { useColorScheme } from "react-native";
import { lightColors, darkColors } from "./colors";

export function useTheme() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";

  return {
    isDark,
    colors: isDark ? darkColors : lightColors,
  };
}
