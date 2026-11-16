const PUBLIC_ROUTES = new Set([
  "farm-vitals",
  "create-farm",
  "farm-dashboard",
  "add-farm-animal",
  "login",
  "auth",
  "oauthredirect",
  "expo-auth-session",
]);

export function getAuthRedirect(
  status: "loading" | "signedOut" | "signedIn",
  firstSegment: string | undefined,
): "/farm-vitals" | "/" | null {
  if (status === "signedOut" && !PUBLIC_ROUTES.has(firstSegment ?? "")) {
    return "/farm-vitals";
  }
  if (status === "signedIn" && firstSegment === "farm-vitals") return "/";
  return null;
}
