import { Alert, Linking } from 'react-native';
import * as Location from 'expo-location';

import { APP_NAME } from '@/constants/branding';

const openSettingsButtons = [
  { text: 'Not Now', style: 'cancel' as const },
  { text: 'Open Settings', onPress: () => { void Linking.openSettings(); } },
];

/**
 * Ensures foreground location access, explaining how to fix it when it can't be granted.
 * iOS only shows the system prompt once; after "Don't Allow" the user must change it in Settings.
 */
export async function ensureForegroundLocationPermission(): Promise<boolean> {
  const servicesEnabled = await Location.hasServicesEnabledAsync().catch(() => true);
  if (!servicesEnabled) {
    Alert.alert(
      'Location Services Unavailable',
      `Location is turned off or restricted on this device. Turn on Settings › Privacy & Security › Location Services, and check that Screen Time › Content & Privacy Restrictions allows Location changes, so ${APP_NAME} can track your route and distance.`,
      openSettingsButtons
    );
    return false;
  }

  let permission = await Location.getForegroundPermissionsAsync();
  if (permission.status !== 'granted' && permission.canAskAgain) {
    permission = await Location.requestForegroundPermissionsAsync();
  }

  if (permission.status !== 'granted') {
    Alert.alert(
      'Allow Location Access',
      `${APP_NAME} needs your location to track your route and distance. In Settings, tap Location and choose "While Using the App".`,
      openSettingsButtons
    );
    return false;
  }

  return true;
}
