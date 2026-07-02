import { Alert, PermissionsAndroid, Platform } from 'react-native';
import {
  requestAuthorization,
  type QuantityTypeIdentifier,
} from '@kingstinct/react-native-healthkit';
import GoogleFit, { Scopes } from 'react-native-google-fit';

import { setStepPermissionConsent } from '../config/healthPermissions';
import { registerBackgroundStepSync } from '../tasks/backgroundStepSync';

const HK_STEP_COUNT = 'HKQuantityTypeIdentifierStepCount' as QuantityTypeIdentifier;

export async function requestStepPermissions(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    const granted = await requestAuthorization({
      toRead: [HK_STEP_COUNT],
      toShare: [],
    });

    if (!granted) {
      Alert.alert(
        'Permission Required',
        'Step access was not granted. You can try again later from home.'
      );
      return false;
    }
  } else if (Platform.OS === 'android') {
    const activityPermission = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION,
      {
        title: 'Step Data Access',
        message: 'Allow activity access to read your step count for coaching insights.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      }
    );

    if (activityPermission !== PermissionsAndroid.RESULTS.GRANTED) {
      Alert.alert(
        'Step Permission Required',
        'Step data permission was not granted. You can try again later from home.'
      );
      return false;
    }

    const authResult = await GoogleFit.authorize({
      scopes: [Scopes.FITNESS_ACTIVITY_READ],
    });

    if (!authResult?.success) {
      Alert.alert(
        'Permission Required',
        'Google Fit access for step data was not granted. You can try again later from home.'
      );
      return false;
    }
  } else {
    return false;
  }

  await setStepPermissionConsent(true);
  await registerBackgroundStepSync();
  return true;
}
