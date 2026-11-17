import React, { useEffect } from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { cancelAnimation, interpolate, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, ChartNoAxesColumnIncreasing, ChevronLeft, Target, UsersRound } from 'lucide-react-native';
import Svg, { ClipPath, Defs, Image as SvgImage, Path } from 'react-native-svg';
import { EASE_OUT, pop, rise } from './OnboardingKit';

const C = { background: '#FFFCFD', ink: '#071E39', coral: '#FF5059', blush: '#FFECEF' };
const COUPLE_PHOTO = require('../../assets/onboarding/couple-transformation.jpg');
const AnimatedPath = Animated.createAnimatedComponent(Path);
const UNDERLINE_LENGTH = 170;
const ARROW_CURVE_LENGTH = 70;
const ARROW_HEAD_LENGTH = 26;

function useDraw(delay: number, duration: number) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    progress.set(withDelay(delay, withTiming(1, { duration, easing: EASE_OUT })));
    return () => cancelAnimation(progress);
  }, [delay, duration, progress, reduced]);
  return progress;
}

interface Props {
  currentWeight: number | string;
  targetWeight: number | string;
  unit: string;
  userGoal?: string | null;
  onContinue: () => void;
  onBack: () => void;
}

const HABITS = [
  { label: 'Friendly\nBets', Icon: Target, color: C.coral, background: '#FFF0F2' },
  { label: 'Shared\nChallenges', Icon: UsersRound, color: '#4A88FF', background: '#EEF3FF' },
  { label: 'Mutual\nSupport', Icon: ChartNoAxesColumnIncreasing, color: '#28D7C6', background: '#E9FCF8' },
];

export default function WeightHabitPlan({ onContinue, onBack }: Props) {
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const pageWidth = Math.min(width, 480);
  const scale = pageWidth / 393;
  const compact = height < 740;
  const largeText = fontScale > 1.2;

  const underline = useDraw(420, 520);
  const arrowCurve = useDraw(640, 420);
  const arrowHead = useDraw(1000, 200);
  const connector = useDraw(560, 640);
  const pressed = useSharedValue(0);

  const underlineProps = useAnimatedProps(() => ({ strokeDashoffset: UNDERLINE_LENGTH * (1 - underline.get()) }));
  const arrowCurveProps = useAnimatedProps(() => ({ strokeDashoffset: ARROW_CURVE_LENGTH * (1 - arrowCurve.get()) }));
  const arrowHeadProps = useAnimatedProps(() => ({ strokeDashoffset: ARROW_HEAD_LENGTH * (1 - arrowHead.get()) }));
  const connectorStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: connector.get() }] }));
  const buttonStyle = useAnimatedStyle(() => ({ transform: [{ scale: interpolate(pressed.get(), [0, 1], [1, 0.97]) }] }));
  const arrowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: interpolate(pressed.get(), [0, 1], [0, 5]) }] }));

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <View pointerEvents="none" style={styles.topBlush} />
      <ScrollView
        style={styles.fill}
        contentContainerStyle={[styles.scrollContent, {
          paddingTop: insets.top + 24,
          paddingBottom: Math.max(insets.bottom, 16) + 8 + (__DEV__ ? 76 : 0),
        }]}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.page, { maxWidth: pageWidth }]}>
          <View style={styles.header}>
            <Pressable onPress={onBack} style={({ pressed }) => [styles.back, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8}>
              <ChevronLeft size={30} color={C.ink} strokeWidth={2.4} />
            </Pressable>
            <View style={styles.brand}>
              <Image source={require('../../assets/logo.png')} tintColor={C.coral} contentFit="contain" style={styles.brandMark} accessible={false} />
              <Text style={styles.brandName}>RunTogether</Text>
            </View>
          </View>

          <View style={[styles.headline, { marginTop: compact ? 20 : 32 }]}>
            <Animated.Text entering={rise(80)} accessibilityRole="header" style={[styles.headlineFirst, { fontSize: 31 * scale, lineHeight: 38 * scale }]}>Couples Get Fitter</Animated.Text>
            <Animated.View entering={rise(140)} style={styles.togetherWrap}>
              <Text style={[styles.together, { fontSize: 44 * scale, lineHeight: 50 * scale }]}>Together</Text>
              <Animated.View entering={pop(580)} pointerEvents="none" style={styles.headlineRays}>
                <Svg accessible={false} width={32 * scale} height={38 * scale} viewBox="0 0 32 38">
                  <Path d="M 3 15 L 12 3 M 10 23 L 25 15 M 13 33 L 29 32" fill="none" stroke="#FF7077" strokeWidth={3.3} strokeLinecap="round" />
                </Svg>
              </Animated.View>
            </Animated.View>
            <Svg accessible={false} pointerEvents="none" width={158 * scale} height={16 * scale} viewBox="0 0 158 16">
              <AnimatedPath d="M 5 11 Q 77 -1 153 7" stroke={C.coral} strokeWidth={5} fill="none" strokeLinecap="round" strokeDasharray={`${UNDERLINE_LENGTH} ${UNDERLINE_LENGTH}`} animatedProps={underlineProps} />
            </Svg>
          </View>

          <View style={[styles.story, { marginTop: compact ? 28 : 36 }, largeText && styles.storyStacked]}>
            <Animated.View entering={rise(220)} style={[styles.photoWrap, { height: 180 * scale }, largeText && styles.photoWide]}>
              <View pointerEvents="none" style={styles.photoBlush} />
              <View style={styles.photoFrame}>
                <Svg width="100%" height="100%" viewBox="0 0 260 180" accessible accessibilityLabel="The couple before and after their transformation" accessibilityRole="image">
                  <Defs>
                    <ClipPath id="habitBefore"><Path d="M 0 0 H 146 L 102 180 H 0 Z" /></ClipPath>
                    <ClipPath id="habitAfter"><Path d="M 146 0 H 260 V 180 H 102 Z" /></ClipPath>
                  </Defs>
                  <SvgImage href={COUPLE_PHOTO} x={0} y={0} width={293} height={180} preserveAspectRatio="xMidYMid slice" clipPath="url(#habitBefore)" />
                  <SvgImage href={COUPLE_PHOTO} x={-34} y={0} width={293} height={180} preserveAspectRatio="xMidYMid slice" clipPath="url(#habitAfter)" />
                  <Path d="M 146 0 L 102 180" stroke="#FFFFFF" strokeWidth={3} />
                </Svg>
              </View>
            </Animated.View>
            <View style={[styles.secret, largeText && styles.secretWide]}>
              <Animated.View entering={rise(320)}>
                <View style={styles.secretBadge}>
                  <Text style={[styles.secretTitle, { fontSize: 16 * scale }]}>Their secret?</Text>
                  <Animated.View entering={pop(640)} pointerEvents="none" style={styles.secretRays}>
                    <Svg accessible={false} width={29} height={26} viewBox="0 0 29 26">
                      <Path d="M 3 14 L 3 5 M 12 16 L 17 7 M 19 23 L 26 19" stroke={C.coral} strokeWidth={2.5} strokeLinecap="round" />
                    </Svg>
                  </Animated.View>
                </View>
              </Animated.View>
              <Animated.Text entering={rise(380)} style={[styles.secretText, { fontSize: 15 * scale, lineHeight: 20 * scale }]}>A consistent fitness routine together.</Animated.Text>
              <Svg accessible={false} pointerEvents="none" width={60 * scale} height={40 * scale} viewBox="0 0 60 40" style={styles.secretArrow}>
                <AnimatedPath d="M 51 3 Q 43 35 9 27" stroke={C.coral} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeDasharray={`${ARROW_CURVE_LENGTH} ${ARROW_CURVE_LENGTH}`} animatedProps={arrowCurveProps} />
                <AnimatedPath d="M 16 21 L 7 27 L 15 35" stroke={C.coral} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={`${ARROW_HEAD_LENGTH} ${ARROW_HEAD_LENGTH}`} animatedProps={arrowHeadProps} />
              </Svg>
            </View>
          </View>

          <Animated.View entering={rise(440)} style={[styles.habitIntro, { marginTop: compact ? 28 : 36 }]}>
            <Text style={[styles.habitIntroText, { fontSize: 16 * scale }]}>It works because of <Text style={styles.coral}>3 simple habits</Text></Text>
          </Animated.View>
          <View style={[styles.habits, { marginTop: 40 }, largeText && styles.habitsStacked]}>
            {!largeText && <Animated.View pointerEvents="none" style={[styles.connector, connectorStyle]} />}
            {HABITS.map(({ label, Icon, color, background }, index) => (
              <Animated.View key={label} entering={rise(520 + index * 70)} style={[styles.habitCard, { backgroundColor: background, minHeight: 86 * scale }, largeText && styles.habitCardWide]}>
                <Animated.View entering={pop(660 + index * 70)} style={[styles.habitIcon, { backgroundColor: background }]}><Icon size={34 * scale} color={color} strokeWidth={2.8} /></Animated.View>
                <Text style={[styles.habitLabel, { fontSize: 15 * scale, lineHeight: 17 * scale }]}>{largeText ? label.replace('\n', ' ') : label}</Text>
              </Animated.View>
            ))}
          </View>

          <View style={[styles.spacer, { minHeight: 32 }]} />
          <Animated.View entering={rise(760)}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                onContinue();
              }}
              onPressIn={() => pressed.set(withTiming(1, { duration: 110, easing: EASE_OUT }))}
              onPressOut={() => pressed.set(withTiming(0, { duration: 180, easing: EASE_OUT }))}
              accessibilityRole="button"
              accessibilityLabel="Next"
            >
              <Animated.View style={[styles.nextButton, buttonStyle]}>
                <LinearGradient colors={['#FF686B', '#FF4854']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.nextGradient}>
                  <Text style={styles.nextText}>Next</Text>
                  <Animated.View style={arrowStyle}><ArrowRight color="#FFFFFF" size={28} strokeWidth={2.5} /></Animated.View>
                </LinearGradient>
              </Animated.View>
            </Pressable>
          </Animated.View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  fill: { flex: 1 },
  topBlush: { position: 'absolute', top: -170, left: -100, width: 250, height: 240, borderRadius: 120, backgroundColor: C.blush, transform: [{ rotate: '-22deg' }] },
  scrollContent: { flexGrow: 1, alignItems: 'center' },
  page: { width: '100%', flexGrow: 1, paddingHorizontal: 24 },
  header: { height: 48, alignItems: 'center', justifyContent: 'center' },
  back: { position: 'absolute', left: -8, width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  brandMark: { width: 40, height: 36 },
  brandName: { fontSize: 20, fontWeight: '900', color: C.ink, letterSpacing: -0.9 },
  headline: { alignItems: 'center' },
  headlineFirst: { color: C.ink, fontWeight: '900', fontStyle: 'italic', letterSpacing: -1.2, textAlign: 'center' },
  togetherWrap: { position: 'relative' },
  together: { color: C.coral, fontWeight: '900', fontStyle: 'italic', letterSpacing: -1.6, textAlign: 'center' },
  headlineRays: { position: 'absolute', right: -35, bottom: 0 },
  story: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  storyStacked: { flexDirection: 'column', gap: 24 },
  photoWrap: { width: '66%', position: 'relative' },
  photoWide: { width: '100%' },
  photoBlush: { position: 'absolute', top: -13, bottom: -13, left: -16, right: -8, borderRadius: 70, backgroundColor: C.blush, transform: [{ rotate: '-4deg' }] },
  photoFrame: { flex: 1, borderRadius: 46, borderCurve: 'continuous', borderWidth: 3, borderColor: '#FFFFFF', overflow: 'hidden', backgroundColor: C.blush },
  secret: { flex: 1, alignSelf: 'stretch', justifyContent: 'center' },
  secretWide: { width: '100%', alignItems: 'center' },
  secretBadge: { borderWidth: 1.5, borderColor: '#FF9DA4', borderRadius: 24, paddingVertical: 8, marginLeft: -8, transform: [{ rotate: '-7deg' }], backgroundColor: '#FFF3F4' },
  secretTitle: { color: C.ink, fontWeight: '800', letterSpacing: -0.6, textAlign: 'center' },
  secretRays: { position: 'absolute', top: -28, right: -3 },
  secretText: { color: C.ink, fontWeight: '600', letterSpacing: -0.5, marginTop: 12, marginLeft: 2 },
  secretArrow: { marginTop: 6 },
  habitIntro: { borderRadius: 28, borderCurve: 'continuous', backgroundColor: '#FFFFFF', paddingVertical: 13, paddingHorizontal: 8, boxShadow: '0 8px 22px rgba(155, 61, 86, 0.05)' },
  habitIntroText: { color: C.ink, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5 },
  coral: { color: C.coral },
  habits: { flexDirection: 'row', gap: 12, alignItems: 'stretch' },
  habitsStacked: { flexDirection: 'column', gap: 28 },
  connector: { position: 'absolute', top: '50%', height: 2, left: 20, right: 20, backgroundColor: '#DDDDE5', transformOrigin: 'left' },
  habitCard: { flex: 1, borderRadius: 25, borderCurve: 'continuous', borderWidth: 3, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', paddingTop: 24, paddingBottom: 12, paddingHorizontal: 3, boxShadow: '0 7px 15px rgba(88, 89, 130, 0.05)' },
  habitCardWide: { flex: 0 },
  habitIcon: { position: 'absolute', top: -23, width: 58, height: 48, borderTopLeftRadius: 30, borderTopRightRadius: 30, alignItems: 'center', justifyContent: 'center' },
  habitLabel: { color: C.ink, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center' },
  spacer: { flexGrow: 1 },
  nextButton: { borderRadius: 32, borderCurve: 'continuous', overflow: 'hidden' },
  nextGradient: { minHeight: 56, paddingVertical: 12, paddingHorizontal: 24, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12 },
  nextText: { color: '#FFFFFF', fontSize: 23, fontWeight: '800' },
});
