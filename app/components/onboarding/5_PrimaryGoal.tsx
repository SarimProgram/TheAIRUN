import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, FadeInDown, Keyframe, interpolate, interpolateColor, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Image, type ImageSource } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, Check, ChevronLeft } from 'lucide-react-native';

const C = { bg: '#FFFCFC', coral: '#FF4548', ink: '#082437', border: '#EEEDEF', ring: '#D8D9DB', white: '#FFFFFF' };
const SURFACE = 'rgba(255,255,255,0.78)';
const SURFACE_SELECTED = 'rgba(255,236,236,0.95)';
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const SETTLE = { duration: 400, dampingRatio: 0.72 };

type GoalOption = { id: string; title: string; icon: ImageSource };

const GOALS: GoalOption[] = [
  { id: 'weightloss', title: 'Lose weight', icon: require('../../assets/goals/goal-lose-weight.png') },
  { id: 'running', title: 'Be a stronger runner', icon: require('../../assets/goals/goal-stronger-runner.png') },
  { id: 'both', title: 'Lose weight for a run', icon: require('../../assets/goals/goal-weight-and-run.png') },
];

interface Props {
  onContinue: (goal: string | null) => void;
  onBack: () => void;
  gender?: string | null;
  joinedWithPartner?: boolean;
}

const rise = (delay: number) => FadeInDown.duration(560).delay(delay).easing(EASE_OUT)
  .withInitialValues({ opacity: 0, transform: [{ translateY: 18 }] });

const sparklePop = (delay: number) => new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.4 }] },
  60: { opacity: 1, transform: [{ scale: 1.12 }], easing: EASE_OUT },
  100: { opacity: 1, transform: [{ scale: 1 }], easing: EASE_OUT },
}).duration(420).delay(delay);

export default function Phase5Dummy({ onContinue, onBack, joinedWithPartner = false }: Props) {
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const compact = height < 740;
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const canContinue = selectedGoal !== null;

  const ctaPressed = useSharedValue(0);
  const ctaReady = useSharedValue(canContinue ? 1 : 0);

  useEffect(() => {
    ctaReady.set(withTiming(canContinue ? 1 : 0, { duration: 220, easing: EASE_OUT }));
  }, [canContinue, ctaReady]);

  const ctaStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ctaReady.get(), [0, 1], [0.45, 1]),
    transform: [{ scale: interpolate(ctaPressed.get(), [0, 1], [1, 0.97]) }],
  }));
  const arrowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: interpolate(ctaPressed.get(), [0, 1], [0, 5]) }] }));

  const selectGoal = (id: string) => {
    if (id === selectedGoal) return;
    Haptics.selectionAsync().catch(() => {});
    setSelectedGoal(id);
  };

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onContinue(selectedGoal);
  };

  return <View style={styles.root}>
    <StatusBar barStyle="dark-content" />
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.topBlush, { width: width * 0.85, height: width * 0.85 }]} />
      <View style={[styles.bottomMint, { width: width * 0.95, height: width * 0.95 }]} />
    </View>
    <ScrollView
      style={styles.fill}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: compact ? 16 : 24 }]}
      contentInsetAdjustmentBehavior="never"
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      <View style={styles.header}>
        <Pressable onPress={onBack} style={({ pressed }) => [styles.back, pressed && styles.backPressed]} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8}>
          <ChevronLeft color={C.ink} size={32} strokeWidth={2.5} />
        </Pressable>
        <View style={styles.brand}>
          <Image source={require('../../assets/logo.png')} tintColor={C.coral} contentFit="contain" style={styles.brandMark} accessible={false} />
          <Text style={styles.brandName}>RunTogether</Text>
        </View>
      </View>

      <Animated.View entering={rise(80)} style={[styles.titleWrap, { marginTop: compact ? 36 : 52 }]}>
        <Text style={[styles.title, compact && styles.titleCompact]} adjustsFontSizeToFit numberOfLines={1}>
          {joinedWithPartner ? 'Our' : 'Your'} <Text style={styles.titleAccent}>goal?</Text>
        </Text>
        <View pointerEvents="none" style={styles.sparkles}>
          <Animated.View entering={sparklePop(380)} style={[styles.sparkleSlot, styles.sparkleOne]}><View style={[styles.sparkle, styles.rotOne]} /></Animated.View>
          <Animated.View entering={sparklePop(440)} style={[styles.sparkleSlot, styles.sparkleTwo]}><View style={[styles.sparkle, styles.rotTwo]} /></Animated.View>
          <Animated.View entering={sparklePop(500)} style={[styles.sparkleSlot, styles.sparkleThree]}><View style={[styles.sparkle, styles.rotThree]} /></Animated.View>
        </View>
      </Animated.View>

      <View style={{ marginTop: compact ? 32 : 44, gap: compact ? 14 : 20 }} accessibilityRole="radiogroup">
        {GOALS.map((goal, index) => (
          <Animated.View key={goal.id} entering={rise(180 + index * 70)}>
            <GoalCard goal={goal} selected={selectedGoal === goal.id} compact={compact} onSelect={selectGoal} />
          </Animated.View>
        ))}
      </View>

      <View style={styles.spacer} />
      <Animated.View entering={rise(420)}>
        <Pressable
          onPress={handleContinue}
          disabled={!canContinue}
          onPressIn={() => ctaPressed.set(withTiming(1, { duration: 110, easing: EASE_OUT }))}
          onPressOut={() => ctaPressed.set(withTiming(0, { duration: 180, easing: EASE_OUT }))}
          accessibilityRole="button"
          accessibilityLabel="Continue"
          accessibilityState={{ disabled: !canContinue }}
        >
          <Animated.View style={[styles.continueButton, ctaStyle]}>
            <Text style={styles.continueText}>Continue</Text>
            <Animated.View style={arrowStyle}>
              <ArrowRight color={C.white} size={27} strokeWidth={2.4} />
            </Animated.View>
          </Animated.View>
        </Pressable>
      </Animated.View>
    </ScrollView>
  </View>;
}

function GoalCard({ goal, selected, compact, onSelect }: { goal: GoalOption; selected: boolean; compact: boolean; onSelect: (id: string) => void }) {
  const progress = useSharedValue(selected ? 1 : 0);
  const badge = useSharedValue(selected ? 1 : 0);
  const pressed = useSharedValue(0);

  useEffect(() => {
    progress.set(withTiming(selected ? 1 : 0, { duration: 240, easing: EASE_OUT }));
    badge.set(selected ? withSpring(1, SETTLE) : withTiming(0, { duration: 140, easing: EASE_OUT }));
  }, [selected, progress, badge]);

  const cardStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(progress.get(), [0, 1], [C.border, C.coral]),
    backgroundColor: interpolateColor(progress.get(), [0, 1], [SURFACE, SURFACE_SELECTED]),
    transform: [{ scale: interpolate(pressed.get(), [0, 1], [1, 0.97]) }],
  }));
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(badge.get(), [0, 1], [1, 1.07]) }, { rotate: `${interpolate(badge.get(), [0, 1], [0, -5])}deg` }],
  }));
  const checkStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, badge.get() * 1.6),
    transform: [{ scale: interpolate(badge.get(), [0, 1], [0.55, 1]) }],
  }));
  const ringStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.get() }));

  return <Pressable
    onPress={() => onSelect(goal.id)}
    onPressIn={() => pressed.set(withTiming(1, { duration: 110, easing: EASE_OUT }))}
    onPressOut={() => pressed.set(withTiming(0, { duration: 180, easing: EASE_OUT }))}
    accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={goal.title}
  >
    <Animated.View style={[styles.card, compact && styles.cardCompact, cardStyle]}>
      <Animated.View style={[styles.iconWrap, compact && styles.iconWrapCompact, iconStyle]}>
        <Image source={goal.icon} contentFit="contain" style={styles.icon} accessible={false} />
      </Animated.View>
      <Text style={styles.cardTitle} numberOfLines={2}>{goal.title}</Text>
      <View style={styles.radio}>
        <Animated.View style={[styles.radioRing, ringStyle]} />
        <Animated.View style={[styles.radioChecked, checkStyle]}>
          <Check color={C.white} size={18} strokeWidth={3.4} />
        </Animated.View>
      </View>
    </Animated.View>
  </Pressable>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, overflow: 'hidden' },
  fill: { flex: 1 },
  topBlush: { position: 'absolute', top: -255, left: -130, borderRadius: 999, backgroundColor: '#FFF0EF' },
  bottomMint: { position: 'absolute', bottom: -320, right: -190, borderRadius: 999, backgroundColor: '#E4F5F1' },
  content: { flexGrow: 1, paddingHorizontal: 24 },
  header: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  back: { position: 'absolute', left: -8, width: 48, height: 48, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  backPressed: { opacity: 0.5 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandMark: { width: 29, height: 29 },
  brandName: { color: C.ink, fontSize: 20, fontWeight: '900', letterSpacing: -0.8 },
  titleWrap: { alignSelf: 'center' },
  title: { color: C.ink, fontSize: 44, fontWeight: '900', letterSpacing: -2, textAlign: 'center' },
  titleCompact: { fontSize: 38 },
  titleAccent: { color: C.coral },
  sparkles: { position: 'absolute', right: -30, top: -26, width: 44, height: 38 },
  sparkleSlot: { position: 'absolute', width: 17, height: 17, alignItems: 'center', justifyContent: 'center' },
  sparkle: { width: 4, height: 17, borderRadius: 3, backgroundColor: C.coral },
  sparkleOne: { left: -2, top: 0 },
  sparkleTwo: { left: 17, top: 8 },
  sparkleThree: { right: -6, bottom: -6 },
  rotOne: { transform: [{ rotate: '7deg' }] },
  rotTwo: { transform: [{ rotate: '42deg' }] },
  rotThree: { transform: [{ rotate: '65deg' }] },
  card: { minHeight: 112, borderRadius: 24, borderCurve: 'continuous', borderWidth: 1.5, borderColor: C.border, backgroundColor: SURFACE, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 18, paddingVertical: 12, gap: 16, boxShadow: '0 6px 18px rgba(8, 36, 55, 0.05)' },
  cardCompact: { minHeight: 96 },
  iconWrap: { width: 92, height: 84, alignItems: 'center', justifyContent: 'center' },
  iconWrapCompact: { width: 80, height: 72 },
  icon: { width: '100%', height: '100%' },
  cardTitle: { flex: 1, color: C.ink, fontSize: 19, fontWeight: '800', letterSpacing: -0.4, lineHeight: 24 },
  radio: { width: 28, height: 28 },
  radioRing: { ...StyleSheet.absoluteFillObject, borderRadius: 14, borderWidth: 2, borderColor: C.ring },
  radioChecked: { ...StyleSheet.absoluteFillObject, borderRadius: 14, backgroundColor: C.coral, alignItems: 'center', justifyContent: 'center' },
  spacer: { flexGrow: 1, minHeight: 24 },
  continueButton: { height: 54, borderRadius: 999, borderCurve: 'continuous', marginHorizontal: 1, marginBottom: __DEV__ ? 92 : 12, backgroundColor: C.coral, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, boxShadow: '0 8px 20px rgba(255, 69, 72, 0.26)' },
  continueText: { color: C.white, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
});
