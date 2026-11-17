import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useColorScheme, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing, FadeIn, FadeInLeft, FadeInRight, FadeOut, ZoomIn, cancelAnimation, interpolate, useAnimatedProps, useAnimatedStyle,
  useDerivedValue, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming, type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { Check } from 'lucide-react-native';
import { mealLabel, partnerWords, plateTotals, recipientPortion } from '@/lib/meal-pass';
import type { SharedMeal } from '@/lib/meal-pass-api';
import { LinearGradient } from 'expo-linear-gradient';
import PassAvatar from './PassAvatar';
import { DiscFood, DiscInfo, DiscSurface, plateTitle } from './ThrowDisc';
import { EASE_OUT, SNAP, type PassColors } from './passTheme';

export const PLATE_SIZE = 76;
/** How much bigger the plate is when it lands centre stage; it's drawn at this size so it stays sharp. */
const HERO = 2.7;
const BIG = Math.round(PLATE_SIZE * HERO);
const EDGE_GAP = 16;
const REST_OFFSET = 112;
const ENTER_DELAY = 220;
const FALL = 950;
const HOLD = 1800;
const DOCK = 640;
/** Degrees the plate is tipped back while it peeks in and flies; it flattens out as it lands. */
const ARRIVE_TILT = 18;
/** It first peeks in at a top corner, wiggles, then flies to centre stage. */
const PEEK_IN = { duration: 560, dampingRatio: 0.72 };
const PEEK_HOLD = 820;
const PEEK_ANGLE = 14;
const BLUR = 28;
const SETTLE = { duration: 520, dampingRatio: 0.7 };
const WOBBLE = { duration: 760, dampingRatio: 0.5 };

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

type Phase = 'flying' | 'hero' | 'docking' | 'docked';

type Props = {
  /** False for a plate that already flew in once: it just appears in its resting spot. */
  arrive: boolean;
  meal: SharedMeal;
  xPct: number;
  imageUri: string | null;
  isCutout: boolean;
  count: number;
  outcome: 'accepted' | 'declined' | null;
  colors: PassColors;
  senderAvatarKey?: string;
  onTap: () => void;
  onSettled: () => void;
};

/**
 * The same raised disc the sender threw, drawn large and scaled down so it stays crisp at every size.
 * Centre stage it shows the meal's name and calories; shrunk into the corner it crossfades to just the food.
 */
function Plate({ imageUri, isCutout, title, kcal, colors, scale }: {
  imageUri: string | null; isCutout: boolean; title?: string; kcal: number; colors: PassColors; scale: SharedValue<number>;
}) {
  const full = useAnimatedStyle(() => ({ opacity: interpolate(scale.get(), [1.6, 2.3], [0, 1], 'clamp') }));
  const compact = useAnimatedStyle(() => ({ opacity: interpolate(scale.get(), [1.6, 2.3], [1, 0], 'clamp') }));
  return (
    <View style={[styles.bigPlate, { boxShadow: `${colors.liftShadow}, 0 3px 6px ${colors.bevelShade}` }]}>
      <DiscSurface size={BIG} colors={colors}>
        <Animated.View style={[styles.layer, compact]}>
          <DiscFood size={Math.round(BIG * 0.62)} imageUri={imageUri} isCutout={isCutout} colors={colors} />
        </Animated.View>
        <Animated.View style={[styles.layer, { gap: BIG * 0.04 }, full]}>
          <DiscFood size={Math.round(BIG * 0.28)} imageUri={imageUri} isCutout={isCutout} colors={colors} />
          <DiscInfo size={BIG} title={title} kcal={kcal} colors={colors} />
        </Animated.View>
      </DiscSurface>
    </View>
  );
}

/** A passed plate arriving centre stage like it was just thrown from the partner's phone, then resting in the corner. */
export default function FloatingPlate({ arrive, meal, xPct, imageUri, isCutout, count, outcome, colors, senderAvatarKey, onTap, onSettled }: Props) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const reduced = useReducedMotion();
  const [still] = useState(reduced || !arrive);
  const [phase, setPhase] = useState<Phase>(still ? 'docked' : 'flying');
  const phaseRef = useRef<Phase>(phase);
  const [landed, setLanded] = useState(false);
  const [showLabel, setShowLabel] = useState(false);
  const [side, setSide] = useState<'left' | 'right'>('left');
  const [heroLabelHeight, setHeroLabelHeight] = useState(104);
  const sender = partnerWords(meal.senderName, meal.senderGender).name;

  const portion = recipientPortion(meal.items, meal.itemShares);
  const kcal = plateTotals(portion).calories;
  const discTitle = plateTitle(meal.items.map((item) => item.foodName));

  const restLeft = EDGE_GAP;
  const restRight = screenWidth - EDGE_GAP - PLATE_SIZE;
  const restTop = screenHeight - insets.bottom - REST_OFFSET - PLATE_SIZE;
  const minTop = insets.top + 70;
  const heroX = screenWidth / 2 - PLATE_SIZE / 2;
  // Centre the plate and its sender label as one group inside the safe area.
  const safeHeight = screenHeight - insets.top - insets.bottom;
  const heroY = insets.top + (safeHeight - BIG - 32 - heroLabelHeight) / 2 + (BIG - PLATE_SIZE) / 2;
  const heroTargetY = useSharedValue(heroY);
  const heroLabelOpacity = useSharedValue(0);
  useEffect(() => { heroTargetY.set(heroY); }, [heroTargetY, heroY]);
  useEffect(() => {
    heroLabelOpacity.set(withTiming(phase === 'hero' ? 1 : 0, { duration: reduced ? 150 : 220 }));
  }, [heroLabelOpacity, phase, reduced]);
  const spinDir = xPct < 0.5 ? 1 : -1;
  const fromLeft = xPct < 0.5;
  const offX = fromLeft ? -PLATE_SIZE * 1.6 : screenWidth + PLATE_SIZE * 0.6;
  const offY = insets.top - PLATE_SIZE * 1.4;
  const peekX = fromLeft ? -PLATE_SIZE * 0.28 : screenWidth - PLATE_SIZE * 0.72;
  const peekY = insets.top + 6;
  const peekR = (fromLeft ? 1 : -1) * PEEK_ANGLE;

  const posX = useSharedValue(restLeft);
  const posY = useSharedValue(restTop);
  const zoom = useSharedValue(1);
  const rotation = useSharedValue(0);
  const tiltX = useSharedValue(0);
  const falling = useSharedValue(still ? 0 : 1);
  const fall = useSharedValue(0);
  const peek = useSharedValue(0);
  const wiggle = useSharedValue(0);
  const scrim = useSharedValue(0);
  const edge = useSharedValue(0);
  const press = useSharedValue(1);
  const opacity = useSharedValue(still ? 0 : 1);
  const ripple = useSharedValue(0);
  const highlight = useSharedValue(0);
  const beacon = useSharedValue(0);
  const float = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const moveTo = useCallback((next: Phase) => { phaseRef.current = next; setPhase(next); }, []);

  const hop = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const handleDocked = useCallback(() => {
    moveTo('docked');
    setLanded(true);
    setShowLabel(true);
    hop();
    zoom.set(withSequence(withTiming(0.94, { duration: 90, easing: EASE_OUT }), withSpring(1, SETTLE)));
    tiltX.set(withSequence(withTiming(-5, { duration: 90, easing: EASE_OUT }), withSpring(0, WOBBLE)));
    beacon.set(withDelay(400, withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }), 3, false)));
    float.set(withDelay(500, withRepeat(withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.sin) }), -1, true)));
  }, [beacon, float, hop, moveTo, tiltX, zoom]);

  /** Shrinks from centre stage into its resting corner and gives the app back, tipping like it's being slid away. */
  const dock = useCallback(() => {
    if (phaseRef.current !== 'hero') return;
    moveTo('docking');
    hop();
    scrim.set(withTiming(0, { duration: 420, easing: EASE_OUT }));
    posX.set(withTiming(restLeft, { duration: DOCK, easing: EASE_OUT }));
    posY.set(withTiming(restTop, { duration: DOCK, easing: Easing.inOut(Easing.cubic) }));
    rotation.set(withSequence(
      withTiming(-spinDir * 16, { duration: DOCK * 0.5, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: DOCK * 0.5, easing: Easing.inOut(Easing.quad) }),
    ));
    tiltX.set(withSequence(
      withTiming(12, { duration: DOCK * 0.45, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: DOCK * 0.55, easing: Easing.inOut(Easing.quad) }),
    ));
    zoom.set(withTiming(1, { duration: DOCK, easing: EASE_OUT }, (finished) => { if (finished) scheduleOnRN(handleDocked); }));
  }, [handleDocked, hop, moveTo, posX, posY, restLeft, restTop, rotation, scrim, spinDir, tiltX, zoom]);

  const handleHero = useCallback(() => {
    moveTo('hero');
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setTimeout(() => { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); }, 160);
  }, [moveTo]);

  useEffect(() => {
    if (phase !== 'hero') return;
    const timer = setTimeout(dock, HOLD);
    return () => clearTimeout(timer);
  }, [dock, phase]);

  useEffect(() => {
    if (!showLabel || outcome) return;
    const timer = setTimeout(() => setShowLabel(false), 6000);
    return () => clearTimeout(timer);
  }, [outcome, showLabel]);

  const launched = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  // One arrival per plate: it peeks in at the top corner on the side it was thrown from and wiggles for attention,
  // then the app blurs back and it flies to centre stage, tipped back and spinning, flattening out as it settles.
  useEffect(() => {
    if (!arrive) {
      // Already flew in once: fade in where it rests, with no haptic, label, or beacon.
      opacity.set(withTiming(1, { duration: 200, easing: EASE_OUT }));
      setLanded(true);
      if (!reduced) float.set(withRepeat(withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.sin) }), -1, true));
      return () => cancelAnimation(float);
    }
    if (reduced) {
      opacity.set(withTiming(1, { duration: 220 }, (finished) => { if (finished) scheduleOnRN(handleDocked); }));
      highlight.set(withSequence(withTiming(1, { duration: 260 }), withDelay(900, withTiming(0, { duration: 400 }))));
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {});
    const launch = ENTER_DELAY + PEEK_HOLD;
    peek.set(withDelay(ENTER_DELAY, withSpring(1, PEEK_IN)));
    wiggle.set(withDelay(ENTER_DELAY + 380, withSequence(
      withTiming(9, { duration: 90, easing: EASE_OUT }),
      withTiming(-7, { duration: 120, easing: Easing.inOut(Easing.quad) }),
      withTiming(4, { duration: 110, easing: Easing.inOut(Easing.quad) }),
      withTiming(0, { duration: 100, easing: EASE_OUT }),
    )));
    scrim.set(withDelay(launch - 80, withTiming(1, { duration: 360, easing: EASE_OUT })));
    edge.set(withDelay(ENTER_DELAY, withSequence(
      withTiming(1, { duration: 200, easing: EASE_OUT }),
      withTiming(0, { duration: 800, easing: Easing.out(Easing.quad) }),
    )));
    const kick = setTimeout(launched, launch);
    fall.set(withDelay(launch, withTiming(1, { duration: FALL, easing: Easing.linear }, (finished) => {
      if (!finished) return;
      // The flight ends exactly on these values, so handing over to the resting transforms never jumps a frame.
      posX.set(heroX); posY.set(heroTargetY.get()); zoom.set(HERO); rotation.set(0); tiltX.set(0);
      falling.set(0);
      zoom.set(withSequence(withTiming(HERO * 0.965, { duration: 110, easing: EASE_OUT }), withSpring(HERO, SETTLE)));
      tiltX.set(withSequence(withTiming(-5, { duration: 110, easing: EASE_OUT }), withSpring(0, WOBBLE)));
      ripple.set(withTiming(1, { duration: 1000, easing: EASE_OUT }));
      scheduleOnRN(handleHero);
    })));
    return () => { clearTimeout(kick); cancelAnimation(float); cancelAnimation(beacon); };
    // Mount-only: one arrival per plate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!outcome) return;
    cancelAnimation(float); cancelAnimation(beacon);
    float.set(withTiming(0, { duration: 150 }));
    beacon.set(0);
    setShowLabel(outcome === 'accepted');
    const done = (finished?: boolean) => { 'worklet'; if (finished) scheduleOnRN(onSettled); };
    if (outcome === 'declined' || reduced) {
      opacity.set(withTiming(0, { duration: outcome === 'declined' ? 220 : 300 }, done));
      zoom.set(withTiming(reduced ? 1 : 0.85, { duration: 220 }));
      return;
    }
    // A happy hop for the checkmark, then the plate tips forward and sinks into the log.
    posY.set(withSequence(
      withTiming(posY.get() - 18, { duration: 160, easing: EASE_OUT }),
      withSpring(posY.get(), { duration: 380, dampingRatio: 0.7 }),
      withDelay(500, withTiming(restTop + 56, { duration: 320, easing: Easing.in(Easing.quad) })),
    ));
    tiltX.set(withDelay(1020, withTiming(-16, { duration: 320, easing: Easing.in(Easing.quad) })));
    zoom.set(withDelay(1020, withTiming(0.55, { duration: 320, easing: Easing.in(Easing.quad) })));
    opacity.set(withDelay(1120, withTiming(0, { duration: 240 }, done)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome]);

  const snapToSide = useCallback((next: 'left' | 'right') => setSide(next), []);
  const grab = useCallback(() => { void Haptics.selectionAsync().catch(() => {}); }, []);
  const handleTap = useCallback(() => {
    hop();
    if (phaseRef.current === 'hero') dock();
    onTap();
  }, [dock, hop, onTap]);
  const interactive = landed && !outcome;

  const pan = Gesture.Pan()
    .enabled(interactive)
    .minDistance(6)
    .onStart(() => { startX.set(posX.get()); startY.set(posY.get()); press.set(withTiming(1.08, { duration: 120 })); scheduleOnRN(grab); })
    .onUpdate((event) => {
      posX.set(startX.get() + event.translationX);
      posY.set(Math.min(restTop, Math.max(minTop, startY.get() + event.translationY)));
      rotation.set(Math.max(-14, Math.min(14, event.velocityX * 0.01)));
      tiltX.set(Math.max(-10, Math.min(10, -event.velocityY * 0.006)));
    })
    .onEnd((event) => {
      const toLeft = posX.get() + event.velocityX * 0.15 + PLATE_SIZE / 2 < screenWidth / 2;
      posX.set(withSpring(toLeft ? restLeft : restRight, { ...SNAP, velocity: event.velocityX }));
      posY.set(withSpring(Math.min(restTop, Math.max(minTop, posY.get() + event.velocityY * 0.1)), { ...SNAP, velocity: event.velocityY }));
      rotation.set(withSpring(0, SNAP));
      tiltX.set(withSpring(0, SNAP));
      scheduleOnRN(snapToSide, toLeft ? 'left' : 'right');
      scheduleOnRN(hop);
    })
    .onFinalize(() => { press.set(withTiming(1, { duration: 150 })); });
  const tap = Gesture.Tap()
    .enabled(interactive || phase === 'hero')
    .maxDuration(300)
    .onBegin(() => { press.set(withTiming(0.92, { duration: 100 })); })
    .onEnd((_event, success) => { if (success) scheduleOnRN(handleTap); })
    .onFinalize(() => { press.set(withTiming(1, { duration: 150 })); });

  // Before launch it slides in to peek from the corner. Then it arcs from there to centre stage like a frisbee,
  // tipped back and spinning on its face, and every channel eases out to zero velocity so it lands without a pop.
  // Callers read the shared values and pass them in: an animated style only re-runs for shared values it touches itself.
  const flight = (progress: number, k: number, w: number) => {
    'worklet';
    const f = Math.max(0, Math.min(1, progress));
    if (f === 0) {
      return { x: offX + (peekX - offX) * k, y: offY + (peekY - offY) * k, r: peekR + w, tilt: ARRIVE_TILT, yaw: 0, s: 1 };
    }
    const across = 1 - (1 - f) * (1 - f) * (1 - f);
    const down = 1 - Math.pow(1 - f, 2.2);
    return {
      x: peekX + (heroX - peekX) * across + spinDir * 50 * Math.sin(Math.PI * across),
      y: peekY + (heroTargetY.get() - peekY) * down,
      // One extra turn on the way, which starts at the peek angle and unwinds to flat.
      r: (peekR + spinDir * 360) * (1 - across),
      tilt: ARRIVE_TILT * (1 - across),
      yaw: spinDir * 8 * Math.sin(Math.PI * across),
      s: 1 + (HERO - 1) * across,
    };
  };
  const scale = useDerivedValue(() => (falling.get() ? flight(fall.get(), peek.get(), wiggle.get()).s : zoom.get()));

  const containerStyle = useAnimatedStyle(() => {
    const pos = falling.get() ? flight(fall.get(), peek.get(), wiggle.get()) : null;
    return {
      opacity: opacity.get(),
      transform: [{ translateX: pos ? pos.x : posX.get() }, { translateY: pos ? pos.y : posY.get() - float.get() * 4 }],
    };
  });
  const plateStyle = useAnimatedStyle(() => {
    const pos = falling.get() ? flight(fall.get(), peek.get(), wiggle.get()) : null;
    const s = (scale.get() / HERO) * press.get();
    return {
      transform: [
        { perspective: 900 },
        { rotateX: `${pos ? pos.tilt : tiltX.get()}deg` },
        { rotateY: `${pos ? pos.yaw : 0}deg` },
        { rotate: `${pos ? pos.r : rotation.get()}deg` },
        { scale: s },
      ],
    };
  });
  const blurProps = useAnimatedProps(() => ({ intensity: scrim.get() * BLUR }));
  const tintStyle = useAnimatedStyle(() => ({ opacity: scrim.get() * 0.55 }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: scrim.get() * (0.55 + ripple.get() * 0.45),
    transform: [{ scale: 0.7 + scrim.get() * 0.3 + ripple.get() * 0.15 }],
  }));
  const edgeStyle = useAnimatedStyle(() => ({ opacity: edge.get() }));
  const heroLabelStyle = useAnimatedStyle(() => ({ opacity: heroLabelOpacity.get() }));
  // The shadow sharpens and tightens as the plate comes down toward the screen.
  const shadowStyle = useAnimatedStyle(() => {
    const near = falling.get() ? fall.get() * fall.get() : 1;
    const s = scale.get();
    return {
      opacity: near * 0.22 * (1 - float.get() * 0.25),
      transform: [{ translateY: (s * PLATE_SIZE) / 2 + 6 + float.get() * 4 + (1 - near) * 30 }, { scaleX: s * (0.45 + near * 0.5) - float.get() * 0.06 }],
    };
  });
  const rippleA = useAnimatedStyle(() => ({
    opacity: interpolate(ripple.get(), [0, 0.06, 1], [0, 0.7, 0]),
    transform: [{ scale: zoom.get() * (1 + ripple.get() * 0.9) }],
  }));
  const rippleB = useAnimatedStyle(() => ({
    opacity: interpolate(ripple.get(), [0.12, 0.24, 1], [0, 0.45, 0], 'clamp'),
    transform: [{ scale: zoom.get() * (1 + Math.max(0, ripple.get() - 0.12) * 1.4) }],
  }));
  const beaconStyle = useAnimatedStyle(() => ({
    opacity: (1 - beacon.get()) * 0.45 * (beacon.get() > 0 ? 1 : 0),
    transform: [{ scale: zoom.get() * (1 + beacon.get() * 0.5) }],
  }));
  const highlightStyle = useAnimatedStyle(() => ({
    opacity: highlight.get() * 0.9,
    transform: [{ scale: interpolate(highlight.get(), [0, 1], [1, 1.16]) }],
  }));

  const title = outcome === 'accepted' ? `Logged to ${meal.mealType === 'SNACK' ? 'snacks' : mealLabel(meal.mealType)}` : `${sender} passed you ${mealLabel(meal.mealType)}`;
  const staged = phase === 'flying' || phase === 'hero';

  return (
    <>
    {!reduced && (staged || phase === 'docking') && (
      <View pointerEvents={staged ? 'auto' : 'none'} style={[StyleSheet.absoluteFill, styles.scrim]}>
        <AnimatedBlurView animatedProps={blurProps} intensity={0} tint={scheme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface }, tintStyle]} />
        <Animated.View style={[styles.glow, { left: screenWidth / 2 - BIG, top: heroY + PLATE_SIZE / 2 - BIG, backgroundColor: colors.partnerSoft }, glowStyle]} />
        <Pressable style={StyleSheet.absoluteFill} onPress={dock} accessibilityRole="button" accessibilityLabel="Put the plate aside for now" />
      </View>
    )}
    <Animated.View pointerEvents="none" style={[styles.edge, edgeStyle]}>
      <LinearGradient colors={[colors.partner, 'rgba(255,107,107,0)']} style={StyleSheet.absoluteFill} />
    </Animated.View>
    <Animated.View exiting={FadeOut.duration(200)} style={[styles.container, containerStyle]} pointerEvents="box-none">
      <Animated.View pointerEvents="none" style={[styles.shadow, shadowStyle]} />
      <Animated.View pointerEvents="none" style={[styles.ring, { borderColor: colors.partner }, rippleA]} />
      <Animated.View pointerEvents="none" style={[styles.ring, { borderColor: colors.partner, borderWidth: 2 }, rippleB]} />
      <Animated.View pointerEvents="none" style={[styles.ring, { borderColor: colors.partner, borderWidth: 2 }, beaconStyle]} />
      <Animated.View pointerEvents="none" style={[styles.ring, styles.highlight, { borderColor: colors.partner }, highlightStyle]} />
      <GestureDetector gesture={Gesture.Race(pan, tap)}>
        <Animated.View
          accessible accessibilityRole="button"
          accessibilityLabel={`${sender} passed you ${mealLabel(meal.mealType)}, ${kcal} kcal. Tap to see the plate.`}
          hitSlop={12}
          style={[styles.plate, plateStyle]}
        >
          <Plate imageUri={imageUri} isCutout={isCutout} title={discTitle} kcal={kcal} colors={colors} scale={scale} />
        </Animated.View>
      </GestureDetector>
      {outcome === 'accepted' && (
        <Animated.View pointerEvents="none" entering={reduced ? FadeIn.duration(150) : ZoomIn.springify().damping(12)} style={[styles.check, { backgroundColor: colors.success }]}>
          <Check size={15} color="#FFFFFF" strokeWidth={3.2} />
        </Animated.View>
      )}
      {landed && count > 1 && !outcome && (
        <Animated.View pointerEvents="none" entering={ZoomIn.springify().damping(14)} style={[styles.count, { backgroundColor: colors.partner }]}>
          <Text style={styles.countText}>{count}</Text>
        </Animated.View>
      )}
      {showLabel && (
        <Animated.View
          entering={reduced ? FadeIn.duration(180) : (side === 'left' ? FadeInLeft : FadeInRight).duration(300).easing(EASE_OUT)}
          exiting={FadeOut.duration(180)} pointerEvents="none"
          style={[styles.label, { backgroundColor: colors.card, boxShadow: colors.liftShadow }, side === 'left' ? styles.labelRight : styles.labelLeft]}>
          <View style={styles.labelHead}>
            {!outcome && <PassAvatar avatarKey={senderAvatarKey} name={sender} gender={meal.senderGender} size={18} ring={colors.partner} soft={colors.partnerSoft} ringWidth={1.5} />}
            <Text style={[styles.labelEyebrow, { color: outcome === 'accepted' ? colors.success : colors.partner }]} numberOfLines={1}>
              {outcome === 'accepted' ? 'ON YOUR LOG' : `FROM ${sender.toUpperCase()}`}
            </Text>
          </View>
          <Text style={[styles.labelTitle, { color: colors.ink }]} numberOfLines={1}>{title}</Text>
          {!outcome && <Text style={[styles.labelHint, { color: colors.muted }]}>Tap to see the plate</Text>}
        </Animated.View>
      )}
    </Animated.View>
    {staged && (
      <Animated.View
        exiting={FadeOut.duration(160)} pointerEvents="none"
        onLayout={event => setHeroLabelHeight(event.nativeEvent.layout.height)}
        style={[styles.heroCard, { top: heroY + PLATE_SIZE / 2 + BIG / 2 + 32 }, heroLabelStyle]}
        accessibilityElementsHidden={phase !== 'hero'} importantForAccessibility={phase === 'hero' ? 'auto' : 'no-hide-descendants'}
        accessibilityLiveRegion="polite">
        <PassAvatar avatarKey={senderAvatarKey} name={sender} gender={meal.senderGender} size={36} ring={colors.partner} soft={colors.partnerSoft} ringWidth={2} />
        <Text style={[styles.heroTitle, { color: colors.ink }]} numberOfLines={2}>{sender} passed you {mealLabel(meal.mealType)}</Text>
      </Animated.View>
    )}
    </>
  );
}

const styles = StyleSheet.create({
  scrim: { zIndex: 8990, overflow: 'hidden' },
  glow: { position: 'absolute', width: BIG * 2, height: BIG * 2, borderRadius: BIG },
  container: { position: 'absolute', top: 0, left: 0, width: PLATE_SIZE, height: PLATE_SIZE, zIndex: 9000 },
  plate: { width: PLATE_SIZE, height: PLATE_SIZE },
  bigPlate: { position: 'absolute', left: (PLATE_SIZE - BIG) / 2, top: (PLATE_SIZE - BIG) / 2, width: BIG, height: BIG, borderRadius: BIG / 2 },
  layer: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  shadow: { position: 'absolute', left: PLATE_SIZE * 0.12, top: PLATE_SIZE / 2 - 5, width: PLATE_SIZE * 0.76, height: 10, borderRadius: 999, backgroundColor: '#0F172A' },
  ring: { position: 'absolute', top: 0, left: 0, width: PLATE_SIZE, height: PLATE_SIZE, borderRadius: PLATE_SIZE / 2, borderWidth: 3 },
  highlight: { top: -6, left: -6, width: PLATE_SIZE + 12, height: PLATE_SIZE + 12, borderRadius: (PLATE_SIZE + 12) / 2, borderWidth: 2 },
  check: { position: 'absolute', right: -2, bottom: -2, width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  count: { position: 'absolute', top: -4, right: -4, minWidth: 24, height: 24, paddingHorizontal: 6, borderRadius: 12, borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  countText: { fontSize: 11, fontWeight: '800', color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  label: { position: 'absolute', top: 4, width: 204, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 18, borderCurve: 'continuous', gap: 1 },
  labelRight: { left: PLATE_SIZE + 12 },
  labelLeft: { right: PLATE_SIZE + 12 },
  labelHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  labelEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  edge: { position: 'absolute', top: 0, left: 0, right: 0, height: 200, zIndex: 8998 },
  heroCard: { position: 'absolute', left: 28, right: 28, alignItems: 'center', gap: 10, zIndex: 9001 },
  heroTitle: { fontSize: 24, lineHeight: 29, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center' },
  labelTitle: { fontSize: 14, fontWeight: '800' },
  labelHint: { fontSize: 12, fontWeight: '600' },
});
