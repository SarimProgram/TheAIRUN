// Main Plan Generator
// Orchestrates the full plan generation algorithm

import { UIStep, UserContext, WeeklySchedule, AllocatedSession, PlanWeek } from "./types";
import { RUN_TYPE_MULTIPLIERS, ROUNDING_RULES } from "./config";
import { getGenerator } from "./registry";
import prisma from "../db/prisma";
import { Prisma } from "@prisma/client";

interface GeneratePlanInput {
    userId: string;
    goal: string;
    totalWeeks: number;
    weeklySchedules: WeeklySchedule[];
    weeklyTargetKm: number[]; // Array of weekly km targets
    userContext: UserContext;
}

interface GeneratedPlanResult {
    planId: string;
    planJson: { weeks: PlanWeek[] };
    sessionCount: number;
}

/**
 * Main plan generator function
 * Implements the 8-step algorithm
 */
export async function generateTrainingPlan(input: GeneratePlanInput): Promise<GeneratedPlanResult> {
    // Step 1: Validate inputs
    validateInputs(input);

    const planWeeks: PlanWeek[] = [];
    const allSessionData: Array<{
        week: number;
        runType: string;
        targetKm: number;
        stepsJson: UIStep[];
    }> = [];

    // Steps 3-6: Process each week
    for (let weekNum = 1; weekNum <= input.totalWeeks; weekNum++) {
        const weekSchedule = input.weeklySchedules[weekNum - 1];
        const weeklyKm = input.weeklyTargetKm[weekNum - 1];

        if (!weekSchedule || !weekSchedule.runs || weekSchedule.runs.length === 0) {
            // Empty week
            planWeeks.push({ week: weekNum, targetKm: weeklyKm, sessions: [] });
            continue;
        }

        // Step 3: Expand schedule to sessions
        const sessions = expandSchedule(weekSchedule);

        // Step 4: Allocate km using multipliers
        const allocatedSessions = allocateKm(sessions, weeklyKm);

        // Prepare session data for this week
        const weekSessions: Array<{ sessionId: string; runType: string; targetKm: number }> = [];

        for (const session of allocatedSessions) {
            // Step 6: Generate UI steps
            const generator = getGenerator(session.runType);
            const uiSteps = generator(
                session.targetKm,
                weekNum,
                input.totalWeeks,
                input.userContext
            );

            // Placeholder sessionId - will be replaced with actual cuid after DB insert
            const tempId = `temp_${weekNum}_${session.sessionIndex}`;

            allSessionData.push({
                week: weekNum,
                runType: session.runType,
                targetKm: session.targetKm,
                stepsJson: uiSteps,
            });

            weekSessions.push({
                sessionId: tempId,
                runType: session.runType,
                targetKm: session.targetKm,
            });
        }

        planWeeks.push({
            week: weekNum,
            targetKm: weeklyKm,
            sessions: weekSessions,
        });
    }

    // Step 2, 5, 7: Create plan and sessions in a transaction
    const result = await prisma.$transaction(async (tx) => {
        // Create the training plan
        const plan = await tx.trainingPlan.create({
            data: {
                userId: input.userId,
                goal: input.goal,
                totalWeeks: input.totalWeeks,
                planJson: { weeks: [] } as Prisma.InputJsonValue, // Will update after sessions are created
            },
        });

        // Create all run sessions
        const createdSessions = [];
        for (const sessionData of allSessionData) {
            const session = await tx.runSession.create({
                data: {
                    planId: plan.id,
                    week: sessionData.week,
                    runType: sessionData.runType,
                    targetKm: sessionData.targetKm,
                    stepsJson: sessionData.stepsJson as unknown as Prisma.InputJsonValue,
                },
            });
            createdSessions.push(session);
        }

        // Update planWeeks with actual session IDs
        let sessionIndex = 0;
        for (const week of planWeeks) {
            for (const ws of week.sessions) {
                ws.sessionId = createdSessions[sessionIndex].id;
                sessionIndex++;
            }
        }

        // Update plan with final planJson
        await tx.trainingPlan.update({
            where: { id: plan.id },
            data: { planJson: { weeks: planWeeks } as unknown as Prisma.InputJsonValue },
        });

        return { planId: plan.id, sessionCount: createdSessions.length };
    });

    // Step 8: Final validation
    validatePlanStructure(planWeeks, allSessionData.length);

    return {
        planId: result.planId,
        planJson: { weeks: planWeeks },
        sessionCount: result.sessionCount,
    };
}

/**
 * Step 1: Validate all required inputs
 */
function validateInputs(input: GeneratePlanInput): void {
    if (!input.userId) throw new Error("Missing userId");
    if (!input.goal) throw new Error("Missing goal");
    if (input.totalWeeks < 1) throw new Error("totalWeeks must be at least 1");
    if (input.weeklySchedules.length !== input.totalWeeks) {
        throw new Error(`weeklySchedules length (${input.weeklySchedules.length}) must match totalWeeks (${input.totalWeeks})`);
    }
    if (input.weeklyTargetKm.length !== input.totalWeeks) {
        throw new Error(`weeklyTargetKm length (${input.weeklyTargetKm.length}) must match totalWeeks (${input.totalWeeks})`);
    }

    // Validate each run type has a multiplier
    for (const schedule of input.weeklySchedules) {
        for (const run of schedule.runs) {
            if (!RUN_TYPE_MULTIPLIERS[run.runType] && !RUN_TYPE_MULTIPLIERS[run.runType.replace(/-/g, "–")]) {
                console.warn(`No multiplier for run type: ${run.runType}, using default 1.0`);
            }
        }
    }
}

/**
 * Step 3: Expand schedule into individual session placeholders
 */
function expandSchedule(schedule: WeeklySchedule): Array<{ runType: string; sessionIndex: number }> {
    const sessions: Array<{ runType: string; sessionIndex: number }> = [];
    let index = 0;

    for (const run of schedule.runs) {
        for (let i = 0; i < run.sessions; i++) {
            sessions.push({ runType: run.runType, sessionIndex: index++ });
        }
    }

    return sessions;
}

/**
 * Step 4: Allocate km using weighted multipliers
 */
function allocateKm(
    sessions: Array<{ runType: string; sessionIndex: number }>,
    weeklyKm: number
): AllocatedSession[] {
    if (sessions.length === 0 || weeklyKm <= 0) return [];

    // Calculate weights
    const weights = sessions.map((s) => {
        const normalized = s.runType.replace(/-/g, "–");
        return RUN_TYPE_MULTIPLIERS[normalized] || RUN_TYPE_MULTIPLIERS[s.runType] || 1.0;
    });

    const totalWeight = weights.reduce((sum, w) => sum + w, 0);

    // Allocate proportionally
    const allocated = sessions.map((s, i) => ({
        runType: s.runType,
        sessionIndex: s.sessionIndex,
        targetKm: (weights[i] / totalWeight) * weeklyKm,
    }));

    // Apply rounding
    const rounded = allocated.map((a) => ({
        ...a,
        targetKm: roundToNearest(a.targetKm, ROUNDING_RULES.precision),
    }));

    // Apply min/max constraints
    for (const a of rounded) {
        a.targetKm = Math.max(ROUNDING_RULES.minDistanceKm, Math.min(ROUNDING_RULES.maxDistanceKm, a.targetKm));
    }

    // Distribute remainder
    const roundedSum = rounded.reduce((sum, a) => sum + a.targetKm, 0);
    const remainder = roundToNearest(weeklyKm - roundedSum, ROUNDING_RULES.precision);

    if (remainder !== 0 && rounded.length > 0) {
        if (ROUNDING_RULES.remainderRule === "largest") {
            // Add to largest session
            const largestIdx = rounded.reduce((maxIdx, curr, idx, arr) =>
                curr.targetKm > arr[maxIdx].targetKm ? idx : maxIdx, 0);
            rounded[largestIdx].targetKm = roundToNearest(rounded[largestIdx].targetKm + remainder, ROUNDING_RULES.precision);
        } else if (ROUNDING_RULES.remainderRule === "last") {
            rounded[rounded.length - 1].targetKm = roundToNearest(
                rounded[rounded.length - 1].targetKm + remainder,
                ROUNDING_RULES.precision
            );
        } else {
            rounded[0].targetKm = roundToNearest(rounded[0].targetKm + remainder, ROUNDING_RULES.precision);
        }
    }

    return rounded;
}

/**
 * Step 8: Final validation
 */
function validatePlanStructure(weeks: PlanWeek[], expectedSessionCount: number): void {
    let totalSessions = 0;
    for (const week of weeks) {
        totalSessions += week.sessions.length;
    }

    if (totalSessions !== expectedSessionCount) {
        throw new Error(`Session count mismatch: expected ${expectedSessionCount}, got ${totalSessions}`);
    }
}

function roundToNearest(value: number, precision: number): number {
    return Math.round(value / precision) * precision;
}
