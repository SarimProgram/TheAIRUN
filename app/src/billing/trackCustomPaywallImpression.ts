import { NativeModules, Platform } from 'react-native';
import Constants from 'expo-constants';

import { trackEvent } from '@/src/analytics/analytics';

type TrackCustomPaywallImpressionParams = {
  paywallId?: string;
  offeringId?: string | null;
  source?: string;
  paywallReason?: string | null;
  packageCount?: number;
};

let warnedMissingTrackCustomPaywallImpression = false;

function hasNativeRevenueCatModule() {
  return !!(NativeModules as any)?.RNPurchases;
}

function isExpoGoRuntime() {
  return (Constants as any)?.appOwnership === 'expo';
}

function getPurchasesModule() {
  if (Platform.OS === 'web') return null;
  if (isExpoGoRuntime() || !hasNativeRevenueCatModule()) return null;

  try {
    // Loaded dynamically because older local builds may not have the native module available.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const purchasesModule = require('react-native-purchases');
    return purchasesModule?.default ?? purchasesModule;
  } catch {
    return null;
  }
}

export async function trackCustomPaywallImpression(
  params: TrackCustomPaywallImpressionParams = {}
) {
  const { paywallId, offeringId, source, paywallReason, packageCount } = params;

  await trackEvent('paywall_impression', {
    paywall_id: paywallId ?? 'custom-paywall',
    offering_id: offeringId ?? undefined,
    source: source ?? 'paywall_route',
    paywall_reason: paywallReason ?? undefined,
    package_count: packageCount,
  });

  const purchases = getPurchasesModule();
  const revenueCatTracker = purchases?.trackCustomPaywallImpression;

  if (typeof revenueCatTracker !== 'function') {
    if (!warnedMissingTrackCustomPaywallImpression) {
      warnedMissingTrackCustomPaywallImpression = true;
      console.log(
        '[Billing] RevenueCat trackCustomPaywallImpression is unavailable. Upgrade react-native-purchases to 9.14.0+ to enable native paywall impression tracking.'
      );
    }
    return;
  }

  try {
    const revenueCatParams = {
      ...(paywallId ? { paywallId } : {}),
      ...(offeringId ? { offeringId } : {}),
    };

    if (Object.keys(revenueCatParams).length === 0) {
      await revenueCatTracker.call(purchases);
      return;
    }

    await revenueCatTracker.call(purchases, revenueCatParams);
  } catch (error) {
    console.log('[Billing] Failed to track RevenueCat paywall impression:', error);
  }
}
