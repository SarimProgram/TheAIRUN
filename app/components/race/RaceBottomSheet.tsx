import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

type Props = { children: React.ReactNode; bottomInset: number; onVisibleHeightChange: (height: number) => void };
const PEEK_HEIGHT = 64;

export default function RaceBottomSheet({ children, bottomInset, onVisibleHeightChange }: Props) {
  const [height, setHeight] = useState(252);
  const [collapsed, setCollapsed] = useState(false);
  const translation = useSharedValue(0);
  const dragStart = useSharedValue(0);
  const maximum = Math.max(0, height - PEEK_HEIGHT);
  useEffect(() => {
    translation.set(withSpring(collapsed ? maximum : 0, { damping: 24, stiffness: 240 }));
    onVisibleHeightChange(collapsed ? PEEK_HEIGHT : height);
  }, [collapsed, height, maximum, onVisibleHeightChange, translation]);

  const pan = Gesture.Pan().onBegin(() => {
    cancelAnimation(translation);
    dragStart.set(translation.get());
  }).onUpdate(event => {
    translation.set(Math.max(0, Math.min(maximum, dragStart.get() + event.translationY)));
  }).onEnd(event => {
    const close = translation.get() + event.velocityY * 0.15 > maximum / 2;
    translation.set(withSpring(close ? maximum : 0, { damping: 24, stiffness: 240, velocity: event.velocityY }));
    runOnJS(setCollapsed)(close);
  }).onFinalize((_event, success) => {
    if (success) return;
    // Interrupted gestures must also settle at a usable detent.
    const close = translation.get() > maximum / 2;
    translation.set(withSpring(close ? maximum : 0, { damping: 24, stiffness: 240 }));
    runOnJS(setCollapsed)(close);
  });
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translation.get() }] }));

  return <Animated.View style={[styles.sheet, { bottom: -bottomInset, paddingBottom: bottomInset }, animatedStyle]}
    onLayout={event => setHeight(event.nativeEvent.layout.height - bottomInset)}>
    <GestureDetector gesture={pan}>
      <View collapsable={false}>
        <Pressable style={styles.handleTouch} onPress={() => setCollapsed(value => !value)}
          accessibilityRole="button" accessibilityLabel={collapsed ? 'Expand race controls' : 'Collapse race controls'}
          accessibilityHint="Drag up or down, or double tap to toggle">
          <View style={styles.handle} />
        </Pressable>
      </View>
    </GestureDetector>
    <View accessibilityElementsHidden={collapsed} importantForAccessibility={collapsed ? 'no-hide-descendants' : 'auto'}>
      {children}
    </View>
  </Animated.View>;
}

const styles = StyleSheet.create({
  sheet: { position: 'absolute', left: 0, right: 0, backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderCurve: 'continuous', overflow: 'hidden', boxShadow: '0 -4px 20px #25364618', zIndex: 20 },
  handleTouch: { height: 44, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#BBC3CA' },
});
