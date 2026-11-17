import React, { useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Ellipse, Path } from 'react-native-svg';
import { ArrowLeftRight, RefreshCw, X } from 'lucide-react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { TUG_SHEET } from '@/components/battle/tugAssets';
import { TUG_ATLAS, TUG_FRAME_HEIGHT, TUG_FRAME_WIDTH, TUG_CONTENT_WIDTH, TUG_SPRITES, tugFrameIndex, type TugIdentity } from '@/components/battle/tugSprite';
import { tugEdgeShift } from '@/utils/tugReminderMessage';

const AnimatedPath = Animated.createAnimatedComponent(Path);

export type TugReminderSceneProps = {
  side: 'left' | 'right';
  name: string;
  partnerName: string;
  identity: TugIdentity;
  steps: number | null;
  partnerSteps: number | null;
  loading?: boolean;
  error?: string | null;
  topInset?: number;
  bottomInset?: number;
  onClose: () => void;
  onRefresh: () => void;
};

/** A half-stage: the hand-to-edge rope meets the other phone halfway down its height. */
export default function TugReminderScene({ side, name, partnerName, identity, steps, partnerSteps, loading, error, topInset = 0, bottomInset = 0, onClose, onRefresh }: TugReminderSceneProps) {
  const { width, height } = useWindowDimensions();
  const dark = useColorScheme() === 'dark';
  const reduced = useReducedMotion();
  const [active, setActive] = useState(AppState.currentState === 'active');
  const ink = dark ? '#F1F5F9' : '#22323A';
  const muted = dark ? '#A4B3B8' : '#63767D';
  const bg = dark ? '#12272C' : '#EEF6F3';
  const accent = side === 'left' ? '#E96570' : '#218E87';
  const scale = Math.min(width * 0.78 / TUG_FRAME_WIDTH, height * 0.35 / TUG_FRAME_HEIGHT);
  const spriteWidth = TUG_FRAME_WIDTH * scale;
  const spriteHeight = TUG_FRAME_HEIGHT * scale;
  const sprite = TUG_SPRITES[identity];
  const ropeY = height * 0.5;
  const top = ropeY - 190 * scale;
  const x = side === 'left' ? width * 0.04 : width - spriteWidth - width * 0.04;
  const ready = steps !== null && partnerSteps !== null;
  const lead = ready ? steps - partnerSteps : 0;
  const shift = useSharedValue(0);
  const phase = useSharedValue(0);
  const target = ready ? tugEdgeShift(side === 'left' ? steps : partnerSteps, side === 'left' ? partnerSteps : steps, width) : 0;

  useEffect(() => {
    const sub = AppState.addEventListener('change', value => setActive(value === 'active'));
    return () => sub.remove();
  }, []);
  useEffect(() => {
    cancelAnimation(shift);
    shift.set(reduced || !active ? target : withSpring(target, { duration: 650, dampingRatio: 1 }));
    return () => cancelAnimation(shift);
  }, [target, reduced, active, shift]);
  useEffect(() => {
    cancelAnimation(phase);
    if (reduced || !active || !ready) phase.set(lead > 0 ? 3 : 0);
    else phase.set(withRepeat(withSequence(
      withTiming(lead > 0 ? 5.9 : 2.9, { duration: 1150, easing: Easing.inOut(Easing.sin) }),
      withTiming(lead > 0 ? 2 : 0, { duration: 950, easing: Easing.inOut(Easing.sin) }),
    ), -1));
    return () => cancelAnimation(phase);
  }, [lead, ready, active, reduced, phase]);
  const body = useAnimatedStyle(() => ({ transform: [{ translateX: shift.get() }] }));
  const atlas = useAnimatedStyle(() => ({ transform: [
    { translateX: -tugFrameIndex(phase.get()) * spriteWidth },
    { translateY: -sprite.row * spriteHeight },
  ] }));
  const rope = useAnimatedProps(() => {
    const frame = sprite.frames[tugFrameIndex(phase.get())];
    const frontX = x + (side === 'left' ? frame.front.x : TUG_FRAME_WIDTH - frame.front.x) * scale + shift.get();
    const rearX = x + (side === 'left' ? frame.rear.x : TUG_FRAME_WIDTH - frame.rear.x) * scale + shift.get();
    const frontY = top + frame.front.y * scale;
    const rearY = top + frame.rear.y * scale;
    const edge = side === 'left' ? width + 8 : -8;
    // Horizontal tangent at the seam, including during pose changes.
    return { d: `M${rearX} ${rearY} L${frontX} ${frontY} C${frontX + (edge - frontX) * 0.5} ${frontY} ${edge + (side === 'left' ? -24 : 24)} ${ropeY} ${edge} ${ropeY}` };
  });
  const firstName = name.trim().split(/\s+/)[0] || 'You';
  const otherName = partnerName.trim().split(/\s+/)[0] || 'Your partner';
  const status = !ready ? 'Connecting your rope…' : lead === 0 ? 'Perfectly matched.' : lead > 0 ? "You're pulling ahead." : `${otherName} is pulling ahead.`;

  return <View style={[styles.root, { backgroundColor: bg }]}>
    <View style={[styles.header, { paddingTop: topInset + 12 }]}>
      <Text style={[styles.brand, { color: muted }]}>RUNTOGETHER</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Close tug of war" onPress={onClose} style={[styles.icon, { backgroundColor: dark ? '#FFFFFF12' : '#FFFFFF' }]}><X size={22} color={ink} /></Pressable>
    </View>
    <View style={[styles.score, { top: topInset + (height < 740 ? 64 : 92) }]}>
      <Text style={[styles.name, { color: accent }]} numberOfLines={1}>{firstName}</Text>
      <Text selectable maxFontSizeMultiplier={1.35} style={[styles.count, { color: ink }]}>{steps === null ? '—' : steps.toLocaleString()}</Text>
      <Text style={[styles.unit, { color: muted }]}>steps today</Text>
    </View>
    <View pointerEvents="none" style={[styles.floor, { top: top + sprite.baseline * scale, backgroundColor: dark ? '#FFFFFF08' : '#21423808' }]} />
    <Svg pointerEvents="none" width={width} height={height} style={StyleSheet.absoluteFill}>
      <AnimatedPath animatedProps={rope} stroke="#966539" strokeWidth={8} strokeLinecap="round" fill="none" />
      <AnimatedPath animatedProps={rope} stroke="#E6BC83" strokeWidth={4} strokeDasharray="5 7" fill="none" />
    </Svg>
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: x, top, width: spriteWidth, height: spriteHeight }, body]}>
      <Svg width={spriteWidth} height={16} style={{ position: 'absolute', top: sprite.baseline * scale - 5 }}><Ellipse cx={spriteWidth / 2} cy={6} rx={spriteWidth * 0.35} ry={5} fill={accent} opacity={0.16} /></Svg>
      <View style={{ width: spriteWidth, height: spriteHeight, overflow: 'hidden', transform: [{ scaleX: side === 'right' ? -1 : 1 }] }}>
        <View style={{ width: TUG_CONTENT_WIDTH * scale, height: spriteHeight, overflow: 'hidden' }}>
          <Animated.Image source={TUG_SHEET} accessible={false} resizeMode="stretch" style={[{ width: TUG_ATLAS.width * scale, height: TUG_ATLAS.height * scale }, atlas]} />
        </View>
      </View>
    </Animated.View>
    <View style={[styles.footer, { bottom: bottomInset + 20 }]}>
      <Text accessibilityLiveRegion="polite" style={[styles.status, { color: ink }]}>{status}</Text>
      <Text style={[styles.other, { color: muted }]}>{otherName} · {partnerSteps === null ? '—' : partnerSteps.toLocaleString()} steps</Text>
      <View style={styles.hint}><ArrowLeftRight size={16} color={muted} /><Text style={[styles.hintText, { color: muted }]}>Your phone goes on the {side}.</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel={error ? 'Retry step connection' : 'Refresh steps'} disabled={loading} onPress={onRefresh} style={[styles.refresh, { backgroundColor: dark ? '#FFFFFF0D' : '#FFFFFFB8', opacity: loading ? 0.55 : 1 }]}>
        <RefreshCw size={15} color={error ? accent : muted} /><Text style={{ color: error ? accent : muted, fontSize: 13 }}>{error ? 'Couldn’t sync. Tap to retry.' : loading ? 'Syncing steps…' : 'Refresh steps'}</Text>
      </Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  header: { paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  score: { position: 'absolute', left: 24, right: 24, alignItems: 'center' },
  name: { fontSize: 22, fontWeight: '700' },
  count: { fontSize: 64, lineHeight: 80, fontWeight: '800', letterSpacing: -3, fontVariant: ['tabular-nums'] },
  unit: { fontSize: 15 },
  floor: { position: 'absolute', left: 0, right: 0, height: 1 },
  footer: { position: 'absolute', left: 24, right: 24, alignItems: 'center', gap: 8 },
  status: { fontSize: 21, fontWeight: '700', textAlign: 'center' },
  other: { fontSize: 15, fontVariant: ['tabular-nums'] },
  hint: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 16 },
  hintText: { fontSize: 13 },
  refresh: { minHeight: 44, paddingHorizontal: 16, borderRadius: 22, borderCurve: 'continuous', flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
});
