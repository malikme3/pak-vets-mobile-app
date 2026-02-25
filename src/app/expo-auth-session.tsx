import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import { useAuthStore } from "../store/authStore";
import { useTheme } from "../theme/useTheme";

/**
 * Catch-all route for the Expo Auth Proxy callback.
 * When using auth.expo.io (or when redirectUri includes expo-auth-session),
 * Google OAuth redirects here. This route exists to prevent "Unmatched Route" (404)
 * and allows the auth session to complete via WebBrowser.maybeCompleteAuthSession().
 * The login screen's useEffect will process the googleResponse and complete sign-in.
 */
WebBrowser.maybeCompleteAuthSession();

export default function ExpoAuthSessionScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { status } = useAuthStore();

  useEffect(() => {
    // If already signed in, redirect home; otherwise redirect back to login.
    // The auth flow continues in the background via the login screen's googleResponse handler.
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
