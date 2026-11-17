import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  cancelAnimation, Easing, interpolate, ReduceMotion, useAnimatedStyle, useReducedMotion,
  useSharedValue, withDelay, withRepeat, withSpring, withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import FoodLogCoach, { type FoodCoachGender } from './FoodLogCoach';
import { usePassColors } from '@/components/mealpass/passTheme';

export type PhotoRect = { x: number; y: number; width: number; height: number };
export type FoodScan = {
  photoUri: string;
  cutoutUri?: string;
  origin: PhotoRect;
  complete: boolean;
  target?: PhotoRect;
};

const ACCENT = '#FF6B6B';
const DOTS = Array.from({ length: 63 }, (_, i) => ({
  x: 10 + (i % 9) * 10,
  y: 16 + Math.floor(i / 9) * 11,
}));

function ScanDot({ x, y, index, reduced }: { x: number; y: number; index: number; reduced: boolean }) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (!reduced) pulse.value = withDelay((index % 9) * 70 + Math.floor(index / 9) * 90,
      withRepeat(withTiming(1, { duration: 900 }), -1, true));
    return () => cancelAnimation(pulse);
  }, [index, pulse, reduced]);
  const motion = useAnimatedStyle(() => ({
    opacity: reduced ? 0.45 : interpolate(pulse.value, [0, 1], [0.12, 0.85]),
    transform: [{ scale: reduced ? 1 : interpolate(pulse.value, [0, 1], [0.7, 1.15]) }],
  }));
  return <Animated.View style={[styles.dot, { left: `${x}%`, top: `${y}%` }, motion]} />;
}

/** One persistent photo travels from the camera, through scanning, to its measured result slot. */
export default function FoodScanTransition({ scan, gender = 'male', onCancel, onSettled }: {
  scan: FoodScan; gender?: FoodCoachGender; onCancel: () => void; onSettled: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const colors = usePassColors();
  const reduced = useReducedMotion();
  const size = Math.min(width - 40, height * 0.40);
  const heroX = (width - size) / 2;
  const heroY = Math.max(insets.top + 76, height * 0.18);
  const entry = useSharedValue(0);
  const returning = useSharedValue(0);
  const background = useSharedValue(0);
  const cutout = useSharedValue(0);
  const sweep = useSharedValue(0);
  const [cutoutLoaded, setCutoutLoaded] = useState(false);
  const { surface, ink, muted } = colors;

  useEffect(() => {
    entry.value = withSpring(1, { duration: 420, dampingRatio: 1 });
    background.value = withTiming(1, { duration: 220, reduceMotion: ReduceMotion.Never });
    if (!reduced) sweep.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => { cancelAnimation(entry); cancelAnimation(background); cancelAnimation(sweep); };
  }, [background, entry, reduced, sweep]);

  useEffect(() => {
    if (cutoutLoaded) cutout.value = withTiming(1, { duration: 260 });
  }, [cutout, cutoutLoaded]);

  useEffect(() => {
    if (!scan.complete || !scan.target) return;
    const delay = reduced ? 150 : 500;
    background.value = withDelay(delay, withTiming(0, { duration: reduced ? 180 : 280, reduceMotion: ReduceMotion.Never }), ReduceMotion.Never);
    const finish = (finished?: boolean) => {
      'worklet';
      if (finished) scheduleOnRN(onSettled);
    };
    returning.value = withDelay(delay, reduced
      ? withTiming(1, { duration: 180, reduceMotion: ReduceMotion.Never }, finish)
      : withSpring(1, { duration: 460, dampingRatio: 1 }, finish), ReduceMotion.Never);
    return () => { cancelAnimation(returning); cancelAnimation(background); };
  }, [background, onSettled, reduced, returning, scan.complete, scan.target]);

  const backdrop = useAnimatedStyle(() => ({ opacity: background.value }));
  const photo = useAnimatedStyle(() => {
    const originSize = Math.min(scan.origin.width, scan.origin.height);
    const startX = scan.origin.x + scan.origin.width / 2 - size / 2;
    const startY = scan.origin.y + scan.origin.height / 2 - size / 2;
    const target = scan.target;
    const x = interpolate(entry.value, [0, 1], [startX, heroX]);
    const y = interpolate(entry.value, [0, 1], [startY, heroY]);
    const scale = interpolate(entry.value, [0, 1], [originSize / size, 1]);
    return {
      opacity: reduced ? background.value : 1,
      transform: reduced ? [] : [
        { translateX: interpolate(returning.value, [0, 1], [x, target ? target.x + target.width / 2 - size / 2 : heroX]) },
        { translateY: interpolate(returning.value, [0, 1], [y, target ? target.y + target.height / 2 - size / 2 : heroY]) },
        { scale: interpolate(returning.value, [0, 1], [scale, target ? target.width / size : 1]) },
      ],
    };
  });
  const original = useAnimatedStyle(() => ({ opacity: 1 - cutout.value }));
  const isolated = useAnimatedStyle(() => ({ opacity: cutout.value }));
  const scanLine = useAnimatedStyle(() => ({ transform: [{ translateY: sweep.value * size * 0.8 }] }));

  return (
    <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: surface }, backdrop]} />
      <Animated.View style={[styles.chrome, { top: insets.top + 16 }, backdrop]}>
        <View style={styles.badge}><View style={styles.liveDot} /><Text style={[styles.badgeText, { color: ink }]}>MEAL SCAN</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Cancel food scan" onPress={onCancel}
          style={({ pressed }) => [styles.close, { backgroundColor: colors.soft, opacity: pressed ? 0.6 : 1 }]}>
          <X size={18} color={muted} strokeWidth={2.4} />
        </Pressable>
      </Animated.View>
      <Animated.View style={[styles.photo, { width: size, height: size, ...(reduced ? { left: heroX, top: heroY } : {}) }, photo]}>
        <Animated.View style={[StyleSheet.absoluteFill, original]}><Image source={{ uri: scan.photoUri }} style={styles.image} resizeMode="contain" /></Animated.View>
        {scan.cutoutUri && <Animated.View style={[StyleSheet.absoluteFill, isolated]}>
          <Image source={{ uri: scan.cutoutUri }} style={styles.image} resizeMode="contain" onLoad={() => setCutoutLoaded(true)} />
        </Animated.View>}
        {!scan.complete && <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {DOTS.map((dot, i) => <ScanDot key={i} {...dot} index={i} reduced={reduced} />)}
          {!reduced && <Animated.View style={[styles.scanLine, scanLine]} />}
        </View>}
      </Animated.View>
      <Animated.View style={[styles.caption, { top: heroY + size + 16 }, backdrop]} accessibilityLiveRegion="polite">
        <View style={styles.coachMessage}>
          {scan.complete && <View style={styles.readyLabel}><Check size={14} color={ACCENT} strokeWidth={3} /><Text style={styles.readyText}>MEAL IDENTIFIED</Text></View>}
          <Text style={[styles.title, { color: ink }]}>{scan.complete ? 'Looks good.\nLet\u2019s review.' : cutoutLoaded ? 'A closer look\nat your meal.' : 'Let\u2019s see what\u2019s\non your plate.'}</Text>
          <Text style={[styles.subtitle, { color: muted }]}>{scan.complete ? 'Bringing it back to your log.' : 'Identifying food and\nestimating nutrition.'}</Text>
        </View>
        <View style={[styles.coach, { height: height < 700 ? 128 : 156 }]}><FoodLogCoach gender={gender} stage={scan.complete ? 'ready' : 'scan'} /></View>
      </Animated.View>
      <Animated.View style={[styles.scanNote, { bottom: insets.bottom + 32 }, backdrop]}><Text style={[styles.footnote, { color: muted }]}>Every estimate is yours to adjust.</Text></Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  chrome: { position: 'absolute', left: 24, right: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: ACCENT },
  badgeText: { fontSize: 12, letterSpacing: 2, fontWeight: '800' },
  close: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  photo: { position: 'absolute', top: 0, left: 0 },
  image: { width: '100%', height: '100%', borderRadius: 28, borderCurve: 'continuous' },
  dot: { position: 'absolute', width: 3, height: 3, borderRadius: 2, backgroundColor: ACCENT },
  scanLine: { position: 'absolute', top: '10%', left: '6%', right: '6%', height: 1, backgroundColor: ACCENT, opacity: 0.5 },
  caption: { position: 'absolute', left: 32, right: 24, flexDirection: 'row', alignItems: 'center', gap: 8 },
  coachMessage: { flex: 1, gap: 12 }, coach: { width: 108 },
  title: { fontSize: 26, lineHeight: 30, fontWeight: '800', letterSpacing: -0.8 },
  subtitle: { fontSize: 13, lineHeight: 19, fontWeight: '500' },
  footnote: { fontSize: 11, textAlign: 'center' },
  scanNote: { position: 'absolute', left: 24, right: 24 },
  readyLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 }, readyText: { fontSize: 9, color: ACCENT, fontWeight: '600', letterSpacing: 0.8 },
});
