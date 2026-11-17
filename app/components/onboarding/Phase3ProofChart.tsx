import React, { useEffect } from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, FadeIn, FadeInDown, cancelAnimation, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { ArrowRight, ChevronLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

const C = { bg: '#FFFAFA', coral: '#FF595D', ink: '#14283F', muted: '#8D99AA', grid: '#E9E7EC' };
const TOGETHER = 'M 48 158 C 93 125, 116 116, 166 111 S 228 77, 264 62 S 294 53, 314 48';
const ALONE = 'M 48 158 C 92 142, 111 139, 153 146 S 206 149, 240 138 S 283 125, 314 121.333';
const BASE = 'L 314 158 L 48 158 Z';
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedGroup = Animated.createAnimatedComponent(G);
const DRAW_LENGTH = 360;

interface Props {
  onContinue: () => void;
  onBack: () => void;
  userName?: string;
}

export default function Phase3ProofChart({ onContinue, onBack, userName }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const contentWidth = Math.min(width, 480);
  const compact = height < 740;
  const reduceMotion = useReducedMotion();
  const graphProgress = useSharedValue(reduceMotion ? 1 : 0);
  const fillOpacity = useSharedValue(reduceMotion ? 1 : 0);
  const badgeOpacity = useSharedValue(reduceMotion ? 1 : 0);
  const buttonScale = useSharedValue(1);

  useEffect(() => {
    graphProgress.set(reduceMotion ? 1 : withDelay(280, withTiming(1, { duration: 1150, easing: EASE_OUT })));
    fillOpacity.set(reduceMotion ? 1 : withDelay(650, withTiming(1, { duration: 450, easing: EASE_OUT })));
    badgeOpacity.set(reduceMotion ? 1 : withDelay(1180, withTiming(1, { duration: 240, easing: EASE_OUT })));
    return () => {
      cancelAnimation(graphProgress);
      cancelAnimation(fillOpacity);
      cancelAnimation(badgeOpacity);
    };
  }, [reduceMotion, graphProgress, fillOpacity, badgeOpacity]);

  const graphProps = useAnimatedProps(() => ({ strokeDashoffset: DRAW_LENGTH * (1 - graphProgress.get()) }));
  const fillProps = useAnimatedProps(() => ({ opacity: fillOpacity.get() }));
  const badgeProps = useAnimatedProps(() => ({ opacity: badgeOpacity.get() }));
  const buttonStyle = useAnimatedStyle(() => ({ transform: [{ scale: buttonScale.get() }] }));
  const enter = (delay: number) => reduceMotion
    ? FadeIn.duration(220)
    : FadeInDown.duration(280).delay(delay).easing(EASE_OUT);

  return <View style={styles.root}>
    <StatusBar barStyle="dark-content" />
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.topBlush} />
      <View style={styles.bottomMint} />
      <View style={styles.bottomMintInner} />
    </View>
    <ScrollView
      style={styles.fill}
      contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20, paddingBottom: Math.max(insets.bottom, 16) + (__DEV__ ? 76 : 0) }]}
      contentInsetAdjustmentBehavior="never"
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      <View style={[styles.page, { maxWidth: contentWidth }]}>
        <View style={styles.header}>
          <Pressable onPress={onBack} style={({ pressed }) => [styles.back, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8}>
            <ChevronLeft color={C.ink} size={32} strokeWidth={2.5} />
          </Pressable>
          <View style={styles.brand}>
            <Image source={require('../../assets/logo.png')} tintColor={C.coral} contentFit="contain" style={styles.brandMark} accessible={false} />
            <Text style={styles.brandName}>RunTogether</Text>
          </View>
        </View>
        <View style={[styles.hero, { marginTop: compact ? 14 : 24 }]}>
          <Animated.View entering={enter(0)} style={styles.headlineWrap}>
            <Text accessibilityRole="header" style={[styles.headline, { fontSize: Math.min(compact ? 48 : 53, (contentWidth - 48) / 6.3), lineHeight: compact ? 51 : 56 }]}>
              3× Faster{'\n'}Together
            </Text>
            <Svg pointerEvents="none" width={42} height={34} viewBox="0 0 42 34" style={styles.headlineRays}>
              <Path d="M 6 12 L 7 3 M 20 17 L 29 6 M 29 27 L 39 23" stroke={C.coral} strokeWidth={3.5} strokeLinecap="round" />
            </Svg>
            <Svg pointerEvents="none" width={145} height={13} viewBox="0 0 145 13" style={styles.underline}>
              <Path d="M 4 9 Q 72 0 141 7" stroke={C.coral} strokeWidth={4} fill="none" strokeLinecap="round" />
            </Svg>
          </Animated.View>
          <Animated.View entering={enter(90)} style={[styles.artwork, { height: (contentWidth - 40) * 2 / 3, marginTop: compact ? 14 : 20 }]}>
            <Image source={require('../../assets/onboarding/together-fist-bump.png')} style={StyleSheet.absoluteFill} contentFit="contain" accessibilityLabel="Two running partners fist bumping" />
            <Svg pointerEvents="none" width={48} height={34} viewBox="0 0 48 34" style={styles.fistRays}>
              <Path d="M 10 26 L 4 16 M 24 18 L 24 4 M 37 25 L 44 14" stroke={C.coral} strokeWidth={3.5} strokeLinecap="round" />
            </Svg>
          </Animated.View>
          <Animated.View entering={enter(180)} style={styles.chartCard}>
            <View accessible accessibilityRole="image" accessibilityLabel={`${userName ? `${userName}'s illustrative` : 'Illustrative'} progress from week 1 to week 6. Together rises from zero to 3 times progress, alone rises to 1 times progress.`}>
              <Svg width="100%" height={(contentWidth - 52) * 193 / 360} viewBox="0 0 360 193" fontFamily="Helvetica">
                <Defs>
                  <LinearGradient id="togetherFill" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={C.coral} stopOpacity={0.32} />
                    <Stop offset="1" stopColor={C.coral} stopOpacity={0.02} />
                  </LinearGradient>
                  <LinearGradient id="aloneFill" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={C.muted} stopOpacity={0.24} />
                    <Stop offset="1" stopColor={C.muted} stopOpacity={0.03} />
                  </LinearGradient>
                </Defs>
                <SvgText x={48} y={18} fill={C.ink} fontSize={9} fontWeight="600">Progress</SvgText>
                {[0, 1, 2, 3].map(tick => {
                  const y = 158 - tick * (110 / 3);
                  return <G key={tick}>
                    <Line x1={48} y1={y} x2={314} y2={y} stroke={C.grid} strokeWidth={0.8} strokeDasharray={tick === 0 ? undefined : '3 5'} />
                    <Line x1={44} y1={y} x2={48} y2={y} stroke={C.grid} />
                    <SvgText x={36} y={y + 3.5} textAnchor="end" fill="#66758A" fontSize={10} fontWeight="600">{tick === 0 ? '0' : `${tick}×`}</SvgText>
                  </G>;
                })}
                <Line x1={48} y1={35} x2={48} y2={158} stroke={C.grid} />
                <AnimatedGroup animatedProps={fillProps}>
                  <Path d={`${ALONE} ${BASE}`} fill="url(#aloneFill)" />
                  <Path d={`${TOGETHER} ${BASE}`} fill="url(#togetherFill)" />
                </AnimatedGroup>
                <AnimatedPath animatedProps={graphProps} d={ALONE} stroke={C.muted} strokeWidth={3} fill="none" strokeLinecap="round" strokeDasharray={`${DRAW_LENGTH} ${DRAW_LENGTH}`} />
                <AnimatedPath animatedProps={graphProps} d={TOGETHER} stroke={C.coral} strokeWidth={3.5} fill="none" strokeLinecap="round" strokeDasharray={`${DRAW_LENGTH} ${DRAW_LENGTH}`} />
                <AnimatedGroup animatedProps={badgeProps}>
                <Circle cx={314} cy={48} r={9} fill={C.coral} opacity={0.13} />
                <Circle cx={314} cy={48} r={5.5} fill="#FFFFFF" stroke={C.coral} strokeWidth={2.5} />
                <G>
                  <Rect x={236} y={1} width={120} height={35} rx={17.5} fill={C.coral} stroke="#FFFFFF" strokeWidth={1} />
                  <Path d="M 307 35 L 314 43 L 321 35" fill={C.coral} />
                  <Path d="M 248 11 H 258 V 17 Q 258 23 253 23 Q 248 23 248 17 Z M 248 13 H 245 V 16 Q 245 19 249 19 M 258 13 H 261 V 16 Q 261 19 257 19 M 253 23 V 27 M 249 27 H 257" stroke="#FFFFFF" strokeWidth={1.6} fill="none" strokeLinejoin="round" />
                  <SvgText x={269} y={23} fill="#FFFFFF" fontSize={14} fontWeight="700">Together</SvgText>
                </G>
                <Rect x={297} y={109} width={59} height={25} rx={12.5} fill={C.muted} />
                <SvgText x={326.5} y={126} textAnchor="middle" fill="#FFFFFF" fontSize={12} fontWeight="700">Alone</SvgText>
                </AnimatedGroup>
                <SvgText x={48} y={180} fill="#485C74" fontSize={11} fontWeight="700">Week 1</SvgText>
                <SvgText x={314} y={180} textAnchor="end" fill="#485C74" fontSize={11} fontWeight="700">Week 6</SvgText>
              </Svg>
            </View>
          </Animated.View>
        </View>
        <View style={styles.spacer} />
        <Animated.View entering={enter(260)} style={buttonStyle}>
        <Pressable
          onPressIn={() => buttonScale.set(withSpring(reduceMotion ? 1 : 0.97, { duration: 150, dampingRatio: 1 }))}
          onPressOut={() => buttonScale.set(withSpring(1, { duration: 260, dampingRatio: 1 }))}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            onContinue();
          }}
          style={({ pressed }) => [styles.continueButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Continue"
        >
          <Text style={styles.continueText}>Continue</Text>
          <ArrowRight color="#FFFFFF" size={27} strokeWidth={2.4} />
        </Pressable>
        </Animated.View>
      </View>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, overflow: 'hidden' },
  fill: { flex: 1 },
  scrollContent: { flexGrow: 1, alignItems: 'center' },
  page: { width: '100%', flexGrow: 1, paddingHorizontal: 24 },
  topBlush: { position: 'absolute', width: 300, height: 220, borderRadius: 999, backgroundColor: '#FFDCDD', top: -160, left: -140 },
  bottomMint: { position: 'absolute', width: 340, height: 170, borderRadius: 999, backgroundColor: '#E1F5F1', bottom: -135, right: -95, transform: [{ rotate: '-24deg' }] },
  bottomMintInner: { position: 'absolute', width: 280, height: 140, borderRadius: 999, backgroundColor: '#BEEAE5', bottom: -135, right: -85, transform: [{ rotate: '-24deg' }] },
  header: { height: 48, alignItems: 'center', justifyContent: 'center' },
  back: { position: 'absolute', left: -8, width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.5 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: { width: 27, height: 27 },
  brandName: { color: C.ink, fontSize: 21, fontWeight: '900', letterSpacing: -0.9 },
  hero: { width: '100%' },
  headlineWrap: { alignItems: 'center', alignSelf: 'center' },
  headline: { color: C.ink, fontWeight: '900', letterSpacing: -2, textAlign: 'center' },
  headlineRays: { position: 'absolute', right: -18, top: -16 },
  underline: { alignSelf: 'flex-end', marginRight: 8, marginTop: 1 },
  artwork: { marginHorizontal: -4 },
  fistRays: { position: 'absolute', left: '50%', marginLeft: -24, top: '37%' },
  chartCard: { backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: 28, borderCurve: 'continuous', marginTop: -29, marginHorizontal: -4, paddingHorizontal: 6, paddingTop: 10, paddingBottom: 1, boxShadow: '0 12px 28px rgba(80, 36, 50, 0.07)' },
  spacer: { flexGrow: 1, minHeight: 25 },
  continueButton: { height: 56, borderRadius: 999, backgroundColor: C.coral, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 24, borderWidth: 1, borderColor: '#FFFFFF', boxShadow: '0 9px 22px rgba(255, 89, 93, 0.25)' },
  continueText: { color: '#FFFFFF', fontSize: 21, fontWeight: '800', letterSpacing: -0.5 },
});
