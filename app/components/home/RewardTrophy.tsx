import React, { useCallback, useEffect, useId, useRef } from 'react';
import { Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const VIEW_W = 60;
const VIEW_H = 36;

const idleGlint = () => withRepeat(withSequence(
  withDelay(4200, withTiming(1, { duration: 180, easing: EASE_OUT })),
  withTiming(0, { duration: 360, easing: EASE_OUT }),
), -1);

const sparkle = (cx: number, cy: number, r: number) =>
  `M${cx} ${cy - r}Q${cx} ${cy} ${cx + r} ${cy}Q${cx} ${cy} ${cx} ${cy + r}Q${cx} ${cy} ${cx - r} ${cy}Q${cx} ${cy} ${cx} ${cy - r}Z`;

export type RewardTrophyProps = {
  /** Rendered height; width follows the 60:36 artwork ratio. */
  size?: number;
  /** Increment to replay the pop. 0 keeps the trophy hidden until the first play. */
  playKey: number;
  /** Periodic glint only runs while the trophy is on screen. */
  active?: boolean;
  accent?: string;
  replayable?: boolean;
  /** Milliseconds to hold before the next pop starts. */
  delay?: number;
};

export default function RewardTrophy({ size = VIEW_H, playKey, active = true, accent = '#FF5366', replayable = false, delay = 0 }: RewardTrophyProps) {
  const id = useId().replace(/:/g, '');
  const scale = useSharedValue(playKey > 0 ? 1 : 0.6);
  const opacity = useSharedValue(playKey > 0 ? 1 : 0);
  const tilt = useSharedValue(0);
  const glint = useSharedValue(0);
  const played = useRef(false);
  const activeRef = useRef(active);
  activeRef.current = active;

  const play = useCallback((fadeIn: boolean, wait = 0) => {
    if (fadeIn) {
      opacity.value = 0;
      scale.value = 0.6;
      opacity.value = withDelay(wait, withTiming(1, { duration: 200, easing: EASE_OUT }));
    } else {
      scale.value = 0.9;
    }
    scale.value = withDelay(wait, withSequence(
      withTiming(1.12, { duration: 300, easing: EASE_OUT }),
      withTiming(1, { duration: 260, easing: EASE_OUT }),
    ));
    tilt.value = withDelay(wait + 160, withSequence(
      withTiming(-9, { duration: 130, easing: EASE_OUT }),
      withTiming(6, { duration: 160, easing: EASE_OUT }),
      withTiming(0, { duration: 200, easing: EASE_OUT }),
    ));
    played.current = true;
    glint.value = withDelay(wait + 360, withSequence(
      withTiming(1, { duration: 200, easing: EASE_OUT }),
      withTiming(0, { duration: 440, easing: EASE_OUT }),
      ...(activeRef.current ? [idleGlint()] : []),
    ));
  }, [glint, opacity, scale, tilt]);

  const delayRef = useRef(delay);
  delayRef.current = delay;
  useEffect(() => {
    if (playKey > 0) play(opacity.value < 1, delayRef.current);
  }, [playKey, play, opacity]);

  useEffect(() => {
    if (!active || !played.current) return;
    glint.value = idleGlint();
    return () => {
      cancelAnimation(glint);
      glint.value = 0;
    };
  }, [active, glint]);

  const wrapperStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }, { rotate: `${tilt.value}deg` }],
  }));
  const glintProps = useAnimatedProps(() => ({ opacity: glint.value }));
  const sparkleProps = useAnimatedProps(() => ({ opacity: glint.value * 0.95 }));

  const width = size * VIEW_W / VIEW_H;
  const art = (
    <Animated.View pointerEvents="none" style={[{ width, height: size }, wrapperStyle]}>
      <Svg width={width} height={size} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
        <Defs>
          <LinearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FFE08A" />
            <Stop offset="0.55" stopColor="#FFC43D" />
            <Stop offset="1" stopColor="#F29B12" />
          </LinearGradient>
        </Defs>
        <Path d="M19.5 7H15.5C15.5 12.5 17.5 15.5 21 16" fill="none" stroke="#F2A51E" strokeWidth={2.4} strokeLinecap="round" />
        <Path d="M40.5 7H44.5C44.5 12.5 42.5 15.5 39 16" fill="none" stroke="#F2A51E" strokeWidth={2.4} strokeLinecap="round" />
        <Path d="M19 3.5H41V9C41 16.2 36.4 21.5 30 21.5C23.6 21.5 19 16.2 19 9Z" fill={`url(#${id}-gold)`} />
        <Path d="M30 7.2L31.4 10.1L34.5 10.5L32.2 12.6L32.8 15.7L30 14.2L27.2 15.7L27.8 12.6L25.5 10.5L28.6 10.1Z" fill="#FFFFFF" opacity={0.92} />
        <Rect x={27.8} y={21} width={4.4} height={5} fill="#F2A51E" />
        <Rect x={22.5} y={25.5} width={15} height={3.6} rx={1.4} fill="#FFC43D" />
        <Rect x={20.5} y={29} width={19} height={4.6} rx={1.8} fill={accent} />
        <AnimatedPath animatedProps={glintProps} d="M22.6 6.5C22.6 12.5 24.6 16.4 27.6 18.4" fill="none" stroke="#FFFFFF" strokeWidth={1.8} strokeLinecap="round" />
        <AnimatedPath animatedProps={sparkleProps} d={sparkle(9, 9, 4.2)} fill="#FFC43D" />
        <AnimatedPath animatedProps={sparkleProps} d={sparkle(51.5, 6.5, 3.2)} fill={accent} />
        <AnimatedPath animatedProps={sparkleProps} d={sparkle(50, 25, 2.6)} fill="#FFC43D" />
      </Svg>
    </Animated.View>
  );

  if (!replayable) return art;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Play trophy animation" hitSlop={8}
      onPress={() => { void Haptics.selectionAsync(); play(false); }}>
      {art}
    </Pressable>
  );
}
