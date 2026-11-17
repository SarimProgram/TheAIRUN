// Original weight/balance scene retained for reuse independently of the pulley scene.
// Default export: complete comparison card. Named BalanceScale: standalone mechanism.
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AlertTriangle, Dumbbell, Flame, Utensils } from 'lucide-react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient as SvgGradient, Path, Rect, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import Animated, {
  cancelAnimation, Easing, interpolateColor, ReduceMotion, type SharedValue, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue,
  withDelay, withRepeat, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import { useAuth } from '@/src/auth/authContext';
import { getOppositeGender, normalizeGender } from '@/utils/genderMascot';
import NutritionCharacter, { nutritionReaction } from './NutritionCharacter';
import { Image as CachedImage } from 'expo-image';
import { NUTRITION_FOOD } from './nutritionAssets';
import { useGoalExpanded } from './CollapsibleGoal';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const AnimatedSvgPath = Animated.createAnimatedComponent(Path);
const PERSONAL_HOLD_MS = 2400;
const PERSONAL_ENTRY_MS = 650;
const PERSONAL_TRANSITION_MS = 550;
const COLORS = {
  primary: '#FF6B6B', // This is the Coral color
  primarySoft: '#FFF1F2',
  waveAccent: '#FF8E8E',
  textMain: '#1F2937',
  textMuted: '#6B7280',
  border: '#F3F4F6',
  white: '#FFFFFF',
  bg: '#F8FAFC',
  coral: '#FF6B6B',
};

const SCALE_GOLD_DARK = '#9A6633';
const MAX_TILT = 14;
const PAN_W = 84;
const PAN_RIM = 46;
const PAN_H = PAN_RIM + 22;

const netIntake = (data: any) => Math.max(0, (data?.food ?? 0) - (data?.exercise ?? 0));
const goalShare = (data: any) => (data?.goal > 0 ? netIntake(data) / data.goal : 0);
const firstName = (name?: string) => (name || '').trim().split(/\s+/)[0]?.toUpperCase() || '';

function KcalBubble({ data, align, focus, width }: { data: any; align: 'left' | 'right'; focus: SharedValue<number>; width: number }) {
  const remaining = Math.round((data?.goal ?? 0) - ((data?.food ?? 0) - (data?.exercise ?? 0)));
  const over = remaining < 0;
  const mine = align === 'left';
  const numberSize = Math.min(22, Math.max(12, (width - 32) / (String(Math.abs(remaining)).length * 0.62)));
  const bubbleStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(focus.get(), [0, 1], [over ? '#FEE2E2' : mine ? '#ECFDF5' : COLORS.primarySoft, over ? '#FEE2E2' : COLORS.primarySoft]),
    borderColor: interpolateColor(focus.get(), [0, 1], [mine && !over ? '#99F6D9' : '#FFFFFF00', '#FFFFFF00']),
    transform: [
      { translateY: mine ? 0 : 4 * (1 - focus.get()) },
      { scale: mine ? 1.08 - 0.08 * focus.get() : 0.94 + 0.06 * focus.get() },
      { rotate: mine ? '-5deg' : '5deg' },
    ],
  }));
  const numberStyle = useAnimatedStyle(() => ({ color: over ? '#EF4444' : interpolateColor(focus.get(), [0, 1], [mine ? COLORS.textMain : '#7B8494', COLORS.textMain]) }));
  const labelStyle = useAnimatedStyle(() => ({ color: over ? '#EF4444' : interpolateColor(focus.get(), [0, 1], [mine ? '#008A70' : '#7B8494', COLORS.textMuted]) }));
  const pointerProps = useAnimatedProps(() => ({ fill: interpolateColor(focus.get(), [0, 1], [over ? '#FEE2E2' : mine ? '#ECFDF5' : COLORS.primarySoft, over ? '#FEE2E2' : COLORS.primarySoft]) }));
  return (
    <Animated.View style={[styles.kcalBubble, align === 'left' ? styles.kcalBubbleLeft : styles.kcalBubbleRight, { borderWidth: 1, transformOrigin: mine ? 'left top' : 'right top' }, bubbleStyle]}>
      <Svg
        pointerEvents="none"
        width={16}
        height={12}
        viewBox="0 0 22 18"
        style={[styles.kcalBubblePointer, align === 'left' ? { left: 6 } : { right: 6, transform: [{ scaleX: -1 }] }]}
      >
        <AnimatedSvgPath d="M2 0H22C16 7 8 14 0 16C4 10 5 5 2 0Z" animatedProps={pointerProps} />
      </Svg>
      <View style={[styles.mainStatRow, { width: '100%' }]}>
        <Animated.Text numberOfLines={1} adjustsFontSizeToFit style={[styles.bubbleNum, { fontSize: Math.min(19, numberSize) }, numberStyle]}>{Math.abs(remaining)}</Animated.Text>
        {over ? <AlertTriangle size={12} color="#EF4444" fill="#FEE2E2" /> : <Flame size={12} color={COLORS.primary} fill={COLORS.primary} />}
      </View>
      <Animated.Text style={[styles.subLabel, labelStyle]}>{over ? 'KCAL OVER' : 'KCAL LEFT'}</Animated.Text>
    </Animated.View>
  );
}

function ScalePan({ side, angle, sway, beamHalf, pivotX, pivotY, foodProgress, heavier }: { side: -1 | 1; angle: SharedValue<number>; sway: SharedValue<number>; beamHalf: number; pivotX: number; pivotY: number; foodProgress: number; heavier: boolean }) {
  const hang = useAnimatedStyle(() => {
    const rad = ((angle.get() + sway.get()) * Math.PI) / 180;
    return {
      transform: [
        { translateX: pivotX + side * beamHalf * Math.cos(rad) - PAN_W / 2 },
        { translateY: pivotY + side * beamHalf * Math.sin(rad) },
      ],
    };
  });
  const cx = PAN_W / 2;
  const right = PAN_W - 3;
  const bottom = PAN_RIM + 20;
  const chain = { stroke: SCALE_GOLD_DARK, strokeWidth: 1.8, strokeDasharray: '2.4 1.8', strokeLinecap: 'round' as const, fill: 'none' };
  return (
    <Animated.View pointerEvents="none" style={[styles.pan, hang]}>
      <Svg width={PAN_W} height={PAN_H} style={StyleSheet.absoluteFill}>
        <Path d={`M${cx} 0 V3`} stroke={SCALE_GOLD_DARK} strokeWidth={2} strokeLinecap="round" />
        <Circle cx={cx} cy={6} r={3.2} stroke={SCALE_GOLD_DARK} strokeWidth={1.8} fill="none" />
        <Path d={`M${cx} 9 L${cx} ${PAN_RIM - 5}`} {...chain} strokeOpacity={0.55} />
        <Path d={`M${cx} 9 L5 ${PAN_RIM} M${cx} 9 L${right - 2} ${PAN_RIM}`} {...chain} />
        <Ellipse cx={cx} cy={PAN_RIM} rx={cx - 3} ry={6} fill="#E89D90" />
        <Ellipse cx={cx} cy={PAN_RIM + 1.5} rx={cx - 8} ry={3.5} fill="#D9877B" opacity={0.5} />
        {heavier ? <Path d={side === 1 ? `M${PAN_W - 6} 26 l7 -7 M${PAN_W - 3} 38 l9 -3` : 'M6 26 l-7 -7 M3 38 l-9 -3'} stroke={COLORS.primary} strokeWidth={2.2} strokeLinecap="round" /> : null}
      </Svg>
      {foodProgress > 0 ? <View style={[styles.panFood, { top: PAN_RIM - 38, transform: [{ scale: 0.72 + Math.min(1, foodProgress) * 0.28 }] }]}>
        <CachedImage source={side === -1 ? NUTRITION_FOOD.left : NUTRITION_FOOD.right}
          style={StyleSheet.absoluteFill} contentFit="contain" contentPosition="center"
          cachePolicy="memory-disk" priority="high" transition={0} accessible={false} />
      </View> : null}
      <Svg width={PAN_W} height={PAN_H} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgGradient id={`panFront${side}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFE3DD" />
            <Stop offset="1" stopColor="#EC9C8E" />
          </SvgGradient>
        </Defs>
        <Path d={`M3 ${PAN_RIM} Q${cx} ${PAN_RIM + 12} ${right} ${PAN_RIM} Q${right - 4} ${bottom} ${cx} ${bottom} Q7 ${bottom} 3 ${PAN_RIM} Z`} fill={`url(#panFront${side})`} />
        <Path d={`M3 ${PAN_RIM} Q${cx} ${PAN_RIM + 12} ${right} ${PAN_RIM}`} stroke="#FFFFFF" strokeOpacity={0.85} strokeWidth={1.6} fill="none" />
        <Path d={`M12 ${PAN_RIM + 7} Q18 ${PAN_RIM + 14} 28 ${PAN_RIM + 15}`} stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth={2.2} strokeLinecap="round" fill="none" />
        <Path d={`M${cx - 10} ${bottom} H${cx + 10}`} stroke="#D98374" strokeWidth={2.4} strokeLinecap="round" />
      </Svg>
    </Animated.View>
  );
}

function ScaleBeam({ beamHalf }: { beamHalf: number }) {
  const w = beamHalf * 2 + 16;
  const end = w - 8;
  const mid = w / 2;
  return (
    <Svg width={w} height={18}>
      <Defs>
        <SvgGradient id="beamGold" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#F3D2A2" />
          <Stop offset="0.5" stopColor="#C99159" />
          <Stop offset="1" stopColor="#97602F" />
        </SvgGradient>
      </Defs>
      <Path d={`M8 6.8 Q${mid} 3.5 ${end} 6.8 V11.2 Q${mid} 14.5 8 11.2 Z`} fill="url(#beamGold)" />
      <Path d={`M12 7.4 Q${mid} 4.8 ${end - 4} 7.4`} stroke="#FFFFFF" strokeOpacity={0.45} strokeWidth={1} fill="none" />
      <Circle cx={8} cy={9} r={4.2} fill="url(#beamGold)" stroke={SCALE_GOLD_DARK} strokeWidth={0.8} />
      <Circle cx={end} cy={9} r={4.2} fill="url(#beamGold)" stroke={SCALE_GOLD_DARK} strokeWidth={0.8} />
    </Svg>
  );
}

function ScaleStand({ height }: { height: number }) {
  const neck = height * 0.55;
  const foot = height - 12;
  return (
    <Svg width={96} height={height}>
      <Defs>
        <SvgGradient id="standCoral" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#FF9C91" />
          <Stop offset="0.45" stopColor="#FF6B6B" />
          <Stop offset="1" stopColor="#D94F55" />
        </SvgGradient>
      </Defs>
      <Ellipse cx={48} cy={height - 3} rx={46} ry={3} fill="#0F172A" opacity={0.08} />
      <Path d={`M44.5 0 H51.5 L53.5 ${neck} H42.5 Z`} fill="url(#standCoral)" />
      <Rect x={40} y={neck * 0.42} width={16} height={5} rx={2.5} fill="#E35B5E" />
      <Path d={`M42.5 ${neck} H53.5 Q55 ${neck + 20} 76 ${foot - 10} Q88 ${foot - 6} 88 ${foot} H8 Q8 ${foot - 6} 20 ${foot - 10} Q41 ${neck + 20} 42.5 ${neck} Z`} fill="url(#standCoral)" />
      <Path d={`M44 ${neck + 4} Q43 ${neck + 18} 28 ${foot - 9}`} stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={2} strokeLinecap="round" fill="none" />
      <Rect x={4} y={foot} width={88} height={9} rx={4.5} fill="#E35B5E" />
      <Rect x={10} y={foot + 1.5} width={40} height={2} rx={1} fill="#FFFFFF" opacity={0.3} />
    </Svg>
  );
}

function ScalePivot() {
  return (
    <Svg width={24} height={30}>
      <Path d="M12 4 V14" stroke={SCALE_GOLD_DARK} strokeWidth={2.4} strokeLinecap="round" />
      <Circle cx={12} cy={4} r={3.6} fill="#E7B97E" stroke={SCALE_GOLD_DARK} strokeWidth={1} />
      <Circle cx={12} cy={20} r={8} fill="#D8A066" stroke={SCALE_GOLD_DARK} strokeWidth={1.2} />
      <Circle cx={12} cy={20} r={3.4} fill="#F6DDB6" />
    </Svg>
  );
}

export function BalanceScale({ width, tilt, myData, partnerData }: { width: number; tilt: number; myData: any; partnerData: any }) {
  const reduced = useReducedMotion();
  const angle = useSharedValue(0);
  const sway = useSharedValue(0);
  const height = 158;
  const pivotX = width / 2;
  const pivotY = 28;
  const beamHalf = Math.max(PAN_W / 2 + 10, width * 0.32);

  useEffect(() => {
    if (reduced) { cancelAnimation(sway); sway.set(withTiming(0, { duration: 300 })); return; }
    // Non-reversing repeats restart from the start value, which snaps the beam; ping-pong instead.
    sway.set(withSequence(
      withTiming(1, { duration: 800, easing: Easing.inOut(Easing.sin) }),
      withRepeat(withTiming(-1, { duration: 1600, easing: Easing.inOut(Easing.sin) }), -1, true),
    ));
    return () => cancelAnimation(sway);
  }, [reduced, sway]);

  useEffect(() => {
    angle.set(withSpring(tilt, { duration: 1100, dampingRatio: 0.45, reduceMotion: ReduceMotion.System }));
  }, [angle, tilt]);

  const beam = useAnimatedStyle(() => ({ transform: [{ rotate: `${angle.get() + sway.get()}deg` }] }));
  const geometry = { angle, sway, beamHalf, pivotX, pivotY };

  return (
    <View style={[styles.scale, { width, height }]}>
      <View style={[styles.scaleBase, { left: pivotX - 48, top: pivotY }]}><ScaleStand height={height - pivotY} /></View>
      <View style={[styles.scaleFlame, { left: pivotX - 10 }]}><Flame size={14} color="#FFFFFF" fill="#FFD3A1" /></View>
      <ScalePan side={-1} foodProgress={myData?.food > 0 ? Math.max(0.1, goalShare(myData)) : 0} heavier={tilt < -1} {...geometry} />
      <ScalePan side={1} foodProgress={partnerData?.food > 0 ? Math.max(0.1, goalShare(partnerData)) : 0} heavier={tilt > 1} {...geometry} />
      <Animated.View style={[styles.scaleBeam, { left: pivotX - beamHalf - 8, top: pivotY - 9 }, beam]}><ScaleBeam beamHalf={beamHalf} /></Animated.View>
      <View style={[styles.scalePivot, { left: pivotX - 12, top: pivotY - 20 }]}><ScalePivot /></View>
    </View>
  );
}

export function CalorieComparisonStats({ data, mine, focus }: { data: any; mine: boolean; focus: SharedValue<number> }) {
  const intakeStyle = useAnimatedStyle(() => ({ color: interpolateColor(focus.get(), [0, 1], [mine ? '#DC2626' : '#899398', '#DC2626']) }));
  const burnedStyle = useAnimatedStyle(() => ({ color: interpolateColor(focus.get(), [0, 1], [mine ? '#15803D' : '#899398', '#15803D']) }));
  return <View style={styles.compactPersonStats}>
    <View style={styles.compactMetric}>
      <View style={styles.compactMetricLabel}><Utensils size={11} color="#DC2626" /><Text style={[styles.compactMetricText, { color: '#DC2626' }]}>Eaten</Text></View>
      <Animated.Text numberOfLines={1} adjustsFontSizeToFit style={[styles.compactMetricValue, intakeStyle]}>{data?.food ?? 0}</Animated.Text>
    </View>
    <View style={styles.compactMetric}>
      <View style={styles.compactMetricLabel}><Dumbbell size={11} color="#15803D" /><Text style={[styles.compactMetricText, { color: '#15803D' }]}>Burned</Text></View>
      <Animated.Text numberOfLines={1} adjustsFontSizeToFit style={[styles.compactMetricValue, burnedStyle]}>{data?.exercise ?? 0}</Animated.Text>
    </View>
  </View>;
}

export default function CalorieBalanceScale({ myData, partnerData, partnerName, partnerGender, partnerIsNegative, nudgeSent, onMotivate, onPressMine, onPressPartner, calendar }: { myData: any; partnerData: any; partnerName?: string; partnerGender?: string | null; partnerIsNegative: boolean; nudgeSent: boolean; onMotivate: () => void; onPressMine: () => void; onPressPartner: () => void; calendar?: React.ReactNode }) {
  const { user } = useAuth();
  const expanded = useGoalExpanded();
  const reduced = useReducedMotion();
  const [equalFocus, setEqualFocus] = useState(true);
  const focus = useSharedValue(1);
  const returnTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sceneWidth, setSceneWidth] = useState(320);
  // Reserve a column for each person and size the scale to the space between them.
  const avatarHeight = Math.round(sceneWidth * 0.34);
  const sceneHeight = Math.max(152, Math.round(sceneWidth * 0.49));
  const scaleColumnWidth = sceneWidth * 0.44;
  const scaleArtworkWidth = sceneWidth * 0.5;
  const scaleArtworkBounds = 2 * Math.max(PAN_W / 2 + 10, scaleArtworkWidth * 0.32) + PAN_W;
  const scaleSize = Math.min(sceneWidth * 0.27 / 158, (scaleColumnWidth + 8) / scaleArtworkBounds);
  const scaleHeightSize = scaleSize * 1.2;
  const gender = user?.gender;
  const myName = firstName(user?.displayName ?? user?.name) || 'YOU';
  const theirName = firstName(partnerName) || 'PARTNER';
  const tilt = Math.max(-MAX_TILT, Math.min(MAX_TILT, (goalShare(partnerData) - goalShare(myData)) * 30));

  useEffect(() => {
    cancelAnimation(focus);
    focus.set(1);
    setEqualFocus(!expanded || !!reduced);
    if (expanded && !reduced) {
      const easing = Easing.bezier(0.23, 1, 0.32, 1);
      focus.set(withSequence(
        withTiming(0, { duration: PERSONAL_ENTRY_MS, easing: Easing.inOut(Easing.cubic) }),
        withDelay(PERSONAL_HOLD_MS, withTiming(1, { duration: PERSONAL_TRANSITION_MS, easing })),
      ));
      returnTimer.current = setTimeout(() => {
        setEqualFocus(true);
        returnTimer.current = null;
      }, PERSONAL_ENTRY_MS + PERSONAL_HOLD_MS + PERSONAL_TRANSITION_MS);
    }
    return () => {
      if (returnTimer.current !== null) clearTimeout(returnTimer.current);
      returnTimer.current = null;
      cancelAnimation(focus);
    };
  }, [expanded, reduced, focus]);

  const toggleFocus = () => {
    if (returnTimer.current !== null) clearTimeout(returnTimer.current);
    returnTimer.current = null;
    const next = !equalFocus;
    setEqualFocus(next);
    cancelAnimation(focus);
    focus.set(withTiming(next ? 1 : 0, {
      duration: reduced ? 0 : PERSONAL_TRANSITION_MS,
      easing: Easing.bezier(0.23, 1, 0.32, 1),
    }));
    void Haptics.selectionAsync().catch(() => {});
  };

  const myStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1.06 - 0.06 * focus.get() }] }));
  const partnerStyle = useAnimatedStyle(() => ({ opacity: 0.65 + 0.35 * focus.get(), transform: [{ scale: 0.9 + 0.1 * focus.get() }] }));
  const nameBadgeStyle = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(focus.get(), [0, 1], ['#008A80', '#FFFFFF00']) }));
  const myNameStyle = useAnimatedStyle(() => ({ color: interpolateColor(focus.get(), [0, 1], ['#FFFFFF', '#475569']) }));
  const partnerNameStyle = useAnimatedStyle(() => ({ opacity: 0.65 + 0.35 * focus.get() }));

  const avatar = (avatarGender: 'male' | 'female', data: any, otherData: any, mine: boolean, name: string, onPress: () => void) => <AnimatedPressable
    accessibilityRole="button"
    accessibilityLabel={`${name} calorie details, ${nutritionReaction(data, otherData).replaceAll('-', ' ')}`}
    onPress={() => { void Haptics.selectionAsync().catch(() => {}); onPress(); }}
    style={[styles.scaleAvatar, { height: avatarHeight, transformOrigin: 'center bottom' }, mine ? { left: 0 } : { right: 0 }, mine ? myStyle : partnerStyle]}>
    <NutritionCharacter gender={avatarGender} reaction={nutritionReaction(data, otherData)} facing={mine ? 'right' : 'left'} role={mine ? 'you' : 'partner'} />
  </AnimatedPressable>;

  return <View style={styles.balanceCard}>
    <View style={[styles.scaleScene, { height: sceneHeight }]} onLayout={event => setSceneWidth(event.nativeEvent.layout.width)}>
      {avatar(normalizeGender(gender) || 'male', myData, partnerData, true, myName, onPressMine)}
      {avatar(normalizeGender(partnerGender) || getOppositeGender(gender), partnerData, myData, false, theirName, onPressPartner)}
      <KcalBubble data={myData} align="left" focus={focus} width={sceneWidth * 0.28} />
      <KcalBubble data={partnerData} align="right" focus={focus} width={sceneWidth * 0.28} />
      <Pressable accessibilityRole="button" accessibilityLabel={equalFocus ? 'Focus on my calories' : 'Compare calories equally'} accessibilityState={{ selected: equalFocus }} onPress={toggleFocus} style={[styles.scaleWrap, { left: sceneWidth * 0.28, width: scaleColumnWidth, height: 158 * scaleHeightSize }]}>
        <View pointerEvents="none" style={{ position: 'absolute', bottom: 0, left: (scaleColumnWidth - scaleArtworkWidth * scaleSize) / 2, transformOrigin: 'left bottom', transform: [{ scaleX: scaleSize }, { scaleY: scaleHeightSize }] }}><BalanceScale width={scaleArtworkWidth} tilt={tilt} myData={myData} partnerData={partnerData} /></View>
      </Pressable>
    </View>
    <View style={styles.focusNames}>
      <Animated.View style={[styles.focusNameBadge, nameBadgeStyle]}><Animated.Text numberOfLines={1} style={[styles.focusNameText, myNameStyle]}>{myName}</Animated.Text></Animated.View>
      <Animated.View style={[styles.focusNameBadge, partnerNameStyle]}><Text numberOfLines={1} style={[styles.focusNameText, { color: '#475569' }]}>{theirName}</Text></Animated.View>
    </View>
    <View style={styles.compactComparison}>
      <CalorieComparisonStats data={myData} mine focus={focus} />
      <View style={styles.comparisonDivider} />
      <CalorieComparisonStats data={partnerData} mine={false} focus={focus} />
    </View>
    {calendar && <View style={styles.calendarSlot}><View style={styles.calendarContent}>{calendar}</View></View>}
    {partnerIsNegative && <TouchableOpacity style={styles.scaleMotivate} activeOpacity={0.85} onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); onMotivate(); }}>
      <AlertTriangle size={13} color="#DC2626" fill="#FEE2E2" />
      <Text style={styles.motivateButtonText}>{nudgeSent ? 'Sent' : `${theirName} is over · Intervene`}</Text>
    </TouchableOpacity>}
  </View>;
}

const styles = StyleSheet.create({
mainStatRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, width: '84%' },
subLabel: { fontSize: 9, color: COLORS.textMuted, fontWeight: '700', letterSpacing: 0.5 },
motivateButtonText: {
    color: '#DC2626',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
balanceCard: { gap: 8 },
compactComparison: { flexDirection: 'row', gap: 16, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#E2E8F0', paddingVertical: 8 },
compactPersonStats: { flex: 1, flexDirection: 'row', gap: 8 },
comparisonDivider: { width: StyleSheet.hairlineWidth, height: 34, backgroundColor: '#CBD5E1', alignSelf: 'center' },
calendarSlot: { alignItems: 'center' },
calendarContent: { width: '100%' },
compactMetric: { flex: 1, minWidth: 0, alignItems: 'center', gap: 3 },
compactMetricLabel: { flexDirection: 'row', alignItems: 'center', gap: 4 },
compactMetricText: { fontSize: 10, color: '#64748B' },
compactMetricValue: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
focusNames: { flexDirection: 'row', justifyContent: 'space-between' },
focusNameBadge: { width: '28%', minHeight: 28, paddingHorizontal: 4, paddingVertical: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 18, borderCurve: 'continuous' },
focusNameText: { fontSize: 14, fontWeight: '800', letterSpacing: 0.4 },
scaleScene: { position: 'relative' },
scaleAvatar: { position: 'absolute', bottom: 0, width: '28%', alignItems: 'center', justifyContent: 'flex-end' },
kcalBubble: {
    position: 'absolute', top: 0, width: '28%', minWidth: 0, alignItems: 'center', paddingHorizontal: 6, paddingVertical: 4,
    backgroundColor: COLORS.primarySoft, borderRadius: 18, borderCurve: 'continuous', zIndex: 3,
  },
kcalBubbleLeft: { left: 0, transform: [{ rotate: '-5deg' }] },
kcalBubbleRight: { right: 0, transform: [{ rotate: '5deg' }] },
kcalBubblePointer: { position: 'absolute', bottom: -11 },
bubbleNum: { flexShrink: 1, fontSize: 22, fontWeight: '900', letterSpacing: -0.8, color: COLORS.textMain, fontVariant: ['tabular-nums'] },
scaleWrap: { position: 'absolute', bottom: 0 },
scale: { position: 'relative' },
scaleBase: { position: 'absolute' },
scaleFlame: { position: 'absolute', bottom: 20, width: 20, alignItems: 'center' },
scaleBeam: { position: 'absolute' },
scalePivot: { position: 'absolute' },
pan: { position: 'absolute', left: 0, top: 0, width: PAN_W, height: PAN_H },
panFood: { position: 'absolute', left: 8, right: 8, height: 46, transformOrigin: 'center bottom' },
scaleMotivate: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'center',
    backgroundColor: '#FFF', borderWidth: 1.5, borderColor: '#FCA5A5', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 14,
  }
});
