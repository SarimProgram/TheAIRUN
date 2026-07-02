import React, { useState } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity,
  Dimensions, TextInput, ScrollView, SafeAreaView, Platform, Alert, ActivityIndicator
} from 'react-native';
import Animated, {
  FadeInRight, FadeOutLeft, FadeInDown,
} from 'react-native-reanimated';
import {
  ChevronRight, Heart, Zap, Timer,
  Activity, User, Map as MapIcon, ShieldCheck, ArrowLeft, Target,
  Flame, Calendar, Footprints, Clock
} from 'lucide-react-native';
import { useAuth } from '@/src/auth/authContext';
import { API_BASE_URL } from '../../config/api';

const { width } = Dimensions.get('window');

const THEME = {
  bg: '#FAFBFF',
  surface: '#FFFFFF',
  primary: '#FF6B81',
  secondary: '#2EC4B6',
  accent: '#706fd3',
  textMain: '#1A1C1E',
  textLight: '#6C757D',
  border: '#F1F3F5',
};

// Types for plan data
type GoalType = 'weightloss' | 'running' | 'both' | null;
type TimeHorizon = 'RELAXED' | 'STANDARD' | 'AGGRESSIVE' | 'SPECIFIC_DATE' | null;
type ActivityPreference = 'MOSTLY_WALKING' | 'WALKING_RUNNING' | 'MOSTLY_RUNNING' | null;
type IntensityLevel = 'STEADY' | 'ACTIVE' | 'PRO';

interface PlanData {
  // Basics
  weightKg: number | null;
  heightCm: number | null;
  ageYears: number | null;
  // Goal
  goalType: GoalType;
  // Weight loss specifics
  targetWeightKg: number | null;
  weightToLoseKg: number | null;
  timeHorizon: TimeHorizon;
  targetDate: string | null;
  activityPreference: ActivityPreference;
  // Strategy
  intensityLevel: IntensityLevel;
  // Generated
  dailyCalorieTarget: number | null;
  dailyActivityMins: number | null;
}

export default function RomanceOnboarding() {
  const { authFetch, isAuthenticated } = useAuth();

  const [step, setStep] = useState(1);
  const [subStep, setSubStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Plan data state
  const [planData, setPlanData] = useState<PlanData>({
    weightKg: null,
    heightCm: null,
    ageYears: null,
    goalType: null,
    targetWeightKg: null,
    weightToLoseKg: null,
    timeHorizon: null,
    targetDate: null,
    activityPreference: null,
    intensityLevel: 'ACTIVE',
    dailyCalorieTarget: null,
    dailyActivityMins: null,
  });

  // LOGIC: Total steps is 7 if Weight Loss (Path A), 4 otherwise.
  const isPathA = planData.goalType === 'weightloss';
  const totalSteps = isPathA ? 7 : 4;

  // Flattened step calculation for progress bar
  const getCurrentDisplayStep = () => {
    if (!isPathA) return step;
    if (step < 2) return step;
    if (step === 2) return 2 + subStep; // Goal screen is 2, Sub-steps are 3,4,5
    return step + 3; // Strategy is 6, Summary is 7
  };

  const currentDisplayStep = getCurrentDisplayStep();
  const progress = (currentDisplayStep / totalSteps) * 100;

  const handleNext = () => {
    if (isPathA && step === 2 && subStep < 3) {
      setSubStep(prev => prev + 1);
    } else {
      setStep(prev => Math.min(prev + 1, 4));
      setSubStep(0);
    }
  };

  const handleBack = () => {
    if (isPathA && step === 2 && subStep > 0) {
      setSubStep(prev => prev - 1);
    } else if (step > 1) {
      if (step === 3 && isPathA) {
        setStep(2);
        setSubStep(3);
      } else {
        setStep(prev => prev - 1);
        if (step === 2) setPlanData(prev => ({ ...prev, goalType: null }));
      }
    }
  };

  // Calculate recommended calorie target based on user data
  const calculatePlan = () => {
    const { weightKg, heightCm, ageYears, goalType, intensityLevel } = planData;
    if (!weightKg || !heightCm || !ageYears) return;

    // Basic BMR calculation (Mifflin-St Jeor)
    const bmr = 10 * weightKg + 6.25 * heightCm - 5 * ageYears + 5;

    // Activity multiplier based on intensity
    const activityMultipliers = { STEADY: 1.2, ACTIVE: 1.375, PRO: 1.55 };
    const tdee = bmr * activityMultipliers[intensityLevel];

    // Calorie adjustment based on goal
    let calorieTarget = Math.round(tdee);
    if (goalType === 'weightloss') {
      calorieTarget = Math.round(tdee - 500); // 500 calorie deficit
    } else if (goalType === 'both') {
      calorieTarget = Math.round(tdee);
    }

    // Activity minutes based on intensity
    const activityMins = { STEADY: 30, ACTIVE: 45, PRO: 60 };

    setPlanData(prev => ({
      ...prev,
      dailyCalorieTarget: calorieTarget,
      dailyActivityMins: activityMins[intensityLevel],
    }));
  };

  // Save plan to backend
  const savePlanToBackend = async () => {
    if (!isAuthenticated) {
      Alert.alert('Login Required', 'Please log in to save your plan.');
      return;
    }

    if (!planData.weightKg || !planData.heightCm || !planData.ageYears || !planData.goalType) {
      Alert.alert('Error', 'Please complete all required fields.');
      return;
    }

    setLoading(true);
    try {
      const response = await authFetch(`${API_BASE_URL}/plan`, {
        method: 'POST',
        body: JSON.stringify({
          weightKg: planData.weightKg,
          heightCm: planData.heightCm,
          ageYears: planData.ageYears,
          goalType: planData.goalType,
          targetWeightKg: planData.targetWeightKg,
          weightToLoseKg: planData.weightToLoseKg,
          timeHorizon: planData.timeHorizon,
          targetDate: planData.targetDate,
          activityPreference: planData.activityPreference,
          intensityLevel: planData.intensityLevel,
          dailyCalorieTarget: planData.dailyCalorieTarget,
          dailyActivityMins: planData.dailyActivityMins,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to save plan');
      }

      Alert.alert('Success!', 'Your personalized plan has been saved. Let\'s get started!');
    } catch (error: any) {
      console.error('Error saving plan:', error);
      Alert.alert('Error', error.message || 'Failed to save plan. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleStart = () => {
    calculatePlan();
    savePlanToBackend();
  };

  // Update handlers for child components
  const updateBasics = (weight: number, height: number, age: number) => {
    setPlanData(prev => ({
      ...prev,
      weightKg: weight,
      heightCm: height,
      ageYears: age,
    }));
    handleNext();
  };

  const updateGoal = (goal: string) => {
    const goalTypeMap: Record<string, GoalType> = {
      'Weight Loss': 'weightloss',
      'Performance': 'running',
      'Balanced': 'both',
    };
    setPlanData(prev => ({ ...prev, goalType: goalTypeMap[goal] || null }));

    if (goal === 'Weight Loss') {
      setSubStep(1);
    } else {
      handleNext();
    }
  };

  const updateWeightGoal = (targetWeight: number | null, weightToLose: number | null) => {
    setPlanData(prev => ({
      ...prev,
      targetWeightKg: targetWeight,
      weightToLoseKg: weightToLose,
    }));
    handleNext();
  };

  const updateTimeHorizon = (horizon: TimeHorizon, targetDate?: string) => {
    setPlanData(prev => ({
      ...prev,
      timeHorizon: horizon,
      targetDate: targetDate || null,
    }));
    handleNext();
  };

  const updateActivityPreference = (preference: ActivityPreference) => {
    setPlanData(prev => ({ ...prev, activityPreference: preference }));
    handleNext();
  };

  const updateIntensity = (intensity: IntensityLevel) => {
    setPlanData(prev => ({ ...prev, intensityLevel: intensity }));
    // Calculate plan when strategy is updated
    const { weightKg, heightCm, ageYears, goalType } = planData;
    if (weightKg && heightCm && ageYears && goalType) {
      const bmr = 10 * weightKg + 6.25 * heightCm - 5 * ageYears + 5;
      const activityMultipliers = { STEADY: 1.2, ACTIVE: 1.375, PRO: 1.55 };
      const tdee = bmr * activityMultipliers[intensity];
      let calorieTarget = Math.round(tdee);
      if (goalType === 'weightloss') calorieTarget = Math.round(tdee - 500);
      const activityMins = { STEADY: 30, ACTIVE: 45, PRO: 60 };

      setPlanData(prev => ({
        ...prev,
        intensityLevel: intensity,
        dailyCalorieTarget: calorieTarget,
        dailyActivityMins: activityMins[intensity],
      }));
    }
    handleNext();
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* --- HEADER --- */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <ArrowLeft size={20} color={THEME.textMain} />
          </TouchableOpacity>

          <View style={styles.progressContainer}>
            <View style={styles.progressBg}>
              <Animated.View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.progressText}>Step {currentDisplayStep} of {totalSteps}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {step === 1 && <BasicsScreen onNext={updateBasics} />}

          {step === 2 && subStep === 0 && (
            <GoalScreen onSelect={updateGoal} />
          )}

          {/* PATH A BRANCHING */}
          {isPathA && step === 2 && (
            <>
              {subStep === 1 && <WeightGoalScreen onNext={updateWeightGoal} />}
              {subStep === 2 && <TimeHorizonScreen onNext={updateTimeHorizon} />}
              {subStep === 3 && <ActivityPreferenceScreen onNext={updateActivityPreference} />}
            </>
          )}

          {step === 3 && <StrategyScreen onNext={updateIntensity} currentIntensity={planData.intensityLevel} />}
          {step === 4 && (
            <SummaryScreen
              onStart={handleStart}
              loading={loading}
              dailyCalories={planData.dailyCalorieTarget || 1940}
              dailyMins={planData.dailyActivityMins || 45}
            />
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// --- PATH A1: WEIGHT GOAL ---
const WeightGoalScreen = ({ onNext }: { onNext: (targetWeight: number | null, weightToLose: number | null) => void }) => {
  const [mode, setMode] = useState<'target' | 'loss'>('target');
  const [value, setValue] = useState('');

  const handleNext = () => {
    const numValue = parseFloat(value) || null;
    if (mode === 'target') {
      onNext(numValue, null);
    } else {
      onNext(null, numValue);
    }
  };

  return (
    <Animated.View entering={FadeInRight} style={styles.contentBody}>
      <Text style={styles.subHeader}>PATH A1: TARGET</Text>
      <Text style={styles.heroTitle}>Define your{'\n'}<Text style={{ color: THEME.primary }}>Goal.</Text></Text>
      <View style={styles.toggleRow}>
        <TouchableOpacity style={[styles.toggleBtn, mode === 'target' && styles.toggleActive]} onPress={() => setMode('target')}>
          <Text style={[styles.toggleText, mode === 'target' && styles.toggleTextActive]}>Target Weight</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.toggleBtn, mode === 'loss' && styles.toggleActive]} onPress={() => setMode('loss')}>
          <Text style={[styles.toggleText, mode === 'loss' && styles.toggleTextActive]}>Target Fat Loss</Text>
        </TouchableOpacity>
      </View>
      <ModernInput
        label={mode === 'target' ? "What is your goal weight?" : "How many kg to lose?"}
        unit="kg"
        placeholder="65"
        icon={<Flame size={20} color={THEME.primary} />}
        value={value}
        onChangeText={setValue}
      />
      <TouchableOpacity style={styles.primaryBtn} onPress={handleNext}>
        <Text style={styles.primaryBtnText}>Next: Choose Timeline</Text>
        <ChevronRight color="white" size={20} />
      </TouchableOpacity>
    </Animated.View>
  );
};

// --- PATH A2: TIME HORIZON (WITH DATE PICKER) ---
const TimeHorizonScreen = ({ onNext }: { onNext: (horizon: TimeHorizon, targetDate?: string) => void }) => {
  const [selected, setSelected] = useState<string>('Standard');
  const [dateValue, setDateValue] = useState('');

  const horizons = [
    { t: 'Relaxed', d: 'Sustainable & steady', c: THEME.secondary, value: 'RELAXED' as TimeHorizon },
    { t: 'Standard', d: 'The recommended pace', c: THEME.primary, value: 'STANDARD' as TimeHorizon },
    { t: 'Aggressive', d: 'Advanced & intense', c: THEME.accent, value: 'AGGRESSIVE' as TimeHorizon },
    { t: 'Specific Date', d: 'Set a target deadline', c: THEME.textMain, value: 'SPECIFIC_DATE' as TimeHorizon },
  ];

  const handleConfirm = () => {
    const selectedHorizon = horizons.find(h => h.t === selected);
    if (selected === 'Specific Date' && dateValue) {
      onNext(selectedHorizon?.value || 'STANDARD', dateValue);
    } else {
      onNext(selectedHorizon?.value || 'STANDARD');
    }
  };

  return (
    <Animated.View entering={FadeInRight} style={styles.contentBody}>
      <Text style={styles.subHeader}>PATH A2: HORIZON</Text>
      <Text style={styles.heroTitle}>How fast{'\n'}<Text style={{ color: THEME.accent }}>is the race?</Text></Text>

      <View style={{ gap: 10 }}>
        {horizons.map((item) => (
          <TouchableOpacity
            key={item.t}
            style={[styles.optionCard, selected === item.t && { borderColor: item.c, borderWidth: 2 }]}
            onPress={() => setSelected(item.t)}
          >
            <View style={[styles.miniIcon, { backgroundColor: item.c + '15' }]}>
              <Calendar size={18} color={item.c} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.optionTitle}>{item.t}</Text>
              <Text style={styles.optionDesc}>{item.d}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {selected === 'Specific Date' && (
        <Animated.View entering={FadeInDown} style={styles.dateInputContainer}>
          <Clock size={18} color={THEME.textLight} />
          <TextInput
            style={styles.dateInput}
            placeholder="DD / MM / YYYY"
            placeholderTextColor="#ADB5BD"
            keyboardType="numeric"
            value={dateValue}
            onChangeText={setDateValue}
          />
        </Animated.View>
      )}

      <TouchableOpacity style={styles.primaryBtn} onPress={handleConfirm}>
        <Text style={styles.primaryBtnText}>Confirm Timeline</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

// --- PATH A3: ACTIVITY PREFERENCE ---
const ActivityPreferenceScreen = ({ onNext }: { onNext: (preference: ActivityPreference) => void }) => (
  <Animated.View entering={FadeInRight} style={styles.contentBody}>
    <Text style={styles.subHeader}>PATH A3: ACTIVITY</Text>
    <Text style={styles.heroTitle}>Choose your{'\n'}<Text style={{ color: THEME.secondary }}>Style.</Text></Text>
    <View style={{ gap: 16 }}>
      <GoalCard title="Mostly Walking" desc="Low impact, high consistency" icon={<Footprints color="white" size={24} />} color={THEME.secondary} onPress={() => onNext('MOSTLY_WALKING')} />
      <GoalCard title="Walking + Running" desc="Intervals to build stamina" icon={<Activity color="white" size={24} />} color={THEME.accent} onPress={() => onNext('WALKING_RUNNING')} />
      <GoalCard title="Mostly Running" desc="High calorie burn & cardio" icon={<Clock color="white" size={24} />} color={THEME.primary} onPress={() => onNext('MOSTLY_RUNNING')} />
    </View>
  </Animated.View>
);

// --- REUSED COMPONENTS ---
const BasicsScreen = ({ onNext }: { onNext: (weight: number, height: number, age: number) => void }) => {
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [age, setAge] = useState('');

  const handleContinue = () => {
    const w = parseFloat(weight) || 70;
    const h = parseFloat(height) || 170;
    const a = parseInt(age) || 25;
    onNext(w, h, a);
  };

  return (
    <Animated.View entering={FadeInRight} style={styles.contentBody}>
      <Text style={styles.subHeader}>GETTING STARTED</Text>
      <Text style={styles.heroTitle}>The Body{'\n'}<Text style={{ color: THEME.primary }}>Blueprint.</Text></Text>
      <View style={styles.inputGrid}>
        <ModernInput label="Weight" unit="kg" placeholder="70" icon={<Activity size={20} color={THEME.primary} />} value={weight} onChangeText={setWeight} />
        <ModernInput label="Height" unit="cm" placeholder="180" icon={<MapIcon size={20} color={THEME.secondary} />} value={height} onChangeText={setHeight} />
        <ModernInput label="Age" unit="yrs" placeholder="24" icon={<User size={20} color={THEME.accent} />} value={age} onChangeText={setAge} />
      </View>
      <TouchableOpacity style={styles.primaryBtn} onPress={handleContinue}>
        <Text style={styles.primaryBtnText}>Continue</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const GoalScreen = ({ onSelect }: { onSelect: (goal: string) => void }) => (
  <Animated.View entering={FadeInRight} style={styles.contentBody}>
    <Text style={styles.subHeader}>YOUR VISION</Text>
    <Text style={styles.heroTitle}>Choose your{'\n'}<Text style={{ color: THEME.secondary }}>Focus.</Text></Text>
    <View style={{ gap: 16 }}>
      <GoalCard title="Weight Loss" desc="Focus on fat burning & tone" icon={<Heart color="white" fill="white" size={24} />} color={THEME.primary} onPress={() => onSelect('Weight Loss')} />
      <GoalCard title="Endurance" desc="Level up your stamina" icon={<Zap color="white" fill="white" size={24} />} color={THEME.secondary} onPress={() => onSelect('Performance')} />
      <GoalCard title="Maintenance" desc="Steady healthy lifestyle" icon={<Target color="white" size={24} />} color={THEME.textMain} onPress={() => onSelect('Balanced')} />
    </View>
  </Animated.View>
);

const StrategyScreen = ({ onNext, currentIntensity }: { onNext: (intensity: IntensityLevel) => void; currentIntensity: IntensityLevel }) => {
  const [selected, setSelected] = useState<IntensityLevel>(currentIntensity);

  return (
    <Animated.View entering={FadeInRight} style={styles.contentBody}>
      <Text style={styles.subHeader}>STRATEGY</Text>
      <Text style={styles.heroTitle}>Set the{'\n'}<Text style={{ color: THEME.primary }}>Pace.</Text></Text>
      <View style={styles.strategyBox}>
        <Text style={styles.strategyLabel}>Intensity Level</Text>
        <View style={styles.intensityRow}>
          {(['STEADY', 'ACTIVE', 'PRO'] as IntensityLevel[]).map((level) => (
            <TouchableOpacity
              key={level}
              style={[styles.intensityPill, selected === level && styles.activePill]}
              onPress={() => setSelected(level)}
            >
              <Text style={[styles.intensityText, selected === level && { color: 'white' }]}>
                {level === 'STEADY' ? 'Steady' : level === 'ACTIVE' ? 'Active' : 'Pro'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.strategyHint}>Active is recommended for most people starting out.</Text>
      </View>
      <TouchableOpacity style={styles.primaryBtn} onPress={() => onNext(selected)}>
        <Text style={styles.primaryBtnText}>Generate My Plan</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const SummaryScreen = ({ onStart, loading, dailyCalories, dailyMins }: { onStart: () => void; loading: boolean; dailyCalories: number; dailyMins: number }) => (
  <Animated.View entering={FadeInDown} style={styles.contentBody}>
    <View style={styles.summaryCard}>
      <View style={styles.successIconBox}><ShieldCheck color="white" size={40} /></View>
      <Text style={styles.summaryTitle}>Perfectly Tailored.</Text>
      <Text style={styles.summarySub}>Your roadmap to success is ready.</Text>
      <View style={styles.statsContainer}>
        <View style={styles.statBox}><Text style={styles.statNum}>{dailyCalories.toLocaleString()}</Text><Text style={styles.statTag}>Daily Kcal</Text></View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}><Text style={[styles.statNum, { color: THEME.secondary }]}>{dailyMins}m</Text><Text style={styles.statTag}>Daily Goal</Text></View>
      </View>
      <TouchableOpacity
        style={[styles.primaryBtn, { width: '100%' }, loading && { opacity: 0.7 }]}
        onPress={onStart}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.primaryBtnText}>Start Training</Text>
        )}
      </TouchableOpacity>
    </View>
  </Animated.View>
);

// --- HELPERS ---
const ModernInput = ({ label, unit, icon, placeholder, value, onChangeText }: {
  label: string;
  unit: string;
  icon: React.ReactNode;
  placeholder: string;
  value?: string;
  onChangeText?: (text: string) => void;
}) => (
  <View style={styles.modernInputContainer}>
    <View style={styles.inputHeader}><View style={styles.miniIcon}>{icon}</View><Text style={styles.inputLabel}>{label}</Text></View>
    <View style={styles.inputWrapper}>
      <TextInput
        style={styles.mainInput}
        placeholder={placeholder}
        placeholderTextColor="#CED4DA"
        keyboardType="numeric"
        value={value}
        onChangeText={onChangeText}
      />
      <Text style={styles.unitText}>{unit}</Text>
    </View>
  </View>
);

const GoalCard = ({ title, desc, icon, color, onPress }: {
  title: string;
  desc: string;
  icon: React.ReactNode;
  color: string;
  onPress: () => void;
}) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={styles.goalCard}>
    <View style={[styles.goalIconBox, { backgroundColor: color }]}>{icon}</View>
    <View style={{ flex: 1, marginLeft: 16 }}>
      <Text style={styles.goalCardTitle}>{title}</Text>
      <Text style={styles.goalCardDesc}>{desc}</Text>
    </View>
    <View style={styles.arrowCircle}><ChevronRight size={18} color={THEME.textLight} /></View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, height: 60 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: THEME.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: THEME.border },
  progressContainer: { flex: 1, alignItems: 'center', paddingHorizontal: 40 },
  progressBg: { width: '100%', height: 6, backgroundColor: '#E9ECEF', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: THEME.secondary },
  progressText: { fontSize: 10, fontWeight: '700', color: THEME.textLight, marginTop: 4, letterSpacing: 0.5 },
  scrollContent: { padding: 24, paddingTop: 10 },
  contentBody: { gap: 20 },
  subHeader: { fontSize: 12, fontWeight: '800', color: THEME.primary, letterSpacing: 1.5 },
  heroTitle: { fontSize: 36, fontWeight: '900', color: THEME.textMain, letterSpacing: -1, lineHeight: 40 },
  toggleRow: { flexDirection: 'row', backgroundColor: '#F1F3F5', padding: 4, borderRadius: 16 },
  toggleBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12 },
  toggleActive: { backgroundColor: 'white', elevation: 2 },
  toggleText: { fontSize: 13, fontWeight: '700', color: THEME.textLight },
  toggleTextActive: { color: THEME.textMain },
  optionCard: { backgroundColor: THEME.surface, padding: 14, borderRadius: 20, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: THEME.border },
  optionTitle: { fontSize: 16, fontWeight: '800', color: THEME.textMain },
  optionDesc: { fontSize: 13, color: THEME.textLight, fontWeight: '500' },
  dateInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.surface, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: THEME.primary },
  dateInput: { flex: 1, marginLeft: 12, fontSize: 18, fontWeight: '700', color: THEME.textMain },
  inputGrid: { gap: 12 },
  modernInputContainer: { backgroundColor: THEME.surface, padding: 16, borderRadius: 24, borderWidth: 1, borderColor: THEME.border },
  inputHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  miniIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: THEME.bg, alignItems: 'center', justifyContent: 'center' },
  inputLabel: { fontSize: 13, fontWeight: '700', color: THEME.textLight, marginLeft: 10 },
  inputWrapper: { flexDirection: 'row', alignItems: 'baseline' },
  mainInput: { fontSize: 32, fontWeight: '800', color: THEME.textMain, flex: 1, padding: 0 },
  unitText: { fontSize: 16, fontWeight: '700', color: THEME.textLight, marginLeft: 8 },
  goalCard: { backgroundColor: THEME.surface, padding: 18, borderRadius: 28, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: THEME.border },
  goalIconBox: { width: 56, height: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  goalCardTitle: { fontSize: 18, fontWeight: '800', color: THEME.textMain },
  goalCardDesc: { fontSize: 14, color: THEME.textLight, fontWeight: '500', marginTop: 2 },
  arrowCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: THEME.bg, alignItems: 'center', justifyContent: 'center' },
  primaryBtn: { height: 64, backgroundColor: THEME.textMain, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  primaryBtnText: { color: 'white', fontSize: 18, fontWeight: '800' },
  strategyBox: { backgroundColor: THEME.surface, padding: 24, borderRadius: 32, gap: 16 },
  strategyLabel: { fontSize: 14, fontWeight: '800', color: THEME.textMain },
  intensityRow: { flexDirection: 'row', gap: 10 },
  intensityPill: { flex: 1, height: 48, borderRadius: 16, backgroundColor: THEME.bg, alignItems: 'center', justifyContent: 'center' },
  activePill: { backgroundColor: THEME.secondary },
  intensityText: { fontWeight: '700', color: THEME.textLight },
  strategyHint: { fontSize: 12, color: THEME.textLight, textAlign: 'center', lineHeight: 18 },
  summaryCard: { backgroundColor: THEME.surface, borderRadius: 40, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: THEME.border },
  successIconBox: { width: 80, height: 80, borderRadius: 30, backgroundColor: THEME.secondary, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  summaryTitle: { fontSize: 28, fontWeight: '900', color: THEME.textMain, textAlign: 'center' },
  summarySub: { fontSize: 15, color: THEME.textLight, textAlign: 'center', marginTop: 10, lineHeight: 22 },
  statsContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 30, backgroundColor: THEME.bg, padding: 20, borderRadius: 24 },
  statBox: { alignItems: 'center', flex: 1 },
  statNum: { fontSize: 24, fontWeight: '900', color: THEME.primary },
  statTag: { fontSize: 12, fontWeight: '700', color: THEME.textLight, marginTop: 4 },
  statDivider: { width: 1, height: 40, backgroundColor: '#DDD', marginHorizontal: 20 }
});
