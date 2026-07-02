import React, { useMemo, useState, useCallback, useRef, useEffect } from "react";
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  ScrollView,
  SafeAreaView,
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  UIManager,
  Alert,
} from "react-native";
import {
  Play,
  Pause,
  Square,
  Zap,
  Clock,
  ChevronRight,
  Trash2,
  Flame,
  MapPin,
  Watch,
  TrendingUp,
  Droplets,
  Footprints,
} from 'lucide-react-native';
import { router, useFocusEffect } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import RunMap from "@/components/RunMap";
import { getMappedDays } from "@/utils/planProjection";
import { API_BASE_URL } from "@/config/api";

// --- PROJECT IMPORTS ---
import { useRunTracker } from "@/hooks/useRunTracker";
import { loadRuns, saveRun } from "@/lib/run-storage";
import type { Run } from "@/types/run";
import { useAuth } from "@/src/auth/authContext";
import { useTabBar } from "@/contexts/TabBarContext";
import { useDailySummary } from '@/hooks/useDailySummary';
import { getRunMeta } from '@/constants/runDetails';
import { getIntervalWorkoutRouteFromTemplateId } from '@/lib/interval-workout';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width, height } = Dimensions.get('window');
const REDEEMED_WEEK_PREFIX = 'weekly_quest_redeemed_v1';

const THEME = {
  primary: '#FF4757',
  secondary: '#1A1C1E', 
  accent: '#70A1FF',
  bg: '#F8FAFC',
  surface: '#FFFFFF',
  text: '#1A1C1E',
  textMuted: '#64748B',
  white: '#FFFFFF',
  glass: 'rgba(255, 255, 255, 0.9)',
  primaryTint: 'rgba(255, 71, 87, 0.1)',
  primaryMuted: 'rgba(255, 71, 87, 0.6)',
  border: 'rgba(0, 0, 0, 0.05)',
};

export default function RunScreen() {
  const { accessToken, authFetch, isAuthenticated } = useAuth();
  const { setTabBarVisible } = useTabBar();
  const { summary, recalculate } = useDailySummary({ accessToken });
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

  const [historyRuns, setHistoryRuns] = useState<Run[]>([]);
  const [allRuns, setAllRuns] = useState<Run[]>([]);
  const [weeklyPlan, setWeeklyPlan] = useState<any[]>([]);
  const [trainingPlanWeekSessions, setTrainingPlanWeekSessions] = useState<any[]>([]);
  const [availableDays, setAvailableDays] = useState<number[]>([0, 2, 4]);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [liveQuestRedeemed, setLiveQuestRedeemed] = useState(false);
  const [liveQuestLoading, setLiveQuestLoading] = useState(true);
  
  const mapHeight = useRef(new Animated.Value(height * 0.45)).current;
  const hudAnim = useRef(new Animated.Value(0)).current;

  const fetchHistory = useCallback(async () => {
    const saved = await loadRuns();
    setAllRuns(saved);
    setHistoryRuns(saved.slice(0, 3)); 
  }, []);

  const fetchLiveQuestState = useCallback(async () => {
    try {
      setLiveQuestLoading(true);
      const now = new Date();
      const weekStart = new Date(now);
      const day = (weekStart.getDay() + 6) % 7;
      weekStart.setDate(weekStart.getDate() - day);
      weekStart.setHours(0, 0, 0, 0);
      const redeemedKey = `${REDEEMED_WEEK_PREFIX}:${weekStart.toISOString().slice(0, 10)}`;
      const redeemedRaw = await AsyncStorage.getItem(redeemedKey);
      setLiveQuestRedeemed(redeemedRaw === 'true');
    } catch (error) {
      console.error('Failed to load live quest state:', error);
      setLiveQuestRedeemed(false);
    } finally {
      setLiveQuestLoading(false);
    }
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
    fetchLiveQuestState();
    if (isAuthenticated) recalculate();
    // Restore tab bar when leaving the Run screen
    return () => {
      setTabBarVisible(true);
    };
  }, [fetchHistory, fetchPlanSettings, fetchTrainingPlan, fetchLiveQuestState, setTabBarVisible, isAuthenticated, recalculate]));

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    const isImmersive = state === 'running' || state === 'paused' || state === 'finished';
    setTabBarVisible(!isImmersive);
    Animated.parallel([
      Animated.timing(mapHeight, {
        toValue: isImmersive ? height : height * 0.45,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(hudAnim, {
        toValue: isImmersive ? 1 : 0,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      })
    ]).start();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, [isFocused, setTabBarVisible, state]);

  const startRun = async () => {
    if (runInfo.type === 'TODAY') {
      setTabBarVisible(false);
      const runMeta = getRunMeta(runInfo.runType);
      if (runMeta.launchMode === 'interval') {
        router.push({
          pathname: getIntervalWorkoutRouteFromTemplateId(runMeta.templateId),
          params: {
            sessionId: runInfo.sessionId || '',
            source: 'plan',
            distanceKm: String(runInfo.target || 0),
            weekContext: `Week ${currentWeek}`,
          }
        });
        return;
      }

      // Default to standard runscreen
      router.push({
        pathname: '/runs/runscreen',
        params: {
          sessionId: runInfo.sessionId || '',
          templateId: runMeta.templateId,
          distanceKm: String(runInfo.target || 5),
          weekContext: `Week ${currentWeek}`
        }
      });
      return;
    }
    setTabBarVisible(false);
    const started = await originalStartRun();
    if (!started) {
      setTabBarVisible(true);
    }
  };

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

  const liveQuest = useMemo(() => {
    const longestPlannedKm = projectedDays.reduce((max: number, day: any) => {
      if (day?.type !== 'RUN') return max;
      const targetKm = typeof day?.targetKm === 'number' ? day.targetKm : 0;
      return Math.max(max, targetKm);
    }, 0);

    if (longestPlannedKm <= 0) return null;

    const requiredKm = Number((longestPlannedKm * 2).toFixed(1));
    const weekStart = new Date();
    const day = (weekStart.getDay() + 6) % 7;
    weekStart.setDate(weekStart.getDate() - day);
    weekStart.setHours(0, 0, 0, 0);

    const completed = allRuns.some((run) => {
      const startedAt = new Date(run.startedAt).getTime();
      const runKm = (run.totalDistanceMeters || 0) / 1000;
      return startedAt >= weekStart.getTime() && runKm >= requiredKm;
    });

    return {
      id: weekStart.toISOString().slice(0, 10),
      title: `Run ${requiredKm}km this week`,
      description: liveQuestRedeemed
        ? 'Reward claimed.'
        : completed
          ? 'Ready to claim.'
          : `${requiredKm}km run to unlock reward.`,
      rewardLabel: '+100 PTS',
    };
  }, [projectedDays, allRuns, liveQuestRedeemed]);


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

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const getDateForDayIdx = useCallback((dayIdx: number) => {
    const today = new Date();
    const todayIdx = (today.getDay() + 6) % 7;
    const target = new Date(today);
    target.setDate(today.getDate() + (dayIdx - todayIdx));
    return target;
  }, []);

  const isImmersive = state === 'running' || state === 'paused' || state === 'finished';

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isImmersive ? "light-content" : "dark-content"} />

      {!isImmersive && (
        <SafeAreaView style={styles.floatingHeader}>
          <View style={styles.glassHeader}>
            <View>
              <Text style={styles.headerLabel}>{runInfo.title} • {runInfo.dayIdx == null ? formatDate(new Date()) : formatDate(getDateForDayIdx(runInfo.dayIdx))}</Text>
              <Text style={styles.headerValue}>{runInfo.label}</Text>
            </View>
            <TouchableOpacity style={styles.allRunsBtn} onPress={() => router.push('/runs/allruns')}>
              <Text style={styles.allRunsBtnText}>ALL RUNS</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      )}

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        scrollEnabled={!isImmersive}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        {/* ANIMATED MAP VIEWPORT */}
        <Animated.View style={[styles.mapViewport, { height: mapHeight }]}>
          <RunMap
            path={route.map(p => ({ latitude: p.lat, longitude: p.lon }))}
            currentLocation={smoothedLocation ? { latitude: smoothedLocation.lat, longitude: smoothedLocation.lon } : undefined}
            isRunning={state === 'running'}
          />

          {/* ACTIVE HUB COVER (Only when running) */}
          {isImmersive && (
            <Animated.View style={[styles.activeHud, { opacity: hudAnim, transform: [{ translateY: hudAnim.interpolate({ inputRange: [0, 1], outputRange: [100, 0] }) }] }]}>
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
          )}
        </Animated.View>

        {!isImmersive && (
          <View style={styles.dashboardContainer}>
            {/* OVERLAPPING INVITE BUTTON */}
            <View style={styles.overlapSection}>
              <TouchableOpacity style={styles.mainStartBtn} onPress={startRun} activeOpacity={0.9}>
                <View style={styles.startBtnContent}>
                  <Play size={16} color={THEME.primary} fill={THEME.primary} />
                  <Text style={styles.startBtnText}>
                    {runInfo.type === 'TODAY' 
                      ? `START ${runInfo.label.replace(' •', '').toUpperCase()}` 
                      : 'START RUN'
                    }
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.dashboardContent}>
              {/* 1. DAILY STATS */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>YOUR PROGRESS</Text>
                  <TouchableOpacity onPress={() => router.push({ pathname: '/activity', params: { tab: 'RUNNING' } })}>
                    <Text style={styles.seeAll}>SHOW MORE</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.statGrid}>
                  <View style={styles.premiumStatCard}>
                    <View style={styles.statIconHeader}>
                      <View style={[styles.statIconBg, { backgroundColor: THEME.primaryTint }]}>
                        <Flame size={14} color={THEME.primary} />
                      </View>
                    </View>
                    <Text style={styles.premiumStatValue}>{summary?.activeCalories || 0}</Text>
                    <Text style={styles.premiumStatLabel}>KCAL BURNED</Text>
                  </View>

                  <View style={styles.premiumStatCard}>
                    <View style={styles.statIconHeader}>
                      <View style={[styles.statIconBg, { backgroundColor: '#E0F2FE' }]}>
                        <MapPin size={14} color="#0EA5E9" />
                      </View>
                    </View>
                    <Text style={styles.premiumStatValue}>{(summary?.distanceKm || 0).toFixed(1)}</Text>
                    <Text style={styles.premiumStatLabel}>KM TODAY</Text>
                  </View>

                  <View style={styles.premiumStatCard}>
                    <View style={styles.statIconHeader}>
                      <View style={[styles.statIconBg, { backgroundColor: '#F0FDF4' }]}>
                        <Watch size={14} color="#22C55E" />
                      </View>
                    </View>
                    <Text style={styles.premiumStatValue}>{summary?.exerciseMinutes || 0}m</Text>
                    <Text style={styles.premiumStatLabel}>ACTIVE TIME</Text>
                  </View>
                </View>
              </View>

              {/* 2. QUESTS */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>LIVE QUESTS</Text>
                  <TouchableOpacity onPress={() => router.push('/quest')}>
                    <Text style={styles.seeAll}>OPEN</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.questStack}>
                  {liveQuestLoading ? (
                    <Text style={styles.statusMsg}>Loading missions...</Text>
                  ) : !liveQuest ? (
                    <Text style={styles.statusMsg}>No active quests.</Text>
                  ) : (
                    <TouchableOpacity
                      key={liveQuest.id}
                      style={styles.liveQuestCard}
                      activeOpacity={0.9}
                      onPress={() => router.push('/quest')}
                    >
                      <View style={styles.liveQuestTopRow}>
                        <View style={styles.liveQuestBadge}>
                          <Zap size={18} color={THEME.white} fill={THEME.white} />
                        </View>
                        <View style={styles.questInfo}>
                          <Text style={styles.liveQuestEyebrow}>Weekly Quest</Text>
                          <Text style={styles.questTitle}>{liveQuest.title}</Text>
                        </View>
                        <View style={styles.rewardTag}>
                          <Text style={styles.rewardText}>{liveQuest.rewardLabel}</Text>
                        </View>
                      </View>
                      <Text style={styles.questDesc}>{liveQuest.description}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* 3. RECENT RUNS */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>RECENT ACTIVITY</Text>
                  <TouchableOpacity onPress={() => router.push('/runs/history')}>
                    <Text style={styles.seeAll}>VIEW ALL</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.activityLog}>
                  {historyRuns.length === 0 ? (
                    <Text style={styles.statusMsg}>No runs recorded yet.</Text>
                  ) : (
                    historyRuns.map((r, idx) => (
                      <View key={r.id || idx} style={styles.activityItem}>
                        <View style={styles.dateBadge}>
                          <Text style={styles.dateDay}>{new Date(r.startedAt).getDate()}</Text>
                          <Text style={styles.dateMonth}>{new Date(r.startedAt).toLocaleDateString('en-US', {month: 'short'}).toUpperCase()}</Text>
                        </View>
                        <View style={styles.activityDetails}>
                          <Text style={styles.activityTitle}>{(r.totalDistanceMeters / 1000).toFixed(2)} km Run</Text>
                          <Text style={styles.activitySub}>{formatDuration(r.durationSeconds)} • {new Date(r.startedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</Text>
                        </View>
                        <ChevronRight size={18} color={THEME.textMuted} />
                      </View>
                    ))
                  )}
                </View>
              </View>

              <View style={{ height: 100 }} />
            </View>
          </View>
        )}
      </ScrollView>

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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  mapViewport: { width: '100%', overflow: 'hidden', backgroundColor: THEME.surface },
  floatingHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100 },
  glassHeader: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: 16, marginTop: 12, padding: 20, borderRadius: 28,
    backgroundColor: THEME.glass, elevation: 12, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 15,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)'
  },
  immersiveHeader: { backgroundColor: 'rgba(26, 28, 30, 0.85)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  headerLabel: { fontSize: 11, fontWeight: '800', color: THEME.textMuted, letterSpacing: 1 },
  headerValue: { fontSize: 20, fontWeight: '900', color: THEME.text, marginTop: 3 },
  allRunsBtn: { 
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    borderRadius: 14, 
    backgroundColor: THEME.white, 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderWidth: 1, 
    borderColor: THEME.border 
  },
  allRunsBtnText: {
    fontSize: 10,
    fontWeight: '900',
    color: THEME.text,
    letterSpacing: 0.5,
  },

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

  dashboardContainer: { flex: 1 },
  overlapSection: { width: '100%', height: 0, alignItems: 'center', zIndex: 150 },
  mainStartBtn: { 
    backgroundColor: THEME.secondary, 
    borderRadius: 25, 
    marginTop: -22,
    paddingHorizontal: 28, 
    paddingVertical: 12,
    alignSelf: 'center',
    justifyContent: 'center',
    shadowColor: THEME.primary, 
    shadowOpacity: 0.2, 
    shadowRadius: 10, 
    elevation: 6,
    borderWidth: 1.5, 
    borderColor: 'rgba(255,255,255,0.08)'
  },
  startBtnContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  startBtnText: { color: THEME.white, fontSize: 13, fontWeight: '900', letterSpacing: 1.2 },

  dashboardContent: { paddingHorizontal: 24, paddingTop: 60 },
  section: { marginBottom: 40 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '900', color: THEME.textMuted, letterSpacing: 1, textTransform: 'uppercase' },

  statGrid: { 
    flexDirection: 'row', 
    gap: 12,
  },
  premiumStatCard: { 
    flex: 1, 
    height: 120,
    backgroundColor: THEME.white, 
    borderRadius: 24, 
    padding: 16, 
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: THEME.border,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2
  },
  statIconHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  statIconBg: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  premiumStatValue: { fontSize: 22, fontWeight: '900', color: THEME.text, marginTop: 12 },
  premiumStatLabel: { fontSize: 9, fontWeight: '800', color: THEME.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' },

  questStack: { gap: 12 },
  liveQuestCard: {
    backgroundColor: THEME.white,
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    borderColor: THEME.border,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
    gap: 14,
  },
  liveQuestTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  liveQuestBadge: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: THEME.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: THEME.primary,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 3,
  },
  questInfo: { flex: 1 },
  liveQuestEyebrow: {
    fontSize: 10,
    fontWeight: '900',
    color: THEME.primary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  questTitle: { fontSize: 16, fontWeight: '800', color: THEME.text },
  questDesc: { fontSize: 13, color: THEME.textMuted, lineHeight: 19 },
  rewardTag: {
    backgroundColor: THEME.primaryTint,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  rewardText: { fontSize: 12, fontWeight: '900', color: THEME.primary },

  activityLog: { gap: 14 },
  activityItem: { 
    flexDirection: 'row', alignItems: 'center', gap: 16, padding: 14, 
    backgroundColor: THEME.white, borderRadius: 24, borderWidth: 1, borderColor: THEME.surface 
  },
  dateBadge: { width: 52, height: 52, borderRadius: 16, backgroundColor: THEME.surface, alignItems: 'center', justifyContent: 'center' },
  dateDay: { fontSize: 20, fontWeight: '900', color: THEME.text },
  dateMonth: { fontSize: 10, fontWeight: '900', color: THEME.textMuted },
  activityDetails: { flex: 1 },
  activityTitle: { fontSize: 16, fontWeight: '800', color: THEME.text },
  activitySub: { fontSize: 13, color: THEME.textMuted, marginTop: 2 },
  statusMsg: { textAlign: 'center', color: THEME.textMuted, padding: 30, fontStyle: 'italic', fontSize: 14 },
  seeAll: { fontSize: 11, fontWeight: '900', color: THEME.primary, letterSpacing: 1 },

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


