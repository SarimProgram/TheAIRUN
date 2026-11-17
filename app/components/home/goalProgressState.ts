import { calorieGoalStatus } from './calorieGoalStatus';

export function goalProgressState(current?: number | null, target?: number | null, calorie = false) {
  const value = current != null && Number.isFinite(current) ? Math.max(0, current) : null;
  const goal = target != null && Number.isFinite(target) && target > 0 ? target : null;
  const ratio = value != null && goal != null ? value / goal : null;
  const overTarget = calorie && ratio != null && ratio > 1;
  const complete = calorie ? calorieGoalStatus(current, target).complete : ratio != null && ratio >= 1;
  return { value, goal, ratio, complete, overTarget };
}
