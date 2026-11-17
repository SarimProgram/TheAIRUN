import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing, FadeIn, FadeInDown, ZoomIn, cancelAnimation, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue,
  withDelay, withRepeat, withSequence, withSpring, withTiming, type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { ArrowUp, Check, ChevronUp, Pointer, X } from 'lucide-react-native';
import type { PhotoRect } from '@/components/home/FoodScanTransition';
import { percent, type PartnerWords } from '@/lib/meal-pass';
import PassAvatar from './PassAvatar';
import ThrowDisc from './ThrowDisc';
import { EASE_OUT, POP, SNAP, type PassColors } from './passTheme';
import type { PassPhase } from './useMealPassComposer';

const FLICK_VELOCITY = -650;
const FLICK_DISTANCE = -120;
const RETURN = { duration: 420, dampingRatio: 0.75 };
const TRAIL = [1, 2, 3];
const CHEVRONS = [0, 1, 2];
const CHEVRON_FLOOR = [1, 0.6, 0.3];
const SPARKS = [
  { left: 4, top: 0, rotate: '20deg' },
  { left: 12, top: 6, rotate: '55deg' },
  { left: 15, top: 16, rotate: '85deg' },
];

type Person = { name: string; avatarKey?: string; gender?: string | null };

type Props = {
  /** Where the plate sits in the sheet; it lifts from here and returns here on cancel. */
  origin: PhotoRect;
  imageUri: string | null;
  isCutout: boolean;
  title?: string;
  mealType: string;
  copy: boolean;
  /** The partner's portion: a fraction of the plate for a split, a serving for a copy. */
  share: number;
  kcal: number;
  partner: Person;
  words: PartnerWords;
  phase: PassPhase;
  error: string | null;
  /** Set when the pass was cancelled from outside (back button, sheet close). */
  cancelled: boolean;
  colors: PassColors;
  onThrown: (xPct: number) => void;
  onCancel: () => void;
  onClosed: () => void;
};

/** Chevrons above the plate that run upward, then all light up once a drag is far enough to throw. */
function Chevron({ index, hint, armed, visible, colors }: {
  index: number; hint: SharedValue<number>; armed: SharedValue<number>; visible: SharedValue<number>; colors: PassColors;
}) {
  const style = useAnimatedStyle(() => {
    const step = (CHEVRONS.length - 1 - index) / CHEVRONS.length;
    const lit = interpolate(hint.get(), [step - 0.25, step + 0.05, step + 0.4], [0.25, 1, 0.25], 'clamp');
    const floor = CHEVRON_FLOOR[index];
    return {
      opacity: visible.get() * Math.max(floor * (0.55 + 0.45 * lit), armed.get()),
      transform: [{ translateY: -armed.get() * 6 * (CHEVRONS.length - index) }],
    };
  });
  return (
    <Animated.View style={[styles.chevron, style]}>
      <ChevronUp size={34} color={colors.accent} strokeWidth={3} />
    </Animated.View>
  );
}

/** The portion as a big plate on a calm stage: flick it up and off the top of the screen, onto the partner's phone. */
export default function PlateThrowStage({ origin, imageUri, isCutout, title, copy, share, kcal, partner, words, phase, error, cancelled, colors, onThrown, onCancel, onClosed }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [thrown, setThrown] = useState(false);
  const [gone, setGone] = useState(false);
  const announced = useRef<PassPhase | null>(null);

  const size = Math.round(Math.min(width * 0.72, 300));
  const restCX = width / 2;
  const restCY = Math.min(height * 0.56, height - insets.bottom - 132 - size / 2);
  const startDX = origin.x + origin.width / 2 - restCX;
  const startDY = origin.y + origin.height / 2 - restCY;
  const startScale = Math.min(origin.width, origin.height) / size;
  const exitDY = -(restCY + size * 0.9);

  const bg = useSharedValue(0);
  const leaving = useSharedValue(0);
  const ex = useSharedValue(reduced ? 0 : startDX);
  const ey = useSharedValue(reduced ? 0 : startDY);
  const es = useSharedValue(reduced ? 1 : startScale);
  const appear = useSharedValue(reduced ? 0 : 1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const tilt = useSharedValue(0);
  const press = useSharedValue(1);
  const grabbing = useSharedValue(0);
  const armed = useSharedValue(0);
  const idle = useSharedValue(0);
  const hint = useSharedValue(0);
  const released = useSharedValue(0);
  const guides = useSharedValue(1);
  const p = useSharedValue(0);
  const rx = useSharedValue(0);
  const ry = useSharedValue(0);
  const exitX = useSharedValue(0);
  const spin = useSharedValue(0);
  const flash = useSharedValue(0);

  useEffect(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    bg.set(withTiming(1, { duration: 280, easing: EASE_OUT }));
    if (reduced) { appear.set(withTiming(1, { duration: 200 })); return; }
    ex.set(withSpring(0, POP)); ey.set(withSpring(0, POP)); es.set(withSpring(1, POP));
    idle.set(withDelay(600, withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.sin) }), -1, true)));
    hint.set(withDelay(500, withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.cubic) }), -1, false)));
    return () => { cancelAnimation(idle); cancelAnimation(hint); };
  }, [appear, bg, es, ex, ey, hint, idle, reduced]);

  const close = useCallback(() => {
    leaving.set(withTiming(1, { duration: 300, easing: EASE_OUT }, (finished) => { if (finished) scheduleOnRN(onClosed); }));
  }, [leaving, onClosed]);

  // Cancelled before the throw: the plate glides back onto the sheet as the stage fades.
  useEffect(() => {
    if (!cancelled || released.get()) return;
    cancelAnimation(idle); cancelAnimation(hint);
    void Haptics.selectionAsync().catch(() => {});
    bg.set(withTiming(0, { duration: 260, easing: EASE_OUT }));
    guides.set(withTiming(0, { duration: 160 }));
    if (reduced) { appear.set(withTiming(0, { duration: 160 }, (done) => { if (done) scheduleOnRN(onClosed); })); return; }
    tx.set(withSpring(0, SNAP)); ty.set(withSpring(0, SNAP)); tilt.set(withSpring(0, SNAP));
    ex.set(withSpring(startDX, SNAP)); ey.set(withSpring(startDY, SNAP));
    es.set(withSpring(startScale, SNAP, (done) => { if (done) scheduleOnRN(onClosed); }));
  }, [appear, bg, cancelled, es, ex, ey, guides, hint, idle, onClosed, reduced, released, startDX, startDY, startScale, tilt, tx, ty]);

  // The outcome lands as its own haptic once the plate has left the screen, then the stage hands back to the sheet.
  useEffect(() => {
    if (!gone || phase === 'sending' || phase === 'aiming' || announced.current === phase) return;
    announced.current = phase;
    void Haptics.notificationAsync(phase === 'error' ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Success).catch(() => {});
    const timer = setTimeout(close, phase === 'error' ? 2200 : 1600);
    return () => clearTimeout(timer);
  }, [close, gone, phase]);

  const grabbed = useCallback(() => { void Haptics.selectionAsync().catch(() => {}); }, []);
  const arm = useCallback(() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid).catch(() => {}); }, []);
  const handleReleased = useCallback((xPct: number) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    setThrown(true);
    onThrown(xPct);
  }, [onThrown]);
  const handleGone = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {});
    setGone(true);
  }, []);

  const launch = (velocityX: number, velocityY: number) => {
    'worklet';
    if (released.get()) return;
    released.set(1);
    cancelAnimation(idle); cancelAnimation(hint);
    guides.set(withTiming(0, { duration: 140 }));
    const startX = ex.get() + tx.get();
    const startY = ey.get() + ty.get();
    rx.set(startX); ry.set(startY);
    const speedY = Math.max(Math.abs(velocityY), 1600);
    const distance = Math.abs(exitDY - startY);
    // Ease-out-quad starts at 2x its average speed, which hands the finger's velocity straight to the flight.
    const duration = Math.min(520, Math.max(260, ((2 * distance) / speedY) * 1000));
    const projected = startX + (velocityX * duration) / 2000;
    exitX.set(Math.max(-width * 0.4, Math.min(width * 0.4, projected)));
    spin.set((velocityX >= 0 ? 1 : -1) * 420);
    scheduleOnRN(handleReleased, Math.max(0.08, Math.min(0.92, 0.5 + exitX.get() / width)));
    // The top edge lights up as the plate crosses it, like it just left this phone.
    flash.set(withDelay(Math.round(duration * 0.55), withSequence(
      withTiming(1, { duration: 120, easing: EASE_OUT }),
      withTiming(0, { duration: 700, easing: Easing.out(Easing.quad) }),
    )));
    p.set(withTiming(1, { duration: reduced ? 200 : duration, easing: Easing.linear }, (finished) => {
      if (finished) scheduleOnRN(handleGone);
    }));
  };
  const throwFromAccessibility = () => scheduleOnUI(() => { 'worklet'; launch(0, -1800); });

  const pan = Gesture.Pan()
    .enabled(!cancelled)
    .onBegin(() => {
      press.set(withTiming(1.05, { duration: 120 }));
      grabbing.set(withTiming(1, { duration: 120 }));
      scheduleOnRN(grabbed);
    })
    .onUpdate((event) => {
      if (released.get()) return;
      tx.set(event.translationX);
      ty.set(event.translationY > 0 ? event.translationY * 0.3 : event.translationY);
      tilt.set(Math.max(-18, Math.min(18, event.translationX * 0.07 + event.velocityX * 0.005)));
      const ready = event.translationY < FLICK_DISTANCE ? 1 : 0;
      if (ready !== (armed.get() > 0.5 ? 1 : 0)) { armed.set(withTiming(ready, { duration: 140 })); if (ready) scheduleOnRN(arm); }
    })
    .onEnd((event) => {
      if (released.get()) return;
      const flicked = event.velocityY < FLICK_VELOCITY || (event.translationY < FLICK_DISTANCE && event.velocityY < 0);
      if (flicked) { launch(event.velocityX, event.velocityY); return; }
      armed.set(withTiming(0, { duration: 160 }));
      tx.set(withSpring(0, { ...RETURN, velocity: event.velocityX }));
      ty.set(withSpring(0, { ...RETURN, velocity: event.velocityY }));
      tilt.set(withSpring(0, RETURN));
    })
    .onFinalize(() => { press.set(withTiming(1, { duration: 160 })); grabbing.set(withTiming(0, { duration: 160 })); });
  const tap = Gesture.Tap().enabled(!cancelled).maxDuration(260)
    .onBegin(() => { press.set(withTiming(0.95, { duration: 100 })); })
    .onEnd((_event, success) => { if (success) launch(0, -1900); })
    .onFinalize(() => { press.set(withTiming(1, { duration: 160 })); });

  const at = (lag: number) => {
    'worklet';
    const t = Math.max(0, Math.min(1, p.get() - lag));
    const e = 1 - (1 - t) * (1 - t);
    return {
      x: rx.get() + (exitX.get() - rx.get()) * e,
      y: ry.get() + (exitDY - ry.get()) * e,
      r: tilt.get() + spin.get() * e,
      // It gets a touch bigger on the way up, as if it's coming off the glass toward the other phone.
      s: 1 + 0.12 * Math.sin(Math.PI * e) - 0.1 * e,
    };
  };

  const plateStyle = useAnimatedStyle(() => {
    if (released.get()) {
      if (reduced) return { opacity: 1 - p.get() };
      const pos = at(0);
      return { transform: [{ translateX: pos.x }, { translateY: pos.y }, { rotate: `${pos.r}deg` }, { scale: pos.s }] };
    }
    const bob = idle.get() * (1 - grabbing.get());
    return {
      opacity: reduced ? appear.get() : 1,
      transform: [
        { translateX: ex.get() + tx.get() },
        { translateY: ey.get() + ty.get() - bob * 8 },
        { rotate: `${tilt.get() + (bob - 0.5) * 3}deg` },
        { scale: es.get() * press.get() },
      ],
    };
  });
  // Helpers take the live values from their callers: an animated style only re-runs for shared values it touches itself.
  const trail = (index: number, progress: number, isReleased: number) => {
    'worklet';
    if (!isReleased || reduced) return { opacity: 0 };
    const pos = at(index * 0.06);
    return {
      opacity: interpolate(progress, [0, 0.05, 0.9, 1], [0, 0.34 - index * 0.09, 0.22 - index * 0.06, 0], 'clamp'),
      transform: [{ translateX: pos.x }, { translateY: pos.y }, { rotate: `${pos.r}deg` }, { scale: pos.s * (1 - index * 0.04) }],
    };
  };
  const trailStyles = [
    useAnimatedStyle(() => trail(TRAIL[0], p.get(), released.get())),
    useAnimatedStyle(() => trail(TRAIL[1], p.get(), released.get())),
    useAnimatedStyle(() => trail(TRAIL[2], p.get(), released.get())),
  ];
  const settled = (value: number, scaleNow: number, appearNow: number) => {
    'worklet';
    return reduced ? appearNow * value : interpolate(scaleNow, [startScale, 1], [0, 1], 'clamp') * value;
  };
  const bgStyle = useAnimatedStyle(() => ({ opacity: bg.get() * (1 - leaving.get()) }));
  const stageStyle = useAnimatedStyle(() => ({ opacity: 1 - leaving.get() }));
  const headerStyle = useAnimatedStyle(() => ({
    opacity: bg.get() * guides.get(),
    transform: [{ translateY: (1 - bg.get()) * -14 }],
  }));
  // The top edge warms as the plate is pulled toward it, and flashes when the plate goes through.
  const edgeStyle = useAnimatedStyle(() => {
    const pull = Math.min(1, Math.max(0, -ty.get() / 240)) * (1 - released.get());
    return { opacity: Math.max(0.12 * bg.get() * guides.get(), pull * 0.55, armed.get() * 0.6 * (1 - released.get()), flash.get()) };
  });
  const shadowStyle = useAnimatedStyle(() => {
    const lift = Math.min(1, Math.max(0, -ty.get() / 220));
    return {
      opacity: 0.16 * (1 - lift) * (1 - released.get()) * settled(1, es.get(), appear.get()),
      transform: [{ translateX: ex.get() + tx.get() * 0.5 }, { scaleX: 1 - lift * 0.5 + idle.get() * 0.06 * (1 - grabbing.get()) }],
    };
  });
  const handWrapStyle = useAnimatedStyle(() => {
    const shown = settled(1, es.get(), appear.get());
    return {
      opacity: shown * guides.get() * (1 - grabbing.get() * 0.6),
      transform: [{ translateY: (1 - shown) * 12 }],
    };
  });
  const handStyle = useAnimatedStyle(() => (reduced ? {} : {
    transform: [{ translateY: -Math.sin(Math.PI * hint.get()) * 8 }],
  }));

  const plateLeft = restCX - size / 2;
  const plateTop = restCY - size / 2;
  const halo = Math.min(width * 0.98, size * 1.42);
  const titleTop = Math.max(insets.top + 72, plateTop - 210);
  const chevronTop = Math.max(titleTop + 60, plateTop - 108);
  const name = partner.name;
  const resultTitle = phase === 'error' ? `Couldn\u2019t reach ${name}` : phase === 'sending' ? 'Sending\u2026' : `Sent to ${name}`;
  const resultBody = phase === 'error' ? error ?? 'Your plate is still here. Try again in a moment.' : null;
  const portionLabel = `${copy ? 'Full plate' : percent(share)}, ${kcal} kcal`;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface }, bgStyle]}>
        <LinearGradient colors={[colors.accentSoft, colors.surface, colors.accentSoft]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
        <View style={[styles.glow, { top: restCY - halo / 2, left: restCX - halo / 2, width: halo, height: halo, borderRadius: halo / 2, backgroundColor: colors.accentSoft, borderColor: colors.accentBorder }]} />
      </Animated.View>

      <Animated.View pointerEvents="none" style={[styles.edge, edgeStyle]}>
        <LinearGradient colors={[colors.accent, 'rgba(255,107,107,0)']} style={StyleSheet.absoluteFill} />
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, stageStyle]} pointerEvents="box-none">
        <Animated.View style={[styles.topBar, { top: insets.top + 12 }, headerStyle]} pointerEvents="box-none">
          {!thrown && (
            <Pressable onPress={onCancel} hitSlop={12} accessibilityRole="button" accessibilityLabel="Keep the plate"
              style={({ pressed }) => [styles.close, { backgroundColor: colors.card, boxShadow: colors.cardShadow, opacity: pressed ? 0.6 : 1 }]}>
              <X size={20} color={colors.muted} strokeWidth={2.4} />
            </Pressable>
          )}
        </Animated.View>

        <Animated.View style={[styles.header, { top: titleTop }, headerStyle]} pointerEvents="none">
          <View>
            <Text style={[styles.title, { color: colors.ink }]} numberOfLines={1} adjustsFontSizeToFit>Flick to share</Text>
            <View style={styles.sparks}>
              {SPARKS.map((spark) => (
                <View key={spark.rotate} style={[styles.spark, { left: spark.left, top: spark.top, backgroundColor: colors.accent, transform: [{ rotate: spark.rotate }] }]} />
              ))}
            </View>
          </View>
        </Animated.View>

        {gone && (
          <View pointerEvents="none" style={[styles.resultFrame, { top: insets.top, bottom: insets.bottom }]}>
          <Animated.View entering={reduced ? FadeIn.duration(180) : FadeInDown.duration(320).easing(EASE_OUT)} style={styles.result} accessibilityLiveRegion="polite">
            <View>
              <PassAvatar avatarKey={partner.avatarKey} name={name} gender={partner.gender} size={76} ring={colors.partner} soft={colors.partnerSoft} ringWidth={2.5} />
              {phase === 'sending'
                ? <View style={[styles.badge, { backgroundColor: colors.card, borderColor: colors.surface }]}><ActivityIndicator size="small" color={colors.muted} /></View>
                : <Animated.View entering={reduced ? FadeIn.duration(150) : ZoomIn.springify().damping(12)}
                    style={[styles.badge, { backgroundColor: phase === 'error' ? colors.accent : colors.success, borderColor: colors.surface }]}>
                    {phase === 'error' ? <X size={14} color="#FFFFFF" strokeWidth={3.2} /> : <Check size={14} color="#FFFFFF" strokeWidth={3.4} />}
                  </Animated.View>}
            </View>
            <Animated.Text key={resultTitle} entering={FadeIn.duration(200)} style={[styles.resultTitle, { color: colors.ink }]}>{resultTitle}</Animated.Text>
            {resultBody && <Animated.Text entering={FadeIn.duration(200)} style={[styles.resultBody, { color: colors.accent }]}>{resultBody}</Animated.Text>}
          </Animated.View>
          </View>
        )}

        {!reduced && (
          <View pointerEvents="none" style={[styles.chevrons, { top: chevronTop }]}>
            {CHEVRONS.map((index) => <Chevron key={index} index={index} hint={hint} armed={armed} visible={guides} colors={colors} />)}
          </View>
        )}

        <Animated.View pointerEvents="none" style={[styles.shadow, { left: restCX - size * 0.36, top: plateTop + size + 10, width: size * 0.72 }, shadowStyle]} />

        {TRAIL.map((index, i) => (
          <Animated.View key={index} pointerEvents="none" style={[styles.abs, { left: plateLeft, top: plateTop, width: size, height: size }, trailStyles[i]]}>
            <ThrowDisc size={size} imageUri={imageUri} isCutout={isCutout} title={title} kcal={kcal} colors={colors} />
          </Animated.View>
        ))}

        <GestureDetector gesture={Gesture.Race(pan, tap)}>
          <Animated.View
            accessible accessibilityRole="button"
            accessibilityLabel={`${name}\u2019s plate, ${portionLabel}. Double tap to throw it to ${words.object}.`}
            accessibilityActions={[{ name: 'activate' }]}
            onAccessibilityAction={throwFromAccessibility}
            hitSlop={{ top: 30, bottom: 30, left: 30, right: 30 }}
            style={[styles.abs, { left: plateLeft, top: plateTop, width: size, height: size, borderRadius: size / 2, boxShadow: `${colors.liftShadow}, 0 3px 6px ${colors.bevelShade}` }, plateStyle]}
          >
            <ThrowDisc size={size} imageUri={imageUri} isCutout={isCutout} title={title} kcal={kcal} colors={colors} />
          </Animated.View>
        </GestureDetector>

        <Animated.View pointerEvents="none" style={[styles.hand, { top: plateTop + size + 36, left: restCX - 40, backgroundColor: colors.accentSoft }, handWrapStyle]}>
          <Animated.View style={[styles.handIcon, handStyle]}>
            <ArrowUp size={18} color={colors.accent} strokeWidth={2.6} />
            <Pointer size={32} color={colors.accent} strokeWidth={2} />
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  glow: { position: 'absolute', borderWidth: 1 },
  edge: { position: 'absolute', top: 0, left: 0, right: 0, height: 200 },
  topBar: { position: 'absolute', left: 20, right: 20, height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  close: { position: 'absolute', right: 0, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  header: { position: 'absolute', left: 24, right: 24, alignItems: 'center' },
  title: { fontSize: 40, lineHeight: 48, fontWeight: '800', letterSpacing: -1.2, textAlign: 'center' },
  sparks: { position: 'absolute', right: -22, top: -10, width: 22, height: 26 },
  spark: { position: 'absolute', width: 3.5, height: 11, borderRadius: 2 },
  chevrons: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  chevron: { height: 28, width: 40, alignItems: 'center', justifyContent: 'center' },
  hand: { position: 'absolute', width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  handIcon: { alignItems: 'center', gap: 0 },
  resultFrame: { position: 'absolute', left: 32, right: 32, justifyContent: 'center' },
  result: { alignItems: 'center', width: '100%' },
  badge: { position: 'absolute', right: -4, bottom: -4, width: 30, height: 30, borderRadius: 15, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  resultTitle: { marginTop: 18, fontSize: 26, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center' },
  resultBody: { marginTop: 6, fontSize: 15, lineHeight: 20, fontWeight: '600', textAlign: 'center' },
  shadow: { position: 'absolute', height: 14, borderRadius: 999, backgroundColor: '#0F172A' },
});
