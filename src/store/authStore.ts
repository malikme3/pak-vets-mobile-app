import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { getFirebaseAuth } from "../services/firebase";
import { authApi } from "../services/authApi";

export type AuthTokens = {
  sessionToken: string;
  expiresAt: number;
};

type AuthState = {
  status: "loading" | "signedOut" | "signedIn";
  tokens: AuthTokens | null;
  hydrate: () => Promise<void>;
  refreshIfNeeded: () => Promise<void>;
  setSessionToken: (sessionToken: string) => Promise<void>;
  clear: () => Promise<void>;
  getAccessToken: () => string | null;
};

const STORAGE_KEY = "pakvets.auth.tokens";

export const useAuthStore = create<AuthState>((set, get) => ({
  status: "loading",
  tokens: null,
  hydrate: async () => {
    try {
      const raw = await SecureStore.getItemAsync(STORAGE_KEY);
      if (!raw) {
        set({ status: "signedOut", tokens: null });
        return;
      }
      const parsed = JSON.parse(raw) as AuthTokens;
      if (!parsed?.sessionToken) {
        set({ status: "signedOut", tokens: null });
        return;
      }
      if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
        set({ status: "signedOut", tokens: null });
        return;
      }
      set({ status: "signedIn", tokens: parsed });
      await get().refreshIfNeeded();
    } catch {
      set({ status: "signedOut", tokens: null });
    }
  },
  refreshIfNeeded: async () => {
    const tokens = get().tokens;
    if (!tokens) return;
    const expiresIn = tokens.expiresAt - Date.now();
    if (expiresIn > 5 * 60 * 1000) return;
    try {
      const auth = getFirebaseAuth();
      const user = auth.currentUser;
      if (!user) {
        await get().clear();
        return;
      }
      const firebaseIdToken = await user.getIdToken(true);
      const response = await authApi.loginWithFirebase(firebaseIdToken);
      await get().setSessionToken(response.sessionToken);
    } catch {
      await get().clear();
    }
  },
  setSessionToken: async (sessionToken) => {
    const expiresAt = Date.now() + 6 * 24 * 60 * 60 * 1000;
    const tokens = { sessionToken, expiresAt };
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(tokens));
    set({ status: "signedIn", tokens });
  },
  clear: async () => {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
    set({ status: "signedOut", tokens: null });
  },
  getAccessToken: () => get().tokens?.sessionToken ?? null,
}));
