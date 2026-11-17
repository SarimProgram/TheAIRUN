/** Keep in sync with app/lib/meal-pass.ts: both sides must compute identical portions. */
export type PlateItem = {
    foodName: string;
    calories: number;
    grams?: number | null;
    proteinG?: number | null;
    carbsG?: number | null;
    fatG?: number | null;
};

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
export function senderPortion(items: PlateItem[], shares: number[], mode: 'SPLIT' | 'COPY'): PlateItem[] {
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

export function plateTotals(items: PlateItem[]) {
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
