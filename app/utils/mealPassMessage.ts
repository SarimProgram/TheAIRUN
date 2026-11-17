/** Keep in sync with backend/src/lib/mealPassMessage.ts. These chat messages are signals, never shown as chat. */
const PLATE_PATTERN = /^\[MEAL:plate:([0-9a-f-]{36}):(\d{1,3}):(breakfast|lunch|dinner|snack)\]/i;
const REPLY_PATTERN = /^\[MEAL:reply:([0-9a-f-]{36}):(accepted|declined)\]/i;

export type MealPlateSignal = { sharedMealId: string; xPct: number };
export type MealReplySignal = { sharedMealId: string; accepted: boolean };

export function parseMealPlateMessage(content: string): MealPlateSignal | null {
  const match = content.trim().match(PLATE_PATTERN);
  if (!match) return null;
  return { sharedMealId: match[1].toLowerCase(), xPct: Math.min(1, Math.max(0, Number(match[2]) / 100)) };
}

export function parseMealReplyMessage(content: string): MealReplySignal | null {
  const match = content.trim().match(REPLY_PATTERN);
  return match ? { sharedMealId: match[1].toLowerCase(), accepted: match[2].toLowerCase() === 'accepted' } : null;
}

export function isMealPassMessage(content: string): boolean {
  return /^\[MEAL:(plate|reply):/i.test(content.trim());
}
