type GoalRecord = {
    userId: string;
    dayKey: string;
    category: string;
    progress: number;
    earnedPoints: number;
    maxPoints: number;
};

const GOAL_CATEGORIES = new Set(['WALK_RUN', 'STEPS', 'CALORIES', 'MOBILITY', 'HYDRATION']);

// A completed category counts once per day; partial point awards do not count.
export function countCompletedWeeklyGoals(records: GoalRecord[], userId: string, removedGoals: string[] = []): number {
    const categoryGoals: Record<string, string> = { CALORIES: 'calories', STEPS: 'steps', WALK_RUN: 'steps', MOBILITY: 'workout', HYDRATION: 'water' };
    return new Set(records.filter(record =>
        record.userId === userId && GOAL_CATEGORIES.has(record.category) &&
        !removedGoals.includes(categoryGoals[record.category]) &&
        record.progress >= 1 && record.maxPoints > 0 && record.earnedPoints >= record.maxPoints,
    ).map(record => `${record.dayKey}:${record.category}`)).size;
}
