import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Platform } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/src/auth/authContext'; // adjust if your path differs
import { syncPendingRuns } from '@/lib/run-storage';
import { TabBarProvider } from '@/contexts/TabBarContext';
import { ChatProvider } from '@/contexts/ChatContext';
import { GlobalChatNotification } from '@/components/chat/GlobalChatNotification';
import PushNotificationRegistrar from '@/components/chat/PushNotificationRegistrar';
import LocalNotificationScheduler from '@/components/notifications/LocalNotificationScheduler';
import NotificationPermissionBootstrap from '@/components/notifications/NotificationPermissionBootstrap';
import PartnerSurfaceRegistrar from '@/components/partner/PartnerSurfaceRegistrar';
import { EntitlementProvider, useEntitlement } from '@/src/billing';
import { RaceSocketProvider } from '@/contexts/RaceSocketContext';
import GlobalRaceInviteOverlay from '@/components/race/GlobalRaceInviteOverlay';
import { hasStepPermissionConsent } from '@/config/healthPermissions';
import { trackScreen } from '@/src/analytics/analytics';
import {
  loadOnboardingCheckpoint,
  subscribeToOnboardingCheckpoint,
  type OnboardingCheckpoint,
} from '@/src/onboarding/checkpoint';

import { registerBackgroundStepSync } from '../tasks/backgroundStepSync';

export const unstable_settings = {
  anchor: '(tabs)',
};

function SyncRunsOnAppOpen() {
  const { authFetch, isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (loading || !isAuthenticated) return;
    syncPendingRuns(authFetch).catch(() => {});
  }, [loading, isAuthenticated, authFetch]);

  return null;
}

function PaywallRouteGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { access, hasAccess, loading: entitlementLoading, refreshAccess } = useEntitlement();
  const paywallCheckAttemptedRef = useRef(false);
  const checkpointNotificationReceivedRef = useRef(false);
  const [onboardingCheckpoint, setOnboardingCheckpoint] = useState<OnboardingCheckpoint | null>(null);
  const [onboardingCheckpointLoading, setOnboardingCheckpointLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = subscribeToOnboardingCheckpoint((checkpoint) => {
      if (!cancelled) {
        checkpointNotificationReceivedRef.current = true;
        setOnboardingCheckpoint(checkpoint);
      }
    });

    loadOnboardingCheckpoint()
      .then((checkpoint) => {
        if (!cancelled && !checkpointNotificationReceivedRef.current) {
          setOnboardingCheckpoint(checkpoint);
        }
      })
      .finally(() => {
        if (!cancelled) setOnboardingCheckpointLoading(false);
      });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (authLoading || entitlementLoading || onboardingCheckpointLoading) return;
    if (!isAuthenticated) {
      paywallCheckAttemptedRef.current = false;
      return;
    }

    const onboardingIncomplete = onboardingCheckpoint?.completed === false;
    const isOnboardingRoute = pathname.startsWith('/Onboarding');

    if (onboardingIncomplete) {
      paywallCheckAttemptedRef.current = false;
      if (!isOnboardingRoute) router.replace('/Onboarding');
      return;
    }

    const allowed =
      pathname === '/paywall' ||
      pathname.startsWith('/Login') ||
      isOnboardingRoute ||
      pathname.startsWith('/(auth)');

    if (allowed) {
      paywallCheckAttemptedRef.current = false;
      return;
    }

    const backendRequiresPaywall = !!access?.paywallReason;

    if (hasAccess && !backendRequiresPaywall) {
      paywallCheckAttemptedRef.current = false;
      return;
    }

    if (!paywallCheckAttemptedRef.current) {
      paywallCheckAttemptedRef.current = true;
      refreshAccess({ syncRevenueCat: true }).catch(() => {});
      return;
    }

    if (!hasAccess || backendRequiresPaywall) {
      router.replace('/paywall');
    }
  }, [
    access?.paywallReason,
    authLoading,
    entitlementLoading,
    hasAccess,
    isAuthenticated,
    onboardingCheckpoint?.completed,
    onboardingCheckpointLoading,
    pathname,
    refreshAccess,
    router,
  ]);

  return null;
}

function UnauthenticatedEntryRedirect() {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (loading || isAuthenticated) return;

    const isDefaultEntryRoute =
      pathname === '/' ||
      pathname === '/(tabs)' ||
      pathname === '/(tabs)/index';

    const isAllowedUnauthedRoute =
      pathname.startsWith('/Onboarding') ||
      pathname.startsWith('/Login') ||
      pathname.startsWith('/welcome') ||
      pathname.startsWith('/paywall') ||
      pathname.startsWith('/(auth)');

    if (isDefaultEntryRoute && !isAllowedUnauthedRoute) {
      router.replace('/Onboarding');
    }
  }, [isAuthenticated, loading, pathname, router]);

  return null;
}

function ScreenAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    trackScreen(pathname, pathname).catch(() => {});
  }, [pathname]);

  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  // Register background step sync task on app start
  useEffect(() => {
    let cancelled = false;

    const preloadNativeWidgets = () => {
      if (Platform.OS !== 'ios') {
        return;
      }

      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('../widgets/PartnerKcalsWidget');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('../widgets/PartnerLiveActivity');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('../widgets/LogActionWidget');
      } catch (error) {
        console.warn('[RootLayout] Native widgets unavailable in this runtime:', error);
      }
    };

    const maybeRegisterBackgroundSync = async () => {
      const hasConsent = await hasStepPermissionConsent();
      if (!hasConsent || cancelled) return;

      await registerBackgroundStepSync();

      if (Platform.OS !== 'ios') {
        return;
      }

      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { registerIOSHealthKitStepObserver } = require('../tasks/healthkitStepObserver') as typeof import('../tasks/healthkitStepObserver');
        await registerIOSHealthKitStepObserver();
      } catch (error) {
        console.warn('[RootLayout] HealthKit observer unavailable in this runtime:', error);
      }
    };

    preloadNativeWidgets();
    maybeRegisterBackgroundSync();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <EntitlementProvider>
          <RaceSocketProvider>
            <ChatProvider>
              <TabBarProvider>
                <SyncRunsOnAppOpen />
                <PaywallRouteGuard />
                <UnauthenticatedEntryRedirect />
                <ScreenAnalytics />
                <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                  <Stack>
                    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                    <Stack.Screen name="paywall" options={{ headerShown: false }} />
                    <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
                    <Stack.Screen name="welcome" options={{ headerShown: false }} />
                    <Stack.Screen name="runs/allruns" options={{ headerShown: false }} />
                    <Stack.Screen name="runs/easyrun" options={{ headerShown: false }} />
                    <Stack.Screen name="race/history" options={{ headerShown: false }} />
                    <Stack.Screen name="chat-fullscreen" options={{ headerShown: false }} />
                    <Stack.Screen name="remaining-steps" options={{ presentation: 'modal', headerShown: false }} />
                    <Stack.Screen name="kcal-detail" options={{ presentation: 'modal', headerShown: false }} />
                  </Stack>
                  <PushNotificationRegistrar />
                  <NotificationPermissionBootstrap />
                  <PartnerSurfaceRegistrar />
                  <LocalNotificationScheduler />
                  <GlobalChatNotification />
                  <GlobalRaceInviteOverlay />
                  <StatusBar style="auto" />
                </ThemeProvider>
              </TabBarProvider>
            </ChatProvider>
          </RaceSocketProvider>
        </EntitlementProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
