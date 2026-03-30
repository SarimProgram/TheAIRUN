// src/routes/plan.routes.ts
import { Router } from "express";
import { z } from "zod";
import OpenAI from "openai";
import prisma from "../db/prisma";
import { AuthRequest } from "../middleware/auth";
import { presentPlan } from "./presenters";

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const createPlanSchema = z.object({
    weightKg: z.number().positive(),
    heightCm: z.coerce.number().int().positive(),
    ageYears: z.coerce.number().int().positive().max(120),
    goalType: z.enum(["WEIGHT_LOSS", "ENDURANCE", "MAINTENANCE"]),
    targetWeightKg: z.number().positive().optional().nullable(),
    weightToLoseKg: z.number().positive().optional().nullable(),
    timeHorizon: z.enum(["RELAXED", "STANDARD", "AGGRESSIVE", "SPECIFIC_DATE"]).optional().nullable(),
    targetDate: z.string().datetime().optional().nullable(),
    activityPreference: z.enum(["MOSTLY_WALKING", "WALKING_RUNNING", "MOSTLY_RUNNING"]).optional().nullable(),
    intensityLevel: z.enum(["STEADY", "ACTIVE", "PRO"]).default("ACTIVE"),
    availableDays: z.array(z.number().int().min(0).max(6)).min(1).max(7).optional().nullable(),
    dailyCalorieTarget: z.number().int().optional().nullable(),
    dailyActivityMins: z.number().int().optional().nullable(),

    // New fields
    runGoal: z.string().optional().nullable(),
    runExperience: z.string().optional().nullable(),
    runDietFocus: z.string().optional().nullable(),
    runPriority: z.string().optional().nullable(),
    runRaceDate: z.string().datetime().optional().nullable(),
    hasRaceGoal: z.boolean().optional().nullable(),
    bodyType: z.string().optional().nullable(),
    trainingStyle: z.string().optional().nullable(),
    baselinePaceSecPerKm: z.number().int().positive().optional().nullable(),
});

const updateScheduleDaysSchema = z.object({
    availableDays: z.array(z.number().int().min(0).max(6)).min(3).max(7),
});

/**
 * POST /plan
 * Create or update the user's fitness plan (upsert)
 */
router.post("/", async (req: AuthRequest, res, next) => {
    try {
        if (!req.user) return res.status(401).json({ message: "Unauthorized" });

        const data = createPlanSchema.parse(req.body);

        const plan = await prisma.userPlan.upsert({
            where: { userId: req.user.id },
            create: {
                userId: req.user.id,
                weightKg: data.weightKg,
                heightCm: data.heightCm,
                ageYears: data.ageYears,
                goalType: data.goalType,
                targetWeightKg: data.targetWeightKg ?? null,
                weightToLoseKg: data.weightToLoseKg ?? null,
                timeHorizon: data.timeHorizon ?? null,
                targetDate: data.targetDate ? new Date(data.targetDate) : null,
                activityPreference: data.activityPreference ?? null,
                intensityLevel: data.intensityLevel,
                availableDays: data.availableDays ?? undefined,
                dailyCalorieTarget: data.dailyCalorieTarget ?? null,
                dailyActivityMins: data.dailyActivityMins ?? null,

                runGoal: data.runGoal ?? null,
                runExperience: data.runExperience ?? null,
                runDietFocus: data.runDietFocus ?? null,
                runPriority: data.runPriority ?? null,
                runRaceDate: data.runRaceDate ? new Date(data.runRaceDate) : null,
                hasRaceGoal: data.hasRaceGoal ?? null,

                bodyType: data.bodyType ?? null,
                trainingStyle: data.trainingStyle ?? null,
            },
            update: {
                weightKg: data.weightKg,
                heightCm: data.heightCm,
                ageYears: data.ageYears,
                goalType: data.goalType,
                targetWeightKg: data.targetWeightKg ?? null,
                weightToLoseKg: data.weightToLoseKg ?? null,
                timeHorizon: data.timeHorizon ?? null,
                targetDate: data.targetDate ? new Date(data.targetDate) : null,
                activityPreference: data.activityPreference ?? null,
                intensityLevel: data.intensityLevel,
                availableDays: data.availableDays ?? undefined,
                dailyCalorieTarget: data.dailyCalorieTarget ?? null,
                dailyActivityMins: data.dailyActivityMins ?? null,

                runGoal: data.runGoal ?? null,
                runExperience: data.runExperience ?? null,
                runDietFocus: data.runDietFocus ?? null,
                runPriority: data.runPriority ?? null,
                runRaceDate: data.runRaceDate ? new Date(data.runRaceDate) : null,
                hasRaceGoal: data.hasRaceGoal ?? null,

                bodyType: data.bodyType ?? null,
                trainingStyle: data.trainingStyle ?? null,
            },
        });

        // Sync user-level fields used by plan generation.
        const isNewPlan = plan.createdAt.getTime() === plan.updatedAt.getTime();
        const userUpdateData: Record<string, number> = {};
        if (isNewPlan) {
            userUpdateData.weightKg = data.weightKg;
        }
        if (typeof data.baselinePaceSecPerKm === "number" && Number.isFinite(data.baselinePaceSecPerKm)) {
            userUpdateData.baselinePaceSecPerKm = data.baselinePaceSecPerKm;
        }

        if (Object.keys(userUpdateData).length > 0) {
            await prisma.user.update({
                where: { id: req.user.id },
                data: userUpdateData,
            });
        }

        return res
            .status(isNewPlan ? 201 : 200)
            .json({ plan: presentPlan(plan) });
    } catch (err) {
        return next(err);
    }
});

/**
 * GET /plan
 * Get the current user's fitness plan
 */
router.get("/", async (req: AuthRequest, res, next) => {
    try {
        if (!req.user) return res.status(401).json({ message: "Unauthorized" });

        const plan = await prisma.userPlan.findUnique({
            where: { userId: req.user.id },
        });

        if (!plan) return res.status(404).json({ message: "No plan found" });

        return res.json({ plan: presentPlan(plan) });
    } catch (err) {
        return next(err);
    }
});

/**
 * PATCH /plan/schedule-days
 * Update only the user's preferred training days
 */
router.patch("/schedule-days", async (req: AuthRequest, res, next) => {
    try {
        if (!req.user) return res.status(401).json({ message: "Unauthorized" });
        const userId = req.user.id;

        const { availableDays } = updateScheduleDaysSchema.parse(req.body);

        const plan = await prisma.$transaction(async (tx) => {
            const updatedPlan = await tx.userPlan.update({
                where: { userId },
                data: { availableDays },
                include: {
                    weeklyPlans: { orderBy: { week: "asc" } },
                },
            });

            for (const weekPlan of updatedPlan.weeklyPlans) {
                await tx.dailyTarget.deleteMany({
                    where: { weekPlanId: weekPlan.id },
                });

                const dailyTargets = generateDailyTargets(
                    weekPlan,
                    (weekPlan.weekDailys as WeekDailysInput | null) ?? null,
                    availableDays
                );

                if (dailyTargets.length > 0) {
                    await tx.dailyTarget.createMany({ data: dailyTargets });
                }
            }

            return updatedPlan;
        });

        return res.json({ plan: presentPlan(plan) });
    } catch (err) {
        return next(err);
    }
});

/**
 * JSON Schema for the weekly plan output (UPDATED)
 * Root object: { "Weekly Plan Table": [ ... ] }
 * Each item includes "Week Dailys"
 */
const WeeklyPlanOutputSchema = {
    name: "WeeklyFitnessPlanV2",
    schema: {
        type: "object",
        additionalProperties: false,
        properties: {
            "Weekly Plan Table": {
                type: "array",
                items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                        Week: { type: "integer" },
                        "Calories/day": { type: "integer" },
                        "Protein/day": { type: "integer" },
                        "Steps/day target": { type: "integer" },
                        "Run km/week": { type: "number" },
                        "Expected weight": { type: "number" },
                        "Week name": { type: "string" },

                        "Week Dailys": {
                            type: "object",
                            additionalProperties: false,
                            properties: {
                                stepDays: { type: "integer" },
                                runDays: { type: "integer" },
                                recoveryDays: { type: "integer" },
                                runs: {
                                    type: "array",
                                    items: {
                                        type: "object",
                                        additionalProperties: false,
                                        properties: {
                                            runType: {
                                                type: "string",
                                                enum: [
                                                    "Easy Run",
                                                    "Recovery Run",
                                                    "Long Run",
                                                    "Steady Run",
                                                    "Tempo Run",
                                                    "Interval Run",
                                                    "Interval Walk",
                                                    "Fartlek Run",
                                                    "Hill Run",
                                                    "Run–Walk",
                                                    "Progression Run",
                                                    "Time Trial",
                                                    "Power Walk",
                                                    "Long Walk",
                                                    "Incline Walk",
                                                    "Recovery Walk",
                                                ],
                                            },
                                            sessions: { type: "integer" },
                                        },
                                        required: ["runType", "sessions"],
                                    },
                                },
                            },
                            required: ["stepDays", "runDays", "recoveryDays", "runs"],
                        },
                    },
                    required: [
                        "Week",
                        "Calories/day",
                        "Protein/day",
                        "Steps/day target",
                        "Run km/week",
                        "Expected weight",
                        "Week name",
                        "Week Dailys",
                    ],
                },
            },
        },
        required: ["Weekly Plan Table"],
    },
};

/**
 * GET /plan/weekly
 * Get the saved weekly plans (if they exist)
 *
 * Response shape (UPDATED):
 * { "Weekly Plan Table": [ ... ] }
 */
router.get("/weekly", async (req: AuthRequest, res, next) => {
    try {
        if (!req.user) return res.status(401).json({ message: "Unauthorized" });

        const plan = await prisma.userPlan.findUnique({
            where: { userId: req.user.id },
            include: { weeklyPlans: { orderBy: { week: "asc" } } },
        });

        if (!plan) return res.status(404).json({ message: "No plan found" });

        if (plan.weeklyPlans.length === 0) {
            return res.status(404).json({ message: "No weekly plans generated yet", needsGeneration: true });
        }

        const table = plan.weeklyPlans.map((w) => ({
            Week: w.week,
            "Calories/day": w.caloriesPerDay,
            "Protein/day": w.proteinPerDay,
            "Steps/day target": w.stepsPerDay,
            "Run km/week": w.runKmPerWeek,
            "Expected weight": w.expectedWeight,
            "Week name": w.weekName,
            "Week Dailys": (w.weekDailys as any) ?? {
                stepDays: 0,
                runDays: 0,
                recoveryDays: 0,
                runs: [],
            },
        }));

        return res.json({ "Weekly Plan Table": table });
    } catch (err) {
        return next(err);
    }
});

/**
 * GET /plan/partner/weekly
 * Get the connected partner's saved weekly plans alongside their base plan
 *
 * Response shape:
 * { plan: { ... }, "Weekly Plan Table": [ ... ] }
 */
router.get("/partner/weekly", async (req: AuthRequest, res, next) => {
    try {
        if (!req.user) return res.status(401).json({ message: "Unauthorized" });

        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { partnerId: true },
        });

        if (!user?.partnerId) {
            return res.status(404).json({ message: "No partner connected" });
        }

        const partnerPlan = await prisma.userPlan.findUnique({
            where: { userId: user.partnerId },
            include: { weeklyPlans: { orderBy: { week: "asc" } } },
        });

        if (!partnerPlan) {
            return res.status(404).json({ message: "Partner has no plan yet" });
        }

        const table = partnerPlan.weeklyPlans.map((w) => ({
            Week: w.week,
            "Calories/day": w.caloriesPerDay,
            "Protein/day": w.proteinPerDay,
            "Steps/day target": w.stepsPerDay,
            "Run km/week": w.runKmPerWeek,
            "Expected weight": w.expectedWeight,
            "Week name": w.weekName,
            "Week Dailys": (w.weekDailys as any) ?? {
                stepDays: 0,
                runDays: 0,
                recoveryDays: 0,
                runs: [],
            },
        }));

        return res.json({
            plan: presentPlan(partnerPlan),
            "Weekly Plan Table": table,
        });
    } catch (err) {
        return next(err);
    }
});

/**
 * POST /plan/generate-weekly
 * Generate a weekly fitness plan using OpenAI based on user's plan data
 * Query param: ?force=true to regenerate even if plans exist
 *
 * Response shape (UPDATED):
 * { "Weekly Plan Table": [ ... ], cached: boolean }
 */
router.post("/generate-weekly", async (req: AuthRequest, res, next) => {
    try {
        if (!req.user) return res.status(401).json({ message: "Unauthorized" });

        const forceRegenerate = req.query.force === "true";

        // Get user's plan with existing weekly plans
        const plan = await prisma.userPlan.findUnique({
            where: { userId: req.user.id },
            include: {
                user: { select: { gender: true, heightFt: true, heightIn: true } },
                weeklyPlans: { orderBy: { week: "asc" } },
            },
        });

        if (!plan) {
            return res.status(404).json({ message: "No plan found. Please complete the onboarding first." });
        }

        // Return cached if exists and not forcing regeneration
        if (plan.weeklyPlans.length > 0 && !forceRegenerate) {
            const table = plan.weeklyPlans.map((w) => ({
                Week: w.week,
                "Calories/day": w.caloriesPerDay,
                "Protein/day": w.proteinPerDay,
                "Steps/day target": w.stepsPerDay,
                "Run km/week": w.runKmPerWeek,
                "Expected weight": w.expectedWeight,
                "Week name": w.weekName,
                "Week Dailys": (w.weekDailys as any) ?? { stepDays: 0, runDays: 0, recoveryDays: 0, runs: [] },
            }));

            return res.json({ "Weekly Plan Table": table, cached: true });
        }

        // Calculate number of weeks based on goal
        let numberOfWeeks = 8; // Default
        if (plan.targetDate) {
            const now = new Date();
            const diffTime = Math.abs(plan.targetDate.getTime() - now.getTime());
            numberOfWeeks = Math.max(4, Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7)));
        } else if (plan.weightToLoseKg) {
            numberOfWeeks = Math.max(4, Math.ceil(plan.weightToLoseKg / 0.75));
        } else if (plan.timeHorizon) {
            const horizonWeeks: Record<string, number> = {
                RELAXED: 12,
                STANDARD: 8,
                AGGRESSIVE: 6,
            };
            numberOfWeeks = horizonWeeks[plan.timeHorizon] || 8;
        }

        const hasHeightCm = plan.heightCm !== null && plan.heightCm !== undefined;
        const hasHeightFtIn = plan.user?.heightFt !== null && plan.user?.heightFt !== undefined
            && plan.user?.heightIn !== null && plan.user?.heightIn !== undefined;
        const heightText = hasHeightCm
            ? `${plan.heightCm} cm`
            : hasHeightFtIn
                ? `${plan.user.heightFt} ft ${plan.user.heightIn} in`
                : "unknown";
        const normalizedAvailableDays = normalizeAvailableDays(plan.availableDays);
        const availableDayLabels = normalizedAvailableDays.map((day) => DAY_LABELS[day]).join(", ");

        // Build the NEW prompt
        const prompt = `You are a fitness planning assistant.

Create a structured fat-loss + running plan in JSON format only with the following exact columns and order:

Weekly Plan Table (Calories / Food / Steps / Running / Expected Weight)
Week | Calories/day | Protein/day | Steps/day target | Run km/week | Expected weight | Week name | Week Dailys

User details
Gender: ${plan.user.gender || "unknown"}
Height: ${heightText}
Weight: ${plan.weightKg} kg
Age: ${plan.ageYears} years
Goal type: ${plan.goalType}
Activity preference: ${plan.activityPreference || "WALKING_RUNNING"}
Intensity level: ${plan.intensityLevel}
Available training days: ${availableDayLabels || "not specified"}

Timeline: ${plan.targetWeightKg
                ? `Target weight: ${plan.targetWeightKg}kg`
                : plan.weightToLoseKg
                    ? `Weight to lose: ${plan.weightToLoseKg}kg`
                    : plan.targetDate
                        ? `Target date: ${plan.targetDate.toISOString().split("T")[0]}`
                        : `or whatever is best optimal`
            }

Number of weeks to generate: If target date is viable othewise best suited (Best for ${plan.timeHorizon || "STANDARD"}). Make sure to make goal weight realistic.

Planning rules
Protein must be appropriate for the user’s weight and goal (typically 1.6–2.2 g per kg bodyweight)
Calories, steps, and run volume must start manageable and progress gradually. Make sure they are realisitic not too low or high and sustainable.
Running structure must be optimized for fat loss and running readiness
Do not use ranges anywhere
Do not include emojis or commentary inside values

Expected weight calculation
Expected weight must be a number
Start from current weight (${plan.weightKg}kg)
Decrease gradually each week
Use realistic fat-loss assumptions based on calorie deficit and activity

Week Dailys structure (mandatory)
Week Dailys must be a nested object with the following keys:
stepDays (number)
runDays (number)
recoveryDays (number)
runs (array)

Each item in runs must be an object with:
runType
sessions

Scheduling constraints:
Run sessions must fit within these available training days only: ${availableDayLabels || "not specified"}
runDays must not exceed the number of available training days (${normalizedAvailableDays.length || 0})

If more than one run type is used in a week, each run type must be a separate object in the runs array.

Allowed runType values (use only these), if the ${plan.activityPreference || "WALKING_RUNNING"} is walking then strictly only give walking, and it according to user details, Also Interval Run should be definietly first run should be part if running is preference:

Power Walk
Interval Walk
Long Walk
Incline Walk
Recovery Walk

Additional constraints for Week Dailys:
stepDays + runDays + recoveryDays must equal 7
runs.sessions must sum to runDays

Output requirements
Output JSON only
Output exactly one object
No explanations before or after
Keep wording concise and consistent
No ranges anywhere
Expected weight must be numeric only`;

        const aiInput = [{ role: "user" as const, content: [{ type: "input_text" as const, text: prompt }] }];
        const debugAiRequest = process.env.NODE_ENV !== "production"
            ? {
                generatedAt: new Date().toISOString(),
                model: "gpt-5-nano-2025-08-07",
                store: false,
                input: aiInput,
                resolvedValues: {
                    gender: plan.user.gender || "unknown",
                    height: heightText,
                    weightKg: plan.weightKg,
                    ageYears: plan.ageYears,
                    goalType: plan.goalType,
                    activityPreference: plan.activityPreference || "WALKING_RUNNING",
                    intensityLevel: plan.intensityLevel,
                    numberOfWeeks,
                },
                prompt,
            }
            : undefined;

        const resp = await openai.responses.create({
            model: "gpt-5-nano-2025-08-07",
            store: false,
            input: aiInput,
            text: {
                format: {
                    type: "json_schema",
                    ...WeeklyPlanOutputSchema,
                    strict: true,
                },
            },
        });

        const json = JSON.parse(resp.output_text ?? '{"Weekly Plan Table": []}');
        const table = json["Weekly Plan Table"] || [];

        // Replace weekly plans in DB and generate daily targets
        const createdWeekPlans = await prisma.$transaction(async (tx) => {
            // Delete old weekly plans (cascade deletes daily targets)
            await tx.generatedWeekPlan.deleteMany({
                where: { userPlanId: plan.id },
            });

            // Create new weekly plans
            const weekPlans = [];
            for (const w of table) {
                const weekPlan = await tx.generatedWeekPlan.create({
                    data: {
                        userPlanId: plan.id,
                        week: w.Week,
                        caloriesPerDay: w["Calories/day"],
                        proteinPerDay: w["Protein/day"],
                        stepsPerDay: w["Steps/day target"],
                        runKmPerWeek: w["Run km/week"],
                        expectedWeight: w["Expected weight"],
                        weekName: w["Week name"],
                        weekDailys: w["Week Dailys"],
                    },
                });

                // Generate daily targets for this week
                const dailyTargets = generateDailyTargets(weekPlan, w["Week Dailys"], normalizedAvailableDays);
                if (dailyTargets.length > 0) {
                    await tx.dailyTarget.createMany({ data: dailyTargets });
                }

                weekPlans.push(weekPlan);
            }
            return weekPlans;
        });

        // Reset currentWeek to 1 when new plan is generated
        await prisma.userPlan.update({
            where: { userId: req.user!.id },
            data: {
                currentWeek: 1,
                weekStartedAt: new Date()
            }
        });

        return res.json({
            "Weekly Plan Table": table,
            cached: false,
            ...(debugAiRequest ? { debugAiRequest } : {}),
        });
    } catch (err) {
        return next(err);
    }
});

// ============ DAILY TARGETS ALGORITHM ============

interface WeekDailysInput {
    stepDays: number;
    runDays: number;
    recoveryDays: number;
    runs: Array<{ runType: string; sessions: number }>;
}

const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

// Weight for distributing weekly run km across different run types
const RUN_KM_WEIGHTS: Record<string, number> = {
    "Long Run": 0.40,
    "Tempo Run": 0.22,
    "Steady Run": 0.18,
    "Progression Run": 0.20,
    "Easy Run": 0.12,
    "Recovery Run": 0.08,
    "Run–Walk": 0.10,
    "Interval Run": 0.15,
    "Fartlek Run": 0.15,
    "Hill Run": 0.18,
    "Time Trial": 0.25,
    "Power Walk": 0.06,
    "Interval Walk": 0.07,
    "Long Walk": 0.08,
    "Incline Walk": 0.06,
    "Recovery Walk": 0.04,
};

type DayType = "STEP" | "RUN" | "RECOVERY";

interface DailyTargetData {
    weekPlanId: string;
    dayOfWeek: number;
    dayType: DayType;
    calorieTarget: number;
    proteinTarget: number;
    stepsTarget: number;
    runKm: number;
    runType: string | null;
    morningSteps: number;
    eveningSteps: number;
    nightSteps: number;
}

function generateDailyTargets(
    weekPlan: { id: string; caloriesPerDay: number; proteinPerDay: number; stepsPerDay: number; runKmPerWeek: number },
    weekDailys: WeekDailysInput | null,
    availableDays?: number[] | null
): DailyTargetData[] {
    const defaults: WeekDailysInput = { stepDays: 5, runDays: 2, recoveryDays: 0, runs: [] };
    const wd = weekDailys || defaults;
    const normalizedAvailableDays = normalizeAvailableDays(availableDays);
    const useAvailability = normalizedAvailableDays.length > 0;

    // Build run queue with km allocated
    const runQueue = distributeRunKm(wd.runs, weekPlan.runKmPerWeek);

    // Initialize all 7 days as STEP
    const days: DailyTargetData[] = Array.from({ length: 7 }, (_, i) => ({
        weekPlanId: weekPlan.id,
        dayOfWeek: i,
        dayType: "STEP" as DayType,
        calorieTarget: weekPlan.caloriesPerDay,
        proteinTarget: weekPlan.proteinPerDay,
        stepsTarget: weekPlan.stepsPerDay,
        runKm: 0,
        runType: null,
        morningSteps: 0,
        eveningSteps: 0,
        nightSteps: 0,
    }));

    let recoveryLeft = wd.recoveryDays;

    if (!useAvailability) {
        // Legacy fallback behavior for older plans without stored availability.
        if (recoveryLeft > 0) {
            days[6].dayType = "RECOVERY";
            days[6].stepsTarget = Math.round(weekPlan.stepsPerDay * 0.3);
            recoveryLeft--;
        }

        const longRunIdx = runQueue.findIndex((r) => r.runType === "Long Run");
        if (longRunIdx !== -1) {
            const longRun = runQueue.splice(longRunIdx, 1)[0];
            assignRunToDay(days, 5, longRun, weekPlan.stepsPerDay);
        }

        for (const dayIdx of [1, 3]) {
            if (runQueue.length > 0 && days[dayIdx].dayType === "STEP") {
                assignRunToDay(days, dayIdx, runQueue.shift()!, weekPlan.stepsPerDay);
            }
        }

        for (const dayIdx of [0, 2, 4]) {
            if (runQueue.length > 0 && days[dayIdx].dayType === "STEP") {
                assignRunToDay(days, dayIdx, runQueue.shift()!, weekPlan.stepsPerDay);
            }
        }

        for (let i = 0; i < 7 && recoveryLeft > 0; i++) {
            if (days[i].dayType === "STEP") {
                assignRecoveryToDay(days, i, weekPlan.stepsPerDay);
                recoveryLeft--;
            }
        }
    } else {
        const longRunIdx = runQueue.findIndex((r) => r.runType === "Long Run");
        const preferredRunDays = getPreferredRunDays(normalizedAvailableDays);
        const placedRunDays = new Set<number>();

        if (longRunIdx !== -1 && preferredRunDays.length > 0) {
            const longRun = runQueue.splice(longRunIdx, 1)[0];
            const longRunDay = preferredRunDays[0];
            assignRunToDay(days, longRunDay, longRun, weekPlan.stepsPerDay);
            placedRunDays.add(longRunDay);
        }

        const remainingRunDays = preferredRunDays.filter((day) => !placedRunDays.has(day));
        if (wd.runDays > normalizedAvailableDays.length) {
            console.warn(
                `[plan] week ${("week" in weekPlan ? (weekPlan as any).week : "unknown")} runDays (${wd.runDays}) exceed availableDays (${normalizedAvailableDays.length}); capping to selected days only.`
            );
        }

        for (const dayIdx of remainingRunDays) {
            if (runQueue.length === 0) break;
            assignRunToDay(days, dayIdx, runQueue.shift()!, weekPlan.stepsPerDay);
            placedRunDays.add(dayIdx);
        }

        const recoveryCandidates = getRecoveryDays(days, normalizedAvailableDays);
        for (const dayIdx of recoveryCandidates) {
            if (recoveryLeft === 0) break;
            if (days[dayIdx].dayType === "STEP") {
                assignRecoveryToDay(days, dayIdx, weekPlan.stepsPerDay);
                recoveryLeft--;
            }
        }
    }

    // Phase 6: Calculate time-of-day splits
    for (const day of days) {
        const splits = getTimeOfDaySplits(day.dayType, day.stepsTarget);
        day.morningSteps = splits.morning;
        day.eveningSteps = splits.afternoon;
        day.nightSteps = splits.evening;
    }

    return days;
}

function normalizeAvailableDays(value: unknown): number[] {
    if (!Array.isArray(value)) return [];
    return Array.from(
        new Set(
            value
                .map((day) => Number(day))
                .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
        )
    ).sort((a, b) => a - b);
}

function getPreferredRunDays(availableDays: number[]): number[] {
    const preferredWeekend = [5, 6].filter((day) => availableDays.includes(day));
    const weekdays = availableDays.filter((day) => day !== 5 && day !== 6);

    if (weekdays.length <= 1) return [...preferredWeekend, ...weekdays];

    const remaining = [...weekdays];
    const ordered: number[] = [];
    ordered.push(remaining.shift()!);

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
}

function getRecoveryDays(days: DailyTargetData[], availableDays: number[]): number[] {
    const nonSelected = Array.from({ length: 7 }, (_, day) => day).filter((day) => !availableDays.includes(day));
    const selected = availableDays.filter((day) => days[day].dayType === "STEP");
    return [...nonSelected, ...selected];
}

function assignRunToDay(days: DailyTargetData[], dayIdx: number, run: { runType: string; km: number }, baseSteps: number) {
    days[dayIdx].dayType = "RUN";
    days[dayIdx].runType = run.runType;
    days[dayIdx].runKm = run.km;
    days[dayIdx].stepsTarget = Math.round(baseSteps * 0.4);
}

function assignRecoveryToDay(days: DailyTargetData[], dayIdx: number, baseSteps: number) {
    days[dayIdx].dayType = "RECOVERY";
    days[dayIdx].stepsTarget = Math.round(baseSteps * 0.3);
}

function distributeRunKm(runs: Array<{ runType: string; sessions: number }>, totalKm: number): Array<{ runType: string; km: number }> {
    if (!runs || runs.length === 0 || totalKm <= 0) return [];

    // Flatten runs and calculate total weight
    const flatRuns: { runType: string; weight: number }[] = [];
    let totalWeight = 0;

    for (const r of runs) {
        // Normalize run type (handle hyphen vs en-dash)
        const normalizedType = r.runType.replace(/-/g, "–");
        const weight = RUN_KM_WEIGHTS[normalizedType] || RUN_KM_WEIGHTS[r.runType] || 0.15;
        for (let i = 0; i < r.sessions; i++) {
            flatRuns.push({ runType: r.runType, weight });
            totalWeight += weight;
        }
    }

    // Distribute km proportionally, use floor to avoid exceeding total
    const result = flatRuns.map((r) => ({
        runType: r.runType,
        km: Math.floor((r.weight / totalWeight) * totalKm * 10) / 10,
    }));

    // Calculate distributed total and add remainder to longest run (usually first)
    const distributedTotal = result.reduce((sum, r) => sum + r.km, 0);
    const remainder = Math.round((totalKm - distributedTotal) * 10) / 10;

    if (remainder > 0 && result.length > 0) {
        // Add remainder to first run (or could find the one with highest weight)
        result[0].km = Math.round((result[0].km + remainder) * 10) / 10;
    }

    return result;
}

function getTimeOfDaySplits(dayType: DayType, totalSteps: number): { morning: number; afternoon: number; evening: number } {
    switch (dayType) {
        case "STEP":
            return {
                morning: Math.round(totalSteps * 0.35),
                afternoon: Math.round(totalSteps * 0.45),
                evening: Math.round(totalSteps * 0.20),
            };
        case "RUN":
            // Less steps on run days, distributed around run
            return {
                morning: Math.round(totalSteps * 0.25),
                afternoon: Math.round(totalSteps * 0.50),
                evening: Math.round(totalSteps * 0.25),
            };
        case "RECOVERY":
            return {
                morning: Math.round(totalSteps * 0.40),
                afternoon: Math.round(totalSteps * 0.40),
                evening: Math.round(totalSteps * 0.20),
            };
    }
}

/**
 * GET /plan/daily/:weekNumber
 * Get daily targets for a specific week
 */
router.get("/daily/:weekNumber", async (req: AuthRequest, res, next) => {
    try {
        if (!req.user) return res.status(401).json({ message: "Unauthorized" });

        const weekNumber = parseInt(req.params.weekNumber, 10);
        if (isNaN(weekNumber) || weekNumber < 1) {
            return res.status(400).json({ message: "Invalid week number" });
        }

        const plan = await prisma.userPlan.findUnique({
            where: { userId: req.user.id },
            include: {
                weeklyPlans: {
                    where: { week: weekNumber },
                    include: { dailyTargets: { orderBy: { dayOfWeek: "asc" } } },
                },
            },
        });

        if (!plan) return res.status(404).json({ message: "No plan found" });
        if (plan.weeklyPlans.length === 0) {
            return res.status(404).json({ message: `Week ${weekNumber} not found` });
        }

        const weekPlan = plan.weeklyPlans[0];
        const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

        const days = weekPlan.dailyTargets.map((d) => ({
            dayOfWeek: d.dayOfWeek,
            dayName: dayNames[d.dayOfWeek],
            dayType: d.dayType,
            calorieTarget: d.calorieTarget,
            proteinTarget: d.proteinTarget,
            stepsTarget: d.stepsTarget,
            runKm: d.runKm,
            runType: d.runType,
            timeSlots: {
                morning: { steps: d.morningSteps },
                afternoon: { steps: d.eveningSteps },
                evening: { steps: d.nightSteps },
            },
        }));

        return res.json({
            weekNumber,
            weekName: weekPlan.weekName,
            days,
        });
    } catch (err) {
        return next(err);
    }
});

export default router;
