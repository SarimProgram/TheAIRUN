import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated, 
  Easing, 
  Dimensions, 
  ActivityIndicator, 
  Modal, 
  TouchableOpacity, 
  TextInput, 
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Trophy, Swords, Timer, Zap, Trash2, CheckCircle2, XCircle, Plus, ChevronRight, Target } from 'lucide-react-native';
import { useWeeklyProgress } from '../../hooks/useWeeklyProgress';
import { useWager } from '../../hooks/useWager';
import { useAuth } from '../../src/auth/authContext';
import { API_BASE_URL } from '../../config/api';
import { getMappedDays } from '../../utils/planProjection';

const { width, height } = Dimensions.get('window');

// --- THEME ---
const COLORS = {
  primary: '#F43F5E',      // Vibrant Red/Pink (You)
  primaryLight: '#FFF1F2',

  opponent: '#0F766E',     // Deep Teal (Partner)
  opponentLight: '#F0FDFA',

  bg: 'transparent',
  text: '#1E293B',
  textMuted: '#64748B',

  vsBadge: '#1E293B',
  vsText: '#FFFFFF',
  white: '#FFFFFF',
  border: '#F1F5F9',

  accent: '#8B5CF6',       // Purple for wager accents
  accentLight: '#EDE9FE',
  success: '#10B981',
  successLight: '#ECFDF5',
  warning: '#F59E0B',
  warningLight: '#FFFBEB',
};

const PRESET_WAGERS = [
  { emoji: '🧺', title: 'Laundry Duty' },
  { emoji: '🍳', title: 'Cook Dinner' },
  { emoji: '☕', title: 'Buy Coffee' },
  { emoji: '💆', title: 'Give a Massage' },
  { emoji: '🧹', title: 'Clean the House' },
  { emoji: '🎬', title: 'Pick the Movie' },
];

const formatTimeRemaining = (endTime) => {
  const total = Date.parse(endTime) - Date.parse(new Date());
  if (total <= 0) return "00:00:00";

  const seconds = Math.floor((total / 1000) % 60);
  const minutes = Math.floor((total / 1000 / 60) % 60);
  const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
  const days = Math.floor(total / (1000 * 60 * 60 * 24));

  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
};

// Calculate end of week (Sunday 11:59 PM)
const getWeekEndTime = () => {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  const sunday = new Date(now);
  sunday.setDate(now.getDate() + daysUntilSunday);
  sunday.setHours(23, 59, 59, 999);
  return sunday;
};

const formatWeekRange = (weekStart, weekEnd, weekTimezone) => {
  if (!weekStart || !weekEnd) return '';

  const start = new Date(weekStart);
  const end = new Date(weekEnd);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return '';
  }

  const formatOptions = weekTimezone
    ? { timeZone: weekTimezone, month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric' };

  return `${start.toLocaleDateString('en-US', formatOptions)} - ${end.toLocaleDateString('en-US', formatOptions)}`;
};

const formatWagerDeadline = (weekEnd, weekTimezone) => {
  if (!weekEnd) return '';

  const end = new Date(weekEnd);
  if (Number.isNaN(end.getTime())) return '';

  return end.toLocaleDateString('en-US', {
    ...(weekTimezone ? { timeZone: weekTimezone } : {}),
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

const isWagerExpired = (wager) => {
  if (!wager?.weekEnd) return false;

  const end = new Date(wager.weekEnd);
  if (Number.isNaN(end.getTime())) return false;

  return end.getTime() <= Date.now();
};

const WeeklyRaceSection = () => {
  const { accessToken } = useAuth();
  const { progress, partnerProgress, hasPartner, loading, refetch } = useWeeklyProgress({ accessToken });
  const { wager, overview, loading: wagerLoading, createWager, acceptWager, declineWager, removeWager, refetch: refetchWager } = useWager();

  const activeWager = wager && !isWagerExpired(wager) ? wager : null;
  const [timeLeft, setTimeLeft] = useState(() => formatTimeRemaining(getWeekEndTime()));
  const [modalVisible, setModalVisible] = useState(false);
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [customWager, setCustomWager] = useState('');
  const [sending, setSending] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleData, setScheduleData] = useState({ mine: [], partner: [] });
  const [scheduleError, setScheduleError] = useState(null);

  // Animations
  const modalAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const getCountdownTarget = () => {
      if (activeWager?.weekEnd) {
        const wagerEnd = new Date(activeWager.weekEnd);
        if (!Number.isNaN(wagerEnd.getTime()) && wagerEnd.getTime() > Date.now()) {
          return wagerEnd;
        }
      }

      return getWeekEndTime();
    };

    setTimeLeft(formatTimeRemaining(getCountdownTarget()));
    const timer = setInterval(() => setTimeLeft(formatTimeRemaining(getCountdownTarget())), 1000);
    return () => clearInterval(timer);
  }, [activeWager?.weekEnd]);

  // Polling: Update progress and wager every 30 seconds
  useEffect(() => {
    const pollInterval = setInterval(() => {
      refetch();
      refetchWager();
    }, 30000);
    return () => clearInterval(pollInterval);
  }, [refetch, refetchWager]);

  // Pulse animation for pending state
  useEffect(() => {
    if (activeWager?.status === 'PENDING') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.03, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [activeWager?.status, pulseAnim]);

  // Modal open/close animation
  useEffect(() => {
    Animated.timing(modalAnim, {
      toValue: modalVisible ? 1 : 0,
      duration: 300,
      easing: Easing.out(Easing.back(1)),
      useNativeDriver: true,
    }).start();
  }, [modalVisible]);

  // User data from hook
  const myKm = progress?.totalDistanceKm ?? 0;
  const myTarget = progress?.weeklyKmTarget ?? 35;
  const myRemaining = progress?.remaining ?? myTarget;

  // Partner data from hook
  const partnerKm = partnerProgress?.weeklyKm ?? 0;
  const partnerTarget = partnerProgress?.weeklyKmTarget ?? myTarget;
  const partnerRemaining = partnerProgress?.remaining ?? partnerTarget;
  const partnerName = partnerProgress?.name?.toUpperCase() || 'PARTNER';

  const player1 = {
    name: 'YOU',
    current: myKm,
    target: myTarget,
    remaining: myRemaining,
    color: COLORS.primary,
    bg: COLORS.primaryLight
  };

  const player2 = {
    name: partnerName,
    current: partnerKm,
    target: partnerTarget,
    remaining: partnerRemaining,
    color: COLORS.opponent,
    bg: COLORS.opponentLight
  };

  const p1TargetPercent = Math.min((player1.current / player1.target) * 100, 100);
  const p2TargetPercent = Math.min((player2.current / player2.target) * 100, 100);
  const isP1Leading = player1.current >= player2.current;
  const lastWager = overview?.lastWager ?? null;
  const lastOutcome = overview?.lastOutcome ?? null;
  const wagerDeadlineLabel = activeWager?.weekEnd ? `Ends ${formatWagerDeadline(activeWager.weekEnd, activeWager.weekTimezone)}` : null;
  const lastWeekSummary = lastWager
    ? lastOutcome?.loser === 'YOU'
      ? `${formatWeekRange(lastWager.weekStart, lastWager.weekEnd, lastWager.weekTimezone)}: You lost last week`
      : lastOutcome?.loser === 'PARTNER'
        ? `${formatWeekRange(lastWager.weekStart, lastWager.weekEnd, lastWager.weekTimezone)}: ${lastOutcome.partnerName} lost last week`
        : lastOutcome?.loser === 'BOTH'
          ? `${formatWeekRange(lastWager.weekStart, lastWager.weekEnd, lastWager.weekTimezone)}: Both lost last week`
        : `${formatWeekRange(lastWager.weekStart, lastWager.weekEnd, lastWager.weekTimezone)}: Nobody lost last week`
    : null;

  const animP1 = useRef(new Animated.Value(0)).current;
  const animP2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(animP1, { toValue: p1TargetPercent, duration: 1500, easing: Easing.out(Easing.back(1)), useNativeDriver: false }),
      Animated.timing(animP2, { toValue: p2TargetPercent, duration: 1500, easing: Easing.out(Easing.back(1)), useNativeDriver: false }),
    ]).start();
  }, [p1TargetPercent, p2TargetPercent]);

  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  });

  const normalizeAvailableDays = (days) =>
    Array.isArray(days)
      ? days.map((day) => Number(day)).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
      : [];

  const getCurrentWeekNumber = (planData) => {
    const anchor = planData?.createdAt || planData?.startDate;
    if (!anchor) return 1;

    const start = new Date(anchor);
    const today = new Date();
    const startMonday = new Date(start);
    const todayMonday = new Date(today);
    const startDay = (startMonday.getDay() + 6) % 7;
    const todayDay = (todayMonday.getDay() + 6) % 7;

    startMonday.setDate(startMonday.getDate() - startDay);
    todayMonday.setDate(todayMonday.getDate() - todayDay);
    startMonday.setHours(0, 0, 0, 0);
    todayMonday.setHours(0, 0, 0, 0);

    const diffWeeks = Math.floor((todayMonday.getTime() - startMonday.getTime()) / (1000 * 60 * 60 * 24 * 7));
    return Math.max(1, diffWeeks + 1);
  };

  const buildScheduleFromPlan = (planData, weeklyData) => {
    const weeklyTable = weeklyData?.['Weekly Plan Table'];
    if (!Array.isArray(weeklyTable) || !weeklyTable.length) return [];

    const currentWeek = getCurrentWeekNumber(planData);
    const week = weeklyTable.find((entry) => Number(entry?.Week) === currentWeek) || weeklyTable[0];
    if (!week) return [];

    return getMappedDays(week, normalizeAvailableDays(planData?.availableDays))
      .filter((day) => day.type === 'RUN')
      .map((day) => ({
        key: `${day.dayIdx}-${day.name}`,
        day: day.name,
        runType: day.runType || 'Run',
        targetKm: Number(day.targetKm || 0),
      }));
  };

  const fetchJsonIfOk = async (url) => {
    const response = await fetch(url, { headers: getAuthHeaders() });
    if (!response.ok) return null;
    return response.json();
  };

  const fetchScheduleDetails = async () => {
    if (!accessToken) return;

    setScheduleLoading(true);
    setScheduleError(null);

    try {
      const [myPlan, myWeekly, partnerWeekly] = await Promise.all([
        fetchJsonIfOk(`${API_BASE_URL}/plan`),
        fetchJsonIfOk(`${API_BASE_URL}/plan/weekly`),
        fetchJsonIfOk(`${API_BASE_URL}/plan/partner/weekly`),
      ]);

      const mine = buildScheduleFromPlan(myPlan?.plan, myWeekly);

      let partner = [];
      if (partnerWeekly) {
        const partnerPlan =
          partnerWeekly?.plan ||
          partnerWeekly?.partnerPlan ||
          partnerWeekly?.partner?.plan ||
          null;
        partner = buildScheduleFromPlan(partnerPlan, partnerWeekly);
      }

      setScheduleData({ mine, partner });
    } catch (err) {
      console.error('Failed to fetch weekly schedules:', err);
      setScheduleError('Unable to load scheduled runs right now.');
      setScheduleData({ mine: [], partner: [] });
    } finally {
      setScheduleLoading(false);
    }
  };

  const openScheduleModal = async () => {
    setScheduleModalVisible(true);
    await fetchScheduleDetails();
  };

  const handleSendWager = async () => {
    const title = selectedPreset || customWager.trim();
    if (!title) return;

    setSending(true);
    try {
      await createWager(title);
      setModalVisible(false);
      setSelectedPreset(null);
      setCustomWager('');
    } catch (err) {
      console.error('Failed to create wager:', err);
    } finally {
      setSending(false);
    }
  };

  const handleAcceptWager = async () => {
    if (!wager) return;
    setSending(true);
    try {
      await acceptWager(wager.id);
    } catch (err) {
      console.error('Failed to accept wager:', err);
    } finally {
      setSending(false);
    }
  };

  const handleDeclineWager = async () => {
    if (!wager) return;
    setSending(true);
    try {
      await declineWager(wager.id);
    } catch (err) {
      console.error('Failed to decline wager:', err);
    } finally {
      setSending(false);
    }
  };

  const handleRemoveWager = async () => {
    if (!wager) return;
    setSending(true);
    try {
      await removeWager(wager.id);
    } catch (err) {
      console.error('Failed to remove wager:', err);
    } finally {
      setSending(false);
    }
  };

  // --- Footer Wager Section ---
  const renderWagerFooter = () => {
    const renderLastWeekNote = () =>
      lastWeekSummary ? <Text style={styles.wagerStatusNote}>{lastWeekSummary}</Text> : null;

    // Loading state
    if (wagerLoading && !activeWager) {
      return (
        <View style={styles.wagerFooter}>
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      );
    }

    // ACTIVE wager — show the solid battle card
    if (activeWager?.status === 'ACTIVE') {
      return (
        <View style={styles.activeWagerCard}>
          <View style={styles.wagerCardHeader}>
            <View style={styles.activeWagerBadge}>
              <Trophy size={10} color="#0F172A" strokeWidth={3} />
              <Text style={styles.activeWagerBadgeText}>ACTIVE WAGER</Text>
            </View>
            <TouchableOpacity onPress={handleRemoveWager} style={styles.wagerRemoveBtn}>
              <Trash2 size={12} color="#64748B" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.activeWagerContentRow}>
            <View style={styles.activeWagerIconCircle}>
                <Swords size={18} color="#1E293B" />
            </View>
            <View style={styles.activeWagerTextCol}>
                <Text style={styles.wagerSmallLabel}>LOSER PAYS</Text>
                <Text style={styles.wagerMainValue}>{activeWager.title.toUpperCase()}</Text>
                {wagerDeadlineLabel ? <Text style={styles.wagerMetaText}>{wagerDeadlineLabel}</Text> : null}
            </View>
          </View>
          {renderLastWeekNote()}
        </View>
      );
    }

    // PENDING wager — I sent it, waiting for partner
    if (activeWager?.status === 'PENDING' && activeWager.isSender) {
      return (
        <Animated.View style={[styles.pendingWagerCard, { transform: [{ scale: pulseAnim }] }]}>
          <View style={styles.wagerCardHeader}>
            <View style={styles.pendingWagerBadge}>
              <Timer size={10} color="#D97706" strokeWidth={3} />
              <Text style={styles.pendingWagerBadgeText}>SENT</Text>
            </View>
            <TouchableOpacity onPress={handleRemoveWager} style={styles.wagerRemoveBtn}>
              <Trash2 size={12} color="#64748B" />
            </TouchableOpacity>
          </View>
          <Text style={styles.pendingWagerTitle}>Waiting for partner...</Text>
          <Text style={styles.pendingWagerDetail}>Penalty: {activeWager.title}</Text>
          {wagerDeadlineLabel ? <Text style={styles.wagerMetaText}>{wagerDeadlineLabel}</Text> : null}
          {renderLastWeekNote()}
        </Animated.View>
      );
    }

    // PENDING wager — Partner sent it, I need to accept/decline
    if (activeWager?.status === 'PENDING' && !activeWager.isSender) {
      return (
        <View style={styles.incomingWagerCard}>
          <View style={styles.incomingWagerBadgeRow}>
             <Zap size={10} color="#F43F5E" strokeWidth={3} />
             <Text style={styles.incomingWagerBadgeLabel}>CHALLENGE RECEIVED</Text>
          </View>
          
          <Text style={styles.incomingWagerBodyText}>
            {activeWager.partnerName} wants to bet:{' '}
            <Text style={styles.incomingWagerHighlight}>&ldquo;{activeWager.title}&rdquo;</Text>
          </Text>
          {wagerDeadlineLabel ? <Text style={styles.wagerMetaText}>{wagerDeadlineLabel}</Text> : null}
          
          <View style={styles.incomingWagerButtonRow}>
            <TouchableOpacity
              style={styles.incomingWagerDecline}
              onPress={handleDeclineWager}
              disabled={sending}
            >
              <Text style={styles.incomingWagerDeclineText}>Decline</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.incomingWagerAccept}
              onPress={handleAcceptWager}
              disabled={sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.incomingWagerAcceptText}>Accept</Text>
              )}
            </TouchableOpacity>
          </View>
          {renderLastWeekNote()}
        </View>
      );
    }

    // NO WAGER — show simple CTA card
    return (
      <TouchableOpacity
        style={styles.simpleSetWagerCard}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
      >
         <View style={styles.simpleWagerIconInner}>
            <Swords size={16} color="#64748B" />
         </View>
         <View style={styles.simpleWagerTextInner}>
            <Text style={styles.simpleWagerTitle}>ADD WEEKLY WAGER</Text>
            <Text style={styles.simpleWagerSub}>{lastWeekSummary || 'Pick a penalty for the loser'}</Text>
         </View>
         <View style={styles.simpleWagerPlusPill}>
            <Plus size={14} color="#FFF" strokeWidth={3} />
         </View>
      </TouchableOpacity>
    );
  };

  if (loading && !progress) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="small" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>

        {/* --- TOP HEADER --- */}
      <View style={styles.header}>
        <View style={styles.titleGroup}>
          <Image
            source={require('../../assets/Ru.png')}
            style={styles.headerIcon}
            contentFit="contain"
          />
          <Text style={styles.headerTitle}>RUNNING GOAL</Text>
        </View>
        <View style={styles.timerPill}>
          <Text style={styles.timerText}>{timeLeft}</Text>
        </View>
      </View>

      {/* --- DUEL CARD --- */}
      <TouchableOpacity
        style={styles.splitCard}
        activeOpacity={0.92}
        onPress={openScheduleModal}
      >

        <LinearGradient
          colors={['#FFFFFF', '#FFF7F5']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.splitCardBg}
        />

        <View style={styles.splitCardTopRow}>
          <View style={styles.splitCardBadge}>
            <Target size={12} color="#0F172A" strokeWidth={2.8} />
            <Text style={styles.splitCardBadgeText}>This Week</Text>
          </View>
        </View>

        {/* PLAYER 1 */}
        <View style={[styles.side, { backgroundColor: player1.bg }]}>
          <Text style={styles.nameLabel}>{player1.name}</Text>
          <View style={styles.scoreRow}>
            <Text style={[styles.hugeNumber, { color: player1.color }]}>{player1.current.toFixed(1)}</Text>
            <Text style={styles.unit}>km</Text>
          </View>

          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { width: animP1.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }), backgroundColor: player1.color }]} />
          </View>

          {/* Goal text under progress bar */}
          <View style={styles.goalTextContainer}>
            <Text style={styles.goalTextMain}>{player1.current.toFixed(1)} / {player1.target} km</Text>
            <Text style={styles.goalTextRemaining}>{player1.remaining.toFixed(1)} km remaining</Text>
          </View>

          {isP1Leading && <View style={styles.crownPill}><Text style={styles.crownText}>WINNING</Text></View>}
        </View>

        {/* VS DIVIDER */}
        <View style={styles.vsContainer}>
          <View style={styles.vsCircle}>
            <Text style={styles.vsText}>VS</Text>
          </View>
        </View>

        {/* PLAYER 2 */}
        <View style={[styles.side, { backgroundColor: player2.bg }]}>
          <Text style={styles.nameLabel}>{player2.name}</Text>
          <View style={styles.scoreRow}>
            <Text style={[styles.hugeNumber, { color: player2.color }]}>{player2.current.toFixed(1)}</Text>
            <Text style={styles.unit}>km</Text>
          </View>

          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { width: animP2.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }), backgroundColor: player2.color }]} />
          </View>

          {/* Goal text under progress bar */}
          <View style={styles.goalTextContainer}>
            <Text style={styles.goalTextMain}>{player2.current.toFixed(1)} / {player2.target} km</Text>
            <Text style={styles.goalTextRemaining}>{player2.remaining.toFixed(1)} km remaining</Text>
          </View>

          {!isP1Leading && player2.current > 0 && <View style={styles.crownPill}><Text style={styles.crownText}>WINNING</Text></View>}
        </View>
      </TouchableOpacity>

      {/* --- FOOTER - WAGER SECTION --- */}
      {renderWagerFooter()}

      {/* --- WAGER MODAL --- */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="none"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView 
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.modalKeyboardContainer}
            >
              <TouchableWithoutFeedback onPress={() => {}}>
                <Animated.View style={[
                  styles.modalContent,
                  {
                    transform: [
                      { translateY: modalAnim.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }) },
                    ],
                    opacity: modalAnim,
                  }
                ]}>
                  {/* Modal Header */}
                  <View style={styles.modalHeader}>
                    <View style={styles.modalHandle} />
                    <Text style={styles.modalTitle}>🎯 Set Weekly Wager</Text>
                    <Text style={styles.modalSubtitle}>Challenge your partner for this week</Text>
                  </View>

                  <ScrollView 
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 20 }}
                  >
                    {/* Preset Chips */}
                    <Text style={styles.sectionLabel}>CHOOSE A WAGER</Text>
                    <View style={styles.presetGrid}>
                      {PRESET_WAGERS.map((preset) => (
                        <TouchableOpacity
                          key={preset.title}
                          style={[
                            styles.presetChip,
                            selectedPreset === preset.title && styles.presetChipSelected,
                          ]}
                          onPress={() => {
                            setSelectedPreset(selectedPreset === preset.title ? null : preset.title);
                            setCustomWager('');
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.presetEmoji}>{preset.emoji}</Text>
                          <Text style={[
                            styles.presetText,
                            selectedPreset === preset.title && styles.presetTextSelected,
                          ]}>{preset.title}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Divider */}
                    <View style={styles.dividerRow}>
                      <View style={styles.dividerLine} />
                      <Text style={styles.dividerText}>OR</Text>
                      <View style={styles.dividerLine} />
                    </View>

                    {/* Custom Input */}
                    <View style={styles.customInputContainer}>
                      <TextInput
                        style={styles.customInput}
                        placeholder="Type a custom wager..."
                        placeholderTextColor={COLORS.textMuted}
                        value={customWager}
                        onChangeText={(text) => {
                          setCustomWager(text);
                          setSelectedPreset(null);
                        }}
                        maxLength={100}
                        returnKeyType="done"
                      />
                    </View>

                    {/* Send Button */}
                    <TouchableOpacity
                      style={[
                        styles.sendWagerBtn,
                        !(selectedPreset || customWager.trim()) && styles.sendWagerBtnDisabled,
                      ]}
                      onPress={handleSendWager}
                      disabled={!(selectedPreset || customWager.trim()) || sending}
                      activeOpacity={0.8}
                    >
                      {sending ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <Text style={styles.sendWagerBtnText}>
                          Send Wager to {partnerName}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </ScrollView>
                </Animated.View>
              </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={scheduleModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setScheduleModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setScheduleModalVisible(false)}>
          <View style={styles.scheduleOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.scheduleCard}>
                <View style={styles.scheduleHeader}>
                  <View>
                    <Text style={styles.scheduleTitle}>Scheduled Runs</Text>
                    <Text style={styles.scheduleSubtitle}>This week for you and your partner</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setScheduleModalVisible(false)}
                    style={styles.scheduleCloseBtn}
                  >
                    <XCircle size={20} color={COLORS.textMuted} />
                  </TouchableOpacity>
                </View>

                {scheduleLoading ? (
                  <View style={styles.scheduleLoadingState}>
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  </View>
                ) : (
                  <>
                    {scheduleError ? (
                      <Text style={styles.scheduleErrorText}>{scheduleError}</Text>
                    ) : null}

                    <View style={styles.scheduleColumns}>
                      <View style={styles.scheduleColumn}>
                        <View style={styles.scheduleColumnHeader}>
                          <Text style={styles.scheduleColumnLabel}>YOU</Text>
                          <Text style={styles.scheduleColumnCount}>{scheduleData.mine.length} runs</Text>
                        </View>
                        {scheduleData.mine.length ? (
                          scheduleData.mine.map((run) => (
                            <View key={run.key} style={styles.scheduleRunRow}>
                              <View style={styles.scheduleRunHeader}>
                                <Text style={styles.scheduleRunDay}>{run.day}</Text>
                                <Text style={styles.scheduleRunKm}>{run.targetKm.toFixed(1)} km</Text>
                              </View>
                              <View style={styles.scheduleRunMeta}>
                                <Text style={styles.scheduleRunType}>{run.runType}</Text>
                                <View style={styles.scheduleRunPill}>
                                  <Text style={styles.scheduleRunPillText}>Planned</Text>
                                </View>
                              </View>
                            </View>
                          ))
                        ) : (
                          <Text style={styles.scheduleEmptyText}>No scheduled runs found.</Text>
                        )}
                      </View>

                      <View style={styles.scheduleColumn}>
                        <View style={styles.scheduleColumnHeader}>
                          <Text style={styles.scheduleColumnLabel}>{partnerName}</Text>
                          <Text style={styles.scheduleColumnCount}>{scheduleData.partner.length} runs</Text>
                        </View>
                        {scheduleData.partner.length ? (
                          scheduleData.partner.map((run) => (
                            <View key={run.key} style={[styles.scheduleRunRow, styles.scheduleRunRowPartner]}>
                              <View style={styles.scheduleRunHeader}>
                                <Text style={styles.scheduleRunDay}>{run.day}</Text>
                                <Text style={styles.scheduleRunKm}>{run.targetKm.toFixed(1)} km</Text>
                              </View>
                              <View style={styles.scheduleRunMeta}>
                                <Text style={styles.scheduleRunType}>{run.runType}</Text>
                                <View style={styles.scheduleRunPill}>
                                  <Text style={styles.scheduleRunPillText}>Planned</Text>
                                </View>
                              </View>
                            </View>
                          ))
                        ) : (
                          <Text style={styles.scheduleEmptyText}>No scheduled runs found.</Text>
                        )}
                      </View>
                    </View>
                  </>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingVertical: 10 },
  loadingContainer: {
    height: 280,
    justifyContent: 'center',
    alignItems: 'center'
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  headerIcon: {
    width: 28,
    height: 28,
  },
  headerTitle: { fontSize: 16, fontWeight: '900', color: COLORS.text, letterSpacing: -0.5 },
  timerPill: { backgroundColor: '#F1F5F9', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 100 },
  timerText: { fontSize: 12, fontWeight: '800', color: COLORS.textMuted, fontVariant: ['tabular-nums'] },

  splitCard: {
    flexDirection: 'row',
    height: 220,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: COLORS.white,
    position: 'relative',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F3E8E3',
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 26,
    elevation: 6,
  },
  splitCardBg: {
    ...StyleSheet.absoluteFillObject,
  },
  splitCardTopRow: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    zIndex: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  splitCardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  splitCardBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  side: { flex: 1, padding: 20, justifyContent: 'center', alignItems: 'center' },

  vsContainer: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -20,
    marginTop: -30,
    zIndex: 10,
  },
  vsCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.vsBadge,
    borderWidth: 4,
    borderColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center'
  },
  vsText: { color: 'white', fontWeight: '900', fontSize: 12, fontStyle: 'italic' },

  nameLabel: { fontSize: 12, fontWeight: '900', color: COLORS.textMuted, letterSpacing: 1, marginBottom: 4 },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2, marginBottom: 10 },
  hugeNumber: { fontSize: 32, fontWeight: '900' },
  unit: { fontSize: 14, fontWeight: '700', color: COLORS.textMuted },

  progressTrack: { width: '100%', height: 8, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },

  goalTextContainer: {
    marginTop: 8,
    alignItems: 'center',
  },
  goalTextMain: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.text,
  },
  goalTextRemaining: {
    fontSize: 9,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginTop: 2,
  },

  crownPill: {
    position: 'absolute',
    bottom: 12,
    backgroundColor: COLORS.white,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 100,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2
  },
  crownText: { fontSize: 9, fontWeight: '900', color: COLORS.text },

  wagerFooter: { padding: 10, alignItems: 'center' },

  // --- REFINED WAGER STYLES (NO GRADIENTS, SMALLER, RED THEME) ---
  activeWagerCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  wagerCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  activeWagerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activeWagerBadgeText: { fontSize: 9, fontWeight: '900', color: '#FFF', letterSpacing: 0.5 },
  wagerRemoveBtn: { padding: 4 },
  activeWagerContentRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  activeWagerIconCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#FFE4E6' },
  activeWagerTextCol: { flex: 1 },
  wagerSmallLabel: { fontSize: 8, fontWeight: '900', color: COLORS.primary, opacity: 0.8, letterSpacing: 1 },
  wagerMainValue: { fontSize: 15, fontWeight: '900', color: '#1E293B' },
  wagerMetaText: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, marginTop: 2 },
  wagerStatusNote: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, marginTop: 10 },

  pendingWagerCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  pendingWagerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D97706',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pendingWagerBadgeText: { fontSize: 9, fontWeight: '900', color: '#FFF' },
  pendingWagerTitle: { fontSize: 12, fontWeight: '800', color: '#92400E', marginTop: 2 },
  pendingWagerDetail: { fontSize: 11, fontWeight: '600', color: '#B45309' },

  incomingWagerCard: {
    backgroundColor: '#FFF1F2',
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FFE4E6',
  },
  incomingWagerBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  incomingWagerBadgeLabel: { fontSize: 9, fontWeight: '900', color: COLORS.primary, letterSpacing: 0.5 },
  incomingWagerBodyText: { fontSize: 13, fontWeight: '700', color: '#1E293B' },
  incomingWagerHighlight: { color: COLORS.primary, fontWeight: '900' },
  incomingWagerButtonRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  incomingWagerDecline: { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.05)', alignItems: 'center' },
  incomingWagerDeclineText: { fontSize: 12, fontWeight: '800', color: '#64748B' },
  incomingWagerAccept: { flex: 1.5, paddingVertical: 8, borderRadius: 10, backgroundColor: COLORS.primary, alignItems: 'center' },
  incomingWagerAcceptText: { fontSize: 12, fontWeight: '800', color: '#FFF' },

  simpleSetWagerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    gap: 12,
  },
  simpleWagerIconInner: { width: 34, height: 34, borderRadius: 10, backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center' },
  simpleWagerTextInner: { flex: 1 },
  simpleWagerTitle: { fontSize: 11, fontWeight: '900', color: COLORS.primary, letterSpacing: 0.5 },
  simpleWagerSub: { fontSize: 10, fontWeight: '600', color: '#94A3B8' },
  simpleWagerPlusPill: { width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },

  // --- MODAL ---
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalKeyboardContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '85%',
  },
  modalHeader: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 20,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#1E293B' },
  modalSubtitle: { fontSize: 13, fontWeight: '600', color: '#64748B' },

  sectionLabel: { fontSize: 10, fontWeight: '900', color: '#94A3B8', letterSpacing: 1.5, marginBottom: 12, textTransform: 'uppercase' },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    gap: 8,
    width: (width - 58) / 2,
  },
  presetChipSelected: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  presetEmoji: { fontSize: 18 },
  presetText: { fontSize: 13, fontWeight: '700', color: '#1E293B' },
  presetTextSelected: { color: COLORS.primary, fontWeight: '900' },

  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  dividerText: { fontSize: 11, fontWeight: '800', color: '#94A3B8' },

  customInputContainer: { marginBottom: 20 },
  customInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },

  sendWagerBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
  },
  sendWagerBtnDisabled: { backgroundColor: '#CBD5E1' },
  sendWagerBtnText: { fontSize: 15, fontWeight: '900', color: '#FFF', letterSpacing: 0.5 },

  scheduleOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  scheduleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 10,
  },
  scheduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  scheduleTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.text,
  },
  scheduleSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginTop: 4,
  },
  scheduleCloseBtn: {
    padding: 4,
  },
  scheduleLoadingState: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  scheduleErrorText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 12,
  },
  scheduleColumns: {
    gap: 14,
  },
  scheduleColumn: {
    backgroundColor: '#FCFCFD',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  scheduleColumnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  scheduleColumnLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.textMuted,
    letterSpacing: 1,
  },
  scheduleColumnCount: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
  },
  scheduleRunRow: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 18,
    padding: 14,
    marginBottom: 8,
  },
  scheduleRunRowPartner: {
    backgroundColor: COLORS.opponentLight,
  },
  scheduleRunHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  scheduleRunDay: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
  },
  scheduleRunMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  scheduleRunType: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
  },
  scheduleRunKm: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.text,
  },
  scheduleRunPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
  },
  scheduleRunPillText: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  scheduleEmptyText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
    lineHeight: 18,
  },
});

export default WeeklyRaceSection;
