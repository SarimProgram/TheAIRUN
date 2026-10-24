import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
  StatusBar,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
  interpolate,
  cancelAnimation,
} from 'react-native-reanimated';
import { Heart } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { AnimatedBeggingCat } from '../partner/AnimatedBeggingCat';

const DURATION_MS = 5000;

const HEART_BURST = [
  { left: '10%', delay: 0, size: 18, drift: -10 },
  { left: '26%', delay: 120, size: 24, drift: 8 },
  { left: '42%', delay: 70, size: 16, drift: -6 },
  { left: '58%', delay: 200, size: 22, drift: 12 },
  { left: '74%', delay: 50, size: 17, drift: -14 },
  { left: '88%', delay: 170, size: 20, drift: 6 },
];

const ANGRY_BURST = [
  { left: '8%', delay: 0, size: 28, drift: -12 },
  { left: '24%', delay: 90, size: 34, drift: 10 },
  { left: '40%', delay: 50, size: 24, drift: -8 },
  { left: '56%', delay: 160, size: 30, drift: 14 },
  { left: '72%', delay: 30, size: 26, drift: -16 },
  { left: '86%', delay: 140, size: 28, drift: 8 },
];

const DROP_BURST = [
  { left: '10%', delay: 0, size: 18, drift: -10 },
  { left: '28%', delay: 100, size: 22, drift: 8 },
  { left: '46%', delay: 60, size: 16, drift: -6 },
  { left: '64%', delay: 180, size: 20, drift: 12 },
  { left: '82%', delay: 40, size: 18, drift: -14 },
];

const FloatingHeart = ({ left, delay, size, drift }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: 2600, easing: Easing.out(Easing.cubic) })
    );
    return () => cancelAnimation(progress);
  }, [delay, progress]);

  const heartStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.12, 0.65, 1], [0, 1, 0.85, 0]),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [80, -180]) },
      { translateX: interpolate(progress.value, [0, 0.5, 1], [0, drift, drift * 1.4]) },
      { scale: interpolate(progress.value, [0, 0.25, 0.6, 1], [0.3, 1.15, 1, 0.75]) },
    ],
  }));

  return (
    <Animated.View style={[styles.floatingBurst, { left }, heartStyle]}>
      <Heart size={size} color="#FF6B6B" fill="#FF6B6B" />
    </Animated.View>
  );
};

const FloatingAngryEmoji = ({ left, delay, size, drift }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: 2400, easing: Easing.out(Easing.cubic) })
    );
    return () => cancelAnimation(progress);
  }, [delay, progress]);

  const emojiStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.1, 0.6, 1], [0, 1, 0.9, 0]),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [60, -200]) },
      { translateX: interpolate(progress.value, [0, 0.5, 1], [0, drift, drift * 1.3]) },
      { scale: interpolate(progress.value, [0, 0.2, 0.55, 1], [0.4, 1.2, 1, 0.8]) },
    ],
  }));

  return (
    <Animated.View style={[styles.floatingBurst, { left }, emojiStyle]}>
      <Text style={{ fontSize: size }}>😠</Text>
    </Animated.View>
  );
};

const FloatingDrop = ({ left, delay, size, drift }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: 2400, easing: Easing.out(Easing.cubic) })
    );
    return () => cancelAnimation(progress);
  }, [delay, progress]);

  const dropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.1, 0.6, 1], [0, 1, 0.9, 0]),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [60, -200]) },
      { translateX: interpolate(progress.value, [0, 0.5, 1], [0, drift, drift * 1.3]) },
      { scale: interpolate(progress.value, [0, 0.2, 0.55, 1], [0.4, 1.15, 1, 0.8]) },
    ],
  }));

  return (
    <Animated.View style={[styles.floatingBurst, { left }, dropStyle]}>
      <Text style={{ fontSize: size }}>💧</Text>
    </Animated.View>
  );
};

const PremiumFullscreen = ({ visible, request, onFinish, suppressHaptics = false }) => {
  const insets = useSafeAreaInsets();
  const finishedRef = useRef(false);
  const hapticKeyRef = useRef(null);
  const [secondsLeft, setSecondsLeft] = useState(5);

  const angryShake = useSharedValue(0);
  const contentOpacity = useSharedValue(0);
  const contentScale = useSharedValue(0.92);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onFinish?.();
  }, [onFinish]);

  useEffect(() => {
    if (!visible || !request?.key) {
      finishedRef.current = false;
      return undefined;
    }

    finishedRef.current = false;
    setSecondsLeft(5);

    if (!suppressHaptics && hapticKeyRef.current !== request.key) {
      hapticKeyRef.current = request.key;
      Haptics.notificationAsync(
        request.mode === 'angry'
          ? Haptics.NotificationFeedbackType.Warning
          : Haptics.NotificationFeedbackType.Success
      );
    }

    contentOpacity.value = 0;
    contentScale.value = 0.92;
    angryShake.value = 0;

    contentOpacity.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) });
    contentScale.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.back(1.2)) });

    if (request.mode === 'angry') {
      angryShake.value = withRepeat(
        withSequence(
          withTiming(-8, { duration: 60 }),
          withTiming(8, { duration: 60 }),
          withTiming(-5, { duration: 50 }),
          withTiming(5, { duration: 50 }),
          withTiming(0, { duration: 40 }),
          withTiming(0, { duration: 700 })
        ),
        -1,
        false
      );
    }

    const tick = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(tick);
          finish();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(tick);
      cancelAnimation(angryShake);
    };
  }, [visible, request?.key, request?.mode, finish, angryShake, contentOpacity, contentScale, suppressHaptics]);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ scale: contentScale.value }],
  }));

  const angryEmojiStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${angryShake.value}deg` }],
  }));

  if (!visible || !request) {
    return null;
  }

  const isAngry = request.mode === 'angry';
  const isPhoto = request.mode === 'cat' || request.mode === 'photo';
  const gradientColors = isAngry
    ? ['#450A0A', '#991B1B', '#DC2626']
    : isPhoto
      ? request.copy?.eyebrow?.includes('YOUR REMINDER') || request.copy?.eyebrow?.includes('CUSTOM')
        ? ['#881337', '#FF6B6B', '#FECDD3']
        : request.copy?.eyebrow?.includes('HYDRATION')
        ? ['#0C4A6E', '#0369A1', '#7DD3FC']
        : request.copy?.eyebrow?.includes('CALORIE')
          ? ['#431407', '#9A3412', '#FB923C']
          : ['#14532D', '#15803D', '#4ADE80']
      : ['#831843', '#BE185D', '#FB7185'];

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={finish}>
      <StatusBar barStyle="light-content" />
      <View style={styles.root}>
        <LinearGradient colors={gradientColors} style={StyleSheet.absoluteFill} />
        {Platform.OS === 'ios' ? (
          <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill} />
        ) : null}

        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <View style={styles.timerPill}>
            <Text style={styles.timerText}>{secondsLeft}</Text>
          </View>
          <TouchableOpacity onPress={finish} style={styles.skipBtn} activeOpacity={0.85}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        {request.mode === 'hearts'
          ? HEART_BURST.map((heart, index) => (
              <FloatingHeart key={`fs-heart-${index}`} {...heart} />
            ))
          : null}

        {isAngry
          ? ANGRY_BURST.map((emoji, index) => (
              <FloatingAngryEmoji key={`fs-angry-${index}`} {...emoji} />
            ))
          : null}

        {isPhoto
          ? DROP_BURST.map((drop, index) => (
              <FloatingDrop key={`fs-drop-${index}`} {...drop} />
            ))
          : null}

        <Animated.View style={[styles.content, contentStyle]}>
          {isPhoto && request.previewImage ? (
            <AnimatedBeggingCat
              source={request.previewImage}
              animation={request.photoAnimation}
              style={styles.heroCat}
            />
          ) : isAngry ? (
            <Animated.Text style={[styles.heroEmoji, angryEmojiStyle]}>😠</Animated.Text>
          ) : (
            <Heart size={56} color="#FFF" fill="#FFF" style={styles.heroHeart} />
          )}
          <Text style={styles.eyebrow}>{request.copy?.eyebrow || 'PARTNER · HYDRATION'}</Text>
          <Text style={[styles.title, isAngry && styles.titleAngry]} numberOfLines={4}>
            {request.copy?.title || 'Drink some water.'}
          </Text>
          <Text style={styles.fromPartner}>From your partner</Text>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  timerPill: {
    minWidth: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  timerText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  skipBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  skipText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  floatingBurst: {
    position: 'absolute',
    bottom: '18%',
    zIndex: 10,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 32,
    zIndex: 20,
  },
  heroEmoji: {
    fontSize: 72,
    marginBottom: 16,
  },
  heroCat: {
    width: 180,
    height: 180,
    marginBottom: 12,
  },
  heroHeart: {
    marginBottom: 16,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2.2,
    color: 'rgba(255,255,255,0.78)',
    marginBottom: 12,
    textAlign: 'center',
  },
  title: {
    fontSize: 34,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.5,
    lineHeight: 40,
  },
  titleAngry: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fromPartner: {
    marginTop: 18,
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.72)',
    letterSpacing: 0.4,
  },
});

export default PremiumFullscreen;
