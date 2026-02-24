const appJson = require("./app.json");

module.exports = ({ config }) => {
  const baseExpoConfig = appJson.expo || {};
  const baseExtra = baseExpoConfig.extra || {};
  const incomingExtra = config?.extra || {};

  const firebaseApiKey =
    process.env.FIREBASE_API_KEY ||
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY ||
    incomingExtra.firebaseApiKey ||
    baseExtra.firebaseApiKey ||
    "";
  const firebaseAuthDomain =
    process.env.FIREBASE_AUTH_DOMAIN ||
    incomingExtra.firebaseAuthDomain ||
    baseExtra.firebaseAuthDomain ||
    "";
  const firebaseProjectId =
    process.env.FIREBASE_PROJECT_ID ||
    incomingExtra.firebaseProjectId ||
    baseExtra.firebaseProjectId ||
    "";
  const firebaseAppId =
    process.env.FIREBASE_APP_ID ||
    incomingExtra.firebaseAppId ||
    baseExtra.firebaseAppId ||
    "";
  const firebaseMessagingSenderId =
    process.env.FIREBASE_MESSAGING_SENDER_ID ||
    incomingExtra.firebaseMessagingSenderId ||
    baseExtra.firebaseMessagingSenderId ||
    "";
  const firebaseStorageBucket =
    process.env.FIREBASE_STORAGE_BUCKET ||
    incomingExtra.firebaseStorageBucket ||
    baseExtra.firebaseStorageBucket ||
    "";
  const googleWebClientId =
    process.env.GOOGLE_WEB_CLIENT_ID ||
    incomingExtra.googleWebClientId ||
    baseExtra.googleWebClientId ||
    "";
  const googleExpoClientId =
    process.env.GOOGLE_EXPO_CLIENT_ID ||
    incomingExtra.googleExpoClientId ||
    baseExtra.googleExpoClientId ||
    "";
  const googleIosClientId =
    process.env.GOOGLE_IOS_CLIENT_ID ||
    incomingExtra.googleIosClientId ||
    baseExtra.googleIosClientId ||
    "";
  const googleAndroidClientId =
    process.env.GOOGLE_ANDROID_CLIENT_ID ||
    incomingExtra.googleAndroidClientId ||
    baseExtra.googleAndroidClientId ||
    "";

  return {
    ...baseExpoConfig,
    ...config,
    extra: {
      ...baseExtra,
      ...incomingExtra,
      firebaseApiKey,
      firebaseAuthDomain,
      firebaseProjectId,
      firebaseAppId,
      firebaseMessagingSenderId,
      firebaseStorageBucket,
      googleWebClientId,
      googleExpoClientId,
      googleIosClientId,
      googleAndroidClientId,
    },
  };
};
