import React, { useCallback, useEffect, useRef } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { X } from 'lucide-react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, { cancelAnimation, Easing, type SharedValue, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type Celebration = { id: number; key: string; title: string; message: string; points?: number; preview?: boolean };

const AnimatedPath = Animated.createAnimatedComponent(Path);
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
// A quiet field of short-lived motes, distributed across the screen.
const PARTICLES = Array.from({ length: 18 }, (_, index) => ({
  x: 8 + ((index * 37) % 84),
  y: 18 + ((index * 23) % 62),
  delay: (index % 6) * 0.035,
  drift: 18 + (index % 4) * 8,
  size: index % 3 === 0 ? 4 : 2,
}));

function easeOut(value: number) {
  'worklet';
  const p = Math.max(0, Math.min(1, value));
  return 1 - (1 - p) ** 3;
}

function Particle({ index, phase }: { index: number; phase: SharedValue<number> }) {
  const { x, y, delay, drift, size } = PARTICLES[index];
  const motion = useAnimatedStyle(() => {
    const p = Math.max(0, Math.min(1, (phase.get() - delay) / (1 - delay)));
    return {
      opacity: Math.sin(p * Math.PI) ** 2 * 0.38,
      transform: [
        { translateY: -drift * easeOut(p) },
        { translateX: Math.sin(p * Math.PI) * (index % 2 ? 7 : -7) },
      ],
    };
  });
  return <Animated.View style={[styles.particle, { left: `${x}%`, top: `${y}%`, width: size, height: size, borderRadius: size / 2 }, motion]} />;
}

export default function GoalCelebration({ reward, onClose }: { reward: Celebration; onClose: () => void }) {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const phase = useSharedValue(0);
  const visibility = useSharedValue(0);
  const closing = useRef(false);
  const started = useRef(false);

  // Start after the native modal is visible, so presentation cannot swallow the first frames.
  const show = useCallback(() => {
    if (started.current || closing.current) return;
    started.current = true;
    visibility.set(withTiming(1, { duration: 280, easing: EASE_OUT }));
    phase.set(withTiming(1, { duration: reducedMotion ? 280 : 2200, easing: Easing.linear }));
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [phase, reducedMotion, visibility]);

  const dismiss = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    visibility.set(withTiming(0, { duration: 180, easing: Easing.out(Easing.quad) }, finished => {
      if (finished) scheduleOnRN(onClose);
    }));
  }, [onClose, visibility]);

  useEffect(() => () => { cancelAnimation(phase); cancelAnimation(visibility); }, [phase, visibility]);

  const screenMotion = useAnimatedStyle(() => ({ opacity: visibility.get() }));
  const contentMotion = useAnimatedStyle(() => {
    const p = reducedMotion ? 1 : easeOut((phase.get() - 0.025) / 0.16);
    return { opacity: p, transform: [{ translateY: reducedMotion ? 0 : (1 - p) * 6 }] };
  });
  const symbolMotion = useAnimatedStyle(() => ({
    opacity: reducedMotion ? 1 : easeOut(phase.get() / 0.13),
    transform: [{ scale: reducedMotion ? 1 : 0.98 + easeOut(phase.get() / 0.2) * 0.02 }],
  }));
  const checkProps = useAnimatedProps(() => ({
    strokeDashoffset: reducedMotion ? 0 : 64 * (1 - easeOut((phase.get() - 0.055) / 0.19)),
  }));
  const textColor = dark ? '#F1F5F9' : '#182033';
  const muted = dark ? '#B0BAC9' : '#737B89';
  const title = reward.title.replace(/!$/, '');

  return <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent onShow={show} onRequestClose={dismiss}>
    <Animated.View style={[styles.screen, { backgroundColor: dark ? '#0F172A' : '#FFFDFC' }, screenMotion]} accessibilityViewIsModal>
      {!reducedMotion && <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
        {PARTICLES.map((_, index) => <Particle key={index} index={index} phase={phase} />)}
      </View>}
      <ScrollView contentContainerStyle={[styles.content, { minHeight: height, paddingTop: insets.top + 64, paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.center}>
          <Animated.View style={[styles.symbol, symbolMotion]} accessible={false}>
            <Svg width={128} height={128} viewBox="0 0 128 128">
              <Circle cx={64} cy={64} r={60} fill={dark ? '#30252C' : '#FFF1ED'} />
              <Circle cx={64} cy={64} r={45} fill="none" stroke="#FF6B6B" strokeOpacity={0.25} strokeWidth={1} />
              <AnimatedPath animatedProps={checkProps} d="M43 64 L57 78 L86 49" fill="none" stroke="#FF6B6B" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="64 64" />
            </Svg>
          </Animated.View>
          <Animated.View style={[styles.copy, contentMotion]} accessible accessibilityRole="alert" accessibilityLabel={`${title}. ${reward.message}${reward.points ? ` ${reward.points} points earned.` : ''}`}>
            {reward.preview && <Text style={[styles.preview, { color: muted }]}>Developer preview</Text>}
            <Text style={[styles.title, { color: textColor }]}>{title}</Text>
            <Text style={[styles.message, { color: muted }]}>{reward.message}</Text>
            {reward.points != null && reward.points > 0 && <Text style={styles.points}>+{reward.points.toLocaleString()} points</Text>}
          </Animated.View>
        </View>
        <Animated.View style={[styles.footer, contentMotion]}>
          <Pressable accessibilityRole="button" onPress={dismiss} style={({ pressed }) => [styles.button, { borderColor: dark ? '#394252' : '#E6E3E0', backgroundColor: pressed ? (dark ? '#1E293B' : '#F5F2EF') : 'transparent' }]}>
            <Text style={[styles.buttonText, { color: textColor }]}>Continue</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
      <Pressable accessibilityRole="button" accessibilityLabel="Close goal celebration" onPress={dismiss} style={[styles.close, { top: insets.top + 12 }]}><X size={20} strokeWidth={1.5} color={muted} /></Pressable>
    </Animated.View>
  </Modal>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 32, alignItems: 'center', gap: 40 },
  center: { flex: 1, width: '100%', maxWidth: 380, alignItems: 'center', justifyContent: 'center', gap: 28 },
  symbol: { width: 128, height: 128 },
  copy: { width: '100%', alignItems: 'center', gap: 12 },
  preview: { fontSize: 12, fontWeight: '500', marginBottom: 4 },
  title: { fontSize: 29, fontWeight: '600', textAlign: 'center', letterSpacing: -0.8 },
  message: { fontSize: 16, lineHeight: 24, textAlign: 'center', maxWidth: 280 },
  points: { fontSize: 15, fontWeight: '600', color: '#D95860', fontVariant: ['tabular-nums'], marginTop: 8 },
  footer: { width: '100%', maxWidth: 320 },
  button: { minHeight: 52, width: '100%', borderRadius: 26, borderCurve: 'continuous', borderWidth: 1, justifyContent: 'center', alignItems: 'center', padding: 14 },
  buttonText: { fontSize: 16, fontWeight: '500' },
  close: { position: 'absolute', right: 16, width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  particle: { position: 'absolute', backgroundColor: '#FF8C80' },
});
