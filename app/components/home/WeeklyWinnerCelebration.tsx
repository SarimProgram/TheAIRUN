import { useColorScheme } from '@/hooks/use-color-scheme';
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { cancelAnimation, Easing, ReduceMotion, type SharedValue, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { type WeeklyResult } from '../../hooks/useWeekPrize';
import { getImageChatAvatarSource } from '../../utils/genderMascot';
import AnimatedStepCount from '../battle/AnimatedStepCount';

type Props = {
  result: WeeklyResult | null;
  partnerName: string;
  yourGender?: string | null;
  partnerGender?: string | null;
  onFinish: () => void;
  children: React.ReactNode;
};

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const PARTICLES = Array.from({ length: 24 }, (_, index) => ({
  angle: (index / 23) * Math.PI,
  distance: 130 + (index % 4) * 26,
  turn: (index % 2 ? 1 : -1) * (100 + index * 17),
  color: ['#2BBFC4', '#F4656F', '#E6B75A'][index % 3],
}));

function Confetti({ progress, index }: { progress: SharedValue<number>; index: number }) {
  const { angle, distance, turn, color } = PARTICLES[index];
  const motion = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, (progress.get() - (index % 3) * 0.04) / 0.88));
    return {
      opacity: Math.min(1, p * 12) * Math.max(0, 1 - Math.max(0, p - 0.55) / 0.45),
      transform: [
        { translateX: Math.cos(angle) * distance * p },
        { translateY: -Math.sin(angle) * distance * p + 155 * p * p },
        { rotate: `${turn * p}deg` },
        { scale: 1 - p * 0.4 },
      ],
    };
  });
  return <Animated.View style={[styles.confetti, { backgroundColor: color, height: index % 3 === 0 ? 5 : 8 }, motion]} />;
}

// Both states occupy the same space: the surrounding challenge never moves.
export default function WeeklyWinnerCelebration({ result, partnerName, yourGender, partnerGender, onFinish, children }: Props) {
  const dark = useColorScheme() === 'dark';
  const reducedMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const compact = width < 360;
  const tie = result?.winner === 'tie';
  const yours = result?.winner === 'you';
  const title = tie ? 'You both won.' : yours ? 'You won!' : `${partnerName} won!`;
  const longTitle = Array.from(title).length > 11;
  const [typing, setTyping] = useState({ key: '', text: '' });
  const goals = useSharedValue(1);
  const reveal = useSharedValue(0);
  const burst = useSharedValue(0);
  const hero = useSharedValue(0);

  useEffect(() => {
    [goals, reveal, burst, hero].forEach(cancelAnimation);
    if (!result) {
      goals.set(1);
      reveal.set(0);
      return;
    }
    reveal.set(0);
    burst.set(0);
    hero.set(0);
    const letters = Array.from(title);
    const cadence = Math.min(40, Math.max(18, 900 / letters.length));
    const successAt = reducedMotion ? 380 : 260 + letters.length * cadence;
    setTyping({ key: result.id, text: reducedMotion ? title : '' });
    const typingTimers = reducedMotion ? [] : letters.map((_, index) => setTimeout(() => {
      setTyping({ key: result.id, text: letters.slice(0, index + 1).join('') });
    }, 260 + (index + 1) * cadence));
    // Opacity-only fades and the reading pause remain when Reduce Motion is on.
    goals.set(withSequence(ReduceMotion.Never, withTiming(0, { duration: 180, reduceMotion: ReduceMotion.Never }), withDelay(4200, withTiming(1, { duration: 260, easing: EASE_OUT, reduceMotion: ReduceMotion.Never }), ReduceMotion.Never)));
    reveal.set(withSequence(ReduceMotion.Never, withDelay(180, withTiming(1, { duration: 280, easing: EASE_OUT, reduceMotion: ReduceMotion.Never }), ReduceMotion.Never), withDelay(3800, withTiming(0, { duration: 180, reduceMotion: ReduceMotion.Never }), ReduceMotion.Never)));
    if (!reducedMotion) {
      hero.set(withDelay(180, withSpring(1, { duration: 600, dampingRatio: 0.82 })));
      burst.set(withDelay(successAt, withTiming(1, { duration: 1700, easing: Easing.linear })));
    }
    // A soft lead-in, then a success pulse as the completed title and burst land.
    const leadIn = reducedMotion ? undefined : setTimeout(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {});
    }, 260);
    const feedback = setTimeout(() => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }, successAt);
    const finish = setTimeout(onFinish, 4660);
    return () => {
      clearTimeout(feedback);
      clearTimeout(leadIn);
      clearTimeout(finish);
      typingTimers.forEach(clearTimeout);
      [goals, reveal, burst, hero].forEach(cancelAnimation);
    };
  }, [result, title, reducedMotion, onFinish, goals, reveal, burst, hero]);

  const goalsMotion = useAnimatedStyle(() => ({ opacity: goals.get() }));
  const revealMotion = useAnimatedStyle(() => ({ opacity: reveal.get() }));
  const avatarMotion = useAnimatedStyle(() => ({ opacity: reveal.get(), transform: [{ translateY: reducedMotion ? 0 : (1 - hero.get()) * 24 }, { scale: reducedMotion ? 1 : 0.88 + hero.get() * 0.12 }] }));
  const titleMotion = useAnimatedStyle(() => ({ transform: [{ translateY: reducedMotion ? 0 : (1 - reveal.get()) * 8 }] }));
  const backdropMotion = useAnimatedStyle(() => ({ opacity: reveal.get() * (dark ? 0.08 : 0.055), transform: [{ rotate: '-9deg' }, { translateX: reducedMotion ? 0 : (1 - hero.get()) * -28 }] }));
  const accent = yours ? (dark ? '#78D9DC' : '#0E8A90') : (dark ? '#FFA4AA' : '#D9434D');
  const ink = dark ? '#F8FAFC' : '#1E1F2A';
  const muted = dark ? '#CBD5E1' : '#6B7280';

  return (
    <View testID="weekly-winner-stage" style={styles.stage}>
      <Animated.View pointerEvents={result ? 'none' : 'auto'} accessibilityElementsHidden={!!result} importantForAccessibility={result ? 'no-hide-descendants' : 'auto'} style={goalsMotion}>
        {children}
      </Animated.View>
      {result && <Animated.View testID="weekly-winner-reveal" pointerEvents="none" style={[styles.reveal, revealMotion]}>
        <Animated.Text accessible={false} importantForAccessibility="no" numberOfLines={1} adjustsFontSizeToFit style={[styles.backdropWord, { color: accent }, backdropMotion]}>{tie ? 'TOGETHER' : 'WINNER'}</Animated.Text>
        <View accessible={false} style={styles.effects}>
          {!reducedMotion && PARTICLES.map((_, index) => <Confetti key={`${result.id}-${index}`} progress={burst} index={index} />)}
        </View>
        <Animated.View style={[styles.copy, titleMotion]}>
          <Text style={[styles.eyebrow, { color: accent }]}>{tie ? 'A SHARED VICTORY' : 'LAST WEEK’S WINNER'}</Text>
          <Text accessibilityRole="header" accessibilityLabel={title} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.55} style={[styles.title, compact && styles.titleCompact, longTitle && styles.titleLong, { color: ink }]}>
            <Text testID="winner-typed-copy">{reducedMotion ? title : typing.key === result.id ? typing.text : ''}</Text>
            <Text style={styles.untyped}>{reducedMotion ? '' : title.slice(typing.key === result.id ? typing.text.length : 0)}</Text>
          </Text>
        </Animated.View>
        <Animated.View style={[styles.portraits, tie && styles.tiedPortraits, longTitle && styles.shortPortrait, avatarMotion]}>
          {(tie ? [true, false] : [yours]).map((isYou, index) => <View key={String(isYou)} style={[styles.portrait, tie && styles.tiePortrait, longTitle && styles.shortPortrait, index === 1 && styles.secondPortrait]}>
            <Image source={getImageChatAvatarSource(isYou ? yourGender : partnerGender)} style={[styles.avatar, tie && styles.tieAvatar]} resizeMode="cover" />
          </View>)}
        </Animated.View>
        <View style={styles.resultCopy}>
          <View accessible accessibilityLabel={`${result.yourGoalsCompleted} to ${result.partnerGoalsCompleted} goals completed`} style={styles.scoreRow}>
            <View style={styles.scoreNumber}><AnimatedStepCount value={result.yourGoalsCompleted} color={muted} fontSize={16} animateOnMount /></View>
            <Text style={[styles.score, { color: muted }]}>–</Text>
            <View style={styles.scoreNumber}><AnimatedStepCount value={result.partnerGoalsCompleted} color={muted} fontSize={16} animateOnMount /></View>
            <Text style={[styles.score, { color: muted }]}>goals completed</Text>
          </View>
          {result.weekprize && <Text numberOfLines={2} style={[styles.reward, { color: ink }]}>{tie ? 'Prize: ' : 'Won '}{result.weekprize.replace(/^winner gets\s+/i, '')}</Text>}
        </View>
      </Animated.View>}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { justifyContent: 'flex-start' },
  reveal: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
  backdropWord: { position: 'absolute', top: '40%', left: -20, right: -20, fontSize: 88, fontWeight: '900', fontStyle: 'italic', letterSpacing: -5, textAlign: 'center' },
  effects: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  confetti: { position: 'absolute', left: '50%', top: '65%', width: 3, borderRadius: 1 },
  portraits: { width: 144, height: 152, alignItems: 'center' },
  tiedPortraits: { width: 224 },
  portrait: { width: 144, height: 152, overflow: 'hidden', borderBottomLeftRadius: 24, borderBottomRightRadius: 24, borderCurve: 'continuous' },
  tiePortrait: { width: 128, height: 140, position: 'absolute', left: 0, top: 4 },
  secondPortrait: { left: 96, top: 12 },
  avatar: { width: 164, height: 184, top: -6, left: -12 },
  tieAvatar: { width: 146, height: 164, top: -5, left: -10 },
  copy: { width: '100%', alignItems: 'center', gap: 4 },
  resultCopy: { width: '100%', alignItems: 'center', gap: 4 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textAlign: 'center' },
  title: { width: '100%', fontSize: 48, fontWeight: '900', letterSpacing: -1.8, textAlign: 'center' },
  titleCompact: { fontSize: 40 },
  titleLong: { fontSize: 32, lineHeight: 36, letterSpacing: -1 },
  shortPortrait: { height: 136 },
  untyped: { color: 'transparent' },
  score: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'], textAlign: 'center' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  scoreNumber: { width: 28 },
  reward: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
});
