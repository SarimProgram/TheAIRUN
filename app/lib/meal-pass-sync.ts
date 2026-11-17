import { dayKeyInZone, overallShare, recipientPortion, senderPortion } from './meal-pass';
import { fetchSharedMeal, type SharedMeal } from './meal-pass-api';
import { findSentPlate, pendingSentPlates, updateSentPlate } from './meal-pass-store';
import { deleteLocalMeal, getLocalMeal, markLocalMealSynced, notifyMealListeners, saveLocalPortion, upsertLocalMeal, type OfflineMealLog } from './offline-meals';
import { syncPartnerFoodWidget } from './partner-food-widget';
import { API_BASE_URL } from '@/config/api';

type AuthFetch = (input: string, init?: RequestInit) => Promise<Response>;

/** Mirror the server-owned received portion without enqueueing a second upload. */
export async function cacheReceivedPlate(authFetch: AuthFetch, meal: SharedMeal, userKey: string, timezone?: string | null) {
  void syncPartnerFoodWidget(meal, authFetch);
  const clientMealId = `pass-${meal.id}`;
  const dayKey = dayKeyInZone(new Date(meal.createdAt), timezone);
  if (meal.status === 'DECLINED') {
    await deleteLocalMeal(userKey, clientMealId);
  } else {
    const existing = await getLocalMeal(userKey, clientMealId);
    if (existing && meal.status === 'PENDING') return;
    await saveLocalPortion({
      userKey, clientMealId, dayKey, mealType: meal.mealType, hadImage: meal.hasPhoto,
      loggedAt: meal.createdAt, synced: true, items: recipientPortion(meal.items, meal.itemShares),
    });
  }
  notifyMealListeners();
  void authFetch(`${API_BASE_URL}/summary/recalculate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dayKey }),
  }).then(notifyMealListeners).catch(() => {});
}

/** Best-effort upload of a freshly logged portion; Activity's own sync retries anything left unsynced. */
export async function postLocalMeal(authFetch: AuthFetch, meal: OfflineMealLog) {
  try {
    const response = await authFetch(`${API_BASE_URL}/nutrition/meals`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientMealId: meal.clientMealId, mealType: meal.mealType, hadImage: !!meal.hadImage, loggedAt: meal.loggedAt,
        items: meal.items.map((item) => ({
          foodName: item.foodName, calories: item.calories, proteinG: item.proteinG ?? null, carbsG: item.carbsG ?? null, fatG: item.fatG ?? null,
        })),
      }),
    });
    if (!response.ok) return;
    const saved = await response.json().catch(() => null);
    await markLocalMealSynced(meal.userKey, meal.clientMealId, saved?.id);
    await authFetch(`${API_BASE_URL}/summary/recalculate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dayKey: meal.dayKey }),
    }).catch(() => {});
  } catch {}
}

/** Applies the partner's answer to a plate this user passed: status line, and their own re-portioned meal. */
export async function applySentPlateAnswer(meal: SharedMeal) {
  const plate = await findSentPlate(meal.id);
  if (!plate || meal.status === 'PENDING' || plate.status === meal.status) return;
  await updateSentPlate(meal.id, { status: meal.status, partnerShare: overallShare(meal.items, meal.itemShares) });
  if (meal.status === 'ACCEPTED' && meal.mode === 'SPLIT') {
    // Synced meals were already re-portioned by the server and refresh from it; unsynced ones post these values.
    const local = await getLocalMeal(plate.userKey, plate.clientMealId);
    if (local && !local.synced) {
      const portion = senderPortion(meal.items, meal.itemShares, 'SPLIT');
      const sum = (key: 'proteinG' | 'carbsG' | 'fatG') => portion.reduce((total, item) => total + (item[key] ?? 0), 0);
      await upsertLocalMeal({
        ...local,
        totalCalories: portion.reduce((total, item) => total + item.calories, 0),
        totalProteinG: sum('proteinG') || null, totalCarbsG: sum('carbsG') || null, totalFatG: sum('fatG') || null,
        updatedAt: new Date().toISOString(),
        items: portion.map((item, index) => ({
          id: `${local.clientMealId}-i${index}`, foodName: item.foodName, calories: item.calories,
          proteinG: item.proteinG ?? null, carbsG: item.carbsG ?? null, fatG: item.fatG ?? null,
        })),
      });
    }
  }
  notifyMealListeners();
}

export async function refreshSentPlate(authFetch: AuthFetch, sharedMealId: string) {
  await applySentPlateAnswer(await fetchSharedMeal(authFetch, sharedMealId));
}

/** Catches up on answers that arrived while the app was closed. */
export async function refreshPendingSentPlates(authFetch: AuthFetch, userKey: string) {
  for (const plate of await pendingSentPlates(userKey)) {
    await refreshSentPlate(authFetch, plate.sharedMealId).catch(() => {});
  }
}
