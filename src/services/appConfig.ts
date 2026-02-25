import Constants from "expo-constants";

type ExpoExtra = {
  firebaseApiKey?: string;
  firebaseAuthDomain?: string;
  firebaseProjectId?: string;
  firebaseAppId?: string;
  firebaseMessagingSenderId?: string;
  firebaseStorageBucket?: string;
  googleWebClientId?: string;
  googleExpoClientId?: string;
  googleIosClientId?: string;
  googleAndroidClientId?: string;
};

export function getAppExtra(): ExpoExtra {
  const expoConfigExtra = (Constants.expoConfig?.extra || {}) as ExpoExtra;
  const manifestExtra = ((
    Constants as unknown as { manifest?: { extra?: ExpoExtra } }
  ).manifest?.extra || {}) as ExpoExtra;
  const manifest2Extra = ((
    Constants as unknown as {
      manifest2?: { extra?: { expoClient?: ExpoExtra } };
    }
  ).manifest2?.extra?.expoClient || {}) as ExpoExtra;

  return {
    ...manifest2Extra,
    ...manifestExtra,
    ...expoConfigExtra,
  };
}
