/** Keep in sync with backend/src/lib/mealSplit.ts: both sides must compute identical portions. */
export type PassMode = 'SPLIT' | 'COPY';
export type PlateItem = {
  foodName: string;
  calories: number;
  grams?: number | null;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
};
export type PlateTotals = { calories: number; proteinG: number; carbsG: number; fatG: number };

export const DEFAULT_PARTNER_SHARE = 0.4;
export const SHARE_STEP = 0.05;
export const MIN_SHARE = 0.05;
export const MAX_SHARE = 0.95;
export const MIN_SERVING = 0.25;
export const MAX_SERVING = 2;

const round1 = (value: number) => Math.round(value * 10) / 10;
const scaled = (value: number | null | undefined, factor: number) => (value == null ? null : round1(value * factor));
const left = (value: number | null | undefined, taken: number | null) =>
  value == null ? null : round1(Math.max(0, value - (taken ?? 0)));

function scaleItem(item: PlateItem, factor: number): PlateItem {
  return {
    foodName: item.foodName,
    calories: Math.round(item.calories * factor),
    grams: scaled(item.grams, factor),
    proteinG: scaled(item.proteinG, factor),
    carbsG: scaled(item.carbsG, factor),
    fatG: scaled(item.fatG, factor),
  };
}

/** The recipient's plate. SPLIT shares are fractions of each item; COPY shares are serving multipliers. */
export function recipientPortion(items: PlateItem[], shares: number[]): PlateItem[] {
  return items.flatMap((item, index) => {
    const factor = shares[index] ?? 0;
    return factor > 0 ? [scaleItem(item, factor)] : [];
  });
}

/** The sender's plate: whatever the recipient didn't take, so the two portions always add up to the scan. */
export function senderPortion(items: PlateItem[], shares: number[], mode: PassMode): PlateItem[] {
  if (mode === 'COPY') return items.map((item) => ({ ...item }));
  return items.flatMap((item, index) => {
    const factor = shares[index] ?? 0;
    if (factor >= 1) return [];
    const theirs = scaleItem(item, factor);
    return [{
      foodName: item.foodName,
      calories: item.calories - theirs.calories,
      grams: left(item.grams, theirs.grams ?? null),
      proteinG: left(item.proteinG, theirs.proteinG ?? null),
      carbsG: left(item.carbsG, theirs.carbsG ?? null),
      fatG: left(item.fatG, theirs.fatG ?? null),
    }];
  });
}

export function plateTotals(items: PlateItem[]): PlateTotals {
  return items.reduce(
    (sum, item) => ({
      calories: sum.calories + item.calories,
      proteinG: round1(sum.proteinG + (item.proteinG ?? 0)),
      carbsG: round1(sum.carbsG + (item.carbsG ?? 0)),
      fatG: round1(sum.fatG + (item.fatG ?? 0)),
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

/** The recipient's overall share, weighted by calories so "40%" means 40% of the energy on the plate. */
export function overallShare(items: PlateItem[], shares: number[]): number {
  const total = items.reduce((sum, item) => sum + item.calories, 0);
  if (total <= 0) return shares.length ? shares.reduce((sum, share) => sum + share, 0) / shares.length : 0;
  return items.reduce((sum, item, index) => sum + item.calories * (shares[index] ?? 0), 0) / total;
}

export const uniformShares = (items: PlateItem[], share: number) => items.map(() => share);
export const snapShare = (value: number, min = MIN_SHARE, max = MAX_SHARE) =>
  Math.min(max, Math.max(min, Math.round(Math.round(value / SHARE_STEP) * SHARE_STEP * 100) / 100));
export const percent = (fraction: number) => `${Math.round(fraction * 100)}%`;

export function normalizePlateItems(items: unknown[]): PlateItem[] {
  return items.flatMap((raw) => {
    const item = raw as Record<string, unknown>;
    const foodName = String(item?.foodName ?? item?.name ?? '').trim();
    const calories = Math.max(0, Math.round(Number(item?.calories) || 0));
    if (!foodName) return [];
    const nutrient = (value: unknown) => (value == null || !Number.isFinite(Number(value)) ? null : Math.max(0, Number(value)));
    return [{ foodName, calories, grams: nutrient(item.grams), proteinG: nutrient(item.proteinG), carbsG: nutrient(item.carbsG), fatG: nutrient(item.fatG) }];
  });
}

export type PartnerWords = { name: string; subject: string; object: string; possessive: string };

/** "She accepted", "Send her plate": falls back to their first name when gender is unknown. */
export function partnerWords(name: string | null | undefined, gender: string | null | undefined): PartnerWords {
  const first = String(name ?? '').trim().split(/\s+/)[0] || 'Your partner';
  const g = String(gender ?? '').toLowerCase();
  if (g === 'female') return { name: first, subject: 'She', object: 'her', possessive: 'her' };
  if (g === 'male') return { name: first, subject: 'He', object: 'him', possessive: 'his' };
  return { name: first, subject: first, object: first, possessive: `${first}\u2019s` };
}

/** The sender's status line: "Waiting for her" → "She accepted · You 60%, her 40%". */
export function sentPlateLabel(plate: { mode: PassMode; status: 'PENDING' | 'ACCEPTED' | 'DECLINED'; partnerShare: number; partnerName: string; partnerGender: string | null }) {
  const words = partnerWords(plate.partnerName, plate.partnerGender);
  if (plate.status === 'PENDING') return `Waiting for ${words.object}`;
  if (plate.status === 'DECLINED') return `${words.subject} passed on this one \u00b7 Yours is still logged`;
  if (plate.mode === 'COPY') return `${words.subject} accepted \u00b7 ${words.possessive} own serving`;
  return `${words.subject} accepted \u00b7 You ${percent(1 - plate.partnerShare)}, ${words.object} ${percent(plate.partnerShare)}`;
}

export function dayKeyInZone(date: Date, timeZone?: string | null) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(date);
    const part = (type: string) => parts.find((entry) => entry.type === type)?.value;
    if (part('year') && part('month') && part('day')) return `${part('year')}-${part('month')}-${part('day')}`;
  } catch {}
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const MEAL_LABEL: Record<string, string> = { BREAKFAST: 'breakfast', LUNCH: 'lunch', DINNER: 'dinner', SNACK: 'a snack' };
export const mealLabel = (mealType: string) => MEAL_LABEL[mealType.toUpperCase()] ?? 'a meal';
