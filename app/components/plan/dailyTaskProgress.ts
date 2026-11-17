import { calorieGoalStatus } from '../home/calorieGoalStatus';
import type { PointCategoryKey } from '../../hooks/useDailyPoints';

export type DailyTaskKey = 'steps' | 'food' | 'water' | 'sleep';
export type DailyTaskProgress = {
  key: DailyTaskKey;
  category?: PointCategoryKey;
  label: string;
  done: boolean;
  progress: number;
  metric: string;
  remaining: string;
  incompleteMessage: string;
};
type Metrics = { steps: number; stepsTarget: number; calories: number; calorieTarget: number; waterMl: number; waterTarget: number };
const ratio = (value: number, target: number) => target > 0 ? Math.max(0, Math.min(1, value / target)) : 0;

export function dailyTaskProgress(p: Metrics): DailyTaskProgress[] {
  const stepsLeft = Math.max(0, Math.ceil(p.stepsTarget - p.steps));
  const waterLeft = Math.max(0, Math.ceil(p.waterTarget - p.waterMl));
  const calorieMinimum = Math.ceil(p.calorieTarget * 0.7);
  const caloriesLeft = Math.max(0, Math.ceil(calorieMinimum - p.calories));
  const caloriesOver = Math.max(0, Math.ceil(p.calories - p.calorieTarget));
  const nutrition = calorieGoalStatus(p.calories, p.calorieTarget);
  const stepsDone = p.stepsTarget > 0 && p.steps >= p.stepsTarget;
  const waterDone = p.waterTarget > 0 && p.waterMl >= p.waterTarget;
  const calorieRemaining = nutrition.complete
    ? `Your intake is within the ${calorieMinimum.toLocaleString()}–${p.calorieTarget.toLocaleString()} kcal goal range.`
    : p.calorieTarget <= 0 ? 'Your calorie target is unavailable.'
    : caloriesOver > 0 ? `${caloriesOver.toLocaleString()} kcal above your target. Your intake is outside the goal range.`
    : `Log ${caloriesLeft.toLocaleString()} more kcal to reach the ${calorieMinimum.toLocaleString()}–${p.calorieTarget.toLocaleString()} kcal goal range.`;
  return [
    { key: 'steps', category: 'STEPS', label: `Hit ${p.stepsTarget.toLocaleString()} steps`, done: stepsDone,
      progress: ratio(p.steps, p.stepsTarget), metric: `${Math.round(p.steps).toLocaleString()} / ${p.stepsTarget.toLocaleString()} steps`,
      remaining: p.stepsTarget <= 0 ? 'Your step target is unavailable.' : stepsDone ? 'Step goal reached. Nice work!' : `${stepsLeft.toLocaleString()} steps left to reach your goal.`,
      incompleteMessage: p.stepsTarget <= 0 ? 'Your step target is unavailable.' : `Step goal not reached yet. You still need ${stepsLeft.toLocaleString()} steps.` },
    { key: 'food', category: 'CALORIES', label: `Stay within ${p.calorieTarget.toLocaleString()} kcal`, done: nutrition.complete,
      progress: nutrition.complete ? 1 : caloriesOver > 0 ? 0 : ratio(p.calories, calorieMinimum), metric: `${Math.round(p.calories).toLocaleString()} kcal logged`,
      remaining: calorieRemaining, incompleteMessage: `Calorie goal not met. ${calorieRemaining}` },
    { key: 'water', category: 'HYDRATION', label: `Drink ${p.waterTarget / 1000} L water`, done: waterDone,
      progress: ratio(p.waterMl, p.waterTarget), metric: `${Math.round(p.waterMl).toLocaleString()} / ${p.waterTarget.toLocaleString()} ml`,
      remaining: p.waterTarget <= 0 ? 'Your water target is unavailable.' : waterDone ? 'Water goal reached. Well done!' : `${waterLeft.toLocaleString()} ml of water left to reach your goal.`,
      incompleteMessage: p.waterTarget <= 0 ? 'Your water target is unavailable.' : `Water goal not reached yet. You still need ${waterLeft.toLocaleString()} ml.` },
    { key: 'sleep', label: 'Sleep 7–8 hours', done: false, progress: 0, metric: 'Sleep tracking unavailable',
      remaining: 'Sleep tracking is not connected. No pts can be earned for this task yet.',
      incompleteMessage: 'Sleep tracking is not connected, so this task cannot be completed yet.' },
  ];
}
