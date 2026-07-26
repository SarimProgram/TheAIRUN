// src/routes/plan.routes.ts
import { Router } from "express";
import { z } from "zod";
import OpenAI from "openai";
import prisma from "../db/prisma";
import { AuthRequest } from "../middleware/auth";
import { presentPlan } from "./presenters";
import { requireStringParam } from "../utils/params";

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const GOAL_PRACTICE_RUN_TYPE = "Goal Practice Run";

const createPlanSchema = z.object({
    weightKg: z.number().positive(),
    heightCm: z.coerce.number().int().positive(),
    ageYears: z.coerce.number().int().positive().max(120),
    goalType: z.enum(["weightloss", "running", "both"]),
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
                                                    "Walk",
                                                    "Free Run",
                                                    "Goal Practice Run",
                                                    "Long Walk",
                                                    "Incline Walk",
                                                    "Recovery Walk",
                                                ],
                                            },
                                            sessions: { type: "integer" },
                                            targetKm: {
                                                anyOf: [
                                                    { type: "number" },
                                                    { type: "null" },
                                                ],
                                            },
                                        },
                                        required: ["runType", "sessions", "targetKm"],
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

function getRecommendedRunningWeeks(
    runGoal: string | null | undefined,
    runExperience: string | null | undefined
): number {
    const goal = runGoal || "5k";
    const experience = runExperience || "beginner";

    const baseWeeksByGoal: Record<string, number> = {
        "5k": 6,
        "10k": 8,
        halfMarathon: 12,
        speedImprovement: 6,
    };

    const experienceAdjustment: Record<string, number> = {
        beginner: 2,
        intermediate: 0,
        advanced: -1,
    };

    const baseWeeks = baseWeeksByGoal[goal] ?? 8;
    const adjustedWeeks = baseWeeks + (experienceAdjustment[experience] ?? 0);
    return Math.max(4, adjustedWeeks);
}

function buildWeeklyPlanPromptData(plan: {
    user: { gender: string | null; heightFt: number | null; heightIn: number | null; goalType: string | null } | null;
    heightCm: number | null;
    weightKg: number;
    ageYears: number;
    goalType: string;
    runGoal: string | null;
    runExperience: string | null;
    runDietFocus: string | null;
    targetDate: Date | null;
    runRaceDate: Date | null;
    timeHorizon: string | null;
    targetWeightKg: number | null;
    weightToLoseKg: number | null;
    trainingStyle: string | null;
    activityPreference: string | null;
    intensityLevel: string;
    availableDays: unknown;
}) {
    const isRunningOnlyPlan = (plan.user?.goalType || plan.goalType) === "running";
    const minWeeks = isRunningOnlyPlan
        ? getRecommendedRunningWeeks(plan.runGoal, plan.runExperience)
        : 8;
    const startOfWeek = (date: Date) => {
        const next = new Date(date);
        const day = (next.getDay() + 6) % 7;
        next.setDate(next.getDate() - day);
        next.setHours(0, 0, 0, 0);
        return next;
    };
    const endOfWeek = (date: Date) => {
        const next = startOfWeek(date);
        next.setDate(next.getDate() + 6);
        next.setHours(23, 59, 59, 999);
        return next;
    };
    const getInclusiveWeekCountToTarget = (targetDate: Date) => {
        const now = new Date();
        if (targetDate.getTime() <= now.getTime()) {
            return 1;
        }

        const targetWeekEnd = endOfWeek(targetDate);
        const diffMs = targetWeekEnd.getTime() - now.getTime();
        return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 7)));
    };

    let numberOfWeeks = minWeeks;
    let targetDeadlineWeeks: number | null = null;
    if (isRunningOnlyPlan && plan.runRaceDate) {
        targetDeadlineWeeks = getInclusiveWeekCountToTarget(plan.runRaceDate);
        numberOfWeeks = Math.max(minWeeks, targetDeadlineWeeks);
    } else if (plan.targetDate) {
        targetDeadlineWeeks = getInclusiveWeekCountToTarget(plan.targetDate);
        numberOfWeeks = Math.max(minWeeks, targetDeadlineWeeks);
    } else if (plan.weightToLoseKg) {
        numberOfWeeks = Math.max(minWeeks, Math.ceil(plan.weightToLoseKg / 2));
    } else if (plan.timeHorizon) {
        const horizonWeeks: Record<string, number> = {
            RELAXED: isRunningOnlyPlan ? minWeeks + 4 : 12,
            STANDARD: isRunningOnlyPlan ? minWeeks + 2 : 8,
            AGGRESSIVE: isRunningOnlyPlan ? minWeeks : 6,
        };
        numberOfWeeks = Math.max(minWeeks, horizonWeeks[plan.timeHorizon] || 8);
    }

    const hasHeightCm = plan.heightCm !== null && plan.heightCm !== undefined;
    const hasHeightFtIn = plan.user?.heightFt !== null && plan.user?.heightFt !== undefined
        && plan.user?.heightIn !== null && plan.user?.heightIn !== undefined;
    const heightFt = hasHeightFtIn ? plan.user?.heightFt ?? null : null;
    const heightIn = hasHeightFtIn ? plan.user?.heightIn ?? null : null;
    const heightMeters = hasHeightCm
        ? plan.heightCm! / 100
        : hasHeightFtIn
            ? (((((heightFt ?? 0) * 12) + (heightIn ?? 0)) * 2.54) / 100)
            : null;
    const heightText = hasHeightCm
        ? `${plan.heightCm} cm`
        : hasHeightFtIn
            ? `${heightFt} ft ${heightIn} in`
            : "unknown";
    const bmi = heightMeters && heightMeters > 0
        ? Number((plan.weightKg / (heightMeters * heightMeters)).toFixed(1))
        : null;
    const normalizedAvailableDays = normalizeAvailableDays(plan.availableDays);
    const availableDayLabels = normalizedAvailableDays.map((day) => DAY_LABELS[day]).join(", ");
    const derivedWeightToLoseKg = plan.targetWeightKg !== null && plan.targetWeightKg !== undefined
        ? Math.max(0, Number((plan.weightKg - plan.targetWeightKg).toFixed(1)))
        : (plan.weightToLoseKg !== null && plan.weightToLoseKg !== undefined ? plan.weightToLoseKg : null);
    const requiredWeeklyLossKg = plan.targetDate && derivedWeightToLoseKg !== null && derivedWeightToLoseKg > 0
        ? Number((derivedWeightToLoseKg / (targetDeadlineWeeks ?? numberOfWeeks)).toFixed(2))
        : null;

    const prompt = plan.user?.goalType === "running"
        ? `You are a running plan assistant.

Create a structured running plan in JSON format only with the following exact columns and order:

Weekly Plan Table (Calories / Food / Steps / Running / Expected Weight)
Week | Calories/day | Protein/day | Steps/day target | Run km/week | Expected weight | Week name | Week Dailys

User details
Gender: ${plan.user.gender || "unknown"}
Height: ${heightText}
Weight: ${plan.weightKg} kg
BMI: ${bmi ?? "unknown"}
Age: ${plan.ageYears} years
Run goal: ${plan.runGoal || "not specified"}
Run experience: ${plan.runExperience || "not specified"}
Run diet focus: ${plan.runDietFocus || "not specified"}
Available training days: ${availableDayLabels || "not specified"}

Timeline: ${plan.runRaceDate
            ? `Race date: ${plan.runRaceDate.toISOString().split("T")[0]}`
            : plan.targetDate
                ? `Target date: ${plan.targetDate.toISOString().split("T")[0]}`
                : `Best suited for ${plan.timeHorizon || "STANDARD"}`}

Number of weeks to generate: ${numberOfWeeks}
If target date falls in the middle of a week, include that full week as the final week.

Planning goal
This is a running-specific plan.
Build the plan around the user's run goal as the primary baseline for preparation.
If run goal is 5k, prepare specifically for 5k demands.
If run goal is 10k, prepare specifically for 10k demands.
If run goal is half marathon, prepare specifically for half marathon demands.
Run experience must strongly shape the starting volume, progression speed, session difficulty, and recovery needs.
Beginner experience must start more conservatively.
Intermediate experience can progress moderately.
Advanced experience can handle more structured progression when appropriate.
Calories/day and overall training load must be guided by runDietFocus.
Use runDietFocus as the main driver when deciding calorie level and training support.
BMI should also be considered when deciding calorie level, expected weight trend, progression speed, and how aggressive or conservative the plan should be.
Do not explicitly explain why calories are higher or lower.
Do not mention deficit, surplus, cut, maintenance, increase, or decrease in the output.
Protein/day must be appropriate for the user's body weight and running load.
Steps, calories, and run volume must be realistic, progressive, and sustainable.
Do not use ranges anywhere.
Do not include emojis or commentary inside values.

Expected weight calculation
Expected weight must be a number.
Start from current weight (${plan.weightKg}kg).
For a running plan, expected weight should usually stay stable or change only gradually and realistically.
Do not treat expected weight as a fat-loss target unless runDietFocus clearly supports that direction.
Expected weight must always remain numeric only.

Run structure rules
Run km/week must reflect a realistic progression based on:
the user's run goal,
the user's run experience,
the available training days,
and recovery capacity.
Start manageable.
Increase gradually.
Use lighter weeks when appropriate.
Do not increase run volume too aggressively.
The plan must feel specific to the selected run goal, not generic.

Week Dailys structure (mandatory)
Week Dailys must be a nested object with the following keys:
stepDays (number)
runDays (number)
recoveryDays (number)
runs (array)

Each item in runs must be an object with:
runType
sessions

Scheduling constraints
Run sessions must fit within these available training days only: ${availableDayLabels || "not specified"}
runDays must not exceed the number of available training days (${normalizedAvailableDays.length || 0})

If more than one run type is used in a week, each run type must be a separate object in the runs array.

Allowed runType values
Use only these values:
Interval Run
Easy Run
Long Run
Walk
Free Run
Goal Practice Run

Run type guidance
Interval Run should be listed first in the runs array when used.
IntervalRun should be the foundation of most weeks.
Long Run should be included when appropriate for the user's run goal and experience.
For 5k plans, emphasize consistency, aerobic support, and controlled speed development.
For 10k plans, balance aerobic volume with moderate quality work.
For half marathon plans, place greater emphasis on aerobic development and long-run progression.
Walk can be used for recovery or lower-impact support when appropriate.
Free Run can be used sparingly when it fits the user's level and week structure.
Goal Practice Run can be used sparingly in the final weeks when race-specific distance rehearsal is appropriate.
For half marathon plans, do not include a half-marathon-distance practice run in short plans.
For half marathon plans shorter than 12 weeks, any Goal Practice Run must stay clearly below race distance.
For half marathon plans of 12 weeks or more, the final weeks must include clearly race-specific preparation, including a meaningful long run and a meaningful goal-practice run.
Do not make the final half-marathon-specific runs token short just because earlier weekly volume was conservative.
Do not create token placeholder runs with tiny distances just to satisfy structure.
Do not create a plan where one run is extremely long while another is trivially short in the same week unless there is a clear workout reason.

Additional constraints for Week Dailys
stepDays + runDays + recoveryDays must equal 7
runs.sessions must sum to runDays

Exact length rule
Return exactly ${numberOfWeeks} rows in Weekly Plan Table.

Output requirements
Output JSON only
Output exactly one object
No explanations before or after
Keep wording concise and consistent
No ranges anywhere
Week name should not include the word week or any week number
Expected weight must be numeric only`
        : `You are a fitness planning assistant.

Create a structured fat-loss plan in JSON format only with the following exact columns and order:

Weekly Plan Table (Calories / Food / Steps / Running / Expected Weight)
Week | Calories/day | Protein/day | Steps/day target | Run km/week | Expected weight | Week name | Week Dailys

User details
Gender: ${plan.user?.gender || "unknown"}
Height: ${heightText}
Weight: ${plan.weightKg} kg
BMI: ${bmi ?? "unknown"}
Age: ${plan.ageYears} years
Goal type: ${plan.goalType}
Training style: ${plan.trainingStyle || "walkAndRun"}
Available training days: ${availableDayLabels || "not specified"}

Timeline: ${plan.targetWeightKg !== null && plan.targetWeightKg !== undefined && plan.targetDate
            ? `Target weight: ${plan.targetWeightKg}kg by ${plan.targetDate.toISOString().split("T")[0]}`
            : plan.targetWeightKg !== null && plan.targetWeightKg !== undefined
                ? `Target weight: ${plan.targetWeightKg}kg`
                : plan.targetDate
                    ? `Target date: ${plan.targetDate.toISOString().split("T")[0]}`
                    : derivedWeightToLoseKg !== null
                        ? `Weight to lose: ${derivedWeightToLoseKg}kg`
                        : `or whatever is best optimal`}

Number of weeks to generate: ${numberOfWeeks}
If target date falls in the middle of a week, include that full week as the target deadline week.
${plan.targetDate
                ? `For date-based weight-loss plans, the actual weight-loss phase is the first ${targetDeadlineWeeks ?? numberOfWeeks} weeks.\nGenerate the full ${numberOfWeeks}-week plan, but weeks after the target deadline should maintain the achieved realistic weight, not keep losing weight.`
                : "For weight-loss plans, always generate at least 8 full weeks.\nIf the requested goal or timeline is shorter than 8 weeks, still output 8 weeks and use maintenance-oriented weeks when needed after realistic progress has been reached."}
Make goal weight realistic.
${derivedWeightToLoseKg !== null ? `Total weight to lose across the plan: ${derivedWeightToLoseKg}kg.` : ""}
${requiredWeeklyLossKg !== null ? `Required average weight loss to reach the target by the target date: ${requiredWeeklyLossKg}kg per week.` : ""}
${targetDeadlineWeeks !== null ? `Target deadline week: ${targetDeadlineWeeks}. Weeks ${targetDeadlineWeeks + 1} through ${numberOfWeeks} must be maintenance-oriented if those weeks exist.` : ""}

Planning rules
Protein must be appropriate for the user's weight and goal.
BMI must be considered when deciding calories, step targets, training load, weekly expected-weight changes, and whether the plan should be aggressive, moderate, or conservative.
Make sure values are realistic, not too low or too high, and sustainable.
If training style is walkAndRun, use more walk types and if you wanna use run then use Interval Run and other run types as part of the plan where appropriate.
If training style is walkOnly, use walking-based types only.
If training style is runOnly, prioritize running-based types while keeping the plan realistic for fat loss.
You may model fat loss as fast as 2.0 kg per week only when the user's starting point, timeline, BMI, and training load make that suitable and realistic.
Do not use ranges anywhere.
Do not include emojis or commentary inside values.

Planning pipeline
Follow this planning order internally before writing any JSON:
1. Estimate a realistic TDEE first.
2. Determine whether the target weight by the target date is feasible.
3. Convert the required weight-loss pace into a calorie deficit using 7700 kcal = 1 kg.
4. Set calories/day from that deficit.
5. Set steps/day and run volume only after calories and deficit math are set.
6. Validate that expected weekly weight changes match the calorie deficit math.

Deficit math rules
Use 7700 kcal = 1 kg as the required anchor for expected weight change.
Do not exceed 1000 kcal daily deficit.

Deficit split rules
Food intake and activity should both contribute meaningfully to the deficit.
Run and walk activity can carry importance to food intake when appropriate for the user's profile and goal.
Balance calorie reduction and activity realistically instead of relying too heavily on only one side.
Do not use excessive running volume or extreme step targets just to justify higher calories.

Activity sanity limits
Steps/day must stay within realistic human limits.
Do not set excessive daily step targets.
Run km/week must stay realistic for the user's training style and level.
Do not create sudden spikes in steps or run km to repair calorie math.

Progression rules
Use gradual changes only.
Calories must change gradually.
Steps must change gradually.
Run volume must change gradually.
Do not start high and then suddenly drop.
Use a clear linear or stepwise progression model.

Safety and feasibility rules
If the target is too aggressive for the timeline, automatically extend the effective timeline inside the plan and use maintenance-oriented weeks when needed.
Do not make the plan harsher just to preserve an unrealistic deadline.
Use realistic weight-loss bounds, generally around 0.4% to 1.0% of body weight per week unless a more aggressive but still suitable case clearly applies.
Respect minimum calorie thresholds and avoid crash dieting.
Safety has higher priority than speed.


Consistency and validation rules
Calories plus activity must support the expected weight-loss trend.
Expected weight must follow from the implied deficit math.
There must be no contradictions between target, timeline, calories, activity, and expected weight.
Last expected weight should must match target weoight kg target
Every numeric output must be derivable from prior calculations or constraints.
Do not use arbitrary numbers, filler values, or fake run km.
Do not use inconsistent weekly progression.
Before finalizing the JSON, perform an internal validation checklist silently:
math correct,
constraints satisfied,
plan achievable for a normal human.
Keep this reasoning hidden and do not expose it in the output.

Expected weight calculation
Expected weight must be a number.
Start from current weight (${plan.weightKg}kg).
Decrease gradually each week by calculating based on calorie balance and activity.
Use realistic fat-loss assumptions based on calorie balance and activity.
Expected weight may stay flat during maintenance-oriented weeks.
If both a target weight and a target date are provided, shape the weekly expected-weight progression so the plan reaches or gets as close as realistically possible to the target weight by the target date.
If the required average weight loss to hit the target by the target date is 2.0 kg per week or less, the target deadline week should meet the target weight.
Only allow the target deadline week to miss the target weight when hitting it by the target date would require more than 2.0 kg per week or would otherwise require an unrealistic or unsafe plan.
After the target deadline week, expected weight should stay flat or move only minimally for maintenance.
When the combined target is not realistic, still push progress meaningfully toward it but keep calories, steps, and training load realistic and suitable.

Week Dailys structure (mandatory)
Week Dailys must be a nested object with the following keys:
stepDays (number)
runDays (number)
recoveryDays (number)
runs (array)

Each item in runs must be an object with:
runType
sessions

Scheduling constraints
Run sessions must fit within these available training days only: ${availableDayLabels || "not specified"}
runDays must not exceed the number of available training days (${normalizedAvailableDays.length || 0})

If more than one run or walk type is used in a week, each type must be a separate object in the runs array.

Allowed runType values
Use only these values:
Power Walk
Interval Walk
Interval Run
Easy Run
Long Run
Walk
Free Run
Goal Practice Run

Run type guidance
If training style is walkAndRun, Interval Run should appear first when used and the plan should include other running types where appropriate.
If training style is walkOnly, most entries should be walking-based types.
If training style is runOnly, most entries should be running-based types.
Goal Practice Run can be used sparingly in the final weeks when race-specific distance rehearsal is appropriate.
When both walking and running are allowed by the training style, mix the plan across run and walk types instead of repeating the same single mode every week.
Use variety across the plan where appropriate, so the weekly schedule includes a sensible mix of the allowed run and walk session types.

Additional constraints for Week Dailys
stepDays + runDays + recoveryDays must equal 7
runs.sessions must sum to runDays

Exact length rule
Return exactly ${numberOfWeeks} rows in Weekly Plan Table.

Output requirements
Output JSON only
Output exactly one object
No explanations before or after
Keep wording concise and consistent
No ranges anywhere
Week name should not have the text week or any week number in it
Expected weight must be numeric only`;

    const aiInput = [{ role: "user" as const, content: [{ type: "input_text" as const, text: prompt }] }];
    const debugAiRequest = {
        generatedAt: new Date().toISOString(),
        model: "gpt-5-mini",
        store: false,
        input: aiInput,
        resolvedValues: {
            gender: plan.user?.gender || "unknown",
            height: heightText,
            weightKg: plan.weightKg,
            bmi,
            ageYears: plan.ageYears,
            goalType: plan.goalType,
            activityPreference: plan.activityPreference || "WALKING_RUNNING",
            intensityLevel: plan.intensityLevel,
            numberOfWeeks,
            targetDeadlineWeeks,
            availableDays: normalizedAvailableDays,
            availableDayLabels,
            runGoal: plan.runGoal || null,
            runExperience: plan.runExperience || null,
            runDietFocus: plan.runDietFocus || null,
            trainingStyle: plan.trainingStyle || null,
            targetDate: plan.targetDate ? plan.targetDate.toISOString().split("T")[0] : null,
            runRaceDate: plan.runRaceDate ? plan.runRaceDate.toISOString().split("T")[0] : null,
            timeHorizon: plan.timeHorizon || null,
        },
        prompt,
    };

    return { numberOfWeeks, normalizedAvailableDays, prompt, aiInput, debugAiRequest };
}

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

router.get("/generate-weekly-preview", async (req: AuthRequest, res, next) => {
    try {
        if (!req.user) return res.status(401).json({ message: "Unauthorized" });

        const plan = await prisma.userPlan.findUnique({
            where: { userId: req.user.id },
            include: {
                user: { select: { gender: true, heightFt: true, heightIn: true, goalType: true } },
            },
        });

        if (!plan) {
            return res.status(404).json({ message: "No plan found. Please complete the onboarding first." });
        }

        const preview = buildWeeklyPlanPromptData(plan);
        return res.json({
            ok: true,
            debugAiRequest: preview.debugAiRequest,
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
                user: { select: { gender: true, heightFt: true, heightIn: true, goalType: true } },
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

        const { normalizedAvailableDays, aiInput, debugAiRequest } = buildWeeklyPlanPromptData(plan);

        const resp = await openai.responses.create({
            model: "gpt-5-mini",
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
        const rawTable = json["Weekly Plan Table"] || [];
        const table = injectGoalPracticeRuns(rawTable, {
            runGoal: plan.runGoal,
            runExperience: plan.runExperience,
            totalWeeks: debugAiRequest.resolvedValues.numberOfWeeks,
        });

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
            debugAiRequest,
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
    runs: Array<{ runType: string; sessions: number; targetKm?: number }>;
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
    [GOAL_PRACTICE_RUN_TYPE]: 1.4,
};

const GOAL_PRACTICE_DISTANCES: Record<string, number> = {
    "5k": 5.0,
    "10k": 10.0,
    halfMarathon: 21.1,
};

const GOAL_PRACTICE_REPLACEMENT_PRIORITY = [
    "Free Run",
    "Easy Run",
    "Tempo Run",
    "Long Run",
];

const LONG_RUN_REPLACEMENT_PRIORITY = [
    "Free Run",
    "Easy Run",
    "Tempo Run",
    "Steady Run",
    "Recovery Run",
];

const GOAL_SPECIFIC_WEEK_TARGETS: Record<string, {
    practice: { penultimate: number; final: number };
    longRun: { penultimate: number; final: number };
    minOtherRunKm: number;
}> = {
    "5k": {
        practice: { penultimate: 4.0, final: 5.0 },
        longRun: { penultimate: 6.0, final: 7.0 },
        minOtherRunKm: 2.5,
    },
    "10k": {
        practice: { penultimate: 7.0, final: 9.0 },
        longRun: { penultimate: 9.0, final: 11.0 },
        minOtherRunKm: 3.0,
    },
    halfMarathon: {
        practice: { penultimate: 12.0, final: 14.0 },
        longRun: { penultimate: 16.0, final: 18.0 },
        minOtherRunKm: 4.0,
    },
};

type PlannedRun = { runType: string; sessions: number; targetKm?: number };

function roundToOneDecimal(value: number): number {
    return Math.round(value * 10) / 10;
}

function getGoalPracticeDistance(runGoal: string | null | undefined): number | null {
    if (!runGoal) return null;
    return GOAL_PRACTICE_DISTANCES[runGoal] ?? null;
}

function getGoalPracticeMinimumWeeks(
    runGoal: string | null | undefined,
    runExperience: string | null | undefined
): number {
    if (runGoal === "halfMarathon") {
        return runExperience === "beginner" ? 12 : 10;
    }

    if (runGoal === "10k") {
        return 6;
    }

    if (runGoal === "5k") {
        return 4;
    }

    return Number.POSITIVE_INFINITY;
}

function getCappedGoalPracticeDistance(
    runGoal: string | null | undefined,
    weeklyKm: number,
    fullGoalDistanceKm: number
): number {
    const cappedByWeeklyVolume = runGoal === "halfMarathon"
        ? weeklyKm * 0.65
        : weeklyKm * 0.75;

    return roundToOneDecimal(
        Math.max(3, Math.min(fullGoalDistanceKm, cappedByWeeklyVolume))
    );
}

function getTargetPracticeWeeks(totalWeeks: number): number[] {
    return [Math.max(1, totalWeeks - 1), totalWeeks]
        .filter((weekNumber, index, arr) => arr.indexOf(weekNumber) === index);
}

function getGoalSpecificWeekTarget(
    runGoal: string | null | undefined,
    kind: "practice" | "longRun",
    weekNumber: number,
    totalWeeks: number,
    fullGoalDistanceKm?: number | null,
): number | null {
    if (!runGoal) return null;
    const config = GOAL_SPECIFIC_WEEK_TARGETS[runGoal];
    if (!config) return null;

    const targetWeeks = getTargetPracticeWeeks(totalWeeks);
    const isFinalTargetWeek = weekNumber === targetWeeks[targetWeeks.length - 1];
    const rawTarget = isFinalTargetWeek ? config[kind].final : config[kind].penultimate;

    if (typeof fullGoalDistanceKm === "number" && Number.isFinite(fullGoalDistanceKm) && fullGoalDistanceKm > 0) {
        return roundToOneDecimal(Math.min(rawTarget, fullGoalDistanceKm));
    }

    return roundToOneDecimal(rawTarget);
}

function addSessionsBackAsEasyRuns(nextRuns: PlannedRun[], sessionsToAdd: number) {
    if (sessionsToAdd <= 0) return;
    const easyRunIdx = nextRuns.findIndex((run) => run.runType === "Easy Run");
    if (easyRunIdx !== -1) {
        nextRuns[easyRunIdx] = {
            ...nextRuns[easyRunIdx],
            sessions: nextRuns[easyRunIdx].sessions + sessionsToAdd,
        };
    } else {
        nextRuns.push({ runType: "Easy Run", sessions: sessionsToAdd });
    }
}

function ensureSingleRunWithTarget(
    nextRuns: PlannedRun[],
    options: {
        runType: string;
        targetKm: number;
        replacementPriority: string[];
        protectedTypes?: string[];
    }
): number {
    const protectedTypes = new Set(options.protectedTypes ?? []);
    let reclaimedSessions = 0;

    for (let i = nextRuns.length - 1; i >= 0; i -= 1) {
        if (nextRuns[i].runType !== options.runType) continue;
        if (nextRuns[i].sessions > 1) {
            reclaimedSessions += nextRuns[i].sessions - 1;
            nextRuns[i].sessions = 1;
        }
        nextRuns[i].targetKm = options.targetKm;
    }

    const existingIdx = nextRuns.findIndex((run) => run.runType === options.runType && run.sessions > 0);
    if (existingIdx !== -1) {
        nextRuns[existingIdx] = {
            ...nextRuns[existingIdx],
            sessions: 1,
            targetKm: options.targetKm,
        };
        return reclaimedSessions;
    }

    for (const candidateType of options.replacementPriority) {
        const idx = nextRuns.findIndex((run) =>
            run.runType === candidateType &&
            run.sessions > 0 &&
            !protectedTypes.has(run.runType)
        );
        if (idx === -1) continue;

        nextRuns[idx] = { ...nextRuns[idx], sessions: nextRuns[idx].sessions - 1 };
        if (nextRuns[idx].sessions <= 0) {
            nextRuns.splice(idx, 1);
        }
        nextRuns.push({
            runType: options.runType,
            sessions: 1,
            targetKm: options.targetKm,
        });
        return reclaimedSessions;
    }

    const fallbackIdx = nextRuns.findIndex((run) =>
        run.sessions > 0 &&
        !protectedTypes.has(run.runType) &&
        run.runType !== "Interval Run"
    );
    if (fallbackIdx !== -1) {
        nextRuns[fallbackIdx] = { ...nextRuns[fallbackIdx], sessions: nextRuns[fallbackIdx].sessions - 1 };
        if (nextRuns[fallbackIdx].sessions <= 0) {
            nextRuns.splice(fallbackIdx, 1);
        }
        nextRuns.push({
            runType: options.runType,
            sessions: 1,
            targetKm: options.targetKm,
        });
    }

    return reclaimedSessions;
}

function injectGoalPracticeRuns(
    table: any[],
    options: {
        runGoal: string | null | undefined;
        runExperience: string | null | undefined;
        totalWeeks: number;
    }
) {
    const practiceDistanceKm = getGoalPracticeDistance(options.runGoal);
    if (!practiceDistanceKm || !Array.isArray(table) || table.length < 3) {
        return table;
    }

    const minimumWeeks = getGoalPracticeMinimumWeeks(
        options.runGoal,
        options.runExperience,
    );
    if (options.totalWeeks < minimumWeeks) {
        return table;
    }

    const targetWeekNumbers = getTargetPracticeWeeks(table.length);

    return table.map((week) => {
        if (!targetWeekNumbers.includes(Number(week?.Week))) {
            const weekDailys = week?.["Week Dailys"];
            if (!weekDailys || !Array.isArray(weekDailys.runs)) {
                return week;
            }

            const extraPracticeSessions = weekDailys.runs.reduce((sum: number, run: any) => {
                return run?.runType === GOAL_PRACTICE_RUN_TYPE ? sum + Number(run?.sessions || 0) : sum;
            }, 0);
            const runsWithoutPractice = weekDailys.runs.filter((run: any) => run?.runType !== GOAL_PRACTICE_RUN_TYPE);
            if (extraPracticeSessions > 0) {
                const easyRunIdx = runsWithoutPractice.findIndex((run: any) => run?.runType === "Easy Run");
                if (easyRunIdx !== -1) {
                    runsWithoutPractice[easyRunIdx] = {
                        ...runsWithoutPractice[easyRunIdx],
                        sessions: Number(runsWithoutPractice[easyRunIdx].sessions || 0) + extraPracticeSessions,
                    };
                } else {
                    runsWithoutPractice.push({ runType: "Easy Run", sessions: extraPracticeSessions });
                }
            }
            return {
                ...week,
                "Week Dailys": {
                    ...weekDailys,
                    runs: runsWithoutPractice,
                },
            };
        }

        const weekDailys = week?.["Week Dailys"];
        if (!weekDailys || !Array.isArray(weekDailys.runs) || weekDailys.runDays <= 0) {
            return week;
        }

        const nextRuns: PlannedRun[] = weekDailys.runs.map((run: any) => ({
            runType: String(run?.runType || ""),
            sessions: Number(run?.sessions || 0),
            targetKm: typeof run?.targetKm === "number" ? roundToOneDecimal(run.targetKm) : undefined,
        }));

        const practiceTargetKm = getGoalSpecificWeekTarget(
            options.runGoal,
            "practice",
            Number(week?.Week || 0),
            options.totalWeeks,
            practiceDistanceKm,
        ) ?? getCappedGoalPracticeDistance(
            options.runGoal,
            Number(week?.["Run km/week"] || 0),
            practiceDistanceKm,
        );

        let reclaimedSessions = ensureSingleRunWithTarget(nextRuns, {
            runType: GOAL_PRACTICE_RUN_TYPE,
            targetKm: practiceTargetKm,
            replacementPriority: GOAL_PRACTICE_REPLACEMENT_PRIORITY,
        });

        const longRunTargetKm = getGoalSpecificWeekTarget(
            options.runGoal,
            "longRun",
            Number(week?.Week || 0),
            options.totalWeeks,
        );
        if (longRunTargetKm !== null) {
            reclaimedSessions += ensureSingleRunWithTarget(nextRuns, {
                runType: "Long Run",
                targetKm: longRunTargetKm,
                replacementPriority: LONG_RUN_REPLACEMENT_PRIORITY,
                protectedTypes: [GOAL_PRACTICE_RUN_TYPE],
            });
        }

        addSessionsBackAsEasyRuns(nextRuns, reclaimedSessions);

        const normalizedRuns = nextRuns
            .filter((run) => run.sessions > 0)
            .sort((a, b) => (a.runType === "Interval Run" ? -1 : b.runType === "Interval Run" ? 1 : 0));

        const fixedTargetKmTotal = normalizedRuns.reduce((sum, run) => {
            return sum + (typeof run.targetKm === "number" && run.targetKm > 0 ? run.targetKm * run.sessions : 0);
        }, 0);
        const remainingRunSessions = normalizedRuns.reduce((sum, run) => {
            return sum + (typeof run.targetKm === "number" && run.targetKm > 0 ? 0 : run.sessions);
        }, 0);
        const minOtherRunKm = GOAL_SPECIFIC_WEEK_TARGETS[options.runGoal || ""]?.minOtherRunKm ?? 3;
        const adjustedWeeklyKm = Math.max(
            roundToOneDecimal(Number(week?.["Run km/week"] || 0)),
            roundToOneDecimal(fixedTargetKmTotal + (remainingRunSessions * minOtherRunKm))
        );

        return {
            ...week,
            "Run km/week": adjustedWeeklyKm,
            "Week Dailys": {
                ...weekDailys,
                runs: normalizedRuns,
            },
        };
    });
}

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

function distributeRunKm(runs: Array<{ runType: string; sessions: number; targetKm?: number }>, totalKm: number): Array<{ runType: string; km: number }> {
    if (!runs || runs.length === 0 || totalKm <= 0) return [];

    const fixedRuns: Array<{ runType: string; km: number }> = [];
    const flatRuns: { runType: string; weight: number }[] = [];
    let totalFixedKm = 0;
    let totalWeight = 0;

    for (const r of runs) {
        // Normalize run type (handle hyphen vs en-dash)
        const normalizedType = r.runType.replace(/-/g, "–");
        const weight = RUN_KM_WEIGHTS[normalizedType] || RUN_KM_WEIGHTS[r.runType] || 0.15;
        for (let i = 0; i < r.sessions; i++) {
            if (typeof r.targetKm === "number" && r.targetKm > 0) {
                const fixedKm = roundToOneDecimal(r.targetKm);
                fixedRuns.push({ runType: r.runType, km: fixedKm });
                totalFixedKm += fixedKm;
                continue;
            }

            flatRuns.push({ runType: r.runType, weight });
            totalWeight += weight;
        }
    }

    const remainingKm = Math.max(roundToOneDecimal(totalKm - totalFixedKm), 0);
    if (flatRuns.length === 0) {
        return fixedRuns;
    }

    // Distribute km proportionally, use floor to avoid exceeding total
    const result = flatRuns.map((r) => ({
        runType: r.runType,
        km: Math.floor((r.weight / totalWeight) * remainingKm * 10) / 10,
    }));

    // Calculate distributed total and add remainder to longest run (usually first)
    const distributedTotal = result.reduce((sum, r) => sum + r.km, 0);
    const remainder = roundToOneDecimal(remainingKm - distributedTotal);

    if (remainder > 0 && result.length > 0) {
        // Add remainder to first run (or could find the one with highest weight)
        result[0].km = roundToOneDecimal(result[0].km + remainder);
    }

    return [...fixedRuns, ...result];
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

        const weekNumber = parseInt(requireStringParam(req.params.weekNumber, "weekNumber"), 10);
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
