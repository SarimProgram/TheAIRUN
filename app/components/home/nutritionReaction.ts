export type NutritionReaction = 'idle' | 'progress' | 'winning' | 'over-target';
type NutritionTotals = { goal?: number; food?: number; exercise?: number } | null | undefined;

const positive = (value?: number) => Math.max(0, Number(value) || 0);

export function nutritionReaction(data: NutritionTotals, otherData?: NutritionTotals): NutritionReaction {
  const goal = positive(data?.goal);
  const food = positive(data?.food);
  if (goal === 0 || food === 0) return 'idle';
  const net = food - positive(data?.exercise);
  if (net > goal) return 'over-target';
  const otherGoal = positive(otherData?.goal);
  if (otherGoal > 0 && positive(otherData?.food) > 0) {
    const otherNet = positive(otherData?.food) - positive(otherData?.exercise);
    // Compare distance to each person's own target, so different targets are fair.
    if (Math.abs(goal - net) / goal < Math.abs(otherGoal - otherNet) / otherGoal) return 'winning';
  }
  return 'progress';
}
