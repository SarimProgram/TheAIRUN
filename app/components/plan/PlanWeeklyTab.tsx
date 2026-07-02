import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
} from 'react-native';
import {
  Lock,
  CheckCircle2,
  X,
  TrendingUp,
  Flame,
  Calendar,
  Target,
  ChevronRight,
  Footprints,
  Zap,
  Sunrise,
  Sun,
  Sunset,
  Dumbbell,
  RefreshCw,
} from 'lucide-react-native';
import { getMappedDays } from '../../utils/planProjection';

type WeekDailys = {
  stepDays: number;
  runDays: number;
  recoveryDays: number;
  runs: Array<{ runType: string; sessions: number; targetKm?: number }>;
};

export type WeekPlan = {
  Week: number;
  "Calories/day": number;
  "Protein/day": number;
  "Steps/day target": number;
  "Run km/week": number;
  "Expected weight": number;
  "Week name": string;
  "Week Dailys": WeekDailys;
};

export type PlanWeeklyTabProps = {
  weeklyPlan: WeekPlan[];
  currentWeek: number;

  selectedWeek: WeekPlan | null;
  onSelectWeek: (week: WeekPlan | null) => void;

  loading?: boolean;
  onRegeneratePlan?: () => void;
  devPrompt?: string | null;
  regenerating?: boolean;
  availableDays?: number[];
  onChangeScheduleDays?: (days: number[]) => void;
  scheduleUpdating?: boolean;
  trainingTimePreference?: 'morning' | 'afternoon' | 'evening' | 'night';
  onChangeTrainingTimePreference?: (time: 'morning' | 'afternoon' | 'evening') => void;
  onClose?: () => void;
};

type TrainingTimePreference = 'morning' | 'afternoon' | 'evening';
type LegacyTrainingTimePreference = TrainingTimePreference | 'night';

const DAY_OPTIONS = [
  { id: 0, label: 'Mon' },
  { id: 1, label: 'Tue' },
  { id: 2, label: 'Wed' },
  { id: 3, label: 'Thu' },
  { id: 4, label: 'Fri' },
  { id: 5, label: 'Sat' },
  { id: 6, label: 'Sun' },
];

const TIME_OPTIONS = [
  { id: 'morning', label: 'Morning', description: 'Runs and workouts shift to morning.', icon: Sunrise },
  { id: 'afternoon', label: 'Afternoon', description: 'Runs and workouts shift to afternoon.', icon: Sun },
  { id: 'evening', label: 'Evening', description: 'Runs and workouts shift to evening.', icon: Sunset },
] as const;

const COLORS = {
  primary: '#FF6B6B',
  primaryFade: 'rgba(255, 107, 107, 0.08)',
  secondary: '#1F938A',
  bg: '#FAFAFA',
  textMain: '#2D3436',
  textSub: '#636E72',
  line: '#E0E0E0',
  success: '#00B894',
  successFade: 'rgba(0, 184, 148, 0.08)',
  locked: '#B2BEC3',
};

export function PlanWeeklyTab({
  weeklyPlan,
  currentWeek,
  selectedWeek,
  onSelectWeek,
  loading,
  onRegeneratePlan,
  devPrompt,
  regenerating,
  availableDays = [],
  onChangeScheduleDays,
  scheduleUpdating,
  trainingTimePreference = 'morning',
  onChangeTrainingTimePreference,
  onClose,
}: PlanWeeklyTabProps) {
  const normalizeTrainingTimePreference = React.useCallback((time: LegacyTrainingTimePreference): TrainingTimePreference => {
    if (time === 'morning' || time === 'afternoon' || time === 'evening') return time;
    return 'evening';
  }, []);
  const [showScheduleEditor, setShowScheduleEditor] = React.useState(false);
  const [showTimeEditor, setShowTimeEditor] = React.useState(false);
  const [showDevPrompt, setShowDevPrompt] = React.useState(false);
  const [draftAvailableDays, setDraftAvailableDays] = React.useState<number[]>(availableDays);
  const [draftTrainingTimePreference, setDraftTrainingTimePreference] = React.useState<TrainingTimePreference>(
    normalizeTrainingTimePreference(trainingTimePreference)
  );

  React.useEffect(() => {
    setDraftAvailableDays(availableDays);
  }, [availableDays]);

  React.useEffect(() => {
    setDraftTrainingTimePreference(normalizeTrainingTimePreference(trainingTimePreference));
  }, [trainingTimePreference, normalizeTrainingTimePreference]);

  React.useEffect(() => {
    if (__DEV__ && devPrompt) {
      setShowDevPrompt(true);
    }
  }, [devPrompt]);

  const toggleDay = (day: number) => {
    setDraftAvailableDays((prev) => {
      const exists = prev.includes(day);
      if (exists && prev.length <= 3) return prev;
      return exists ? prev.filter((item) => item !== day) : [...prev, day].sort((a, b) => a - b);
    });
  };

  const handleScheduleSave = () => {
    onChangeScheduleDays?.(draftAvailableDays);
    setShowScheduleEditor(false);
  };

  const handleTimeSave = () => {
    onChangeTrainingTimePreference?.(draftTrainingTimePreference);
    setShowTimeEditor(false);
  };

  const getTimeLabel = (time: LegacyTrainingTimePreference) => {
    const normalizedTime = normalizeTrainingTimePreference(time);
    if (normalizedTime === 'afternoon') return 'Afternoon';
    if (normalizedTime === 'evening') return 'Evening';
    return 'Morning';
  };

  const getTimeAccent = (time: LegacyTrainingTimePreference) => {
    const normalizedTime = normalizeTrainingTimePreference(time);
    if (normalizedTime === 'afternoon') return '#F59E0B';
    if (normalizedTime === 'evening') return '#6366F1';
    return COLORS.primary;
  };

  const normalizedTrainingTimePreference = normalizeTrainingTimePreference(trainingTimePreference);
  const TimeIcon = TIME_OPTIONS.find((option) => option.id === normalizedTrainingTimePreference)?.icon ?? Sunrise;

  const renderWeeklyItem = (week: WeekPlan, index: number) => {
    const isLast = index === weeklyPlan.length - 1;
    const isActive = week.Week === currentWeek;
    const isCompleted = week.Week < currentWeek;
    const isLocked = week.Week > currentWeek + 1;

    return (
      <View key={week.Week} style={styles.timelineRow}>
        <View style={styles.leftColumn}>
          {!isLast && (
            <View
              style={[
                styles.verticalLine,
                (isCompleted || isActive) ? styles.lineActive : styles.lineInactive,
              ]}
            />
          )}

          <View
            style={[
              styles.statusNode,
              isActive && styles.nodeActive,
              isCompleted && styles.nodeCompleted,
              isLocked && styles.nodeLocked,
            ]}
          >
            {isActive ? (
              <View style={styles.pulsingDot} />
            ) : isCompleted ? (
              <CheckCircle2 size={16} color="#FFF" />
            ) : (
              <Lock size={14} color="#FFF" />
            )}
          </View>
        </View>

        <View style={styles.rightColumn}>
          <TouchableOpacity
            style={[
              styles.card,
              isActive ? styles.cardActive : styles.cardDefault,
              isLocked && styles.cardLocked,
            ]}
            onPress={() => !isLocked && onSelectWeek(week)}
            activeOpacity={isLocked ? 1 : 0.7}
          >
            <View style={styles.cardHeader}>
              <Text style={[styles.weekLabel, isActive && { color: COLORS.primary }]}>
                WEEK {String(week.Week).padStart(2, '0')}
              </Text>
              {isActive && (
                <View style={styles.activeLabelBadge}>
                  <Text style={styles.activeLabelText}>CURRENT</Text>
                </View>
              )}
            </View>

            <Text style={[styles.cardTitle, isLocked && { color: COLORS.locked }]} numberOfLines={1}>
              {week["Week name"]}
            </Text>

            <View style={styles.optimizedStatsRow}>
              <View style={styles.optStatItem}>
                <Zap
                  size={16}
                  color={isLocked ? COLORS.locked : COLORS.primary}
                  fill={isLocked ? 'transparent' : COLORS.primary}
                />
                <Text style={styles.optStatText}>{week["Run km/week"]}km</Text>
              </View>

              <View style={styles.optStatDivider} />

              <View style={styles.optStatItem}>
                <Flame
                  size={16}
                  color={isLocked ? COLORS.locked : COLORS.secondary}
                  fill={isLocked ? 'transparent' : COLORS.secondary}
                />
                <Text style={styles.optStatText}>{week["Calories/day"]} kcal</Text>
              </View>
            </View>

            {/* Active Runs Summary */}
            <View style={styles.runsSummary}>
              {getMappedDays(week, availableDays)
                .filter(d => d.type === 'RUN')
                .map((run, i) => (
                  <View key={i} style={styles.runSummaryLine}>
                    <Text style={styles.runSummaryName} numberOfLines={1}>{run.runType}</Text>
                    <Text style={styles.runSummaryKm}>{run.targetKm}km</Text>
                  </View>
                ))}
            </View>

            {/* Daily Schedule Mini-Map - Sleek Horizontal Strip */}
            <View style={styles.miniMapContainer}>
              {getMappedDays(week, availableDays).map((day) => (
                <View
                  key={day.dayIdx}
                  style={[
                    styles.miniMapDay,
                    day.type === 'RUN' ? styles.miniMapRun : (day.type === 'RECOVERY' ? styles.miniMapRec : styles.miniMapRest)
                  ]}
                >
                  <Text style={styles.miniMapDayText}>{day.name.charAt(0)}</Text>
                  {day.type === 'RUN' && <View style={styles.miniMapDot} />}
                </View>
              ))}
            </View>

            <View style={styles.cardFooter}>
              <View style={styles.footerTarget}>
                <Target size={14} color={COLORS.success} />
                <Text style={styles.footerTargetText}>{week["Expected weight"]}kg Target</Text>
              </View>
              <View style={[styles.timePrefPill, { backgroundColor: `${getTimeAccent(trainingTimePreference)}14` }]}>
                <TimeIcon size={12} color={getTimeAccent(trainingTimePreference)} />
                <Text style={[styles.timePrefText, { color: getTimeAccent(trainingTimePreference) }]}>
                  {getTimeLabel(trainingTimePreference)}
                </Text>
              </View>
              <ChevronRight size={16} color={COLORS.locked} />
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View>
      {onClose && (
        <View style={styles.headerCloseRow}>
          <TouchableOpacity onPress={onClose} style={styles.headerCloseBtn}>
            <X size={20} color={COLORS.textMain} />
          </TouchableOpacity>
        </View>
      )}
      {loading ? (
        <ActivityIndicator size="small" color={COLORS.primary} />
      ) : (
        <>
          <View style={styles.topActionsRow}>
            <TouchableOpacity
              style={styles.topActionBtn}
              onPress={() => setShowScheduleEditor(true)}
              disabled={scheduleUpdating || regenerating}
            >
              {scheduleUpdating ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <>
                  <Calendar size={18} color={COLORS.primary} />
                  <Text style={styles.topActionText} numberOfLines={1} adjustsFontSizeToFit>Schedule Days</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.topActionBtn}
              onPress={() => setShowTimeEditor(true)}
              disabled={regenerating}
            >
              <TimeIcon size={18} color={getTimeAccent(trainingTimePreference)} />
              <Text style={styles.topActionText} numberOfLines={1} adjustsFontSizeToFit>Edit Time</Text>
            </TouchableOpacity>
          </View>

          {weeklyPlan.length === 0 ? (
            <View style={styles.emptyPlanCard}>
              <View style={styles.emptyPlanIcon}>
                <Calendar size={24} color={COLORS.primary} />
              </View>
              <Text style={styles.emptyPlanTitle}>No weekly plan yet</Text>
              <Text style={styles.emptyPlanText}>
                Generate your training plan to see each week, run days, recovery sessions, and targets.
              </Text>
              {onRegeneratePlan ? (
                <TouchableOpacity
                  style={styles.emptyPlanButton}
                  onPress={onRegeneratePlan}
                  disabled={regenerating || scheduleUpdating}
                  activeOpacity={0.85}
                >
                  {regenerating ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <RefreshCw size={16} color="#FFF" />
                      <Text style={styles.emptyPlanButtonText}>Generate Weekly Plan</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          {__DEV__ && onRegeneratePlan ? (
            <View style={styles.devActionRow}>
              <View style={styles.devActionStack}>
                <TouchableOpacity
                  style={styles.devRegenBtn}
                  onPress={onRegeneratePlan}
                  disabled={regenerating || scheduleUpdating}
                  activeOpacity={0.8}
                >
                  {regenerating ? (
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  ) : (
                    <>
                      <RefreshCw size={12} color={COLORS.primary} />
                      <Text style={styles.devRegenText}>Dev: Regenerate Plan</Text>
                    </>
                  )}
                </TouchableOpacity>

                {devPrompt ? (
                  <TouchableOpacity
                    style={styles.devPromptToggle}
                    onPress={() => setShowDevPrompt((prev) => !prev)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.devPromptToggleText}>
                      {showDevPrompt ? 'Hide Prompt' : 'Show Prompt'}
                    </Text>
                  </TouchableOpacity>
                ) : null}

                {showDevPrompt && devPrompt ? (
                  <View style={styles.devPromptCard}>
                    <Text style={styles.devPromptLabel}>Latest Plan Prompt</Text>
                    <ScrollView
                      style={styles.devPromptScroll}
                      contentContainerStyle={styles.devPromptScrollContent}
                      nestedScrollEnabled
                    >
                      <Text style={styles.devPromptText}>{devPrompt}</Text>
                    </ScrollView>
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}



          {weeklyPlan.map((week, index) => renderWeeklyItem(week, index))}
        </>
      )}

      <Modal
        visible={selectedWeek !== null}
        animationType="fade"
        transparent={true}
        onRequestClose={() => onSelectWeek(null)}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => onSelectWeek(null)}
          />
          <View style={styles.modalCard}>
            {selectedWeek && (
              <>
                <View style={styles.modalDragHandle} />
                <View style={styles.modalContentHeader}>
                  <Text style={styles.modalWeek}>WEEK {selectedWeek.Week}</Text>
                  <TouchableOpacity onPress={() => onSelectWeek(null)}>
                    <X size={20} color={COLORS.textSub} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.modalTitle}>{selectedWeek["Week name"]}</Text>

                <View style={styles.modalStatsGrid}>
                  <View style={styles.statItem}>
                    <Zap size={16} color={COLORS.primary} />
                    <View>
                      <Text style={styles.statLabel}>GOAL VOL</Text>
                      <Text style={styles.statValue}>{selectedWeek["Run km/week"]}KM</Text>
                    </View>
                  </View>
                  <View style={styles.statItem}>
                    <Flame size={16} color={COLORS.secondary} />
                    <View>
                      <Text style={styles.statLabel}>EST BURN</Text>
                      <Text style={styles.statValue}>{selectedWeek["Calories/day"] * 7}K</Text>
                    </View>
                  </View>
                </View>

                <Text style={styles.sessionHeader}>SESSIONS BREAKDOWN</Text>
                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
                  {getMappedDays(selectedWeek, availableDays)
                    .filter(d => d.type !== 'STEP')
                    .map((day) => (
                      <View
                        key={day.dayIdx}
                        style={[
                          styles.sessionCard,
                          day.type === 'RUN' ? styles.sessionRunCard : styles.sessionRecCard
                        ]}
                      >
                        <View style={styles.sessionCardHeader}>
                          <Text style={styles.sessionDay}>{day.name.toUpperCase()}</Text>
                          <Text style={styles.sessionType}>
                            {day.runType || (day.type === 'RECOVERY' ? 'Recovery' : 'Active')}
                          </Text>
                        </View>
                        <View style={[styles.sessionTimePill, { backgroundColor: `${getTimeAccent(trainingTimePreference)}14` }]}>
                          <TimeIcon size={12} color={getTimeAccent(trainingTimePreference)} />
                          <Text style={[styles.sessionTimeText, { color: getTimeAccent(trainingTimePreference) }]}>
                            {getTimeLabel(trainingTimePreference)}
                          </Text>
                        </View>
                        {day.type === 'RUN' && (
                          <Text style={styles.sessionKm}>{day.targetKm}k</Text>
                        )}
                      </View>
                    ))}
                </ScrollView>

                <View style={styles.expectedWeightCard}>
                  <TrendingUp size={24} color={COLORS.success} />
                  <View style={{ marginLeft: 12 }}>
                    <Text style={styles.expectedWeightLabel}>ESTIMATED END WEIGHT</Text>
                    <Text style={styles.expectedWeightValue}>{selectedWeek["Expected weight"]} kg</Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showScheduleEditor}
        animationType="slide"
        transparent
        onRequestClose={() => setShowScheduleEditor(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.scheduleModalCard}>
            <View style={styles.modalDragHandle} />
            <View style={styles.modalContentHeader}>
              <Text style={styles.modalWeek}>TRAINING SCHEDULE</Text>
              <TouchableOpacity onPress={() => setShowScheduleEditor(false)}>
                <X size={20} color={COLORS.textSub} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalTitle}>Choose your run days</Text>
            <Text style={styles.scheduleHelperText}>
              Pick at least 3 days. Saving will update your preference and remap your scheduled days without regenerating the plan.
            </Text>

            <View style={styles.scheduleGrid}>
              {DAY_OPTIONS.map((day) => {
                const selected = draftAvailableDays.includes(day.id);
                return (
                  <TouchableOpacity
                    key={day.id}
                    style={[styles.scheduleDayChip, selected && styles.scheduleDayChipActive]}
                    onPress={() => toggleDay(day.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.scheduleDayChipText, selected && styles.scheduleDayChipTextActive]}>
                      {day.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.regenerateBtn, draftAvailableDays.length < 3 && styles.disabledPrimaryBtn]}
              onPress={handleScheduleSave}
              disabled={draftAvailableDays.length < 3 || scheduleUpdating}
            >
              {scheduleUpdating ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Calendar size={18} color="#FFF" />
                  <Text style={styles.regenerateBtnText}>Save Schedule Days</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showTimeEditor}
        animationType="slide"
        transparent
        onRequestClose={() => setShowTimeEditor(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.scheduleModalCard}>
            <View style={styles.modalDragHandle} />
            <View style={styles.modalContentHeader}>
              <Text style={styles.modalWeek}>TRAINING TIME</Text>
              <TouchableOpacity onPress={() => setShowTimeEditor(false)}>
                <X size={20} color={COLORS.textSub} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalTitle}>Choose your preferred time</Text>
            <Text style={styles.scheduleHelperText}>
              This sets the same preference for both runs and workouts. Morning shifts both to morning, afternoon shifts both to afternoon, and evening shifts both to evening.
            </Text>

            <View style={styles.preferenceSummaryCard}>
              <View style={styles.preferenceSummaryRow}>
                <Text style={styles.preferenceSummaryLabel}>Run preference</Text>
                <Text style={styles.preferenceSummaryValue}>{getTimeLabel(draftTrainingTimePreference)}</Text>
              </View>
              <View style={styles.preferenceSummaryDivider} />
              <View style={styles.preferenceSummaryRow}>
                <Text style={styles.preferenceSummaryLabel}>Workout preference</Text>
                <Text style={styles.preferenceSummaryValue}>{getTimeLabel(draftTrainingTimePreference)}</Text>
              </View>
            </View>

            <View style={styles.timeOptionStack}>
              {TIME_OPTIONS.map((option) => {
                const selected = option.id === draftTrainingTimePreference;
                const Icon = option.icon;
                return (
                  <TouchableOpacity
                    key={option.id}
                    style={[styles.timeOptionCard, selected && styles.timeOptionCardActive]}
                    onPress={() => setDraftTrainingTimePreference(option.id)}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.timeOptionIconWrap, selected && styles.timeOptionIconWrapActive]}>
                      <Icon size={18} color={selected ? '#FFF' : getTimeAccent(option.id)} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.timeOptionTitle}>{option.label}</Text>
                      <Text style={styles.timeOptionDescription}>{option.description}</Text>
                    </View>
                    {selected ? <CheckCircle2 size={18} color={COLORS.primary} /> : null}
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={styles.regenerateBtn}
              onPress={handleTimeSave}
            >
              <TimeIcon size={18} color="#FFF" />
              <Text style={styles.regenerateBtnText}>Save Time Preference</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  // Weekly timeline list
  timelineRow: { flexDirection: 'row', minHeight: 120 },
  leftColumn: { width: 32, alignItems: 'center', marginRight: 16 },
  verticalLine: { position: 'absolute', top: 24, bottom: -24, width: 2, backgroundColor: COLORS.line },
  lineActive: { backgroundColor: COLORS.secondary },
  lineInactive: { backgroundColor: COLORS.line },
  statusNode: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: COLORS.line,
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeActive: { borderColor: COLORS.primary },
  nodeCompleted: { backgroundColor: COLORS.secondary, borderColor: COLORS.secondary },
  nodeLocked: { backgroundColor: COLORS.locked, borderColor: COLORS.locked },
  pulsingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  rightColumn: { flex: 1, paddingBottom: 20 },

  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    elevation: 2,
  },
  cardActive: { borderColor: COLORS.primary, borderWidth: 2 },
  cardDefault: {},
  cardLocked: { backgroundColor: '#F5F5F5', opacity: 0.6 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  weekLabel: { fontSize: 10, fontWeight: '800', color: COLORS.textSub },
  activeLabelBadge: { backgroundColor: COLORS.primaryFade, paddingHorizontal: 4, borderRadius: 3 },
  activeLabelText: { fontSize: 8, fontWeight: '900', color: COLORS.primary },
  cardTitle: { fontSize: 16, fontWeight: '900', color: COLORS.textMain, marginBottom: 8 },
  optimizedStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    borderRadius: 10,
    padding: 8,
    gap: 10,
  },
  optStatItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  optStatText: { fontSize: 12, fontWeight: '700' },
  optStatDivider: { width: 1, height: 12, backgroundColor: '#DDD' },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  footerTarget: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerTargetText: { fontSize: 12, fontWeight: '700', color: COLORS.success },
  timePrefPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
  },
  timePrefText: {
    fontSize: 11,
    fontWeight: '800',
  },

  // Weekly Runs Summary (on main card)
  runsSummary: {
    marginTop: 12,
    marginBottom: 8,
    gap: 4,
  },
  runSummaryLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  runSummaryName: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMain,
    flex: 1,
    marginRight: 8,
  },
  runSummaryKm: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
  },

  // Mini Map (Weekly Grid Summary)
  miniMapContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginTop: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F1F3F5',
  },
  miniMapDay: {
    width: 32,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  miniMapRun: { backgroundColor: '#FFF5F5', borderColor: '#FFE3E3', borderWidth: 1 },
  miniMapRec: { backgroundColor: '#F0FFF4', borderColor: '#DCFCE7', borderWidth: 1 },
  miniMapRest: { backgroundColor: '#F8F9FA' },
  miniMapDayText: { fontSize: 10, fontWeight: '700', color: COLORS.textSub },
  miniMapDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: COLORS.primary },

  // Card Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    minHeight: 500,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
  },
  modalDragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E9ECEF',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalContentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalWeek: { fontSize: 13, fontWeight: '800', color: COLORS.primary, letterSpacing: 0.5 },
  modalTitle: { fontSize: 28, fontWeight: '900', color: COLORS.textMain, marginBottom: 20 },
  modalStatsGrid: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 14,
    borderRadius: 16,
    gap: 10,
  },
  statLabel: { fontSize: 9, fontWeight: '800', color: COLORS.textSub },
  statValue: { fontSize: 15, fontWeight: '900', color: COLORS.textMain },

  sessionHeader: { fontSize: 13, fontWeight: '800', color: COLORS.textSub, marginBottom: 12, letterSpacing: 0.5 },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#FFF',
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F1F3F5',
  },
  sessionRunCard: { backgroundColor: '#FFFAFA', borderColor: '#FFE5E5' },
  sessionRecCard: { backgroundColor: '#F9FFFA', borderColor: '#E5FFE5' },
  sessionCardHeader: { flex: 1 },
  sessionDay: { fontSize: 9, fontWeight: '800', color: COLORS.textSub, marginBottom: 2 },
  sessionType: { fontSize: 15, fontWeight: '800', color: COLORS.textMain },
  sessionTimePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 999,
  },
  sessionTimeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  sessionKm: { fontSize: 14, fontWeight: '900', color: COLORS.primary },

  expectedWeightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 20,
    marginTop: 10,
  },
  expectedWeightLabel: { fontSize: 10, fontWeight: '800', color: COLORS.textSub },
  expectedWeightValue: { fontSize: 22, fontWeight: '900', color: COLORS.success },

  regenerateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 18,
    borderRadius: 20,
    marginTop: 20,
    marginBottom: 60,
    gap: 12,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  regenerateBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  headerCloseRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 10,
  },
  headerCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F3F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  topActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#F1F3F5',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 20,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  topActionText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textMain,
    letterSpacing: 0.2,
  },
  emptyPlanCard: {
    alignItems: 'center',
    backgroundColor: '#FFF7F7',
    borderWidth: 1,
    borderColor: '#FFD9D9',
    borderRadius: 24,
    padding: 22,
    marginBottom: 16,
  },
  emptyPlanIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyPlanTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.textMain,
    marginBottom: 6,
  },
  emptyPlanText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    color: COLORS.textSub,
    textAlign: 'center',
  },
  emptyPlanButton: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 18,
  },
  emptyPlanButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
  },
  devActionRow: {
    alignItems: 'stretch',
    marginBottom: 12,
  },
  devActionStack: {
    alignItems: 'flex-end',
    gap: 8,
  },
  devRegenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FFD9D9',
  },
  devRegenText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
  },
  devPromptToggle: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  devPromptToggleText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSub,
  },
  devPromptCard: {
    alignSelf: 'stretch',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#FFD9D9',
    borderRadius: 16,
    padding: 12,
  },
  devPromptLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  devPromptScroll: {
    maxHeight: 180,
  },
  devPromptScrollContent: {
    paddingBottom: 4,
  },
  devPromptText: {
    fontSize: 11,
    lineHeight: 17,
    color: COLORS.textMain,
    fontWeight: '600',
  },
  preferenceBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#FFF7F1',
    borderWidth: 1,
    borderColor: '#FFE8D6',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  preferenceIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  preferenceTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.textMain,
    marginBottom: 4,
  },
  preferenceText: {
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.textSub,
    fontWeight: '600',
  },
  secondaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FFD9D9',
    paddingVertical: 16,
    borderRadius: 18,
    gap: 10,
  },
  secondaryActionText: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: '800',
  },
  disabledPrimaryBtn: {
    opacity: 0.5,
  },
  scheduleModalCard: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    minHeight: 360,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
  },
  scheduleHelperText: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textSub,
    marginBottom: 20,
  },
  scheduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  scheduleDayChip: {
    width: '22%',
    minWidth: 64,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EAEAEA',
  },
  scheduleDayChipActive: {
    backgroundColor: COLORS.primaryFade,
    borderColor: COLORS.primary,
  },
  scheduleDayChipText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textSub,
  },
  scheduleDayChipTextActive: {
    color: COLORS.primary,
  },
  preferenceSummaryCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 18,
    padding: 16,
    marginBottom: 18,
  },
  preferenceSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  preferenceSummaryLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSub,
  },
  preferenceSummaryValue: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.textMain,
  },
  preferenceSummaryDivider: {
    height: 1,
    backgroundColor: '#E9ECEF',
    marginVertical: 12,
  },
  timeOptionStack: {
    gap: 10,
    marginBottom: 6,
  },
  timeOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#FFF',
  },
  timeOptionCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#FFF7F7',
  },
  timeOptionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeOptionIconWrapActive: {
    backgroundColor: COLORS.primary,
  },
  timeOptionTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.textMain,
    marginBottom: 2,
  },
  timeOptionDescription: {
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.textSub,
    fontWeight: '600',
  },
});
