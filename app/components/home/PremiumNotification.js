import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Heart } from 'lucide-react-native';
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
import * as Haptics from 'expo-haptics';
import { AnimatedBeggingCat } from '../partner/AnimatedBeggingCat';

const HEART_COLOR = '#FF6B6B';

const THEMES = {
  hero: {
    heart: HEART_COLOR,
    textMain: '#FFFFFF',
    textMuted: 'rgba(255,255,255,0.78)',
    glassBorder: 'rgba(255,255,255,0.35)',
    glassBg: 'rgba(255,255,255,0.16)',
    emptyTint: 'rgba(255,255,255,0.06)',
    timerBg: 'rgba(0,0,0,0.22)',
    timerBorder: 'rgba(255,255,255,0.18)',
    skipBg: 'rgba(255,255,255,0.14)',
    skipBorder: 'rgba(255,255,255,0.22)',
    badgeColor: 'rgba(255,255,255,0.72)',
    badgeBg: 'rgba(255,255,255,0.12)',
    badgeBorder: 'rgba(255,255,255,0.2)',
    eyebrow: 'rgba(255,255,255,0.72)',
    titleShadow: 'rgba(255, 107, 107, 0.55)',
    catEyebrow: 'rgba(224, 242, 254, 0.92)',
    catTitleShadow: 'rgba(14, 116, 144, 0.55)',
    angryEyebrow: 'rgba(254, 202, 202, 0.9)',
    angryTitleShadow: 'rgba(220, 38, 38, 0.8)',
    angryShellBorder: 'rgba(254, 202, 202, 0.45)',
    angryTint: 'rgba(254, 226, 226, 0.14)',
    catShellBorder: 'rgba(125, 211, 252, 0.45)',
    catTint: 'rgba(186, 230, 253, 0.18)',
  },
  light: {
    heart: HEART_COLOR,
    textMain: '#1F2937',
    textMuted: '#6B7280',
    glassBorder: '#E5E7EB',
    glassBg: 'rgba(255,255,255,0.92)',
    emptyTint: 'rgba(255, 107, 107, 0.04)',
    timerBg: 'rgba(31, 41, 55, 0.08)',
    timerBorder: 'rgba(31, 41, 55, 0.12)',
    skipBg: 'rgba(31, 41, 55, 0.06)',
    skipBorder: 'rgba(31, 41, 55, 0.12)',
    badgeColor: '#1F938A',
    badgeBg: 'rgba(31, 147, 138, 0.08)',
    badgeBorder: 'rgba(31, 147, 138, 0.18)',
    eyebrow: '#9CA3AF',
    titleShadow: 'transparent',
    catEyebrow: '#0E7490',
    catTitleShadow: 'transparent',
    angryEyebrow: '#DC2626',
    angryTitleShadow: 'transparent',
    angryShellBorder: 'rgba(252, 165, 165, 0.8)',
    angryTint: 'rgba(254, 226, 226, 0.45)',
    catShellBorder: 'rgba(125, 211, 252, 0.8)',
    catTint: 'rgba(186, 230, 253, 0.35)',
  },
};

const CARD_DURATION_MS = 5 * 60 * 1000;
const CARD_DURATION_SEC = Math.ceil(CARD_DURATION_MS / 1000);

const HEART_BURST = [
  { left: '12%', delay: 0, size: 14, drift: -8 },
  { left: '28%', delay: 140, size: 20, drift: 6 },
  { left: '44%', delay: 80, size: 12, drift: -4 },
  { left: '58%', delay: 220, size: 18, drift: 10 },
  { left: '72%', delay: 60, size: 15, drift: -12 },
  { left: '86%', delay: 180, size: 13, drift: 5 },
  { left: '20%', delay: 300, size: 16, drift: -6 },
  { left: '64%', delay: 360, size: 11, drift: 8 },
];

const ANGRY_BURST = [
  { left: '8%', delay: 0, size: 20, drift: -10 },
  { left: '22%', delay: 100, size: 26, drift: 8 },
  { left: '38%', delay: 60, size: 18, drift: -5 },
  { left: '52%', delay: 180, size: 24, drift: 12 },
  { left: '66%', delay: 40, size: 19, drift: -14 },
  { left: '80%', delay: 150, size: 22, drift: 6 },
  { left: '30%', delay: 280, size: 21, drift: -8 },
  { left: '72%', delay: 320, size: 17, drift: 9 },
];

const DROP_BURST = [
  { left: '10%', delay: 0, size: 14, drift: -8 },
  { left: '30%', delay: 120, size: 18, drift: 6 },
  { left: '50%', delay: 70, size: 12, drift: -4 },
  { left: '70%', delay: 200, size: 16, drift: 10 },
  { left: '86%', delay: 50, size: 13, drift: -12 },
];

function formatCountdown(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

const FloatingHeart = ({ left, delay, size, drift, heartColor }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: 2400, easing: Easing.out(Easing.cubic) }),
        -1,
        false
      )
    );
    return () => cancelAnimation(progress);
  }, [delay, progress]);

  const heartStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.12, 0.65, 1], [0, 1, 0.85, 0]),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [40, -110]) },
      { translateX: interpolate(progress.value, [0, 0.5, 1], [0, drift, drift * 1.4]) },
      { scale: interpolate(progress.value, [0, 0.25, 0.6, 1], [0.3, 1.1, 1, 0.75]) },
      { rotate: `${interpolate(progress.value, [0, 1], [-8, 8])}deg` },
    ],
  }));

  return (
    <Animated.View style={[styles.floatingHeart, { left }, heartStyle]}>
      <Heart size={size} color={heartColor} fill={heartColor} />
    </Animated.View>
  );
};

const FloatingAngryEmoji = ({ left, delay, size, drift }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: 2200, easing: Easing.out(Easing.cubic) }),
        -1,
        false
      )
    );
    return () => cancelAnimation(progress);
  }, [delay, progress]);

  const emojiStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.1, 0.6, 1], [0, 1, 0.9, 0]),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [30, -120]) },
      { translateX: interpolate(progress.value, [0, 0.5, 1], [0, drift, drift * 1.3]) },
      { scale: interpolate(progress.value, [0, 0.2, 0.55, 1], [0.4, 1.15, 1, 0.8]) },
      { rotate: `${interpolate(progress.value, [0, 1], [12, -12])}deg` },
    ],
  }));

  return (
    <Animated.View style={[styles.floatingHeart, { left }, emojiStyle]}>
      <Text style={[styles.floatingEmoji, { fontSize: size }]}>😠</Text>
    </Animated.View>
  );
};

const FloatingDrop = ({ left, delay, size, drift }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: 2200, easing: Easing.out(Easing.cubic) }),
        -1,
        false
      )
    );
    return () => cancelAnimation(progress);
  }, [delay, progress]);

  const dropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.1, 0.6, 1], [0, 1, 0.9, 0]),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [30, -120]) },
      { translateX: interpolate(progress.value, [0, 0.5, 1], [0, drift, drift * 1.3]) },
      { scale: interpolate(progress.value, [0, 0.2, 0.55, 1], [0.4, 1.15, 1, 0.8]) },
    ],
  }));

  return (
    <Animated.View style={[styles.floatingHeart, { left }, dropStyle]}>
      <Text style={[styles.floatingEmoji, { fontSize: size }]}>💧</Text>
    </Animated.View>
  );
};

const PremiumNotification = ({ celebrationRequest = null, onDismiss, variant = 'hero' }) => {
  const theme = THEMES[variant] ?? THEMES.hero;
  const cardOpacity = useSharedValue(0);
  const cardScale = useSharedValue(0.94);
  const contentOpacity = useSharedValue(0);
  const contentScale = useSharedValue(0.92);
  const angryShake = useSharedValue(0);

  const [celebrationMode, setCelebrationMode] = useState(null);
  const [motivationCopy, setMotivationCopy] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [photoAnimation, setPhotoAnimation] = useState(null);
  const [celebrationKey, setCelebrationKey] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(CARD_DURATION_SEC);

  const dismissTimerRef = useRef(null);
  const countdownRef = useRef(null);
  const dismissedKeyRef = useRef(null);
  const handledCelebrationKeyRef = useRef(null);
  const finishedRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  const handleDismiss = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;

    clearTimers();
    cancelAnimation(angryShake);
    setCelebrationMode(null);
    setMotivationCopy(null);
    setPreviewImage(null);
    setPhotoAnimation(null);
    setSecondsLeft(CARD_DURATION_SEC);
    onDismiss?.();
  }, [angryShake, clearTimers, onDismiss]);

  const startNotification = useCallback((mode, copy, image, animation) => {
    finishedRef.current = false;
    clearTimers();
    cancelAnimation(contentOpacity);
    cancelAnimation(contentScale);
    cancelAnimation(angryShake);

    setCelebrationKey((k) => k + 1);
    setCelebrationMode(mode);
    setMotivationCopy(copy);
    setPreviewImage(image ?? null);
    setPhotoAnimation(animation ?? null);
    setSecondsLeft(CARD_DURATION_SEC);

    cardOpacity.value = withTiming(1, { duration: 450, easing: Easing.out(Easing.cubic) });
    cardScale.value = withTiming(1, { duration: 550, easing: Easing.out(Easing.back(1.15)) });

    contentOpacity.value = 0;
    contentScale.value = mode === 'angry' ? 1.08 : 0.92;
    contentOpacity.value = withDelay(
      120,
      withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) })
    );
    contentScale.value = withDelay(
      120,
      withTiming(1, {
        duration: mode === 'angry' ? 500 : 850,
        easing: mode === 'angry' ? Easing.out(Easing.back(1.6)) : Easing.out(Easing.back(1.12)),
      })
    );

    if (mode === 'angry') {
      angryShake.value = withDelay(
        200,
        withRepeat(
          withSequence(
            withTiming(-6, { duration: 60 }),
            withTiming(6, { duration: 60 }),
            withTiming(-4, { duration: 50 }),
            withTiming(4, { duration: 50 }),
            withTiming(0, { duration: 40 }),
            withTiming(0, { duration: 700 })
          ),
          -1,
          false
        )
      );
    }

    countdownRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
          handleDismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    dismissTimerRef.current = setTimeout(handleDismiss, CARD_DURATION_MS);
  }, [angryShake, cardOpacity, cardScale, clearTimers, contentOpacity, contentScale, handleDismiss]);

  useEffect(() => {
    cardOpacity.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) });
    cardScale.value = withTiming(1, { duration: 450, easing: Easing.out(Easing.cubic) });
  }, [cardOpacity, cardScale]);

  useEffect(() => {
    if (celebrationRequest?.key) return;

    finishedRef.current = false;
    clearTimers();
    cancelAnimation(angryShake);
    setCelebrationMode(null);
    setMotivationCopy(null);
    setPreviewImage(null);
    setPhotoAnimation(null);
    setSecondsLeft(CARD_DURATION_SEC);
  }, [angryShake, celebrationRequest?.key, clearTimers]);

  useEffect(() => {
    if (!celebrationRequest?.key) {
      handledCelebrationKeyRef.current = null;
      return;
    }

    if (handledCelebrationKeyRef.current !== celebrationRequest.key) {
      finishedRef.current = false;
    }
  }, [celebrationRequest?.key]);

  useEffect(() => {
    if (!celebrationRequest?.key || !celebrationRequest?.mode) {
      return;
    }

    if (dismissedKeyRef.current === celebrationRequest.key) {
      return;
    }

    if (handledCelebrationKeyRef.current === celebrationRequest.key) {
      return;
    }
    handledCelebrationKeyRef.current = celebrationRequest.key;

    if (celebrationRequest.copy?.fromPartner) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(
        celebrationRequest.mode === 'angry'
          ? Haptics.NotificationFeedbackType.Warning
          : Haptics.NotificationFeedbackType.Success
      );
    }

    startNotification(
      celebrationRequest.mode,
      celebrationRequest.copy,
      celebrationRequest.previewImage,
      celebrationRequest.photoAnimation,
    );
  }, [
    celebrationRequest?.key,
    celebrationRequest?.mode,
    celebrationRequest?.copy,
    celebrationRequest?.previewImage,
    celebrationRequest?.photoAnimation,
    startNotification,
  ]);

  useEffect(() => {
    return () => {
      clearTimers();
      cancelAnimation(angryShake);
    };
  }, [angryShake, clearTimers]);

  const handleSkip = () => {
    if (celebrationRequest?.key) {
      dismissedKeyRef.current = celebrationRequest.key;
    }
    handleDismiss();
  };

  const hasNotification = !!celebrationRequest?.key;

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ scale: cardScale.value }],
  }));

  const contentAnimatedStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ scale: contentScale.value }],
  }));

  const angryEmojiStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${angryShake.value}deg` },
      { scale: contentScale.value },
    ],
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.card, cardAnimatedStyle]}>
        <View style={styles.cardBody}>
          {!hasNotification ? (
            <View
              style={[
                styles.emptyShell,
                {
                  borderColor: theme.glassBorder,
                  backgroundColor: theme.glassBg,
                },
              ]}
            >
              {Platform.OS === 'ios' ? (
                <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
              ) : null}
              <View style={[styles.emptyTint, { backgroundColor: theme.emptyTint }]} />
              <Text style={[styles.emptyTitle, { color: theme.textMain }]}>No notifications yet</Text>
              <Text style={[styles.emptyBody, { color: theme.textMuted }]}>
                When your partner sends a nudge or animation, it will show up here.
              </Text>
            </View>
          ) : (
            <View
              key={`notification-${celebrationKey}`}
              style={[
                styles.notificationShell,
                {
                  borderColor: theme.glassBorder,
                  backgroundColor: theme.glassBg,
                },
                celebrationMode === 'angry' && {
                  borderColor: theme.angryShellBorder,
                },
                (celebrationMode === 'cat' || celebrationMode === 'photo') && {
                  borderColor: theme.catShellBorder,
                },
              ]}
            >
              {Platform.OS === 'ios' ? (
                <BlurView
                  intensity={celebrationMode === 'angry' ? 32 : celebrationMode === 'cat' ? 30 : 28}
                  tint="light"
                  style={StyleSheet.absoluteFill}
                />
              ) : null}
              <View
                style={[
                  styles.notificationTint,
                  { backgroundColor: theme.emptyTint },
                  celebrationMode === 'angry' && { backgroundColor: theme.angryTint },
                  (celebrationMode === 'cat' || celebrationMode === 'photo') && {
                    backgroundColor: theme.catTint,
                  },
                ]}
              />

              <View style={styles.notificationHeader}>
                <View
                  style={[
                    styles.timerPill,
                    {
                      backgroundColor: theme.timerBg,
                      borderColor: theme.timerBorder,
                    },
                  ]}
                >
                  <Text style={[styles.timerText, { color: theme.textMain }]}>
                    {formatCountdown(secondsLeft)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.skipBtn,
                    {
                      backgroundColor: theme.skipBg,
                      borderColor: theme.skipBorder,
                    },
                  ]}
                  onPress={handleSkip}
                  activeOpacity={0.85}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[styles.skipBtnText, { color: theme.textMain }]}>Clear</Text>
                </TouchableOpacity>
              </View>

              {celebrationMode === 'hearts'
                ? HEART_BURST.map((heart, index) => (
                    <FloatingHeart key={`heart-${index}`} {...heart} heartColor={theme.heart} />
                  ))
                : null}

              {celebrationMode === 'angry'
                ? ANGRY_BURST.map((emoji, index) => (
                    <FloatingAngryEmoji key={`angry-${index}`} {...emoji} />
                  ))
                : null}

              {celebrationMode === 'cat' || celebrationMode === 'photo'
                ? DROP_BURST.map((drop, index) => (
                    <FloatingDrop key={`drop-${index}`} {...drop} />
                  ))
                : null}

              <Animated.View style={[styles.cinematicWrap, contentAnimatedStyle]}>
                {motivationCopy?.fromPartner ? (
                  <Text
                    style={[
                      styles.fromPartnerBadge,
                      {
                        color: theme.badgeColor,
                        backgroundColor: theme.badgeBg,
                        borderColor: theme.badgeBorder,
                      },
                    ]}
                  >
                    From your partner
                  </Text>
                ) : null}
                {celebrationMode === 'hearts' ? (
                  <>
                    <Text style={[styles.cinematicEyebrow, { color: theme.eyebrow }]}>
                      {motivationCopy?.eyebrow || 'A MOMENT FOR YOU'}
                    </Text>
                    <Text
                      style={[
                        styles.cinematicText,
                        { color: theme.textMain, textShadowColor: theme.titleShadow },
                      ]}
                      numberOfLines={4}
                    >
                      {motivationCopy?.title || 'You are doing so good!'}
                    </Text>
                  </>
                ) : celebrationMode === 'cat' || celebrationMode === 'photo' ? (
                  <>
                    {previewImage ? (
                      <AnimatedBeggingCat
                        source={previewImage}
                        animation={photoAnimation ?? undefined}
                        style={styles.notificationCat}
                      />
                    ) : null}
                    <Text style={[styles.cinematicEyebrowCat, { color: theme.catEyebrow }]}>
                      {motivationCopy?.eyebrow || 'HYDRATION'}
                    </Text>
                    <Text
                      style={[
                        styles.cinematicTextCat,
                        { color: theme.textMain, textShadowColor: theme.catTitleShadow },
                      ]}
                      numberOfLines={3}
                    >
                      {motivationCopy?.title || 'Drink some water.'}
                    </Text>
                  </>
                ) : (
                  <>
                    <Animated.Text style={[styles.angryHeroEmoji, angryEmojiStyle]}>😠</Animated.Text>
                    <Text style={[styles.cinematicEyebrowAngry, { color: theme.angryEyebrow }]}>
                      {motivationCopy?.eyebrow || 'CALORIE CHECK'}
                    </Text>
                    <Text
                      style={[
                        styles.cinematicTextAngry,
                        {
                          color: theme.textMain,
                          textShadowColor: theme.angryTitleShadow,
                        },
                        motivationCopy?.fromPartner && styles.cinematicTextAngryPartner,
                      ]}
                      numberOfLines={4}
                    >
                      {motivationCopy?.title || 'Eat less!!'}
                    </Text>
                  </>
                )}
              </Animated.View>
            </View>
          )}
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  card: {
    flex: 1,
    justifyContent: 'center',
  },
  cardBody: {
    position: 'relative',
    minHeight: 199,
  },
  emptyShell: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    minHeight: 199,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  emptyTint: {
    ...StyleSheet.absoluteFillObject,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.2,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    textAlign: 'center',
    maxWidth: 240,
  },
  notificationShell: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    minHeight: 199,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationTint: {
    ...StyleSheet.absoluteFillObject,
  },
  notificationHeader: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    zIndex: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timerPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  timerText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    fontVariant: ['tabular-nums'],
  },
  skipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  skipBtnText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  floatingHeart: {
    position: 'absolute',
    bottom: 16,
    zIndex: 21,
  },
  floatingEmoji: {
    lineHeight: undefined,
  },
  cinematicWrap: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 20,
    zIndex: 22,
  },
  fromPartnerBadge: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  cinematicEyebrow: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 2.4,
    marginBottom: 8,
  },
  cinematicText: {
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.2,
    lineHeight: 28,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
    paddingHorizontal: 8,
  },
  angryHeroEmoji: {
    fontSize: 44,
    marginBottom: 6,
  },
  notificationCat: {
    width: 88,
    height: 88,
    marginBottom: 4,
  },
  cinematicEyebrowCat: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 2.2,
    marginBottom: 6,
  },
  cinematicTextCat: {
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.2,
    lineHeight: 26,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
    paddingHorizontal: 8,
  },
  cinematicEyebrowAngry: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 2.4,
    marginBottom: 6,
  },
  cinematicTextAngry: {
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 14,
    paddingHorizontal: 8,
    lineHeight: 30,
  },
  cinematicTextAngryPartner: {
    fontSize: 20,
    textTransform: 'none',
    letterSpacing: -0.1,
  },
});

export default PremiumNotification;
