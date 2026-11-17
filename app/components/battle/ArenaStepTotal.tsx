import React, { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

// Keep frame-by-frame number rendering local to the total, not the arena.
export default function ArenaStepTotal({ value, color, muted, animate }: {
  value: number; color: string; muted: string; animate: boolean;
}) {
  const safeValue = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  const [display, setDisplay] = useState(safeValue);
  const [delta, setDelta] = useState(0);
  const previous = useRef(safeValue);
  const current = useRef(safeValue);
  const fade = useSharedValue(0);
  const rise = useSharedValue(0);
  const deltaStyle = useAnimatedStyle(() => ({ opacity: fade.get(), transform: [{ translateY: rise.get() }] }));

  useEffect(() => {
    const from = current.current;
    const difference = safeValue - previous.current;
    previous.current = safeValue;
    let frame = 0;
    let started: number | undefined;
    cancelAnimation(fade);
    cancelAnimation(rise);
    if (!animate || AppState.currentState !== 'active') {
      current.current = safeValue;
      setDisplay(safeValue);
      fade.set(0);
      return;
    }
    if (difference > 0) {
      setDelta(difference);
      fade.set(1);
      rise.set(0);
      fade.set(withTiming(0, { duration: 1100 }));
      rise.set(withTiming(-4, { duration: 1100, easing: Easing.out(Easing.quad) }));
    } else {
      fade.set(0);
    }
    const tick = (time: number) => {
      started ??= time;
      const progress = Math.min(1, (time - started) / 500);
      const next = Math.round(from + (safeValue - from) * (1 - Math.pow(1 - progress, 3)));
      current.current = next;
      setDisplay(next);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    if (from !== safeValue) frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimation(fade);
      cancelAnimation(rise);
    };
  }, [safeValue, animate, fade, rise]);

  return <View style={styles.total} accessible accessibilityLabel={`${safeValue.toLocaleString()} steps`}>
    <Text selectable style={[styles.value, { color }]}>{display.toLocaleString()}</Text>
    <Text style={[styles.unit, { color: muted }]}>steps</Text>
    <Animated.Text accessible={false} style={[styles.delta, { color }, deltaStyle]}>+{delta.toLocaleString(undefined, { notation: 'compact', maximumFractionDigits: 1 })}</Animated.Text>
  </View>;
}

const styles = StyleSheet.create({
  total: { alignSelf: 'stretch', alignItems: 'center', paddingTop: 4, gap: 2 },
  value: { fontFamily: process.env.EXPO_OS === 'android' ? 'sans-serif-medium' : 'System', textAlign: 'center', fontSize: 32, lineHeight: 40, fontWeight: '600', fontVariant: ['tabular-nums', 'lining-nums'], letterSpacing: -1.2, flexShrink: 0 },
  unit: { fontSize: 13, lineHeight: 16, fontWeight: '600' },
  delta: { position: 'absolute', top: 46, right: 0, fontSize: 11, lineHeight: 16, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
