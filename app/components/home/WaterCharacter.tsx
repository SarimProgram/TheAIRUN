import React, { useEffect, useId } from 'react';
import { AppState, Pressable, StyleSheet } from 'react-native';
import Animated, { cancelAnimation, Easing, ReduceMotion, useAnimatedProps, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { ClipPath, Defs, G, Image as SvgImage, Rect } from 'react-native-svg';
import { useHomeAvatar } from '../../lib/home-avatar';
import HomeAvatarPose from './HomeAvatarPose';

const SHEET = require('../../assets/avatars/water-drinking-v2.png');
const WIDTH = 1881;
const HEIGHT = 836;
const FRAME_WIDTH = WIDTH / 6;
const FRAME_HEIGHT = HEIGHT / 2;
// Lift immediately on touch, hold the sip, then return to the resting pose.
const FRAMES = [0, 1, 2, 3, 4, 5, 5, 5, 5, 5, 5, 4, 3, 2, 1, 0];
const AnimatedImage = Animated.createAnimatedComponent(SvgImage);

/** Play one lift / sip / lower sequence when the avatar is pressed. */
export default function WaterCharacter({ gender, facing, name, onPress, disabled = false, accessibilityLabel, role = 'you', hasWater = false }: {
  gender?: string | null;
  facing: 'left' | 'right';
  name: string;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  role?: 'you' | 'partner';
  hasWater?: boolean;
}) {
  const avatar = useHomeAvatar(role);
  const id = `water-character-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const phase = useSharedValue(0);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') { cancelAnimation(phase); phase.set(0); }
    });
    return () => { subscription.remove(); cancelAnimation(phase); };
  }, [phase]);
  const play = () => {
    if (disabled) return;
    onPress?.();
    if (avatar?.kind === 'home-sheet') return;
    cancelAnimation(phase);
    phase.set(0);
    if (!reducedMotion) {
      phase.set(withTiming(FRAMES.length, { duration: FRAMES.length * 150, easing: Easing.linear, reduceMotion: ReduceMotion.System }));
    }
  };
  const imageProps = useAnimatedProps(() => ({ x: -FRAMES[Math.min(FRAMES.length - 1, Math.floor(phase.get()))] * FRAME_WIDTH }));

  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? `Animate ${name} drinking water`} accessibilityState={{ disabled }} disabled={disabled} onPress={play} style={[styles.frame, facing === 'left' && styles.mirrored]}>
    {avatar?.kind === 'home-sheet' ? <HomeAvatarPose uri={avatar.uri} pose={hasWater ? 'water-drink' : 'water-idle'} /> :
    <Svg width="100%" height="100%" viewBox={`75 0 205 ${FRAME_HEIGHT}`} preserveAspectRatio="xMidYMax meet" accessible={false}>
      <Defs><ClipPath id={id}><Rect width={FRAME_WIDTH} height={FRAME_HEIGHT} /></ClipPath></Defs>
      <G clipPath={`url(#${id})`}>
        <AnimatedImage href={SHEET} width={WIDTH} height={HEIGHT} y={gender?.toLowerCase() === 'female' ? -FRAME_HEIGHT : 0} animatedProps={imageProps} />
      </G>
    </Svg>}
  </Pressable>;
}

const styles = StyleSheet.create({
  frame: { width: '100%', height: '100%', overflow: 'hidden' },
  mirrored: { transform: [{ scaleX: -1 }] },
});
