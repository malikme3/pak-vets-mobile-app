import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import { useAuthStore } from "../store/authStore";
import { useTheme } from "../theme/useTheme";

/**
 * Catch-all route for native Google OAuth redirect (pak-vets-mobile-app://oauthredirect).
 * The Android native client uses this path for the callback. This route prevents "Unmatched Route"
 * and lets WebBrowser.maybeCompleteAuthSession() finish the auth flow.
 */
WebBrowser.maybeCompleteAuthSession();

export default function OAuthRedirectScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { status } = useAuthStore();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace(status === "signedIn" ? "/" : "/login");
    }, 1500);
    return () => clearTimeout(timer);
  }, [router, status]);

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
