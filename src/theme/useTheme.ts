import { useColorScheme } from "react-native";
import {
  lightColors,
  darkColors,
  neonMenagerieOrbitLight,
  neonMenagerieOrbitDark,
  ecoOrganicLight,
  ecoOrganicDark,
} from "./colors";
import { useThemePreference } from "./ThemeProvider";

export function useTheme() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const { variant, isAltTheme, toggleThemeVariant } = useThemePreference();
  const isNeonTheme = variant === "neonMenagerieOrbit";
  const isEcoTheme = variant === "ecoOrganic";

  const colors =
    variant === "neonMenagerieOrbit"
      ? isDark
        ? neonMenagerieOrbitDark
        : neonMenagerieOrbitLight
      : variant === "ecoOrganic"
        ? isDark
          ? ecoOrganicDark
          : ecoOrganicLight
        : isDark
          ? darkColors
          : lightColors;

  return {
    isDark,
    colors,
    variant,
    isAltTheme,
    isNeonTheme,
    isEcoTheme,
    toggleThemeVariant,
    themeName: isNeonTheme
      ? "Neon Menagerie Orbit"
      : isEcoTheme
        ? "Eco-Organic"
        : "Classic Clinical",
    shape: {
      cardRadius: isNeonTheme ? 22 : isEcoTheme ? 18 : 16,
      buttonRadius: isNeonTheme ? 18 : isEcoTheme ? 14 : 12,
      inputRadius: isNeonTheme ? 16 : isEcoTheme ? 14 : 12,
    },
    shadow: {
      cardOpacity: isNeonTheme ? 0.17 : isEcoTheme ? 0.12 : 0.08,
      cardRadius: isNeonTheme ? 18 : isEcoTheme ? 14 : 12,
      cardOffsetY: isNeonTheme ? 10 : isEcoTheme ? 7 : 6,
      cardElevation: isNeonTheme ? 6 : isEcoTheme ? 4 : 2,
      buttonOpacity: isNeonTheme ? 0.28 : isEcoTheme ? 0.18 : 0,
      buttonRadius: isNeonTheme ? 12 : isEcoTheme ? 10 : 0,
      buttonOffsetY: isNeonTheme ? 6 : isEcoTheme ? 4 : 0,
      buttonElevation: isNeonTheme ? 4 : isEcoTheme ? 3 : 0,
    },
    copy: {
      dashboardLabel: isNeonTheme
        ? "Orbit Deck"
        : isEcoTheme
          ? "Field Grove"
          : "Dashboard",
      dashboardGreetingPrefix: isNeonTheme
        ? "Ringmaster"
        : isEcoTheme
          ? "Caretaker"
          : "Dr.",
      dashboardSubtitle:
        "View and manage your active cases, or find animals near you to start a visit.",
      primaryActionTitle: "Start New Case",
      nearbyActionTitle: "Find Nearby Cases",
      nearbyActionLoadingTitle: "Searching for cases near you...",
      openCasesTitle: "Open Cases",
      openCasesCaption: "Tap a case to open it and add diagnoses or treatments.",
      nearbyTitle: "Nearby Cases",
      nearbyHint:
        "Animals with cases within {{radius}} km of your location. Tap one to view or start a visit.",
      noCasesText:
        "You have no open cases. Tap “Start New Case” below to create one.",
      noNearbyText:
        "No cases found in this area. Try a larger radius or start a new case.",
      voicePlaceholder:
        "Describe the chief complaint or tap the mic to record voice.",
      voiceHelpEmpty:
        "Add the main signs and symptoms you see—this helps suggest a diagnosis.",
      voiceHelpFilled:
        "You can edit the text above to improve the suggested diagnosis.",
      voicePermissionDeniedTitle: "Microphone Access Required",
      voicePermissionDeniedMessage:
        "Allow microphone access in Settings to record voice notes and chief complaints.",
      voiceRejectedTitle: "Recording Not Allowed",
      voiceRejectedMessage:
        "This recording could not be used. Please try again or type your note.",
      voiceNoSpeechTitle: "No Speech Detected",
      voiceNoSpeechMessage:
        "We didn’t hear any speech. Speak clearly and try recording again.",
    },
  };
}
