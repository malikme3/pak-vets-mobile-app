import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ImageBackground,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as AuthSession from "expo-auth-session";
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
import { getFirebaseAuth, getFirebaseConfig } from "../services/firebase";
import Constants from "expo-constants";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { status, setSessionToken } = useAuthStore();
  const isAuthed = status === "signedIn";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const firebaseConfig = getFirebaseConfig();
  const googleConfig = (Constants.expoConfig?.extra as {
    googleWebClientId?: string;
    googleExpoClientId?: string;
    googleIosClientId?: string;
    googleAndroidClientId?: string;
  }) || {};

  const isFirebaseConfigured =
    Boolean(firebaseConfig.apiKey) &&
    Boolean(firebaseConfig.projectId) &&
    Boolean(firebaseConfig.appId);

  const googleClientId =
    googleConfig.googleExpoClientId ||
    googleConfig.googleWebClientId ||
    googleConfig.googleIosClientId ||
    googleConfig.googleAndroidClientId ||
    "";

  const discovery = AuthSession.useAutoDiscovery("https://accounts.google.com");

  const redirectUri = AuthSession.makeRedirectUri({
    scheme: "pak-vets",
    path: "auth",
  });

  const baseRequestConfig = useMemo(
    () => ({
      clientId: googleClientId,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
      scopes: ["openid", "profile", "email"],
      redirectUri,
    }),
    [googleClientId, redirectUri],
  );

  const [googleRequest, googleResponse, googlePromptAsync] =
    AuthSession.useAuthRequest(baseRequestConfig, discovery);

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
      Alert.alert("Firebase not configured", "Check app.json settings.");
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

  useEffect(() => {
    const runGoogleLogin = async () => {
      if (!googleResponse || googleResponse.type !== "success") return;
      if (!discovery || !googleRequest) return;
      try {
        const tokenResult = await AuthSession.exchangeCodeAsync(
          {
            clientId: googleClientId,
            code: googleResponse.params.code,
            redirectUri,
            extraParams: {
              code_verifier: googleRequest.codeVerifier ?? "",
            },
          },
          discovery,
        );
        if (!tokenResult.idToken) {
          throw new Error("Missing Google ID token");
        }
        const credential = GoogleAuthProvider.credential(
          tokenResult.idToken,
          tokenResult.accessToken,
        );
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
  }, [
    discovery,
    googleClientId,
    googleRequest,
    googleResponse,
    redirectUri,
  ]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surface }]}>
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
            Firebase is not configured. Add keys in app.json extra.
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
          disabled={!isFirebaseConfigured || submitting}
        />
        <Button
          title="Continue with Google"
          onPress={() => googlePromptAsync({ useProxy: false })}
          variant="secondary"
          style={styles.secondaryButton}
          disabled={!googleRequest || !googleClientId || !isFirebaseConfigured}
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
