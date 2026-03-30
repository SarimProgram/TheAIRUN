// src/routes/nutrition.routes.ts
import { Router } from "express";
import { z } from "zod";
import OpenAI from "openai";
import sharp from "sharp";
import { prisma } from "../db/prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { upload } from "../middleware/upload";

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function getDayKeyInTimezone(date: Date, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const d = parts.find((p) => p.type === "day")?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    // fall through
  }

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const FieldsSchema = z.object({
  mealType: z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK"]),
  text: z.string().trim().optional(),
});

const OutputSchema = {
  name: "MealAnalysis",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      mealType: { type: "string", enum: ["BREAKFAST", "LUNCH", "DINNER", "SNACK"] },

      items: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            foodName: { type: "string" },
            servingQty: { type: ["number", "null"] },
            servingUnit: { type: ["string", "null"] },
            grams: { type: ["number", "null"] },
            calories: { type: "integer" },
            proteinG: { type: ["number", "null"] },
            carbsG: { type: ["number", "null"] },
            fatG: { type: ["number", "null"] },
            confidence: { type: ["number", "null"], minimum: 0, maximum: 1 },
          },
          required: [
            "foodName",
            "servingQty",
            "servingUnit",
            "grams",
            "calories",
            "proteinG",
            "carbsG",
            "fatG",
            "confidence",
          ],
        },
      },

      totals: {
        type: "object",
        additionalProperties: false,
        properties: {
          calories: { type: "integer" },
          proteinG: { type: ["number", "null"] },
          carbsG: { type: ["number", "null"] },
          fatG: { type: ["number", "null"] },
        },
        required: ["calories", "proteinG", "carbsG", "fatG"],
      },

      confidence: { type: ["number", "null"], minimum: 0, maximum: 1 },
    },

    required: ["mealType", "items", "totals", "confidence"],
  },
};

function buildPrompt(mealType: string, text?: string) {
  return [
    "You are a professional nutrition analyst.",
    "Analyze the image and user text to identify all food items and estimate their portions and calories.",
    "Keep single dishes as one item (e.g., 'oily omelette' should remain one food item).",
    "Do not split a dish into ingredients, condiments, or cooking oil unless they are clearly separate foods or the user explicitly lists them separately.",
    "Treat descriptive words (oily, spicy, cheesy, grilled, etc.) as part of the food name, not separate items.",
    "Be conservative with calorie estimates. If unsure, set lower confidence.",
    "Return grams for each item when possible.",
    `Meal Type: ${mealType}`,
    text ? `User description: ${text}` : "No user text provided.",
    "If the image contains multiple food items, please list each one separately.",
  ].join("\n");
}

/**
 * POST /nutrition/meals/analyze
 * multipart/form-data:
 * - mealType (required)
 * - text (optional)
 * - image (optional file)
 * Returns structured JSON (no DB write)
 */
router.post(
  "/meals/analyze",
  authMiddleware,
  upload.single("image"),
  async (req, res, next) => {
    try {
      const { mealType, text } = FieldsSchema.parse({
        mealType: req.body.mealType,
        text: req.body.text,
      });

      const file = req.file;

      // Allowlist image types
      if (file && !/^image\/(jpeg|png|webp)$/.test(file.mimetype)) {
        return res.status(400).json({ error: "Unsupported image type (use jpg/png/webp)" });
      }

      // Prepare image as base64 data URL (no storage)
      let imageDataUrl: string | undefined;
      if (file) {
        const resized = await sharp(file.buffer)
          .rotate()
          .resize({ width: 900, withoutEnlargement: true })
          .jpeg({ quality: 75 })
          .toBuffer();

        imageDataUrl = `data:image/jpeg;base64,${resized.toString("base64")}`;
      }

      const content: any[] = [{ type: "text", text: buildPrompt(mealType, text) }];
      if (imageDataUrl) {
        content.push({
          type: "image_url",
          image_url: { url: imageDataUrl }
        });
      }

      const resp = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content }],
        response_format: {
          type: "json_schema",
          json_schema: {
            ...OutputSchema,
            strict: true
          }
        },
      });

      const jsonStr = resp.choices[0].message.content;
      const json = JSON.parse(jsonStr ?? "{}");
      res.json(json);
    } catch (err) {
      next(err);
    }
  }
);

const SaveSchema = z.object({
  clientMealId: z.string().optional(),
  mealType: z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK"]),
  loggedAt: z.string().optional(),
  inputText: z.string().optional(),
  hadImage: z.boolean().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  modelName: z.string().optional(),
  items: z
    .array(
      z.object({
        foodName: z.string(),
        servingQty: z.number().nullable().optional(),
        servingUnit: z.string().nullable().optional(),
        grams: z.number().nullable().optional(),
        calories: z.number().int(),
        proteinG: z.number().nullable().optional(),
        carbsG: z.number().nullable().optional(),
        fatG: z.number().nullable().optional(),
        confidence: z.number().min(0).max(1).nullable().optional(),
      })
    )
    .min(1),
});

/**
 * POST /nutrition/meals
 * JSON body from the app after user confirms/adjusts
 * Writes MealLog + MealItem[]
 */
router.post("/meals", authMiddleware, async (req, res, next) => {
  try {
    const userId = (req as AuthRequest).user!.id;
    const data = SaveSchema.parse(req.body);

    type MacroTotals = {
      calories: number;
      proteinG: number;
      carbsG: number;
      fatG: number;
    };

    const totals: MacroTotals = data.items.reduce<MacroTotals>(
      (acc, it) => {
        acc.calories += it.calories;
        acc.proteinG += it.proteinG ?? 0;
        acc.carbsG += it.carbsG ?? 0;
        acc.fatG += it.fatG ?? 0;
        return acc;
      },
      { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
    );

    const parsedLoggedAt = data.loggedAt ? new Date(data.loggedAt) : undefined;
    const safeLoggedAt = parsedLoggedAt && !Number.isNaN(parsedLoggedAt.getTime()) ? parsedLoggedAt : undefined;

    const createData = {
      userId,
      clientMealId: data.clientMealId ?? null,
      mealType: data.mealType,
      loggedAt: safeLoggedAt,
      inputText: data.inputText ?? null,
      hadImage: data.hadImage ?? false,
      totalCalories: totals.calories,
      totalProteinG: totals.proteinG || null,
      totalCarbsG: totals.carbsG || null,
      totalFatG: totals.fatG || null,
      confidence: data.confidence ?? null,
      modelName: data.modelName ?? "gpt-4o-mini",
      items: {
        create: data.items.map((i) => ({
          foodName: i.foodName,
          servingQty: i.servingQty ?? null,
          servingUnit: i.servingUnit ?? null,
          grams: i.grams ?? null,
          calories: i.calories,
          proteinG: i.proteinG ?? null,
          carbsG: i.carbsG ?? null,
          fatG: i.fatG ?? null,
          confidence: i.confidence ?? null,
        })),
      },
    };

    const saved = data.clientMealId
      ? await prisma.mealLog.upsert({
          where: {
            userId_clientMealId: {
              userId,
              clientMealId: data.clientMealId,
            },
          },
          update: {},
          create: createData,
          include: { items: true },
        })
      : await prisma.mealLog.create({
          data: createData,
          include: { items: true },
        });

    res.status(201).json(saved);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /nutrition/meals/today
 * Get today's meals (uses user's timezone for correct date)
 */
router.get("/meals/today", authMiddleware, async (req, res, next) => {
  try {
    const userId = (req as AuthRequest).user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true }
    });
    const timezone = user?.timezone || 'UTC';

    const now = new Date();
    const dayKey = getDayKeyInTimezone(now, timezone);
    const [y, m, d] = dayKey.split('-').map(Number);
    const targetUtcMidnight = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
    const start = new Date(targetUtcMidnight);
    start.setUTCDate(start.getUTCDate() - 1);
    const end = new Date(targetUtcMidnight);
    end.setUTCDate(end.getUTCDate() + 2);

    const mealCandidates = await prisma.mealLog.findMany({
      where: { userId, loggedAt: { gte: start, lt: end } },
      orderBy: { loggedAt: "asc" },
      include: { items: true },
    });
    const meals = mealCandidates.filter((meal) => getDayKeyInTimezone(new Date(meal.loggedAt), timezone) === dayKey);

    const totalCalories = meals.reduce((sum, m) => {
      if (Array.isArray(m.items) && m.items.length > 0) {
        return sum + m.items.reduce((itemSum, it) => itemSum + (Number(it.calories) || 0), 0);
      }
      return sum + (Number(m.totalCalories) || 0);
    }, 0);

    // Fetch user's plan for goals
    const userPlan = await prisma.userPlan.findUnique({
      where: { userId },
      select: { dailyCalorieTarget: true }
    });

    const goals = {
      calories: userPlan?.dailyCalorieTarget || 2200,
      steps: 10000,
      water: 8
    };

    res.json({ meals, totalCalories, goals });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /nutrition/meals/partner/today
 * Get partner's meals for today (uses partner's timezone for correct date)
 */
router.get("/meals/partner/today", authMiddleware, async (req, res, next) => {
  try {
    const userId = (req as AuthRequest).user!.id;

    // Get user with partner info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        partnerId: true,
        partner: {
          select: {
            id: true,
            displayName: true,
            timezone: true
          }
        }
      }
    });

    if (!user?.partnerId || !user.partner) {
      return res.json({ hasPartner: false, partner: null, meals: [], totalCalories: 0 });
    }

    // Use partner's timezone to calculate their "today"
    const partnerTimezone = user.partner.timezone || 'UTC';

    // Query a safe UTC window and bucket by partner-local dayKey
    const now = new Date();
    const dayKey = getDayKeyInTimezone(now, partnerTimezone);
    const [y, m, d] = dayKey.split('-').map(Number);
    const targetUtcMidnight = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
    const start = new Date(targetUtcMidnight);
    start.setUTCDate(start.getUTCDate() - 1);
    const end = new Date(targetUtcMidnight);
    end.setUTCDate(end.getUTCDate() + 2);

    const mealCandidates = await prisma.mealLog.findMany({
      where: {
        userId: user.partnerId,
        loggedAt: { gte: start, lt: end }
      },
      orderBy: { loggedAt: "asc" },
      include: { items: true },
    });
    const meals = mealCandidates.filter((meal) => getDayKeyInTimezone(new Date(meal.loggedAt), partnerTimezone) === dayKey);

    const totalCalories = meals.reduce((sum, m) => {
      if (Array.isArray(m.items) && m.items.length > 0) {
        return sum + m.items.reduce((itemSum, it) => itemSum + (Number(it.calories) || 0), 0);
      }
      return sum + (Number(m.totalCalories) || 0);
    }, 0);

    res.json({
      hasPartner: true,
      partner: {
        id: user.partner.id,
        name: user.partner.displayName
      },
      meals,
      totalCalories
    });
  } catch (err) {
    next(err);
  }
});

/**
 * OPTION B
 * DELETE /nutrition/meals/:mealId/items/:itemId
 * Deletes a single MealItem inside a user's MealLog and re-calculates totals.
 */
const DeleteItemSchema = z.object({
  mealId: z.string().min(1),
  itemId: z.string().min(1),
});

router.delete(
  "/meals/:mealId/items/:itemId",
  authMiddleware,
  async (req, res, next) => {
    try {
      const userId = (req as AuthRequest).user!.id;
      const { mealId, itemId } = DeleteItemSchema.parse({
        mealId: req.params.mealId,
        itemId: req.params.itemId,
      });

      // 1) Ensure the meal exists and belongs to the authenticated user
      const meal = await prisma.mealLog.findFirst({
        where: { id: mealId, userId },
        select: { id: true },
      });

      if (!meal) {
        return res.status(404).json({ error: "Meal not found" });
      }

      // 2) Ensure the item belongs to this meal
      const item = await prisma.mealItem.findFirst({
        where: { id: itemId, mealId },
        select: { id: true },
      });

      if (!item) {
        return res.status(404).json({ error: "Item not found" });
      }

      type MacroTotals = {
        calories: number;
        proteinG: number;
        carbsG: number;
        fatG: number;
      };

      // 3) Delete item and recompute totals in a transaction
      const result = await prisma.$transaction(async (tx) => {
        await tx.mealItem.delete({ where: { id: itemId } });

        const remaining = await tx.mealItem.findMany({
          where: { mealId },
          select: { calories: true, proteinG: true, carbsG: true, fatG: true },
        });

        const totals: MacroTotals = remaining.reduce<MacroTotals>(
          (acc, it) => {
            acc.calories += it.calories;
            acc.proteinG += it.proteinG ?? 0;
            acc.carbsG += it.carbsG ?? 0;
            acc.fatG += it.fatG ?? 0;
            return acc;
          },
          { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
        );

        const updatedMeal = await tx.mealLog.update({
          where: { id: mealId },
          data: {
            totalCalories: totals.calories,
            totalProteinG: totals.proteinG || null,
            totalCarbsG: totals.carbsG || null,
            totalFatG: totals.fatG || null,
          },
          include: { items: true },
        });

        return { updatedMeal, remainingCount: remaining.length };
      });

      return res.json({
        success: true,
        deletedItemId: itemId,
        mealId,
        remainingItems: result.remainingCount,
        meal: result.updatedMeal,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
