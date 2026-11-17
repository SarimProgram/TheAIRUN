import React, { useEffect } from 'react';
import { StyleSheet, TextInput } from 'react-native';
import type { TextInputProps } from 'react-native';
import Animated, { cancelAnimation, Easing, ReduceMotion, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';

const AnimatedInput = Animated.createAnimatedComponent(TextInput);
const formatSteps = (value: number) => {
  'worklet';
  return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

export default function AnimatedStepCount({ value, color, fontSize = 20, animateOnMount = false }: { value: number; color: string; fontSize?: number; animateOnMount?: boolean }) {
  const count = useSharedValue(animateOnMount ? 0 : value);
  useEffect(() => {
    count.set(withTiming(value, {
      duration: 280,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    }));
    return () => cancelAnimation(count);
  }, [count, value]);
  const animatedProps = useAnimatedProps<TextInputProps & { text: string }>(() => ({ text: formatSteps(count.get()) }));
  return <AnimatedInput
    animatedProps={animatedProps}
    defaultValue={formatSteps(animateOnMount ? 0 : value)}
    editable={false}
    accessible={false}
    pointerEvents="none"
    underlineColorAndroid="transparent"
    style={[styles.count, { color, fontSize, lineHeight: fontSize + 6 }]}
  />;
}

const styles = StyleSheet.create({
  count: { padding: 0, margin: 0, width: '100%', fontSize: 20, lineHeight: 26, fontWeight: '900', fontVariant: ['tabular-nums'], textAlign: 'center' },
});
