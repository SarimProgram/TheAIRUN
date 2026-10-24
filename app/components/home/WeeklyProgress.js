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
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Trophy, Timer, Trash2, XCircle, PenLine, Crown } from 'lucide-react-native';
import { useWeeklyProgress } from '../../hooks/useWeeklyProgress';
import { useWager } from '../../hooks/useWager';
import { useAuth } from '../../src/auth/authContext';
import { API_BASE_URL } from '../../config/api';
import { getMappedDays } from '../../utils/planProjection';
import { getWeeklyAvatarSource, getOppositeWeeklyAvatarSource } from '../../utils/genderMascot';

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

const isWalkingGoalPlan = (plan) =>
  plan?.activityPreference === 'MOSTLY_WALKING' || plan?.trainingStyle === 'walkOnly';

const WeeklyRaceSection = () => {
  const { accessToken, user, authFetch, isAuthenticated } = useAuth();
  const { progress, partnerProgress, hasPartner, loading, refetch } = useWeeklyProgress({ accessToken });
  const { wager, overview, loading: wagerLoading, createWager, acceptWager, declineWager, removeWager, refetch: refetchWager } = useWager();

  const [userGender, setUserGender] = useState(
    typeof user?.gender === 'string' ? user.gender : null
  );
  const [isWalkingGoal, setIsWalkingGoal] = useState(false);

  const partnerGender = partnerProgress?.gender ?? null;
  const myAvatar = getWeeklyAvatarSource(userGender);
  const partnerAvatar = partnerGender
    ? getWeeklyAvatarSource(partnerGender)
    : getOppositeWeeklyAvatarSource(userGender);

  const activeWager = wager && !isWagerExpired(wager) ? wager : null;
  const [timeLeft, setTimeLeft] = useState(() => formatTimeRemaining(getWeekEndTime()));
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [customWager, setCustomWager] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [sending, setSending] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleData, setScheduleData] = useState({ mine: [], partner: [] });
  const [scheduleError, setScheduleError] = useState(null);
  const [wagerPickerVisible, setWagerPickerVisible] = useState(false);

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (typeof user?.gender === 'string' && user.gender.trim().length > 0) {
      setUserGender(user.gender);
    }
  }, [user?.gender]);

  useEffect(() => {
    if (!isAuthenticated) return;

    let isActive = true;

    const fetchProfileAndPlan = async () => {
      try {
        const [profileResponse, planResponse] = await Promise.all([
          authFetch(`${API_BASE_URL}/profile`),
          authFetch(`${API_BASE_URL}/plan`),
        ]);

        if (profileResponse.ok) {
          const data = await profileResponse.json();
          const nextGender = data?.user?.gender;
          if (isActive && typeof nextGender === 'string' && nextGender.trim().length > 0) {
            setUserGender(nextGender);
          }
        }

        if (planResponse.ok) {
          const data = await planResponse.json();
          if (isActive) {
            setIsWalkingGoal(isWalkingGoalPlan(data?.plan));
          }
        }
      } catch (error) {
        console.error('Failed to fetch profile or plan:', error);
      }
    };

    fetchProfileAndPlan();

    return () => {
      isActive = false;
    };
  }, [authFetch, isAuthenticated]);

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
      setSelectedPreset(null);
      setCustomWager('');
      setShowCustomInput(false);
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

  const selectedWagerTitle = selectedPreset || customWager.trim();
  const canSignWager = Boolean(selectedWagerTitle);

  const openWagerPicker = () => setWagerPickerVisible(true);

  const closeWagerPicker = () => {
    setWagerPickerVisible(false);
    setShowCustomInput(false);
  };

  const handleSelectPreset = (title) => {
    setSelectedPreset(title);
    setCustomWager('');
    setShowCustomInput(false);
    setWagerPickerVisible(false);
  };

  const handleConfirmCustomWager = () => {
    if (!customWager.trim()) return;
    setSelectedPreset(null);
    setShowCustomInput(false);
    setWagerPickerVisible(false);
  };

  const renderWagerPickerModal = () => (
    <Modal
      visible={wagerPickerVisible}
      transparent
      animationType="slide"
      onRequestClose={closeWagerPicker}
    >
      <TouchableWithoutFeedback onPress={closeWagerPicker}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalKeyboardContainer}
          >
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <View style={styles.modalHandle} />
                  <Text style={styles.modalTitle}>Choose Penalty</Text>
                  <Text style={styles.modalSubtitle}>Pick what happens if you lose this week</Text>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  <Text style={styles.sectionLabel}>Presets</Text>
                  <View style={styles.presetGrid}>
                    {PRESET_WAGERS.map((preset) => (
                      <TouchableOpacity
                        key={preset.title}
                        style={[
                          styles.presetChip,
                          selectedPreset === preset.title && styles.presetChipSelected,
                        ]}
                        onPress={() => handleSelectPreset(preset.title)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.presetEmoji}>{preset.emoji}</Text>
                        <Text style={[
                          styles.presetText,
                          selectedPreset === preset.title && styles.presetTextSelected,
                        ]}>
                          {preset.title}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={styles.dividerRow}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>OR</Text>
                    <View style={styles.dividerLine} />
                  </View>

                  <Text style={styles.sectionLabel}>Custom</Text>
                  <View style={styles.customInputContainer}>
                    <TextInput
                      style={styles.customInput}
                      placeholder="Type your penalty..."
                      placeholderTextColor={COLORS.textMuted}
                      value={customWager}
                      onChangeText={(text) => {
                        setCustomWager(text);
                        setSelectedPreset(null);
                        setShowCustomInput(true);
                      }}
                      maxLength={100}
                      returnKeyType="done"
                      onSubmitEditing={handleConfirmCustomWager}
                    />
                  </View>
                </ScrollView>

                <TouchableOpacity
                  style={[styles.sendWagerBtn, !customWager.trim() && styles.sendWagerBtnDisabled]}
                  onPress={handleConfirmCustomWager}
                  disabled={!customWager.trim()}
                  activeOpacity={0.85}
                >
                  <Text style={styles.sendWagerBtnText}>Use Custom Penalty</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );

  const renderSignatureRow = ({ youSigned, partnerSigned, partnerLabel }) => (
    <View style={styles.signatureRow}>
      <View style={styles.signatureBlock}>
        <Text style={styles.signatureLabel}>YOU</Text>
        <View style={[styles.signatureLine, youSigned && styles.signatureLineSigned]}>
          {youSigned ? (
            <>
              <PenLine size={12} color={COLORS.primary} strokeWidth={2.5} />
              <Text style={styles.signatureSignedText}>Signed</Text>
            </>
          ) : (
            <Text style={styles.signatureDashText}>— — — — —</Text>
          )}
        </View>
      </View>
      <View style={styles.signatureBlock}>
        <Text style={styles.signatureLabel}>{partnerLabel}</Text>
        <View style={[styles.signatureLine, partnerSigned && styles.signatureLineSigned]}>
          {partnerSigned ? (
            <>
              <PenLine size={12} color={COLORS.opponent} strokeWidth={2.5} />
              <Text style={[styles.signatureSignedText, { color: COLORS.opponent }]}>Signed</Text>
            </>
          ) : (
            <Text style={styles.signatureDashText}>— — — — —</Text>
          )}
        </View>
      </View>
    </View>
  );

  const renderWagerContract = ({ title, subtitle, youSigned, partnerSigned, children }) => (
    <View style={styles.wagerContractCard}>
      <View style={styles.wagerContractHeader}>
        <Text style={styles.wagerContractEyebrow}>WEEKLY WAGER</Text>
        {subtitle ? <Text style={styles.wagerContractMeta}>{subtitle}</Text> : null}
      </View>
      <Text style={styles.wagerContractLead} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>
        IF I LOSE, I WILL
      </Text>
      <View style={styles.wagerBlankRow}>
        <View style={styles.wagerBlankLine} />
        <Text style={styles.wagerBlankValue}>{title || '— — — — —'}</Text>
        <View style={styles.wagerBlankLine} />
      </View>
      {renderSignatureRow({ youSigned, partnerSigned, partnerLabel: partnerName })}
      {children}
    </View>
  );

  // --- Wager Section ---
  const renderWagerFooter = () => {
    const renderLastWeekNote = () =>
      lastWeekSummary ? <Text style={styles.wagerStatusNote}>{lastWeekSummary}</Text> : null;

    if (wagerLoading && !activeWager) {
      return (
        <View style={styles.wagerFooter}>
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      );
    }

    if (activeWager?.status === 'ACTIVE') {
      return (
        <View>
          {renderWagerContract({
            title: activeWager.title.toUpperCase(),
            subtitle: wagerDeadlineLabel,
            youSigned: true,
            partnerSigned: true,
            children: (
              <View style={styles.wagerContractFooter}>
                <View style={styles.activeWagerBadge}>
                  <Trophy size={10} color="#0F172A" strokeWidth={3} />
                  <Text style={styles.activeWagerBadgeText}>ACTIVE</Text>
                </View>
                <TouchableOpacity onPress={handleRemoveWager} style={styles.wagerRemoveBtn}>
                  <Trash2 size={12} color="#64748B" />
                </TouchableOpacity>
              </View>
            ),
          })}
          {renderLastWeekNote()}
        </View>
      );
    }

    if (activeWager?.status === 'PENDING' && activeWager.isSender) {
      return (
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          {renderWagerContract({
            title: activeWager.title.toUpperCase(),
            subtitle: wagerDeadlineLabel || 'Waiting for partner to sign',
            youSigned: true,
            partnerSigned: false,
            children: (
              <View style={styles.wagerContractFooter}>
                <View style={styles.pendingWagerBadge}>
                  <Timer size={10} color="#D97706" strokeWidth={3} />
                  <Text style={styles.pendingWagerBadgeText}>AWAITING SIGNATURE</Text>
                </View>
                <TouchableOpacity onPress={handleRemoveWager} style={styles.wagerRemoveBtn}>
                  <Trash2 size={12} color="#64748B" />
                </TouchableOpacity>
              </View>
            ),
          })}
          {renderLastWeekNote()}
        </Animated.View>
      );
    }

    if (activeWager?.status === 'PENDING' && !activeWager.isSender) {
      return (
        <View>
          {renderWagerContract({
            title: activeWager.title.toUpperCase(),
            subtitle: `${activeWager.partnerName} signed — sign to accept`,
            youSigned: false,
            partnerSigned: true,
            children: (
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
                    <>
                      <PenLine size={14} color="#FFF" strokeWidth={2.5} />
                      <Text style={styles.incomingWagerAcceptText}>Sign & Accept</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ),
          })}
          {renderLastWeekNote()}
        </View>
      );
    }

    return (
      <View>
        {renderWagerContract({
          title: selectedWagerTitle ? selectedWagerTitle.toUpperCase() : null,
          subtitle: lastWeekSummary || 'Pick a penalty for the loser',
          youSigned: false,
          partnerSigned: false,
          children: (
            <View style={styles.wagerDraftActions}>
              <TouchableOpacity
                style={styles.wagerEditBtn}
                onPress={openWagerPicker}
                activeOpacity={0.85}
              >
                <PenLine size={14} color={COLORS.primary} strokeWidth={2.5} />
                <Text style={styles.wagerEditBtnText}>
                  {selectedWagerTitle ? 'Edit penalty' : 'Choose penalty'}
                </Text>
              </TouchableOpacity>

              {canSignWager ? (
                <TouchableOpacity
                  style={styles.signWagerBtn}
                  onPress={handleSendWager}
                  disabled={sending}
                  activeOpacity={0.85}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <PenLine size={16} color="#FFF" strokeWidth={2.5} />
                      <Text style={styles.signWagerBtnText}>Sign & Send to {partnerName}</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
          ),
        })}
      </View>
    );
  };

  const renderPlayerBlock = ({
    avatar,
    mirrored,
    player,
    anim,
    isLeading,
    accentColor,
    tintColor,
    reversed,
  }) => (
    <View style={[styles.playerBlock, { backgroundColor: tintColor }]}>
      <View style={[styles.playerBlockRow, reversed && styles.playerBlockRowReversed]}>
        <View style={[styles.playerAvatarWrap, { backgroundColor: tintColor }]}>
          <View style={[styles.playerAvatarGlow, { backgroundColor: `${accentColor}20` }]} />
          <View style={mirrored ? styles.avatarMirror : null}>
            <Image
              source={avatar}
              style={styles.playerAvatar}
              contentFit="contain"
              contentPosition="bottom"
              backgroundColor="transparent"
            />
          </View>
        </View>

        <View style={[styles.playerStats, reversed && styles.playerStatsReversed]}>
          <View style={[styles.playerNameRow, reversed && styles.playerNameRowReversed]}>
            <Text style={styles.playerName}>{player.name}</Text>
            {isLeading ? <Crown size={14} color={accentColor} strokeWidth={2.5} /> : null}
          </View>
          <View style={[styles.playerKmRow, reversed && styles.playerKmRowReversed]}>
            <Text style={[styles.playerKm, { color: accentColor }]}>{player.current.toFixed(1)}</Text>
            <Text style={styles.playerKmUnit}>km</Text>
          </View>
          <View style={styles.playerBarTrack}>
            <Animated.View
              style={[
                styles.playerBarFill,
                {
                  width: anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
                  backgroundColor: accentColor,
                },
              ]}
            />
          </View>
          <Text style={[styles.playerMeta, reversed && styles.playerMetaReversed]}>
            {player.current.toFixed(1)} / {player.target} km · {player.remaining.toFixed(1)} left
          </Text>
        </View>
      </View>
    </View>
  );

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
        <Text style={styles.headerTitle}>
          {isWalkingGoal ? 'WALKING GOAL' : 'RUNNING GOAL'}
        </Text>
        <View style={styles.timerPill}>
          <Timer size={12} color={COLORS.textMuted} strokeWidth={2.5} />
          <Text style={styles.timerText}>{timeLeft}</Text>
        </View>
      </View>

      {/* --- DUEL + WAGER CARD --- */}
      <View style={styles.zigzagCard}>
        <TouchableOpacity
          style={styles.duelSection}
          activeOpacity={0.94}
          onPress={openScheduleModal}
        >
          {renderPlayerBlock({
            avatar: myAvatar,
            mirrored: false,
            player: player1,
            anim: animP1,
            isLeading: isP1Leading,
            accentColor: COLORS.primary,
            tintColor: COLORS.primaryLight,
            reversed: false,
          })}

          <View style={styles.vsHero}>
            <View style={styles.vsHeroInner}>
              <Text style={styles.vsHeroText}>VS</Text>
            </View>
          </View>

          {renderPlayerBlock({
            avatar: partnerAvatar,
            mirrored: true,
            player: player2,
            anim: animP2,
            isLeading: !isP1Leading && player2.current > 0,
            accentColor: COLORS.opponent,
            tintColor: COLORS.opponentLight,
            reversed: true,
          })}
        </TouchableOpacity>

        <View style={styles.wagerSection}>
          {renderWagerFooter()}
        </View>
      </View>

      {renderWagerPickerModal()}

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
  headerTitle: { fontSize: 16, fontWeight: '900', color: COLORS.text, letterSpacing: -0.5 },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 100,
  },
  timerText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textMuted,
    fontVariant: ['tabular-nums'],
  },

  zigzagCard: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEF2F6',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 4,
    position: 'relative',
  },
  duelSection: {
    position: 'relative',
  },
  wagerSection: {
    borderTopWidth: 1,
    borderTopColor: '#EEF2F6',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  vsHero: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -34,
    marginTop: -34,
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FFFFFF',
    padding: 4,
    zIndex: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 8,
  },
  vsHeroInner: {
    flex: 1,
    borderRadius: 30,
    backgroundColor: COLORS.vsBadge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vsHeroText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    fontStyle: 'italic',
    letterSpacing: -0.5,
  },
  playerBlock: {
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  playerBlockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  playerBlockRowReversed: {
    flexDirection: 'row-reverse',
  },
  playerAvatarWrap: {
    width: 128,
    height: 172,
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
    backgroundColor: 'transparent',
  },
  playerAvatarGlow: {
    position: 'absolute',
    bottom: 8,
    width: 92,
    height: 92,
    borderRadius: 46,
  },
  avatarMirror: {
    transform: [{ scaleX: -1 }],
    backgroundColor: 'transparent',
  },
  playerAvatar: {
    width: 124,
    height: 168,
    backgroundColor: 'transparent',
  },
  playerStats: {
    flex: 1,
    justifyContent: 'center',
    paddingRight: 4,
  },
  playerStatsReversed: {
    alignItems: 'flex-end',
    paddingRight: 0,
    paddingLeft: 4,
  },
  playerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  playerNameRowReversed: {
    flexDirection: 'row-reverse',
  },
  playerName: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.textMuted,
    letterSpacing: 1.2,
  },
  playerKmRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    marginBottom: 10,
  },
  playerKmRowReversed: {
    flexDirection: 'row-reverse',
  },
  playerKm: {
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: -2,
    lineHeight: 50,
    fontVariant: ['tabular-nums'],
  },
  playerKmUnit: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  playerBarTrack: {
    width: '100%',
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 42, 0.08)',
    overflow: 'hidden',
    marginBottom: 6,
  },
  playerBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  playerMeta: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    fontVariant: ['tabular-nums'],
  },
  playerMetaReversed: {
    textAlign: 'right',
  },

  crownText: { fontSize: 9, fontWeight: '900', color: COLORS.text },

  wagerFooter: { alignItems: 'center' },

  wagerContractCard: {
    paddingHorizontal: 2,
    paddingVertical: 0,
  },
  wagerContractHeader: {
    alignItems: 'center',
    marginBottom: 6,
  },
  wagerContractEyebrow: {
    fontSize: 9,
    fontWeight: '900',
    color: COLORS.textMuted,
    letterSpacing: 1.2,
  },
  wagerContractMeta: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginTop: 3,
    textAlign: 'center',
  },
  wagerContractLead: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: -0.4,
    lineHeight: 24,
    marginBottom: 2,
  },
  wagerBlankRow: {
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 10,
    gap: 5,
  },
  wagerBlankLine: {
    width: '68%',
    height: 1.5,
    backgroundColor: '#CBD5E1',
    borderRadius: 1,
  },
  wagerBlankValue: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.primary,
    textAlign: 'center',
    letterSpacing: 0.2,
    paddingHorizontal: 6,
  },
  signatureRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  signatureBlock: {
    flex: 1,
  },
  signatureLabel: {
    fontSize: 8,
    fontWeight: '900',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
    marginBottom: 4,
    textAlign: 'center',
  },
  signatureLine: {
    minHeight: 28,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 6,
  },
  signatureLineSigned: {
    backgroundColor: '#FFF1F2',
    borderColor: '#FECDD3',
  },
  signatureDashText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#CBD5E1',
    letterSpacing: 2,
  },
  signatureSignedText: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.primary,
  },
  wagerContractFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  presetGridInline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  presetChipInline: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    gap: 5,
  },
  presetChipInlineSelected: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  presetTextInline: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E293B',
  },
  presetTextInlineSelected: {
    color: COLORS.primary,
    fontWeight: '900',
  },
  customInputInline: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  wagerDraftActions: {
    gap: 8,
    marginTop: 2,
  },
  wagerEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#FECDD3',
    backgroundColor: '#FFF1F2',
  },
  wagerEditBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0.2,
  },
  signWagerBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  signWagerBtnDisabled: {
    backgroundColor: '#CBD5E1',
  },
  signWagerBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 0.2,
  },

  // --- REFINED WAGER STYLES ---
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
  wagerStatusNote: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, marginTop: 8 },

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
  incomingWagerButtonRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  incomingWagerDecline: { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.05)', alignItems: 'center' },
  incomingWagerDeclineText: { fontSize: 12, fontWeight: '800', color: '#64748B' },
  incomingWagerAccept: { flex: 1.5, paddingVertical: 10, borderRadius: 12, backgroundColor: COLORS.primary, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
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
  presetEmoji: { fontSize: 16 },
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
