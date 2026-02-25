import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ImageBackground,
  TextInput,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { StatusBar } from "expo-status-bar";
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
} from "firebase/auth";
import { Button } from "../components/ui/Button";
import { useTheme } from "../theme/useTheme";
import { useAuthStore } from "../store/authStore";
import { useRouter } from "expo-router";
import { authApi } from "../services/authApi";
import {
  getFirebaseAuth,
  getFirebaseConfig,
  hasValidFirebaseConfig,
} from "../services/firebase";
import { getAppExtra } from "../services/appConfig";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const defaultEmail = __DEV__ ? "zulifqar.ahmad@hotmail.com" : "";
  const defaultPassword = __DEV__ ? "admin123" : "";
  const router = useRouter();
  const { colors } = useTheme();
  const { status, setSessionToken } = useAuthStore();
  const isAuthed = status === "signedIn";
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState(defaultPassword);
  const [submitting, setSubmitting] = useState(false);

  const firebaseConfig = getFirebaseConfig();
  const googleConfig = getAppExtra();

  const googleWebClientId = googleConfig.googleWebClientId || "";
  const googleExpoClientId = googleConfig.googleExpoClientId || "";
  const googleIosClientId = googleConfig.googleIosClientId || "";
  const googleAndroidClientId = googleConfig.googleAndroidClientId || "";

  const isFirebaseConfigured = hasValidFirebaseConfig();
  const apiKeyLooksValid = /^AIza[0-9A-Za-z_-]{20,}$/.test(
    (firebaseConfig.apiKey || "").trim().replace(/^['"]|['"]$/g, ""),
  );
  const missingFirebaseKeys = [
    !firebaseConfig.apiKey
      ? "firebaseApiKey/FIREBASE_API_KEY"
      : !apiKeyLooksValid
        ? "firebaseApiKey/FIREBASE_API_KEY (invalid format)"
        : null,
    !firebaseConfig.projectId ? "firebaseProjectId/FIREBASE_PROJECT_ID" : null,
    !firebaseConfig.appId ? "firebaseAppId/FIREBASE_APP_ID" : null,
  ].filter(Boolean) as string[];

  const hasGoogleClientId = Boolean(
    Platform.select({
      ios: googleIosClientId,
      android: googleAndroidClientId,
      web: googleWebClientId,
      default: googleExpoClientId,
    }),
  );

  const googleAuthClientConfig = Platform.select({
    ios: { iosClientId: googleIosClientId || undefined },
    android: { androidClientId: googleAndroidClientId || undefined },
    web: {
      webClientId: googleWebClientId || undefined,
      clientId: googleExpoClientId || googleWebClientId || undefined,
    },
    default: { clientId: googleExpoClientId || undefined },
  });

  const nativeGoogleClientId = Platform.select({
    ios: googleIosClientId,
    android: googleAndroidClientId,
    default: "",
  });
  const nativeGoogleRedirectUri = nativeGoogleClientId
    ? `com.googleusercontent.apps.${nativeGoogleClientId.replace(
        ".apps.googleusercontent.com",
        "",
      )}:/oauthredirect`
    : undefined;

  const [googleRequest, googleResponse, googlePromptAsync] =
    Google.useAuthRequest(
      {
        ...googleAuthClientConfig,
        scopes: ["openid", "profile", "email"],
        selectAccount: true,
      },
      nativeGoogleRedirectUri ? { native: nativeGoogleRedirectUri } : undefined,
    );

  useEffect(() => {
    if (isAuthed) router.replace("/");
  }, [isAuthed, router]);

  const finalizeLogin = async () => {
    const auth = getFirebaseAuth();
    const user = auth.currentUser;
    if (!user) {
      throw new Error("No Firebase user session");
    }
    const firebaseIdToken = await user.getIdToken();
    const { sessionToken } = await authApi.loginWithFirebase(firebaseIdToken);
    await setSessionToken(sessionToken);
    router.replace("/");
  };

  const handleEmailLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Missing info", "Email and password are required.");
      return;
    }
    if (!isFirebaseConfigured) {
      Alert.alert(
        "Firebase not configured",
        `Missing: ${missingFirebaseKeys.join(", ")}`,
      );
      return;
    }
    setSubmitting(true);
    try {
      const auth = getFirebaseAuth();
      await signInWithEmailAndPassword(auth, email.trim(), password);
      await finalizeLogin();
    } catch (err) {
      const auth = getFirebaseAuth();
      if (auth.currentUser) {
        await auth.signOut();
      }
      Alert.alert(
        "Login failed",
        err instanceof Error ? err.message : "Unable to sign in.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = () => {
    if (!isFirebaseConfigured) {
      Alert.alert("Firebase not configured", "Check app config/env settings.");
      return;
    }
    if (!hasGoogleClientId) {
      const missingClientIdLabel = Platform.select({
        ios: "googleIosClientId",
        android: "googleAndroidClientId",
        web: "googleWebClientId",
        default: "googleExpoClientId",
      });
      Alert.alert(
        "Google login not configured",
        `Missing ${missingClientIdLabel} in app config expo.extra.`,
      );
      return;
    }
    googlePromptAsync();
  };

  useEffect(() => {
    const runGoogleLogin = async () => {
      if (!googleResponse) return;
      if (googleResponse.type === "error") {
        const authError = googleResponse.error;
        Alert.alert(
          "Google login failed",
          authError?.message || authError?.code || "Authorization error.",
        );
        return;
      }
      if (googleResponse.type !== "success") return;
      const idToken =
        googleResponse.authentication?.idToken ||
        (googleResponse.params as { id_token?: string })?.id_token;
      if (!idToken) {
        Alert.alert("Google login failed", "Missing Google ID token.");
        return;
      }
      try {
        const credential = GoogleAuthProvider.credential(idToken);
        const auth = getFirebaseAuth();
        await signInWithCredential(auth, credential);
        await finalizeLogin();
      } catch (err) {
        const auth = getFirebaseAuth();
        if (auth.currentUser) {
          await auth.signOut();
        }
        Alert.alert(
          "Google login failed",
          err instanceof Error ? err.message : "Unable to sign in.",
        );
      }
    };
    runGoogleLogin();
  }, [googleResponse]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.surface }]}
    >
      <StatusBar style="auto" />
      <ImageBackground
        source={require("../../assets/species-icons/classic/hero-banner-cow.png")}
        style={styles.hero}
        imageStyle={styles.heroImage}
      >
        <View style={[styles.heroScrim, { backgroundColor: colors.surface }]} />
        <View style={styles.heroContent}>
          <Text style={[styles.title, { color: colors.text }]}>
            Welcome to Pak Vets
          </Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Login to continue
          </Text>
        </View>
      </ImageBackground>

      <View style={styles.card}>
        {!isFirebaseConfigured ? (
          <Text style={[styles.configHint, { color: colors.muted }]}>
            Firebase is not configured. Add keys in app config env/extra.
          </Text>
        ) : null}
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              color: colors.text,
            },
          ]}
          placeholder="Email"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              color: colors.text,
            },
          ]}
          placeholder="Password"
          placeholderTextColor={colors.muted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <Button
          title={submitting ? "Signing in..." : "Sign in"}
          onPress={handleEmailLogin}
          variant="primary"
          style={styles.primaryButton}
          disabled={submitting}
        />
        <Button
          title="Continue with Google"
          onPress={handleGoogleLogin}
          variant="secondary"
          style={styles.secondaryButton}
          disabled={
            !googleRequest || !hasGoogleClientId || !isFirebaseConfigured
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: {
    minHeight: 220,
    justifyContent: "flex-end",
    padding: 20,
  },
  heroImage: {
    resizeMode: "cover",
    opacity: 0.7,
  },
  heroScrim: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.6,
  },
  heroContent: {
    zIndex: 2,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 14,
    marginTop: 6,
  },
  card: {
    padding: 20,
    gap: 12,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  primaryButton: {
    marginTop: 4,
  },
  secondaryButton: {},
  configHint: {
    fontSize: 12,
    textAlign: "center",
  },
});
