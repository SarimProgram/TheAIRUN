export type IntervalInstructionSegmentType = "run" | "walk" | "warmup" | "cooldown";

export interface IntervalInstructionContext {
    segmentType: IntervalInstructionSegmentType;
    segmentIndex: number;
    totalSegments: number;
    totalWorkIntervals: number;
    workDurationSec: number | null;
    recoveryDurationSec: number | null;
    durationSec: number;
    distanceKm?: number;
    paceSecPerKm?: number;
    isTimeBased: boolean;
    variant?: "run" | "walk";
}

interface IntervalInstructionRule {
    id: string;
    order: number;
    segmentTypes: IntervalInstructionSegmentType[];
    buildMessage: (context: IntervalInstructionContext) => string | null;
}

function formatDurationShort(totalSec: number | null | undefined): string | null {
    if (!totalSec || totalSec <= 0) return null;
    const minutes = Math.floor(totalSec / 60);
    const seconds = totalSec % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatPace(secPerKm: number | null | undefined): string | null {
    if (!secPerKm || !Number.isFinite(secPerKm) || secPerKm <= 0) return null;
    const minutes = Math.floor(secPerKm / 60);
    const seconds = Math.round(secPerKm % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function getTimeBasedTargetPace(context: IntervalInstructionContext): number | null {
    if (!context.isTimeBased || !context.distanceKm || context.distanceKm <= 0) return null;
    return Math.round(context.durationSec / context.distanceKm);
}

function getVariant(context: IntervalInstructionContext) {
    return context.variant === "walk" ? "walk" : "run";
}

const INTERVAL_INSTRUCTION_RULES: IntervalInstructionRule[] = [
    {
        id: "interval-warmup",
        order: 1,
        segmentTypes: ["warmup"],
        buildMessage: (context) => {
            const workCountText = context.totalWorkIntervals > 0 ? `${context.totalWorkIntervals} work intervals` : "short work intervals";
            const workText = formatDurationShort(context.workDurationSec);
            const recoveryText = formatDurationShort(context.recoveryDurationSec);
            if (getVariant(context) === "walk") {
                if (workText && recoveryText) {
                    return `Start with an easy walk. Today you will do ${workCountText}, ${workText} fast walk and ${recoveryText} recovery walk.`;
                }
                return `Start with an easy walk. Today you will do ${workCountText} with recovery walk between them.`;
            }
            if (workText && recoveryText) {
                return `Warm up easy. Today you will do ${workCountText}, ${workText} on and ${recoveryText} easy recovery.`;
            }
            return `Warm up easy. Today you will do ${workCountText} with easy recovery between them.`;
        },
    },
    {
        id: "interval-work-main",
        order: 1,
        segmentTypes: ["run"],
        buildMessage: (context) =>
            getVariant(context) === "walk"
                ? "Fast walk starts now. Stay tall, drive the arms, and stay controlled."
                : "Work interval starts now. Run strong and stay controlled.",
    },
    {
        id: "interval-work-pace",
        order: 2,
        segmentTypes: ["run"],
        buildMessage: (context) => {
            const targetPace = context.isTimeBased ? getTimeBasedTargetPace(context) : context.paceSecPerKm ?? null;
            const paceText = formatPace(targetPace);
            if (!paceText) return null;
            if (getVariant(context) === "walk") {
                return `For this block, aim for about ${paceText} per km on the fast walk.`;
            }
            if (context.isTimeBased) {
                return `For this interval, try not to go slower than ${paceText} per km.`;
            }
            return `For this interval, aim for about ${paceText} per km.`;
        },
    },
    {
        id: "interval-recovery",
        order: 1,
        segmentTypes: ["walk"],
        buildMessage: (context) =>
            getVariant(context) === "walk"
                ? "Recovery walk starts now. Slow down, breathe, and reset for the next fast block."
                : "Recovery starts now. Slow down, breathe, and get ready for the next one.",
    },
    {
        id: "interval-cooldown",
        order: 1,
        segmentTypes: ["cooldown"],
        buildMessage: (context) =>
            getVariant(context) === "walk"
                ? "Cooldown walk starts now. Settle into an easy walk and let your body relax."
                : "Cooldown starts now. Run easy and let your body settle.",
    },
];

export function resolveIntervalInstructionMessages(context: IntervalInstructionContext): string[] {
    return INTERVAL_INSTRUCTION_RULES
        .filter((rule) => rule.segmentTypes.includes(context.segmentType))
        .sort((a, b) => a.order - b.order)
        .map((rule) => rule.buildMessage(context))
        .filter((message): message is string => Boolean(message));
}
