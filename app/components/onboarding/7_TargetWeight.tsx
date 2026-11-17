import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { interpolate, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Line, Path, Rect, Stop } from 'react-native-svg';
import { ArrowRight } from 'lucide-react-native';
import { C, EASE_OUT, OnboardingScreen, SURFACE_SELECTED, ScreenTitle, WheelPicker, rise, useCompact } from './OnboardingKit';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const TRAIL_LENGTH = 200;

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const KG = range(30, 150);
const LBS = range(70, 330);

interface Props {
  currentWeight: number | string;
  unit: string;
  onContinue: (targetWeight: number | string) => void;
  onBack: () => void;
}

export default function TargetWeight({ currentWeight, unit = 'kg', onContinue, onBack }: Props) {
  const compact = useCompact();
  const { width } = useWindowDimensions();
  const isKg = unit.toLowerCase() === 'kg';
  const unitLabel = isKg ? 'kg' : 'lb';

  const values = useMemo(() => {
    const all = isKg ? KG : LBS;
    const atOrBelow = all.filter((v) => v <= Number(currentWeight));
    return atOrBelow.length > 0 ? atOrBelow : all;
  }, [isKg, currentWeight]);

  const initialIndex = Math.max(0, values.length - 2);
  const [index, setIndex] = useState(initialIndex);
  const target = values[Math.min(index, values.length - 1)];

  const artWidth = Math.min(width - 48, 380);
  const artHeight = compact ? 96 : Math.round(artWidth * 0.42);
  const [artAvailableHeight, setArtAvailableHeight] = useState(0);

  return <OnboardingScreen onBack={onBack} ctaLabel="Continue" onCta={() => onContinue(target)}>
    <ScreenTitle lead="Your " accent="goal weight?" />

    <View style={styles.body}>
      <Animated.View
        entering={rise(160)}
        style={[styles.summary, { marginTop: compact ? 20 : 28 }]}
        accessible
        accessibilityLabel={`Current weight ${currentWeight} ${unitLabel}, goal weight ${target} ${unitLabel}`}
      >
        <View style={styles.summarySide}>
          <Text style={styles.summaryValue}>{currentWeight}<Text style={styles.summaryUnit}> {unitLabel}</Text></Text>
        </View>
        <ArrowRight color={C.muted} size={22} strokeWidth={2.4} />
        <View style={[styles.summarySide, styles.summaryTarget]}>
          <Text style={[styles.summaryValue, styles.coral]}>{target}<Text style={[styles.summaryUnit, styles.coral]}> {unitLabel}</Text></Text>
        </View>
      </Animated.View>

      <Animated.View
        entering={rise(220)}
        style={[styles.illustration, { maxHeight: artHeight, marginTop: compact ? 8 : 16 }]}
        onLayout={(event) => setArtAvailableHeight(event.nativeEvent.layout.height)}
      >
        {artAvailableHeight > 0 && <GoalSummit width={artWidth} height={Math.min(artHeight, artAvailableHeight)} />}
      </Animated.View>

      <Animated.View entering={rise(280)} style={[styles.pickerArea, compact && styles.pickerAreaCompact]}>
        <WheelPicker
          values={values}
          initialIndex={initialIndex}
          onChange={setIndex}
          itemHeight={compact ? 60 : 78}
          fontSize={compact ? 46 : 56}
          highlightHeight={compact ? 64 : 80}
          highlightWidth={compact ? 260 : 290}
          accessibilityLabel="Goal weight"
          unit={isKg ? 'kilograms' : 'pounds'}
        />
      </Animated.View>
    </View>
  </OnboardingScreen>;
}

function GoalSummit({ width, height }: { width: number; height: number }) {
  const reduced = useReducedMotion();
  const trail = useSharedValue(reduced ? 1 : 0);
  const flag = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) return;
    trail.set(withDelay(320, withTiming(1, { duration: 900, easing: EASE_OUT })));
    flag.set(withDelay(900, withSpring(1, { duration: 400, dampingRatio: 0.6 })));
  }, [reduced, trail, flag]);

  const trailProps = useAnimatedProps(() => ({ strokeDashoffset: TRAIL_LENGTH * (1 - trail.get()) }));
  const flagStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, flag.get() * 2),
    transform: [{ scale: interpolate(flag.get(), [0, 1], [0.4, 1]) }],
  }));

  const sx = width / 340;
  const sy = height / 150;
  const flagBox = 56 * sy;

  return <View style={{ width, height }} pointerEvents="none" accessible={false}>
    <Svg width={width} height={height} viewBox="0 0 340 150" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id="peak" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FF7F78" />
          <Stop offset="1" stopColor="#FFC9C4" />
        </LinearGradient>
        <LinearGradient id="hill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFD6D2" />
          <Stop offset="1" stopColor="#FFE9E7" />
        </LinearGradient>
        <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0.55" stopColor={C.bg} stopOpacity="0" />
          <Stop offset="1" stopColor={C.bg} stopOpacity="1" />
        </LinearGradient>
      </Defs>
      <Path d="M0 150 C30 122 70 100 110 104 C140 107 160 118 190 132 L190 150 Z" fill="url(#hill)" />
      <Path d="M150 150 C190 118 230 96 275 100 C305 103 325 116 340 124 L340 150 Z" fill="url(#hill)" />
      <Path d="M50 150 C100 136 132 96 158 64 C163 57 167 53 170 52 C173 53 177 57 182 64 C208 96 240 136 290 150 Z" fill="url(#peak)" />
      <AnimatedPath
        d="M182 150 C150 140 150 126 178 116 C200 108 192 94 172 88 C156 82 162 70 170 56"
        stroke={C.white}
        strokeWidth={3.5}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${TRAIL_LENGTH} ${TRAIL_LENGTH}`}
        animatedProps={trailProps}
      />
      <Rect x="0" y="0" width="340" height="150" fill="url(#fade)" />
    </Svg>
    <Animated.View style={[styles.flag, { left: 170 * sx - 10 * sy, width: flagBox, height: flagBox }, flagStyle]}>
      <Svg width={flagBox} height={flagBox} viewBox="160 0 56 56">
        <Line x1="170" y1="54" x2="170" y2="12" stroke={C.ink} strokeWidth={2.5} strokeLinecap="round" />
        <Path d="M171 12 C178 10 184 16 194 14 L190 21 L194 28 C184 30 178 24 171 26 Z" fill={C.coral} />
        <Line x1="201" y1="10" x2="207" y2="4" stroke={C.coral} strokeOpacity={0.6} strokeWidth={2.5} strokeLinecap="round" />
        <Line x1="204" y1="20" x2="212" y2="19" stroke={C.coral} strokeOpacity={0.6} strokeWidth={2.5} strokeLinecap="round" />
      </Svg>
    </Animated.View>
  </View>;
}

const styles = StyleSheet.create({
  body: { flex: 1, minHeight: 0 },
  illustration: { flex: 1, minHeight: 0, alignSelf: 'center', justifyContent: 'center' },
  summary: { height: 68, flexShrink: 0, padding: 6, gap: 8, borderRadius: 999, borderCurve: 'continuous', backgroundColor: 'rgba(241,241,243,0.85)', flexDirection: 'row', alignItems: 'center' },
  summarySide: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', borderRadius: 999, borderCurve: 'continuous' },
  summaryTarget: { backgroundColor: SURFACE_SELECTED, borderWidth: 1.5, borderColor: 'rgba(255, 69, 72, 0.22)' },
  summaryValue: { color: C.ink, fontSize: 26, fontWeight: '900', letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  summaryUnit: { color: 'rgba(8, 36, 55, 0.45)', fontSize: 17, fontWeight: '700', letterSpacing: 0 },
  coral: { color: C.coral },
  flag: { position: 'absolute', top: 0, transformOrigin: '18% 96%' },
  pickerArea: { flexShrink: 0, justifyContent: 'center', paddingVertical: 12 },
  pickerAreaCompact: { paddingVertical: 8 },
});
