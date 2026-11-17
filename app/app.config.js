const { expo } = require("./app.json");

const iosGoogleMapsApiKey = process.env.IOS_GOOGLE_MAPS_API_KEY;
const androidGoogleMapsApiKey = process.env.ANDROID_GOOGLE_MAPS_API_KEY;

// The Google Maps iOS SDK is only linked when an iOS key is present; without it iOS uses Apple Maps.
const plugins = expo.plugins.map((plugin) => {
  if (!Array.isArray(plugin) || plugin[0] !== "react-native-maps") return plugin;
  const { iosGoogleMapsApiKey: _placeholder, ...props } = plugin[1] ?? {};
  return [
    "react-native-maps",
    {
      ...props,
      ...(androidGoogleMapsApiKey ? { androidGoogleMapsApiKey } : {}),
      ...(iosGoogleMapsApiKey ? { iosGoogleMapsApiKey } : {}),
    },
  ];
});

module.exports = {
  ...expo,
  plugins,
  ios: {
    ...expo.ios,
    googleServicesFile:
      process.env.GOOGLE_SERVICE_INFO_PLIST ?? "./GoogleService-Info.plist",
  },
  android: {
    ...expo.android,
    googleServicesFile:
      process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json",
  },
};
