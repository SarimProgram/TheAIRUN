/* eslint-disable react/no-unescaped-entities */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, interpolate, Easing, withRepeat, withSequence } from 'react-native-reanimated';
import { Users, Play, Zap, Clock, Calendar, Check, X, Trophy, Home, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/auth/authContext';
import { API_BASE_URL } from '@/config/api';

const THEME = {
  bg: '#F8F9FA',
  surface: '#FFFFFF',
  primary: '#FF6B6B',
  secondary: '#2EC4B6',
  accent: '#A29BFE',
  textMain: '#1A1A1A',
  textLight: '#94A3B8',
  glass: 'rgba(255, 255, 255, 0.88)',
  border: 'rgba(0, 0, 0, 0.06)',
};

type ScheduledRun = {
  id: string;
  partnerName: string;
  scheduledTime: string;
  distanceKm: number;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  isSender: boolean;
};

type Props = {
  isConnected: boolean;
  onConfirmRunNow: (km: number) => void;
  onConfirmSchedule: (dateTimeLabel: string, km: number) => void;
};

const getNextFutureSlot = () => {
  const next = new Date();
  next.setSeconds(0, 0);
  const mins = next.getMinutes();
  const remainder = mins % 30;
  next.setMinutes(mins + (remainder === 0 ? 30 : 30 - remainder));
  return next;
};

export default function PreRaceDashboard({ isConnected, onConfirmRunNow, onConfirmSchedule }: Props) {
  const router = useRouter();
  const { authFetch } = useAuth();
  const [scheduledRuns, setScheduledRuns] = useState<{ sent: ScheduledRun[], received: ScheduledRun[] }>({ sent: [], received: [] });
  const [partnerTimezone, setPartnerTimezone] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState<string>('Partner');
  const [isLoading, setIsLoading] = useState(false);
  const [uiStage, setUiStage] = useState<'idle' | 'choice' | 'details'>('idle');
  const [isScheduleMode, setIsScheduleMode] = useState(false);
  const [tempKm, setTempKm] = useState('1.0');
  const [scheduleDateTime, setScheduleDateTime] = useState(() => getNextFutureSlot());
  const localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  const dashboardExpansion = useSharedValue(0);

  // Fetch scheduled runs on mount and after actions
  const fetchScheduledRuns = useCallback(async () => {
    try {
      const response = await authFetch(`${API_BASE_URL}/runtogether/active`);
      if (response.ok) {
        const data = await response.json();
        setScheduledRuns(data);
      }
    } catch (error) {
      console.error('Failed to fetch scheduled runs:', error);
    }
  }, [authFetch]);

  const fetchPartnerInfo = useCallback(async () => {
    try {
      const response = await authFetch(`${API_BASE_URL}/partner`);
      if (!response.ok) return;
      const data = await response.json();
      if (data?.partner?.timezone) setPartnerTimezone(data.partner.timezone);
      if (data?.partner?.displayName) setPartnerName(data.partner.displayName);
    } catch (error) {
      console.error('Failed to fetch partner info:', error);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchScheduledRuns();
    fetchPartnerInfo();
    // Poll every 30 seconds for updates
    const interval = setInterval(fetchScheduledRuns, 30000);
    return () => clearInterval(interval);
  }, [fetchScheduledRuns, fetchPartnerInfo]);

  const pendingReceivedRuns = scheduledRuns.received.filter((r) => r.status === 'PENDING');
  const activeRuns = [
    ...scheduledRuns.sent.filter((r) => r.status === 'PENDING' || r.status === 'ACCEPTED'),
    ...scheduledRuns.received.filter((r) => r.status === 'ACCEPTED'),
  ];
  const hasAnyRuns = pendingReceivedRuns.length > 0 || activeRuns.length > 0;
  const runCardCount = pendingReceivedRuns.length + activeRuns.length;
  const collapsedHeight = hasAnyRuns
    ? Math.min(runCardCount === 1 ? 210 : 210 + (runCardCount - 1) * 105, 420)
    : 220;
  const expandedHeight = 460;

  const animatedDashboardStyle = useAnimatedStyle(() => ({
    height: interpolate(dashboardExpansion.value, [0, 1], [collapsedHeight, expandedHeight]),
  }), [collapsedHeight, expandedHeight]);

  const pulse = useSharedValue(1);
  const clockSpin = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);
  useEffect(() => {
    clockSpin.value = withRepeat(
      withTiming(360, { duration: 6000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const onlineIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: interpolate(pulse.value, [1, 1.1], [1, 0.6]),
  }));
  const clockSpinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${clockSpin.value}deg` }],
  }));

  const open = (stage: 'choice' | 'details') => {
    setUiStage(stage);
    dashboardExpansion.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.back(1)) });
  };

  const close = () => {
    setUiStage('idle');
    dashboardExpansion.value = withTiming(0, { duration: 300 });
  };

  const handleOpenChallenge = () => open('choice');

  const handleSelectRunNow = () => {
    setIsScheduleMode(false);
    setUiStage('details');
  };

  const handleSelectSchedule = (fromIdle = false) => {
    setIsScheduleMode(true);
    setScheduleDateTime((prev) => (prev > new Date() ? prev : getNextFutureSlot()));
    if (fromIdle) open('details');
    else setUiStage('details');
  };

  const handleConfirmAction = async () => {
    const km = Number.parseFloat(tempKm);
    if (!Number.isFinite(km) || km <= 0) {
      Alert.alert('Invalid Distance', 'Enter a valid distance in km (e.g. 1.0).');
      return;
    }

    if (isScheduleMode) {
      setIsLoading(true);
      try {
        const scheduledDate = new Date(scheduleDateTime);
        if (scheduledDate <= new Date()) {
          Alert.alert('Pick a future time', 'Scheduled run time must be in the future.');
          return;
        }

        const response = await authFetch(`${API_BASE_URL}/runtogether/schedule`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scheduledTime: scheduledDate.toISOString(),
            distanceKm: km,
          }),
        });

        if (response.ok) {
          await fetchScheduledRuns();
          onConfirmSchedule(formatDateTime(scheduledDate, localTimezone), km);
          close();
        } else {
          const error = await response.json();
          Alert.alert('Error', error.error || 'Failed to schedule run');
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to schedule run');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (!isConnected) {
      Alert.alert('Not Connected', 'Wait for connection.');
      return;
    }

    onConfirmRunNow(km);
    close();
  };

  const handleAcceptRun = async (runId: string) => {
    setIsLoading(true);
    try {
      const response = await authFetch(`${API_BASE_URL}/runtogether/${runId}/accept`, {
        method: 'POST',
      });
      if (response.ok) {
        await fetchScheduledRuns();
        Alert.alert('Accepted!', 'Run scheduled successfully');
      } else {
        const error = await response.json();
        Alert.alert('Error', error.error || 'Failed to accept run');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to accept run');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeclineRun = async (runId: string) => {
    setIsLoading(true);
    try {
      const response = await authFetch(`${API_BASE_URL}/runtogether/${runId}/decline`, {
        method: 'POST',
      });
      if (response.ok) {
        await fetchScheduledRuns();
      } else {
        const error = await response.json();
        Alert.alert('Error', error.error || 'Failed to decline run');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to decline run');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelRun = async (runId: string) => {
    setIsLoading(true);
    try {
      const response = await authFetch(`${API_BASE_URL}/runtogether/${runId}/cancel`, {
        method: 'POST',
      });
      if (response.ok) {
        await fetchScheduledRuns();
      } else {
        const error = await response.json();
        Alert.alert('Error', error.error || 'Failed to cancel run');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to cancel run');
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (dateLike: Date | string, timeZone?: string) => {
    const date = new Date(dateLike);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, ...(timeZone ? { timeZone } : {}) });
  };
  const formatDate = (date: Date, timeZone?: string) => (
    date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', ...(timeZone ? { timeZone } : {}) })
  );
  const formatLocalTime = (date: Date, timeZone?: string) => (
    date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, ...(timeZone ? { timeZone } : {}) })
  );
  const formatDateTime = (dateLike: Date | string, timeZone?: string) => {
    const date = new Date(dateLike);
    return `${formatDate(date, timeZone)} • ${formatTime(date, timeZone)}`;
  };
  const getTimezoneShort = (timeZone: string) => {
    try {
      const part = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' })
        .formatToParts(new Date())
        .find((p) => p.type === 'timeZoneName');
      return part?.value || timeZone;
    } catch {
      return timeZone;
    }
  };
  const isFuture = (date: Date) => date.getTime() > Date.now();
  const canShiftDayBackward = (() => {
    const candidate = new Date(scheduleDateTime);
    candidate.setDate(candidate.getDate() - 1);
    return isFuture(candidate);
  })();
  const canShiftMinutesBackward = (() => {
    const candidate = new Date(scheduleDateTime);
    candidate.setMinutes(candidate.getMinutes() - 30);
    return isFuture(candidate);
  })();

  const adjustScheduleDay = (delta: number) => {
    setScheduleDateTime((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + delta);
      if (!isFuture(next)) return prev;
      return next;
    });
  };
  const adjustScheduleMinutes = (delta: number) => {
    setScheduleDateTime((prev) => {
      const next = new Date(prev);
      next.setMinutes(next.getMinutes() + delta);
      if (!isFuture(next)) return prev;
      return next;
    });
  };

  const getStatusDisplay = (run: ScheduledRun) => {
    if (run.isSender) {
      // User created this run
      if (run.status === 'PENDING') return { text: 'Pending...', color: THEME.accent };
      if (run.status === 'ACCEPTED') return { text: 'Accepted ✓', color: THEME.secondary };
    } else {
      // User received this run
      if (run.status === 'ACCEPTED') return { text: 'Scheduled', color: THEME.secondary };
    }
    return { text: run.status, color: THEME.textLight };
  };

  return (
    <Animated.View style={[styles.bottomDashboard, animatedDashboardStyle]}>
      <View style={uiStage === 'idle' && hasAnyRuns ? undefined : { flex: 1 }}>
        {uiStage === 'idle' ? (
          <>
            {hasAnyRuns && (
              <ScrollView style={styles.runsListScroll} contentContainerStyle={styles.runsListContent} showsVerticalScrollIndicator={false}>
                {pendingReceivedRuns.map((run) => (
                  <View key={`pending-${run.id}`} style={styles.incomingRequest}>
                    <View style={styles.incomingHeader}>
                      <Calendar size={16} color={THEME.primary} />
                      <Text style={styles.incomingTitle}>Run Invite from {run.partnerName}</Text>
                    </View>
                    <Text style={styles.incomingDetails}>
                      {formatDateTime(run.scheduledTime, localTimezone)} ({getTimezoneShort(localTimezone)}) • {run.distanceKm}km
                    </Text>
                    <View style={styles.acceptDeclineRow}>
                      <TouchableOpacity
                        style={styles.declineButton}
                        onPress={() => handleDeclineRun(run.id)}
                        disabled={isLoading}
                      >
                        <X size={24} color={THEME.textMain} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.acceptButton}
                        onPress={() => handleAcceptRun(run.id)}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                          <Check size={24} color="#FFF" />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}

                {activeRuns.map((run) => {
                  const isAccepted = run.status === 'ACCEPTED';
                  return (
                    <View key={`active-${run.id}`} style={styles.scheduledCard}>
                      <View style={styles.scheduledHeader}>
                        <Calendar size={18} color={THEME.primary} />
                        <Text style={styles.scheduledTitle}>
                          {run.isSender ? 'Run you scheduled' : `Run with ${run.partnerName}`}
                        </Text>
                      </View>
                      <View style={styles.scheduledDetailRow}>
                        <Clock size={14} color={THEME.textLight} />
                        <Text style={styles.scheduledDetailText}>
                          {formatDateTime(run.scheduledTime, localTimezone)} ({getTimezoneShort(localTimezone)}) • {run.distanceKm}km
                        </Text>
                      </View>
                      <View style={[styles.statusBadge, { alignSelf: 'flex-start', backgroundColor: getStatusDisplay(run).color }]}>
                        <Text style={styles.statusText}>{getStatusDisplay(run).text}</Text>
                      </View>
                      <View style={styles.scheduledActionRow}>
                        <TouchableOpacity
                          style={[styles.scheduledPrimaryBtn, !isAccepted && styles.scheduledPrimaryBtnDisabled]}
                          onPress={() => onConfirmRunNow(run.distanceKm)}
                          disabled={!isConnected || !isAccepted}
                        >
                          <Text style={styles.scheduledPrimaryText}>{isAccepted ? 'Start Run' : 'Waiting'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.scheduledSecondaryBtn}
                          onPress={() => run.isSender ? handleCancelRun(run.id) : handleDeclineRun(run.id)}
                          disabled={isLoading}
                        >
                          <Text style={styles.scheduledSecondaryText}>Delete Run</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.newRunBtn} onPress={handleOpenChallenge}>
                          <Text style={styles.newRunBtnText}>New Run</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}

            {!hasAnyRuns && (
              <>
                <View style={styles.sheetHandle} />
                
                <View style={styles.compactVersusSection}>
                  <View style={styles.compactMainRow}>
                    <View style={[styles.avatarCircle, { width: 56, height: 56 }]}>
                      <Users size={18} color={THEME.primary} />
                    </View>

                    <View style={styles.vsBadgeSmall}>
                      <Text style={styles.vsBadgeText}>VS</Text>
                    </View>

                    <View style={[styles.avatarCircle, { width: 56, height: 56, borderColor: THEME.secondary }]}>
                      <Users size={18} color={THEME.secondary} />
                      <Animated.View style={[styles.liveIndicatorDot, onlineIndicatorStyle]} />
                    </View>

                    <View style={styles.compactTextContainer}>
                      <Text style={styles.compactHeroTitle}>Race Your Partner</Text>
                      <Text style={styles.compactHeroDesc}>Synchronized performance battle</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.modernActionRow}>
                  <TouchableOpacity 
                    style={[styles.modernSecondaryBtn, { width: 45, paddingHorizontal: 0 }]} 
                    onPress={() => handleSelectSchedule(true)}
                  >
                    <Clock size={18} color={THEME.textMain} />
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.modernSecondaryBtn, { width: 45, paddingHorizontal: 0, marginLeft: 8 }]} 
                    onPress={() => router.push('/race/history')}
                  >
                    <Trophy size={18} color={THEME.primary} />
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.modernPrimaryBtn, { backgroundColor: THEME.primary }]} 
                    onPress={handleOpenChallenge}
                  >
                    <View style={styles.modernPrimaryGradient}>
                      <Zap size={16} color="#FFF" fill="#FFF" />
                      <Text style={[styles.modernPrimaryText, { fontSize: 13 }]}>Challenge Now</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </>
        ) : uiStage === 'choice' ? (
          <View style={styles.expandContent}>
            <Text style={styles.expandTitle}>Start a challenge?</Text>

            <TouchableOpacity style={styles.choiceBtn} onPress={handleSelectRunNow}>
              <Zap size={22} color="#FFF" fill="#FFF" />
              <View>
                <Text style={styles.choiceBtnTitle}>Run Now</Text>
                <Text style={styles.choiceBtnSub}>Start a race immediately</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.choiceBtn, { backgroundColor: THEME.border }]}
              onPress={() => handleSelectSchedule(false)}
            >
              <Clock size={22} color={THEME.textMain} />
              <View>
                <Text style={[styles.choiceBtnTitle, { color: THEME.textMain }]}>Schedule Later</Text>
                <Text style={styles.choiceBtnSub}>Pick a time that works</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity onPress={close} style={styles.cancelLink}>
              <Text style={styles.cancelLinkText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.expandContent}>
            <Text style={styles.expandTitle}>{isScheduleMode ? 'Schedule Run' : 'Race Details'}</Text>

            <View style={styles.inputGroup}>
              {isScheduleMode && (
                <View style={styles.schedulePickerCard}>
                  <View style={styles.scheduleHeaderRow}>
                    <Animated.View style={[styles.clockBubble, clockSpinStyle]}>
                      <Clock size={20} color="#FFF" />
                    </Animated.View>
                    <View>
                      <Text style={styles.scheduleLabel}>Selected Date & Time</Text>
                      <Text style={styles.scheduleValue}>{formatDateTime(scheduleDateTime, localTimezone)}</Text>
                    </View>
                  </View>
                  <Text style={styles.timezoneMeta}>
                    Your timezone: {localTimezone} ({getTimezoneShort(localTimezone)})
                  </Text>
                  {partnerTimezone ? (
                    <Text style={styles.timezoneMeta}>
                      {partnerName}'s time: {formatLocalTime(scheduleDateTime, partnerTimezone)} ({partnerTimezone})
                    </Text>
                  ) : null}

                  <View style={styles.scheduleRow}>
                    <TouchableOpacity
                      style={[styles.scheduleArrow, !canShiftDayBackward && styles.scheduleArrowDisabled]}
                      onPress={() => adjustScheduleDay(-1)}
                      disabled={!canShiftDayBackward}
                    >
                      <ChevronLeft size={18} color={THEME.textMain} />
                    </TouchableOpacity>
                    <View style={styles.scheduleDatePill}>
                      <Text style={styles.scheduleDateText}>{formatDate(scheduleDateTime, localTimezone)}</Text>
                    </View>
                    <TouchableOpacity style={styles.scheduleArrow} onPress={() => adjustScheduleDay(1)}>
                      <ChevronRight size={18} color={THEME.textMain} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.scheduleRow}>
                    <TouchableOpacity
                      style={[styles.timeStepBtn, !canShiftMinutesBackward && styles.scheduleArrowDisabled]}
                      onPress={() => adjustScheduleMinutes(-30)}
                      disabled={!canShiftMinutesBackward}
                    >
                      <Text style={styles.timeStepText}>-30m</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.timeStepBtn} onPress={() => adjustScheduleMinutes(30)}>
                      <Text style={styles.timeStepText}>+30m</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <View style={styles.kmRow}>
                {[1, 3, 5, 10, 25].map((km) => {
                  const selected = Number.parseFloat(tempKm) === km;
                  return (
                    <TouchableOpacity
                      key={km}
                      style={[styles.kmChip, selected && styles.kmChipActive]}
                      onPress={() => setTempKm(String(km))}
                    >
                      <Text style={[styles.kmChipText, selected && styles.kmChipTextActive]}>{km}km</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleConfirmAction}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.btnTextPlay}>CONFIRM</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setUiStage('choice')} style={styles.cancelLink}>
              <Text style={styles.cancelLinkText}>Back</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.footerLinks}>
        <TouchableOpacity style={styles.hubLink} onPress={() => router.navigate('/')}>
          <X size={14} color={THEME.textLight} />
          <Text style={styles.hubLinkText}>Back to Hub</Text>
        </TouchableOpacity>

        <View style={styles.footerDivider} />

        <TouchableOpacity style={styles.hubLink} onPress={() => router.push('/race/history')}>
          <Trophy size={14} color={THEME.textLight} />
          <Text style={styles.hubLinkText}>Race History</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bottomDashboard: { backgroundColor: THEME.glass, marginHorizontal: 0, marginBottom: 0, borderTopLeftRadius: 40, borderTopRightRadius: 40, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16, elevation: 20, shadowColor: THEME.primary, shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.1, shadowRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', overflow: 'hidden' },
  runsListScroll: { flexGrow: 0 },
  runsListContent: { gap: 10, paddingBottom: 6 },

  scheduledRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, backgroundColor: '#FFF', padding: 8, borderRadius: 12, alignSelf: 'flex-start', flexWrap: 'wrap', gap: 4 },
  scheduledLabel: { fontSize: 12, color: THEME.textMain, fontWeight: '600', marginLeft: 6 },
  timerBadge: { backgroundColor: THEME.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  timerText: { color: '#FFF', fontWeight: '800', fontSize: 12 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginLeft: 4 },
  statusText: { color: '#FFF', fontWeight: '700', fontSize: 11 },
  scheduledCard: { backgroundColor: '#FFF', padding: 12, borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: THEME.border, gap: 8 },
  scheduledHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scheduledTitle: { fontSize: 14, fontWeight: '900', color: THEME.textMain },
  scheduledDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  scheduledDetailText: { fontSize: 12, fontWeight: '700', color: THEME.textLight },
  scheduledActionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  scheduledPrimaryBtn: { backgroundColor: THEME.primary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  scheduledPrimaryBtnDisabled: { opacity: 0.5 },
  scheduledPrimaryText: { color: '#FFF', fontWeight: '800', fontSize: 11 },
  scheduledSecondaryBtn: { backgroundColor: THEME.border, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  scheduledSecondaryText: { color: THEME.textMain, fontWeight: '800', fontSize: 11 },
  newRunBtn: { backgroundColor: THEME.secondary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  newRunBtnText: { color: '#FFF', fontWeight: '800', fontSize: 11 },

  incomingRequest: { backgroundColor: '#FFF', padding: 12, borderRadius: 16, marginBottom: 15, borderWidth: 2, borderColor: THEME.primary },
  incomingHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  incomingTitle: { fontSize: 14, fontWeight: '700', color: THEME.textMain },
  incomingDetails: { fontSize: 16, fontWeight: '800', color: THEME.primary, marginBottom: 10 },
  acceptDeclineRow: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
  declineButton: { width: 50, height: 50, borderRadius: 25, backgroundColor: THEME.border, justifyContent: 'center', alignItems: 'center' },
  acceptButton: { width: 50, height: 50, borderRadius: 25, backgroundColor: THEME.secondary, justifyContent: 'center', alignItems: 'center' },

  sheetHandle: { width: 40, height: 4, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  
  compactVersusSection: { marginBottom: 16, paddingHorizontal: 10 },
  compactMainRow: { flexDirection: 'row', alignItems: 'center' },
  vsBadgeSmall: { backgroundColor: '#FFF', width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: THEME.border, justifyContent: 'center', alignItems: 'center', marginHorizontal: -12, zIndex: 10 },
  vsBadgeText: { fontSize: 8, fontWeight: '900', color: THEME.textLight },
  
  compactTextContainer: { flex: 1, marginLeft: 16 },
  compactHeroTitle: { fontSize: 18, fontWeight: '900', color: THEME.textMain, letterSpacing: -0.5 },
  compactHeroDesc: { fontSize: 11, color: THEME.textLight, marginTop: 1 },

  avatarCircle: { borderRadius: 30, borderWidth: 2, borderColor: THEME.primary, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  liveIndicatorDot: { position: 'absolute', top: 0, right: 0, width: 9, height: 9, borderRadius: 4.5, backgroundColor: THEME.secondary, borderWidth: 2, borderColor: '#FFF' },

  modernActionRow: { flexDirection: 'row', gap: 10, width: '100%', height: 48 },
  modernSecondaryBtn: { borderRadius: 14, backgroundColor: '#FFF', borderWidth: 1, borderColor: THEME.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  
  modernPrimaryBtn: { flex: 1, borderRadius: 14, overflow: 'hidden', elevation: 6, shadowColor: THEME.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
  modernPrimaryGradient: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  modernPrimaryText: { fontWeight: '900', color: '#FFF' },

  hubLink: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  hubLinkText: { color: THEME.textLight, fontSize: 11, fontWeight: '700' },

  footerLinks: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 15, marginTop: 10 },
  footerDivider: { width: 1, height: 12, backgroundColor: 'rgba(0,0,0,0.08)' },

  expandContent: { gap: 15 },
  expandTitle: { fontSize: 20, fontWeight: '900', color: THEME.textMain },

  choiceBtn: { width: '100%', height: 70, backgroundColor: THEME.primary, borderRadius: 20, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 15 },
  choiceBtnTitle: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  choiceBtnSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },

  inputGroup: { gap: 10 },
  input: { backgroundColor: THEME.border, height: 55, borderRadius: 15, paddingHorizontal: 15, fontSize: 16, fontWeight: '600', color: THEME.textMain },
  schedulePickerCard: { backgroundColor: '#FFF', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: THEME.border, gap: 12 },
  scheduleHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  clockBubble: { width: 36, height: 36, borderRadius: 18, backgroundColor: THEME.primary, justifyContent: 'center', alignItems: 'center' },
  scheduleLabel: { fontSize: 10, fontWeight: '800', color: THEME.textLight, letterSpacing: 1 },
  scheduleValue: { fontSize: 18, fontWeight: '900', color: THEME.textMain },
  timezoneMeta: { fontSize: 11, color: THEME.textLight, fontWeight: '600' },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  scheduleArrow: { width: 36, height: 36, borderRadius: 18, backgroundColor: THEME.border, justifyContent: 'center', alignItems: 'center' },
  scheduleArrowDisabled: { opacity: 0.45 },
  scheduleDatePill: { backgroundColor: THEME.border, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16 },
  scheduleDateText: { fontSize: 12, fontWeight: '800', color: THEME.textMain },
  timeStepBtn: { flex: 1, height: 40, borderRadius: 12, backgroundColor: THEME.border, justifyContent: 'center', alignItems: 'center' },
  timeStepText: { fontSize: 12, fontWeight: '800', color: THEME.textMain },
  kmRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kmChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: THEME.border },
  kmChipActive: { backgroundColor: THEME.primary },
  kmChipText: { fontSize: 12, fontWeight: '800', color: THEME.textMain },
  kmChipTextActive: { color: '#FFF' },

  cancelLink: { alignSelf: 'center', padding: 10 },
  cancelLinkText: { color: THEME.textLight, fontWeight: '700' },

  actionButton: { height: 60, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: THEME.primary },
  btnTextPlay: { fontSize: 16, fontWeight: '800', color: '#FFF' },
});
