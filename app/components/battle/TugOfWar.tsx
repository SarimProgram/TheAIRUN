import React, { useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import Animated, {
  cancelAnimation, Easing, ReduceMotion, type SharedValue, useAnimatedProps,
  useAnimatedStyle, useDerivedValue, useReducedMotion, useSharedValue,
  withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import Svg, { Ellipse, Path } from 'react-native-svg';
import { Crown, Zap } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { normalizeGender } from '@/utils/genderMascot';
import { stageGrip, TUG_ATLAS, TUG_CONTENT_WIDTH, TUG_FRAME_HEIGHT, TUG_FRAME_WIDTH, TUG_SPRITES, tugFrameIndex } from './tugSprite';
import type { TugIdentity } from './tugSprite';
import AnimatedStepCount from './AnimatedStepCount';
import { stepLabelLayout } from './stepLabelLayout';
import { TUG_SHEET } from './tugAssets';
import { useHomeAvatar } from '../../lib/home-avatar';
import HomeAvatarPose, { type HomePose } from '../home/HomeAvatarPose';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const GROUND = 34;
const CORAL = '#FF6B6B';
const TEAL = '#1F938A';

function Character({ identity, side, x, top, scale, phase, bounce, name, leader, active, reduced, showCrown, onLoad, sheetUri, poseIndex }: {
  identity: TugIdentity; side: 'left' | 'right'; x: number; top: number; scale: number;
  phase: SharedValue<number>; bounce: SharedValue<number>; name: string; leader: boolean; active: boolean; reduced: boolean; showCrown: boolean;
  onLoad: () => void;
  sheetUri?: string;
  poseIndex: number;
}) {
  const sprite = TUG_SPRITES[identity];
  const width = TUG_FRAME_WIDTH * scale;
  const height = TUG_FRAME_HEIGHT * scale;
  const color = side === 'left' ? CORAL : TEAL;
  const body = useAnimatedStyle(() => ({ transform: [{ translateY: bounce.get() }] }));
  const atlas = useAnimatedStyle(() => ({ transform: [
    { translateX: -tugFrameIndex(phase.get()) * width },
    { translateY: -sprite.row * height },
  ] }));
  return <Pressable accessibilityRole="button"
    accessibilityLabel={`${name}${leader ? ', currently winning the tug of war' : ''}. Tap to cheer.`}
    onPress={() => {
      void Haptics.selectionAsync().catch(() => {});
      if (active && !reduced && !sheetUri) bounce.set(withSequence(
        withTiming(-7, { duration: 110, reduceMotion: ReduceMotion.System }),
        withSpring(0, { duration: 360, dampingRatio: 0.72, reduceMotion: ReduceMotion.System }),
      ));
    }} style={[styles.character, { left: x, top, width, height }]}>
    <Svg pointerEvents="none" width={width} height={14} style={{ position: 'absolute', top: sprite.baseline * scale - 7 }}>
      <Ellipse cx={width / 2} cy={7} rx={width * 0.42} ry={4} fill={color} opacity={0.14} />
    </Svg>
    <Animated.View pointerEvents="none" style={[{ width, height }, !sheetUri && body]}>
      {sheetUri ? <HomeAvatarPose uri={sheetUri} pose={`steps-${Math.min(3, poseIndex)}` as HomePose} mirrored={side === 'right'} onLoad={onLoad} /> :
      <View style={{ width, height, overflow: 'hidden', transform: [{ scaleX: side === 'right' ? -1 : 1 }] }}>
        <View style={{ width: TUG_CONTENT_WIDTH * scale, height, overflow: 'hidden' }}>
          <Animated.Image source={TUG_SHEET} resizeMode="stretch" accessible={false} onLoad={onLoad}
            style={[{ width: TUG_ATLAS.width * scale, height: TUG_ATLAS.height * scale }, atlas]} />
        </View>
      </View>}
      {leader && showCrown ? <View style={[styles.crown, { backgroundColor: color }]}><Crown size={12} color="#FFFFFF" strokeWidth={2.5} /></View> : null}
    </Animated.View>
  </Pressable>;
}

export default function TugOfWar({ youSteps, partnerSteps, you, partner, gender, difference, arenaWidth, cardColor, dark, visible = true, showCrowns = true, showGround = true, showStepLabels = false, stepCountSize = 20, onNamePress }: {
  share: number; you: string; partner: string; gender?: string; difference: number;
  youSteps: number; partnerSteps: number; arenaWidth: number; cardColor: string; dark: boolean; visible?: boolean; showCrowns?: boolean; showGround?: boolean; showStepLabels?: boolean; stepCountSize?: number; onNamePress?: () => void;
}) {
  const yourAvatar = useHomeAvatar('you');
  const partnerAvatar = useHomeAvatar('partner');
  const leftSheet = yourAvatar?.kind === 'home-sheet' ? yourAvatar.uri : undefined;
  const rightSheet = partnerAvatar?.kind === 'home-sheet' ? partnerAvatar.uri : undefined;
  const focused = useIsFocused();
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const reduced = useReducedMotion();
  const [leftLoaded, setLeftLoaded] = useState(false);
  const [rightLoaded, setRightLoaded] = useState(false);
  const active = focused && appActive && visible && leftLoaded && rightLoaded;
  const leftPhase = useSharedValue(0);
  const rightPhase = useSharedValue(0);
  const shift = useSharedValue(0);
  const leftBounce = useSharedValue(0);
  const rightBounce = useSharedValue(0);
  const illustrationHeight = Math.round(arenaWidth * 9 / 16);
  const largeStepLabels = showStepLabels && stepCountSize > 20;
  const stageHeight = illustrationHeight + (largeStepLabels ? 48 : 0);
  const scale = illustrationHeight * (showStepLabels ? 0.74 : 0.66) / TUG_FRAME_HEIGHT;
  const width = TUG_FRAME_WIDTH * scale;
  const leftX = arenaWidth * 0.08;
  const rightX = arenaWidth - leftX - width;
  const leftIdentity: TugIdentity = normalizeGender(gender) === 'female' ? 'female' : 'male';
  const rightIdentity: TugIdentity = leftIdentity === 'female' ? 'male' : 'female';
  const leftSprite = TUG_SPRITES[leftIdentity];
  const rightSprite = TUG_SPRITES[rightIdentity];
  const leftTop = stageHeight - GROUND - leftSprite.baseline * scale;
  const rightTop = stageHeight - GROUND - rightSprite.baseline * scale;
  // Large counts get a dedicated row above the figures, clear of the divider.
  const labelInset = leftX + width * 0.72;
  const labelWidth = largeStepLabels
    ? arenaWidth / 2 - 20
    : arenaWidth / 2 - labelInset - 8;
  const leftCountSize = Math.min(stepCountSize, labelWidth / (youSteps.toLocaleString().length * 0.65));
  const rightCountSize = Math.min(stepCountSize, labelWidth / (partnerSteps.toLocaleString().length * 0.65));
  const labelTop = largeStepLabels ? 0 : Math.max(0, Math.min(leftTop + 185 * scale, rightTop + 187 * scale) - (stepCountSize + 32));
  // A few early steps should not look like a decisive win. A 1,500-step
  // advantage reaches the edge; smaller leads move there proportionally.
  const leadStrength = Math.min(1, Math.abs(difference) / 1500);
  const pull = Math.sign(difference) * leadStrength;
  const leaderIdentity = difference >= 0 ? leftIdentity : rightIdentity;
  // The woman's ponytail reaches the frame edge in the braced pose; the
  // man's sheet has a wider transparent outer margin.
  const edgeTravel = Math.max(0, leftX + (leaderIdentity === 'male' ? 28 : 0) * scale - 4);
  const leftRestFrame = difference > 0 ? (leadStrength >= 0.6 ? 3 : leadStrength >= 0.2 ? 2 : 0) : (leadStrength >= 0.6 ? 1 : 0);
  const rightRestFrame = difference < 0 ? (leadStrength >= 0.6 ? 3 : leadStrength >= 0.2 ? 2 : 0) : (leadStrength >= 0.6 ? 1 : 0);
  const knotColor = difference > 0 ? CORAL : difference < 0 ? TEAL : '#F5B83D';

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setAppActive(state === 'active'));
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    cancelAnimation(leftPhase);
    cancelAnimation(rightPhase);
    if (active && !reduced && !leftSheet && !rightSheet) {
      // Different stances make the leader visibly brace and pull while the
      // trailing character is more upright. Settle once, never loop.
      leftPhase.set(withSequence(
        withTiming(difference > 0 ? 3 : 1, { duration: 520, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }),
        withTiming(leftRestFrame, { duration: 300, reduceMotion: ReduceMotion.System }),
      ));
      rightPhase.set(withSequence(
        withTiming(difference < 0 ? 3 : 1, { duration: 520, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }),
        withTiming(rightRestFrame, { duration: 300, reduceMotion: ReduceMotion.System }),
      ));
    } else {
      // Reset while collapsed/loading so each reveal starts a visible pull.
      leftPhase.set(reduced || leftSheet || rightSheet ? leftRestFrame : 0);
      rightPhase.set(reduced || leftSheet || rightSheet ? rightRestFrame : 0);
    }
    return () => { cancelAnimation(leftPhase); cancelAnimation(rightPhase); };
  }, [active, reduced, youSteps, partnerSteps, difference, leftRestFrame, rightRestFrame, leftPhase, rightPhase, leftSheet, rightSheet]);
  useEffect(() => {
    if (!active || reduced) {
      cancelAnimation(leftBounce); leftBounce.set(0);
      cancelAnimation(rightBounce); rightBounce.set(0);
    }
    return () => { cancelAnimation(leftBounce); cancelAnimation(rightBounce); };
  }, [active, reduced, leftBounce, rightBounce]);
  useEffect(() => {
    // Leave the leading character's outer silhouette inside the arena.
    const target = -pull * edgeTravel;
    if (!active || reduced) { cancelAnimation(shift); shift.set(target); }
    else shift.set(withSpring(target, { duration: 650, dampingRatio: 1, reduceMotion: ReduceMotion.System }));
    return () => cancelAnimation(shift);
  }, [active, reduced, pull, edgeTravel, shift]);

  const grips = useDerivedValue(() => {
    const left = leftSprite.frames[tugFrameIndex(leftPhase.get())];
    const right = rightSprite.frames[tugFrameIndex(rightPhase.get())];
    return {
      rearLeft: stageGrip(left.rear, 'left', leftX, leftTop, scale, leftBounce.get()),
      frontLeft: stageGrip(left.front, 'left', leftX, leftTop, scale, leftBounce.get()),
      frontRight: stageGrip(right.front, 'right', rightX, rightTop, scale, rightBounce.get()),
      rearRight: stageGrip(right.rear, 'right', rightX, rightTop, scale, rightBounce.get()),
    };
  });
  const ropeProps = useAnimatedProps(() => {
    const { rearLeft: a, frontLeft: b, frontRight: c, rearRight: d } = grips.get();
    // Each end passes through both fists. The atlas covers the rope at the grip.
    return { d: `M${a.x} ${a.y} L${b.x} ${b.y} Q${(b.x + c.x) / 2} ${(b.y + c.y) / 2 + 4 * (1 - leadStrength)} ${c.x} ${c.y} L${d.x} ${d.y}` };
  });
  const floorRopeProps = useAnimatedProps(() => {
    const offset = shift.get();
    const { rearLeft, rearRight } = grips.get();
    const floorY = stageHeight - GROUND + 1;
    const leftEnd = 8;
    const rightEnd = arenaWidth - 8;
    const leftFloor = Math.max(leftEnd, leftX + offset + width * 0.1);
    const rightFloor = Math.min(rightEnd, rightX + offset + width * 0.9);
    const leftSlack = leftFloor - leftEnd;
    const rightSlack = rightEnd - rightFloor;
    const leftHand = rearLeft.x + offset;
    const rightHand = rearRight.x + offset;
    // Endpoints stay at the arena edges while the hands move. The trailing
    // rope therefore unfurls into the newly empty space, behind the figures.
    return { d: [
      `M${leftHand} ${rearLeft.y}`,
      `C${leftHand - width * 0.2} ${rearLeft.y + 18} ${leftFloor + 10} ${floorY - 24} ${leftFloor} ${floorY}`,
      `C${leftFloor - leftSlack * 0.3} ${floorY + 5} ${leftEnd + leftSlack * 0.25} ${floorY - 4} ${leftEnd} ${floorY + 1}`,
      `M${rightHand} ${rearRight.y}`,
      `C${rightHand + width * 0.2} ${rearRight.y + 18} ${rightFloor - 10} ${floorY - 24} ${rightFloor} ${floorY}`,
      `C${rightFloor + rightSlack * 0.3} ${floorY + 5} ${rightEnd - rightSlack * 0.25} ${floorY - 4} ${rightEnd} ${floorY + 1}`,
    ].join(' ') };
  });
  const group = useAnimatedStyle(() => ({ transform: [{ translateX: shift.get() }] }));
  const stepLabels = useDerivedValue(() => stepLabelLayout(arenaWidth, width, leftX, rightX, shift.get(), labelWidth, edgeTravel));
  const leftStepLabel = useAnimatedStyle(() => ({ transform: [{ translateX: stepLabels.get().left }] }));
  const rightStepLabel = useAnimatedStyle(() => ({ transform: [{ translateX: stepLabels.get().right }] }));
  const flag = useAnimatedStyle(() => {
    const { frontLeft: b, frontRight: c } = grips.get();
    return { transform: [{ translateX: (b.x + c.x) / 2 - 8 }, { translateY: (b.y + c.y) / 2 + 2 }] };
  });
  const label = difference === 0 ? `Tug of war is even between ${you} and ${partner}`
    : `${difference > 0 ? you : partner} is pulling the rope ahead by ${Math.abs(difference).toLocaleString()} steps`;

  return <View style={StyleSheet.absoluteFill}>
    <View accessible accessibilityLabel={label} pointerEvents="none" style={StyleSheet.absoluteFill} />
    {showGround ? <View pointerEvents="none" style={[styles.ground, { backgroundColor: dark ? '#FFFFFF0A' : '#23303D0A' }]} /> : null}
    <Svg pointerEvents="none" width={arenaWidth} height={stageHeight} style={StyleSheet.absoluteFill}>
      <AnimatedPath animatedProps={floorRopeProps} stroke="#9C6B3A" strokeWidth={5} strokeLinecap="round" fill="none" />
      <AnimatedPath animatedProps={floorRopeProps} stroke="#E3B87C" strokeWidth={3} strokeDasharray="5 7" strokeLinecap="round" fill="none" />
    </Svg>
    <View pointerEvents="none" style={[styles.centerLine, { borderColor: dark ? '#FFFFFF30' : '#23303D30' }]} />
    <View pointerEvents="none" style={[styles.centerMark, { backgroundColor: cardColor }]}><Zap size={11} color={knotColor} fill={knotColor} /></View>
    <Animated.View style={[StyleSheet.absoluteFill, group]}>
      <Svg pointerEvents="none" width={arenaWidth} height={stageHeight} style={StyleSheet.absoluteFill}>
        <AnimatedPath animatedProps={ropeProps} stroke="#9C6B3A" strokeWidth={5} strokeLinecap="round" fill="none" />
        <AnimatedPath animatedProps={ropeProps} stroke="#E3B87C" strokeWidth={3} strokeDasharray="5 7" fill="none" />
      </Svg>
      <Animated.View pointerEvents="none" style={[styles.flag, flag]}>
        <View style={[styles.knot, { backgroundColor: knotColor }]} />
        <Svg width={16} height={22}><Path d="M8 0 L15 20 L8 16 L1 20 Z" fill={knotColor} /></Svg>
      </Animated.View>
      <Character identity={leftIdentity} side="left" x={leftX} top={leftTop} scale={scale} phase={leftPhase} bounce={leftBounce} name={you} leader={difference > 0} active={active} reduced={reduced} showCrown={showCrowns && leadStrength >= 0.2} onLoad={() => setLeftLoaded(true)} sheetUri={leftSheet} poseIndex={leftRestFrame} />
      <Character identity={rightIdentity} side="right" x={rightX} top={rightTop} scale={scale} phase={rightPhase} bounce={rightBounce} name={partner} leader={difference < 0} active={active} reduced={reduced} showCrown={showCrowns && leadStrength >= 0.2} onLoad={() => setRightLoaded(true)} sheetUri={rightSheet} poseIndex={rightRestFrame} />
      {showStepLabels ? <>
        <Text accessibilityRole={onNamePress ? 'link' : undefined} onPress={onNamePress ? event => { event.stopPropagation(); onNamePress(); } : undefined} numberOfLines={1} style={[styles.avatarName, { left: leftX, top: stageHeight - GROUND + 10, width, color: dark ? '#E2E8F0' : '#475569' }]}>{you}</Text>
        <Text accessibilityRole={onNamePress ? 'link' : undefined} onPress={onNamePress ? event => { event.stopPropagation(); onNamePress(); } : undefined} numberOfLines={1} style={[styles.avatarName, { left: rightX, top: stageHeight - GROUND + 10, width, color: dark ? '#E2E8F0' : '#475569' }]}>{partner}</Text>
      </> : null}
    </Animated.View>
    {showStepLabels ? <>
      <Animated.View accessible accessibilityLabel={`${you}, ${youSteps.toLocaleString()} steps`} pointerEvents="none" style={[styles.stepLabel, { top: labelTop, width: labelWidth }, leftStepLabel]}>
        <AnimatedStepCount value={youSteps} color={CORAL} fontSize={leftCountSize} />
        <Text style={styles.stepUnit}>steps</Text>
      </Animated.View>
      <Animated.View accessible accessibilityLabel={`${partner}, ${partnerSteps.toLocaleString()} steps`} pointerEvents="none" style={[styles.stepLabel, { top: labelTop, width: labelWidth }, rightStepLabel]}>
        <AnimatedStepCount value={partnerSteps} color={TEAL} fontSize={rightCountSize} />
        <Text style={styles.stepUnit}>steps</Text>
      </Animated.View>
    </> : null}
  </View>;
}

const styles = StyleSheet.create({
  stepLabel: { position: 'absolute', left: 0, alignItems: 'center' },
  avatarName: { position: 'absolute', textAlign: 'center', fontSize: 14, lineHeight: 20, fontWeight: '700' },
  stepUnit: { color: '#64748B', fontSize: 11, lineHeight: 14 },
  character: { position: 'absolute' },
  crown: { position: 'absolute', top: 0, left: '35%', width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  ground: { position: 'absolute', left: 0, right: 0, bottom: 0, height: GROUND },
  centerLine: { position: 'absolute', left: '50%', top: 48, bottom: GROUND, borderLeftWidth: 2, borderStyle: 'dashed' },
  centerMark: { position: 'absolute', left: '50%', bottom: GROUND - 11, width: 22, height: 22, marginLeft: -11, borderRadius: 11, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  flag: { position: 'absolute', top: 0, left: 0, width: 16, alignItems: 'center' },
  knot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#FFFFFF', marginTop: -5, marginBottom: -4, zIndex: 1 },
});
