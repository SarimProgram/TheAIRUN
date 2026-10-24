import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  Animated,
  StatusBar,
  Dimensions,
  Platform,
} from 'react-native';
import { ChevronLeft, ArrowRight } from 'lucide-react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { height: windowHeight } = Dimensions.get('window');
const isAirLayout = Dimensions.get('window').width >= 700 || (Platform.OS === 'ios' && Platform.isPad);
const isCompactFrame = windowHeight <= 820;
const useCompactLayout = isAirLayout || isCompactFrame;

const COLORS = {
  red: '#FF3B3B',
  redDark: '#D62F2F',
  white: '#FFFFFF',
  whiteSoft: 'rgba(255, 255, 255, 0.82)',
  whiteMuted: 'rgba(255, 255, 255, 0.55)',
};

interface Props {
  currentWeight: number | string;
  targetWeight: number | string;
  unit: string;
  userGoal?: string | null;
  onContinue: () => void;
  onBack: () => void;
}

function useTypewriter(text: string, active: boolean, speed = 28) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!active) {
      setDisplayed('');
      setDone(false);
      return;
    }

    setDisplayed('');
    setDone(false);
    let index = 0;

    const interval = setInterval(() => {
      index += 1;
      setDisplayed(text.slice(0, index));
      if (index >= text.length) {
        clearInterval(interval);
        setDone(true);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, active, speed]);

  return { displayed, done };
}

export default function WeightHabitPlan({
  currentWeight,
  targetWeight,
  unit,
  userGoal,
  onContinue,
  onBack,
}: Props) {
  const isBothGoal = userGoal === 'both';
  const isRunningOnly = userGoal === 'running';
  const isRunningGoal = isRunningOnly || isBothGoal;
  const weightDiff = Math.max(0, Number(currentWeight) - Number(targetWeight));
  const unitLabel = unit.toLowerCase() === 'lbs' ? 'lbs' : 'kg';
  const amountLabel = `${weightDiff} ${unitLabel}`;
  const goalLabel = isBothGoal
    ? 'Weight Loss & Running'
    : isRunningGoal
      ? 'Running'
      : amountLabel;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;
  const amountScale = useRef(new Animated.Value(0.88)).current;
  const amountOpacity = useRef(new Animated.Value(0)).current;
  const [showFirstLine, setShowFirstLine] = useState(false);
  const [showSecondLine, setShowSecondLine] = useState(false);

  const firstLine = isBothGoal
    ? `Losing ${amountLabel} while training for a run is totally doable with the right plan.`
    : isRunningOnly
      ? "We're designing this plan around your level, your schedule, and your running goals."
      : `Losing ${amountLabel} is totally doable with the right plan.`;
  const secondLine = "To help you progress, we'll build a habit goal plan made just for you.";

  const firstTyped = useTypewriter(firstLine, showFirstLine);
  const secondTyped = useTypewriter(secondLine, showSecondLine);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
    ]).start();

    const amountTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(amountOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(amountScale, { toValue: 1, friction: 7, tension: 80, useNativeDriver: true }),
      ]).start();
    }, 200);

    const firstLineTimer = setTimeout(() => setShowFirstLine(true), 700);
    return () => {
      clearTimeout(amountTimer);
      clearTimeout(firstLineTimer);
    };
  }, [amountOpacity, amountScale, fadeAnim, slideAnim]);

  useEffect(() => {
    if (!firstTyped.done) return;
    const timer = setTimeout(() => setShowSecondLine(true), 350);
    return () => clearTimeout(timer);
  }, [firstTyped.done]);

  const showContinue = secondTyped.done;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={[COLORS.red, COLORS.redDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.bgIconWrap} pointerEvents="none">
        <MaterialCommunityIcons
          name={isRunningGoal ? 'run-fast' : 'dumbbell'}
          size={useCompactLayout ? 220 : 280}
          color="rgba(255, 255, 255, 0.1)"
        />
      </View>

      <SafeAreaView style={styles.flex}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
            <ChevronLeft color={COLORS.white} size={28} />
          </TouchableOpacity>
        </View>

        <Animated.View
          style={[
            styles.main,
            useCompactLayout && styles.mainCompact,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.textBlock}>
            <Text style={[styles.eyebrow, useCompactLayout && styles.eyebrowCompact]}>YOUR GOAL</Text>

            <Animated.View
              style={{
                opacity: amountOpacity,
                transform: [{ scale: amountScale }],
              }}
            >
              <Text
                style={[
                  styles.amount,
                  (isRunningGoal || isBothGoal) && styles.amountRunning,
                  useCompactLayout && styles.amountCompact,
                ]}
              >
                {goalLabel}
              </Text>
            </Animated.View>

            <View style={styles.typingBlock}>
              <Text style={[styles.typingText, useCompactLayout && styles.typingTextCompact]}>
                {firstTyped.displayed}
                {showFirstLine && !firstTyped.done ? <Text style={styles.cursor}>|</Text> : null}
              </Text>

              {(showSecondLine || secondTyped.displayed.length > 0) && (
                <Text
                  style={[
                    styles.typingText,
                    styles.typingTextSecondary,
                    useCompactLayout && styles.typingTextCompact,
                  ]}
                >
                  {secondTyped.displayed}
                  {showSecondLine && !secondTyped.done ? <Text style={styles.cursor}>|</Text> : null}
                </Text>
              )}
            </View>
          </View>
        </Animated.View>

        <Animated.View
          style={[
            styles.footer,
            useCompactLayout && styles.footerCompact,
            { opacity: showContinue ? 1 : 0 },
          ]}
          pointerEvents={showContinue ? 'auto' : 'none'}
        >
          <TouchableOpacity style={styles.continueBtn} onPress={onContinue} activeOpacity={0.9}>
            <Text style={styles.continueText}>Continue</Text>
            <View style={styles.continueIcon}>
              <ArrowRight color={COLORS.red} size={20} strokeWidth={3} />
            </View>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.red },
  flex: { flex: 1 },
  bgIconWrap: {
    position: 'absolute',
    right: -24,
    bottom: '22%',
    transform: [{ rotate: '-18deg' }],
  },
  header: { paddingHorizontal: 16, paddingTop: 8 },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 22,
  },
  main: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: 'center',
  },
  mainCompact: {
    paddingHorizontal: 28,
  },
  textBlock: {
    gap: 18,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.whiteMuted,
    letterSpacing: 2.5,
  },
  eyebrowCompact: {
    fontSize: 11,
    letterSpacing: 2,
  },
  amount: {
    fontSize: 64,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: -2.5,
    lineHeight: 68,
  },
  amountCompact: {
    fontSize: 52,
    lineHeight: 56,
  },
  amountRunning: {
    fontSize: 56,
    lineHeight: 60,
    letterSpacing: -1.5,
  },
  typingBlock: {
    marginTop: 8,
    gap: 20,
  },
  typingText: {
    fontSize: 22,
    fontWeight: '600',
    color: COLORS.whiteSoft,
    lineHeight: 32,
    letterSpacing: -0.3,
  },
  typingTextCompact: {
    fontSize: 19,
    lineHeight: 28,
  },
  typingTextSecondary: {
    color: COLORS.white,
    fontWeight: '700',
  },
  cursor: {
    color: COLORS.white,
    fontWeight: '300',
  },
  footer: {
    paddingHorizontal: 32,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  footerCompact: {
    paddingHorizontal: 28,
    paddingBottom: Platform.OS === 'ios' ? 24 : 20,
  },
  continueBtn: {
    backgroundColor: COLORS.white,
    height: 64,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
  continueText: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.red,
    letterSpacing: -0.3,
  },
  continueIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
