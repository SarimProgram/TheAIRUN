import React, { useEffect, useState } from 'react';
import { AppState, type LayoutRectangle, Pressable, StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, {
  cancelAnimation, Easing, type SharedValue, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue,
  withDelay, withTiming,
} from 'react-native-reanimated';
import CaloriePulleyScene, { PULLEY_INTRO, type PulleyTotals } from './CaloriePulleyScene';
import { useGoalExpanded } from './CollapsibleGoal';
import { PULLEY } from './pulleyGeometry';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const EASE = Easing.bezier(0.65, 0, 0.35, 1);
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
// Hand off just after the baskets land so the drop reads as the cue for the summary.
const SCENE_DWELL = PULLEY_INTRO + 600;
const MORPH_IN = 600;
const REVEAL_DELAY = 400;
const REVEAL_DURATION = 800;
const ARC_LENGTH = Math.PI * 60;
const COLOR = { used: '#FF6B6B', eaten: '#FF6B6B', left: '#0D9488', burned: '#F59E0B', over: '#DC2626' };
// Pulley wheel centres as fractions of the 400 x 300 scene, where each gauge grows from.
const WHEEL_Y = (PULLEY.y + 14) / 300;
const WHEEL_X = [PULLEY.x / 400, 1 - PULLEY.x / 400] as const;

type Gender = 'male' | 'female';

function totals(data: PulleyTotals) {
  const food = Number.isFinite(data.food) ? data.food! : 0;
  const exercise = Number.isFinite(data.exercise) ? data.exercise! : 0;
  const goal = Number.isFinite(data.goal) && data.goal! > 0 ? data.goal! : 0;
  const left = Math.round(goal - (food - exercise));
  const ratio = (value: number) => goal ? Math.max(0, Math.min(1, value / goal)) : 0;
  return { food: Math.round(food), exercise: Math.round(exercise), left, goal, used: ratio(food - exercise) };
}

function Bar({ label, value, ratio, color, reveal }: { label: string; value: string; ratio: number; color: string; reveal: SharedValue<number> }) {
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: ratio * reveal.get() }] }));
  return <View style={styles.bar}>
    <View style={styles.barLabels}>
      <Text style={styles.barLabel}>{label}</Text>
      <Text style={[styles.barValue, { color }]}>{value}</Text>
    </View>
    <View style={styles.barTrack}><Animated.View style={[styles.barFill, { backgroundColor: color }, fill]} /></View>
  </View>;
}

function Gauge({ data, name, mode, reveal, wheelX, frame }: {
  data: PulleyTotals; name: string; mode: SharedValue<number>; reveal: SharedValue<number>; wheelX: number; frame: { width: number; height: number };
}) {
  const t = totals(data);
  const over = t.goal > 0 && t.left < 0;
  const [box, setBox] = useState<LayoutRectangle | null>(null);
  const arc = useAnimatedProps(() => ({ strokeDashoffset: ARC_LENGTH * (1 - t.used * reveal.get()) }));
  const tip = useAnimatedProps(() => {
    const angle = Math.PI * t.used * reveal.get();
    return { cx: 70 - 60 * Math.cos(angle), cy: 70 - 60 * Math.sin(angle), opacity: t.used > 0 ? reveal.get() : 0 };
  });
  const morph = useAnimatedStyle(() => {
    const m = mode.get();
    if (!box) return { opacity: m };
    const dx = wheelX * frame.width - (box.x + box.width / 2);
    const dy = WHEEL_Y * frame.height - (box.y + box.width * 0.45);
    return {
      opacity: Math.min(1, m * 2.5),
      transform: [{ translateX: dx * (1 - m) }, { translateY: dy * (1 - m) }, { scale: 0.18 + 0.82 * m }],
    };
  });
  const count = (value: number) => Math.round(value).toLocaleString();
  const amount = (value: number) => t.goal ? count(Math.abs(value)) : '—';
  return <Animated.View style={[styles.gauge, morph]} onLayout={e => {
    const next = e.nativeEvent.layout;
    setBox(previous => previous && previous.x === next.x && previous.y === next.y && previous.width === next.width && previous.height === next.height ? previous : next);
  }}>
    <View style={styles.arcBox}>
      <Svg width="100%" height="100%" viewBox="0 0 140 76">
        <Path d="M10 70 A60 60 0 0 1 130 70" fill="none" stroke="#FFE4E2" strokeWidth={12} strokeLinecap="round" />
        <AnimatedPath animatedProps={arc} d="M10 70 A60 60 0 0 1 130 70" fill="none" stroke={over ? COLOR.over : COLOR.used}
          strokeWidth={12} strokeLinecap="round" strokeDasharray={`${ARC_LENGTH} ${ARC_LENGTH}`} />
        <AnimatedCircle animatedProps={tip} cx={10} cy={70} r={4} opacity={0} fill={over ? COLOR.over : COLOR.used} />
      </Svg>
      <View style={styles.arcCenter}>
        <Text style={styles.arcValue} numberOfLines={1} adjustsFontSizeToFit>{amount(t.left)}</Text>
        <Text style={[styles.arcLabel, over && { color: COLOR.over }]}>{over ? 'KCAL OVER' : 'KCAL LEFT'}</Text>
      </View>
    </View>
    <View style={styles.bars}>
      <Bar label="Eaten" value={count(t.food)} ratio={t.goal ? Math.min(1, t.food / t.goal) : 0} color={COLOR.eaten} reveal={reveal} />
      <Bar label={over ? 'Over' : 'Left'} value={amount(t.left)} ratio={t.goal ? Math.min(1, Math.abs(t.left) / t.goal) : 0}
        color={over ? COLOR.over : COLOR.left} reveal={reveal} />
      <Bar label="Burned" value={count(t.exercise)} ratio={t.goal ? Math.min(1, t.exercise / t.goal) : 0} color={COLOR.burned} reveal={reveal} />
    </View>
    <Text style={styles.name} numberOfLines={1}>{name}</Text>
  </Animated.View>;
}

/** Shows the pulley introduction, then lets taps toggle between the rig and calorie circles. */
export default function CalorieShowcase(props: {
  mine: PulleyTotals; partner: PulleyTotals; gender: Gender; partnerGender: Gender;
  myName: string; partnerName: string; onPressMine: () => void; onPressPartner: () => void;
}) {
  const focused = useIsFocused();
  const expanded = useGoalExpanded();
  const reduced = useReducedMotion();
  const [summary, setSummary] = useState(false);
  const [sceneMounted, setSceneMounted] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const mode = useSharedValue(0);
  const reveal = useSharedValue(0);
  const running = focused && expanded && active;

  useEffect(() => {
    const listener = AppState.addEventListener('change', state => setActive(state === 'active'));
    return () => listener.remove();
  }, []);
  useEffect(() => {
    if (summary || dismissed || !running) return;
    const timer = setTimeout(() => setSummary(true), SCENE_DWELL);
    return () => clearTimeout(timer);
  }, [summary, dismissed, running]);
  // Opacity alone leaves the large SVG tree and its native mappers mounted.
  // Keep it for the crossfade, then release it until the user returns to the pulley.
  useEffect(() => {
    if (!running) { setSceneMounted(false); return; }
    if (!summary) { setSceneMounted(true); return; }
    const timer = setTimeout(() => setSceneMounted(false), reduced ? 200 : MORPH_IN);
    return () => clearTimeout(timer);
  }, [running, summary, reduced]);
  useEffect(() => {
    cancelAnimation(mode);
    cancelAnimation(reveal);
    if (!running) {
      mode.set(summary ? 1 : 0);
      reveal.set(summary ? 1 : 0);
      return;
    }
    if (reduced) {
      mode.set(withTiming(summary ? 1 : 0, { duration: 200 }));
      reveal.set(summary ? 1 : 0);
      return;
    }
    mode.set(withTiming(summary ? 1 : 0, { duration: summary ? MORPH_IN : 550, easing: EASE }));
    reveal.set(summary ? withDelay(REVEAL_DELAY, withTiming(1, { duration: REVEAL_DURATION, easing: EASE_OUT })) : withTiming(0, { duration: 200 }));
    return () => { cancelAnimation(mode); cancelAnimation(reveal); };
  }, [summary, running, reduced, mode, reveal]);

  const sceneStyle = useAnimatedStyle(() => {
    const m = mode.get();
    return {
      opacity: 1 - Math.min(1, m * 1.4),
      transform: reduced ? [] : [{ translateY: -m * 18 }, { scale: 1 + m * 0.12 }],
    };
  });
  const separatorStyle = useAnimatedStyle(() => ({ opacity: mode.get() }));

  return <View style={styles.frame} onLayout={e => {
    const { width, height } = e.nativeEvent.layout;
    setFrame(previous => previous.width === width && previous.height === height ? previous : { width, height });
  }}>
    <Animated.View style={[StyleSheet.absoluteFill, sceneStyle]} pointerEvents="none"
      accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {sceneMounted && <CaloriePulleyScene {...props} isVisible={!summary} />}
    </Animated.View>
    <Pressable style={StyleSheet.absoluteFill} onPress={() => { setDismissed(true); setSummary(current => !current); }}
      accessibilityRole="button" accessibilityLabel={summary ? 'Calorie summary. Tap to show the pulley' : 'Calorie pulley. Tap to show the calorie circles'}>
      <View style={styles.gaugeLayer} pointerEvents="none"
        accessibilityElementsHidden={!summary} importantForAccessibility={summary ? 'auto' : 'no-hide-descendants'}>
      <Gauge data={props.mine} name={props.myName} mode={mode} reveal={reveal}
        wheelX={WHEEL_X[0]} frame={frame} />
      <Animated.View style={[styles.gaugeSeparator, separatorStyle]} />
      <Gauge data={props.partner} name={props.partnerName} mode={mode} reveal={reveal}
        wheelX={WHEEL_X[1]} frame={frame} />
      </View>
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  frame: { width: '100%', aspectRatio: 400 / 300 },
  gaugeLayer: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, gap: 12 },
  gaugeSeparator: { alignSelf: 'stretch', marginVertical: 32, width: StyleSheet.hairlineWidth, backgroundColor: '#E2E8F0' },
  gauge: { flex: 1, gap: 12 },
  arcBox: { width: '100%', aspectRatio: 140 / 76 },
  arcCenter: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  arcValue: { fontSize: 26, fontWeight: '800', color: '#1F2937', letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
  arcLabel: { fontSize: 10, fontWeight: '700', color: '#6B7280', letterSpacing: 0.6 },
  bars: { gap: 8 },
  bar: { gap: 4 },
  barLabels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  barLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  barValue: { fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  barTrack: { height: 7, borderRadius: 3.5, backgroundColor: '#FFF1F0', overflow: 'hidden' },
  barFill: { width: '100%', height: '100%', borderRadius: 3.5, transformOrigin: 'left center' },
  name: { marginTop: 2, textAlign: 'center', fontSize: 14, fontWeight: '800', letterSpacing: 0.4, color: '#475569' },
});
