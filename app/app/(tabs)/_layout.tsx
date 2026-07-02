// app/app/(tabs)/_layout.tsx

import React, { useRef, useEffect } from "react";
import { Tabs, useRouter } from "expo-router";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  Animated,
  Image
} from "react-native";
import { useTabBar } from '@/contexts/TabBarContext';
import { useEntitlement } from '@/src/billing';
import {
  Home,
  LayoutGrid,
  Play,
  Trophy,
  ShoppingBag,
  Zap,
  Calendar
} from "lucide-react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get('window');

const COLORS = {
  primary: '#FF3B3B', // More intense fitness red
  primaryDark: '#D60000',
  accent: '#00F5D4', // Vibrant mint/cyan for fitness contrast
  text: '#0F172A',
  textMuted: '#64748B',
  white: '#FFFFFF',
  bg: '#F8FAFC',
};

function CustomTabBar({ state, descriptors, navigation }: { state: any, descriptors: any, navigation: any }) {
  const { tabBarVisible } = useTabBar();
  const { hasAccess } = useEntitlement();
  const router = useRouter();
  const translateY = useRef(new Animated.Value(0)).current;
  const hiddenTabBarRoutes = ['Onboarding', 'Partner', 'Race'];
  const activeRouteName = state.routes[state.index]?.name;
  const shouldHideTabBar = hiddenTabBarRoutes.includes(activeRouteName);

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: tabBarVisible ? 0 : 150,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [tabBarVisible]);

  if (shouldHideTabBar) {
    return null;
  }

  return (
    <Animated.View style={[styles.tabBarWrapper, { transform: [{ translateY }] }]}>
      <View style={styles.tabBarShell}>
        <View style={styles.tabBarSurface}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 65 : 45}
            tint="light"
            style={styles.tabBarContainer}
          >
            <View style={styles.tabBarContent}>
              {state.routes.map((route: any, index: number) => {
            const { options } = descriptors[route.key];
            const label = options.title !== undefined ? options.title : route.name;

            const visibleTabs = ['index', 'Plans', 'Run', 'Race', 'marketplace'];
            if (!visibleTabs.includes(route.name)) return null;

            const isFocused = state.index === index;

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
                navigation.navigate(route.name);
              }
            };

            const getIcon = (name: string, focused: boolean) => {
              const inactiveColor = COLORS.textMuted;
              const size = 22;
              const strokeWidth = focused ? 2.5 : 2;

              switch (name) {
                case 'index':
                  return <Home size={size} color={focused ? COLORS.primary : inactiveColor} strokeWidth={strokeWidth} />;
                case 'Plans':
                  return <Calendar size={size} color={focused ? COLORS.primary : inactiveColor} strokeWidth={strokeWidth} />;
                case 'Run':
                  return (
                    <View style={styles.mainActionWrapper}>
                      <LinearGradient
                        colors={[COLORS.primary, '#FF6B00']}
                        start={{ x: 0, y: 0.2 }}
                        end={{ x: 1, y: 0.8 }}
                        style={styles.mainActionButton}
                      >
                        <Image
                          source={require('../../assets/logo.png')}
                          style={styles.runLogo}
                          resizeMode="contain"
                        />
                      </LinearGradient>
                      <View style={styles.actionGlow} />
                    </View>
                  );
                case 'Race':
                  return <Trophy size={size} color={focused ? COLORS.primary : inactiveColor} strokeWidth={strokeWidth} />;
                case 'marketplace':
                  return <ShoppingBag size={size} color={focused ? COLORS.primary : inactiveColor} strokeWidth={strokeWidth} />;
                default:
                  return <Home size={size} color={inactiveColor} />;
              }
            };

            if (route.name === 'Run') {
              return (
                <TouchableOpacity
                  key={route.key}
                  onPress={onPress}
                  style={styles.runTab}
                  activeOpacity={0.9}
                >
                  {getIcon(route.name, isFocused)}
                  <Text style={[
                    styles.runLabel,
                    { color: isFocused ? COLORS.primary : COLORS.textMuted }
                  ]}>
                    RUN
                  </Text>
                </TouchableOpacity>
              );
            }

            return (
              <TouchableOpacity
                key={route.key}
                onPress={onPress}
                style={styles.tabButton}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.iconContainer,
                  isFocused && styles.activeIconContainer
                ]}>
                  {getIcon(route.name, isFocused)}
                </View>
                <Text style={[
                  styles.label,
                  {
                    color: isFocused ? COLORS.primary : COLORS.textMuted,
                    fontWeight: isFocused ? '800' : '600',
                    fontSize: 10,
                  }
                ]}>
                  {route.name === 'index' ? 'HOME' : label.toUpperCase()}
                </Text>
              </TouchableOpacity>
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
      tabBar={props => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="Plans" options={{ title: "Plans" }} />
      <Tabs.Screen name="Run" options={{ title: "Run" }} />
      <Tabs.Screen name="Race" options={{ title: "Race" }} />
      <Tabs.Screen name="marketplace" options={{ title: "Store" }} />

      {/* Hidden Utility/Sub-screens */}
      <Tabs.Screen name="explore" options={{ href: null }} />
      <Tabs.Screen name="activity" options={{ href: null }} />
      <Tabs.Screen name="Login" options={{ href: null }} />
      <Tabs.Screen name="Partner" options={{ href: null }} />
      <Tabs.Screen name="Onboarding" options={{ href: null }} />
      <Tabs.Screen name="PlanMaker" options={{ href: null }} />
      <Tabs.Screen name="quest" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarWrapper: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 34 : 24,
    left: 18,
    right: 18,
    zIndex: 1000,
  },
  tabBarShell: {
    height: 88,
    justifyContent: 'flex-end',
  },
  tabBarSurface: {
    borderRadius: 26,
    height: 78,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
    backgroundColor: Platform.OS === 'android' ? 'rgba(255,255,255,0.96)' : 'rgba(255,255,255,0.68)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  tabBarContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  tabBarContent: {
    flexDirection: 'row',
    height: '100%',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  iconContainer: {
    height: 34,
    width: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  activeIconContainer: {
    backgroundColor: 'rgba(255, 59, 59, 0.08)',
  },
  label: {
    fontSize: 9,
    letterSpacing: 0.5,
    marginTop: 1,
  },
  // Main Run Action
  runTab: {
    width: 80,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  mainActionWrapper: {
    marginBottom: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainActionButton: {
    width: 62,
    height: 62,
    borderRadius: 31,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FFF',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 2,
  },
  actionGlow: {
    position: 'absolute',
    top: 6,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    opacity: 0.18,
    zIndex: 1,
  },
  runLogo: {
    width: 36,
    height: 36,
    tintColor: '#FFF',
  },
  runLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
    marginTop: 2,
  },
});
