// Training Plan Routes
// API endpoints for generating and viewing training plans

import { Router } from "express";
import { z } from "zod";
import prisma from "../db/prisma";
import { AuthRequest } from "../middleware/auth";
import { generateTrainingPlan, UserContext, WeeklySchedule } from "../generators";

const router = Router();

/**
 * POST /training-plan/generate
 * Generate a new training plan from OpenAI weekly schedule
 */
router.post("/generate", async (req: AuthRequest, res, next) => {
    try {
        if (!req.user) return res.status(401).json({ message: "Unauthorized" });

        const schema = z.object({
            goal: z.string(),
            totalWeeks: z.number().int().min(1).max(52),
            weeklySchedules: z.array(z.object({
                week: z.number(),
                runs: z.array(z.object({
                    runType: z.string(),
                    sessions: z.number().int().min(0),
                })),
                stepDays: z.number().int().default(0),
                runDays: z.number().int().default(0),
                recoveryDays: z.number().int().default(0),
            })),
            weeklyTargetKm: z.array(z.number().min(0)),
        });

        const data = schema.parse(req.body);

        // Get user context from profile
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            include: { plan: true },
        });

        if (!user) return res.status(404).json({ message: "User not found" });

        const userContext: UserContext = {
            baselinePaceSecPerKm: user.baselinePaceSecPerKm ?? undefined,
            ageYears: user.plan?.ageYears ?? undefined,
            heightCm: user.plan?.heightCm ?? undefined,
            weightKg: user.plan?.weightKg ?? undefined,
            runExperience: (user.plan?.runExperience as any) || "beginner",
            goal: data.goal,
            isAbsoluteBeginner: user.plan?.runExperience === "beginner",
        };

        const result = await generateTrainingPlan({
            userId: req.user.id,
            goal: data.goal,
            totalWeeks: data.totalWeeks,
            weeklySchedules: data.weeklySchedules as WeeklySchedule[],
            weeklyTargetKm: data.weeklyTargetKm,
            userContext,
        });

        return res.status(201).json({
            success: true,
            planId: result.planId,
            planJson: result.planJson,
            sessionCount: result.sessionCount,
        });
    } catch (err) {
        return next(err);
    }
});

/**
 * GET /training-plan/:planId
 * Get a training plan with all sessions
 */
router.get("/:planId", async (req: AuthRequest, res, next) => {
    try {
        if (!req.user) return res.status(401).json({ message: "Unauthorized" });

        const plan = await prisma.trainingPlan.findFirst({
            where: { id: req.params.planId, userId: req.user.id },
            include: { sessions: { orderBy: [{ week: "asc" }, { id: "asc" }] } },
        });

        if (!plan) return res.status(404).json({ message: "Plan not found" });

        return res.json({ plan });
    } catch (err) {
        return next(err);
    }
});

/**
 * GET /training-plan/:planId/week/:weekNum
 * Get sessions for a specific week
 */
router.get("/:planId/week/:weekNum", async (req: AuthRequest, res, next) => {
    try {
        if (!req.user) return res.status(401).json({ message: "Unauthorized" });

        const weekNum = parseInt(req.params.weekNum, 10);
        if (isNaN(weekNum) || weekNum < 1) {
            return res.status(400).json({ message: "Invalid week number" });
        }

        const sessions = await prisma.runSession.findMany({
            where: {
                plan: { id: req.params.planId, userId: req.user.id },
                week: weekNum,
            },
            orderBy: { id: "asc" },
        });

        return res.json({ week: weekNum, sessions });
    } catch (err) {
        return next(err);
    }
});

/**
 * GET /training-plan/session/:sessionId
 * Get a single session with UI steps
 */
router.get("/session/:sessionId", async (req: AuthRequest, res, next) => {
    try {
        if (!req.user) return res.status(401).json({ message: "Unauthorized" });

        const session = await prisma.runSession.findFirst({
            where: {
                id: req.params.sessionId,
                plan: { userId: req.user.id },
            },
        });

        if (!session) return res.status(404).json({ message: "Session not found" });

        return res.json({ session });
    } catch (err) {
        return next(err);
    }
});

/**
 * GET /training-plan/user/latest
 * Get the user's latest training plan
 */
router.get("/user/latest", async (req: AuthRequest, res, next) => {
    try {
        if (!req.user) return res.status(401).json({ message: "Unauthorized" });

        const plan = await prisma.trainingPlan.findFirst({
            where: { userId: req.user.id },
            orderBy: { createdAt: "desc" },
            include: { sessions: { orderBy: [{ week: "asc" }, { id: "asc" }] } },
        });

        if (!plan) return res.status(404).json({ message: "No training plan found" });

        return res.json({ plan });
    } catch (err) {
        return next(err);
    }
});

export default router;
