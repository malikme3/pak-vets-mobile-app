import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  onBack: () => void;
  title: string;
};

export function FlowPageHeading({ onBack, title }: Props) {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.navigation}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
        >
          <Feather name="arrow-left" size={19} color="#1E7F5C" />
          <Text style={styles.navLabel}>Back</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go to app home"
          onPress={() => router.replace("/farm-vitals")}
          style={({ pressed }) => [
            styles.homeButton,
            pressed && styles.pressed,
          ]}
        >
          <Feather name="home" size={17} color="#1E7F5C" />
        </Pressable>
        <View accessibilityElementsHidden style={styles.navigationSpacer} />
      </View>
      <View style={styles.titleRow}>
        <View style={styles.titleChip}>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 7 },
  navigation: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    position: "relative",
  },
  backButton: {
    flex: 1,
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingRight: 8,
  },
  navLabel: { color: "#1E7F5C", fontSize: 14, fontWeight: "700" },
  homeButton: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCE6DF",
    alignItems: "center",
    justifyContent: "center",
  },
  navigationSpacer: { flex: 1, height: 34 },
  titleRow: {
    width: "100%",
    alignSelf: "stretch",
    alignItems: "stretch",
    justifyContent: "center",
    minHeight: 44,
  },
  titleChip: {
    width: "100%",
    alignSelf: "stretch",
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "#E8F3ED",
    borderWidth: 1,
    borderColor: "#C9DED2",
  },
  title: {
    color: "#173D32",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
    textAlign: "center",
  },
  pressed: { opacity: 0.72 },
});
