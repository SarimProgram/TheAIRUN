import type { RunType } from "@/types/RunTemplate";
import { EASY_RUN_INSTRUCTION_RULES } from "@/lib/run-instructions/easy-run";
import { LONG_RUN_INSTRUCTION_RULES } from "@/lib/run-instructions/long-run";
import { POWER_WALK_INSTRUCTION_RULES } from "@/lib/run-instructions/power-walk";
import { WALK_INSTRUCTION_RULES } from "@/lib/run-instructions/walk";

export type RunInstructionPaceState = "too_fast" | "too_slow" | "on_target" | "unknown";
export type RunInstructionTrigger = "phase_start" | "periodic" | "manual";

export interface RunInstructionRule {
    id: string;
    message: string;
    priority: number;
    triggerOn: RunInstructionTrigger[];
    templateIds?: RunType[];
    phaseLabels?: string[];
    weekNumbers?: number[];
    minWeek?: number;
    maxWeek?: number;
    paceStates?: RunInstructionPaceState[];
    minElapsedSec?: number;
    maxElapsedSec?: number;
    minDistanceProgress?: number;
    maxDistanceProgress?: number;
    cooldownSec?: number;
    maxTriggers?: number;
}

export interface RunInstructionContext {
    templateId: RunType;
    trigger: RunInstructionTrigger;
    phaseLabel: string;
    elapsedSec: number;
    distanceProgressPercent: number;
    weekNumber: number | null;
    paceState: RunInstructionPaceState;
}

const BASE_RUN_INSTRUCTION_RULES: RunInstructionRule[] = [
    {
        id: "warmup-start",
        message: "Warm up phase. Keep it relaxed and let your breathing settle.",
        priority: 100,
        triggerOn: ["phase_start"],
        phaseLabels: ["WARM UP", "START"],
        cooldownSec: 9999,
        maxTriggers: 1,
    },
    {
        id: "week-1-settle-in",
        message: "Week 1 is about control, not speed. Finish feeling confident.",
        priority: 95,
        triggerOn: ["phase_start", "manual"],
        weekNumbers: [1],
        phaseLabels: ["WARM UP", "START"],
        cooldownSec: 9999,
        maxTriggers: 1,
    },
    {
        id: "too-fast",
        message: "You are running too fast. Back off a touch and stay smooth.",
        priority: 90,
        triggerOn: ["periodic", "manual"],
        paceStates: ["too_fast"],
        minElapsedSec: 45,
        cooldownSec: 45,
        maxTriggers: 3,
    },
    {
        id: "too-slow",
        message: "Pick the pace up slightly and move into the target zone.",
        priority: 80,
        triggerOn: ["periodic", "manual"],
        paceStates: ["too_slow"],
        minElapsedSec: 90,
        cooldownSec: 60,
        maxTriggers: 2,
    },
    {
        id: "on-target",
        message: "This is your target pace. Hold this effort and stay relaxed.",
        priority: 70,
        triggerOn: ["periodic", "manual"],
        paceStates: ["on_target"],
        minElapsedSec: 120,
        cooldownSec: 75,
        maxTriggers: 2,
    },
    {
        id: "long-run-hydration",
        message: "Quick check: shoulders loose, posture tall, hydration in mind.",
        priority: 68,
        triggerOn: ["periodic", "manual"],
        templateIds: ["long", "long_walk"],
        minElapsedSec: 600,
        cooldownSec: 180,
        maxTriggers: 1,
    },
    {
        id: "halfway-lock-in",
        message: "Halfway done. Lock into rhythm and keep the effort controlled.",
        priority: 65,
        triggerOn: ["periodic", "manual"],
        minDistanceProgress: 45,
        maxDistanceProgress: 60,
        cooldownSec: 9999,
        maxTriggers: 1,
    },
    {
        id: "finish-soon",
        message: "You are close now. Stay tall and finish the session with intent.",
        priority: 72,
        triggerOn: ["periodic", "manual"],
        minDistanceProgress: 85,
        cooldownSec: 9999,
        maxTriggers: 1,
    },
    {
        id: "cooldown-start",
        message: "Cooldown phase. Ease off the pace and let the heart rate come down.",
        priority: 100,
        triggerOn: ["phase_start"],
        phaseLabels: ["SLOW DOWN", "COOL DOWN"],
        cooldownSec: 9999,
        maxTriggers: 1,
    },
];

export const RUN_INSTRUCTION_RULES: RunInstructionRule[] = [
    ...EASY_RUN_INSTRUCTION_RULES,
    ...LONG_RUN_INSTRUCTION_RULES,
    ...POWER_WALK_INSTRUCTION_RULES,
    ...WALK_INSTRUCTION_RULES,
    ...BASE_RUN_INSTRUCTION_RULES,
];

export const RUN_INSTRUCTION_IDEAS = [
    "Trigger by first kilometer completed.",
    "Trigger when pace has been too fast for 20 seconds straight.",
    "Add different messages for uphill vs downhill once elevation is available.",
    "Add cadence-based cues like shorter steps or quicker turnover.",
    "Trigger reassurance when GPS pace is unstable and should be ignored.",
    "Add beginner-only cues for weeks 1 to 3 and progression cues after week 4.",
    "Trigger form reminders if the user has been in the same pace state for a long time.",
    "Add template-specific finish cues for easy, long, and walk sessions.",
];

export function parseWeekNumber(weekContext?: string | null): number | null {
    if (!weekContext) return null;
    const match = weekContext.match(/week\s*(\d+)/i);
    return match ? Number.parseInt(match[1], 10) : null;
}

export function getPaceState(
    paceSecPerKm: number | null | undefined,
    targetMinPaceSecPerKm: number | undefined,
    targetMaxPaceSecPerKm: number | undefined
): RunInstructionPaceState {
    if (!paceSecPerKm || !targetMinPaceSecPerKm || !targetMaxPaceSecPerKm) {
        return "unknown";
    }

    if (paceSecPerKm < targetMinPaceSecPerKm) return "too_fast";
    if (paceSecPerKm > targetMaxPaceSecPerKm) return "too_slow";
    return "on_target";
}

export function pickConfiguredRunInstruction(
    context: RunInstructionContext,
    instructionCounts: Record<string, number>,
    lastShownAtSec: Record<string, number>
): RunInstructionRule | null {
    const eligible = RUN_INSTRUCTION_RULES
        .filter((rule) => rule.triggerOn.includes(context.trigger))
        .filter((rule) => !rule.templateIds || rule.templateIds.includes(context.templateId))
        .filter((rule) => !rule.phaseLabels || rule.phaseLabels.includes(context.phaseLabel))
        .filter((rule) => !rule.weekNumbers || (context.weekNumber !== null && rule.weekNumbers.includes(context.weekNumber)))
        .filter((rule) => rule.minWeek === undefined || (context.weekNumber !== null && context.weekNumber >= rule.minWeek))
        .filter((rule) => rule.maxWeek === undefined || (context.weekNumber !== null && context.weekNumber <= rule.maxWeek))
        .filter((rule) => !rule.paceStates || rule.paceStates.includes(context.paceState))
        .filter((rule) => rule.minElapsedSec === undefined || context.elapsedSec >= rule.minElapsedSec)
        .filter((rule) => rule.maxElapsedSec === undefined || context.elapsedSec <= rule.maxElapsedSec)
        .filter((rule) => rule.minDistanceProgress === undefined || context.distanceProgressPercent >= rule.minDistanceProgress)
        .filter((rule) => rule.maxDistanceProgress === undefined || context.distanceProgressPercent <= rule.maxDistanceProgress)
        .filter((rule) => {
            const shownCount = instructionCounts[rule.id] ?? 0;
            if (rule.maxTriggers !== undefined && shownCount >= rule.maxTriggers) {
                return false;
            }

            const lastShownAt = lastShownAtSec[rule.id];
            if (lastShownAt === undefined || rule.cooldownSec === undefined) {
                return true;
            }

            return context.elapsedSec - lastShownAt >= rule.cooldownSec;
        })
        .sort((a, b) => b.priority - a.priority);

    return eligible[0] ?? null;
}
