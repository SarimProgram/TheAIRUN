import React, { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { BedDouble, CalendarDays, Check, ChevronLeft, ChevronRight, CircleCheck, Droplet, Dumbbell, Flame, Footprints, Heart, Play, Target } from 'lucide-react-native';
import { ui, usePlanColors } from './PlanVisuals';
import { PlanCoachArt } from './PlanCoachArt';
import type { PointCategoryKey } from '../../hooks/useDailyPoints';
import { dailyTaskProgress, type DailyTaskKey } from './dailyTaskProgress';
import { TaskDetailBubble, type TaskAnchor, type TaskReward } from './TaskDetailBubble';
import { workoutLabel, type WorkoutPreference } from '../../utils/trainingSchedule';

type Props = {
  date: Date; planDay: number; steps: number; stepsTarget: number; calories: number; calorieTarget: number;
  waterMl: number; waterTarget: number; loading: boolean; error?: string | null; onRetry: () => void;
  runTitle?: string; runDistance?: number; runComplete: boolean; workoutComplete: boolean; isToday: boolean;
  gender?: string | null; pointCategories?: TaskReward[];
  pointsLoading?: boolean; pointsError?: string | null;
  onSelectDate: (date: Date) => void; onPreviousWeek: () => void; onNextWeek: () => void;
  onToday: () => void; onFullPlan: () => void; onWorkouts: () => void; onWorkout: () => void;
  onWorkoutOverview?: () => void;
  onRun: () => void; onFood: () => void; onWater: () => void;
  hasTrainingSchedule?: boolean; workoutPreference?: WorkoutPreference;
  workoutTitle?: string;
  onCustomize?: () => void;
};

function RewardBadge({ points, unavailable = false }: { points?: number; unavailable?: boolean }) {
  const c = usePlanColors();
  const color = unavailable ? c.sub : c.accent;
  return <View accessibilityLabel={unavailable ? 'No points available' : points == null ? 'Reward points loading' : `Earn ${points} points`} style={[s.reward, { backgroundColor: unavailable ? c.line : c.soft }]}>
    <Heart size={11} color={color} fill={color} strokeWidth={2} />
    <Text style={[s.rewardText, { color }]}>{points == null ? '\u2014' : `${points > 0 ? '+' : ''}${points}`}</Text>
    <Text style={[s.rewardUnit, { color }]}>pts</Text>
  </View>;
}

function TaskStatusMark({
  variant,
  color,
  borderColor,
  backgroundColor,
  label,
}: {
  variant: 'open' | 'done' | 'claimed';
  color: string;
  borderColor: string;
  backgroundColor: string;
  label: string;
}) {
  return (
    <View accessibilityLabel={label} style={[s.taskMark, { borderColor, backgroundColor }]}>
      {(variant === 'done' || variant === 'claimed') && <Check color={color} size={15} strokeWidth={3} />}
    </View>
  );
}

function TaskPointsAction({ taskKey, category, reward, done, loading, error, pointsLoading }: {
  taskKey: DailyTaskKey;
  category?: PointCategoryKey;
  reward?: TaskReward;
  done: boolean;
  loading: boolean;
  error?: string | null;
  pointsLoading?: boolean;
}) {
  const c = usePlanColors();
  if (taskKey === 'sleep' || !category) return null;
  if (loading || (done && pointsLoading)) return <ActivityIndicator color={c.accent} style={s.taskActionSlot} />;
  const awarded = !!reward?.isAwarded;
  return <View style={s.taskActionSlot}>
    <TaskStatusMark variant={awarded ? 'claimed' : done && !error ? 'done' : 'open'}
      label={awarded ? 'Points added' : done && !error ? 'Goal complete. Points are added automatically.' : 'Goal in progress'}
      borderColor={awarded ? c.secondary : done ? c.accent : c.sub}
      backgroundColor={awarded ? c.secondary : done ? c.soft : 'transparent'}
      color={awarded ? '#FFFFFF' : c.accent} />
  </View>;
}

export function PlansDashboard(p: Props) {
  const c = usePlanColors(p.gender);
  const { width } = useWindowDimensions();
  const [selectedTask, setSelectedTask] = useState<{ key: DailyTaskKey; day: string; anchor: TaskAnchor } | null>(null);
  const taskRows = useRef<Partial<Record<DailyTaskKey, View | null>>>({});
  const openTask = (key: DailyTaskKey) => {
    taskRows.current[key]?.measureInWindow((x, y, width, height) => {
      setSelectedTask({ key, day: p.date.toDateString(), anchor: { x, y, width, height } });
    });
  };
  const showActionLabels = width >= 375;
  const workoutTitle = p.workoutTitle ?? (p.hasTrainingSchedule ? workoutLabel(p.workoutPreference) : 'Strength & mobility');
  const chevronColor = c.dark ? '#FF9BA1' : '#9F2631';
  const monday = new Date(p.date);
  monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
  const pointsFor = (key: PointCategoryKey) => {
    const category = p.pointCategories?.find(item => item.key === key);
    return category ? category.isAvailable ? category.maxPoints : 0 : undefined;
  };
  const taskVisuals = {
    steps: { Icon: Footprints, color: c.accent, bg: c.soft },
    food: { Icon: Flame, color: c.accent, bg: c.soft },
    water: { Icon: Droplet, color: c.accent, bg: c.soft },
    sleep: { Icon: BedDouble, color: c.accent, bg: c.soft },
  };
  const tasks = dailyTaskProgress(p).map(task => ({ ...task, ...taskVisuals[task.key], points: task.category ? pointsFor(task.category) : 0 }));
  const activeTask = selectedTask?.day === p.date.toDateString() ? tasks.find(task => task.key === selectedTask.key) : undefined;
  const completed = p.error || p.loading ? 0 : tasks.filter(task => task.done).length;
  const earnedPoints = p.pointCategories?.reduce((total, category) => total + (category.isAwarded ? category.earnedPoints ?? 0 : 0), 0);
  const pointsUnavailable = p.pointsLoading || !!p.pointsError || earnedPoints == null;
  return <View style={s.content}>
    <View style={ui.row}>
      <View style={[s.headerIcon, { backgroundColor: c.soft }]}><CalendarDays size={28} color={c.accent} /></View>
      <Text style={[s.pageTitle, { color: c.text, fontSize: showActionLabels ? 25 : 22 }]}>Weekly Plan</Text>
      <View accessibilityLabel={p.pointsLoading ? 'Loading points' : pointsUnavailable ? 'Points unavailable' : `${earnedPoints} points earned for the selected day`} style={[s.headerPoints, { backgroundColor: c.soft }]}>
        <Heart size={15} color={c.accent} fill={c.accent} />
        <Text style={[s.headerPointsText, { color: c.accent }]}>{pointsUnavailable ? '\u2014' : earnedPoints.toLocaleString()} <Text style={s.headerPointsUnit}>pts</Text></Text>
      </View>
    </View>
    <View style={[s.calendarCard, { backgroundColor: c.card }]}>
      <View style={s.calendarLayout}>
        <PlanCoachArt gender={p.gender} pose="calendar" style={s.calendarCoach} />
        <View style={s.calendarContent}>
          <View style={s.monthRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="Previous week" onPress={p.onPreviousWeek} style={s.calendarArrow}><View style={[s.calendarArrowDisc, { backgroundColor: c.soft }]}><ChevronLeft size={19} color={chevronColor} /></View></Pressable>
            <View style={[s.monthPill, { backgroundColor: c.line }]}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[s.month, { color: c.text, fontSize: showActionLabels ? 14 : 12 }]}>{p.date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Next week" onPress={p.onNextWeek} style={s.calendarArrow}><View style={[s.calendarArrowDisc, { backgroundColor: c.soft }]}><ChevronRight size={19} color={chevronColor} /></View></Pressable>
          </View>
          <View style={s.week}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => {
            const date = new Date(monday); date.setDate(monday.getDate() + index);
            const selected = date.toDateString() === p.date.toDateString();
            const today = date.toDateString() === new Date().toDateString();
            return <Pressable key={index} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={date.toDateString()} onPress={() => p.onSelectDate(date)} style={[s.day, { backgroundColor: selected ? c.accent : 'transparent' }]}>
              <Text style={[s.dayLabel, { color: selected ? '#FFF' : c.sub }]}>{day}</Text>
              <Text style={[s.dayNumber, { color: selected ? '#FFF' : c.text }]}>{date.getDate()}</Text>
              <Text style={[s.dayMonth, { color: selected ? '#FFF' : c.sub }]}>{date.toLocaleDateString(undefined, { month: 'short' }).toLocaleUpperCase()}</Text>
              <View style={[s.todayDot, { backgroundColor: today ? selected ? '#FFF' : c.secondary : 'transparent' }]} />
            </Pressable>;
          })}</View>
          <View style={[s.momentum, { backgroundColor: c.secondarySoft }]}>
            <Target size={16} color={c.secondary} /><Text style={{ color: c.secondary, fontSize: 12, fontWeight: '800' }}>DAY {p.planDay}</Text>
            <View style={{ width: 1, height: 16, backgroundColor: c.secondary, opacity: 0.2 }} /><Text style={{ flex: 1, color: c.text, fontSize: 10, fontWeight: '600' }}>Keep it going!</Text>
          </View>
        </View>
      </View>
      <View style={s.calendarLinks}>
        {p.onCustomize && <Pressable accessibilityRole="button" onPress={p.onCustomize} style={s.textButton}><Text style={{ color: c.accent, fontSize: 12, fontWeight: '700' }}>Customize week</Text></Pressable>}
        <Pressable accessibilityRole="button" onPress={p.onFullPlan} style={s.textButton}><Text style={{ color: c.accent, fontSize: 12, fontWeight: '700' }}>View full training plan</Text></Pressable>
        {!p.isToday && <Pressable accessibilityRole="button" onPress={p.onToday} style={s.textButton}><Text style={{ color: c.accent, fontSize: 12 }}>Back to today</Text></Pressable>}
      </View>
    </View>
    <View style={[s.sectionCard, { backgroundColor: c.card }]}>
      <View style={ui.row}><Dumbbell color={c.accent} size={24} /><Text style={[ui.heading, { color: c.text, flex: 1 }]}>Workouts</Text><Pressable accessibilityRole="button" onPress={p.onWorkouts} style={s.textButton}><Text style={s.link}>View all</Text></Pressable></View>
      {(!p.hasTrainingSchedule || p.workoutPreference) && <View style={[s.workoutRow, { borderBottomColor: c.line, borderBottomWidth: p.hasTrainingSchedule ? 0 : 1 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={`View ${workoutTitle}`} onPress={p.onWorkoutOverview ?? p.onWorkout} style={[s.workoutContent, { flex: 1 }]}>
          <PlanCoachArt gender={p.gender} pose="strength" style={s.thumb} />
          <View style={s.workoutText}>
            <Text numberOfLines={2} style={[s.workoutTitle, { color: c.text, fontSize: showActionLabels ? 15 : 14 }]}>{workoutTitle}</Text>
            <View style={s.rewardUnderTitle}><RewardBadge points={pointsFor('MOBILITY')} /></View>
          </View>
          {p.workoutComplete && <Check accessibilityLabel="Workout completed" size={16} color={c.secondary} />}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`View ${workoutTitle}`} onPress={p.onWorkoutOverview ?? p.onWorkout} style={s.start}><View style={[s.cta, { backgroundColor: c.accent }]}><Play size={12} fill="#FFF" color="#FFF" />{showActionLabels && <Text style={s.ctaText}>View</Text>}</View></Pressable>
      </View>}
      {(!p.hasTrainingSchedule || !p.workoutPreference) && <View style={s.workoutRow}>
        <Pressable accessibilityRole="button" accessibilityLabel={p.runTitle ? `View ${p.runTitle}, ${p.runDistance} kilometres` : 'View recovery day plan'} onPress={p.onWorkoutOverview ?? (p.runTitle ? p.onRun : p.onFullPlan)} style={[s.workoutContent, { flex: 1 }]}>
          <PlanCoachArt gender={p.gender} pose="walk" style={{ ...s.thumb, backgroundColor: c.secondarySoft }} />
          <View style={s.workoutText}>
            <Text numberOfLines={2} style={[s.workoutTitle, { color: c.text, fontSize: 16, lineHeight: 22 }]}>{p.runTitle || 'Recovery day'}</Text>
            <View style={s.rewardUnderTitle}><RewardBadge points={p.runTitle ? pointsFor('WALK_RUN') : 0} unavailable={!p.runTitle} /></View>
          </View>
          {p.runComplete && <Check accessibilityLabel="Workout completed" size={16} color={c.secondary} />}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={p.runTitle ? `View ${p.runTitle}` : 'View recovery day plan'} onPress={p.onWorkoutOverview ?? (p.runTitle ? p.onRun : p.onFullPlan)} style={s.start}><View style={[s.cta, { backgroundColor: c.secondarySoft }]}><CalendarDays size={14} color={c.secondary} />{showActionLabels && <Text style={[s.ctaText, { color: c.secondary }]}>Plan</Text>}</View></Pressable>
      </View>}
    </View>
    <View style={[s.sectionCard, { backgroundColor: c.card }]}>
      <View style={[ui.row, { flexWrap: 'wrap', marginBottom: 4 }]}><CircleCheck size={25} color={c.accent} /><Text style={[ui.heading, { color: c.text, flex: 1 }]}>Daily Tasks</Text><View style={[s.badge, { backgroundColor: c.soft }]}><Text style={{ color: c.accent, fontWeight: '700', fontSize: 11 }}>{completed} / 4 completed</Text></View></View>
      {p.error ? <Pressable accessibilityRole="button" onPress={p.onRetry} style={s.error}><Text style={{ color: c.accent }}>Could not load progress. Tap to retry.</Text></Pressable> : null}
      {tasks.map(({ key, Icon, color, bg, label, done, points, category }, index) => <View key={key} ref={node => { taskRows.current[key] = node; }} style={[s.task, { borderTopWidth: index ? 1 : 0, borderTopColor: c.line }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={`View ${label} details`} onPress={() => openTask(key)} style={({ pressed }) => [s.taskMain, { opacity: pressed ? 0.65 : 1 }]}>
          <View style={[s.taskIcon, { backgroundColor: bg }]}><Icon size={23} color={color} strokeWidth={2.3} /></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[s.taskLabel, { color: c.text }]}>{label}</Text>
            <View style={s.rewardUnderTitle}><RewardBadge points={points} unavailable={key === 'sleep'} /></View>
          </View>
        </Pressable>
        <TaskPointsAction
          taskKey={key}
          category={category}
          reward={category ? p.pointCategories?.find(item => item.key === category) : undefined}
          done={done && !p.error}
          loading={p.loading}
          error={p.error}
          pointsLoading={p.pointsLoading}
        />
      </View>)}
    </View>
    {activeTask && <TaskDetailBubble key={`${selectedTask?.day}:${activeTask.key}`} task={activeTask}
      anchor={selectedTask!.anchor}
      reward={p.pointCategories?.find(category => category.key === activeTask.category)}
      loading={p.loading} error={p.error} pointsLoading={p.pointsLoading} pointsError={p.pointsError}
      onClose={() => setSelectedTask(null)} />}
  </View>;
}

const s = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 12, gap: 14 },
  headerIcon: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  pageTitle: { flex: 1, fontSize: 25, fontWeight: '800', letterSpacing: -0.6 },
  headerPoints: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 16, borderCurve: 'continuous' },
  headerPointsText: { fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
  headerPointsUnit: { fontSize: 10, fontWeight: '600' },
  calendarCard: { borderRadius: 28, borderCurve: 'continuous', paddingHorizontal: 12, paddingTop: 12, overflow: 'hidden' },
  calendarLayout: { flexDirection: 'row', alignItems: 'stretch', gap: 4 },
  calendarCoach: { width: '27%', height: 190, alignSelf: 'flex-end', borderRadius: 0 },
  calendarContent: { flex: 1, minWidth: 0, gap: 8 },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  calendarArrow: { width: 36, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  calendarArrowDisc: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  monthPill: { flex: 1, minHeight: 30, borderRadius: 20, justifyContent: 'center', paddingHorizontal: 6 },
  month: { textAlign: 'center', fontSize: 14, fontWeight: '800' },
  calendarLinks: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  textButton: { minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  week: { flexDirection: 'row', gap: 2 },
  day: { flex: 1, minHeight: 86, paddingVertical: 8, borderRadius: 18, alignItems: 'center', gap: 6 },
  dayLabel: { fontSize: 11, fontWeight: '600' }, dayNumber: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  dayMonth: { fontSize: 9, fontWeight: '600' },
  todayDot: { width: 4, height: 4, borderRadius: 2 },
  momentum: { flexDirection: 'row', alignItems: 'center', minHeight: 32, paddingHorizontal: 8, borderRadius: 20, gap: 6 },
  sectionCard: { borderRadius: 28, borderCurve: 'continuous', paddingHorizontal: 16, paddingVertical: 12 },
  link: { color: '#FF6069', fontSize: 14, fontWeight: '700' },
  workoutRow: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 6, minHeight: 68 },
  workoutContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  workoutText: { flex: 1, minWidth: 0 },
  workoutTitle: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
  thumb: { width: 56, height: 52, borderRadius: 14 },
  start: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  cta: { height: 32, minWidth: 32, borderRadius: 16, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  ctaText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  badge: { paddingHorizontal: 8, paddingVertical: 8, borderRadius: 20 },
  task: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 16, minHeight: 88 },
  taskMain: { flex: 1, minWidth: 0, flexDirection: 'row', gap: 8, alignItems: 'center' },
  taskIcon: { width: 40, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  taskLabel: { fontSize: 16, lineHeight: 22, fontWeight: '700' },
  rewardUnderTitle: { alignSelf: 'flex-start', marginTop: 6 },
  reward: { minWidth: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: 12, paddingHorizontal: 6, paddingVertical: 5 },
  rewardText: { fontSize: 11, fontWeight: '800', fontVariant: ['tabular-nums'] },
  rewardUnit: { fontSize: 9, fontWeight: '600' },
  taskActionSlot: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'flex-end', flexShrink: 0 },
  taskMark: { width: 28, height: 28, borderRadius: 14, borderCurve: 'continuous', borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  taskClaim: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingLeft: 6,
    paddingRight: 12,
    borderRadius: 18,
    borderCurve: 'continuous',
    minWidth: 66,
  },
  taskClaimCheck: { width: 24, height: 24, borderRadius: 12, borderCurve: 'continuous', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  taskClaimCopy: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  taskClaimLabel: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', letterSpacing: -0.2 },
  taskClaimAmount: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  error: { paddingVertical: 12 },
});
