// app/lib/map-provider.ts

import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { PROVIDER_GOOGLE, type Provider } from 'react-native-maps';

function hasRealApiKey(key: unknown): boolean {
    return typeof key === 'string' && key.trim().length > 0 && !key.startsWith('YOUR_');
}

function getMapsPluginProps(): Record<string, unknown> {
    const plugins = Constants.expoConfig?.plugins ?? [];
    for (const plugin of plugins) {
        if (Array.isArray(plugin) && plugin[0] === 'react-native-maps') {
            return (plugin[1] as Record<string, unknown> | undefined) ?? {};
        }
    }
    return {};
}

// The Google Maps iOS SDK is only linked when the plugin has an iOS key;
// requesting PROVIDER_GOOGLE without it crashes the map.
const isGoogleMapsLinkedOnIOS = hasRealApiKey(getMapsPluginProps().iosGoogleMapsApiKey);

/** Google Maps wherever it is available, so custom map styles can render. */
export function getStyledMapProvider(): Provider {
    if (Platform.OS === 'android') return PROVIDER_GOOGLE;
    if (Platform.OS === 'ios' && isGoogleMapsLinkedOnIOS) return PROVIDER_GOOGLE;
    return undefined;
}
