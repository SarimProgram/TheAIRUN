/** The stored target is a base food allowance. Actual activity is credited once. */
export function calculateCaloriesRemaining(baseTarget: number, activeCalories: number, consumedCalories: number) {
    return baseTarget + activeCalories - consumedCalories;
}
