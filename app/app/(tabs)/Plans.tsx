import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  Modal,
  PanResponder,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Footprints, Droplets, Flame, X,
  Sun, Sunset, Moon, Check, Zap, Activity, ChevronDown, ChevronUp, Plus
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@/src/auth/authContext';
import { API_BASE_URL } from '../../config/api';
import { useDailySummary } from '../../hooks/useDailySummary';
import { useLocalDailySteps } from '../../hooks/useHealthSteps';
import { useWaterSync } from '../../hooks/useWaterSync';
import { useTabBar } from '../../contexts/TabBarContext';

// Components
import { PlanWeeklyTab, WeekPlan } from '../../components/plan/PlanWeeklyTab';
import { MobilityExercises } from '../../components/plan/MobilityExercises';
import { useDailyPoints } from '../../hooks/useDailyPoints';
import { PointsProgressCard } from '../../components/plan/PointsProgressCard';
import { getMappedDays } from '../../utils/planProjection';
import { getRunMeta } from '../../constants/runDetails';
import { getIntervalWorkoutRouteFromTemplateId } from '../../lib/interval-workout';
import { PlanHero, COLORS, RunStatusMap } from '../../components/plan/PlanHero';
import { DailyTab, DailyTargetFromAPI } from '../../components/plan/DailyTab';
const { width } = Dimensions.get('window');
const TRAINING_TIME_PREFERENCE_KEY = 'plans_training_time_preference_v1';
const STEPS_PER_KM = 1250;
const GOAL_PRACTICE_RUN_TYPE = 'Goal Practice Run';

// --- SUB-COMPONENTS ---

// Minimal Task Item for the schedule lists
const MinimalTaskRow = ({ icon, label, value, target, unit, isComplete, color, onPress, onAdd, showAdd }: any) => (
  <TouchableOpacity
    style={styles.minimalTaskRow}
    onPress={onPress}
    activeOpacity={onPress ? 0.7 : 1}
    disabled={!onPress}
  >
    <View style={[styles.minimalIconBg, { backgroundColor: `${color}15` }]}>
      {React.cloneElement(icon, { color: color, size: 16 })}
    </View>
    <View style={styles.minimalTaskContent}>
      <Text style={styles.minimalTaskLabel}>{label}</Text>
      <Text style={styles.minimalTaskValue}>
        <Text style={{ color: isComplete ? COLORS.success : COLORS.textMain, fontWeight: '800' }}>
          {value.toLocaleString()}
        </Text>
        <Text style={{ color: COLORS.textSub }}> / {target.toLocaleString()} {unit}</Text>
      </Text>
    </View>
    {showAdd ? (
      <TouchableOpacity
        style={[styles.miniAddBtn, { backgroundColor: `${color}20` }]}
        onPress={onAdd}
      >
        <Plus size={16} color={color} strokeWidth={3} />
      </TouchableOpacity>
    ) : (
      <View style={[styles.miniStatusDot, isComplete && { backgroundColor: COLORS.success }]}>
        {isComplete && <Check size={10} color="#FFF" strokeWidth={4} />}
      </View>
    )}
  </TouchableOpacity>
);

// Hydration with water icons
const HydrationIcons = ({ current, total, color, onTap }: any) => (
  <View style={styles.hydrationIconRow}>
    {[...Array(total)].map((_, i) => (
      <TouchableOpacity
        key={i}
        onPress={() => onTap(i + 1)}
        style={styles.hydrationIconBtn}
      >
        <Droplets
          size={22}
          color={i < current ? color : '#E0E0E0'}
          fill={i < current ? color : 'transparent'}
          strokeWidth={2}
        />
      </TouchableOpacity>
    ))}
  </View>
);

// Types for daily targets from backend
type DailyTarget = {
  dayOfWeek: number;
  dayName: string;
  dayType: 'STEP' | 'RUN' | 'RECOVERY';
  calorieTarget: number;
  proteinTarget: number;
  stepsTarget: number;
  runKm: number;
  runType: string | null;
  sessionId?: string | null; // Link to the generated RunSession from the plan
  timeSlots: {
    morning: { steps: number };
    afternoon?: { steps: number };
    evening: { steps: number };
    night?: { steps: number };
  };
};

type TrainingPlanSession = {
  id: string;
  week: number;
  runType: string;
  targetKm: number;
  stepsJson?: unknown;
};

export default function TimelinePlanScreen() {
  const { authFetch, isAuthenticated, accessToken, user } = useAuth();
  const router = useRouter();

  // Selected date state (defaults to today)
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  // Real-time hydration sync for today
  const { glassCount: todayGlassCount, logWater } = useWaterSync({ accessToken });

  // Helper to format date as YYYY-MM-DD for backend
  const formatDayKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Check if selected date is today
  const now = new Date();
  const isToday = formatDayKey(selectedDate) === formatDayKey(now);

  // Fetch real daily summary data from backend for selected date
  const selectedDayKey = formatDayKey(selectedDate);
  const { summary, loading: summaryLoading, refetch: refetchSummary } = useDailySummary({
    accessToken,
    dayKey: isToday ? undefined : selectedDayKey // Use today endpoint for today, specific date otherwise
  });

  const [weeklyPlan, setWeeklyPlan] = useState<WeekPlan[]>([]);
  const [latestPlanPrompt, setLatestPlanPrompt] = useState<string | null>(null);
  const [availableDays, setAvailableDays] = useState<number[]>([0, 2, 4]);
  const [dailyTargets, setDailyTargets] = useState<DailyTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [planLoading, setPlanLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [scheduleUpdating, setScheduleUpdating] = useState(false);
  const [showWeeklyModal, setShowWeeklyModal] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<WeekPlan | null>(null);
  const [scheduleExpanded, setScheduleExpanded] = useState(true);
  const [mobilityModalVisible, setMobilityModalVisible] = useState(false);
  const [showRunDetails, setShowRunDetails] = useState(false);
  const [runDetailsExpanded, setRunDetailsExpanded] = useState({
    benefits: true,
    experts: true,
    phases: true,
    tips: false,
  });
  const [currentWeek, setCurrentWeek] = useState(1);
  const [allPlanSessions, setAllPlanSessions] = useState<TrainingPlanSession[]>([]);
  const [planStartDate, setPlanStartDate] = useState<Date | null>(null);
  const todayWeekRef = useRef(1);
  const currentWeekAnchorDateRef = useRef<Date | null>(null);
  const [runStatuses, setRunStatuses] = useState<RunStatusMap>({});
  const [mobilityCompleted, setMobilityCompleted] = useState(false);
  const [trainingTimePreference, setTrainingTimePreference] = useState<'morning' | 'afternoon' | 'evening'>('morning');
  const [userGender, setUserGender] = useState<string | null>(
    typeof user?.gender === 'string' ? user.gender : null
  );
  const hasLoadedTrainingTimePreference = useRef(false);
  const { setTabBarVisible } = useTabBar();

  // Get current hour for time period (only relevant for today)
  const currentHour = now.getHours();
  const currentPeriod = isToday
    ? (currentHour < 12 ? 'morning' : currentHour < 18 ? 'afternoon' : 'evening')
    : 'evening'; // For past days, show all periods as complete

  // Get selected date's day of week (0 = Monday, 6 = Sunday to match backend)
  const selectedDayOfWeek = (selectedDate.getDay() + 6) % 7;
  const todayDayOfWeek = (now.getDay() + 6) % 7;

  // Get selected day's target from dailyTargets
  const todayTarget = dailyTargets.find(d => d.dayOfWeek === selectedDayOfWeek);

  // Day labels for schedule (still needed by schedule section)
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  const getMondayForDate = useCallback((date: Date) => {
    const monday = new Date(date);
    const day = (monday.getDay() + 6) % 7; // Mon=0, Sun=6
    monday.setDate(monday.getDate() - day);
    monday.setHours(0, 0, 0, 0);
    return monday;
  }, []);

  const calculateWeekNum = useCallback((date: Date, start: Date) => {
    // Normalize both dates to their respective Monday of the week (ISO week starts Monday)
    const startMon = getMondayForDate(new Date(start));
    const currentMon = getMondayForDate(new Date(date));

    // Calculate difference in weeks
    const diffTime = currentMon.getTime() - startMon.getTime();
    const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));

    return Math.max(1, diffWeeks + 1);
  }, [getMondayForDate]);

  const calculateWeekFromAnchor = useCallback((date: Date, anchorDate: Date, anchorWeek: number) => {
    const anchorMonday = getMondayForDate(anchorDate);
    const selectedMonday = getMondayForDate(date);
    const diffTime = selectedMonday.getTime() - anchorMonday.getTime();
    const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
    return Math.max(1, anchorWeek + diffWeeks);
  }, [getMondayForDate]);

  const calculatePlanDayNumber = useCallback((date: Date, start: Date) => {
    const current = new Date(date);
    const planStart = new Date(start);
    current.setHours(0, 0, 0, 0);
    planStart.setHours(0, 0, 0, 0);

    const diffDays = Math.floor((current.getTime() - planStart.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(1, diffDays + 1);
  }, []);

  // Navigation functions
  const goToNextDay = () => {
    const nextDay = new Date(selectedDate);
    nextDay.setDate(selectedDate.getDate() + 1);
    setSelectedDate(nextDay);
  };

  const goToPreviousDay = () => {
    const prevDay = new Date(selectedDate);
    prevDay.setDate(selectedDate.getDate() - 1);
    setSelectedDate(prevDay);
  };

  const goToNextWeek = () => {
    const nextWeekDate = new Date(selectedDate);
    nextWeekDate.setDate(selectedDate.getDate() + 7);
    setSelectedDate(nextWeekDate);
  };

  const goToPreviousWeek = () => {
    if (currentWeek <= 1) return;
    const prevWeekDate = new Date(selectedDate);
    prevWeekDate.setDate(selectedDate.getDate() - 7);
    setSelectedDate(prevWeekDate);
  };

  const selectDay = (date: Date) => {
    setSelectedDate(date);
  };

  const handleGoToToday = () => {
    setSelectedDate(new Date());
  };

  const openWeeklyModal = useCallback(() => {
    const activeWeek = weeklyPlan.find((week) => week.Week === currentWeek) ?? null;
    setSelectedWeek(activeWeek);
    setShowWeeklyModal(true);
  }, [weeklyPlan, currentWeek]);

  const handleLogFoodForPeriod = useCallback((period: 'morning' | 'afternoon' | 'evening') => {
    const mealType = period === 'morning' ? 'BREAKFAST' : period === 'afternoon' ? 'LUNCH' : 'DINNER';
    router.push({
      pathname: '/activity',
      params: { action: 'logFood', mealType, t: Date.now() },
    });
  }, [router]);

  // PanResponder for swipe gestures
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to horizontal swipes with significant movement
        return Math.abs(gestureState.dx) > 20 && Math.abs(gestureState.dy) < 50;
      },
      onPanResponderRelease: (_, gestureState) => {
        const swipeThreshold = 50;
        if (gestureState.dx > swipeThreshold) {
          // Swiped right = previous day
          goToPreviousDay();
        } else if (gestureState.dx < -swipeThreshold) {
          // Swiped left = next day
          goToNextDay();
        }
      },
    })
  ).current;

  // --- TARGETS FROM BACKEND (use todayTarget or fallback to defaults) ---
  const totalDailyCalories = todayTarget?.calorieTarget || 2200;
  const totalDailySteps = todayTarget?.stepsTarget || 10000;
  const totalDailyWater = 8;

  // Time slots from backend
  const morningStepsTarget = todayTarget?.timeSlots?.morning?.steps || Math.round(totalDailySteps * 0.40);
  const afternoonStepsTarget = todayTarget?.timeSlots?.afternoon?.steps || todayTarget?.timeSlots?.evening?.steps || Math.round(totalDailySteps * 0.35);
  const eveningStepsTarget = todayTarget?.timeSlots?.night?.steps || (todayTarget?.timeSlots?.afternoon ? todayTarget?.timeSlots?.evening?.steps : undefined) || (totalDailySteps - morningStepsTarget - afternoonStepsTarget);

  // Calorie splits (40/35/25 for now, could be from backend later)
  const morningCalorieTarget = Math.round(totalDailyCalories * 0.40);
  const afternoonCalorieTarget = Math.round(totalDailyCalories * 0.35);
  const eveningCalorieTarget = totalDailyCalories - morningCalorieTarget - afternoonCalorieTarget;

  // --- CURRENT VALUES FROM BACKEND ---
  const totalStepsFromBackend = summary?.steps ?? 0;
  const totalCaloriesFromBackend = summary?.consumedCalories ?? 0;

  // --- LOCAL HEALTH STEPS (Real Buckets) ---
  const { 
    morning: morningStepsLocal, 
    afternoon: afternoonStepsLocal, 
    evening: eveningStepsLocal, 
    total: totalStepsLocal 
  } = useLocalDailySteps(selectedDate, accessToken);
  
  // Use local steps if available (bucketing is better), otherwise fallback to backend (but backend has no buckets)
  // Since user wants specific phase visibility, we prefer local.
  // If local is 0 and backend is > 0 (e.g. manual entry), we might want to fallback, 
  // but for "Apple Health" sync, local is the source.
  const usingLocalSteps = totalStepsLocal > 0 || isToday; // Prefer local for today to get real-time updates
  
  const morningStepsActual = usingLocalSteps ? morningStepsLocal : (currentPeriod === 'morning' ? totalStepsFromBackend : Math.round(totalStepsFromBackend * 0.40));
  const afternoonStepsActual = usingLocalSteps ? afternoonStepsLocal : (currentPeriod === 'morning' ? 0 : currentPeriod === 'afternoon' ? totalStepsFromBackend - morningStepsActual : Math.round(totalStepsFromBackend * 0.35));
  const eveningStepsActual = usingLocalSteps ? eveningStepsLocal : (currentPeriod === 'evening' ? totalStepsFromBackend - morningStepsActual - afternoonStepsActual : 0);

  // Distribute calories based on current period
  const morningCaloriesActual = currentPeriod === 'morning'
    ? totalCaloriesFromBackend
    : Math.round(totalCaloriesFromBackend * 0.40);
  const afternoonCaloriesActual = currentPeriod === 'morning'
    ? 0
    : currentPeriod === 'afternoon'
      ? totalCaloriesFromBackend - morningCaloriesActual
      : Math.round(totalCaloriesFromBackend * 0.35);
  const eveningCaloriesActual = currentPeriod === 'evening'
    ? totalCaloriesFromBackend - morningCaloriesActual - afternoonCaloriesActual
    : 0;

  // Water tracking
  const waterActual = isToday ? todayGlassCount : (summary?.waterMl ? Math.floor(summary.waterMl / 250) : 0);

  useEffect(() => {
    setMobilityCompleted(false);
  }, [selectedDayKey]);

  useEffect(() => {
    if (typeof user?.gender === 'string' && user.gender.trim().length > 0) {
      setUserGender(user.gender);
    }
  }, [user?.gender]);

  useEffect(() => {
    if (!isAuthenticated) return;

    let isActive = true;

    const fetchProfileGender = async () => {
      try {
        const response = await authFetch(`${API_BASE_URL}/profile`);
        if (!response.ok) return;

        const data = await response.json();
        const nextGender = data?.user?.gender;
        if (isActive && typeof nextGender === 'string' && nextGender.trim().length > 0) {
          setUserGender(nextGender);
        }
      } catch (error) {
        console.error('Error fetching profile gender:', error);
      }
    };

    fetchProfileGender();

    return () => {
      isActive = false;
    };
  }, [authFetch, isAuthenticated]);

  // --- CALCULATIONS ---
  const totalStepsCurrent = morningStepsActual + afternoonStepsActual + eveningStepsActual;
  const totalCalsCurrent = morningCaloriesActual + afternoonCaloriesActual + eveningCaloriesActual;

  // Rollover logic
  const morningStepsMissed = isToday ? Math.max(0, morningStepsTarget - morningStepsActual) : 0;
  const afternoonStepsMissed = isToday ? Math.max(0, afternoonStepsTarget - afternoonStepsActual) : 0;

  const afternoonStepsWithRollover = (isToday && currentPeriod !== 'morning')
    ? afternoonStepsTarget + morningStepsMissed
    : afternoonStepsTarget;
  const eveningStepsWithRollover = (isToday && currentPeriod === 'evening')
    ? eveningStepsTarget + morningStepsMissed + afternoonStepsMissed
    : eveningStepsTarget;

  // Check if targets are complete
  const morningStepsComplete = morningStepsActual >= morningStepsTarget;
  const afternoonStepsComplete = afternoonStepsActual >= ((isToday && currentPeriod !== 'morning') ? afternoonStepsWithRollover : afternoonStepsTarget);
  const eveningStepsComplete = eveningStepsActual >= ((isToday && currentPeriod === 'evening') ? eveningStepsWithRollover : eveningStepsTarget);
  const remainingDailySteps = Math.max(0, totalDailySteps - totalStepsCurrent);
  const shouldShowNightWalkRecoveryPrompt = isToday
    && currentPeriod === 'evening'
    && (morningStepsMissed > 0 || afternoonStepsMissed > 0)
    && remainingDailySteps > 0;
  const nightWalkRecoveryKm = Math.max(0.1, Math.round((remainingDailySteps / STEPS_PER_KM) * 10) / 10);

  const morningCaloriesComplete = morningCaloriesActual >= morningCalorieTarget;
  const afternoonCaloriesComplete = afternoonCaloriesActual >= afternoonCalorieTarget;
  const eveningCaloriesComplete = eveningCaloriesActual >= eveningCalorieTarget;

  const handleConvertNightStepsToWalk = useCallback(() => {
    router.push({
      pathname: '/runs/runscreen',
      params: {
        templateId: 'power_walk',
        distanceKm: String(nightWalkRecoveryKm),
        weekContext: `Night walk • ${remainingDailySteps.toLocaleString()} steps left`,
        askLoop: '1',
      }
    });
  }, [router, nightWalkRecoveryKm, remainingDailySteps]);

  // Fetch weekly plan from backend
  const fetchPlanSettings = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const response = await authFetch(`${API_BASE_URL}/plan`);
      if (!response.ok) return;
      const data = await response.json();
      const planDays = Array.isArray(data?.plan?.availableDays) ? data.plan.availableDays : null;
      if (planDays?.length) {
        setAvailableDays(planDays.map((day: unknown) => Number(day)).filter((day: number) => Number.isInteger(day) && day >= 0 && day <= 6));
      }
    } catch (err) {
      console.error('Error fetching plan settings:', err);
    }
  }, [authFetch, isAuthenticated]);

  const fetchWeeklyPlan = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setPlanLoading(true);
      const response = await authFetch(`${API_BASE_URL}/plan/weekly`);
      if (response.ok) {
        const data = await response.json();
        setWeeklyPlan(data['Weekly Plan Table'] || []);
      } else {
        setWeeklyPlan([]);
      }
    } catch (err) {
      console.error('Error fetching weekly plan:', err);
      setWeeklyPlan([]);
    } finally {
      setPlanLoading(false);
    }
  }, [authFetch, isAuthenticated]);

  // Generate a new plan
  const generatePlan = async (force = false) => {
    if (!isAuthenticated) return;
    try {
      setGenerating(true);
      const url = force ? `${API_BASE_URL}/plan/generate-weekly?force=true` : `${API_BASE_URL}/plan/generate-weekly`;
      const response = await authFetch(url, {
        method: 'POST',
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to generate plan');
      }

      const data = await response.json();
      setWeeklyPlan(data['Weekly Plan Table'] || []);
      setLatestPlanPrompt(typeof data?.debugAiRequest?.prompt === 'string' ? data.debugAiRequest.prompt : null);
      // Refresh daily targets too
      fetchDailyTargets();
    } catch (err) {
      console.error('Error generating plan:', err);
      Alert.alert('Plan Regeneration Failed', err instanceof Error ? err.message : 'Failed to generate plan');
    } finally {
      setGenerating(false);
    }
  };

  const updateScheduleDays = async (days: number[]) => {
    if (!isAuthenticated) return;
    try {
      setScheduleUpdating(true);
      const response = await authFetch(`${API_BASE_URL}/plan/schedule-days`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ availableDays: days }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to update schedule days');
      }

      setAvailableDays(days);
      await fetchDailyTargets();
      await fetchPlanSettings();
    } catch (err) {
      console.error('Error updating schedule days:', err);
    } finally {
      setScheduleUpdating(false);
    }
  };

  // Fetch daily targets for current week
  const fetchDailyTargets = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const response = await authFetch(`${API_BASE_URL}/plan/daily/${currentWeek}`);
      if (response.ok) {
        const data = await response.json();
        setDailyTargets(data.days || []);
      } else {
        setDailyTargets([]);
      }
    } catch (err) {
      console.error('Error fetching daily targets:', err);
      setDailyTargets([]);
    }
  }, [authFetch, isAuthenticated, currentWeek]);

  // Fetch training plan ONCE — stores ALL sessions, does NOT depend on currentWeek
  const fetchTrainingPlanData = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const [response, weekResponse] = await Promise.all([
        authFetch(`${API_BASE_URL}/training-plan/user/latest`),
        authFetch(`${API_BASE_URL}/summary/week`),
      ]);

      if (weekResponse.ok) {
        const weekData = await weekResponse.json();
        if (typeof weekData?.currentWeek === 'number' && Number.isFinite(weekData.currentWeek)) {
          const anchorDate = new Date();
          todayWeekRef.current = weekData.currentWeek;
          currentWeekAnchorDateRef.current = anchorDate;
          setCurrentWeek(calculateWeekFromAnchor(selectedDate, anchorDate, weekData.currentWeek));
        }
      }
      if (!response.ok) {
        setAllPlanSessions([]);
        return;
      }
      const data = await response.json();
      
      // Calculate and set initial week from start date (only once)
      // TrainingPlan model uses `createdAt` — there is no `startDate` field
      if (data?.plan?.createdAt) {
        const start = new Date(data.plan.createdAt);
        setPlanStartDate(start);
        
        if (!currentWeekAnchorDateRef.current) {
          const today = new Date();
          todayWeekRef.current = calculateWeekNum(today, start);
          setCurrentWeek(calculateWeekNum(selectedDate, start));
        }
      }

      const sessions = data?.plan?.sessions as TrainingPlanSession[] | undefined;
      setAllPlanSessions(Array.isArray(sessions) ? sessions : []);
    } catch (err) {
      console.error('Error fetching training plan sessions', err);
      setAllPlanSessions([]);
    }
  }, [authFetch, isAuthenticated, calculateWeekFromAnchor, calculateWeekNum, selectedDate]);

  // Filter sessions by currentWeek reactively (no re-fetch needed)
  const trainingPlanWeekSessions = useMemo(() => {
    return allPlanSessions.filter((s) => s.week === currentWeek);
  }, [allPlanSessions, currentWeek]);


  useEffect(() => {
    // Initial data load - only show loading once
    if (!summary && !weeklyPlan.length) {
      setTimeout(() => setLoading(false), 800);
    } else {
      setLoading(false);
    }
  }, [summary, weeklyPlan.length]);

  useEffect(() => {
    fetchDailyTargets();
  }, [fetchDailyTargets]);

  useEffect(() => {
    let cancelled = false;

    const loadTrainingTimePreference = async () => {
      try {
        const storedValue = await AsyncStorage.getItem(TRAINING_TIME_PREFERENCE_KEY);
        if (cancelled) return;

        if (storedValue === 'morning' || storedValue === 'afternoon' || storedValue === 'evening') {
          setTrainingTimePreference(storedValue);
        } else if (storedValue === 'night') {
          setTrainingTimePreference('evening');
        }
      } catch (err) {
        console.error('Error loading training time preference:', err);
      } finally {
        if (!cancelled) {
          hasLoadedTrainingTimePreference.current = true;
        }
      }
    };

    loadTrainingTimePreference();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedTrainingTimePreference.current) return;

    AsyncStorage.setItem(TRAINING_TIME_PREFERENCE_KEY, trainingTimePreference).catch((err) => {
      console.error('Error saving training time preference:', err);
    });
  }, [trainingTimePreference]);

  useEffect(() => {
    setTabBarVisible(!showWeeklyModal);
  }, [showWeeklyModal, setTabBarVisible]);

  useEffect(() => {
    if (currentWeekAnchorDateRef.current) {
      setCurrentWeek(calculateWeekFromAnchor(selectedDate, currentWeekAnchorDateRef.current, todayWeekRef.current));
      return;
    }

    if (!planStartDate) return;
    const computedWeek = calculateWeekNum(selectedDate, planStartDate);
    setCurrentWeek(computedWeek);
    // Keep a stable reference for "Today" jump.
    const today = new Date();
    todayWeekRef.current = calculateWeekNum(today, planStartDate);
  }, [selectedDate, planStartDate, calculateWeekFromAnchor, calculateWeekNum]);

  useEffect(() => {
    if (!showWeeklyModal) return;
    const activeWeek = weeklyPlan.find((week) => week.Week === currentWeek) ?? null;
    setSelectedWeek(activeWeek);
  }, [showWeeklyModal, weeklyPlan, currentWeek]);

  // --- Fetch run statuses for the current week ---
  const fetchRunStatuses = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      // Calculate Monday of selected week
      const dayOfWeek = (selectedDate.getDay() + 6) % 7;
      const mon = new Date(selectedDate);
      mon.setDate(selectedDate.getDate() - dayOfWeek);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);

      const fmt = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      const from = fmt(mon);
      const to = fmt(sun);
      const response = await authFetch(`${API_BASE_URL}/summary/run-status/week?from=${from}&to=${to}`);
      if (response.ok) {
        const data = await response.json();
        setRunStatuses(data.statuses || {});
      }
    } catch (err) {
      console.error('Error fetching run statuses:', err);
    }
  }, [authFetch, isAuthenticated, selectedDate]);

  useEffect(() => {
    fetchRunStatuses();
  }, [fetchRunStatuses]);

  useEffect(() => {
    fetchPlanSettings();
  }, [fetchPlanSettings]);

  // --- PROJECTED RUN INFO (Source of Truth for consistency) ---
  const projectedDays = useMemo(() => {
    const currentWeekPlan = weeklyPlan.find(w => w.Week === currentWeek);
    return currentWeekPlan ? getMappedDays(currentWeekPlan, availableDays) : [];
  }, [weeklyPlan, currentWeek, availableDays]);

  const sessionMapByDay = useMemo(() => {
    const mapped: Record<number, TrainingPlanSession> = {};
    if (projectedDays.length === 0 || trainingPlanWeekSessions.length === 0) return mapped;

    const sessionsByType: Record<string, TrainingPlanSession[]> = {};
    trainingPlanWeekSessions.forEach((s) => {
      if (!sessionsByType[s.runType]) sessionsByType[s.runType] = [];
      sessionsByType[s.runType].push(s);
    });

    Object.entries(sessionsByType).forEach(([runType, sessions]) => {
      const daysForType = projectedDays
        .filter((d) => d.type === 'RUN' && d.runType === runType)
        .sort((a, b) => a.dayIdx - b.dayIdx);

      const count = Math.min(daysForType.length, sessions.length);
      for (let i = 0; i < count; i += 1) {
        mapped[daysForType[i].dayIdx] = sessions[i];
      }
    });

    return mapped;
  }, [projectedDays, trainingPlanWeekSessions]);

  const projectedRunInfo = useMemo(() => {
    const projectedDay = projectedDays.find(d => d.dayIdx === selectedDayOfWeek);
    const mappedSession = sessionMapByDay[selectedDayOfWeek];
    
    // We prioritize the projection (what the user sees in the Weekly Tab) 
    // but keep the sessionId from the actual backend target if available.
    return {
      isRunDay: projectedDay?.type === 'RUN',
      runKm: mappedSession?.targetKm || projectedDay?.targetKm || 0,
      runType: projectedDay?.runType || null,
      sessionId: mappedSession?.id || todayTarget?.sessionId || null
    };
  }, [projectedDays, selectedDayOfWeek, sessionMapByDay, todayTarget]);

  const projectedTodayTarget = useMemo(() => {
    const projectedDay = projectedDays.find(d => d.dayIdx === selectedDayOfWeek);
    if (!todayTarget || !projectedDay) return todayTarget;

    return {
      ...todayTarget,
      dayType: projectedDay.type,
      runKm: projectedRunInfo.isRunDay ? projectedRunInfo.runKm : 0,
      runType: projectedRunInfo.isRunDay ? projectedRunInfo.runType : null,
      sessionId: projectedRunInfo.sessionId,
    };
  }, [todayTarget, projectedDays, selectedDayOfWeek, projectedRunInfo]);

  // --- POINTS SYSTEM ---
  const pointsConfig = useMemo(() => {
    const { isRunDay, runKm: runKmTarget } = projectedRunInfo;

    const stepsProg = totalDailySteps > 0 ? Math.min(totalStepsCurrent / totalDailySteps, 1) : 0;
    const calsProg = totalDailyCalories > 0 ? Math.min(totalCalsCurrent / totalDailyCalories, 1) : 0;
    const waterProg = totalDailyWater > 0 ? Math.min(waterActual / totalDailyWater, 1) : 0;
    const mobilityProg = mobilityCompleted ? 1 : 0;
    const distanceActual = summary?.distanceKm || 0;
    const runProg = (isRunDay && runKmTarget > 0) ? Math.min(distanceActual / runKmTarget, 1) : 0;

    return {
      isRunDay,
      hasMobility: true,
      hasHydration: true,
      stepsProgress: stepsProg,
      caloriesProgress: calsProg,
      hydrationProgress: waterProg,
      mobilityProgress: mobilityProg,
      walkRunProgress: runProg,
    };
  }, [projectedRunInfo, totalStepsCurrent, totalDailySteps, totalCalsCurrent, totalDailyCalories, waterActual, totalDailyWater, mobilityCompleted, summary]);

  const {
    categories: pointCategories,
    totalMaxPoints,
    claimPoints,
    refetch: refetchPoints
  } = useDailyPoints({
    accessToken,
    dayKey: selectedDayKey,
    config: pointsConfig
  });

  const displayPointCategories = useMemo(() => {
    const calorieLowerBound = totalDailyCalories * 0.9;
    const caloriesWithinTargetRange = totalCalsCurrent >= calorieLowerBound && totalCalsCurrent <= totalDailyCalories;
    const calorieMin = Math.round(calorieLowerBound);
    const calorieMax = Math.round(totalDailyCalories);

    return pointCategories.map((category) => {
      if (category.key === 'CALORIES') {
        const overBy = Math.max(0, totalCalsCurrent - totalDailyCalories);
        const underBy = Math.max(0, Math.ceil(calorieLowerBound - totalCalsCurrent));

        return {
          ...category,
          claimable: !category.isAwarded && caloriesWithinTargetRange,
          metricText: `${Math.round(totalCalsCurrent).toLocaleString()} / < ${Math.round(totalDailyCalories).toLocaleString()} kcal`,
          info: `Eat between ${calorieMin.toLocaleString()} and ${calorieMax.toLocaleString()} kcal today to earn these points.`,
          statusText: overBy > 0
            ? `Decrease intake`
            : underBy > 0
              ? `Increase intake`
              : 'Perfect intake',
        };
      }

      if (category.key === 'STEPS') {
        return {
          ...category,
          metricText: `${Math.round(totalStepsCurrent).toLocaleString()} / ${Math.round(totalDailySteps).toLocaleString()} steps`,
          info: `Hit ${Math.round(totalDailySteps).toLocaleString()} steps today to earn these points.`,
        };
      }

      if (category.key === 'WALK_RUN') {
        const distanceActual = summary?.distanceKm || 0;
        const targetRunKm = projectedRunInfo.runKm || 0;
        return {
          ...category,
          metricText: `${distanceActual.toFixed(1)} / ${targetRunKm.toFixed(1)} KM`,
          info: `Run ${targetRunKm.toFixed(1)} km from your plan today to earn these points.`,
        };
      }

      if (category.key === 'HYDRATION') {
        return {
          ...category,
          metricText: `${waterActual} / 8 Glasses`,
          info: 'Drink 8 glasses of water today to earn these points.',
        };
      }

      if (category.key === 'MOBILITY') {
        return {
          ...category,
          metricText: mobilityCompleted ? 'COMPLETE' : 'INCOMPLETE',
          info: 'Complete your exercise session today to earn these points.',
        };
      }

      return category;
    });
  }, [pointCategories, totalCalsCurrent, totalDailyCalories, totalStepsCurrent, totalDailySteps, summary, projectedRunInfo, waterActual, mobilityCompleted]);

  const runMeta = useMemo(() => getRunMeta(projectedRunInfo.runType), [projectedRunInfo.runType]);
  const runInfo = runMeta.details;
  const planDayNumber = useMemo(() => {
    if (planStartDate) {
      return calculatePlanDayNumber(selectedDate, planStartDate);
    }

    return ((Math.max(currentWeek, 1) - 1) * 7) + selectedDayOfWeek + 1;
  }, [planStartDate, calculatePlanDayNumber, selectedDate, currentWeek, selectedDayOfWeek]);

  const startPlanRun = useCallback(() => {
    setShowRunDetails(false);
    if (runMeta.launchMode === 'interval') {
      router.push({
        pathname: getIntervalWorkoutRouteFromTemplateId(runMeta.templateId),
        params: {
          sessionId: projectedRunInfo.sessionId || '',
          source: 'plan',
          distanceKm: String(projectedRunInfo.runKm || 0),
          weekContext: `Week ${currentWeek}`,
        }
      });
      return;
    }

    router.push({
      pathname: '/runs/runscreen',
      params: {
        sessionId: projectedRunInfo.sessionId || '',
        templateId: runMeta.templateId,
        distanceKm: String(projectedRunInfo.runKm || 5),
        weekContext: `Week ${currentWeek}`
      }
    });
  }, [router, runMeta, projectedRunInfo.sessionId, projectedRunInfo.runKm, currentWeek]);

  const shouldBypassRunDetails = projectedRunInfo.runType === GOAL_PRACTICE_RUN_TYPE;

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        fetchWeeklyPlan();
        fetchDailyTargets();
        fetchTrainingPlanData();
        fetchRunStatuses();
        refetchSummary();
        refetchPoints();
      }
    }, [isAuthenticated, fetchWeeklyPlan, fetchDailyTargets, fetchTrainingPlanData, fetchRunStatuses, refetchSummary, refetchPoints])
  );

  if (loading) return <View style={styles.center}><ActivityIndicator color={COLORS.accent} /></View>;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 0 }}>
        {/* Hero Section (extracted component) */}
        <PlanHero
          selectedDate={selectedDate}
          selectedDayOfWeek={selectedDayOfWeek}
          planDayNumber={planDayNumber}
          currentWeek={currentWeek}
          dailyTargets={dailyTargets}
          projectedRunInfo={projectedRunInfo}
          projectedDays={projectedDays}
          panResponderHandlers={panResponder.panHandlers}
          runStatuses={runStatuses}
          onOpenWeeklyModal={openWeeklyModal}
          onGoToToday={handleGoToToday}
          onGoToNextWeek={goToNextWeek}
          onGoToPreviousWeek={goToPreviousWeek}
          onSelectDay={selectDay}
          userGender={userGender}
          onMissedRunAction={(action, dayKey) => {
            if (action === 'run_now') {
              // Navigate to the run screen to start this run now
              router.push('/(tabs)/Run');
            } else if (action === 'move_to_free') {
              // TODO: Implement rescheduling logic once available
              alert('This run will be rescheduled to the next available rest day.');
            }
          }}
          onStartRunPress={async () => {
            if (shouldBypassRunDetails) {
              startPlanRun();
              return;
            }
            setShowRunDetails(true);
          }}
        />

        {/* White Curved Body */}
        <View style={styles.whiteBody}>
          {/* Small visual handle/indicator if needed, otherwise just padding */}

          {/* Daily Progress Section */}
          <View style={styles.bodyContent}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>WEEK {currentWeek}</Text>
                <Text style={styles.pointsEarnedHint}>Earn {totalMaxPoints} pts if completed</Text>
              </View>
              <TouchableOpacity onPress={handleGoToToday}>
                <Text style={styles.goToToday}>Go to Today</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.insightScrollContent}
              style={styles.insightScroll}
            >
              {displayPointCategories.map((category) => (
                <PointsProgressCard
                  key={category.key}
                  category={category}
                  onClaim={() => {
                    if (!category.isAwarded && (category.claimable ?? category.progress >= 1)) {
                      claimPoints(category.key);
                    }
                  }}
                />
              ))}
            </ScrollView>

            {/* Daily Tab Section */}
            <DailyTab
              loadingDaily={summaryLoading}
              dailyTargets={dailyTargets as DailyTargetFromAPI[]}
              todayTarget={projectedTodayTarget as DailyTargetFromAPI}
              todayIndex={selectedDayOfWeek}
              currentSteps={totalStepsCurrent}
              currentCalories={totalCaloriesFromBackend}
              calorieTarget={totalDailyCalories}
              waterIntake={waterActual}
              onIncrementWater={() => isToday && logWater()}
              scheduleExpanded={scheduleExpanded}
              onToggleSchedule={() => setScheduleExpanded(!scheduleExpanded)}
              stepSlots={{ 
                morning: morningStepsActual, 
                afternoon: afternoonStepsActual, 
                evening: eveningStepsActual 
              }}
              stepTargets={{
                morning: morningStepsTarget,
                afternoon: afternoonStepsTarget,
                evening: eveningStepsTarget,
              }}
              exerciseCompleted={mobilityCompleted}
              trainingTimePreference={trainingTimePreference}
              onStartRun={() => {
                setShowRunDetails(true);
              }}
              showNightWalkRecoveryPrompt={shouldShowNightWalkRecoveryPrompt}
              nightWalkRecoverySteps={remainingDailySteps}
              nightWalkRecoveryKm={nightWalkRecoveryKm}
              onConvertNightStepsToWalk={handleConvertNightStepsToWalk}
              onLogFood={handleLogFoodForPeriod}
              onOpenMobility={() => setMobilityModalVisible(true)}
            />
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={showRunDetails && projectedRunInfo.isRunDay}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRunDetails(false)}
      >
        <View style={styles.runDetailsBackdrop}>
          <View style={styles.runDetailsModalCard}>
            <View style={styles.modalDragHandle} />
            <View style={styles.runDetailsTopRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.runDetailsPreTitle}>RUN DETAILS</Text>
                <Text style={styles.runDetailsTitle}>{runInfo.title}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowRunDetails(false)} style={styles.runDetailsCloseBtn}>
                <X size={16} color={COLORS.textSub} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.runDetailsModalScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.runDetailsDescription}>{runInfo.description}</Text>

              <View style={styles.runDetailsStatRow}>
                <View style={styles.runDetailsStat}>
                  <Text style={styles.runDetailsStatLabel}>DISTANCE</Text>
                  <Text style={styles.runDetailsStatValue}>{projectedRunInfo.runKm.toFixed(1)} KM</Text>
                </View>
                <View style={styles.runDetailsStat}>
                  <Text style={styles.runDetailsStatLabel}>INTENSITY</Text>
                  <Text style={[styles.runDetailsStatValue, { color: runInfo.color }]}>{runInfo.intensity}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.runDetailsSectionHeader}
                onPress={() => setRunDetailsExpanded(prev => ({ ...prev, benefits: !prev.benefits }))}
              >
                <Text style={styles.runDetailsSectionTitle}>Benefits</Text>
                {runDetailsExpanded.benefits ? <ChevronUp size={16} color={COLORS.textSub} /> : <ChevronDown size={16} color={COLORS.textSub} />}
              </TouchableOpacity>
              {runDetailsExpanded.benefits && runInfo.benefits.map((item, i) => (
                <View key={`benefit-${i}`} style={styles.runDetailsRow}>
                  <View style={[styles.runDetailsDot, { backgroundColor: runInfo.color }]} />
                  <Text style={styles.runDetailsRowText}>{item}</Text>
                </View>
              ))}

              <TouchableOpacity
                style={styles.runDetailsSectionHeader}
                onPress={() => setRunDetailsExpanded(prev => ({ ...prev, experts: !prev.experts }))}
              >
                <Text style={styles.runDetailsSectionTitle}>Experts Say</Text>
                {runDetailsExpanded.experts ? <ChevronUp size={16} color={COLORS.textSub} /> : <ChevronDown size={16} color={COLORS.textSub} />}
              </TouchableOpacity>
              {runDetailsExpanded.experts && runInfo.expertOpinions.map((item, i) => (
                <View key={`expert-${i}`} style={styles.runDetailsRow}>
                  <Check size={14} color={COLORS.success} />
                  <Text style={styles.runDetailsRowText}>{item}</Text>
                </View>
              ))}

              <TouchableOpacity
                style={styles.runDetailsSectionHeader}
                onPress={() => setRunDetailsExpanded(prev => ({ ...prev, phases: !prev.phases }))}
              >
                <Text style={styles.runDetailsSectionTitle}>Phases</Text>
                {runDetailsExpanded.phases ? <ChevronUp size={16} color={COLORS.textSub} /> : <ChevronDown size={16} color={COLORS.textSub} />}
              </TouchableOpacity>
              {runDetailsExpanded.phases && runInfo.phases.map((phase, i) => (
                <View key={`phase-${i}`} style={styles.runDetailsPhaseRow}>
                  <Text style={styles.runDetailsRowText}>{phase.name}</Text>
                  <Text style={styles.runDetailsPhasePct}>{phase.duration}</Text>
                </View>
              ))}

              <TouchableOpacity
                style={styles.runDetailsSectionHeader}
                onPress={() => setRunDetailsExpanded(prev => ({ ...prev, tips: !prev.tips }))}
              >
                <Text style={styles.runDetailsSectionTitle}>Tips</Text>
                {runDetailsExpanded.tips ? <ChevronUp size={16} color={COLORS.textSub} /> : <ChevronDown size={16} color={COLORS.textSub} />}
              </TouchableOpacity>
              {runDetailsExpanded.tips && runInfo.tips.map((item, i) => (
                <View key={`tip-${i}`} style={styles.runDetailsRow}>
                  <Check size={14} color={COLORS.success} />
                  <Text style={styles.runDetailsRowText}>{item}</Text>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity style={[styles.runDetailsStartBtn, { backgroundColor: runInfo.color }]} onPress={startPlanRun}>
              <Activity size={16} color="#FFF" />
              <Text style={styles.runDetailsStartBtnText}>Start Training Session</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showWeeklyModal}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => {
          setShowWeeklyModal(false);
          setSelectedWeek(null);
        }}
      >
        <SafeAreaView style={styles.fullPlanOverlay}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalHeaderEyebrow}>TRAINING PLAN</Text>
              <Text style={styles.modalHeaderTitle}>Weekly Plan</Text>
            </View>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => {
                setShowWeeklyModal(false);
                setSelectedWeek(null);
              }}
            >
              <X size={20} color={COLORS.textMain} />
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.modalScrollView} 
            showsVerticalScrollIndicator={false}
          >
            <PlanWeeklyTab
              weeklyPlan={weeklyPlan}
              currentWeek={currentWeek}
              loading={planLoading}
              selectedWeek={selectedWeek}
              onSelectWeek={setSelectedWeek}
              availableDays={availableDays}
              onChangeScheduleDays={updateScheduleDays}
              scheduleUpdating={scheduleUpdating}
              trainingTimePreference={trainingTimePreference}
              onChangeTrainingTimePreference={setTrainingTimePreference}
              onRegeneratePlan={() => generatePlan(true)}
              devPrompt={latestPlanPrompt}
              regenerating={generating}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <MobilityExercises
        visible={mobilityModalVisible}
        onClose={() => setMobilityModalVisible(false)}
        currentWeek={currentWeek}
        onMixedSessionComplete={() => setMobilityCompleted(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgPink },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // White Body Curve
  whiteBody: {
    backgroundColor: '#FFF',
    marginTop: -20, // Moved down slightly from -40
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    minHeight: 500,
    paddingTop: 30,
    paddingHorizontal: 24,
    zIndex: 5, // Behind image in some parts, but image has zIndex 10
  },
  bodyContent: {
    paddingBottom: 50
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 15
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textSub, textTransform: 'uppercase' },
  pointsEarnedHint: { fontSize: 12, fontWeight: '700', color: COLORS.accent, marginTop: 2, opacity: 0.8 },
  goToToday: { fontSize: 12, color: COLORS.accent, fontWeight: '600' },
  runDetailsBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  runDetailsModalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    maxHeight: '88%',
  },
  runDetailsModalScroll: {
    maxHeight: 460,
  },
  runDetailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ECEFF3',
    padding: 14,
    marginBottom: 18,
  },
  runDetailsTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  runDetailsPreTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSub,
    letterSpacing: 1,
  },
  runDetailsTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.textMain,
    marginTop: 2,
  },
  runDetailsCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F5F6F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  runDetailsDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.textMain,
    marginBottom: 12,
  },
  runDetailsStatRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  runDetailsStat: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#EDF1F5',
  },
  runDetailsStatLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSub,
    letterSpacing: 0.8,
  },
  runDetailsStatValue: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.textMain,
  },
  runDetailsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: '#F1F3F5',
    marginTop: 4,
  },
  runDetailsSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textMain,
    textTransform: 'uppercase',
  },
  runDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  runDetailsDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  runDetailsRowText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textMain,
    lineHeight: 19,
    fontWeight: '600',
  },
  runDetailsPhaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  runDetailsPhasePct: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.accent,
  },
  runDetailsStartBtn: {
    height: 46,
    borderRadius: 12,
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  runDetailsStartBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Cards Scroll
  insightScroll: { marginHorizontal: -24, marginBottom: 20 },
  insightScrollContent: { paddingHorizontal: 24, paddingRight: 12 },

  // Schedule Header
  expandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, marginBottom: 10 },
  expandTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textMain },
  expandCircle: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center' },

  // --- NEW MINIMAL SCHEDULE STYLES ---
  minimalScheduleContainer: {
    gap: 20,
    marginTop: 10
  },
  minGroup: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  minGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12
  },
  minGroupIcon: {
    width: 32, height: 32, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center'
  },
  minGroupTitle: {
    fontSize: 16, fontWeight: '800', color: COLORS.textMain
  },
  minGroupTime: {
    fontSize: 12,
    color: COLORS.textSub,
    fontWeight: '600',
    marginLeft: 'auto'
  },
  headerAddBtn: {
    marginLeft: 'auto',
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center', alignItems: 'center'
  },
  minListContainer: {
    gap: 12
  },
  hydrationRowContainer: {
    marginTop: 8,
    backgroundColor: '#FAFAFA',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F5F5F5'
  },

  // Minimal Task Row
  minimalTaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F5F5F5'
  },
  minimalIconBg: {
    width: 36, height: 36, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 12
  },
  minimalTaskContent: {
    flex: 1
  },
  minimalTaskLabel: {
    fontSize: 13, fontWeight: '700', color: COLORS.textMain, marginBottom: 2
  },
  minimalTaskValue: {
    fontSize: 12, fontWeight: '600', color: COLORS.textSub
  },
  miniAddBtn: {
    width: 32, height: 32, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center'
  },
  miniStatusDot: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: '#E0E0E0',
    justifyContent: 'center', alignItems: 'center'
  },

  // Hydration
  hydrationIconRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12
  },
  hydrationIconBtn: {
    padding: 4
  },

  // Weekly Plan Overlay (Replaces Modal)
  fullPlanOverlay: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F5',
  },
  modalHeaderEyebrow: { fontSize: 11, fontWeight: '900', color: COLORS.accent, letterSpacing: 1 },
  modalHeaderTitle: { fontSize: 24, fontWeight: '900', color: COLORS.textMain, letterSpacing: -0.5 },
  modalCloseBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center'
  },


  // Expanded PopUp Styles
  popUpBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  popUpCard: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    padding: 24,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 25,
  },
  popUpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  popUpPreTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textSub,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  popUpTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#1A1C1E',
  },
  popUpCloseBtn: {
    padding: 8,
    backgroundColor: '#F8F9FA',
    borderRadius: 20,
  },
  runDescription: {
    fontSize: 15,
    lineHeight: 22,
    color: '#4B5563',
    marginBottom: 24,
  },
  infoSection: {
    marginBottom: 24,
  },
  infoSectionTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#1A1C1E',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  infoBullet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  infoText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
    flex: 1,
  },
  modalDragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E9ECEF',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  runStatsGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  runStatBox: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
  },
  runStatLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textSub,
    marginBottom: 4,
  },
  runStatValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1A1C1E',
  },
  startRunBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent,
    paddingVertical: 18,
    borderRadius: 24,
    gap: 12,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  startRunBtnText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
  },
  modalScrollView: {
    flex: 1,
    padding: 20,
  },
});
