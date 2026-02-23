import { useEffect } from "react";
import type { ReactNode } from "react";
import { useAuthStore } from "../store/authStore";
import { useRouter } from "expo-router";

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const hydrate = useAuthStore((state) => state.hydrate);
  const refreshIfNeeded = useAuthStore((state) => state.refreshIfNeeded);
  const tokens = useAuthStore((state) => state.tokens);
  const status = useAuthStore((state) => state.status);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (status !== "signedIn" || !tokens) return;
    const now = Date.now();
    const refreshInMs = Math.max(tokens.expiresAt - now - 5 * 60 * 1000, 1000);
    const timer = setTimeout(() => {
      refreshIfNeeded();
    }, refreshInMs);
    return () => clearTimeout(timer);
  }, [refreshIfNeeded, status, tokens]);

  useEffect(() => {
    if (status === "signedOut") {
      router.replace("/login");
    }
  }, [router, status]);

  return <>{children}</>;
}
