import Constants from "expo-constants";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

type FirebaseConfig = {
  apiKey: string;
  authDomain?: string;
  projectId: string;
  appId: string;
  messagingSenderId?: string;
  storageBucket?: string;
};

const extra = Constants.expoConfig?.extra as
  | {
      firebaseApiKey?: string;
      firebaseAuthDomain?: string;
      firebaseProjectId?: string;
      firebaseAppId?: string;
      firebaseMessagingSenderId?: string;
      firebaseStorageBucket?: string;
    }
  | undefined;

const firebaseConfig: FirebaseConfig = {
  apiKey: extra?.firebaseApiKey ?? "",
  authDomain: extra?.firebaseAuthDomain ?? undefined,
  projectId: extra?.firebaseProjectId ?? "",
  appId: extra?.firebaseAppId ?? "",
  messagingSenderId: extra?.firebaseMessagingSenderId ?? undefined,
  storageBucket: extra?.firebaseStorageBucket ?? undefined,
};

export function getFirebaseConfig(): FirebaseConfig {
  return firebaseConfig;
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
