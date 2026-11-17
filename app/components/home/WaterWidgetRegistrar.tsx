import { useEffect } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';

import { subscribeToWaterChanges } from '@/hooks/useWaterSync';
import { syncWaterWidget } from '@/lib/water-widget';

export default function WaterWidgetRegistrar() {
  useEffect(() => {
    if (Platform.OS !== 'ios') {
      return;
    }

    syncWaterWidget().catch(() => {});

    const unsubscribeWater = subscribeToWaterChanges(() => {
      syncWaterWidget().catch(() => {});
    });

    const appStateSubscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        syncWaterWidget().catch(() => {});
      }
    });

    let interactionSubscription: { remove: () => void } | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { addUserInteractionListener } = require('expo-widgets') as typeof import('expo-widgets');
      interactionSubscription = addUserInteractionListener((event) => {
        if (event.source === 'WaterWidget') {
          syncWaterWidget().catch(() => {});
        }
      });
    } catch {}

    return () => {
      unsubscribeWater();
      appStateSubscription.remove();
      interactionSubscription?.remove();
    };
  }, []);

  return null;
}
