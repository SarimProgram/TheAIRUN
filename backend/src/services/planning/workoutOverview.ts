import type { DailyTarget, GeneratedWeekPlan, UserPlan } from '@prisma/client';
import { dayKeyInTimezone, dayKeyToUtcDate, getWeekStartMondayDayKey } from '../../lib/weekBounds';
import { readTrainingSchedule } from './trainingSchedule';
import { recommendedWorkoutId } from './workoutRecommendations';

type Week = GeneratedWeekPlan & { dailyTargets: DailyTarget[] };
export type OverviewPlan = UserPlan & { weeklyPlans: Week[] };
export type OverviewSession = {
    dayKey: string; dayOfWeek: number; week: number; activity: 'RUN' | 'WALK' | 'WORKOUT';
    workoutPreference?: 'gym' | 'home' | 'strength'; workoutId?: string;
    runType: string | null; distanceKm: number; sessionId?: string;
};
export const addOverviewDays = (day: string, offset: number) => {
    const date = dayKeyToUtcDate(day);
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
};

// Dates are calendar dates in the participant's timezone, never host-local dates.
export function projectWorkoutOverview(plan: OverviewPlan | null, today: string, timezone: string,
    fallback: (week: Week, availableDays: number[] | null) => Array<Pick<DailyTarget, 'dayOfWeek' | 'dayType' | 'runKm' | 'runType'>>) {
    const weekStart = getWeekStartMondayDayKey(today);
    const start = plan ? getWeekStartMondayDayKey(dayKeyInTimezone(plan.weekStartedAt, timezone)) : weekStart;
    const sessions: OverviewSession[] = [];
    for (const week of plan?.weeklyPlans ?? []) {
        const schedule = readTrainingSchedule(week.weekDailys);
        const targets = week.dailyTargets.length ? week.dailyTargets : fallback(week, plan!.availableDays as number[] | null);
        const library = schedule?.sessions.filter(s => s.activity === 'WORKOUT' && s.workoutPreference !== 'gym') ?? [];
        for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
            const assigned = schedule?.sessions.find(s => s.dayOfWeek === dayOfWeek);
            const target = targets.find(d => d.dayOfWeek === dayOfWeek);
            // Legacy STEP days are ordinary movement, not invented workout lessons.
            if (!assigned && (schedule || target?.dayType !== 'RUN')) continue;
            const activity = assigned?.activity ?? (/walk/i.test(target?.runType ?? '') ? 'WALK' : 'RUN');
            const preference = activity === 'WORKOUT' ? assigned?.workoutPreference ?? 'strength' : undefined;
            const workoutId = preference && preference !== 'gym'
                ? recommendedWorkoutId(preference, week.week, Math.max(0, library.findIndex(s => s.dayOfWeek === dayOfWeek)), library.length, assigned?.workoutId) : undefined;
            sessions.push({ dayKey: addOverviewDays(start, (week.week - 1) * 7 + dayOfWeek), dayOfWeek, week: week.week,
                activity, workoutPreference: preference, workoutId, runType: target?.runType ?? null, distanceKm: target?.runKm ?? 0 });
        }
    }
    sessions.sort((a, b) => a.dayKey.localeCompare(b.dayKey));
    const scheduled = sessions.filter(s => s.dayKey >= weekStart && s.dayKey < addOverviewDays(weekStart, 7));
    const lastWeek = Math.max(0, ...(plan?.weeklyPlans.map(w => w.week) ?? []));
    return { today, weekStart, planId: plan?.id ?? null, hasPlan: lastWeek > 0,
        ended: lastWeek > 0 && today >= addOverviewDays(start, lastWeek * 7),
        todaySession: sessions.find(s => s.dayKey === today) ?? null,
        nextSession: sessions.find(s => s.dayKey > today) ?? null,
        scheduled, weeklyTarget: scheduled.length };
}

export function completedWorkoutDays(scheduled: OverviewSession[], today: string, photoDays: string[],
    workouts: Array<{ dayKey: string; type: string; clientId: string | null; endedAt: Date | null; distanceKm: number }>,
    summaries: Array<{ dayKey: string; runStatus: string }>) {
    const photos = new Set(photoDays);
    return scheduled.filter(session => session.dayKey <= today && (photos.has(session.dayKey)
        || (session.activity === 'WORKOUT' && session.workoutPreference !== 'gym' && workouts.some(w =>
            w.dayKey === session.dayKey && w.endedAt && w.clientId?.startsWith('guided:')))
        || (session.activity !== 'WORKOUT' && (summaries.some(s => s.dayKey === session.dayKey && s.runStatus === 'COMPLETED')
            || (session.distanceKm > 0 && workouts.filter(w => w.dayKey === session.dayKey && w.endedAt
                && ['RUN', 'WALK', 'INTERVAL'].includes(w.type)).reduce((km, w) => km + w.distanceKm, 0) >= session.distanceKm)))))
        .map(s => s.dayKey);
}
