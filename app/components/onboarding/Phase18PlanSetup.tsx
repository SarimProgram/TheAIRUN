import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { ChevronLeft, Check, Zap } from 'lucide-react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getGenderMascotSource } from '../../utils/genderMascot';

const { width: windowWidth, height: windowHeight } = Dimensions.get('window');
const width = Math.min(windowWidth, 480);
const screenHeight = Math.min(windowHeight, 800);

const COLORS = {
  brand: '#FF6B6B',
  brandDark: '#EE5253',
  ink: '#121212',
  white: '#FFFFFF',
  muted: '#94A3B8',
  bg: '#F8FAFC',
  accent: '#FFF1F1',
};

type WeeklyPlanRow = {
  Week?: number;
  'Week name'?: string;
  'Expected weight'?: number;
};

type Insight = {
  id: string;
  label: string;
  value: string;
  status: string;
  icon: keyof typeof Ionicons.glyphMap;
};

type Props = {
  onGeneratePlan: () => Promise<WeeklyPlanRow[]>;
  onGenerated: (plan: WeeklyPlanRow[]) => void;
  onBack: () => void;
  currentWeight: number | string;
  weightUnit: string;
  height: number | string;
  heightUnit: string;
  targetWeight?: number | string;
  gender?: string | null;
};

const STEP_DELAY = 10000;
const HOLDING_PROGRESS_PERCENT = 95;
const COMPLETION_PROGRESS_PERCENT = 100;

function parseWeightKg(weight: number | string, unit: string) {
  const numericWeight = Number(weight);
  if (!Number.isFinite(numericWeight) || numericWeight <= 0) return null;
  const normalizedUnit = String(unit).trim().toLowerCase();
  return normalizedUnit === 'kg' ? numericWeight : numericWeight * 0.45359237;
}

function parseHeightMeters(height: number | string, unit: string) {
  const normalizedUnit = String(unit).trim().toLowerCase();

  if (normalizedUnit === 'cm') {
    const numericHeight = Number(height);
    if (!Number.isFinite(numericHeight) || numericHeight <= 0) return null;
    return numericHeight / 100;
  }

  const rawHeight = String(height).trim();
  const imperialMatch = rawHeight.match(/(\d+)\s*'\s*(\d+)\s*"?/);
  if (!imperialMatch) return null;

  const feet = Number(imperialMatch[1]);
  const inches = Number(imperialMatch[2]);
  if (!Number.isFinite(feet) || !Number.isFinite(inches)) return null;

  const totalInches = feet * 12 + inches;
  return totalInches * 0.0254;
}

function classifyBmi(bmi: number) {
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Healthy';
  if (bmi < 30) return 'Overweight';
  return 'Obese';
}

export default function Phase18PlanSetup({
  onGeneratePlan,
  onGenerated,
  onBack,
  currentWeight,
  weightUnit,
  height: userHeight,
  heightUnit,
  targetWeight,
  gender,
}: Props) {
  const isCompact = screenHeight < 820;
  const [activeStep, setActiveStep] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressPercent, setProgressPercent] = useState(0);

  // Animations
  const mascotScale = useRef(new Animated.Value(1)).current;
  const progressWidth = useRef(new Animated.Value(0)).current;

  const insights = useMemo<Insight[]>(() => {
    const weightVal = `${currentWeight} ${weightUnit}`;
    const targetVal = targetWeight ? `${targetWeight} ${weightUnit}` : '--';
    const weightKg = parseWeightKg(currentWeight, weightUnit);
    const heightMeters = parseHeightMeters(userHeight, heightUnit);
    const bmi =
      weightKg !== null && heightMeters !== null
        ? weightKg / (heightMeters * heightMeters)
        : null;
    const bmiVal = bmi ? `${bmi.toFixed(1)} (${classifyBmi(bmi)})` : '--';
    
    return [
      { id: '1', label: 'Analyzing Baseline', value: weightVal, status: 'Completed', icon: 'barbell-outline' },
      { id: '2', label: 'Calculating BMI', value: bmiVal, status: 'Verified', icon: 'fitness-outline' },
      { id: '3', label: 'Mapping Target', value: targetVal, status: 'Aligned', icon: 'flag-outline' },
      { id: '4', label: 'Finalizing Routine', value: 'Adaptive Plan', status: 'Ready', icon: 'construct-outline' },
    ];
  }, [currentWeight, weightUnit, targetWeight, userHeight, heightUnit]);
  const mascotSource = useMemo(() => getGenderMascotSource(gender), [gender]);

  useEffect(() => {
    // Mascot Pulse loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(mascotScale, { toValue: 1.05, duration: 1500, useNativeDriver: true }),
        Animated.timing(mascotScale, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    ).start();

    startProcess();
  }, []);

  useEffect(() => {
    const listenerId = progressWidth.addListener(({ value }) => {
      setProgressPercent(Math.round(value));
    });

    return () => {
      progressWidth.removeListener(listenerId);
    };
  }, [progressWidth]);

  const animateProgressTo = (value: number, duration: number) =>
    new Promise<void>((resolve) => {
      Animated.timing(progressWidth, {
        toValue: value,
        duration,
        useNativeDriver: false,
      }).start(() => resolve());
    });

  const startProcess = async () => {
    setError(null);
    setIsDone(false);
    setActiveStep(0);
    progressWidth.setValue(0);

    try {
      // Start the plan generation in background
      const planPromise = onGeneratePlan();
      const perStepProgress = HOLDING_PROGRESS_PERCENT / insights.length;

      // Sequence the UI steps
      for (let i = 0; i < insights.length; i++) {
        setActiveStep(i);
        const targetProgress =
          i === insights.length - 1
            ? HOLDING_PROGRESS_PERCENT
            : Math.round((i + 1) * perStepProgress);
        await animateProgressTo(targetProgress, STEP_DELAY);
      }

      const plan = await planPromise;
      await animateProgressTo(COMPLETION_PROGRESS_PERCENT, 300);
      setActiveStep(insights.length);
      setIsDone(true);
      setTimeout(() => onGenerated(plan), 800);
    } catch (err: any) {
      setError(err?.message || 'AI Generation Timed Out');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <ChevronLeft color={COLORS.ink} size={28} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI COACHING</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollMain,
          isCompact && styles.scrollMainCompact,
        ]}
        showsVerticalScrollIndicator={false}
      >
        
        {/* Visual Focus */}
        <View style={[styles.visualSection, isCompact && styles.visualSectionCompact]}>
          <Animated.View
            style={[
              styles.mascotAura,
              isCompact && styles.mascotAuraCompact,
              { transform: [{ scale: mascotScale }] }
            ]}
          >
            <View style={styles.pulseRing3} />
            <View style={styles.pulseRing2} />
            <View style={styles.pulseRing1} />
            <Image 
              source={mascotSource}
              style={[styles.mascot, isCompact && styles.mascotCompact]}
              contentFit="contain"
            />
          </Animated.View>
          
          <View style={[styles.textStack, isCompact && styles.textStackCompact]}>
            <Text style={[styles.mainTitle, isCompact && styles.mainTitleCompact]}>
              {error ? 'Generation Failed' : isDone ? 'Plan Ready!' : 'Finalizing Your Plan'}
            </Text>
            <Text style={[styles.subTitle, isCompact && styles.subTitleCompact]}>
               {error ? 'Something went wrong. Let\'s try again.' : 'Our AI is fine-tuning every workout for your unique profile.'}
            </Text>
          </View>
        </View>

        {/* The New Modern Step List (Cards) */}
        <View style={[styles.stepGrid, isCompact && styles.stepGridCompact]}>
          {insights.map((step, index) => {
            const isPending = activeStep < index;
            const isActive = activeStep === index;
            const isCompleted = activeStep > index;

            return (
              <View 
                key={step.id} 
                style={[
                  styles.stepCard,
                  isCompact && styles.stepCardCompact,
                  isActive && styles.stepCardActive,
                  isCompleted && styles.stepCardDone
                ]}
              >
                <View style={[
                  styles.iconCircle,
                  isActive && { backgroundColor: COLORS.white },
                  isCompleted && { backgroundColor: COLORS.brand }
                ]}>
                  {isCompleted ? (
                    <Check color={COLORS.white} size={20} strokeWidth={3} />
                  ) : isActive ? (
                    <ActivityIndicator size="small" color={COLORS.brand} />
                  ) : (
                    <Ionicons name={step.icon} size={24} color={COLORS.muted} />
                  )}
                </View>

                <View style={styles.stepInfo}>
                  <Text style={[
                    styles.stepLabel,
                    (isActive || isCompleted) && { color: COLORS.ink, fontWeight: '800' }
                  ]}>
                    {step.label}
                  </Text>
                  {isCompleted || isActive ? (
                    <Text style={styles.stepValue}>{step.value}</Text>
                  ) : (
                    <Text style={styles.stepPending}>Waiting...</Text>
                  )}
                </View>

                {isCompleted && (
                  <View style={styles.doneBadge}>
                    <Text style={styles.doneText}>{step.status}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {error && (
          <TouchableOpacity style={styles.retryBtn} onPress={startProcess}>
            <LinearGradient colors={[COLORS.brand, COLORS.brandDark]} style={styles.retryGrad}>
              <Text style={styles.retryText}>Retry Generation</Text>
              <Zap color={COLORS.white} size={18} />
            </LinearGradient>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Modern Bottom Progress */}
      <View style={styles.footerContainer}>
        <View style={styles.progressLabelRow}>
            <Text style={styles.progressLabel}>AI Crafting Personalised Plan</Text>
            <Text style={styles.progressPercent}>{progressPercent}%</Text>
        </View>
        <View style={styles.progressTrack}>
          <Animated.View style={[
            styles.progressFill, 
            { width: progressWidth.interpolate({
              inputRange: [0, 100],
              outputRange: ['0%', '100%']
            }) }
          ]} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    paddingHorizontal: 16,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.muted,
    letterSpacing: 2,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  scrollMain: {
    flexGrow: 1,
    paddingBottom: 120,
  },
  scrollMainCompact: {
    paddingBottom: 108,
  },
  visualSection: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  visualSectionCompact: {
    marginTop: 8,
    marginBottom: 20,
  },
  mascotAura: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascotAuraCompact: {
    width: 168,
    height: 168,
  },
  mascot: {
    width: 140,
    height: 140,
    zIndex: 10,
  },
  mascotCompact: {
    width: 108,
    height: 108,
  },
  pulseRing1: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: COLORS.brand + '15',
  },
  pulseRing2: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: COLORS.brand + '08',
  },
  pulseRing3: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: COLORS.brand + '04',
  },
  textStack: {
    alignItems: 'center',
    marginTop: 10,
    paddingHorizontal: 40,
  },
  textStackCompact: {
    marginTop: 2,
    paddingHorizontal: 24,
  },
  mainTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.ink,
    textAlign: 'center',
    letterSpacing: -1,
  },
  mainTitleCompact: {
    fontSize: 26,
    lineHeight: 30,
  },
  subTitle: {
    fontSize: 15,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 22,
  },
  subTitleCompact: {
    fontSize: 13,
    marginTop: 6,
    lineHeight: 19,
  },
  stepGrid: {
    paddingHorizontal: 20,
    gap: 12,
  },
  stepGridCompact: {
    paddingHorizontal: 16,
    gap: 10,
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#F1F5F9',
  },
  stepCardCompact: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  stepCardActive: {
    borderColor: COLORS.brand,
    backgroundColor: COLORS.accent,
    shadowColor: COLORS.brand,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 5,
  },
  stepCardDone: {
    borderColor: '#E2E8F0',
    backgroundColor: COLORS.white,
    opacity: 0.9,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepInfo: {
    flex: 1,
    marginLeft: 16,
  },
  stepLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.muted,
  },
  stepValue: {
    fontSize: 14,
    color: COLORS.brand,
    fontWeight: '800',
    marginTop: 2,
  },
  stepPending: {
    fontSize: 12,
    color: '#CBD5E1',
    marginTop: 2,
    fontWeight: '600',
  },
  doneBadge: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  doneText: {
    color: '#15803D',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  footerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    paddingHorizontal: 30,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 25,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 10,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.ink,
    letterSpacing: 1,
  },
  progressPercent: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.brand,
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.brand,
    borderRadius: 4,
  },
  retryBtn: {
    marginHorizontal: 30,
    height: 64,
    marginTop: 30,
    borderRadius: 22,
    overflow: 'hidden',
  },
  retryGrad: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  retryText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '800',
  },
});
