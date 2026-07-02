import { Platform } from 'react-native';

type AnalyticsParams = Record<string, string | number | boolean | null | undefined>;

let warnedMissingAnalytics = false;

const getAnalyticsModule = () => {
    try {
        // Loaded dynamically so the app can still boot before native deps are installed.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const analyticsModule = require('@react-native-firebase/analytics');
        const analyticsFactory = analyticsModule?.default ?? analyticsModule;
        return typeof analyticsFactory === 'function' ? analyticsFactory() : null;
    } catch (error) {
        if (!warnedMissingAnalytics) {
            warnedMissingAnalytics = true;
            console.log('Firebase Analytics unavailable:', error);
        }
        return null;
    }
};

const sanitizeParams = (params?: AnalyticsParams) => {
    if (!params) return undefined;

    return Object.fromEntries(
        Object.entries(params).filter(([, value]) => value !== undefined)
    );
};

export const analyticsEnabled = () => Platform.OS === 'ios' || Platform.OS === 'android';

export async function trackEvent(name: string, params?: AnalyticsParams) {
    if (!analyticsEnabled()) return;

    const analytics = getAnalyticsModule();
    if (!analytics) return;

    try {
        await analytics.logEvent(name, sanitizeParams(params));
    } catch (error) {
        console.log(`Failed to track analytics event "${name}":`, error);
    }
}

export async function trackScreen(screenName: string, screenClass?: string) {
    if (!analyticsEnabled()) return;

    const analytics = getAnalyticsModule();
    if (!analytics) return;

    try {
        await analytics.logScreenView({
            screen_name: screenName,
            screen_class: screenClass ?? screenName,
        });
    } catch (error) {
        console.log(`Failed to track screen "${screenName}":`, error);
    }
}

export async function setAnalyticsUserId(userId: string | null) {
    if (!analyticsEnabled()) return;

    const analytics = getAnalyticsModule();
    if (!analytics) return;

    try {
        await analytics.setUserId(userId);
    } catch (error) {
        console.log('Failed to set analytics user id:', error);
    }
}

export async function setAnalyticsUserProperties(properties: Record<string, string | null | undefined>) {
    if (!analyticsEnabled()) return;

    const analytics = getAnalyticsModule();
    if (!analytics) return;

    try {
        await Promise.all(
            Object.entries(properties).map(([key, value]) =>
                analytics.setUserProperty(key, value ?? null)
            )
        );
    } catch (error) {
        console.log('Failed to set analytics user properties:', error);
    }
}
