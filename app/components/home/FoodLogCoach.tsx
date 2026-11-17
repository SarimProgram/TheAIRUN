import React, { useEffect, useId, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation, Easing, useAnimatedProps, useDerivedValue, useReducedMotion,
  useSharedValue, withRepeat, withTiming,
} from 'react-native-reanimated';
import Svg, { ClipPath, Defs, FeColorMatrix, Filter, G, Image as SvgImage, Rect } from 'react-native-svg';

export type FoodCoachStage = 'welcome' | 'manual' | 'scan' | 'ready';
export type FoodCoachGender = 'male' | 'female';
const ART = {
  male: require('../../assets/avatars/food-coach/male-sequence.png'),
  female: require('../../assets/avatars/food-coach/female-sequence.png'),
};
const SEQUENCES: Record<FoodCoachStage, readonly number[]> = {
  welcome: [0, 1, 2], manual: [2, 1, 0],
  scan: [3, 4, 5, 6, 7, 8, 7, 6, 5, 4, 3], ready: [9, 10, 11],
};
const STILL: Record<FoodCoachStage, number> = { welcome: 2, manual: 0, scan: 5, ready: 11 };
const CELL_W = 256, CELL_H = 384, FRAMES = 12;
const AnimatedImage = Animated.createAnimatedComponent(SvgImage);

/** Two neighboring, aligned frames dissolve on the UI thread, with no JS timer. */
export default function FoodLogCoach({ gender = 'male', stage, facing = 'left', playing = true }: {
  gender?: FoodCoachGender; stage: FoodCoachStage; facing?: 'left' | 'right'; playing?: boolean;
}) {
  const id = `food-coach-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const reduced = useReducedMotion();
  const [active, setActive] = useState(AppState.currentState === 'active');
  const progress = useSharedValue(0);
  const sequence = SEQUENCES[stage];
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setActive(state === 'active'));
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    cancelAnimation(progress);
    progress.set(0);
    if (active && playing && !reduced) {
      const play = withTiming(sequence.length - 1, {
        duration: stage === 'scan' ? 2800 : 560,
        easing: stage === 'scan' ? Easing.linear : Easing.out(Easing.cubic),
      });
      progress.set(stage === 'scan' ? withRepeat(play, -1, false) : play);
    }
    return () => cancelAnimation(progress);
  }, [active, playing, progress, reduced, sequence, stage]);

  const frame = useDerivedValue(() => {
    if (reduced || !active || !playing) return { first: STILL[stage], second: STILL[stage], blend: 0 };
    const value = Math.min(sequence.length - 1, Math.max(0, progress.get()));
    const index = Math.floor(value);
    return { first: sequence[index], second: sequence[Math.min(index + 1, sequence.length - 1)], blend: value - index };
  });
  const first = useAnimatedProps(() => ({ x: -frame.get().first * CELL_W }));
  const second = useAnimatedProps(() => ({ x: -frame.get().second * CELL_W, opacity: frame.get().blend }));
  return <View pointerEvents="none" style={[styles.frame, facing === 'left' && styles.mirrored]} accessible={false}>
    <Svg width="100%" height="100%" viewBox={`0 0 ${CELL_W} ${CELL_H}`} preserveAspectRatio="xMidYMax meet" accessible={false}>
      <Defs>
        <ClipPath id={id}><Rect width={CELL_W} height={CELL_H} /></ClipPath>
        {/* Generated cutouts retain low-alpha haze. Clear it before frame opacity
            is applied, so it cannot build up while neighboring poses dissolve. */}
        <Filter id={`${id}-alpha`} x={0} y={0} width={CELL_W} height={CELL_H} filterUnits="userSpaceOnUse">
          <FeColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1.25 -0.25" />
        </Filter>
      </Defs>
      <G clipPath={`url(#${id})`}>
        <AnimatedImage href={ART[gender]} width={CELL_W * FRAMES} height={CELL_H} filter={`url(#${id}-alpha)`} animatedProps={first} />
        <AnimatedImage href={ART[gender]} width={CELL_W * FRAMES} height={CELL_H} filter={`url(#${id}-alpha)`} animatedProps={second} />
      </G>
    </Svg>
  </View>;
}
const styles = StyleSheet.create({ frame: { width: '100%', height: '100%', overflow: 'hidden' }, mirrored: { transform: [{ scaleX: -1 }] } });
