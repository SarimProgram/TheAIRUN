import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  TextInput,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Send, Zap, Ghost, Trophy, X, Swords, Pin, Footprints, Shield } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Reanimated, { FadeInUp, FadeOut } from 'react-native-reanimated';
import { useAuth } from '../../src/auth/authContext';
import { API_BASE_URL } from '../../config/api';
import { useChat } from '../../contexts/ChatContext';
import { useRouter } from 'expo-router';
import { requestStepPermissions } from '../../lib/requestStepPermissions';

const COLORS = {
  primary: '#FF6B6B',
  teal: '#1F938A',
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

const StepSyncSection = ({
  onNudge,
  permissionEnabled,
  onPermissionChange,
  onPermissionGranted,
  myFallbackLiveSteps = 0,
  partnerFallbackLiveSteps = 0,
  fallbackPartnerName = 'PARTNER',
  isConnected = false,
}) => {
  const { accessToken, authFetch } = useAuth();
  const { sendMessage } = useChat();
  const router = useRouter();

  const [showOptions, setShowOptions] = useState(false);
  const [nudgeSent, setNudgeSent] = useState(false);
  const [sentLabel, setSentLabel] = useState('');
  const [customText, setCustomText] = useState('');
  const [tracerState, setTracerState] = useState(null);
  const [myStepsTarget, setMyStepsTarget] = useState(null);
  const [countdownText, setCountdownText] = useState('');
  const [showLastMonthModal, setShowLastMonthModal] = useState(false);
  const [requestingPermission, setRequestingPermission] = useState(false);

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
            }
          }
        }
      }
    } catch {
      // Keep existing fallback UI values if tracer-state fails.
    }
  }, [accessToken, authFetch]);

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

  const barMySteps = myDisplaySteps;
  const barPartnerSteps = partnerDisplaySteps;
  const total = (barMySteps + barPartnerSteps) || 1;
  const rawMyPercent = (barMySteps / total) * 100;
  const myTargetPercent = Math.max(15, Math.min(85, rawMyPercent));
  const amIWinning = compareMySteps >= comparePartnerSteps;

  const yesterdayWinner = tracerState?.yesterday?.winner || 'TIE';
  const partnerDisplayName = (tracerState?.participants?.partner?.name || fallbackPartnerName || 'PARTNER').split(' ')[0].toUpperCase();

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

  const handleMotivation = (text, label) => {
    if (sendMessage) {
      sendMessage(`[STEPS] ${text}`);
    }

    setSentLabel(label);
    setNudgeSent(true);

    setTimeout(() => {
      setShowOptions(false);
      if (onNudge) onNudge(label);
    }, 100);

    setTimeout(() => {
      setNudgeSent(false);
    }, 3000);
  };

  const motivationOptions = useMemo(() => ([
    { id: 'tease1', label: 'ZOOM!', text: 'Catch these steps!', icon: <Zap size={16} color={COLORS.dark} strokeWidth={2.5} /> },
    { id: 'tease2', label: 'NAP TIME?', text: 'Are you even moving?', icon: <Ghost size={16} color={COLORS.dark} strokeWidth={2.5} /> },
    { id: 'mot2', label: 'SLAY!', text: 'Eating my dust!', icon: <Trophy size={16} color={COLORS.dark} strokeWidth={2.5} /> },
  ]), []);

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
          <Text style={styles.permissionTitle}>Enable step access</Text>
          <Text style={styles.permissionBody}>
            You skipped onboarding, so step battle needs permission here before it can read your daily steps.
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
          <Text style={styles.headerTitle}>STEP BATTLE</Text>
          <View style={styles.liveTag}>
            <View style={[
              styles.liveDot,
              { backgroundColor: isConnected ? COLORS.connected : COLORS.disconnected }
            ]} />
            <Text style={styles.liveText}>{isConnected ? 'LIVE' : 'OFFLINE'}</Text>
          </View>
        </View>
        <View style={[
          styles.yesterdayWinnerPill,
          yesterdayWinner === 'YOU' ? styles.yesterdayYouPill :
          yesterdayWinner === 'PARTNER' ? styles.yesterdayPartnerPill :
          styles.yesterdayDrawPill
        ]}>
          {yesterdayWinner === 'TIE' ? (
            <Swords size={11} color="#64748B" />
          ) : (
            <Trophy 
              size={11} 
              color={yesterdayWinner === 'YOU' ? COLORS.primary : COLORS.teal} 
              fill={yesterdayWinner === 'YOU' ? COLORS.primary : COLORS.teal} 
            />
          )}
          <Text style={styles.yesterdayOneLine}>
            <Text style={[
              styles.yesterdayLabel,
              { color: yesterdayWinner === 'YOU' ? COLORS.primary : yesterdayWinner === 'PARTNER' ? COLORS.teal : '#64748B' }
            ]}>YESTERDAY </Text>
            <Text style={[
              styles.yesterdayValue,
              { color: yesterdayWinner === 'YOU' ? COLORS.primary : yesterdayWinner === 'PARTNER' ? COLORS.teal : '#334155' }
            ]}>
              {yesterdayWinner === 'YOU' ? 'YOU' : yesterdayWinner === 'PARTNER' ? partnerDisplayName : 'DRAW'}
            </Text>
          </Text>
        </View>
      </View>

      {splitDay && !!countdownText && (
        <View style={styles.countdownPill}>
          <Text style={styles.countdownText}>{countdownText}</Text>
        </View>
      )}

      <View style={styles.statsRow}>
        <TouchableOpacity 
          style={styles.statBlock}
          activeOpacity={0.7}
          onPress={() => router.push({
            pathname: "/remaining-steps",
            params: { current: myDisplaySteps, target: myStepsTarget || 10000 }
          })}
        >
          <Text style={styles.userLabel}>YOU</Text>
          <View style={styles.mainStatLine}>
            {myPinned && <Pin size={14} color={COLORS.primary} fill={COLORS.primary} style={styles.pinIcon} />}
            <Text style={[styles.bigNumber, { color: COLORS.primary }]}>{myDisplaySteps.toLocaleString()}</Text>
            {!!myStepsTarget && (
              <Text style={styles.inlineTargetText}>/{myStepsTarget.toLocaleString()}</Text>
            )}
          </View>
          {!!mySubText && <Text style={styles.lastDayText}>{mySubText}</Text>}
        </TouchableOpacity>
        <View style={[styles.statBlock, { alignItems: 'flex-end' }]}>
          <Text style={styles.userLabel}>{partnerDisplayName}</Text>
          <View style={styles.mainStatLine}>
            <Text style={[styles.bigNumber, { color: COLORS.teal }]}>{partnerDisplaySteps.toLocaleString()}</Text>
            {partnerPinned && <Pin size={14} color={COLORS.teal} fill={COLORS.teal} style={styles.pinIconRight} />}
          </View>
          {!!partnerSubText && <Text style={styles.lastDayText}>{partnerSubText}</Text>}
        </View>
      </View>

      <TouchableOpacity
        style={styles.barWrapper}
        activeOpacity={0.85}
        onPress={() => setShowLastMonthModal(true)}
      >
        <View style={styles.barContainer}>
          <Animated.View style={[styles.barSegment, { flex: p1Flex, backgroundColor: COLORS.primary }]} />
          <Animated.View style={[styles.barSegment, { flex: p2Flex, backgroundColor: COLORS.teal }]} />
        </View>
        <View style={styles.h2hOverlay}>
          <View style={styles.h2hSide}>
            <Text style={styles.h2hWins}>{last30Days.youWins}</Text>
            <Text style={styles.h2hLabel}>WINS</Text>
          </View>
          <View style={[styles.h2hSide, { alignItems: 'flex-end' }]}>
            <Text style={styles.h2hWins}>{last30Days.partnerWins}</Text>
            <Text style={styles.h2hLabel}>WINS</Text>
          </View>
        </View>
        <View style={styles.vsBadge}>
          <Text style={styles.vsText}>VS</Text>
        </View>
        <View style={styles.barTag}>
          <Text style={styles.barTagText}>LAST 30 DAYS H2H</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.battleZone}>
        {!showOptions ? (
          <View style={styles.footer}>
            <View style={styles.statusContent}>
              <Text style={styles.statusHeader}>STATUS</Text>
              <Text style={styles.statusMsg}>
                {amIWinning ? "YOU'RE WINNING" : "YOU ARE LOSING"}
              </Text>
              {splitDay && (
                <Text style={styles.statusMeta}>Resets on partner’s day rollover</Text>
              )}
            </View>
            <TouchableOpacity
              onPress={() => setShowOptions(true)}
              style={styles.battleBtn}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={['#1E293B', '#0F172A']}
                style={styles.battleBtnGradient}
              >
                <Zap size={18} color={COLORS.primary} strokeWidth={3} />
                <Text style={styles.battleBtnText}>NUDGE</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.deckContainer}>
            <View style={styles.deckHeader}>
              <View>
                <Text style={styles.deckTitle}>QUICK NUDGE</Text>
                <Text style={styles.deckSubtitle}>Send a message to Battle Deck</Text>
              </View>
              <TouchableOpacity onPress={() => setShowOptions(false)} style={styles.closeBtn}>
                <X size={18} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.gridContainer}>
              {motivationOptions.map((opt) => (
                <TouchableOpacity
                  key={opt.id}
                  onPress={() => handleMotivation(opt.text, opt.label)}
                  style={styles.gridCard}
                >
                  <View style={styles.cardContent}>
                    <View style={styles.cardIconWrapper}>
                      {opt.icon}
                    </View>
                    <Text style={[styles.cardText, { color: COLORS.text }]}>{opt.text}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.deckInputRow}>
              <TextInput
                style={styles.deckInput}
                placeholder="Type custom roast..."
                placeholderTextColor="#94A3B8"
                value={customText}
                onChangeText={setCustomText}
                onSubmitEditing={() => {
                  if (customText.trim()) handleMotivation(customText, 'CUSTOM');
                  setCustomText('');
                }}
              />
              <TouchableOpacity
                style={[styles.deckSendBtn, !customText.trim() && { opacity: 0.5 }]}
                disabled={!customText.trim()}
                onPress={() => {
                  handleMotivation(customText, 'CUSTOM');
                  setCustomText('');
                }}
              >
                <Send size={16} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {nudgeSent && (
        <Reanimated.View entering={FadeInUp} exiting={FadeOut} style={styles.sentOverlay}>
          <LinearGradient colors={[COLORS.primary, '#F43F5E']} style={styles.sentPill}>
            <Zap size={14} color="#FFF" fill="#FFF" />
            <Text style={styles.sentPillText}>{sentLabel} SENT TO BATTLE</Text>
          </LinearGradient>
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
                <Text style={styles.modalTitle}>Last 30 Days Steps</Text>
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
                <Text style={styles.emptyListText}>No daily data for the last 30 days yet.</Text>
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
  yesterdayLabel: { fontSize: 8, fontWeight: '900', letterSpacing: 0.5, opacity: 0.8 },
  yesterdayValue: { fontSize: 9, fontWeight: '900' },
  yesterdayOneLine: { flexDirection: 'row', alignItems: 'center' },
  yesterdayYouPill: {
    backgroundColor: '#FFF1F1',
    borderColor: '#FEE2E2',
  },
  yesterdayPartnerPill: {
    backgroundColor: '#F0FDFD',
    borderColor: '#CCFBF1',
  },
  yesterdayDrawPill: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  yesterdayWinnerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9'
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
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 4
  },
  statBlock: { gap: 2 },
  mainStatLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userLabel: { fontSize: 12, fontWeight: '900', color: COLORS.textMuted, letterSpacing: 1 },
  bigNumber: { fontSize: 34, fontWeight: '900', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  inlineTargetText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginTop: 10,
  },
  lastDayText: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  pinIcon: {
    transform: [{ rotate: '-30deg' }],
    marginTop: 2,
  },
  pinIconRight: {
    transform: [{ rotate: '30deg' }],
    marginTop: 2,
  },
  barWrapper: { height: 64, justifyContent: 'center', position: 'relative', marginBottom: 24 },
  barContainer: {
    height: '100%',
    width: '100%',
    flexDirection: 'row',
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9'
  },
  barSegment: { height: '100%' },
  vsBadge: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -20,
    marginTop: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  vsText: { fontSize: 12, fontWeight: '900', color: COLORS.textMuted, fontStyle: 'italic' },
  h2hOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  h2hSide: {
    alignItems: 'flex-start',
    gap: 0,
  },
  h2hWins: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  h2hLabel: {
    fontSize: 8,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 0.5,
  },
  barTag: {
    position: 'absolute',
    bottom: -8,
    alignSelf: 'center',
    backgroundColor: COLORS.dark,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  barTagText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  battleZone: { minHeight: 80, justifyContent: 'center' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  statusContent: { flex: 1 },
  statusHeader: { fontSize: 9, fontWeight: '900', color: COLORS.textMuted, letterSpacing: 1, marginBottom: 2 },
  statusMsg: { fontSize: 14, fontWeight: '900', color: COLORS.text },
  statusMeta: { fontSize: 11, color: '#64748B', marginTop: 3, fontWeight: '700' },
  battleBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8
  },
  battleBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8
  },
  battleBtnText: { color: '#FFF', fontWeight: '900', fontSize: 12, letterSpacing: 1 },
  deckContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10
  },
  deckHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20
  },
  deckTitle: { fontSize: 13, fontWeight: '900', color: COLORS.text, letterSpacing: 0.5 },
  deckSubtitle: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, marginTop: 2 },
  closeBtn: { padding: 4 },
  gridContainer: {
    flexDirection: 'column',
    gap: 10,
  },
  gridCard: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
  },
  cardContent: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 14,
  },
  cardIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2
  },
  cardText: { fontSize: 13, fontWeight: '800', color: COLORS.text, flex: 1 },
  deckInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    marginTop: 15,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  deckInput: { flex: 1, fontSize: 13, fontWeight: '600', color: COLORS.text },
  deckSendBtn: {
    backgroundColor: COLORS.dark,
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
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
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 8,
    elevation: 5
  },
  sentPillText: { color: '#FFF', fontWeight: '900', fontSize: 10, letterSpacing: 1 }
  ,
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
