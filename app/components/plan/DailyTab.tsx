import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Footprints,
  Flame,
  Droplets,
  ChevronDown,
  ChevronUp,
  Zap,
  Sun,
  Sunset,
  Moon,
  Check,
  Activity,
  AlertCircle,
  ChevronRight,
  X,
} from 'lucide-react-native';

// Types
type DayType = 'RUN' | 'STEP' | 'RECOVERY';
export type DailyTargetFromAPI = {
  dayOfWeek: number;
  dayName: string;
  dayType: DayType;
  calorieTarget: number;
  proteinTarget: number;
  stepsTarget: number;
  runKm: number;
  runType: string | null;
};
export type StepSlots = { morning: number; afternoon: number; evening: number };
export type StepTargetSlots = { morning: number; afternoon: number; evening: number };
type SchedulePeriodKey = 'morning' | 'afternoon' | 'evening';
export type DailyTabProps = {
  loadingDaily: boolean;
  dailyTargets: DailyTargetFromAPI[];
  todayTarget?: DailyTargetFromAPI | null;
  todayIndex: number;
  currentSteps: number;
  currentCalories: number;
  calorieTarget: number;
  waterIntake: number;
  onIncrementWater: () => void;
  scheduleExpanded: boolean;
  onToggleSchedule: () => void;
  stepSlots: StepSlots;
  stepTargets: StepTargetSlots;
  exerciseCompleted: boolean;
  trainingTimePreference: 'morning' | 'afternoon' | 'evening' | 'night';
  onStartRun: (distanceKm: number) => void;
  showNightWalkRecoveryPrompt?: boolean;
  nightWalkRecoverySteps?: number;
  nightWalkRecoveryKm?: number;
  onConvertNightStepsToWalk?: () => void;
  onLogFood: (period: SchedulePeriodKey) => void;
  onOpenMobility: () => void;
};

const COLORS = {
  primary: '#FF4757',
  primaryFade: 'rgba(255, 71, 87, 0.08)',
  secondary: '#1A1C1E',
  secondaryFade: 'rgba(26, 28, 30, 0.08)',
  bg: 'transparent', 
  card: '#FFFFFF',
  textMain: '#1A1C1E',
  textSub: '#64748B',
  line: '#F1F3F5',
  success: '#22C55E',
  successFade: 'rgba(34, 197, 94, 0.06)',
  afternoon: '#F59E0B',
  afternoonFade: 'rgba(245, 158, 11, 0.06)',
  evening: '#6366F1',
  night: '#1E1E2E',
  eveningFade: 'rgba(99, 102, 241, 0.06)',
  inactive: '#F1F5F9',
};

const TaskItem = ({ icon, label, value, target, unit, isComplete, color, onPress, isMissed, isActive }: any) => (
  <TouchableOpacity
    activeOpacity={onPress ? 0.8 : 1}
    disabled={!onPress}
    onPress={onPress}
    style={[
      styles.taskItem, 
      isComplete && styles.taskItemComplete,
      { shadowColor: color }
    ]}
  >
    <View style={styles.taskIconBox}>
      <View style={[
        styles.taskIconBoxInner, 
        { backgroundColor: isComplete ? COLORS.successFade : isMissed ? COLORS.primaryFade : `${color}10` }
      ]}>
        {React.cloneElement(icon as any, { 
          color: isComplete ? COLORS.success : isMissed ? COLORS.primary : color, 
          size: 18 
        })}
      </View>
    </View>
    <View style={styles.taskContent}>
      <Text style={[styles.taskLabel, isComplete && styles.taskLabelComplete]}>{label}</Text>
      <View style={styles.taskStatusRow}>
        <Text style={styles.taskValueText}>
          {value.toLocaleString()} 
          <Text style={styles.taskTargetText}> / {target.toLocaleString()} {unit}</Text>
        </Text>
      </View>
    </View>
    <View style={isMissed && !isComplete ? styles.statusContainerMissed : styles.statusContainer}>
      {isComplete ? (
        <View style={styles.miniCheckComplete}>
          <Check size={12} color="#FFF" strokeWidth={4} />
        </View>
      ) : isMissed ? (
        <Text style={styles.missedText}>Missed</Text>
      ) : (
        label !== 'Steps' && (
          <ChevronRight size={16} color={COLORS.textSub} strokeWidth={2.5} />
        )
      )}
    </View>
  </TouchableOpacity>
);

export function DailyTab({
  loadingDaily,
  dailyTargets,
  todayTarget,
  todayIndex,
  currentSteps,
  currentCalories,
  calorieTarget,
  waterIntake,
  onIncrementWater,
  scheduleExpanded,
  onToggleSchedule,
  stepSlots,
  stepTargets,
  exerciseCompleted,
  trainingTimePreference,
  onStartRun,
  showNightWalkRecoveryPrompt = false,
  nightWalkRecoverySteps = 0,
  nightWalkRecoveryKm = 0,
  onConvertNightStepsToWalk,
  onLogFood,
  onOpenMobility,
}: DailyTabProps) {
  const now = new Date();
  const currentHour = now.getHours();
  const totalTarget = todayTarget?.stepsTarget || 1;
  const morningStepsTarget = Math.max(0, stepTargets.morning || Math.round(totalTarget * 0.4));
  const afternoonStepsTarget = Math.max(0, stepTargets.afternoon || Math.round(totalTarget * 0.35));
  const eveningStepsTarget = Math.max(
    0,
    stepTargets.evening || (totalTarget - morningStepsTarget - afternoonStepsTarget)
  );
  
  const totalCalTarget = calorieTarget || 2200;
  const morningCalTarget = Math.round(totalCalTarget * 0.4);
  const afternoonCalTarget = Math.round(totalCalTarget * 0.35);
  const eveningCalTarget = totalCalTarget - morningCalTarget - afternoonCalTarget;

  const currentPeriod = currentHour < 12 ? 'morning' : currentHour < 18 ? 'afternoon' : 'evening';
  const periodOrder: SchedulePeriodKey[] = ['morning', 'afternoon', 'evening'];
  const currentIndex = periodOrder.indexOf(currentPeriod);
  
  // Calorie distribution for UI (mocking distribution based on current period since we only have total)
  const morningCalActual = currentPeriod === 'morning' ? currentCalories : Math.round(currentCalories * 0.4);
  const afternoonCalActual = currentPeriod === 'morning' ? 0 : currentPeriod === 'afternoon' ? currentCalories - morningCalActual : Math.round(currentCalories * 0.35);
  const eveningCalActual = currentPeriod === 'evening' ? currentCalories - morningCalActual - afternoonCalActual : 0;

  const morningStepsComplete = stepSlots.morning >= morningStepsTarget;
  const afternoonStepsComplete = stepSlots.afternoon >= afternoonStepsTarget;
  const eveningStepsComplete = stepSlots.evening >= eveningStepsTarget;
  const normalizedTrainingTimePreference: SchedulePeriodKey =
    trainingTimePreference === 'morning'
      ? 'morning'
      : trainingTimePreference === 'afternoon'
        ? 'afternoon'
        : 'evening';
  const preferredSchedulePeriod: SchedulePeriodKey = normalizedTrainingTimePreference;
  const eveningLabel = 'Evening Session';
  const eveningTime = '18:00 - 22:00';
  const runKmTarget = Number(todayTarget?.runKm || 0);
  const normalizedRunType = String(todayTarget?.runType || '').trim().toLowerCase();
  const isWalkSession = normalizedRunType.includes('walk');
  const walkRunLabel = isWalkSession ? 'Walk' : 'Run';
  const walkRunTargetLabel = runKmTarget > 0 ? runKmTarget.toFixed(1) : '0.0';
  const runTask = todayTarget?.dayType === 'RUN'
    ? {
        icon: <Zap />,
        label: walkRunLabel,
        value: 0,
        target: runKmTarget,
        unit: 'km',
        isComplete: false,
        color: preferredSchedulePeriod === 'morning' ? COLORS.primary : COLORS.evening,
        onPress: () => onStartRun(runKmTarget),
      }
    : null;
  const exerciseTask = {
    icon: <Activity />,
    label: 'Exercise',
    value: exerciseCompleted ? 1 : 0,
    target: 1,
    unit: 'session',
    isComplete: exerciseCompleted,
    color: preferredSchedulePeriod === 'morning' ? COLORS.secondary : COLORS.evening,
    onPress: onOpenMobility,
  };

  const scheduleData = useMemo(() => [
    {
      key: 'morning',
      label: 'Morning Focus',
      time: '06:00 - 12:00',
      icon: <Sun size={18} />,
      color: COLORS.primary,
      isActive: currentPeriod === 'morning',
      tasks: [
        ...(preferredSchedulePeriod === 'morning' && runTask ? [runTask] : []),
        { icon: <Footprints />, label: 'Steps', value: stepSlots.morning, target: morningStepsTarget, unit: 'steps', isComplete: morningStepsComplete, color: COLORS.primary },
        { icon: <Flame />, label: 'Kcals', value: morningCalActual, target: morningCalTarget, unit: 'kcal', isComplete: morningCalActual >= morningCalTarget, color: COLORS.afternoon, onPress: () => onLogFood('morning') },
        ...(preferredSchedulePeriod === 'morning' ? [exerciseTask] : []),
      ],
    },
    {
      key: 'afternoon',
      label: 'Afternoon Burn',
      time: '12:00 - 18:00',
      icon: <Sunset size={18} />,
      color: COLORS.afternoon,
      isActive: currentPeriod === 'afternoon',
      tasks: [
        { icon: <Footprints />, label: 'Steps', value: stepSlots.afternoon, target: afternoonStepsTarget, unit: 'steps', isComplete: afternoonStepsComplete, color: COLORS.afternoon },
        { icon: <Flame />, label: 'Kcals', value: afternoonCalActual, target: afternoonCalTarget, unit: 'kcal', isComplete: afternoonCalActual >= afternoonCalTarget, color: COLORS.afternoon, onPress: () => onLogFood('afternoon') },
        { icon: <Droplets />, label: 'Hydration', value: Math.min(waterIntake, 5), target: 5, unit: 'glasses', isComplete: waterIntake >= 5, color: COLORS.secondary },
      ],
    },
    {
      key: 'evening',
      label: eveningLabel,
      time: eveningTime,
      icon: <Moon size={18} />,
      color: COLORS.evening,
      isActive: currentPeriod === 'evening',
      tasks: [
        ...(preferredSchedulePeriod === 'evening' && runTask ? [runTask] : []),
        { icon: <Footprints />, label: 'Steps', value: stepSlots.evening, target: eveningStepsTarget, unit: 'steps', isComplete: eveningStepsComplete, color: COLORS.evening },
        { icon: <Flame />, label: 'Kcals', value: eveningCalActual, target: eveningCalTarget, unit: 'kcal', isComplete: eveningCalActual >= eveningCalTarget, color: COLORS.afternoon, onPress: () => onLogFood('evening') },
        { icon: <Droplets />, label: 'Hydration', value: Math.max(0, waterIntake - 5), target: 3, unit: 'glasses', isComplete: waterIntake >= 8, color: COLORS.secondary },
        ...(preferredSchedulePeriod === 'evening' ? [exerciseTask] : []),
      ],
    },
  ], [currentHour, stepSlots, waterIntake, currentCalories, calorieTarget, morningStepsTarget, morningStepsComplete, morningCalActual, morningCalTarget, afternoonStepsTarget, afternoonStepsComplete, afternoonCalActual, afternoonCalTarget, eveningStepsTarget, eveningStepsComplete, eveningCalActual, eveningCalTarget, preferredSchedulePeriod, eveningLabel, eveningTime, runTask, exerciseTask, onLogFood]);

  if (loadingDaily && !todayTarget) return <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />;
  if (!todayTarget) return null;

  return (
    <View style={styles.container}>
      {/* SCHEDULE TOGGLE */}
      <TouchableOpacity activeOpacity={0.8} style={styles.expandButton} onPress={onToggleSchedule}>
        <Text style={styles.expandButtonText}>Daily Schedule</Text>
        <View style={styles.expandIcon}>
          {scheduleExpanded ? <ChevronUp size={18} color={COLORS.textMain} /> : <ChevronDown size={18} color={COLORS.textMain} />}
        </View>
      </TouchableOpacity>

      {/* TIMELINE SCHEDULE */}
      {scheduleExpanded && (
        <View style={styles.timelineContainer}>
          {scheduleData.map((period, index) => (
            <View key={period.key} style={styles.timelineItem}>
              {index !== scheduleData.length - 1 && <View style={styles.timelineConnector} />}
              <View style={[styles.timelineDot, { backgroundColor: period.isActive ? period.color : COLORS.inactive }]}>
                {React.cloneElement(period.icon as any, { color: '#FFF' })}
              </View>
              <View style={styles.periodContent}>
                <View style={styles.periodHeaderRow}>
                  <View>
                    <Text style={[styles.periodTitle, period.isActive && { color: period.color }]}>{period.label}</Text>
                    <Text style={styles.periodTimeText}>{period.time}</Text>
                  </View>
                  {period.isActive && <View style={[styles.nowBadge, { backgroundColor: period.color }]}><Text style={styles.nowText}>NOW</Text></View>}
                </View>
                {period.key === 'evening' && showNightWalkRecoveryPrompt && (
                  <TouchableOpacity 
                    style={[styles.recoveryWarning, { marginTop: 0, marginBottom: 12 }]} 
                    onPress={onConvertNightStepsToWalk}
                    activeOpacity={0.8}
                  >
                    <View style={styles.warningContent}>
                      <View style={styles.warningLeft}>
                        <AlertCircle size={12} color="#D97706" />
                        <Text style={styles.warningText}>
                          Missed earlier step targets
                        </Text>
                      </View>
                      <Text style={styles.warningSubtext}>
                        You still have {nightWalkRecoverySteps.toLocaleString()} steps left from earlier today. Convert them into a {nightWalkRecoveryKm.toFixed(1)} km walk session and finish the day on plan.
                      </Text>
                    </View>
                    <ChevronRight size={12} color="#D97706" />
                  </TouchableOpacity>
                )}
                <View style={styles.taskWrapper}>
                  {period.tasks.map((task, idx) => (
                    <TaskItem 
                      key={idx} 
                      {...task} 
                      isMissed={index < currentIndex && !task.isComplete}
                      isActive={index === currentIndex && !task.isComplete}
                    />
                  ))}
                  {period.key === preferredSchedulePeriod && todayTarget?.dayType === 'RUN' && (
                    <TouchableOpacity style={styles.modernRunBtn} onPress={() => onStartRun(runKmTarget)}>
                      <Zap size={16} color="#FFF" fill="#FFF" />
                      <Text style={styles.modernRunBtnText}>Start {walkRunTargetLabel}km {walkRunLabel}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: 'transparent', paddingBottom: 40 },
  expandButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 20 },
  expandButtonText: { fontSize: 18, fontWeight: '800', color: COLORS.textMain },
  expandIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.card, justifyContent: 'center', alignItems: 'center' },
  timelineContainer: { paddingLeft: 4 },
  timelineItem: { flexDirection: 'row', gap: 16, marginBottom: 10 },
  timelineConnector: { 
    position: 'absolute', 
    left: 20, 
    top: 44, 
    bottom: -10, 
    width: 2, 
    backgroundColor: COLORS.line,
    borderRadius: 1,
  },
  timelineDot: { 
    width: 42, 
    height: 42, 
    borderRadius: 21, 
    justifyContent: 'center', 
    alignItems: 'center', 
    zIndex: 2,
    borderWidth: 3,
    borderColor: '#FFF',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  periodContent: { flex: 1, paddingBottom: 32 },
  periodHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  periodTitle: { fontSize: 17, fontWeight: '900', color: COLORS.textSub },
  periodTimeText: { fontSize: 12, color: COLORS.textSub, fontWeight: '700', marginTop: 2 },
  nowBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  nowText: { color: '#FFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  taskWrapper: { gap: 10 },
  taskItem: {
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 14,
    backgroundColor: COLORS.card, 
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F8FAFC',
    elevation: 2,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  taskItemComplete: { opacity: 0.6 },
  taskIconBox: { width: 42, height: 42, justifyContent: 'center', alignItems: 'center' },
  taskIconBoxInner: { width: 42, height: 42, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  taskContent: { flex: 1, marginLeft: 14 },
  taskLabel: { fontSize: 15, fontWeight: '800', color: COLORS.textMain },
  taskLabelComplete: { textDecorationLine: 'line-through', color: COLORS.textSub, opacity: 0.8 },
  taskStatusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  taskValueText: { fontSize: 13, fontWeight: '900', color: COLORS.textMain },
  taskTargetText: { fontSize: 12, fontWeight: '600', color: COLORS.textSub },
  statusContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusContainerMissed: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: COLORS.primaryFade,
    borderRadius: 8,
  },
  miniCheckComplete: { 
    width: 24, 
    height: 24, 
    borderRadius: 12, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
    borderWidth: 1,
  },
  missedText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  modernRunBtn: { backgroundColor: COLORS.primary, padding: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 },
  modernRunBtnText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  recoveryWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(245, 158, 11, 0.06)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.15)',
  },
  warningLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  warningContent: {
    flex: 1,
    marginRight: 12,
  },
  warningText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#D97706',
  },
  warningSubtext: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
    color: '#B45309',
    marginTop: 6,
  },
});
