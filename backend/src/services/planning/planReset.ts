import { z } from 'zod';
import { MAX_SAFE_WEEKLY_LOSS_KG } from './planDuration';

export const resetPlanSchema = z.object({
    goalType: z.enum(['weightloss', 'running', 'both']),
    weightKg: z.number().positive().max(500),
    targetWeightKg: z.number().positive().max(500).nullable().optional(),
    timeHorizon: z.enum(['RELAXED', 'STANDARD', 'AGGRESSIVE', 'SPECIFIC_DATE']).optional(),
    targetDate: z.string().datetime().nullable().optional(),
    trainingStyle: z.enum(['walkOnly', 'walkAndRun', 'runOnly']),
    intensityLevel: z.enum(['STEADY', 'ACTIVE', 'PRO']),
    availableDays: z.array(z.number().int().min(0).max(6)).min(3).max(7),
    runGoal: z.enum(['5k', '10k', 'halfMarathon', 'speedImprovement']).nullable().optional(),
    runExperience: z.enum(['beginner', 'intermediate', 'advanced']).nullable().optional(),
    runRaceDate: z.string().datetime().nullable().optional(),
}).superRefine((data, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });
    if (new Set(data.availableDays).size !== data.availableDays.length) {
        issue('availableDays', 'Choose at least three different training days.');
    }
    if (data.goalType !== 'running') {
        if (!data.targetWeightKg || data.targetWeightKg >= data.weightKg) {
            issue('targetWeightKg', 'Target weight must be below your current weight.');
        }
        if (!data.timeHorizon) issue('timeHorizon', 'Choose a weight-loss pace.');
        if (data.timeHorizon === 'SPECIFIC_DATE' &&
            (!data.targetDate || new Date(data.targetDate).getTime() <= Date.now())) {
            issue('targetDate', 'Choose a future target date.');
        } else if (data.timeHorizon === 'SPECIFIC_DATE' && data.targetDate && data.targetWeightKg) {
            const minimum = new Date();
            minimum.setDate(minimum.getDate() + Math.ceil((data.weightKg - data.targetWeightKg) / MAX_SAFE_WEEKLY_LOSS_KG) * 7);
            minimum.setHours(0, 0, 0, 0);
            if (new Date(data.targetDate) < minimum) {
                issue('targetDate', 'Choose a later target date for this weight-loss goal.');
            }
        }
    }
    if (data.goalType !== 'weightloss') {
        if (!data.runGoal) issue('runGoal', 'Choose your running goal.');
        if (!data.runExperience) issue('runExperience', 'Choose your running experience.');
        if (data.trainingStyle === 'walkOnly') issue('trainingStyle', 'Choose a training style that includes running.');
        if (data.runRaceDate && new Date(data.runRaceDate).getTime() <= Date.now()) {
            issue('runRaceDate', 'Choose a future race date.');
        }
    }
});

export function buildPlanResetData(input: z.infer<typeof resetPlanSchema>) {
    const losesWeight = input.goalType !== 'running';
    const runs = input.goalType !== 'weightloss';
    return {
        goalType: input.goalType,
        weightKg: input.weightKg,
        targetWeightKg: losesWeight ? input.targetWeightKg! : null,
        weightToLoseKg: losesWeight ? input.weightKg - input.targetWeightKg! : null,
        timeHorizon: losesWeight ? input.timeHorizon! : null,
        targetDate: losesWeight && input.timeHorizon === 'SPECIFIC_DATE' && input.targetDate
            ? new Date(input.targetDate) : null,
        trainingStyle: input.trainingStyle,
        workoutDaysPerWeek: null,
        workoutPreference: null,
        activityPreference: input.trainingStyle === 'walkOnly' ? 'MOSTLY_WALKING' as const
            : input.trainingStyle === 'runOnly' ? 'MOSTLY_RUNNING' as const : 'WALKING_RUNNING' as const,
        intensityLevel: input.intensityLevel,
        availableDays: input.availableDays,
        runGoal: runs ? input.runGoal! : null,
        runExperience: runs ? input.runExperience! : null,
        runRaceDate: runs && input.runRaceDate ? new Date(input.runRaceDate) : null,
        runDietFocus: runs ? (losesWeight ? 'weightloss' : 'performance') : null,
        runPriority: null,
        hasRaceGoal: runs && !!input.runRaceDate,
        dailyCalorieTarget: null,
        dailyActivityMins: null,
    };
}
