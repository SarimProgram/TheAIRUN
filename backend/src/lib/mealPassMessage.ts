/** Keep in sync with app/utils/mealPassMessage.ts. These chat messages are signals, never shown as chat. */
export const MEAL_PLATE_PATTERN = /^\[MEAL:plate:([0-9a-f-]{36}):(\d{1,3}):(breakfast|lunch|dinner|snack)\]/i;
export const MEAL_REPLY_PATTERN = /^\[MEAL:reply:([0-9a-f-]{36}):(accepted|declined)\]/i;

const MEAL_LABEL: Record<string, string> = { BREAKFAST: 'breakfast', LUNCH: 'lunch', DINNER: 'dinner', SNACK: 'a snack' };

export function mealLabel(mealType: string) {
    return MEAL_LABEL[mealType.toUpperCase()] ?? 'a meal';
}

export function buildMealPlateMessage(id: string, xPct: number, mealType: string, fromName: string) {
    const pct = Math.round(Math.min(1, Math.max(0, xPct)) * 100);
    return `[MEAL:plate:${id}:${pct}:${mealType.toLowerCase()}] ${fromName} passed you ${mealLabel(mealType)}`;
}

export function buildMealReplyMessage(id: string, action: 'accepted' | 'declined') {
    return `[MEAL:reply:${id}:${action}]`;
}
