export type GeneratedRun = {
    runType?: unknown;
    sessions?: unknown;
    targetKm?: unknown;
};

const WALK_SESSION_TYPES = new Set([
    "Walk",
    "Power Walk",
    "Interval Walk",
    "Long Walk",
    "Incline Walk",
    "Recovery Walk",
]);

const MIN_WALK_KM = 2;
const MIN_RUN_KM = 3;

function roundToOneDecimal(value: number): number {
    return Math.round(value * 10) / 10;
}

function positiveNumber(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) && value > 0
        ? value
        : null;
}

/**
 * Ensures the AI's weekly activity structure always has enough distance to
 * allocate a positive target to every scheduled walk or run session.
 *
 * "Run km/week" is retained for API/database compatibility, but represents
 * total scheduled walk/run distance.
 */
export function normalizeGeneratedWeeklyDistances(table: unknown): any[] {
    if (!Array.isArray(table)) return [];

    return table.map((week) => {
        if (!week || typeof week !== "object") return week;

        const weekRecord = week as Record<string, any>;
        const weekDailys = weekRecord["Week Dailys"];
        const runs: GeneratedRun[] = Array.isArray(weekDailys?.runs) ? weekDailys.runs : [];
        let sessionCount = 0;
        let minimumWeeklyKm = 0;

        for (const run of runs) {
            const sessions = typeof run?.sessions === "number" && Number.isFinite(run.sessions)
                ? Math.max(0, Math.floor(run.sessions))
                : 0;
            if (sessions === 0) continue;

            sessionCount += sessions;
            const fixedTargetKm = positiveNumber(run.targetKm);
            if (fixedTargetKm !== null) {
                minimumWeeklyKm += fixedTargetKm * sessions;
                continue;
            }

            minimumWeeklyKm += WALK_SESSION_TYPES.has(String(run.runType || ""))
                ? MIN_WALK_KM * sessions
                : MIN_RUN_KM * sessions;
        }

        if (sessionCount === 0) return week;

        const generatedWeeklyKm = positiveNumber(weekRecord["Run km/week"]) ?? 0;
        return {
            ...weekRecord,
            "Run km/week": roundToOneDecimal(Math.max(generatedWeeklyKm, minimumWeeklyKm)),
        };
    });
}
