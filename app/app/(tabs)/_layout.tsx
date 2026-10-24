// app/app/(tabs)/_layout.tsx

import React, { useRef, useEffect, useCallback } from "react";
import { Tabs, useRouter } from "expo-router";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Animated,
  Image,
  Easing,
} from "react-native";
import AnimatedReanimated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  Easing as ReanimatedEasing,
  type SharedValue,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTabBar } from '@/contexts/TabBarContext';
import { useWalkingGoalPlan } from '@/hooks/useWalkingGoalPlan';
import { useEntitlement } from '@/src/billing';
import { useAuth } from '@/src/auth/authContext';
import { getImageChatAvatarSource } from '@/utils/genderMascot';
import { BlurView } from "expo-blur";

const BUTTER_SPRING = {
  damping: 28,
  stiffness: 175,
  mass: 1,
  overshootClamping: true,
};

const BUTTER_TIMING = {
  duration: 320,
  easing: ReanimatedEasing.bezier(0.33, 1, 0.68, 1),
};

const TAB_FADE_TRANSITION = {
  animation: 'timing' as const,
  config: {
    duration: 200,
    easing: Easing.out(Easing.quad),
  },
};

const VISIBLE_TABS = ['index', 'Plans', 'Run', 'Race', 'Partner'] as const;
type VisibleTab = (typeof VISIBLE_TABS)[number];

type TabLayout = { x: number; width: number };

const COLORS = {
  primary: '#FF3B3B',
  textMuted: '#64748B',
};

const TAB_ICONS = {
  Partner: require('../../assets/tabs/home.png'),
  Plans: require('../../assets/tabs/plans.png'),
  Run: require('../../assets/tabs/run.png'),
  Race: require('../../assets/tabs/race.png'),
} as const;

function AnimatedTabIcon({
  focused,
  children,
  style,
}: {
  focused: boolean;
  children: React.ReactNode;
  style?: object;
}) {
  const scale = useSharedValue(focused ? 1 : 0.94);
  const opacity = useSharedValue(focused ? 1 : 0.68);

  useEffect(() => {
    scale.value = withSpring(focused ? 1 : 0.94, BUTTER_SPRING);
    opacity.value = withTiming(focused ? 1 : 0.68, BUTTER_TIMING);
  }, [focused, opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <AnimatedReanimated.View style={[style, animatedStyle]}>
      {children}
    </AnimatedReanimated.View>
  );
}

function GlassFluidIndicator({
  x,
  width,
  runTabActive,
}: {
  x: SharedValue<number>;
  width: SharedValue<number>;
  runTabActive: SharedValue<number>;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const w = width.value;
    const runMix = runTabActive.value;
    const pillHeight = 48;
    const height = pillHeight + (w - pillHeight) * runMix;
    const radius = 18 + ((w / 2) - 18) * runMix;

    return {
      transform: [{ translateX: x.value }],
      width: w,
      height,
      borderRadius: radius,
      top: 4 - 2 * runMix,
    };
  });

  return (
    <AnimatedReanimated.View style={[styles.glassBlock, animatedStyle]} pointerEvents="none">
      {process.env.EXPO_OS === 'ios' ? (
        <BlurView intensity={100} tint="light" style={StyleSheet.absoluteFillObject} />
      ) : null}
      <View style={styles.glassBlockSheen} />
      <View style={styles.glassBlockTint} />
    </AnimatedReanimated.View>
  );
}

function CustomTabBar({ state, descriptors, navigation }: { state: any, descriptors: any, navigation: any }) {
  const { tabBarVisible } = useTabBar();
  const { hasAccess } = useEntitlement();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(0)).current;
  const tabLayouts = useRef<Partial<Record<VisibleTab, TabLayout>>>({});
  const hiddenTabBarRoutes = ['Onboarding', 'Race', 'marketplace'];
  const activeRouteName = state.routes[state.index]?.name as VisibleTab;
  const isWalkOnly = useWalkingGoalPlan(activeRouteName);
  const runTabLabel = isWalkOnly ? 'WALK' : 'RUN';
  const indicatorX = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);
  const runTabActive = useSharedValue(activeRouteName === 'Run' ? 1 : 0);
  const indicatorReady = useRef(false);
  const hideDistance = 84 + insets.bottom + 24;
  const shouldHideTabBar = hiddenTabBarRoutes.includes(activeRouteName);

  const moveIndicator = useCallback((routeName: VisibleTab, animated = true) => {
    const layout = tabLayouts.current[routeName];
    if (!layout) return;

    const spring = animated ? BUTTER_SPRING : { damping: 100, stiffness: 500, mass: 1 };
    indicatorX.value = withSpring(layout.x, spring);
    indicatorWidth.value = withSpring(layout.width, spring);
    runTabActive.value = withSpring(routeName === 'Run' ? 1 : 0, spring);
    indicatorReady.current = true;
  }, [indicatorWidth, indicatorX, runTabActive]);

  useEffect(() => {
    if (activeRouteName && VISIBLE_TABS.includes(activeRouteName)) {
      moveIndicator(activeRouteName);
    }
  }, [activeRouteName, moveIndicator]);

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: tabBarVisible ? 0 : hideDistance,
      duration: 320,
      easing: Easing.bezier(0.33, 1, 0.68, 1),
      useNativeDriver: true,
    }).start();
  }, [tabBarVisible, translateY, hideDistance]);

  const handleTabLayout = useCallback((routeName: VisibleTab, x: number, width: number) => {
    tabLayouts.current[routeName] = { x, width };
    if (routeName === activeRouteName) {
      moveIndicator(routeName, indicatorReady.current);
    }
  }, [activeRouteName, moveIndicator]);

  if (shouldHideTabBar) {
    return null;
  }

  const renderTabIcon = (name: string, focused: boolean) => {
    const iconSource = TAB_ICONS[name as keyof typeof TAB_ICONS];

    if (name === 'index') {
      return (
        <AnimatedTabIcon focused={focused}>
          <Image
            source={getImageChatAvatarSource(user?.gender)}
            style={styles.homeAvatarImage}
            resizeMode="cover"
          />
        </AnimatedTabIcon>
      );
    }

    if (name === 'Partner') {
      return (
        <AnimatedTabIcon focused={focused}>
          <Image
            source={TAB_ICONS.Partner}
            style={styles.tabIconImage}
            resizeMode="contain"
          />
        </AnimatedTabIcon>
      );
    }

    if (name === 'Run') {
      return (
        <AnimatedTabIcon focused={focused} style={styles.mainActionWrapper}>
          <View style={styles.mainActionButton}>
            <Image
              source={iconSource}
              style={styles.runTabIcon}
              resizeMode="contain"
            />
          </View>
          <View style={[styles.actionGlow, focused && styles.actionGlowActive]} />
        </AnimatedTabIcon>
      );
    }

    return (
      <AnimatedTabIcon focused={focused}>
        <Image
          source={iconSource}
          style={styles.tabIconImage}
          resizeMode="contain"
        />
      </AnimatedTabIcon>
    );
  };

  return (
    <Animated.View
      style={[
        styles.tabBarWrapper,
        { transform: [{ translateY }] },
      ]}
    >
      <View style={styles.tabBarShell}>
        <View style={styles.tabBarSurface}>
          <BlurView
            intensity={process.env.EXPO_OS === 'ios' ? 92 : 68}
            tint="light"
            style={styles.tabBarContainer}
          >
            <View style={styles.glassBarTint} />
            <View style={[styles.tabBarContent, { paddingBottom: Math.max(insets.bottom, 6) }]}>
              <GlassFluidIndicator
                x={indicatorX}
                width={indicatorWidth}
                runTabActive={runTabActive}
              />

              {state.routes.map((route: any, index: number) => {
                const { options } = descriptors[route.key];
                const label = options.title !== undefined ? options.title : route.name;

                if (!VISIBLE_TABS.includes(route.name)) return null;

                const isFocused = state.index === index;
                const tabName = route.name as VisibleTab;

                const onPress = () => {
                  if (!hasAccess) {
                    router.push('/paywall');
                    return;
                  }

                  const event = navigation.emit({
                    type: 'tabPress',
                    target: route.key,
                    canPreventDefault: true,
                  });

                  if (!isFocused && !event.defaultPrevented) {
                    if (process.env.EXPO_OS === 'ios') {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                    navigation.navigate(route.name);
                  }
                };

                const onLayout = (event: { nativeEvent: { layout: { x: number; width: number } } }) => {
                  const { x, width } = event.nativeEvent.layout;
                  handleTabLayout(tabName, x, width);
                };

                if (route.name === 'Run') {
                  return (
                    <Pressable
                      key={route.key}
                      onPress={onPress}
                      onLayout={onLayout}
                      style={styles.runTab}
                    >
                      {renderTabIcon(route.name, isFocused)}
                      <Text style={[
                        styles.runLabel,
                        { color: isFocused ? COLORS.primary : COLORS.textMuted }
                      ]}>
                        {runTabLabel}
                      </Text>
                    </Pressable>
                  );
                }

                return (
                  <Pressable
                    key={route.key}
                    onPress={onPress}
                    onLayout={onLayout}
                    style={styles.tabButton}
                  >
                    <View style={styles.iconContainer}>
                      {renderTabIcon(route.name, isFocused)}
                    </View>
                    <Text style={[
                      styles.label,
                      {
                        color: isFocused ? COLORS.primary : COLORS.textMuted,
                        fontWeight: isFocused ? '800' : '600',
                      }
                    ]}>
                      {route.name === 'index' ? 'HOME' : label.toUpperCase()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </BlurView>
        </View>
      </View>
    </Animated.View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      detachInactiveScreens={false}
      tabBar={props => <CustomTabBar {...props} />}
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
      <Tabs.Screen name="Run" options={{ title: "Run" }} />
      <Tabs.Screen name="Race" options={{ title: "Race" }} />
      <Tabs.Screen name="Partner" options={{ title: "Partner" }} />

      {/* Hidden Utility/Sub-screens */}
      <Tabs.Screen name="marketplace" options={{ href: null }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
      <Tabs.Screen name="activity" options={{ href: null }} />
      <Tabs.Screen name="Login" options={{ href: null }} />
      <Tabs.Screen name="Onboarding" options={{ href: null }} />
      <Tabs.Screen name="PlanMaker" options={{ href: null }} />
      <Tabs.Screen name="quest" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  tabBarShell: {
    justifyContent: 'flex-end',
    overflow: 'visible',
    paddingTop: 14,
  },
  tabBarSurface: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.92)',
    backgroundColor: Platform.OS === 'android' ? 'rgba(255,255,255,0.94)' : 'rgba(255,255,255,0.72)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 12,
    overflow: 'hidden',
  },
  tabBarContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  glassBarTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.38)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.95)',
  },
  tabBarContent: {
    flexDirection: 'row',
    minHeight: 54,
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingHorizontal: 12,
    paddingTop: 5,
    position: 'relative',
  },
  glassBlock: {
    position: 'absolute',
    left: 0,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.95)',
    backgroundColor: Platform.OS === 'android' ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.78)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 0,
  },
  glassBlockSheen: {
    ...StyleSheet.absoluteFillObject,
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(255,255,255,1)',
    backgroundColor: 'rgba(255,255,255,0.42)',
  },
  glassBlockTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    minHeight: 54,
    zIndex: 1,
  },
  iconContainer: {
    height: 34,
    width: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
    overflow: 'hidden',
  },
  tabIconImage: {
    width: 30,
    height: 30,
  },
  homeAvatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.92)',
    backgroundColor: '#F8FAFC',
  },
  label: {
    fontSize: 9,
    letterSpacing: 0.5,
    marginTop: 1,
  },
  runTab: {
    width: 72,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 1,
    marginTop: -14,
  },
  mainActionWrapper: {
    marginBottom: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainActionButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.95)',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 2,
    overflow: 'hidden',
  },
  actionGlow: {
    position: 'absolute',
    top: 5,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    opacity: 0.1,
    zIndex: 1,
  },
  actionGlowActive: {
    opacity: 0.2,
  },
  runTabIcon: {
    width: 38,
    height: 38,
  },
  runLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginTop: 1,
  },
});
