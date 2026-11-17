import { z } from 'zod';
import { ANIMATED_WORKOUT_IDS, recommendedWorkoutId } from './workoutRecommendations';

export const trainingSessionSchema = z.object({
    dayOfWeek: z.number().int().min(0).max(6),
    activity: z.enum(['RUN', 'WALK', 'WORKOUT']),
    workoutPreference: z.enum(['gym', 'home', 'strength']).optional(),
    workoutId: z.enum(ANIMATED_WORKOUT_IDS).optional(),
});
export type TrainingSession = z.infer<typeof trainingSessionSchema>;
export type TrainingSchedule = { version: 1; customizationCompleted: boolean; sessions: TrainingSession[] };
type Preferences = {
    goalType: string; trainingStyle?: string | null; workoutDaysPerWeek?: number | null;
    workoutPreference?: string | null; availableDays?: unknown; weightKg: number;
    heightCm?: number | null; ageYears: number; runExperience?: string | null;
};

export function readTrainingSchedule(weekDailys: unknown): TrainingSchedule | null {
    const value = (weekDailys as any)?.trainingSchedule;
    if (value?.version !== 1 || !Array.isArray(value.sessions)) return null;
    const parsed = z.array(trainingSessionSchema).min(1).max(7).safeParse(value.sessions);
    if (!parsed.success || new Set(parsed.data.map(session => session.dayOfWeek)).size !== parsed.data.length) return null;
    return { version: 1, customizationCompleted: value.customizationCompleted === true, sessions: parsed.data };
}

export function selectedActivities(plan: Pick<Preferences, 'trainingStyle' | 'goalType'>): TrainingSession['activity'][] {
    const styles = new Set((plan.trainingStyle ?? '').split(',').map(style => style.trim()));
    const activities: TrainingSession['activity'][] = [];
    if (styles.has('workout')) activities.push('WORKOUT');
    if (styles.has('runOnly') || styles.has('walkAndRun')) activities.push('RUN');
    if (styles.has('walkOnly') || styles.has('walkAndRun')) activities.push('WALK');
    return activities.length ? activities : [plan.goalType === 'weightloss' ? 'WALK' : 'RUN'];
}

export function buildTrainingSchedule(plan: Preferences): TrainingSchedule {
    const available = Array.isArray(plan.availableDays)
        ? [...new Set(plan.availableDays.filter((day: unknown): day is number => Number.isInteger(day) && Number(day) >= 0 && Number(day) <= 6))].sort((a, b) => a - b) : [];
    const count = Math.min(7, Math.max(1, plan.workoutDaysPerWeek ?? (available.length || 3)));
    // Spread the default evenly. A saved weekday choice is used when its size matches the requested count.
    const days = available.length === count ? available : Array.from({ length: count }, (_, index) => Math.floor(index * 7 / count));
    const bmi = plan.heightCm ? plan.weightKg / ((plan.heightCm / 100) ** 2) : null;
    const lowerImpact = (bmi != null && bmi >= 30) || plan.ageYears >= 60 || plan.runExperience === 'beginner';
    const activities = selectedActivities(plan);
    const priority: TrainingSession['activity'][] = plan.goalType !== 'weightloss'
        ? lowerImpact ? ['RUN', 'WALK', 'WORKOUT'] : ['RUN', 'WORKOUT', 'WALK']
        : lowerImpact ? ['WORKOUT', 'WALK', 'RUN'] : ['WORKOUT', 'RUN', 'WALK'];
    const ordered = priority.filter(activity => activities.includes(activity));
    const preference = ['gym', 'home', 'strength'].includes(plan.workoutPreference ?? '')
        ? plan.workoutPreference as 'gym' | 'home' | 'strength' : 'strength';
    return { version: 1, customizationCompleted: false, sessions: days.map((dayOfWeek, index) => {
        const activity = ordered[index % ordered.length];
        return { dayOfWeek, activity, ...(activity === 'WORKOUT' ? { workoutPreference: preference } : {}) };
    }) };
}

/** Keep the model's progressive distances and session variety, while enforcing the saved weekly split. */
export function applyTrainingSchedule(row: any, schedule: TrainingSchedule) {
    const libraryDays = schedule.sessions.filter(session => session.activity === 'WORKOUT' && session.workoutPreference !== 'gym');
    let libraryIndex = 0;
    const recommendedSchedule: TrainingSchedule = { ...schedule, sessions: schedule.sessions.map(session => {
        const { workoutId, ...base } = session;
        if (session.activity !== 'WORKOUT' || session.workoutPreference === 'gym') return base;
        return { ...base, workoutId: recommendedWorkoutId(session.workoutPreference ?? 'strength', Number(row.Week ?? 1),
            libraryIndex++, libraryDays.length, workoutId) };
    }) };
    const wd = row['Week Dailys'] ?? {};
    const source = Array.isArray(wd.runs) ? wd.runs.flatMap((run: any) =>
        Array.from({ length: Math.min(7, Math.max(0, Math.round(Number(run.sessions) || 0))) }, () => ({ ...run, sessions: 1 }))) : [];
    const cardio = schedule.sessions.filter(session => session.activity !== 'WORKOUT');
    const taken = new Set<number>();
    const runs = cardio.map(session => {
        const walking = session.activity === 'WALK';
        const index = source.findIndex((run: any, index: number) => !taken.has(index) && /walk/i.test(run.runType) === walking);
        if (index >= 0) taken.add(index);
        const run = index >= 0 ? source[index] : null;
        const fallbackKm = Math.round((walking ? 2 : 3) * Math.min(1.5, 1 + Math.max(0, Number(row.Week ?? 1) - 1) * 0.05) * 10) / 10;
        return { runType: run?.runType ?? (walking ? 'Walk' : 'Easy Run'), sessions: 1,
            targetKm: typeof run?.targetKm === 'number' && run.targetKm > 0 ? run.targetKm : run ? null : fallbackKm };
    });
    // If the model schedules too many sessions, scale volume down rather than packing it into fewer days.
    const rawKm = Math.max(0, Number(row['Run km/week']) || 0);
    const scaledKm = rawKm * Math.min(1, cardio.length / Math.max(1, source.length));
    const fixedKm = runs.reduce((total, run) => total + (run.targetKm ?? 0), 0);
    const missing = runs.filter(run => run.targetKm == null).length;
    const weeklyKm = cardio.length ? Math.round(Math.max(scaledKm, fixedKm + missing) * 10) / 10 : 0;
    let unallocated = Math.round((weeklyKm - fixedKm) * 10);
    let remaining = missing;
    for (const run of runs) {
        if (run.targetKm == null) {
            const tenths = Math.round(unallocated / remaining);
            run.targetKm = tenths / 10;
            unallocated -= tenths;
            remaining--;
        }
    }
    // Exact session distances are authoritative; never leave undistributed volume in the weekly total.
    const exactWeeklyKm = Math.round(runs.reduce((total, run) => total + (run.targetKm ?? 0), 0) * 10) / 10;
    return { ...row, 'Run km/week': exactWeeklyKm, 'Week Dailys': {
        ...wd, stepDays: 0, runDays: cardio.length, workoutDays: schedule.sessions.length - cardio.length,
        recoveryDays: 7 - schedule.sessions.length, runs, trainingSchedule: recommendedSchedule,
    } };
}
