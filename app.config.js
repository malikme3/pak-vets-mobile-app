const appJson = require("./app.json");

module.exports = ({ config }) => {
  const baseExpoConfig = appJson.expo || {};
  const firebaseApiKey =
    process.env.FIREBASE_API_KEY ||
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY ||
    "";

  return {
    ...baseExpoConfig,
    ...config,
    extra: {
      ...(baseExpoConfig.extra || {}),
      ...(config?.extra || {}),
      firebaseApiKey,
    },
  };
};
