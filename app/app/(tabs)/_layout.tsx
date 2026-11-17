import React from 'react';
import { Easing } from 'react-native';
import { Tabs } from 'expo-router';
import FloatingTabBar from '@/components/navigation/FloatingTabBar';

const TAB_FADE_TRANSITION = {
  animation: 'timing' as const,
  config: { duration: 200, easing: Easing.out(Easing.quad) },
};

export default function TabsLayout() {
  return (
    <Tabs
      detachInactiveScreens={false}
      tabBar={props => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        transitionSpec: TAB_FADE_TRANSITION,
        freezeOnBlur: true,
        lazy: true,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="Plans" options={{ title: "Plans" }} />
      <Tabs.Screen name="activity" options={{ title: "Log" }} />
      <Tabs.Screen name="Run" options={{ title: "Run" }} />
      <Tabs.Screen name="Partner" options={{ title: "Partner" }} />

      {/* Hidden Utility/Sub-screens */}
      <Tabs.Screen name="marketplace" options={{ href: null }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
      <Tabs.Screen name="Race" options={{ href: null }} />
      <Tabs.Screen name="Login" options={{ href: null }} />
      <Tabs.Screen name="Onboarding" options={{ href: null }} />
      <Tabs.Screen name="PlanMaker" options={{ href: null }} />
      <Tabs.Screen name="quest" options={{ href: null }} />
    </Tabs>
  );
}
