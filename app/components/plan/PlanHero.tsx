import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  Image,
  Modal,
  Animated,
} from 'react-native';
import {
  Calendar, ChevronLeft, ChevronRight, Activity, AlertTriangle, X, AlertCircle,
  Footprints, Moon,
} from 'lucide-react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { getPlanHeroCopy, type HeroDayType, type HeroPeriod } from './PlanHeroText';
import { getGenderMascotSource } from '../../utils/genderMascot';
import type { DaySchedule } from '../../utils/planProjection';

const { width } = Dimensions.get('window');
const HERO_HEIGHT = 400;

export const COLORS = {
  // Theme-matching Palette
  primary: '#FF4757',
  primaryLight: '#FF6B6B',
  bgPink: '#FF4757',
  bgPinkLight: '#FF7E87', // Slightly softer red/coral
  textDarkRed: '#4A0E0E', // Deeper, more sophisticated
  glassWhite: 'rgba(255, 255, 255, 0.25)',

  // Existing Colors
  accent: '#FF4757',
  white: '#FFFFFF',
  textMain: '#1A1C1E',
  textSub: '#6C757D',
  primaryFade: 'rgba(255, 107, 107, 0.12)',
  success: '#00B894',
  successFade: 'rgba(0, 184, 148, 0.08)',
  afternoon: '#F59E0B',
  evening: '#6366F1',
  line: '#F1F3F5',
  inactive: '#DEE2E6',
  secondary: '#1A1C1E',
  water: '#3498DB',
};

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

type DailyTarget = {
  dayOfWeek: number;
  dayType: 'STEP' | 'RUN' | 'RECOVERY';
  [key: string]: any;
};

type ProjectedRunInfo = {
  isRunDay: boolean;
  runKm: number;
  runType: string | null;
  sessionId: string | null;
};

export type RunStatusEntry = {
  runStatus: string;   // 'NOT_SCHEDULED' | 'PENDING' | 'ATTEMPTED' | 'COMPLETED' | 'MISSED'
  runKmTarget: number;
  distanceKm: number;
};

// Map dayKey -> status
export type RunStatusMap = Record<string, RunStatusEntry>;

export type PlanHeroProps = {
  selectedDate: Date;
  selectedDayOfWeek: number;
  planDayNumber: number;
  currentWeek: number;
  dailyTargets: DailyTarget[];
  projectedRunInfo: ProjectedRunInfo;
  projectedDays: DaySchedule[];
  panResponderHandlers: any;
  runStatuses: RunStatusMap;

  // Callbacks
  onOpenWeeklyModal: () => void;
  onGoToToday: () => void;
  onGoToNextWeek: () => void;
  onGoToPreviousWeek: () => void;
  onSelectDay: (date: Date) => void;
  onStartRunPress: () => void;
  onMissedRunAction?: (action: 'run_now' | 'move_to_free', dayKey: string) => void;
  userGender?: string | null;

  // Night Walk Recovery
  showNightWalkRecoveryPrompt?: boolean;
  nightWalkRecoverySteps?: number;
  nightWalkRecoveryKm?: number;
  onConvertNightStepsToWalk?: () => void;
  weightDeltaKg?: number | null;
};

/** Format Date → YYYY-MM-DD (local) */
function formatDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function PlanHero({
  selectedDate,
  selectedDayOfWeek,
  planDayNumber,
  currentWeek,
  dailyTargets,
  projectedRunInfo,
  projectedDays,
  panResponderHandlers,
  runStatuses,
  onOpenWeeklyModal,
  onGoToToday,
  onGoToNextWeek,
  onGoToPreviousWeek,
  onSelectDay,
  onStartRunPress,
  onMissedRunAction,
  userGender,
  showNightWalkRecoveryPrompt,
  nightWalkRecoverySteps,
  nightWalkRecoveryKm,
  onConvertNightStepsToWalk,
  weightDeltaKg,
}: PlanHeroProps) {
  const [missedModal, setMissedModal] = useState<{ visible: boolean; dayKey: string; runKm: number }>({
    visible: false,
    dayKey: '',
    runKm: 0,
  });
  const [activeMessageIndex, setActiveMessageIndex] = useState(0);
  const textOpacity = useRef(new Animated.Value(1)).current;
  const textTranslateY = useRef(new Animated.Value(0)).current;

  // Calculate the Monday of the selected date's week
  const mondayOfWeek = new Date(selectedDate);
  mondayOfWeek.setDate(selectedDate.getDate() - selectedDayOfWeek);

  // Generate full date objects for the week
  const weekDateObjects = DAY_LABELS.map((_, i) => {
    const date = new Date(mondayOfWeek);
    date.setDate(mondayOfWeek.getDate() + i);
    return date;
  });

  const weekDates = weekDateObjects.map(d => d.getDate());
  const weekMonths = weekDateObjects.map(d => MONTH_ABBR[d.getMonth()]);
  const selectedDayKey = formatDayKey(selectedDate);
  const selectedRunStatus = runStatuses[selectedDayKey]?.runStatus;
  const selectedProjectedDay = projectedDays.find(day => day.dayIdx === selectedDayOfWeek);
  const selectedDayType = (
    selectedProjectedDay?.type ??
    dailyTargets.find(dt => dt.dayOfWeek === selectedDayOfWeek)?.dayType ??
    'STEP'
  ) as HeroDayType;
  const normalizedRunType = String(projectedRunInfo.runType || '').trim().toLowerCase();
  const isWalkSession = normalizedRunType.includes('walk');
  const now = new Date();
  const isToday = selectedDayKey === formatDayKey(now);
  const hour = now.getHours();
  const period: HeroPeriod = isToday ? (hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening') : 'day';
  const heroCopy = getPlanHeroCopy({
    currentWeek,
    dayNumber: planDayNumber,
    period,
    isToday,
    dayType: selectedDayType,
    isRunDay: projectedRunInfo.isRunDay,
    runStatus: selectedRunStatus,
    runKm: projectedRunInfo.runKm,
    showStepRecoveryPrompt: Boolean(showNightWalkRecoveryPrompt),
    nightWalkRecoverySteps,
    nightWalkRecoveryKm,
    weightDeltaKg,
  });
  const missedModalCopy = getPlanHeroCopy({
    currentWeek,
    dayNumber: planDayNumber,
    period,
    isToday,
    dayType: 'RUN',
    isRunDay: true,
    runStatus: 'MISSED',
    runKm: missedModal.runKm,
    showStepRecoveryPrompt: false,
    weightDeltaKg,
  });
  const heroMessages = heroCopy.messageQueue.length ? heroCopy.messageQueue : [heroCopy.mainMessage];
  const heroMessageKey = heroMessages.join('||');
  const activeHeroMessage = heroMessages[Math.min(activeMessageIndex, heroMessages.length - 1)] ?? heroCopy.mainMessage;
  const heroMainCtaLabel = projectedRunInfo.isRunDay
    ? `Start ${projectedRunInfo.runKm > 0 ? `${projectedRunInfo.runKm.toFixed(1)}km ` : ''}${isWalkSession ? 'Walk' : 'Run'}`
    : heroCopy.mainCtaLabel;
  const avatarSource = getGenderMascotSource(userGender);

  useEffect(() => {
    setActiveMessageIndex(0);
    textOpacity.setValue(0);
    textTranslateY.setValue(12);

    Animated.parallel([
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 320,
        useNativeDriver: true,
      }),
      Animated.timing(textTranslateY, {
        toValue: 0,
        duration: 320,
        useNativeDriver: true,
      }),
    ]).start();
  }, [heroMessageKey, textOpacity, textTranslateY]);

  useEffect(() => {
    if (heroMessages.length <= 1) return;

    const interval = setInterval(() => {
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(textTranslateY, {
          toValue: -10,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setActiveMessageIndex((prev) => {
          const next = (prev + 1) % heroMessages.length;
          textTranslateY.setValue(12);
          Animated.parallel([
            Animated.timing(textOpacity, {
              toValue: 1,
              duration: 260,
              useNativeDriver: true,
            }),
            Animated.timing(textTranslateY, {
              toValue: 0,
              duration: 260,
              useNativeDriver: true,
            }),
          ]).start();
          return next;
        });
      });
    }, 3200);

    return () => clearInterval(interval);
  }, [heroMessageKey, heroMessages.length, textOpacity, textTranslateY]);

  const handleDayPress = (date: Date, i: number) => {
    const dayKey = formatDayKey(date);
    const status = runStatuses[dayKey];
    const projectedDay = projectedDays.find((day) => day.dayIdx === i);
    const plannedRunKm = projectedDay?.type === 'RUN' ? projectedDay.targetKm : 0;

    // If this is a missed run day, show the recovery modal
    if (status?.runStatus === 'MISSED') {
      setMissedModal({
        visible: true,
        dayKey,
        runKm: plannedRunKm || status.runKmTarget,
      });
    }

    // Always select the day
    onSelectDay(date);
  };

  return (
    <View style={styles.heroContainer}>
      {/* Background Gradient */}
      <View style={styles.svgContainer}>
        <Svg height={HERO_HEIGHT} width={width} viewBox={`0 0 ${width} ${HERO_HEIGHT}`}>
          <Defs>
            <LinearGradient id="heroGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={COLORS.bgPink} />
              <Stop offset="1" stopColor={COLORS.bgPinkLight} />
            </LinearGradient>
          </Defs>
          <Path d={`M0 0 L${width} 0 L${width} ${HERO_HEIGHT} L0 ${HERO_HEIGHT} Z`} fill="url(#heroGrad)" />
        </Svg>
      </View>

      {/* Content Overlay */}
      <View style={styles.heroInner}>

        {/* 1. Top Row: Navigation icons / Calendar */}
        <View style={styles.topRow}>
          <View>
            <TouchableOpacity onPress={onOpenWeeklyModal} style={styles.planShortcutBtn}>
              <View style={styles.calendarIconBtn}>
                <Calendar size={20} color={COLORS.textDarkRed} />
              </View>
              <Text style={styles.planShortcutLabel}>Weekly Plan</Text>
            </TouchableOpacity>
          </View>

          {/* Glassmorphism Calendar Strip */}
          <View style={styles.glassCalendar} {...panResponderHandlers}>
            {/* Week Nav Row */}
            <View style={styles.weekNavRow}>
              <View style={{ width: 44 }} />
              <View style={styles.weekNavControls}>
                <TouchableOpacity onPress={onGoToPreviousWeek} style={styles.weekNavBtn} activeOpacity={0.6}>
                  <ChevronLeft size={16} color={currentWeek <= 1 ? 'rgba(139,46,46,0.25)' : COLORS.textDarkRed} />
                </TouchableOpacity>
                <Text style={styles.weekNavLabel}>WK {currentWeek}</Text>
                <TouchableOpacity onPress={onGoToNextWeek} style={styles.weekNavBtn} activeOpacity={0.6}>
                  <ChevronRight size={16} color={COLORS.textDarkRed} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={onGoToToday} style={styles.todayPillSmall}>
                <Text style={styles.todayPillText}>Today</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.calendarHeaderRow}>
              {DAY_LABELS.map((d, i) => (
                <Text key={`day-${i}`} style={[styles.glassDayText, i === selectedDayOfWeek && styles.activeGlassDayText]}>{d}</Text>
              ))}
            </View>
            <View style={styles.calendarDateRow}>
              {weekDates.map((d, i) => {
                const isSelected = i === selectedDayOfWeek;
                const projectedDay = projectedDays.find(day => day.dayIdx === i);
                const isRunDay = (projectedDay?.type ?? dailyTargets.find(dt => dt.dayOfWeek === i)?.dayType) === 'RUN';
                const dayKey = formatDayKey(weekDateObjects[i]);
                const dayStatus = runStatuses[dayKey]?.runStatus;
                const isMissed = dayStatus === 'MISSED';
                const isCompleted = dayStatus === 'COMPLETED';
                const isAttempted = dayStatus === 'ATTEMPTED';

                return (
                  <TouchableOpacity
                    key={`date-${i}`}
                    style={[
                      styles.glassDateBubble,
                      isSelected && styles.activeGlassDateBubble,
                      isRunDay && !isSelected && !isMissed && styles.runDayHighlight,
                      isMissed && styles.missedDayBubble,
                    ]}
                    onPress={() => handleDayPress(weekDateObjects[i], i)}
                  >
                    {/* Date number with strikethrough for missed */}
                    <View style={{ position: 'relative', alignItems: 'center' }}>
                      <Text style={[
                        styles.glassDateText,
                        isSelected && styles.activeGlassDateNum,
                        isMissed && styles.missedDateText,
                      ]}>
                        {d}
                      </Text>
                      {isMissed && (
                        <View style={styles.missedBadge}>
                          <AlertCircle size={8} color="#FFF" strokeWidth={4} />
                        </View>
                      )}
                    </View>
                    <Text style={[
                      styles.glassMonthText,
                      isSelected && styles.activeGlassMonthText,
                      isMissed && { opacity: 0.4 },
                    ]}>
                      {weekMonths[i]}
                    </Text>
                    {/* Status dots */}
                    {isRunDay && isCompleted && (
                      <View style={[styles.runDot, { backgroundColor: COLORS.success }]} />
                    )}
                    {isRunDay && isAttempted && (
                      <View style={[styles.runDot, { backgroundColor: COLORS.afternoon }]} />
                    )}
                    {isRunDay && isMissed && (
                      <View style={[styles.runDot, styles.missedRunDot]} />
                    )}
                    {isRunDay && !isMissed && !isCompleted && !isAttempted && (
                      <View style={[styles.runDot, isSelected && { backgroundColor: COLORS.accent }]} />
                    )}
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>
        </View>

        {/* 2. Middle Row: Avatar and Text */}
        <View style={styles.midRow}>
          {/* 3D Avatar Image */}
          <Image
            source={avatarSource}
            style={styles.avatarImage}
            resizeMode="cover"
          />

          {/* Motivational Text Block */}
          <View style={styles.textBlock}>
            <View style={styles.dayTag}>
              <Text style={styles.dayTagText}>{heroCopy.dayTag}</Text>
            </View>

            <Animated.View
              style={[
                styles.heroTextFrame,
                { opacity: textOpacity, transform: [{ translateY: textTranslateY }] },
              ]}
            >
              <Text style={styles.heroTextMain}>
                {activeHeroMessage}
              </Text>
            </Animated.View>

            {projectedRunInfo.isRunDay && !showNightWalkRecoveryPrompt && (
              <TouchableOpacity
                style={styles.heroMainCTA}
                onPress={onStartRunPress}
              >
                <Activity size={16} color="#FFF" />
                <Text style={styles.heroMainCTAText}>{heroMainCtaLabel}</Text>
              </TouchableOpacity>
            )}

            {showNightWalkRecoveryPrompt && (
              <TouchableOpacity
                style={styles.heroNightBoost}
                onPress={onConvertNightStepsToWalk}
              >
                <View style={styles.heroBoostHeader}>
                  <Moon size={12} color="#6366F1" fill="#6366F1" />
                  <Text style={styles.heroBoostLabel}>{heroCopy.recoveryLabel}</Text>
                </View>
                <Text style={styles.heroBoostText}>
                  {heroCopy.recoveryMessage}
                </Text>
                <View style={styles.heroBoostBtn}>
                  <Footprints size={12} color="#FFF" />
                  <Text style={styles.heroBoostBtnText}>{heroCopy.recoveryButtonLabel}</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>

      </View>

      {/* ==================== Missed Run Recovery Modal ==================== */}
      <Modal
        visible={missedModal.visible}
        transparent
        animationType="slide"
        onRequestClose={() => setMissedModal({ ...missedModal, visible: false })}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {/* Drag handle */}
            <View style={styles.modalDragHandle} />

            {/* Close button */}
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setMissedModal({ ...missedModal, visible: false })}
            >
              <X size={20} color={COLORS.textSub} />
            </TouchableOpacity>

            {/* Warning icon */}
            <View style={styles.warningIconContainer}>
              <AlertTriangle size={32} color="#FF4444" />
            </View>

            <Text style={styles.modalTitle}>{missedModalCopy.missedRunModalTitle}</Text>
            <Text style={styles.modalSubtitle}>
              {missedModalCopy.missedRunModalSubtitle}
            </Text>

            {/* Option 1: Run Now */}
            <TouchableOpacity
              style={styles.optionBtnPrimary}
              onPress={() => {
                setMissedModal({ ...missedModal, visible: false });
                onMissedRunAction?.('run_now', missedModal.dayKey);
              }}
            >
              <Activity size={18} color="#FFF" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.optionBtnPrimaryText}>{missedModalCopy.missedRunPrimaryTitle}</Text>
                <Text style={styles.optionBtnPrimarySubtext}>
                  {missedModalCopy.missedRunPrimarySubtitle}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Option 2: Move to Free Day */}
            <TouchableOpacity
              style={styles.optionBtnSecondary}
              onPress={() => {
                setMissedModal({ ...missedModal, visible: false });
                onMissedRunAction?.('move_to_free', missedModal.dayKey);
              }}
            >
              <Calendar size={18} color={COLORS.textMain} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.optionBtnSecondaryText}>{missedModalCopy.missedRunSecondaryTitle}</Text>
                <Text style={styles.optionBtnSecondarySubtext}>
                  {missedModalCopy.missedRunSecondarySubtitle}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Option 3: Skip */}
            <TouchableOpacity
              style={styles.skipBtn}
              onPress={() => setMissedModal({ ...missedModal, visible: false })}
            >
              <Text style={styles.skipBtnText}>{missedModalCopy.missedRunSkipLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  // Hero Section
  heroContainer: { height: HERO_HEIGHT, position: 'relative', overflow: 'hidden' },
  svgContainer: { ...StyleSheet.absoluteFillObject },
  heroInner: { flex: 1, paddingTop: 80, paddingHorizontal: 20 },

  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  planShortcutBtn: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
    width: 76,
    paddingHorizontal: 6,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  calendarIconBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: COLORS.primaryFade,
    justifyContent: 'center', alignItems: 'center',
    marginTop: 0
  },
  planShortcutTextWrap: {
    alignItems: 'flex-start',
  },
  planShortcutEyebrow: {
    fontSize: 9,
    fontWeight: '900',
    color: 'rgba(74, 14, 14, 0.65)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  planShortcutLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: COLORS.textDarkRed,
    marginTop: 4,
    textAlign: 'center',
  },

  // Glass Calendar
  glassCalendar: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    width: width * 0.66,
    marginTop: -30,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  calendarHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 4
  },
  glassDayText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textDarkRed,
    opacity: 0.6,
    width: 28,
    textAlign: 'center'
  },
  activeGlassDayText: {
    opacity: 1,
    fontWeight: '800'
  },
  calendarDateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  glassDateBubble: {
    width: 28, height: 38,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 2,
  },
  activeGlassDateBubble: {
    backgroundColor: '#FFF',
  },
  glassDateText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textDarkRed,
    opacity: 0.8
  },
  activeGlassDateNum: {
    color: COLORS.accent,
    fontWeight: '800',
    opacity: 1
  },
  glassMonthText: {
    fontSize: 8,
    fontWeight: '600',
    color: COLORS.textDarkRed,
    opacity: 0.5,
    marginTop: 1,
    textTransform: 'uppercase',
  },
  activeGlassMonthText: {
    color: COLORS.accent,
    opacity: 0.8,
    fontWeight: '700',
  },
  weekNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  weekNavControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  weekNavBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  weekNavLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.textDarkRed,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  todayPillSmall: {
    backgroundColor: 'rgba(255,255,255,0.4)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  todayPillText: {
    fontSize: 8,
    fontWeight: '800',
    color: COLORS.textDarkRed,
    textTransform: 'uppercase',
  },

  // Missed day styling
  missedDayBubble: {
    backgroundColor: 'rgba(255, 107, 107, 0.05)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 107, 107, 0.3)',
    borderStyle: 'dashed',
  },
  missedDateText: {
    color: COLORS.accent,
    opacity: 0.3,
  },
  missedBadge: {
    position: 'absolute',
    top: -4,
    right: -6,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 1,
    shadowOffset: { width: 0, height: 1 },
  },
  missedRunDot: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.accent,
  },

  // Mid Row (Image & Text)
  midRow: {
    flex: 1,
    flexDirection: 'row',
    marginTop: 10,
    position: 'relative'
  },
  avatarImage: {
    width: 180,
    height: 310,
    position: 'absolute',
    left: -20,
    bottom: -60,
    zIndex: 10,
  },
  textBlock: {
    flex: 1,
    marginLeft: 135,
    marginTop: 0,
    alignItems: 'flex-start',
  },
  heroTextFrame: {
    minHeight: 96,
    justifyContent: 'flex-start',
  },
  heroTextMain: {
    fontSize: 20,
    color: '#FFF',
    lineHeight: 28,
    fontWeight: '600',
    textAlign: 'left',
  },
  dayTag: {
    backgroundColor: 'rgba(255,255,255,0.4)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)'
  },
  dayTagText: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 1,
  },
  runDayHighlight: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  runDot: {
    position: 'absolute',
    bottom: 2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.textDarkRed,
  },

  // Hero Action Button (Central CTA)
  heroMainCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 12,
    gap: 8,
    shadowColor: COLORS.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  heroMainCTAText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.3,
  },

  // Night Boost in Hero
  heroNightBoost: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    padding: 12,
    marginTop: 10,
    width: width * 0.45,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  heroBoostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  heroBoostLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#6366F1',
    letterSpacing: 0.5,
  },
  heroBoostText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4A0E0E',
    lineHeight: 14,
    marginBottom: 8,
  },
  heroBoostBtn: {
    backgroundColor: '#1A1C1E',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  heroBoostBtnText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900',
  },

  // ==================== Missed Run Modal ====================
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
    alignItems: 'center',
  },
  modalDragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    marginBottom: 16,
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 16,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  warningIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.textMain,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: COLORS.textSub,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  optionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accent,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 20,
    width: '100%',
    marginBottom: 12,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  optionBtnPrimaryText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFF',
  },
  optionBtnPrimarySubtext: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  optionBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 20,
    width: '100%',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  optionBtnSecondaryText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textMain,
  },
  optionBtnSecondarySubtext: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSub,
    marginTop: 2,
  },
  skipBtn: {
    paddingVertical: 12,
    marginTop: 4,
  },
  skipBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSub,
  },
});
