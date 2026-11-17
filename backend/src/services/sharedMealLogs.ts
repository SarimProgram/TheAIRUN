import type { Prisma, SharedMeal } from '@prisma/client';
import { plateTotals, recipientPortion, type PlateItem } from '../lib/mealSplit';

/** Create a received portion once; only an explicit serving change replaces existing items. */
export async function saveRecipientMeal(tx: Prisma.TransactionClient, row: SharedMeal, values: number[], replace = false) {
    const portion = recipientPortion(row.items as PlateItem[], values);
    const totals = plateTotals(portion);
    const data = {
        totalCalories: totals.calories, totalProteinG: totals.proteinG || null,
        totalCarbsG: totals.carbsG || null, totalFatG: totals.fatG || null,
        items: { create: portion.map(part => ({
            foodName: part.foodName, calories: part.calories, grams: part.grams ?? null,
            proteinG: part.proteinG ?? null, carbsG: part.carbsG ?? null, fatG: part.fatG ?? null,
        })) },
    };
    const where = { userId_clientMealId: { userId: row.recipientUserId, clientMealId: `pass-${row.id}` } };
    if (replace) {
        await tx.mealItem.deleteMany({ where: { meal: { userId: row.recipientUserId, clientMealId: `pass-${row.id}` } } });
    }
    await tx.mealLog.upsert({
        where, update: replace ? data : {},
        create: { ...data, userId: row.recipientUserId, clientMealId: `pass-${row.id}`,
            mealType: row.mealType, loggedAt: row.createdAt, hadImage: !!row.photoPath },
    });
}
