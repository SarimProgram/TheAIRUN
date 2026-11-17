import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState, LayoutChangeEvent, Pressable, ScrollView, StyleProp, StyleSheet, Text, TextStyle, View, useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { requireOptionalNativeModule } from 'expo-modules-core';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing, Extrapolation, FadeIn, type SharedValue, interpolate, runOnJS, useAnimatedReaction, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import Svg, { Line } from 'react-native-svg';
import { ArrowRight, Check, CircleCheck, Flag, Heart, TrendingDown } from 'lucide-react-native';

const COACH_ART = {
  maleStart: require('../../assets/onboarding/male-start.webp'),
  femaleStart: require('../../assets/onboarding/female-start.webp'),
  maleCelebrate: require('../../assets/onboarding/male-celebrate.webp'),
  femaleCelebrate: require('../../assets/onboarding/female-celebrate.webp'),
};
const ART_ASPECT = 960 / 1639;
const C = {
  bg: '#FFFFFF',
  coral: '#FF625F',
  coralDeep: '#E9504D',
  coralSoft: '#FFEDEC',
  ink: '#142139',
  body: '#3A4357',
  muted: '#6B7385',
  idleIcon: '#7D8597',
  dash: '#D5D8E0',
  teal: '#22B8A3',
  tealTop: '#4ADBC5',
  tealBottom: '#1EAF9A',
};
const EASE = Easing.bezier(0.23, 1, 0.32, 1);
const SWEEP = Easing.bezier(0.45, 0, 0.25, 1);
const STORY_MS = 6400;

// Timeline (0 → 1): Start lights up, the line climbs through each milestone, then the finale plays.
const START_LIT: [number, number] = [0.04, 0.12];
const LINE: [number, number] = [0.12, 0.82];
const FINALE: [number, number] = [0.82, 0.96];
// How much of the line (0–1) a milestone takes to light up as the line arrives.
const ARRIVE = 0.07;

const H = { goal: 60, pill: 50, start: 56 };
const COLUMN_PAD = { top: 18, bottom: 20 };
const TITLE_LINES = ['Lose Weight', '−3 kg', '−5 kg', 'Reach your goal'];

type AudioApi = typeof import('expo-audio');
type AudioPlayers = { complete: ReturnType<AudioApi['createAudioPlayer']> };

interface Props {
  onNext: () => void;
  onLogin: () => void;
  onInviteCode: () => void;
}

function lineAt(v: number) {
  'worklet';
  return interpolate(v, LINE, [0, 1], Extrapolation.CLAMP);
}

function finaleAt(v: number) {
  'worklet';
  return interpolate(v, FINALE, [0, 1], Extrapolation.CLAMP);
}

function RollerLine({ t, index, at3, at5, lineHeight, text, style }: {
  t: SharedValue<number>; index: number; at3: number; at5: number; lineHeight: number; text: string; style: StyleProp<TextStyle>;
}) {
  const rollStyle = useAnimatedStyle(() => {
    const k = interpolate(
      lineAt(t.get()),
      [at3 - ARRIVE, at3, at5 - ARRIVE, at5, 1 - ARRIVE, 1],
      [0, 1, 1, 2, 2, 3],
      Extrapolation.CLAMP,
    );
    const d = index - k;
    const distance = Math.min(1, Math.abs(d));
    return {
      opacity: interpolate(distance, [0, 0.55], [1, 0], Extrapolation.CLAMP),
      transform: [{ translateY: d * lineHeight * 0.85 }, { scale: 1 - 0.08 * distance }],
    };
  });
  return <Animated.Text style={[style, s.rollerLine, rollStyle]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
    {text} <Text style={s.together}>Together</Text>
  </Animated.Text>;
}

function PillLabel({ value, unit, color }: { value: string; unit?: string; color: string }) {
  return <Text style={[s.pillValue, { color }]} numberOfLines={1}>
    {value}{unit ? <Text style={s.pillUnit}>{unit}</Text> : null}
  </Text>;
}

function Milestone({ t, at, value, unit, kind, nudge }: {
  t: SharedValue<number>; at: number; value: string; unit?: string; kind: 'start' | 'step'; nudge: number;
}) {
  const isStart = kind === 'start';
  const lit = (v: number) => {
    'worklet';
    return isStart
      ? interpolate(v, START_LIT, [0, 1], Extrapolation.CLAMP)
      : interpolate(lineAt(v), [at - ARRIVE, at], [0, 1], Extrapolation.CLAMP);
  };
  const wrapStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: nudge }, { scale: 1 + 0.05 * Math.sin(lit(t.get()) * Math.PI) }],
  }));
  const litStyle = useAnimatedStyle(() => ({ opacity: lit(t.get()) }));
  const idleStyle = useAnimatedStyle(() => ({ opacity: 1 - lit(t.get()) }));
  const checkStyle = useAnimatedStyle(() => {
    const f = lit(t.get());
    return { opacity: f, transform: [{ scale: interpolate(f, [0, 0.6, 1], [0.3, 1.15, 1]) }] };
  });
  const Icon = isStart ? Flag : TrendingDown;
  const size = isStart ? s.startSize : s.stepSize;

  return <Animated.View style={[size, wrapStyle]}>
    <Animated.View style={[s.tealGlow, size, litStyle]} />
    <View style={[s.surface, size]}>
      <View style={[StyleSheet.absoluteFill, s.clip, size]}>
        <Animated.View style={[StyleSheet.absoluteFill, litStyle]}>
          <LinearGradient colors={[C.tealTop, C.tealBottom]} style={StyleSheet.absoluteFill} />
          <LinearGradient colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']} style={s.sheen} />
        </Animated.View>
        <Animated.View style={[s.pillRow, idleStyle]}>
          <View style={[s.badge, { backgroundColor: isStart ? C.coralSoft : '#F1F2F5' }]}>
            <Icon size={15} color={isStart ? C.coral : C.idleIcon} strokeWidth={2.6} />
          </View>
          <PillLabel value={value} unit={unit} color={isStart ? C.coralDeep : C.body} />
          <View style={[s.ring, isStart && s.ringStart]} />
        </Animated.View>
        <Animated.View style={[s.pillRow, litStyle]}>
          <View style={[s.badge, s.badgeLit]}>
            <Icon size={15} color="#FFFFFF" strokeWidth={2.6} />
          </View>
          <PillLabel value={value} unit={unit} color="#FFFFFF" />
          <Animated.View style={[s.checkDisk, checkStyle]}>
            <Check size={13} color={C.teal} strokeWidth={3.6} />
          </Animated.View>
        </Animated.View>
      </View>
      {isStart && <Animated.View style={[StyleSheet.absoluteFill, s.startOutline, size, idleStyle]} pointerEvents="none" />}
    </View>
  </Animated.View>;
}

function Goal({ t }: { t: SharedValue<number> }) {
  const lit = (v: number) => {
    'worklet';
    return interpolate(lineAt(v), [1 - ARRIVE, 1], [0, 1], Extrapolation.CLAMP);
  };
  const wrapStyle = useAnimatedStyle(() => {
    const f = lit(t.get());
    return { transform: [{ scale: 1 + 0.06 * f + 0.06 * Math.sin(f * Math.PI) }] };
  });
  const litStyle = useAnimatedStyle(() => ({ opacity: lit(t.get()) }));
  const idleStyle = useAnimatedStyle(() => ({ opacity: 1 - lit(t.get()) }));
  return <Animated.View style={[s.goalSize, wrapStyle]}>
    <Animated.View style={[s.goalGlow, s.goalSize, litStyle]} />
    <View style={[s.surface, s.goalSize]}>
      <View style={[StyleSheet.absoluteFill, s.clip, s.goalSize]}>
        <Animated.View style={[StyleSheet.absoluteFill, litStyle]}>
          <View style={[StyleSheet.absoluteFill, s.goalActive]} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, s.center, idleStyle]}>
          <CircleCheck size={30} color={C.idleIcon} strokeWidth={1.8} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, s.center, litStyle]}>
          <CircleCheck size={32} color={C.coral} strokeWidth={2} />
        </Animated.View>
      </View>
    </View>
  </Animated.View>;
}

function Coach({ gender, t, left, top, size }: {
  gender: 'male' | 'female'; t: SharedValue<number>; left: number; top: number; size: { width: number; height: number };
}) {
  const idleSource = gender === 'male' ? COACH_ART.maleStart : COACH_ART.femaleStart;
  const winningSource = gender === 'male' ? COACH_ART.maleCelebrate : COACH_ART.femaleCelebrate;
  // Celebrate just before the track reaches the final goal.
  const poseSwitch = LINE[1] - 0.04;
  const before = useAnimatedStyle(() => ({ opacity: t.get() < poseSwitch ? 1 : 0 }));
  const after = useAnimatedStyle(() => {
    const f = interpolate(t.get(), [poseSwitch, LINE[1]], [0, 1], Extrapolation.CLAMP);
    return { opacity: t.get() >= poseSwitch ? 1 : 0, transform: [{ translateY: 4 * (1 - f) }] };
  });
  return <View pointerEvents="none" style={[s.coach, { left, top, ...size }]}>
    <Animated.View style={[StyleSheet.absoluteFill, before]}>
      <Image source={idleSource} contentFit="contain" allowDownscaling={false} style={[s.poseImage, gender === 'female' && s.facePartner]} accessible={false} />
    </Animated.View>
    <Animated.View style={[StyleSheet.absoluteFill, after]}>
      <Image source={winningSource} contentFit="contain" allowDownscaling={false} style={[s.poseImage, gender === 'female' && s.facePartner]} accessible={false} />
    </Animated.View>
  </View>;
}

export default function Phase0Welcome({ onNext, onLogin, onInviteCode }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const compact = height < 740;
  const [sceneH, setSceneH] = useState(0);
  const t = useSharedValue(reduced ? 1 : 0);
  const pressScale = useSharedValue(1);
  const leaving = useRef(false);
  const started = useRef(false);
  const navTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioApi = useRef<AudioApi | null>(null);
  const players = useRef<AudioPlayers | null>(null);

  const play = useCallback((fromStart: boolean) => {
    if (reduced) {
      t.set(withTiming(1, { duration: 200 }));
      return;
    }
    const sweep = withTiming(1, { duration: STORY_MS, easing: SWEEP });
    t.set(fromStart
      ? withDelay(450, sweep)
      : withSequence(withTiming(0, { duration: 450, easing: EASE }), withDelay(250, sweep)));
  }, [reduced, t]);

  const onSceneLayout = useCallback((e: LayoutChangeEvent) => {
    setSceneH(Math.round(e.nativeEvent.layout.height));
  }, []);

  useEffect(() => {
    if (sceneH > 0 && !started.current) {
      started.current = true;
      play(true);
    }
  }, [play, sceneH]);

  useEffect(() => {
    try {
      if (!requireOptionalNativeModule('ExpoAudio')) return;
      // This import must stay lazy: older development builds do not include ExpoAudio.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const audio = require('expo-audio') as AudioApi;
      audioApi.current = audio;
      players.current = { complete: audio.createAudioPlayer(require('../../assets/onboarding/complete.wav')) };
    } catch {
      audioApi.current = null;
      players.current = null;
    }
    return () => {
      if (navTimer.current) clearTimeout(navTimer.current);
      players.current?.complete.release();
      players.current = null;
      audioApi.current = null;
    };
  }, []);

  const replay = useCallback(() => {
    if (leaving.current) return;
    void Haptics.selectionAsync().catch(() => {});
    play(false);
  }, [play]);

  const begin = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    void (async () => {
      try {
        await audioApi.current?.setAudioModeAsync({ playsInSilentMode: false, shouldPlayInBackground: false, interruptionMode: 'mixWithOthers' });
        await players.current?.complete.seekTo(0);
        if (AppState.currentState === 'active') players.current?.complete.play();
      } catch { /* Navigation never depends on sound. */ }
    })();
    if (players.current) navTimer.current = setTimeout(onNext, 430);
    else onNext();
  }, [onNext]);

  const leaveVia = useCallback((destination: () => void) => {
    if (leaving.current) return;
    leaving.current = true;
    destination();
  }, []);

  // Line geometry: the track runs from the Start pill's centre up to the trophy's centre.
  const columnH = Math.max(0, sceneH - COLUMN_PAD.top - COLUMN_PAD.bottom);
  const gap = Math.max(12, (columnH - H.goal - 2 * H.pill - H.start) / 3);
  const lineLen = Math.max(1, columnH - H.goal / 2 - H.start / 2);
  const at3 = sceneH > 0 ? (H.start / 2 + gap + H.pill / 2) / lineLen : 0.33;
  const at5 = sceneH > 0 ? (H.start / 2 + 2 * gap + 1.5 * H.pill) / lineLen : 0.66;
  const step3Time = LINE[0] + (LINE[1] - LINE[0]) * at3;
  const step5Time = LINE[0] + (LINE[1] - LINE[0]) * at5;
  const art = { height: sceneH * 0.97, width: sceneH * 0.97 * ART_ASPECT };
  const titleLH = compact ? 36 : 40;

  const pulseMilestone = useCallback((stage: number) => {
    if (leaving.current || AppState.currentState !== 'active') return;
    if (stage === 4) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  }, []);

  useAnimatedReaction(
    () => {
      const progress = t.get();
      if (progress >= LINE[1]) return 4;
      if (progress >= step5Time) return 3;
      if (progress >= step3Time) return 2;
      if (progress >= START_LIT[1]) return 1;
      return 0;
    },
    (stage, previous) => {
      if (!reduced && previous !== null && stage > previous) runOnJS(pulseMilestone)(stage);
    },
    [reduced, step3Time, step5Time],
  );

  const heartStyle = useAnimatedStyle(() => {
    const f = finaleAt(t.get());
    return { opacity: f, transform: [{ scale: 0.7 + 0.3 * f }, { rotate: '12deg' }] };
  });
  const lineStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: lineAt(t.get()) }] }));
  const headStyle = useAnimatedStyle(() => {
    const v = t.get();
    return {
      opacity: interpolate(v, [LINE[0], LINE[0] + 0.03, LINE[1] - 0.04, LINE[1]], [0, 1, 1, 0], Extrapolation.CLAMP),
      transform: [{ translateY: -lineLen * lineAt(v) }],
    };
  });
  const buttonStyle = useAnimatedStyle(() => ({ transform: [{ scale: pressScale.get() }] }));

  const titleStyle = [s.title, compact && s.titleCompact];

  return <View style={s.root}>
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[s.blob, { width: width * 0.94, height: width * 0.94, left: -width * 0.54, top: -width * 0.75, backgroundColor: '#FFE6E3' }]} />
      <View style={[s.blob, { width: width * 0.78, height: width * 0.78, left: -width * 0.46, top: -width * 0.67, backgroundColor: '#FF9993' }]} />
      <View style={[s.blob, { width: width * 0.94, height: width * 0.94, right: -width * 0.54, bottom: -width * 0.75, backgroundColor: '#DFF7EE' }]} />
      <View style={[s.blob, { width: width * 0.78, height: width * 0.78, right: -width * 0.46, bottom: -width * 0.67, backgroundColor: '#87DCC2' }]} />
    </View>
    <ScrollView
      style={s.fill}
      contentContainerStyle={[s.content, {
        minHeight: height,
        paddingTop: insets.top + 8,
        paddingBottom: Math.max(insets.bottom, 16),
      }]}
      contentInsetAdjustmentBehavior="never"
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      <View style={s.brand}>
        <Image source={require('../../assets/logo.png')} tintColor={C.coral} contentFit="contain" style={s.logo} accessible={false} />
        <Text style={s.brandName}>RunTogether</Text>
      </View>

      <View style={[s.heading, compact && s.headingCompact]}>
        <View style={s.titleRow} accessible accessibilityRole="header" accessibilityLabel="Reach your goal together">
          <View style={[s.roller, { height: titleLH }]}>
            {TITLE_LINES.map((line, i) => (
              <RollerLine key={line} t={t} index={i} at3={at3} at5={at5} lineHeight={titleLH} text={line} style={titleStyle} />
            ))}
          </View>
        </View>
      </View>

      <Pressable
        style={[s.scene, { width }]}
        onLayout={onSceneLayout}
        onPress={replay}
        accessibilityRole="button"
        accessibilityLabel="Example journey: start, minus 3 kilograms, minus 5 kilograms, then the completed goal. Your goals will be your own."
        accessibilityHint="Replays the animation"
      >
        {sceneH > 0 && <Animated.View entering={FadeIn.duration(250)} style={StyleSheet.absoluteFill}>
          <View style={[StyleSheet.absoluteFill, s.artClip]} pointerEvents="none">
            <Coach gender="male" t={t} size={art} top={sceneH * 0.02} left={width * 0.17 - art.width / 2} />
            <Coach gender="female" t={t} size={art} top={sceneH * 0.03} left={width * 0.83 - art.width / 2} />
            <Animated.View style={[s.heart, { top: sceneH * 0.06, right: width * 0.1 }, heartStyle]}>
              <Heart size={26} color={C.coral} fill={C.coralSoft} strokeWidth={2.4} />
            </Animated.View>
            <LinearGradient
              colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.85)', C.bg]}
              locations={[0, 0.55, 0.85]}
              style={[s.fade, { height: sceneH * 0.45 }]}
            />
          </View>

          <View style={[s.column, { top: COLUMN_PAD.top, bottom: COLUMN_PAD.bottom }]} pointerEvents="none">
            <View style={[s.track, { bottom: H.start / 2, height: lineLen }]}>
              <Svg width={4} height={lineLen} style={StyleSheet.absoluteFill}>
                <Line x1={2} y1={2} x2={2} y2={lineLen - 2} stroke={C.dash} strokeWidth={3} strokeLinecap="round" strokeDasharray="0.1 9" />
              </Svg>
              <Animated.View style={[s.trackFill, lineStyle]} />
            </View>
            <Animated.View style={[s.head, { bottom: H.start / 2 - 7 }, headStyle]} />
            <Goal t={t} />
            <Milestone t={t} at={at5} value="−5" unit=" kg" kind="step" nudge={10} />
            <Milestone t={t} at={at3} value="−3" unit=" kg" kind="step" nudge={-10} />
            <Milestone t={t} at={0} value="Start" kind="start" nudge={0} />
          </View>
        </Animated.View>}
      </Pressable>

      <View style={s.bottom}>
        <Animated.View style={buttonStyle}>
          <Pressable
            style={s.primaryButton}
            onPress={begin}
            onPressIn={() => pressScale.set(withTiming(0.97, { duration: 110, easing: EASE }))}
            onPressOut={() => pressScale.set(withSpring(1, { duration: 300, dampingRatio: 1 }))}
            accessibilityRole="button"
          >
            <Text style={s.buttonText}>Start Journey</Text>
            <ArrowRight color="#FFFFFF" size={20} strokeWidth={2.6} />
          </Pressable>
        </Animated.View>
        <View style={s.linkRow}>
          <Pressable onPress={() => leaveVia(onLogin)} hitSlop={12} accessibilityRole="button">
            <Text style={s.linkText}>Log in</Text>
          </Pressable>
          <View style={s.linkDivider} />
          <Pressable onPress={() => leaveVia(onInviteCode)} hitSlop={12} accessibilityRole="button">
            <Text style={s.linkText}>Have an invite code?</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  </View>;
}

const SHADOW = '0 1px 2px rgba(20, 33, 57, 0.06), 0 10px 22px -6px rgba(20, 33, 57, 0.16)';

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, overflow: 'hidden' },
  blob: { position: 'absolute', borderRadius: 9999 },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  fill: { flex: 1, width: '100%', height: '100%' },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { alignItems: 'center', paddingHorizontal: 24 },

  brand: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 40 },
  logo: { width: 28, height: 28 },
  brandName: { color: C.ink, fontSize: 21, fontWeight: '900', letterSpacing: -0.7 },

  heading: { width: '100%', alignItems: 'center', marginTop: 24 },
  headingCompact: { marginTop: 16 },
  titleRow: { width: '100%', maxWidth: 380 },
  roller: { width: '100%', overflow: 'hidden' },
  together: { color: C.coral },
  rollerLine: { ...StyleSheet.absoluteFillObject },
  title: {
    color: C.ink, fontSize: 36, lineHeight: 40, fontWeight: '800', letterSpacing: -1,
    textAlign: 'center', fontVariant: ['tabular-nums'],
  },
  titleCompact: { fontSize: 31, lineHeight: 36 },

  scene: { flex: 1, minHeight: 290, maxHeight: 470, marginTop: 28 },
  artClip: { overflow: 'hidden' },
  coach: { position: 'absolute' },
  poseImage: { ...StyleSheet.absoluteFillObject },
  facePartner: { transform: [{ scaleX: -1 }] },
  heart: { position: 'absolute' },

  column: { position: 'absolute', left: 0, right: 0, alignItems: 'center', justifyContent: 'space-between' },
  track: { position: 'absolute', left: '50%', marginLeft: -2, width: 4, borderRadius: 2, overflow: 'hidden' },
  trackFill: { ...StyleSheet.absoluteFillObject, borderRadius: 2, backgroundColor: C.teal, transformOrigin: 'bottom' },
  head: {
    position: 'absolute', left: '50%', marginLeft: -7, width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#FFFFFF', borderWidth: 3, borderColor: C.teal, boxShadow: '0 0 0 5px rgba(34, 184, 163, 0.18)',
  },

  surface: { backgroundColor: '#FFFFFF', borderCurve: 'continuous', boxShadow: SHADOW },
  clip: { overflow: 'hidden', borderCurve: 'continuous' },
  sheen: { position: 'absolute', left: 0, right: 0, top: 0, height: '50%' },
  tealGlow: { position: 'absolute', backgroundColor: C.teal, boxShadow: '0 10px 24px -4px rgba(30, 175, 154, 0.55)' },
  goalGlow: { position: 'absolute', backgroundColor: C.coralSoft, boxShadow: '0 8px 24px rgba(255, 98, 95, 0.18)' },
  goalActive: { backgroundColor: C.coralSoft },

  stepSize: { width: 156, height: H.pill, borderRadius: H.pill / 2 },
  startSize: { width: 172, height: H.start, borderRadius: H.start / 2 },
  startOutline: { borderWidth: 1.5, borderColor: '#FF9C99', borderCurve: 'continuous' },
  pillRow: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 10, paddingRight: 14 },
  badge: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  badgeLit: { backgroundColor: 'rgba(255, 255, 255, 0.24)' },
  pillValue: { flex: 1, fontSize: 19, fontWeight: '800', letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
  pillUnit: { fontSize: 15, fontWeight: '600' },
  ring: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#E1E3E9' },
  ringStart: { borderColor: '#FFC9C6' },
  checkDisk: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 2px 6px rgba(10, 90, 78, 0.25)',
  },

  goalSize: { width: H.goal, height: H.goal, borderRadius: H.goal / 2 },

  bottom: { width: '100%', gap: 12, marginTop: 28 },
  primaryButton: {
    height: 56, borderRadius: 28, borderCurve: 'continuous', backgroundColor: C.coral,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    boxShadow: '0 10px 24px -6px rgba(255, 98, 95, 0.55)',
  },
  buttonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  linkRow: { minHeight: 44, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 16 },
  linkText: { color: C.muted, fontSize: 15, fontWeight: '600' },
  linkDivider: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#C9CBD3' },
});
