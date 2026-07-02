import AsyncStorage from '@react-native-async-storage/async-storage';

export const STEP_PERMISSION_GRANTED_KEY = 'health.stepPermissionGranted';

export async function hasStepPermissionConsent(): Promise<boolean> {
  const value = await AsyncStorage.getItem(STEP_PERMISSION_GRANTED_KEY);
  return value === 'true';
}

export async function setStepPermissionConsent(granted: boolean): Promise<void> {
  if (granted) {
    await AsyncStorage.setItem(STEP_PERMISSION_GRANTED_KEY, 'true');
    return;
  }

  await AsyncStorage.removeItem(STEP_PERMISSION_GRANTED_KEY);
}
