import React, { useMemo, useState, useCallback, useRef, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  Pressable,
  Image,
  UIManager,
  Alert,
} from "react-native";
import {
  Play,
  Pause,
  Square,
  Heart,
  ChevronRight,
  Flag,
  MapPin,
  Timer,
  CalendarDays,
  Check,
  Route,
  Trophy,
} from 'lucide-react-native';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import RunMap from "@/components/RunMap";
import { getMappedDays, dayNames } from "@/utils/planProjection";
import { API_BASE_URL } from "@/config/api";
import { RunDetailsModal } from '@/components/runs/RunDetailsModal';

// --- PROJECT IMPORTS ---
import { useRunTracker } from "@/hooks/useRunTracker";
import { loadRuns, saveRun } from "@/lib/run-storage";
import type { Run } from "@/types/run";
import { useAuth } from "@/src/auth/authContext";
import { useTabBar } from "@/contexts/TabBarContext";
import { useDailySummary } from '@/hooks/useDailySummary';
import { getRunMeta } from '@/constants/runDetails';
import { getIntervalWorkoutRouteFromTemplateId } from '@/lib/interval-workout';
import { usePoints } from '@/hooks/usePoints';
import { COMPETITIONS, type Competition } from '@/constants/competitions';
import { ui as planUI } from '@/components/plan/PlanVisuals';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const GOAL_PRACTICE_RUN_TYPE = 'Goal Practice Run';
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type RunStatusEntry = {
  runStatus: string;
  runKmTarget: number;
  distanceKm: number;
};

type RunStatusMap = Record<string, RunStatusEntry>;

type ScheduleRunItem = {
  dayIdx: number;
  name: string;
  dateNum: number;
  month: string;
  dayKey: string;
  runType: string;
  targetKm: number;
  isToday: boolean;
  scheduleStatus: 'completed' | 'missed' | 'today' | 'upcoming' | null;
  sessionId: string | null;
};

const formatDayKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const stripEmojis = (value: string): string =>
  value.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').replace(/\s+/g, ' ').trim();

const THEME = {
  primary: '#FF6069',
  secondary: '#1A1C1E', 
  teal: '#099D9B',
  tealTint: '#E4F8F7',
  bg: '#FFF8F9',
  surface: '#FFFFFF',
  text: '#18202F',
  textMuted: '#7C8191',
  white: '#FFFFFF',
  glass: 'rgba(255, 255, 255, 0.9)',
  primaryTint: '#FFF0F2',
  primaryMuted: 'rgba(255, 107, 107, 0.6)',
  border: 'rgba(0, 0, 0, 0.05)',
  divider: 'rgba(15, 23, 42, 0.07)',
};

export default function RunScreen() {
  const insets = useSafeAreaInsets();
  const { accessToken, authFetch, isAuthenticated } = useAuth();
  const { setTabBarVisible } = useTabBar();
  const { summary, recalculate } = useDailySummary({ accessToken });
  const { balance: points, refetch: refetchPoints } = usePoints({ accessToken });
  const isFocused = useIsFocused();

  const {
    state,
    route,
    smoothedLocation,
    startTime,
    endTime,
    elapsedSec,
    distanceM,
    startRun: originalStartRun,
    pauseRun,
    resumeRun,
    finishRun,
    resetRun,
    paceSecPerKm
  } = useRunTracker();

  const [allRuns, setAllRuns] = useState<Run[]>([]);
  const [weeklyPlan, setWeeklyPlan] = useState<any[]>([]);
  const [trainingPlanWeekSessions, setTrainingPlanWeekSessions] = useState<any[]>([]);
  const [availableDays, setAvailableDays] = useState<number[]>([0, 2, 4]);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [runStatuses, setRunStatuses] = useState<RunStatusMap>({});
  const [showRunDetails, setShowRunDetails] = useState(false);
  const [selectedScheduleRun, setSelectedScheduleRun] = useState<ScheduleRunItem | null>(null);

  const hudAnim = useRef(new Animated.Value(0)).current;

  const fetchHistory = useCallback(async () => {
    const saved = await loadRuns();
    setAllRuns(saved);
  }, []);

  const calculateWeekNum = useCallback((date: Date, start: Date) => {
    const getMonday = (d: Date) => {
      const day = (d.getDay() + 6) % 7;
      const diff = d.getDate() - day;
      const mon = new Date(d);
      mon.setDate(diff);
      mon.setHours(0, 0, 0, 0);
      return mon;
    };

    const startMon = getMonday(new Date(start));
    const currentMon = getMonday(new Date(date));
    const diffTime = currentMon.getTime() - startMon.getTime();
    const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));

    return Math.max(1, diffWeeks + 1);
  }, []);

  const fetchPlanSettings = useCallback(async () => {
    if (!accessToken) return;
    try {
      const response = await authFetch(`${API_BASE_URL}/plan`);
      if (!response.ok) return;

      const data = await response.json();
      const planDays = Array.isArray(data?.plan?.availableDays) ? data.plan.availableDays : null;
      if (planDays?.length) {
        setAvailableDays(
          planDays
            .map((day: unknown) => Number(day))
            .filter((day: number) => Number.isInteger(day) && day >= 0 && day <= 6)
        );
      }
    } catch (err) {
      console.error('Error fetching plan settings:', err);
    }
  }, [authFetch, accessToken]);

  const fetchRunStatuses = useCallback(async () => {
    if (!accessToken) return;
    try {
      const today = new Date();
      const dayOfWeek = (today.getDay() + 6) % 7;
      const mon = new Date(today);
      mon.setDate(today.getDate() - dayOfWeek);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);

      const from = formatDayKey(mon);
      const to = formatDayKey(sun);
      const response = await authFetch(`${API_BASE_URL}/summary/run-status/week?from=${from}&to=${to}`);
      if (response.ok) {
        const data = await response.json();
        setRunStatuses(data.statuses || {});
      }
    } catch (err) {
      console.error('Error fetching run statuses:', err);
    }
  }, [authFetch, accessToken]);

  const fetchTrainingPlan = useCallback(async () => {
    if (!accessToken) return;
    try {
      const [planRes, weeklyRes, weekRes] = await Promise.all([
        authFetch(`${API_BASE_URL}/training-plan/user/latest`),
        authFetch(`${API_BASE_URL}/plan/weekly`),
        authFetch(`${API_BASE_URL}/summary/week`),
      ]);

      let resolvedWeek: number | null = null;

      if (weekRes.ok) {
        const weekData = await weekRes.json();
        if (typeof weekData?.currentWeek === 'number' && Number.isFinite(weekData.currentWeek)) {
          resolvedWeek = weekData.currentWeek;
        }
      }

      if (resolvedWeek === null && planRes.ok) {
        const data = await planRes.json();
        const planAnchor = data.plan?.createdAt ?? data.plan?.startDate;
        if (planAnchor) {
          resolvedWeek = calculateWeekNum(new Date(), new Date(planAnchor));
        }
      }

      if (resolvedWeek !== null) {
        setCurrentWeek(resolvedWeek);
        const sessionsRes = await authFetch(`${API_BASE_URL}/training-plan/week-sessions?weekNumber=${resolvedWeek}`);
        if (sessionsRes.ok) {
          const sdata = await sessionsRes.json();
          setTrainingPlanWeekSessions(sdata.sessions || []);
        } else {
          setTrainingPlanWeekSessions([]);
        }
      } else {
        setTrainingPlanWeekSessions([]);
      }

      if (weeklyRes.ok) {
        const data = await weeklyRes.json();
        setWeeklyPlan(data['Weekly Plan Table'] || []);
      } else {
        setWeeklyPlan([]);
      }
    } catch (err) {
      console.error('Error fetching plan data:', err);
      setTrainingPlanWeekSessions([]);
      setWeeklyPlan([]);
    }
  }, [authFetch, accessToken, calculateWeekNum]);

  useFocusEffect(useCallback(() => { 
    fetchHistory(); 
    fetchPlanSettings();
    fetchTrainingPlan();
    fetchRunStatuses();
    if (isAuthenticated) {
      recalculate();
      refetchPoints();
    }
    // Restore tab bar when leaving the Run screen
    return () => {
      setTabBarVisible(true);
    };
  }, [fetchHistory, fetchPlanSettings, fetchTrainingPlan, fetchRunStatuses, setTabBarVisible, isAuthenticated, recalculate, refetchPoints]));

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    const isImmersive = state === 'running' || state === 'paused' || state === 'finished';
    setTabBarVisible(!isImmersive);
    Animated.timing(hudAnim, {
      toValue: isImmersive ? 1 : 0,
      duration: 300,
      easing: Easing.bezier(0.23, 1, 0.32, 1),
      useNativeDriver: true,
    }).start();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, [isFocused, setTabBarVisible, state, hudAnim]);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const rs = s % 60;
    return `${m}:${rs.toString().padStart(2, '0')}`;
  };

  const formatPace = (pace: number) => {
    if (pace === 0 || isNaN(pace) || !isFinite(pace)) return "0:00";
    const min = Math.floor(pace / 60);
    const sec = Math.floor(pace % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const projectedDays = useMemo(() => {
    const currentWeekPlan = weeklyPlan.find(w => w.Week === currentWeek);
    return currentWeekPlan ? getMappedDays(currentWeekPlan, availableDays) : [];
  }, [weeklyPlan, currentWeek, availableDays]);

  const todayIdx = (new Date().getDay() + 6) % 7;

  const sessionMapByDay = useMemo(() => {
    const mapped: Record<number, any> = {};
    if (projectedDays.length === 0 || trainingPlanWeekSessions.length === 0) return mapped;

    const sessionsByType: Record<string, any[]> = {};
    trainingPlanWeekSessions.forEach((s) => {
      if (!sessionsByType[s.runType]) sessionsByType[s.runType] = [];
      sessionsByType[s.runType].push(s);
    });

    Object.entries(sessionsByType).forEach(([runType, sessions]) => {
      const daysForType = projectedDays
        .filter((d: any) => d.type === 'RUN' && d.runType === runType)
        .sort((a: any, b: any) => a.dayIdx - b.dayIdx);

      const count = Math.min(daysForType.length, sessions.length);
      for (let i = 0; i < count; i += 1) {
        mapped[daysForType[i].dayIdx] = sessions[i];
      }
    });

    return mapped;
  }, [projectedDays, trainingPlanWeekSessions]);

  const runInfo = useMemo(() => {
    const projectedDay = projectedDays.find((d: any) => d.dayIdx === todayIdx);
    const mappedSession = sessionMapByDay[todayIdx];

    if (projectedDay && projectedDay.type === 'RUN') {
      return { 
        type: 'TODAY', 
        label: `${projectedDay.runType} • ${projectedDay.targetKm}km`, 
        target: mappedSession?.targetKm || projectedDay.targetKm || 0, 
        title: "TODAY'S RUN", 
        dayIdx: projectedDay.dayIdx,
        runType: projectedDay.runType,
        sessionId: mappedSession?.id || null
      };
    }
    const upcomingIdx = projectedDays.findIndex((d: any) => d.dayIdx > todayIdx && d.type === 'RUN');
    if (upcomingIdx !== -1) {
      const upcoming = projectedDays[upcomingIdx];
      const upcomingMapped = sessionMapByDay[upcoming.dayIdx];
      return { 
        type: 'UPCOMING', 
        label: `${upcoming.runType} • ${upcoming.targetKm}km`, 
        target: upcomingMapped?.targetKm || upcoming.targetKm || 0, 
        title: "UPCOMING RUN", 
        dayIdx: upcoming.dayIdx,
        runType: upcoming.runType,
        sessionId: upcomingMapped?.id || null
      };
    }
    return { type: 'RECOVERY', label: 'Rest Day', target: 0, title: 'REST DAY', dayIdx: null };
  }, [projectedDays, todayIdx, sessionMapByDay]);

  const weekSchedule = useMemo(() => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - todayIdx);

    return projectedDays
      .filter((day) => day.type === 'RUN')
      .map((day) => {
        const date = new Date(monday);
        date.setDate(monday.getDate() + day.dayIdx);
        const dayKey = formatDayKey(date);
        const status = runStatuses[dayKey];
        const session = sessionMapByDay[day.dayIdx];
        const targetKm = session?.targetKm || day.targetKm || 0;
        const isToday = day.dayIdx === todayIdx;
        const isPast = day.dayIdx < todayIdx;

        let scheduleStatus: 'completed' | 'missed' | 'today' | 'upcoming' | null = null;
        if (status?.runStatus === 'COMPLETED') scheduleStatus = 'completed';
        else if (status?.runStatus === 'MISSED') scheduleStatus = 'missed';
        else if (isToday) scheduleStatus = 'today';
        else if (!isPast) scheduleStatus = 'upcoming';

        return {
          dayIdx: day.dayIdx,
          name: day.name,
          dateNum: date.getDate(),
          month: MONTH_ABBR[date.getMonth()],
          dayKey,
          runType: stripEmojis(day.runType || 'Run'),
          targetKm,
          isToday,
          scheduleStatus,
          sessionId: session?.id || null,
        };
      });
  }, [projectedDays, sessionMapByDay, runStatuses, todayIdx]);

  const visibleSchedule = useMemo(() => {
    const nextIdx = weekSchedule.findIndex((item) => item.dayIdx >= todayIdx);
    const start = nextIdx === -1 ? Math.max(0, weekSchedule.length - 2) : Math.max(0, nextIdx - 1);
    return weekSchedule.slice(start, start + 2);
  }, [weekSchedule, todayIdx]);

  const weekStats = useMemo(() => {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - todayIdx);
    weekStart.setHours(0, 0, 0, 0);
    const runs = allRuns.filter((run) => new Date(run.startedAt).getTime() >= weekStart.getTime());
    return {
      count: runs.length,
    };
  }, [allRuns, todayIdx]);

  const startScheduleRun = useCallback((item: Pick<ScheduleRunItem, 'runType' | 'targetKm' | 'sessionId'>) => {
    setShowRunDetails(false);
    setTabBarVisible(false);
    const runMeta = getRunMeta(item.runType);
    if (runMeta.launchMode === 'interval') {
      router.push({
        pathname: getIntervalWorkoutRouteFromTemplateId(runMeta.templateId),
        params: {
          sessionId: item.sessionId || '',
          source: 'plan',
          distanceKm: String(item.targetKm || 0),
          weekContext: `Week ${currentWeek}`,
        },
      });
      return;
    }

    router.push({
      pathname: '/runs/runscreen',
      params: {
        sessionId: item.sessionId || '',
        templateId: runMeta.templateId,
        runType: item.runType,
        distanceKm: String(item.targetKm || 5),
        weekContext: `Week ${currentWeek}`,
      },
    });
  }, [router, currentWeek, setTabBarVisible]);

  const openRunDetails = useCallback((item: ScheduleRunItem) => {
    if (item.runType === GOAL_PRACTICE_RUN_TYPE) {
      startScheduleRun(item);
      return;
    }
    setSelectedScheduleRun(item);
    setShowRunDetails(true);
  }, [startScheduleRun]);

  const startQuickFreeRun = useCallback(() => {
    setTabBarVisible(false);
    router.push({
      pathname: '/runs/runscreen',
      params: {
        templateId: 'freeform',
        distanceKm: '5.0',
        weekContext: 'FREE RUN',
      },
    });
  }, [router, setTabBarVisible]);

  const startRun = async () => {
    if (runInfo.type === 'TODAY') {
      const todayItem = weekSchedule.find((entry) => entry.isToday);
      if (todayItem) {
        openRunDetails(todayItem);
        return;
      }

      if (runInfo.runType === GOAL_PRACTICE_RUN_TYPE) {
        startScheduleRun({
          runType: runInfo.runType || 'Run',
          targetKm: runInfo.target,
          sessionId: runInfo.sessionId,
        });
        return;
      }

      const dayIdx = runInfo.dayIdx ?? todayIdx;
      const today = new Date();
      openRunDetails({
        dayIdx,
        name: dayNames[dayIdx],
        dateNum: today.getDate(),
        month: MONTH_ABBR[today.getMonth()],
        dayKey: formatDayKey(today),
        runType: stripEmojis(runInfo.runType || 'Run'),
        targetKm: runInfo.target,
        isToday: true,
        scheduleStatus: 'today',
        sessionId: runInfo.sessionId,
      });
      return;
    }

    startQuickFreeRun();
  };

  const runSummary = useMemo(() => {
    if (state !== 'finished' || !startTime || !endTime) return null;

    return {
      id: `${startTime.toISOString()}_${endTime.toISOString()}`,
      startedAt: startTime.toISOString(),
      endedAt: endTime.toISOString(),
      durationSeconds: elapsedSec,
      totalDistanceMeters: distanceM,
      avgPaceSecPerKm: paceSecPerKm,
      route,
    } as Run;
  }, [state, startTime, endTime, elapsedSec, distanceM, paceSecPerKm, route]);

  const handleSave = useCallback(async () => {
    if (!runSummary || isSaving) return;

    try {
      setIsSaving(true);
      await saveRun(runSummary, authFetch);
      await fetchHistory();
      if (isAuthenticated) {
        await recalculate();
      }
      await resetRun();
    } catch (error) {
      console.error('Failed to save run:', error);
      Alert.alert('Error', 'Could not save run.');
    } finally {
      setIsSaving(false);
    }
  }, [runSummary, isSaving, authFetch, fetchHistory, isAuthenticated, recalculate, resetRun]);

  const getDateForDayIdx = useCallback((dayIdx: number) => {
    const today = new Date();
    const todayIdx = (today.getDay() + 6) % 7;
    const target = new Date(today);
    target.setDate(today.getDate() + (dayIdx - todayIdx));
    return target;
  }, []);

  const isImmersive = state === 'running' || state === 'paused' || state === 'finished';

  const nextRun = useMemo(() => {
    if (runInfo.type === 'RECOVERY') {
      return { title: 'Free Run', sub: 'Rest day · run your way' };
    }
    const date = runInfo.dayIdx == null ? new Date() : getDateForDayIdx(runInfo.dayIdx);
    const when = runInfo.type === 'TODAY'
      ? 'Today'
      : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const km = runInfo.target > 0 ? `${Number(runInfo.target.toFixed(1))} km · ` : '';
    return { title: stripEmojis(runInfo.runType || 'Run'), sub: `${km}${when}` };
  }, [runInfo, getDateForDayIdx]);

  const openCompetition = useCallback((competition: Competition) => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (competition.route) {
      router.push(competition.route);
      return;
    }
    Alert.alert(competition.title, `${competition.title} is coming soon. We'll let you know when it's ready.`);
  }, []);

  return (
    <View style={styles.container}>
      {isFocused && <StatusBar style="dark" />}

      {isImmersive ? (
        <View style={StyleSheet.absoluteFill}>
          <RunMap
            path={route.map(p => ({ latitude: p.lat, longitude: p.lon }))}
            currentLocation={smoothedLocation ? { latitude: smoothedLocation.lat, longitude: smoothedLocation.lon } : undefined}
            isRunning={state === 'running'}
          />

          <Animated.View style={[styles.activeHud, { bottom: insets.bottom + 16, opacity: hudAnim, transform: [{ translateY: hudAnim.interpolate({ inputRange: [0, 1], outputRange: [100, 0] }) }] }]}>
            <View style={styles.hudStatsRow}>
              <View style={styles.hudStat}>
                <Text style={styles.hudStatVal}>
                  {(distanceM / 1000).toFixed(2)}
                  {runInfo.target > 0 && <Text style={styles.hudStatTarget}> / {runInfo.target}</Text>}
                </Text>
                <Text style={styles.hudStatLab}>KM</Text>
              </View>
              <View style={styles.hudStat}>
                <Text style={styles.hudStatVal}>{formatDuration(elapsedSec)}</Text>
                <Text style={styles.hudStatLab}>TIME</Text>
              </View>
              <View style={styles.hudStat}>
                <Text style={styles.hudStatVal}>{formatPace(paceSecPerKm)}</Text>
                <Text style={styles.hudStatLab}>PACE</Text>
              </View>
            </View>

            <View style={styles.hudActions}>
              {state === 'running' ? (
                <TouchableOpacity style={styles.hudPauseBtn} onPress={pauseRun}>
                  <Pause size={28} color={THEME.white} fill={THEME.white} />
                </TouchableOpacity>
              ) : (
                <View style={styles.pausedGrid}>
                  <TouchableOpacity style={styles.hudFinishBtn} onPress={finishRun}>
                    <Square size={20} color={THEME.primary} fill={THEME.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.hudResumeBtn} onPress={resumeRun}>
                    <Play size={28} color={THEME.white} fill={THEME.white} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </Animated.View>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 120 }]}
        >
          {/* HEADER */}
          <View style={planUI.row}>
            <View style={styles.headerIcon}><Route size={28} color={THEME.primary} /></View>
            <Text accessibilityRole="header" style={styles.headerTitle}>Run</Text>
            <View style={styles.pointsPill} accessibilityLabel={`${points} points`}>
              <Heart size={15} color={THEME.primary} fill={THEME.primary} />
              <Text style={styles.pointsText}>
                {new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(points)} <Text style={styles.pointsUnit}>pts</Text>
              </Text>
            </View>
          </View>

          {/* MAP PREVIEW */}
          <View style={[planUI.card, styles.mapBlock]}>
            <Pressable
              style={({ pressed }) => [styles.mapCard, pressed && styles.pressed]}
              onPress={() => router.push('/runs/allruns')}
              accessibilityRole="button"
              accessibilityLabel="View all runs"
            >
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <RunMap
                  path={route.map(p => ({ latitude: p.lat, longitude: p.lon }))}
                  currentLocation={smoothedLocation ? { latitude: smoothedLocation.lat, longitude: smoothedLocation.lon } : undefined}
                  isRunning={false}
                />
              </View>

              <View style={styles.mapChevron}>
                <Text style={styles.mapHistoryText}>Run history</Text>
                <ChevronRight size={18} color={THEME.textMuted} strokeWidth={2.6} />
              </View>
            </Pressable>

            <View style={styles.nextRunCopy}>
              <Text style={styles.nextRunEyebrow}>{runInfo.type === 'TODAY' ? "Today's run" : runInfo.type === 'UPCOMING' ? 'Next scheduled run' : 'Your next run'}</Text>
              <Text style={styles.nextRunTitle}>{nextRun.title}</Text>
              <Text style={styles.nextRunSub}>{nextRun.sub}</Text>
            </View>

            <Pressable
              style={({ pressed }) => [planUI.primary, styles.mainStartBtn, pressed && styles.pressed]}
              onPress={startRun}
              accessibilityRole="button"
              accessibilityLabel={runInfo.type === 'TODAY' ? `Start ${nextRun.title}` : 'Start free run'}
            >
              <Play size={18} color={THEME.white} fill={THEME.white} />
              <Text style={planUI.primaryText}>{runInfo.type === 'TODAY' ? 'Start run' : 'Start free run'}</Text>
            </Pressable>
          </View>

          {/* RUN SCHEDULE */}
          <View style={[planUI.card, styles.section]}>
            <View style={styles.sectionHeader}>
              <CalendarDays size={24} color={THEME.primary} />
              <Text accessibilityRole="header" style={[planUI.heading, styles.sectionTitle]}>Run schedule</Text>
              <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/Plans')} style={styles.sectionLink}>
                <Text style={styles.seeAll}>Full plan</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.groupCard}>
              {visibleSchedule.length === 0 ? (
                <Text style={styles.statusMsg}>No runs scheduled this week.</Text>
              ) : (
                visibleSchedule.map((item, idx) => (
                  <Pressable
                    key={item.dayKey}
                    style={({ pressed }) => [
                      styles.groupRow,
                      idx > 0 && styles.groupRowDivider,
                      pressed && styles.rowPressed,
                    ]}
                    onPress={() => openRunDetails(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.runType}, ${item.name}, ${item.targetKm} kilometres${item.scheduleStatus ? `, ${item.scheduleStatus}` : ''}`}
                  >
                    <View style={styles.dateCol}>
                      <Text style={[styles.dateDay, item.isToday && { color: THEME.primary }]}>{item.dateNum}</Text>
                      <Text style={styles.dateMonth}>{item.month.toUpperCase()}</Text>
                    </View>
                    <View style={styles.dateRule} />
                    <View style={styles.activityDetails}>
                      <View style={styles.scheduleTitleRow}>
                        <Text style={styles.activityTitle} numberOfLines={1}>{item.runType}</Text>
                        {item.isToday && (
                          <View style={styles.todayBadge}>
                            <Text style={styles.todayBadgeText}>Today</Text>
                          </View>
                        )}
                      </View>
                      <Text
                        style={[
                          styles.activitySub,
                          item.scheduleStatus === 'completed' && styles.scheduleSubDone,
                          item.scheduleStatus === 'missed' && styles.scheduleSubMissed,
                        ]}
                      >
                        {item.scheduleStatus === 'completed'
                          ? 'Completed'
                          : item.scheduleStatus === 'missed'
                            ? 'Missed'
                            : `${item.name} · ${item.targetKm > 0 ? `${item.targetKm.toFixed(1)} km` : 'Tap for details'}`}
                      </Text>
                    </View>
                    {item.scheduleStatus === 'completed' ? <View style={styles.completedMark}><Check size={18} color={THEME.teal} strokeWidth={3} /></View> : <ChevronRight size={18} color={THEME.textMuted} />}
                  </Pressable>
                ))
              )}
            </View>
          </View>

          {/* COMPETITIONS */}
          <View style={[planUI.card, styles.section]}>
            <View style={styles.sectionHeader}>
              <Trophy size={24} color={THEME.primary} />
              <Text accessibilityRole="header" style={[planUI.heading, styles.sectionTitle]}>Competitions</Text>
              <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/Race')} style={styles.sectionLink}>
                <Text style={styles.seeAll}>View all</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.competitionList}>
              {COMPETITIONS.map((competition) => (
                <CompetitionCard
                  key={competition.id}
                  competition={competition}
                  onPress={() => openCompetition(competition)}
                />
              ))}
            </View>
          </View>

          {/* YOUR PROGRESS */}
          <View style={[planUI.card, styles.section]}>
            <View style={styles.sectionHeader}>
              <Flag size={24} color={THEME.teal} />
              <Text accessibilityRole="header" style={[planUI.heading, styles.sectionTitle]}>Your progress</Text>
              <TouchableOpacity accessibilityRole="button" onPress={() => router.push({ pathname: '/activity', params: { tab: 'RUNNING' } })} style={styles.sectionLink}>
                <Text style={styles.seeAll}>View activity</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.statRow}>
              <StatTile icon={<MapPin size={16} color={THEME.teal} />} tint={THEME.tealTint} value={(summary?.distanceKm || 0).toFixed(1)} label="km today" />
              <StatTile icon={<Timer size={16} color={THEME.teal} />} tint={THEME.tealTint} value={`${summary?.exerciseMinutes || 0}m`} label="active time" />
              <StatTile icon={<Flag size={16} color={THEME.teal} />} tint={THEME.tealTint} value={String(weekStats.count)} label="runs this week" />
            </View>
          </View>

        </ScrollView>
      )}

      <RunDetailsModal
        visible={showRunDetails && selectedScheduleRun !== null}
        runType={selectedScheduleRun?.runType ?? null}
        runKm={selectedScheduleRun?.targetKm ?? 0}
        onClose={() => setShowRunDetails(false)}
        onStart={() => {
          if (selectedScheduleRun) {
            startScheduleRun(selectedScheduleRun);
          }
        }}
      />

      {/* FINISHED SUMMARY */}
      {state === 'finished' && (
        <View style={styles.summaryLayer}>
          <SafeAreaView style={styles.summaryInner}>
            <Text style={styles.summaryHeader}>Run Complete</Text>
            <View style={styles.summaryTotals}>
              <View style={styles.totalItem}>
                <Text style={styles.totalValue}>{(distanceM / 1000).toFixed(2)}</Text>
                <Text style={styles.totalLabel}>KILOMETERS</Text>
              </View>
              <View style={styles.totalItem}>
                <Text style={styles.totalValue}>{formatDuration(elapsedSec)}</Text>
                <Text style={styles.totalLabel}>DURATION</Text>
              </View>
            </View>
            <View style={styles.summaryBtns}>
              <TouchableOpacity style={styles.summaryDiscard} onPress={resetRun}>
                <Text style={styles.summaryDiscardText}>Discard</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.summarySave, isSaving && styles.summarySaveDisabled]}
                onPress={handleSave}
                disabled={isSaving}
              >
                <Text style={styles.summarySaveText}>{isSaving ? 'SAVING...' : 'SAVE SESSION'}</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      )}
    </View>
  );
}

function StatTile({ icon, tint, value, label }: { icon: React.ReactNode; tint: string; value: string; label: string }) {
  return (
    <View style={styles.statTile}>
      <View style={[styles.statIconBg, { backgroundColor: tint }]}>{icon}</View>
      <View style={styles.statCopy}>
        <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
        <Text style={styles.statLabel} numberOfLines={3}>{label}</Text>
      </View>
    </View>
  );
}

function CompetitionCard({ competition, onPress }: { competition: Competition; onPress: () => void }) {
  const art = competition.id === 'virtual'
    ? require('../../assets/competitions/virtual-race-v2.webp')
    : require('../../assets/competitions/couple-tug-v2.webp');

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.compCard, competition.id === 'virtual' ? styles.compCardTeal : styles.compCardCoral, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${competition.shortTitle}. ${competition.description}`}
    >
      <Text style={styles.compTitle} numberOfLines={2}>{competition.shortTitle}</Text>
      <Image source={art} resizeMode="contain" style={[styles.compArt, competition.id === 'steps' && styles.compArtCouple]} />

      <View style={styles.compChevron}>
        <ChevronRight size={18} color={competition.id === 'virtual' ? THEME.teal : THEME.primary} strokeWidth={2.8} />
      </View>
    </Pressable>
  );
}

// Reuse Plans' 28pt card and primary-action styles; inset controls use 16pt corners.

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 14 },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.94 },
  rowPressed: { backgroundColor: 'rgba(15, 23, 42, 0.03)' },

  headerIcon: { width: 44, height: 44, borderRadius: 16, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', backgroundColor: THEME.primaryTint },
  headerTitle: { flex: 1, fontSize: 25, fontWeight: '800', color: THEME.text, letterSpacing: -0.6 },
  pointsPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 16, borderCurve: 'continuous', backgroundColor: THEME.primaryTint },
  pointsText: { fontSize: 14, fontWeight: '800', color: THEME.primary, fontVariant: ['tabular-nums'] },
  pointsUnit: { fontSize: 10, fontWeight: '600' },

  mapBlock: { padding: 0, backgroundColor: THEME.surface, overflow: 'hidden' },
  mapCard: {
    height: 160,
    overflow: 'hidden',
    backgroundColor: '#EEF2F6',
  },
  nextRunCopy: { paddingHorizontal: 20, paddingTop: 20, gap: 4 },
  nextRunEyebrow: { fontSize: 13, lineHeight: 20, fontWeight: '500', color: THEME.textMuted },
  nextRunTitle: { fontSize: 24, lineHeight: 32, fontWeight: '700', color: THEME.text, letterSpacing: -0.5 },
  nextRunSub: { fontSize: 14, lineHeight: 20, color: THEME.textMuted },
  mapChevron: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
    flexDirection: 'row',
    borderRadius: 20,
    borderCurve: 'continuous',
    backgroundColor: THEME.white,
    alignItems: 'center',
  },
  mapHistoryText: { fontSize: 12, fontWeight: '600', color: THEME.textMuted },
  mainStartBtn: { margin: 20, marginTop: 16, backgroundColor: THEME.primary },

  activeHud: {
    position: 'absolute', bottom: 40, left: 16, right: 16,
    backgroundColor: THEME.secondary, borderRadius: 36, padding: 28,
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 30, elevation: 25,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)'
  },
  hudStatsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 28 },
  hudStat: { alignItems: 'center' },
  hudStatVal: { color: THEME.white, fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  hudStatTarget: { fontSize: 18, color: 'rgba(255,255,255,0.4)', fontWeight: '600' },
  hudStatLab: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '800', marginTop: 6, letterSpacing: 1.5 },
  hudActions: { alignItems: 'center' },
  hudPauseBtn: { width: 80, height: 80, borderRadius: 40, backgroundColor: THEME.primary, alignItems: 'center', justifyContent: 'center', shadowColor: THEME.primary, shadowOpacity: 0.4, shadowRadius: 15 },
  pausedGrid: { flexDirection: 'row', gap: 24 },
  hudFinishBtn: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  hudResumeBtn: { width: 80, height: 80, borderRadius: 40, backgroundColor: THEME.primary, alignItems: 'center', justifyContent: 'center' },

  section: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: THEME.surface },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  sectionTitle: { flex: 1, color: THEME.text },
  sectionLink: { minHeight: 44, justifyContent: 'center' },
  seeAll: { fontSize: 12, fontWeight: '700', color: THEME.primary },
  groupCard: { overflow: 'hidden' },
  completedMark: { width: 32, height: 32, borderRadius: 16, backgroundColor: THEME.tealTint, alignItems: 'center', justifyContent: 'center' },
  groupRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16 },
  groupRowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: THEME.divider },
  dateCol: { width: 38, alignItems: 'center' },
  dateDay: { fontSize: 22, lineHeight: 28, fontWeight: '700', color: THEME.text, fontVariant: ['tabular-nums'] },
  dateMonth: { fontSize: 11, fontWeight: '600', color: THEME.textMuted, letterSpacing: 0.6 },
  dateRule: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: THEME.divider },
  activityDetails: { flex: 1, minWidth: 0 },
  activityTitle: { fontSize: 16, lineHeight: 24, fontWeight: '600', color: THEME.text, flexShrink: 1 },
  activitySub: { fontSize: 13, lineHeight: 20, fontWeight: '400', color: THEME.textMuted, marginTop: 3 },
  scheduleTitleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  todayBadge: { backgroundColor: THEME.primaryTint, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 16, borderCurve: 'continuous' },
  todayBadgeText: { fontSize: 11, fontWeight: '600', color: '#BE4451' },
  scheduleSubDone: { color: THEME.teal, fontWeight: '700' },
  scheduleSubMissed: { color: THEME.textMuted, fontWeight: '700' },
  statusMsg: { textAlign: 'center', color: THEME.textMuted, padding: 28, fontSize: 14 },

  statRow: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: THEME.divider, paddingTop: 16, paddingBottom: 4 },
  statTile: { flex: 1, minWidth: 0, alignItems: 'flex-start', gap: 12, paddingHorizontal: 4 },
  statIconBg: { width: 32, height: 32, borderRadius: 16, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  statCopy: { alignSelf: 'stretch', minWidth: 0, gap: 4 },
  statValue: { fontSize: 22, lineHeight: 28, fontWeight: '800', color: THEME.text, fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 12, lineHeight: 16, color: THEME.textMuted },

  competitionList: { flexDirection: 'row', gap: 8, marginTop: 4 },
  compCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 176,
    padding: 16,
    borderRadius: 20,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  compCardTeal: { backgroundColor: THEME.tealTint },
  compCardCoral: { backgroundColor: THEME.primaryTint },
  compArt: { position: 'absolute', width: 164, height: 110, right: -4, bottom: -3 },
  compArtCouple: { width: 186, height: 92, right: -13, bottom: 1 },
  compTitle: { zIndex: 1, marginBottom: 96, fontSize: 15, lineHeight: 22, fontWeight: '700', color: THEME.text, letterSpacing: -0.4 },
  compChevron: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.white,
    alignItems: 'center',
    justifyContent: 'center',
  },

  summaryLayer: { ...StyleSheet.absoluteFillObject, backgroundColor: THEME.white, zIndex: 1000 },
  summaryInner: { flex: 1, padding: 32 },
  summaryHeader: { fontSize: 36, fontWeight: '900', color: THEME.text, textAlign: 'center', marginTop: 80, marginBottom: 80 },
  summaryTotals: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 100 },
  totalItem: { alignItems: 'center' },
  totalValue: { fontSize: 48, fontWeight: '900', color: THEME.primary },
  totalLabel: { fontSize: 12, fontWeight: '900', color: THEME.textMuted, letterSpacing: 1.5, marginTop: 8 },
  summaryBtns: { flexDirection: 'row', gap: 20, marginTop: 'auto', paddingBottom: 30 },
  summaryDiscard: { flex: 1, padding: 24, borderRadius: 24, backgroundColor: THEME.surface, alignItems: 'center' },
  summaryDiscardText: { fontSize: 16, fontWeight: '900', color: THEME.textMuted },
  summarySave: { flex: 2, padding: 24, borderRadius: 24, backgroundColor: THEME.secondary, alignItems: 'center' },
  summarySaveDisabled: { opacity: 0.7 },
  summarySaveText: { color: THEME.white, fontSize: 16, fontWeight: '900', letterSpacing: 1 },
});
