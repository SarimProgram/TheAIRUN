export function calorieGoalStatus(calories?: number | null, target?: number | null) {
  if (calories == null || !Number.isFinite(calories)) return { complete: false, label: 'Unavailable', message: 'Calorie data is unavailable.' };
  const validTarget = target != null && Number.isFinite(target) && target > 0;
  const minimum = validTarget ? Math.ceil(target * 0.7) : 0;
  const range = validTarget ? `Complete when your logged intake is between ${minimum.toLocaleString()} and ${Math.floor(target).toLocaleString()} calories, inclusive.` : 'Your calorie target is unavailable.';
  if (calories <= 0) return { complete: false, label: 'Nothing logged', message: `Nothing logged. ${range}` };
  if (!validTarget) return { complete: false, label: 'Unavailable', message: range };
  if (calories > target) return { complete: false, label: 'Over target', message: `Over target by ${Math.ceil(calories - target).toLocaleString()} calories. ${range}` };
  if (calories < minimum) return { complete: false, label: 'Less calories intake', message: `Less calories intake: ${Math.round(calories).toLocaleString()} calories logged. ${range}` };
  return { complete: true, label: 'Complete', message: `${Math.round(calories).toLocaleString()} calories logged. ${range}` };
}
