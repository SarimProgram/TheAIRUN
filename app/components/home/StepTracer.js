// @refresh reset
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Modal,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Send, X, Pin, Footprints, Shield, Crown, Flame, Heart, Check } from 'lucide-react-native';
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
import { usePoints } from '../../hooks/usePoints';
import { useWaterSync } from '../../hooks/useWaterSync';
import Hydration from './Hydration';
import { ReminderPartnerSheet } from '../partner/ReminderPartnerSheet';
import {
  WALK_IMAGE,
  getOppositeGender,
  isWalkMascotMaleHalf,
  shouldMirrorWalkMascot,
} from '../../utils/genderMascot';

const WATER_GLASS_GOAL = 8;
const BATTLE_CAROUSEL_PEEK = 10;
const BATTLE_CAROUSEL_GAP = 6;
const DUEL_CARD_HEIGHT = 244;
const WALK_MASCOT_WIDTH = 84;
const WALK_MASCOT_HEIGHT = 108;

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

const splitBackdropName = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { line1: (parts[0] || '').toUpperCase(), line2: null };
  }

  return {
    line1: parts[0].toUpperCase(),
    line2: parts.slice(1).join(' ').toUpperCase(),
  };
};

function WalkMascot({ gender, facing = 'right', style }) {
  const isMale = isWalkMascotMaleHalf(gender);
  const mirrored = shouldMirrorWalkMascot(gender, facing);

  return (
    <View
      style={[
        styles.walkMascotClip,
        { width: WALK_MASCOT_WIDTH, height: WALK_MASCOT_HEIGHT },
        style,
      ]}
    >
      <View style={[styles.walkMascotInner, mirrored && styles.walkMascotMirrored]}>
        <Image
          source={WALK_IMAGE}
          style={[
            styles.walkMascotSprite,
            {
              width: WALK_MASCOT_WIDTH * 2,
              height: WALK_MASCOT_HEIGHT,
              marginLeft: isMale ? -WALK_MASCOT_WIDTH : 0,
            },
          ]}
          resizeMode="contain"
        />
      </View>
    </View>
  );
}

function PlayerNameBackdrop({ name, color }) {
  const { line1, line2 } = splitBackdropName(name);

  return (
    <View style={styles.playerNameBackdropWrap}>
      <Text
        style={[styles.playerNameBackdrop, { color }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.72}
      >
        {line1}
      </Text>
      {line2 ? (
        <Text
          style={[styles.playerNameBackdrop, styles.playerNameBackdropSecond, { color }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.72}
        >
          {line2}
        </Text>
      ) : null}
    </View>
  );
}

function StreakFlame({ color, urgent, size = 30 }) {
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
      <Flame
        size={size}
        color={color}
        fill={urgent ? color : 'transparent'}
        strokeWidth={2.5}
      />
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
}) => {
  const { accessToken, authFetch, user } = useAuth();
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
  const [claimingStepReward, setClaimingStepReward] = useState(false);
  const [claimingHydrationReward, setClaimingHydrationReward] = useState(false);
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
    pinned: myPinned,
    displaySteps: myDisplaySteps,
    subText: mySubText,
  } = getSplitDayDisplayState({
    splitDay,
    todayKey: myTodayKey,
    otherTodayKey: partnerTodayKey,
    liveSteps: liveMySteps,
    lastDaySteps: myLastDay,
  });
  const {
    pinned: partnerPinned,
    displaySteps: partnerDisplaySteps,
    subText: partnerSubText,
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
  const total = (barMySteps + barPartnerSteps) || 1;
  const rawMyPercent = (barMySteps / total) * 100;
  const myTargetPercent = Math.max(15, Math.min(85, rawMyPercent));
  const amIWinning = compareMySteps >= comparePartnerSteps;

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

  const { categories: dailyPointCategories, loading: dailyPointsLoading, claimPoints } = useDailyPoints({
    accessToken,
    dayKey: dailyPointsContext?.dayKey || '',
    config: dailyPointsConfig,
  });

  const { balance: pointsBalance, refetch: refetchPoints } = usePoints({ accessToken });

  const stepPointCategory = dailyPointCategories.find((category) => category.key === 'STEPS');
  const hydrationPointCategory = dailyPointCategories.find((category) => category.key === 'HYDRATION');
  const activePointCategory = battlePage === 0 ? stepPointCategory : hydrationPointCategory;
  const stepPointsMax = stepPointCategory?.maxPoints ?? 0;
  const hydrationPointsMax = hydrationPointCategory?.maxPoints ?? 0;
  const stepGoalReached = !!myStepsTarget && liveMySteps >= myStepsTarget;
  const hydrationGoalReached = glassCount >= WATER_GLASS_GOAL;
  const stepRewardClaimable = stepPointCategory
    ? (stepPointCategory.claimable ?? (!stepPointCategory.isAwarded && stepPointCategory.progress >= 1))
    : false;
  const hydrationRewardClaimable = hydrationPointCategory
    ? (hydrationPointCategory.claimable ?? (!hydrationPointCategory.isAwarded && hydrationPointCategory.progress >= 1))
    : false;
  const activeRewardClaimable = battlePage === 0 ? stepRewardClaimable : hydrationRewardClaimable;
  const showPointsCard = battlePage === 0 ? !!myStepsTarget : true;

  const handleClaimStepReward = useCallback(async () => {
    if (!stepRewardClaimable || claimingStepReward) return;

    try {
      setClaimingStepReward(true);
      await claimPoints('STEPS');
      await refetchPoints();
    } finally {
      setClaimingStepReward(false);
    }
  }, [claimPoints, claimingStepReward, refetchPoints, stepRewardClaimable]);

  const handleClaimHydrationReward = useCallback(async () => {
    if (!hydrationRewardClaimable || claimingHydrationReward) return;

    try {
      setClaimingHydrationReward(true);
      await claimPoints('HYDRATION');
      await refetchPoints();
    } finally {
      setClaimingHydrationReward(false);
    }
  }, [claimPoints, claimingHydrationReward, hydrationRewardClaimable, refetchPoints]);

  const handleClaimActiveReward = useCallback(async () => {
    if (battlePage === 0) {
      await handleClaimStepReward();
      return;
    }
    await handleClaimHydrationReward();
  }, [battlePage, handleClaimHydrationReward, handleClaimStepReward]);

  const claimingActiveReward = battlePage === 0 ? claimingStepReward : claimingHydrationReward;

  const battleSlideWidth = battlePageWidth > 0
    ? battlePageWidth - BATTLE_CAROUSEL_PEEK
    : 0;
  const battleSnapInterval = battleSlideWidth + BATTLE_CAROUSEL_GAP;

  const scrollToBattlePage = useCallback((pageIndex) => {
    if (!battleSnapInterval) return;
    battlePagerRef.current?.scrollTo({ x: battleSnapInterval * pageIndex, animated: true });
    setBattlePage(pageIndex);
  }, [battleSnapInterval]);

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
  const partnerGender = getOppositeGender(user?.gender);

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

  const streakLabel = useMemo(() => {
    if (!winStreak.holder || winStreak.count < 1) return null;

    return {
      holder: winStreak.holder,
      count: winStreak.count,
      name: winStreak.holder === 'YOU' ? 'YOU' : partnerDisplayName,
      color: winStreak.holder === 'YOU' ? COLORS.primary : COLORS.teal,
    };
  }, [winStreak, partnerDisplayName]);

  const streakAtRisk = useMemo(() => {
    if (!streakLabel || streakLabel.holder !== 'YOU') return false;
    return compareMySteps <= comparePartnerSteps;
  }, [streakLabel, compareMySteps, comparePartnerSteps]);

  const barAnim = useRef(new Animated.Value(50)).current;
  useEffect(() => {
    Animated.timing(barAnim, {
      toValue: myTargetPercent,
      duration: 1200,
      easing: Easing.out(Easing.back(1.5)),
      useNativeDriver: false,
    }).start();
  }, [myTargetPercent, barAnim]);

  const p1Flex = barAnim;
  const p2Flex = barAnim.interpolate({
    inputRange: [0, 100],
    outputRange: [100, 0],
  });

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

  if (permissionEnabled === null || typeof permissionEnabled === 'undefined') {
    return (
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
    );
  }

  if (!permissionEnabled) {
    return (
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
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleGroup}>
          <Text style={styles.headerTitle}>{battlePage === 0 ? 'STEP BATTLE' : 'HYDRATION'}</Text>
          <View style={styles.liveTag}>
            <View style={[
              styles.liveDot,
              { backgroundColor: isConnected ? COLORS.connected : COLORS.disconnected }
            ]} />
            <Text style={styles.liveText}>{isConnected ? 'LIVE' : 'OFFLINE'}</Text>
          </View>
          {battlePage === 0 && streakLabel ? (
            <View
              style={[
                styles.streakPill,
                streakLabel.holder === 'YOU' ? styles.streakPillYou : styles.streakPillPartner,
                streakAtRisk && styles.streakPillAtRisk,
              ]}
            >
              <StreakFlame
                color={streakAtRisk ? '#EA580C' : streakLabel.color}
                urgent={streakAtRisk}
                size={11}
              />
              <Text
                style={[
                  styles.streakPillText,
                  { color: streakAtRisk ? '#9A3412' : streakLabel.color },
                ]}
                numberOfLines={1}
              >
                {streakLabel.name} · {streakLabel.count}-day streak
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {battlePage === 0 && splitDay && !!countdownText && (
        <View style={styles.countdownPill}>
          <Text style={styles.countdownText}>{countdownText}</Text>
        </View>
      )}

      <View
        style={styles.carouselWrap}
        onLayout={(event) => setBattlePageWidth(event.nativeEvent.layout.width)}
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
                style={[styles.duelCard, styles.duelCardFill]}
                activeOpacity={0.92}
                onPress={() => setShowLastMonthModal(true)}
              >
        <View style={styles.duelRow}>
          <TouchableOpacity
            style={styles.playerColumn}
            activeOpacity={0.85}
            onPress={() => {
              router.push({
                pathname: '/remaining-steps',
                params: { current: myDisplaySteps, target: myStepsTarget || 10000 },
              });
            }}
          >
            <View style={styles.playerAvatarWrap}>
              <PlayerNameBackdrop name={youBackdropName} color={COLORS.primary} />
              <WalkMascot gender={user?.gender} facing="right" style={styles.playerAvatar} />
            </View>
            <View style={styles.playerNumberRow}>
              {myPinned ? <Pin size={14} color={COLORS.primary} fill={COLORS.primary} /> : null}
              <Text
                style={[styles.playerNumber, { color: COLORS.primary }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.72}
              >
                {myDisplaySteps.toLocaleString()}
              </Text>
              {amIWinning ? <Crown size={14} color={COLORS.primary} strokeWidth={2.5} /> : null}
            </View>
            <Text style={styles.playerMeta} numberOfLines={2} ellipsizeMode="tail">
              {last30Days.youWins} {last30Days.youWins === 1 ? 'win' : 'wins'}
            </Text>
            {!!mySubText && <Text style={styles.playerSub}>{mySubText}</Text>}
          </TouchableOpacity>

          <View style={styles.vsColumn}>
            <View style={styles.vsBadge}>
              <Text style={styles.vsText}>VS</Text>
            </View>
          </View>

          <View style={styles.playerColumn}>
            <View style={styles.playerAvatarWrap}>
              <PlayerNameBackdrop name={partnerBackdropName} color={COLORS.teal} />
              <WalkMascot gender={partnerGender} facing="left" style={styles.playerAvatar} />
            </View>
            <View style={styles.playerNumberRow}>
              {!amIWinning && comparePartnerSteps > 0 ? (
                <Crown size={14} color={COLORS.teal} strokeWidth={2.5} />
              ) : null}
              <Text
                style={[styles.playerNumber, { color: COLORS.teal }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.72}
              >
                {partnerDisplaySteps.toLocaleString()}
              </Text>
              {partnerPinned ? <Pin size={14} color={COLORS.teal} fill={COLORS.teal} /> : null}
            </View>
            <Text style={styles.playerMeta} numberOfLines={2} ellipsizeMode="tail">
              {last30Days.partnerWins} {last30Days.partnerWins === 1 ? 'win' : 'wins'}
            </Text>
            {!!partnerSubText && <Text style={styles.playerSub}>{partnerSubText}</Text>}
          </View>
        </View>

        <View style={styles.duelBarWrap}>
          <View style={styles.barContainer}>
            <Animated.View style={[styles.barSegment, { flex: p1Flex, backgroundColor: COLORS.primary }]} />
            <Animated.View style={[styles.barSegment, { flex: p2Flex, backgroundColor: COLORS.teal }]} />
          </View>
        </View>
              </TouchableOpacity>
            </View>

            <View style={[styles.carouselSlide, { width: battleSlideWidth, minHeight: DUEL_CARD_HEIGHT }]}>
              <Hydration partnerDisplayName={partnerDisplayName} cardStyle={styles.duelCard} />
            </View>
          </ScrollView>
        ) : null}
      </View>

      <View style={styles.carouselDots}>
        {[0, 1].map((page) => (
          <TouchableOpacity
            key={page}
            onPress={() => scrollToBattlePage(page)}
            activeOpacity={0.8}
            style={styles.dotTapTarget}
          >
            <View
              style={[
                styles.carouselDot,
                battlePage === page ? styles.carouselDotActive : styles.carouselDotInactive,
              ]}
            />
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.battleZone}>
        {showPointsCard && (dailyPointsLoading && !activePointCategory ? (
          <View style={styles.pointsProgressCard}>
            <ActivityIndicator size={'small'} color={COLORS.primary} />
            <Text style={styles.pointsProgressLoading}>Loading reward</Text>
          </View>
        ) : activePointCategory ? (
          <View style={styles.pointsProgressCard}>
            <View style={styles.pointsProgressTop}>
              <View style={styles.pointsProgressCopy}>
                <Text style={styles.pointsProgressMeta} numberOfLines={2}>
                  {activePointCategory.isAwarded
                    ? 'Bonus collected today'
                    : battlePage === 0
                      ? `Earn ${stepPointsMax} pts at ${myStepsTarget.toLocaleString()} steps`
                      : `Earn ${hydrationPointsMax} pts at ${WATER_GLASS_GOAL} glasses`}
                </Text>
                {!activePointCategory.isAwarded && (battlePage === 0 ? !stepGoalReached : !hydrationGoalReached) ? (
                  <Text style={styles.pointsProgressHint}>When you hit your goal</Text>
                ) : null}
                {activeRewardClaimable ? (
                  <TouchableOpacity
                    style={styles.claimRewardBtn}
                    onPress={handleClaimActiveReward}
                    disabled={claimingActiveReward}
                    activeOpacity={0.85}
                  >
                    {claimingActiveReward ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.claimRewardBtnText}>
                        Claim {battlePage === 0 ? stepPointsMax : hydrationPointsMax} pts
                      </Text>
                    )}
                  </TouchableOpacity>
                ) : null}
              </View>

              <View style={styles.pointsTotalColumn}>
                <Heart size={28} color="#EF4444" fill="#EF4444" />
                <Text style={styles.pointsTotalValue}>{pointsBalance.toLocaleString()}</Text>
              </View>
            </View>
          </View>
        ) : null)}

        <TouchableOpacity
          onPress={() => setShowMotivateModal(true)}
          style={[
            styles.battleBtn,
            showPointsCard && (activePointCategory || dailyPointsLoading)
              ? styles.battleBtnCompact
              : styles.battleBtnFull,
          ]}
          activeOpacity={0.85}
        >
          <Send size={16} color="#FFFFFF" strokeWidth={2.5} />
          <Text style={styles.battleBtnText}>Motivate</Text>
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
  container: { paddingVertical: 10 },
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  titleGroup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 16, fontWeight: '900', color: COLORS.text, letterSpacing: -0.5 },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444' },
  liveText: { fontSize: 10, fontWeight: '900', color: COLORS.textMuted },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
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
    fontSize: 10,
    fontWeight: '900',
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
    paddingRight: BATTLE_CAROUSEL_PEEK - BATTLE_CAROUSEL_GAP,
  },
  carouselSlide: {
    marginRight: BATTLE_CAROUSEL_GAP,
    alignSelf: 'stretch',
  },
  carouselDots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  dotTapTarget: {
    padding: 4,
  },
  carouselDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  carouselDotActive: {
    backgroundColor: COLORS.primary,
    width: 18,
  },
  carouselDotInactive: {
    backgroundColor: '#CBD5E1',
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
  playerAvatarWrap: {
    width: 96,
    height: 118,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 4,
    position: 'relative',
  },
  playerNameBackdropWrap: {
    position: 'absolute',
    top: 10,
    left: -10,
    right: -10,
    zIndex: 0,
    alignItems: 'center',
  },
  playerNameBackdrop: {
    width: '100%',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 0.4,
    lineHeight: 34,
    textAlign: 'center',
    opacity: 0.22,
  },
  playerNameBackdropSecond: {
    marginTop: -1,
  },
  playerAvatar: {
    zIndex: 1,
  },
  walkMascotClip: {
    overflow: 'hidden',
  },
  walkMascotInner: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  walkMascotMirrored: {
    transform: [{ scaleX: -1 }],
  },
  walkMascotSprite: {
    backgroundColor: 'transparent',
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
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: -1.5,
    fontVariant: ['tabular-nums'],
    lineHeight: 46,
    textAlign: 'center',
    flexShrink: 1,
    minWidth: 0,
  },
  playerMeta: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '700',
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
    paddingTop: 44,
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
    alignItems: 'stretch',
    gap: 10,
    minHeight: 78,
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
  claimRewardBtn: {
    alignSelf: 'flex-start',
    marginTop: 8,
    minWidth: 72,
    height: 28,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  claimRewardBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.4,
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
