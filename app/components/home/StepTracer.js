// @refresh reset
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Send, X, Footprints, Shield, Check, ChevronRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Stop } from 'react-native-svg';
import Reanimated, {
  FadeInUp,
  FadeOut,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth/authContext';
import { API_BASE_URL } from '../../config/api';
import { useChat } from '../../contexts/ChatContext';
import { useRouter } from 'expo-router';
import { requestStepPermissions } from '../../lib/requestStepPermissions';
import { useDailyPoints } from '../../hooks/useDailyPoints';
import { useAutomaticDailyRewards } from '../../hooks/useAutomaticDailyRewards';
import { usePoints } from '../../hooks/usePoints';
import { useWaterSync } from '../../hooks/useWaterSync';
import Hydration from './Hydration';
import StepGoalStatus from './StepGoalStatus';
import { ReminderPartnerSheet } from '../partner/ReminderPartnerSheet';
import TugOfWar from '../battle/TugOfWar';
import { useGoalExpanded } from './CollapsibleGoal';

const WATER_GLASS_GOAL = 8;
const BATTLE_CAROUSEL_PEEK = 0;
const BATTLE_CAROUSEL_GAP = 6;
const DUEL_CARD_HEIGHT = 244;

const PARTNER_STEPS_STALE_THRESHOLD_MS = 2 * 60_000;
const PARTNER_REFRESH_MIN_CLIENT_INTERVAL_MS = 60_000;

const COLORS = {
  primary: '#FF6B6B',
  primaryLight: '#FFF1F2',
  teal: '#1F938A',
  partnerLight: '#F0FDFA',
  text: '#111827',
  textMuted: '#94A3B8',
  white: '#FFFFFF',
  dark: '#1E293B',
  connected: '#22C55E',
  disconnected: '#94A3B8',
  cardBg: '#F8FAFC',
};

const formatRemaining = (toIso) => {
  if (!toIso) return null;
  const ms = new Date(toIso).getTime() - Date.now();
  if (!Number.isFinite(ms)) return null;
  const clamped = Math.max(0, ms);
  const mins = Math.floor(clamped / 60000);
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hours}h ${rem}m`;
};

const dayKeyInTimezone = (date, timezone) => {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);

    const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
    const month = parts.find((p) => p.type === 'month')?.value ?? '01';
    const day = parts.find((p) => p.type === 'day')?.value ?? '01';
    return `${year}-${month}-${day}`;
  } catch {
    return null;
  }
};

const dayOfWeekFromDayKey = (dayKey) => {
  const parsed = parseDayKey(dayKey);
  if (!parsed) return null;
  const utcDay = parsed.getUTCDay();
  return utcDay === 0 ? 6 : utcDay - 1;
};

const parseDayKey = (dayKey) => {
  if (!dayKey || !/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return null;
  const parsed = new Date(`${dayKey}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDayKey = (dayKey) => {
  const parsed = parseDayKey(dayKey);
  if (!parsed) return dayKey;
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const getSplitDayDisplayState = ({
  splitDay,
  todayKey,
  otherTodayKey,
  liveSteps,
  lastDaySteps,
}) => {
  const startedNewDay = !!(splitDay && todayKey && otherTodayKey && todayKey > otherTodayKey);
  const pinned = startedNewDay;

  return {
    pinned,
    displaySteps: pinned ? lastDaySteps : liveSteps,
    subText: pinned ? `New day: ${liveSteps.toLocaleString()}` : null,
  };
};

const computeWinStreak = (days) => {
  if (!Array.isArray(days) || days.length === 0) {
    return { holder: null, count: 0 };
  }

  let holder = null;
  let count = 0;

  for (const day of days) {
    if (day?.winner === 'TIE') break;
    if (day?.winner !== 'YOU' && day?.winner !== 'PARTNER') break;

    if (holder === null) {
      holder = day.winner;
      count = 1;
      continue;
    }

    if (day.winner === holder) {
      count += 1;
      continue;
    }

    break;
  }

  return { holder, count };
};

const formatBattleName = (name, mode = 'first') => {
  const trimmed = String(name || '').trim();
  if (!trimmed) return '';
  if (mode === 'full') return trimmed.toUpperCase();
  return trimmed.split(/\s+/)[0].toUpperCase();
};

function StreakFlame({ urgent, size = 30 }) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (urgent) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.18, { duration: 550 }),
          withTiming(1, { duration: 550 })
        ),
        -1,
        false
      );
      return;
    }

    cancelAnimation(scale);
    scale.value = withTiming(1, { duration: 200 });
  }, [urgent, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Reanimated.View style={animatedStyle}>
      <Svg width={size} height={size * 1.3} viewBox="0 0 40 52">
        <Defs>
          <SvgLinearGradient id="steps-streak-flame" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FF7439" />
            <Stop offset="1" stopColor="#FFC34B" />
          </SvgLinearGradient>
        </Defs>
        <Path d="M20 2C24 14 10 18 10 29C7 26 7 23 8 20C-6 36 5 50 20 50C36 50 45 35 31 20C33 28 28 30 28 30C30 16 23 5 20 2Z" fill="url(#steps-streak-flame)" stroke="#FFF4CE" strokeWidth="1.2" />
        <Path d="M20 24C22 33 11 35 13 43C14 48 18 50 21 50C31 49 32 40 27 34C27 39 24 40 24 40C26 32 20 24 20 24Z" fill="#FFF1A8" />
      </Svg>
    </Reanimated.View>
  );
}

const StepSyncSection = ({
  onNudge,
  permissionEnabled,
  onPermissionChange,
  onPermissionGranted,
  myFallbackLiveSteps = 0,
  partnerFallbackLiveSteps = 0,
  fallbackPartnerName = 'PARTNER',
  isConnected = false,
  onStepMetricsChange,
  onWinStreakChange,
  onStreakLabelChange,
  requestedPage = null,
  headerActions = null,
  hideHeader = false,
}) => {
  const { accessToken, authFetch, user } = useAuth();
  const goalExpanded = useGoalExpanded();
  const { sendMessage } = useChat();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { glassCount } = useWaterSync({ accessToken });

  const [showMotivateModal, setShowMotivateModal] = useState(false);
  const [nudgeSent, setNudgeSent] = useState(false);
  const [tracerState, setTracerState] = useState(null);
  const [myStepsTarget, setMyStepsTarget] = useState(null);
  const [dailyPointsContext, setDailyPointsContext] = useState(null);
  const [countdownText, setCountdownText] = useState('');
  const [showLastMonthModal, setShowLastMonthModal] = useState(false);
  const [requestingPermission, setRequestingPermission] = useState(false);
  const [battlePage, setBattlePage] = useState(0);
  const [battlePageWidth, setBattlePageWidth] = useState(0);
  const battlePagerRef = useRef(null);
  const lastPartnerRefreshRequestAtRef = useRef(0);

  const maybeRequestPartnerRefresh = useCallback(async (partnerStepsUpdatedAtIso) => {
    // Only iOS partners can be woken via silent APNs push. Skipping on other
    // platforms avoids unnecessary network calls but the server-side check is
    // still the source of truth (it looks at the partner's apnsDeviceToken).
    if (Platform.OS !== 'ios') return;

    const nowMs = Date.now();
    if (nowMs - lastPartnerRefreshRequestAtRef.current < PARTNER_REFRESH_MIN_CLIENT_INTERVAL_MS) {
      return;
    }

    const partnerUpdatedAtMs = partnerStepsUpdatedAtIso
      ? new Date(partnerStepsUpdatedAtIso).getTime()
      : null;
    const partnerIsStale =
      partnerUpdatedAtMs === null ||
      !Number.isFinite(partnerUpdatedAtMs) ||
      nowMs - partnerUpdatedAtMs > PARTNER_STEPS_STALE_THRESHOLD_MS;

    if (!partnerIsStale) return;

    lastPartnerRefreshRequestAtRef.current = nowMs;
    try {
      await authFetch(`${API_BASE_URL}/activity/steps/request-partner-refresh`, {
        method: 'POST',
      });
    } catch {
      // Best-effort: partner will still refresh via their own background sync.
    }
  }, [authFetch]);

  const fetchTracerState = useCallback(async () => {
    if (!accessToken) return;
    try {
      const [tracerResult, weekResult] = await Promise.allSettled([
        authFetch(`${API_BASE_URL}/activity/steps/tracer-state`),
        authFetch(`${API_BASE_URL}/summary/week`),
      ]);

      let userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

      if (tracerResult.status === 'fulfilled' && tracerResult.value.ok) {
        const json = await tracerResult.value.json();
        setTracerState(json);
        userTimezone = json?.participants?.you?.timezone || userTimezone;

        if (json?.hasPartner) {
          maybeRequestPartnerRefresh(json?.participants?.partner?.stepsUpdatedAt);
        }
      }

      if (weekResult.status === 'fulfilled' && weekResult.value.ok) {
        const weekJson = await weekResult.value.json();
        const currentWeek = Number(weekJson?.currentWeek);
        const todayKey = dayKeyInTimezone(new Date(), userTimezone);
        const todayDayOfWeek = dayOfWeekFromDayKey(todayKey);

        if (Number.isFinite(currentWeek) && currentWeek > 0 && Number.isInteger(todayDayOfWeek)) {
          const dailyPlanResponse = await authFetch(`${API_BASE_URL}/plan/daily/${currentWeek}`);
          if (dailyPlanResponse.ok) {
            const dailyPlanJson = await dailyPlanResponse.json();
            const todayTarget = Array.isArray(dailyPlanJson?.days)
              ? dailyPlanJson.days.find((day) => Number(day?.dayOfWeek) === todayDayOfWeek)
              : null;
            const nextStepsTarget = Number(todayTarget?.stepsTarget);
            if (Number.isFinite(nextStepsTarget) && nextStepsTarget > 0) {
              setMyStepsTarget(nextStepsTarget);
              setDailyPointsContext({
                dayKey: todayKey,
                isRunDay: String(todayTarget?.dayType || '').toUpperCase() === 'RUN',
              });
            }
          }
        }
      }
    } catch {
      // Keep existing fallback UI values if tracer-state fails.
    }
  }, [accessToken, authFetch, maybeRequestPartnerRefresh]);

  useEffect(() => {
    fetchTracerState();
    const id = setInterval(fetchTracerState, 45_000);
    return () => clearInterval(id);
  }, [fetchTracerState]);

  useEffect(() => {
    const isSplit = tracerState?.transition?.isSplitDay;
    const toUtc = tracerState?.transition?.countdownToUtc;
    const label = tracerState?.transition?.countdownLabel;
    if (!isSplit || !toUtc) {
      setCountdownText('');
      return;
    }

    const update = () => {
      const timeText = formatRemaining(toUtc);
      if (!timeText) {
        setCountdownText(label || '');
        return;
      }
      const staticLabel = label ? label.replace(/in\s+\d+h\s+\d+m/i, '').trim() : "Day ends";
      setCountdownText(`${staticLabel} in ${timeText}`);
    };

    update();
    const tick = setInterval(update, 30_000);
    return () => clearInterval(tick);
  }, [tracerState]);

  const syncedMySteps = tracerState?.participants?.you?.liveTodaySteps ?? 0;
  const liveMySteps = Math.max(syncedMySteps, myFallbackLiveSteps ?? 0);
  const livePartnerSteps = tracerState?.participants?.partner?.liveTodaySteps ?? partnerFallbackLiveSteps ?? 0;
  const compareMySteps = tracerState?.comparison?.youSteps ?? liveMySteps;
  const comparePartnerSteps = tracerState?.comparison?.partnerSteps ?? livePartnerSteps;
  const splitDay = !!tracerState?.transition?.isSplitDay;
  const myLastDay = tracerState?.participants?.you?.lastDaySteps ?? tracerState?.yesterday?.youSteps ?? 0;
  const partnerLastDay = tracerState?.participants?.partner?.lastDaySteps ?? tracerState?.yesterday?.partnerSteps ?? 0;
  const myTimezone = tracerState?.participants?.you?.timezone || 'UTC';
  const partnerTimezone = tracerState?.participants?.partner?.timezone || 'UTC';

  const now = new Date();
  const myTodayKey = dayKeyInTimezone(now, myTimezone);
  const partnerTodayKey = dayKeyInTimezone(now, partnerTimezone);
  const {
    displaySteps: myDisplaySteps,
  } = getSplitDayDisplayState({
    splitDay,
    todayKey: myTodayKey,
    otherTodayKey: partnerTodayKey,
    liveSteps: liveMySteps,
    lastDaySteps: myLastDay,
  });
  const {
    displaySteps: partnerDisplaySteps,
  } = getSplitDayDisplayState({
    splitDay,
    todayKey: partnerTodayKey,
    otherTodayKey: myTodayKey,
    liveSteps: livePartnerSteps,
    lastDaySteps: partnerLastDay,
  });

  useEffect(() => {
    onStepMetricsChange?.({
      current: myDisplaySteps,
      target: myStepsTarget || 10000,
    });
  }, [myDisplaySteps, myStepsTarget, onStepMetricsChange]);

  const barMySteps = myDisplaySteps;
  const barPartnerSteps = partnerDisplaySteps;

  const dailyPointsConfig = useMemo(() => ({
    isRunDay: !!dailyPointsContext?.isRunDay,
    hasMobility: true,
    hasHydration: true,
    stepsProgress: myStepsTarget
      ? Math.min(Math.max(liveMySteps / myStepsTarget, 0), 1)
      : 0,
    caloriesProgress: 0,
    mobilityProgress: 0,
    hydrationProgress: Math.min(Math.max(glassCount / WATER_GLASS_GOAL, 0), 1),
    walkRunProgress: 0,
  }), [dailyPointsContext?.isRunDay, glassCount, liveMySteps, myStepsTarget]);

  const { categories: dailyPointCategories, loading: dailyPointsLoading, error: dailyPointsError, claimPoints } = useDailyPoints({
    accessToken,
    dayKey: dailyPointsContext?.dayKey || '',
    config: dailyPointsConfig,
  });

  const { balance: pointsBalance } = usePoints({ accessToken });
  useAutomaticDailyRewards({
    accessToken,
    dayKey: dailyPointsContext?.dayKey || '',
    categories: dailyPointCategories,
    enabled: !dailyPointsLoading && !dailyPointsError,
    claimPoints,
  });

  const battleSlideWidth = battlePageWidth > 0
    ? battlePageWidth - BATTLE_CAROUSEL_PEEK
    : 0;
  const battleSnapInterval = battleSlideWidth + BATTLE_CAROUSEL_GAP;

  const scrollToBattlePage = useCallback((pageIndex) => {
    if (!battleSnapInterval) return;
    battlePagerRef.current?.scrollTo({ x: battleSnapInterval * pageIndex, animated: true });
    setBattlePage(pageIndex);
  }, [battleSnapInterval]);

  useEffect(() => {
    if (!requestedPage || battlePageWidth <= 0) return;
    scrollToBattlePage(requestedPage.page);
  }, [requestedPage, battlePageWidth, scrollToBattlePage]);

  const partnerDisplayName = formatBattleName(
    tracerState?.participants?.partner?.name || fallbackPartnerName || 'PARTNER',
    'first'
  ) || 'PARTNER';
  const youBackdropName = formatBattleName(
    tracerState?.participants?.you?.name || user?.displayName || user?.name,
    'first'
  ) || 'YOU';
  const partnerBackdropName = formatBattleName(
    tracerState?.participants?.partner?.name || fallbackPartnerName || 'PARTNER',
    'full'
  ) || 'PARTNER';

  const last30Days = useMemo(() => {
    const lastMonthDays = Array.isArray(tracerState?.lastMonth?.days) ? tracerState.lastMonth.days : [];
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - 29);

    const days = lastMonthDays
      .filter((day) => {
        const parsed = parseDayKey(day?.dayKey);
        return !!parsed && parsed >= start;
      })
      .sort((a, b) => String(b.dayKey).localeCompare(String(a.dayKey)));

    return days.reduce((acc, day) => {
      if (day.winner === 'YOU') acc.youWins += 1;
      else if (day.winner === 'PARTNER') acc.partnerWins += 1;
      else acc.ties += 1;
      acc.comparedDays += 1;
      return acc;
    }, { days, youWins: 0, partnerWins: 0, ties: 0, comparedDays: 0 });
  }, [tracerState?.lastMonth?.days]);

  const winStreak = useMemo(
    () => computeWinStreak(last30Days.days),
    [last30Days.days]
  );

  useEffect(() => {
    if (!tracerState) return;
    onWinStreakChange?.(winStreak.holder === 'YOU' ? winStreak.count : 0);
  }, [tracerState, winStreak.holder, winStreak.count, onWinStreakChange]);

  const streakLabel = useMemo(() => {
    if (!winStreak.holder || winStreak.count < 1) return null;

    return {
      holder: winStreak.holder,
      count: winStreak.count,
      name: winStreak.holder === 'YOU' ? 'YOU' : partnerDisplayName,
      color: winStreak.holder === 'YOU' ? COLORS.primary : COLORS.teal,
    };
  }, [winStreak, partnerDisplayName]);

  useEffect(() => { onStreakLabelChange?.(streakLabel); }, [onStreakLabelChange, streakLabel]);

  const streakAtRisk = useMemo(() => {
    if (!streakLabel || streakLabel.holder !== 'YOU') return false;
    return compareMySteps <= comparePartnerSteps;
  }, [streakLabel, compareMySteps, comparePartnerSteps]);

  const partnerReminderName = String(
    tracerState?.participants?.partner?.name || fallbackPartnerName || 'Partner'
  ).trim() || 'Partner';

  const handleSendReminder = useCallback((message, label) => {
    if (sendMessage) {
      sendMessage(message);
    }

    setNudgeSent(true);
    onNudge?.(label);

    setTimeout(() => {
      setNudgeSent(false);
    }, 3000);
  }, [onNudge, sendMessage]);

  const handleEnablePermission = useCallback(async () => {
    if (requestingPermission) {
      return;
    }

    try {
      setRequestingPermission(true);
      const granted = await requestStepPermissions();
      if (!granted) {
        return;
      }

      onPermissionChange?.(true);
      onPermissionGranted?.();
    } finally {
      setRequestingPermission(false);
    }
  }, [onPermissionChange, onPermissionGranted, requestingPermission]);

  const movementTarget = myStepsTarget || 10000;
  const movementSteps = Math.max(0, liveMySteps);
  const movementProgress = Math.min(movementSteps / movementTarget, 1);
  const remainingMovementSteps = Math.max(0, movementTarget - movementSteps);
  const movementHeading = (
    <View style={styles.goalHeader}>
      <View style={[styles.goalTitleRow, hideHeader && { display: 'none' }]}>
        <View style={styles.goalBadge}>
          <Text style={styles.goalBadgeText}>2</Text>
        </View>
        <TouchableOpacity accessibilityRole="link" accessibilityLabel="Complete your steps goal, open full couple fit battle" onPress={() => router.push('/StepbattleFull')} style={styles.goalTitleLink}>
          <Text numberOfLines={1} adjustsFontSizeToFit style={styles.goalTitle}>Complete your steps goal</Text>
          <ChevronRight size={14} color={COLORS.primary} strokeWidth={2.5} />
        </TouchableOpacity>
        <StepGoalStatus steps={movementSteps} target={movementTarget} />
      </View>
    </View>
  );

  if (permissionEnabled === null || typeof permissionEnabled === 'undefined') {
    return (
      <View style={[styles.container, hideHeader && styles.embedded]}>
        {!hideHeader && movementHeading}
        {headerActions && <View style={{ alignItems: 'flex-end', marginBottom: 12 }}>{headerActions}</View>}
      <View style={styles.permissionCard}>
        <View style={styles.permissionIconWrap}>
          <Footprints size={20} color={COLORS.primary} strokeWidth={2.5} />
        </View>
        <View style={styles.permissionCopy}>
          <Text style={styles.permissionTitle}>Loading step access</Text>
          <Text style={styles.permissionBody}>Checking whether step tracking is already enabled.</Text>
        </View>
        <ActivityIndicator color={COLORS.primary} />
      </View>
      </View>
    );
  }

  if (!permissionEnabled) {
    return (
      <View style={[styles.container, hideHeader && styles.embedded]}>
        {!hideHeader && movementHeading}
        {headerActions && <View style={{ alignItems: 'flex-end', marginBottom: 12 }}>{headerActions}</View>}
      <View style={styles.permissionCard}>
        <View style={styles.permissionIconWrap}>
          <Shield size={20} color={COLORS.primary} strokeWidth={2.5} />
        </View>
        <View style={styles.permissionCopy}>
          <Text style={styles.permissionTitle}>Turn on step tracking</Text>
          <Text style={styles.permissionBody}>
            Allow step tracking to compare your daily steps with your partner.
          </Text>
        </View>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={handleEnablePermission}
          disabled={requestingPermission}
          activeOpacity={0.85}
        >
          {requestingPermission ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.permissionButtonText}>Enable</Text>
          )}
        </TouchableOpacity>
      </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, hideHeader && styles.embedded]}>
      {headerActions ? <View style={styles.goalActions}>{headerActions}</View> : null}
      {!hideHeader && <View style={styles.header}>
        <View style={styles.titleGroup}>
          <View style={[styles.goalTitleRow, hideHeader && { display: 'none' }]}>
            {battlePage === 0 ? <View style={styles.goalBadge}><Text style={styles.goalBadgeText}>2</Text></View> : null}
            <TouchableOpacity accessibilityRole="link" accessibilityLabel={`${battlePage === 0 ? 'Complete your steps goal' : 'Hydration'}, open full couple fit battle`} onPress={() => router.push('/StepbattleFull')} style={styles.goalTitleLink}>
              <Text numberOfLines={1} adjustsFontSizeToFit style={styles.goalTitle}>{battlePage === 0 ? 'Complete your steps goal' : 'HYDRATION'}</Text>
              <ChevronRight size={14} color={COLORS.primary} strokeWidth={2.5} />
            </TouchableOpacity>
            {battlePage === 0 && <StepGoalStatus steps={movementSteps} target={movementTarget} />}
          </View>
          {!hideHeader && battlePage === 0 && streakLabel ? (
            <LinearGradient
              colors={['#FFE7DA', '#FFCDBB', '#FFB3A4']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.streakPill}
            >
              <StreakFlame
                urgent={streakAtRisk}
                size={16}
              />
              <Text
                style={styles.streakPillText}
                numberOfLines={1}
              >
                {streakLabel.name} · {streakLabel.count}-day streak
              </Text>
            </LinearGradient>
          ) : null}
        </View>
      </View>}

      {battlePage === 0 && splitDay && !!countdownText && (
        <View style={styles.countdownPill}>
          <Text style={styles.countdownText}>{countdownText}</Text>
        </View>
      )}

      <View
        style={styles.carouselWrap}
        onLayout={(event) => {
          const nextWidth = event.nativeEvent.layout.width;
          if (nextWidth > 0) setBattlePageWidth(nextWidth);
        }}
      >
        {battlePageWidth > 0 ? (
          <ScrollView
            ref={battlePagerRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={battleSnapInterval}
            snapToAlignment="start"
            disableIntervalMomentum
            onMomentumScrollEnd={(event) => {
              const x = event.nativeEvent.contentOffset.x;
              setBattlePage(Math.round(x / battleSnapInterval));
            }}
            scrollEventThrottle={16}
            contentContainerStyle={styles.carouselContent}
          >
            <View style={[styles.carouselSlide, { width: battleSlideWidth, minHeight: DUEL_CARD_HEIGHT }]}>
              <TouchableOpacity
                style={[styles.duelCard, styles.duelCardFill, styles.movementDuelCard]}
                activeOpacity={0.92}
                accessible={false}
                onPress={() => setShowLastMonthModal(true)}
              >
        <View style={[styles.tugArena, { height: Math.round(battleSlideWidth * 9 / 16) + 48 }]}>
          <TugOfWar
            share={barMySteps + barPartnerSteps > 0 ? barMySteps / (barMySteps + barPartnerSteps) : 0.5}
            youSteps={barMySteps}
            partnerSteps={barPartnerSteps}
            you={youBackdropName}
            partner={partnerBackdropName}
            gender={user?.gender}
            difference={barMySteps - barPartnerSteps}
            arenaWidth={battleSlideWidth}
            cardColor={COLORS.white}
            dark={false}
            showCrowns
            showGround={false}
            showStepLabels
            stepCountSize={36}
            onNamePress={() => router.push('/StepbattleFull')}
            visible={goalExpanded && battlePage === 0 && !showLastMonthModal && !showMotivateModal}
          />
        </View>
      <View style={styles.movementSummary}>
        <View style={styles.personalGoalHeader}>
          <View style={styles.personalGoalTitle}>
            <Text style={styles.personalGoalLabel}>Personal goal</Text>
          </View>
          <Text style={styles.personalGoalCount}>
            {movementSteps.toLocaleString()}
            <Text style={styles.personalGoalValue}> / {movementTarget.toLocaleString()}</Text>
          </Text>
          <View style={styles.personalGoalPercentage}>
            {remainingMovementSteps === 0 ? <Check size={12} color={COLORS.dark} strokeWidth={3} /> : null}
            <Text style={styles.personalGoalPercentageText}>{Math.round(movementProgress * 100)}%</Text>
          </View>
        </View>
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="Personal step goal"
          accessibilityValue={{ min: 0, max: movementTarget, now: Math.min(movementSteps, movementTarget) }}
          style={styles.movementTrack}
        >
          <View style={[styles.movementFill, { width: `${movementProgress * 100}%` }]} />
        </View>
        <Text style={styles.movementRemaining}>
          {remainingMovementSteps > 0 ? `${remainingMovementSteps.toLocaleString()} steps left` : 'Movement goal complete'}
        </Text>

      </View>
              </TouchableOpacity>
            </View>

            <View style={[styles.carouselSlide, { width: battleSlideWidth, minHeight: DUEL_CARD_HEIGHT }]}>
              <Hydration partnerDisplayName={partnerDisplayName} cardStyle={styles.duelCard} />
            </View>
          </ScrollView>
        ) : null}
      </View>

      <View style={styles.battleZone}>
        {battlePage === 0 ? (
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.walkAction}
          activeOpacity={0.7}
          onPress={(event) => {
            event.stopPropagation();
            router.push({ pathname: '/runs/runscreen', params: { templateId: 'walk' } });
          }}
        >
          <Text style={styles.walkActionText}>Convert to a walk</Text>
          <ChevronRight size={20} color={COLORS.primary} strokeWidth={3} />
        </TouchableOpacity>
        ) : <View style={{ flex: 1 }} />}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Motivate your partner"
          onPress={() => setShowMotivateModal(true)}
          style={styles.motivateAction}
          activeOpacity={0.7}
        >
          <Send size={14} color={COLORS.dark} strokeWidth={2} />
          <Text style={styles.motivateActionText}>Motivate</Text>
        </TouchableOpacity>
      </View>

      <ReminderPartnerSheet
        visible={showMotivateModal}
        onClose={() => setShowMotivateModal(false)}
        bottomInset={insets.bottom}
        partnerName={partnerReminderName}
        pointsBalance={pointsBalance}
        pointsLoading={dailyPointsLoading}
        chatConnected={isConnected}
        onSendReminder={handleSendReminder}
      />

      {nudgeSent && (
        <Reanimated.View entering={FadeInUp} exiting={FadeOut} style={styles.sentOverlay}>
          <View style={styles.sentPill}>
            <Check size={14} color="#FFF" strokeWidth={2.5} />
            <Text style={styles.sentPillText}>Sent to {partnerDisplayName}</Text>
          </View>
        </Reanimated.View>
      )}

      <Modal
        visible={showLastMonthModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowLastMonthModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Step History</Text>
                <Text style={styles.modalSub}>Day by day totals</Text>
              </View>
              <TouchableOpacity onPress={() => setShowLastMonthModal(false)} style={styles.closeBtn}>
                <X size={18} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalLegend}>
              <Text style={styles.modalLegendText}>YOU</Text>
              <Text style={styles.modalLegendText}>{partnerDisplayName}</Text>
              <Text style={styles.modalLegendText}>WINNER</Text>
            </View>

            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              {last30Days.days.length === 0 ? (
                <Text style={styles.emptyListText}>No daily step history yet.</Text>
              ) : (
                last30Days.days.map((day) => (
                  <View key={day.dayKey} style={styles.dayRow}>
                    <View style={styles.dayLeft}>
                      <Text style={styles.dayKeyText}>{formatDayKey(day.dayKey)}</Text>
                    </View>
                    <Text style={styles.dayStepsText}>{Number(day.youSteps || 0).toLocaleString()}</Text>
                    <Text style={styles.dayStepsText}>{Number(day.partnerSteps || 0).toLocaleString()}</Text>
                    <Text style={[
                      styles.dayWinnerText,
                      day.winner === 'YOU'
                        ? { color: COLORS.primary }
                        : day.winner === 'PARTNER'
                          ? { color: COLORS.teal }
                          : { color: '#64748B' }
                    ]}>
                      {day.winner === 'YOU' ? 'YOU' : day.winner === 'PARTNER' ? partnerDisplayName : 'TIE'}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  embedded: { marginHorizontal: 0, paddingHorizontal: 0, paddingVertical: 0 },
  container: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    marginHorizontal: -20,
  },
  goalHeader: { flexDirection: 'row', alignItems: 'center', minHeight: 36, paddingLeft: 32, marginBottom: 12 },
  goalBadge: {
    position: 'absolute', left: -40, top: '50%', transform: [{ translateY: -14 }],
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
  },
  goalBadgeText: { color: COLORS.white, fontSize: 18, fontWeight: '900' },
  goalTitle: { flexShrink: 1, minWidth: 0, color: COLORS.text, fontSize: 20, lineHeight: 26, fontWeight: '700', letterSpacing: -0.3 },
  goalTitleRow: { flexShrink: 1, width: '100%', minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  goalTitleLink: { flex: 1, minWidth: 0, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4 },
  movementDuelCard: { borderWidth: 0, borderRadius: 0, paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0, minHeight: 0, backgroundColor: 'transparent', justifyContent: 'flex-start' },
  movementSummary: { gap: 4, marginTop: 0, paddingHorizontal: 4, paddingVertical: 4 },
  personalGoalHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  personalGoalTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  personalGoalLabel: { color: '#64748B', fontSize: 11, fontWeight: '500' },
  personalGoalPercentage: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  personalGoalPercentageText: { color: COLORS.dark, fontSize: 11, fontWeight: '600', fontVariant: ['tabular-nums'] },
  personalGoalCount: { flexGrow: 1, textAlign: 'right', color: COLORS.text, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  personalGoalValue: { color: '#64748B', fontSize: 12, fontWeight: '500', fontVariant: ['tabular-nums'] },
  motivateAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 14, minHeight: 44, borderRadius: 22, borderCurve: 'continuous', backgroundColor: '#F1F5F9' },
  motivateActionText: { color: COLORS.dark, fontSize: 13, fontWeight: '600' },
  movementCount: { color: COLORS.text, fontSize: 24, fontWeight: '900', fontVariant: ['tabular-nums'], letterSpacing: -1 },
  movementTarget: { fontSize: 18, fontWeight: '700', letterSpacing: -0.5 },
  movementTrack: { height: 3, borderRadius: 6, backgroundColor: '#E5E7EB', overflow: 'hidden' },
  movementFill: { height: '100%', borderRadius: 6, backgroundColor: COLORS.primary },
  movementRemaining: { color: '#64748B', fontSize: 10, fontVariant: ['tabular-nums'] },
  walkAction: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', minHeight: 44 },
  walkActionText: { color: COLORS.primary, fontSize: 17, fontWeight: '800' },
  goalActions: { alignItems: 'flex-end', marginBottom: 12 },
  permissionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFF5F5',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 16,
  },
  permissionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#FFE4E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionCopy: {
    flex: 1,
  },
  permissionTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.text,
    marginBottom: 4,
  },
  permissionBody: {
    fontSize: 12,
    lineHeight: 18,
    color: '#64748B',
    fontWeight: '600',
  },
  permissionButton: {
    minWidth: 88,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  permissionButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  header: {
    paddingLeft: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 36,
    marginBottom: 12
  },
  titleGroup: { flex: 1, minWidth: 0, alignItems: 'flex-start', gap: 5 },
  headerTitle: { fontSize: 16, fontWeight: '900', color: COLORS.text, letterSpacing: -0.5 },
  streakPill: {
    flexShrink: 1,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#FFE8D9',
  },
  streakPillYou: {
    backgroundColor: '#FFF1F2',
  },
  streakPillPartner: {
    backgroundColor: '#F0FDFA',
  },
  streakPillAtRisk: {
    backgroundColor: '#FFF7ED',
  },
  streakPillText: {
    flexShrink: 1,
    color: '#7E2C20',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  countdownPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginBottom: 12,
    marginTop: -4,
  },
  countdownText: { 
    fontSize: 10, 
    color: COLORS.textMuted, 
    fontWeight: '600',
    letterSpacing: 0.2
  },
  carouselWrap: {
    width: '100%',
    overflow: 'visible',
  },
  carouselContent: {
    paddingRight: Math.max(0, BATTLE_CAROUSEL_PEEK - BATTLE_CAROUSEL_GAP),
  },
  carouselSlide: {
    marginRight: BATTLE_CAROUSEL_GAP,
    alignSelf: 'stretch',
  },
  duelCard: {
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEF2F6',
    paddingTop: 14,
    paddingBottom: 14,
    paddingHorizontal: 10,
    overflow: 'hidden',
    width: '100%',
    minHeight: DUEL_CARD_HEIGHT,
    justifyContent: 'space-between',
  },
  duelCardFill: {
    flex: 1,
  },
  tugArena: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: 16,
    borderCurve: 'continuous',
    marginBottom: 0,
  },
  tugNames: {
    position: 'absolute', left: 12, right: 12, bottom: 0, height: 34,
    flexDirection: 'row', alignItems: 'center', gap: 32,
  },
  tugName: { flex: 1, minWidth: 0, fontSize: 11, fontWeight: '800' },
  avatarSteps: { flexDirection: 'row', justifyContent: 'space-between', gap: 24, marginTop: -20, paddingBottom: 16 },
  avatarName: { color: COLORS.text, fontSize: 12, fontWeight: '700', marginBottom: 4 },
  youAvatarSteps: { minHeight: 64 },
  partnerAvatarSteps: { minHeight: 64 },
  duelRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    width: '100%',
  },
  playerColumn: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
    maxWidth: '46%',
    paddingHorizontal: 4,
    overflow: 'hidden',
  },
  playerNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    width: '100%',
    minWidth: 0,
    paddingHorizontal: 2,
  },
  playerNumber: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
    lineHeight: 34,
    textAlign: 'center',
    flexShrink: 1,
    minWidth: 0,
  },
  playerMeta: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    textAlign: 'center',
    width: '100%',
  },
  playerSub: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textAlign: 'center',
    width: '100%',
  },
  vsColumn: {
    width: 40,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 5,
  },
  vsBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vsText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
    fontStyle: 'italic',
  },
  duelBarWrap: {
    marginTop: 12,
    paddingHorizontal: 4,
  },
  barContainer: {
    height: 12,
    width: '100%',
    flexDirection: 'row',
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
  },
  barSegment: { height: '100%' },
  battleZone: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  pointsProgressCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  pointsProgressLoading: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  pointsProgressTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  pointsProgressCopy: {
    flex: 1,
    minWidth: 0,
  },
  pointsTotalColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
    paddingLeft: 4,
    gap: 4,
  },
  pointsTotalValue: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.text,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  pointsProgressMeta: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.text,
    lineHeight: 15,
    fontVariant: ['tabular-nums'],
  },
  pointsProgressHint: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  battleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    borderCurve: 'continuous',
    backgroundColor: COLORS.dark,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignSelf: 'stretch',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  battleBtnCompact: {
    width: 112,
    paddingHorizontal: 12,
  },
  battleBtnFull: {
    flex: 1,
    width: 'auto',
  },
  battleBtnText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: -0.2,
  },
  closeBtn: { padding: 4 },
  sentOverlay: {
    position: 'absolute',
    bottom: -10,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100
  },
  sentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderCurve: 'continuous',
    backgroundColor: COLORS.primary,
    gap: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  sentPillText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: -0.1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    maxHeight: '82%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.text,
  },
  modalSub: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '700',
    marginTop: 2,
  },
  modalLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  modalLegendText: {
    width: '30%',
    fontSize: 10,
    fontWeight: '900',
    color: '#64748B',
  },
  modalList: {
    maxHeight: 420,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#EEF2F7',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  dayLeft: {
    width: '30%',
  },
  dayKeyText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.text,
  },
  dayStepsText: {
    width: '20%',
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
    textAlign: 'right',
  },
  dayWinnerText: {
    width: '22%',
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'right',
  },
  emptyListText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 24,
  },
});

export default StepSyncSection;
