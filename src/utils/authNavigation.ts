const PUBLIC_ROUTES = new Set([
  "farm-vitals",
  "create-farm",
  "farm-dashboard",
  "add-farm-animal",
  "farm-animal",
  "farm-photos",
  "farm-post",
  "add-farm-history",
  "farm-history",
  "login",
  "auth",
  "oauthredirect",
  "expo-auth-session",
]);

export function getAuthRedirect(
  status: "loading" | "signedOut" | "signedIn",
  firstSegment: string | undefined,
): "/farm-vitals" | null {
  if (status === "signedOut" && !PUBLIC_ROUTES.has(firstSegment ?? "")) {
    return "/farm-vitals";
  }
  return null;
}
