import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Camera, CalendarCheck, Footprints, House, UsersRound } from 'lucide-react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBar } from '@/contexts/TabBarContext';
import { useEntitlement } from '@/src/billing';

const ACCENT = '#FF5757';
const ACCENT_SOFT = '#FEF2F2';

const TABS = [
  { name: 'index', label: 'Home', Icon: House },
  { name: 'Plans', label: 'Plans', Icon: CalendarCheck },
  { name: 'activity', label: 'Log food', Icon: Camera },
  { name: 'Run', label: 'Run', Icon: Footprints },
  { name: 'Partner', label: 'Partner', Icon: UsersRound },
] as const;

export default function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const { tabBarVisible } = useTabBar();
  const { hasAccess } = useEntitlement();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const translateY = useRef(new Animated.Value(0)).current;
  const activeRoute = state.routes[state.index]?.name;
  const bottom = Math.max(insets.bottom, 12);

  useEffect(() => {
    const animation = Animated.timing(translateY, {
      toValue: tabBarVisible ? 0 : 120 + bottom,
      duration: reducedMotion ? 0 : 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [bottom, reducedMotion, tabBarVisible, translateY]);

  if (activeRoute === 'Onboarding' || activeRoute === 'marketplace') return null;

  return (
    <Animated.View pointerEvents={tabBarVisible ? 'box-none' : 'none'}
      style={[s.wrapper, { bottom, left: Math.max(insets.left, 12), right: Math.max(insets.right, 12), transform: [{ translateY }] }]}>
      <View style={s.bar}>
        {TABS.map(({ name, label, Icon }) => {
          const route = state.routes.find(item => item.name === name);
          if (!route) return null;
          const selected = activeRoute === name;
          const center = name === 'activity';
          const color = selected ? ACCENT : '#343B50';
          const onPress = () => {
            if (!hasAccess) { router.push('/paywall'); return; }
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (event.defaultPrevented) return;
            if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
            if (center) navigation.navigate(route.name, { action: 'logFood', t: String(Date.now()) });
            else if (!selected) navigation.navigate(route.name);
          };

          return (
            <Pressable key={name} onPress={onPress}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              accessibilityRole={center ? 'button' : 'tab'}
              accessibilityLabel={center ? 'Log food with camera' : label}
              accessibilityState={{ selected }}
              aria-selected={selected}
              style={({ pressed }) => [s.tab, center && s.centerTab, pressed && s.pressed]}>
              {center ? (
                <>
                  <View style={s.diamondShadow}>
                    <View style={s.diamond}>
                      <View style={s.uprightIcon}><Icon size={30} color="#FFFFFF" strokeWidth={2.3} /></View>
                    </View>
                  </View>
                  <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={s.centerLabel}>{label}</Text>
                </>
              ) : (
                <View style={[s.tabContent, selected && s.selected]}>
                  <Icon size={25} color={color} strokeWidth={1.9} fill="none" />
                  <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={[s.label, { color }, selected && s.selectedLabel]}>{label}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrapper: { position: 'absolute', zIndex: 1000 },
  bar: {
    height: 72, borderRadius: 36, borderCurve: 'continuous',
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: ACCENT_SOFT,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 5,
    boxShadow: '0px 8px 28px rgba(15, 23, 42, 0.12)',
  },
  tab: { flex: 1, height: 64, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.65 },
  tabContent: {
    width: '100%', maxWidth: 76, height: 58, borderRadius: 29, borderCurve: 'continuous',
    alignItems: 'center', justifyContent: 'center', gap: 3,
  },
  selected: { backgroundColor: ACCENT_SOFT },
  label: { fontSize: 11, fontWeight: '600' },
  selectedLabel: { fontWeight: '700' },
  centerTab: { justifyContent: 'flex-end', paddingBottom: 4 },
  diamondShadow: {
    position: 'absolute', top: -21, width: 62, height: 62,
    borderRadius: 21, borderCurve: 'continuous', transform: [{ rotate: '45deg' }],
    boxShadow: '0px 5px 16px rgba(255, 87, 87, 0.3)',
  },
  diamond: {
    flex: 1, backgroundColor: ACCENT, borderRadius: 21, borderCurve: 'continuous', borderWidth: 2,
    borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
  },
  uprightIcon: { transform: [{ rotate: '-45deg' }] },
  centerLabel: { fontSize: 11, fontWeight: '700', color: ACCENT },
});
