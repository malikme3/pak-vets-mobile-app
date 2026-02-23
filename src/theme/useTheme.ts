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
      dashboardSubtitle: isNeonTheme
        ? "Command roaming constellations of cases and launch bright rescue runs."
        : isEcoTheme
          ? "Keep cases rooted and moving with calm, natural flow."
        : "Keep your active cases moving and quickly find nearby visits.",
      primaryActionTitle: isNeonTheme
        ? "Launch New Expedition"
        : isEcoTheme
          ? "Start Fresh Case"
        : "Start New Case",
      nearbyActionTitle: isNeonTheme
        ? "Scout Nearby Herds"
        : isEcoTheme
          ? "Find Nearby Farms"
        : "Find Nearby Cases",
      nearbyActionLoadingTitle: isNeonTheme
        ? "Scanning cosmic trails..."
        : isEcoTheme
          ? "Walking the nearby fields..."
        : "Locating nearby cases...",
      openCasesTitle: isNeonTheme
        ? "Active Constellations"
        : isEcoTheme
          ? "Open Field Cases"
          : "Open Cases",
      openCasesCaption: isNeonTheme
        ? "Recent rescue missions in orbit"
        : isEcoTheme
          ? "Most recent active records in your region"
        : "Most recent active records",
      nearbyTitle: isNeonTheme
        ? "Beacon Echoes"
        : isEcoTheme
          ? "Nearby Grounds"
          : "Nearby Results",
      nearbyHint: isNeonTheme
        ? "Animals detected within {{radius}} km of your current orbit node."
        : isEcoTheme
          ? "Animals found within {{radius}} km of your current area."
        : "Cases for animals within {{radius}} km of your location.",
      noCasesText: isNeonTheme
        ? "No active constellations yet. Launch your first expedition."
        : isEcoTheme
          ? "No open field cases yet. Start a fresh one to begin."
        : "No active cases. Start a new case to begin.",
      noNearbyText: isNeonTheme
        ? "No beacon echoes in this quadrant yet."
        : isEcoTheme
          ? "No nearby cases found on these grounds."
        : "No nearby cases in this area.",
      voicePlaceholder: isNeonTheme
        ? "Describe the creature saga or tap the star-mic to narrate..."
        : isEcoTheme
          ? "Describe signs from the field or tap the mic to record..."
        : "Type chief complaint or tap the microphone to record…",
      voiceHelpEmpty: isNeonTheme
        ? "Tell us the key signs of this creature so the Orbit Oracle can chart a diagnosis."
        : isEcoTheme
          ? "Add main signs and symptoms so we can suggest the likely diagnosis."
        : "Please add the main signs and symptoms so our AI can suggest the most likely diagnosis.",
      voiceHelpFilled: isNeonTheme
        ? "Refine these signs so the Orbit Oracle can sharpen the diagnosis path."
        : isEcoTheme
          ? "Refine signs and symptoms to improve diagnosis suggestions."
        : "Update the main signs and symptoms so our AI can suggest the most likely diagnosis.",
      voicePermissionDeniedTitle: isNeonTheme
        ? "Star-Mic Locked"
        : isEcoTheme
          ? "Mic Access Needed"
        : "Permission Denied",
      voicePermissionDeniedMessage: isNeonTheme
        ? "Microphone access is needed to capture your field narration."
        : isEcoTheme
          ? "Microphone access is required to capture your note."
        : "Microphone access is required.",
      voiceRejectedTitle: isNeonTheme
        ? "Transmission Rejected"
        : isEcoTheme
          ? "Audio Rejected"
          : "Rejected",
      voiceRejectedMessage: isNeonTheme
        ? "That transmission is not allowed in this orbit."
        : isEcoTheme
          ? "This recording content is not allowed."
        : "Content not allowed.",
      voiceNoSpeechTitle: isNeonTheme
        ? "Silent Frequency"
        : isEcoTheme
          ? "No Voice Detected"
        : "No Speech Detected",
      voiceNoSpeechMessage: isNeonTheme
        ? "No clear narration was detected. Please record again."
        : isEcoTheme
          ? "No clear voice was detected. Please record again."
        : "The recording doesn't contain any detectable speech. Please try recording again.",
    },
  };
}
