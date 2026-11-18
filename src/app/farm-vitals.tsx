import type { ComponentProps } from "react";
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import { useAuthStore } from "../store/authStore";

const colors = {
  background: "#F8F8F2",
  ink: "#173D32",
  muted: "#63766C",
  green: "#1E7F5C",
  border: "#DFE6DC",
};

const features: {
  icon: ComponentProps<typeof Feather>["name"];
  label: string;
}[] = [
  { icon: "heart", label: "Animal health" },
  { icon: "trending-up", label: "Growth tracking" },
  { icon: "sun", label: "Nutrition" },
  { icon: "bar-chart-2", label: "Farm performance" },
];

function FarmArtwork({ wide }: { wide: boolean }) {
  return (
    <Image
      source={require("../../assets/species-icons/eco-organic/hero-banner-cow.png")}
      resizeMode="contain"
      style={[styles.artwork, wide && styles.artworkWide]}
      accessibilityLabel="Cow in a peaceful farm landscape"
    />
  );
}

export default function FarmVitalsScreen() {
  const router = useRouter();
  const authStatus = useAuthStore((state) => state.status);
  const { width } = useWindowDimensions();
  const wide = width >= 900;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.page, wide && styles.pageWide]}>
          <View style={styles.nav}>
            <View style={styles.brand}>
              <View style={styles.brandIcon}>
                <Feather
                  name="activity"
                  size={21}
                  color="#FFFFFF"
                  accessible={false}
                  aria-hidden
                />
              </View>
              <Text style={styles.brandName}>Pak Vets.</Text>
            </View>
            <Text style={styles.navLabel}>Farm management</Text>
          </View>

          <View style={[styles.hero, wide && styles.heroWide]}>
            <View style={[styles.copy, wide && styles.copyWide]}>
              <Text
                accessibilityRole="header"
                style={[styles.title, wide && styles.titleWide]}
              >
                Farm Vitals.
              </Text>
              <Text style={styles.tagline}>
                Monitor Health. Track Growth. Manage Smarter.
              </Text>
              <Text style={styles.subtitle}>
                Your farm's health, progress, and performance—all in one place.
              </Text>

              {!wide && <FarmArtwork wide={false} />}

              <View style={styles.features}>
                {features.map((feature) => (
                  <View key={feature.label} style={styles.feature}>
                    <Feather
                      name={feature.icon}
                      size={16}
                      color={colors.green}
                      accessible={false}
                      aria-hidden
                    />
                    <Text style={styles.featureLabel}>{feature.label}</Text>
                  </View>
                ))}
              </View>

              <View style={[styles.actions, wide && styles.actionWide]}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push("/create-farm")}
                  style={({ pressed }) => [
                    styles.action,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.actionText}>Register Farm</Text>
                  <Feather
                    name="arrow-right"
                    size={20}
                    color="#FFFFFF"
                    accessible={false}
                    aria-hidden
                  />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push("/farm-dashboard")}
                  style={({ pressed }) => [
                    styles.secondaryAction,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.secondaryActionText}>Review farms</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push("/login")}
                  style={({ pressed }) => [
                    styles.secondaryAction,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.secondaryActionText}>
                    Sign in to Pak Vets
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.push(authStatus === "signedIn" ? "/" : "/login")
                  }
                  style={({ pressed }) => [
                    styles.secondaryAction,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.secondaryActionText}>Old flow</Text>
                </Pressable>
              </View>
            </View>
            {wide && <FarmArtwork wide />}
          </View>
          <View style={styles.footerArea}>
            <View style={styles.footer}>
              <View style={styles.footerBrand}>
                <Feather
                  name="activity"
                  size={14}
                  color={colors.green}
                  accessible={false}
                  aria-hidden
                />
                <Text style={styles.footerName}>Farm Vitals</Text>
              </View>
              <Text style={styles.footerCredit}>A Pak Vets product</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const serif = Platform.select({
  ios: "Georgia",
  android: "serif",
  default: "Georgia, serif",
});
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1 },
  page: {
    flexGrow: 1,
    width: "100%",
    maxWidth: 1180,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingBottom: 28,
  },
  pageWide: { paddingHorizontal: 40 },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  brandName: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.7,
  },
  navLabel: {
    color: colors.muted,
    fontSize: 11,
    flexShrink: 1,
    textAlign: "right",
  },
  hero: { paddingTop: 32 },
  heroWide: {
    flexDirection: "row",
    alignItems: "center",
    gap: 48,
    paddingTop: 76,
    paddingBottom: 60,
  },
  copy: { width: "100%" },
  copyWide: { flex: 1 },
  title: {
    fontFamily: serif,
    fontSize: 46,
    lineHeight: 58,
    letterSpacing: -1.5,
    color: colors.ink,
    marginBottom: 16,
  },
  titleWide: { fontSize: 64, lineHeight: 76 },
  tagline: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 24,
    fontWeight: "600",
    marginBottom: 12,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 25,
    maxWidth: 420,
  },
  artwork: { width: "100%", height: 180, marginVertical: 24 },
  artworkWide: { flex: 1.1, height: 350, marginVertical: 0 },
  features: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 16,
    columnGap: 10,
    marginTop: 8,
    marginBottom: 30,
  },
  feature: { width: "47%", flexDirection: "row", alignItems: "center", gap: 8 },
  featureLabel: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 19,
    flexShrink: 1,
  },
  actions: { width: "100%", gap: 12 },
  action: {
    width: "100%",
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    paddingVertical: 16,
    paddingHorizontal: 22,
    borderRadius: 14,
    backgroundColor: colors.green,
  },
  actionWide: { maxWidth: 360 },
  secondaryAction: {
    width: "100%",
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 22,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.green,
    backgroundColor: "#FFFFFF",
  },
  secondaryActionText: {
    color: colors.green,
    fontWeight: "700",
    fontSize: 15,
  },
  actionText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
    flexShrink: 1,
  },
  pressed: { opacity: 0.8 },
  footerArea: { marginTop: "auto", paddingTop: 32 },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  footerBrand: { flexDirection: "row", alignItems: "center", gap: 7 },
  footerName: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.1,
  },
  footerCredit: {
    color: colors.muted,
    fontSize: 11,
    flexShrink: 1,
    textAlign: "right",
  },
});
