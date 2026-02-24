import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getAppExtra } from "./appConfig";

type FirebaseConfig = {
  apiKey: string;
  authDomain?: string;
  projectId: string;
  appId: string;
  messagingSenderId?: string;
  storageBucket?: string;
};

function isLikelyFirebaseApiKey(value: string): boolean {
  return /^AIza[0-9A-Za-z_-]{20,}$/.test(value);
}

const extra = getAppExtra();

const firebaseConfig: FirebaseConfig = {
  apiKey: extra?.firebaseApiKey ?? "",
  authDomain: extra?.firebaseAuthDomain ?? undefined,
  projectId: extra?.firebaseProjectId ?? "",
  appId: extra?.firebaseAppId ?? "",
  messagingSenderId: extra?.firebaseMessagingSenderId ?? undefined,
  storageBucket: extra?.firebaseStorageBucket ?? undefined,
};

let hasLoggedConfigStatus = false;

function logFirebaseConfigStatus(): void {
  if (hasLoggedConfigStatus || !__DEV__) return;
  hasLoggedConfigStatus = true;

  const status = {
    firebaseApiKey: Boolean(firebaseConfig.apiKey),
    firebaseApiKeyLooksValid: isLikelyFirebaseApiKey(firebaseConfig.apiKey),
    firebaseProjectId: Boolean(firebaseConfig.projectId),
    firebaseAppId: Boolean(firebaseConfig.appId),
    firebaseAuthDomain: Boolean(firebaseConfig.authDomain),
    firebaseMessagingSenderId: Boolean(firebaseConfig.messagingSenderId),
    firebaseStorageBucket: Boolean(firebaseConfig.storageBucket),
  };

  const missingRequired = Object.entries({
    FIREBASE_API_KEY: status.firebaseApiKey && status.firebaseApiKeyLooksValid,
    FIREBASE_PROJECT_ID: status.firebaseProjectId,
    FIREBASE_APP_ID: status.firebaseAppId,
  })
    .filter(([, present]) => !present)
    .map(([key]) => key);

  console.log("[Firebase Config]", {
    ...status,
    missingRequired,
  });
}

export function getFirebaseConfig(): FirebaseConfig {
  logFirebaseConfigStatus();
  return firebaseConfig;
}

export function hasValidFirebaseConfig(): boolean {
  return (
    isLikelyFirebaseApiKey(firebaseConfig.apiKey) &&
    Boolean(firebaseConfig.projectId) &&
    Boolean(firebaseConfig.appId)
  );
}

export function getFirebaseApp() {
  if (getApps().length > 0) return getApp();
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId) {
    throw new Error("Firebase is not configured. Check app config extra/env.");
  }
  return initializeApp(firebaseConfig);
}

export function getFirebaseAuth() {
  return getAuth(getFirebaseApp());
}
