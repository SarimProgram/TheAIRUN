/**
 * Daily Plan Projection Utility
 * 
 * Projects the high-level Weekly Summary (e.g. "2 Easy Runs, 1 Long Run")
 * onto a specific 7-day schedule (Mon-Sun).
 * 
 * This logic mirrors the backend's "Micro-Level Algorithm" to give users
 * an immediate preview of their week before the full plan is generated.
 */

export const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Distribution Algorithm constants (Mirrors backend config)
export const RUN_TYPE_MULTIPLIERS: Record<string, number> = {
    "Long Run": 1.5, "Tempo Run": 1.2, "Progression Run": 1.2, "Steady Run": 1.1,
    "Interval Run": 1.1, "Fartlek Run": 1.1, "Hill Run": 1.1, "Time Trial": 1.3,
    "Easy Run": 1.0, "Recovery Run": 0.7, "Run–Walk": 0.8, "Power Walk": 0.6,
    "Long Walk": 0.8, "Incline Walk": 0.6, "Recovery Walk": 0.5, "Goal Practice Run": 1.4,
};

export type DaySchedule = {
    dayIdx: number;
    name: string;
    type: 'STEP' | 'RUN' | 'RECOVERY';
    runType: string | null;
    targetKm: number;
    multiplier: number;
};

const normalizeAvailableDays = (availableDays?: number[]): number[] => {
    if (!Array.isArray(availableDays)) return [];
    return Array.from(
        new Set(
            availableDays
                .map((day) => Number(day))
                .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
        )
    ).sort((a, b) => a - b);
};

const getPreferredRunDays = (availableDays: number[]): number[] => {
    const preferredWeekend = [5, 6].filter((day) => availableDays.includes(day));
    const weekdays = availableDays.filter((day) => day !== 5 && day !== 6);

    if (weekdays.length <= 1) return [...preferredWeekend, ...weekdays];

    const remaining = [...weekdays];
    const ordered: number[] = [remaining.shift()!];

    while (remaining.length > 0) {
        const last = ordered[ordered.length - 1];
        let farthestIndex = 0;
        let farthestGap = -1;
        for (let i = 0; i < remaining.length; i++) {
            const gap = Math.abs(remaining[i] - last);
            if (gap > farthestGap) {
                farthestGap = gap;
                farthestIndex = i;
            }
        }
        ordered.push(remaining.splice(farthestIndex, 1)[0]);
    }

    return [...preferredWeekend, ...ordered];
};

type PlannedRunSession = {
    runType: string;
    targetKm?: number;
};

export const getMappedDays = (weekData: any, availableDays?: number[]): DaySchedule[] => {
    if (!weekData || !weekData["Week Dailys"]) return [];

    // Safety check for runs array
    const weekDailys = weekData["Week Dailys"];
    if (!weekDailys.runs || !Array.isArray(weekDailys.runs)) {
        // Return empty schedule if runs data is missing
        return Array.from({ length: 7 }, (_, i) => ({
            dayIdx: i,
            name: dayNames[i],
            type: 'STEP',
            runType: null,
            targetKm: 0,
            multiplier: 0,
        }));
    }

    const { runs, recoveryDays } = weekDailys;
    const weeklyKm = weekData["Run km/week"] || 0;
    const normalizedAvailableDays = normalizeAvailableDays(availableDays);
    const useAvailability = normalizedAvailableDays.length > 0;

    // Initial setup (all STEP)
    const days: DaySchedule[] = Array.from({ length: 7 }, (_, i) => ({
        dayIdx: i,
        name: dayNames[i],
        type: 'STEP',
        runType: null,
        targetKm: 0,
        multiplier: 0,
    }));

    // 1. Expand Runs
    const runSessions: PlannedRunSession[] = [...runs].flatMap((r: any) =>
        Array.from({ length: Number(r.sessions || 0) }, () => ({
            runType: r.runType,
            targetKm: typeof r.targetKm === 'number' ? Math.round(r.targetKm * 10) / 10 : undefined,
        }))
    );

    let recLeft = recoveryDays || 0;

    if (!useAvailability) {
        if (recLeft > 0) { days[6].type = 'RECOVERY'; recLeft--; }

        const longRunIdx = runSessions.findIndex((session) => session.runType === 'Long Run');
        if (longRunIdx !== -1) {
            const longRun = runSessions.splice(longRunIdx, 1)[0];
            days[5].type = 'RUN';
            days[5].runType = longRun.runType;
            days[5].targetKm = longRun.targetKm ?? 0;
        }

        [1, 3].forEach(idx => {
            if (runSessions.length > 0 && days[idx].type === 'STEP') {
                const nextRun = runSessions.shift()!;
                days[idx].type = 'RUN';
                days[idx].runType = nextRun.runType;
                days[idx].targetKm = nextRun.targetKm ?? 0;
            }
        });

        [0, 2, 4].forEach(idx => {
            if (runSessions.length > 0 && days[idx].type === 'STEP') {
                const nextRun = runSessions.shift()!;
                days[idx].type = 'RUN';
                days[idx].runType = nextRun.runType;
                days[idx].targetKm = nextRun.targetKm ?? 0;
            }
        });

        for (let i = 0; i < 7 && recLeft > 0; i++) {
            if (days[i].type === 'STEP') {
                days[i].type = 'RECOVERY';
                recLeft--;
            }
        }
    } else {
        const preferredRunDays = getPreferredRunDays(normalizedAvailableDays);
        const longRunIdx = runSessions.findIndex((session) => session.runType === 'Long Run');

        if (longRunIdx !== -1 && preferredRunDays.length > 0) {
            const longRun = runSessions.splice(longRunIdx, 1)[0];
            const longRunDay = preferredRunDays[0];
            days[longRunDay].type = 'RUN';
            days[longRunDay].runType = longRun.runType;
            days[longRunDay].targetKm = longRun.targetKm ?? 0;
        }

        preferredRunDays.forEach((idx) => {
            if (runSessions.length > 0 && days[idx].type === 'STEP') {
                const nextRun = runSessions.shift()!;
                days[idx].type = 'RUN';
                days[idx].runType = nextRun.runType;
                days[idx].targetKm = nextRun.targetKm ?? 0;
            }
        });

        const recoveryCandidates = [
            ...Array.from({ length: 7 }, (_, i) => i).filter((day) => !normalizedAvailableDays.includes(day)),
            ...normalizedAvailableDays,
        ];
        for (const idx of recoveryCandidates) {
            if (recLeft === 0) break;
            if (days[idx].type === 'STEP') {
                days[idx].type = 'RECOVERY';
                recLeft--;
            }
        }
    }

    // 3. Allocate KM (Micro-Level Algorithm Step 4)
    const activeRuns = days.filter(d => d.type === 'RUN');
    if (activeRuns.length > 0 && weeklyKm > 0) {
        const fixedRuns = activeRuns.filter((run) => typeof run.targetKm === 'number' && run.targetKm > 0);
        const weightedRuns = activeRuns.filter((run) => !(typeof run.targetKm === 'number' && run.targetKm > 0));
        const fixedKmTotal = fixedRuns.reduce((sum, run) => sum + run.targetKm, 0);
        const remainingKm = Math.max(Math.round((weeklyKm - fixedKmTotal) * 10) / 10, 0);
        const weights = weightedRuns.map(r => RUN_TYPE_MULTIPLIERS[r.runType!] || 1.0);
        const totalWeight = weights.reduce((a, b) => a + b, 0);

        if (totalWeight > 0) {
            weightedRuns.forEach((r, i) => {
                r.multiplier = weights[i];
                r.targetKm = Math.round(((weights[i] / totalWeight) * remainingKm) * 10) / 10;
            });
        }

        // Minor remainder adjustment to ensure exact weekly matching
        const currentSum = activeRuns.reduce((a, b) => a + b.targetKm, 0);
        const diff = weeklyKm - currentSum;
        if (Math.abs(diff) > 0.01 && weightedRuns.length > 0) {
            weightedRuns[0].targetKm = Math.round((weightedRuns[0].targetKm + diff) * 10) / 10;
        }
    }

    return days;
};
