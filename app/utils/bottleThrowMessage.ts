export const BOTTLE_THROW_DEFAULT_TEXT = 'Catch! Drink a glass of water.';
export const BOTTLE_THROWN_BACK_TEXT = 'Thrown back! Your turn to drink a glass.';
export const BOTTLE_CAUGHT_MESSAGE = '[WATER] Caught your bottle and drank a glass 💧';

const BOTTLE_THROW_PATTERN = /^\[WATER\s*:\s*bottle(?:\s*:\s*(\d{1,3}))?\]\s*(.*)$/is;

export type BottleThrow = {
    /** Horizontal position (0–1) the bottle left the sender's screen; the receiver's bottle enters from there. */
    xPct: number;
    text: string;
};

export function buildBottleThrowMessage(xPct: number, text = BOTTLE_THROW_DEFAULT_TEXT): string {
    const pct = Math.round(Math.min(1, Math.max(0, xPct)) * 100);
    return `[WATER:bottle:${pct}] ${text}`;
}

export function parseBottleThrowMessage(content: string): BottleThrow | null {
    const match = content.trim().match(BOTTLE_THROW_PATTERN);
    if (!match) return null;

    const pct = match[1] ? Number(match[1]) : 50;
    return {
        xPct: Math.min(1, Math.max(0, pct / 100)),
        text: (match[2] || '').trim() || BOTTLE_THROW_DEFAULT_TEXT,
    };
}

export function isBottleThrowMessage(content: string): boolean {
    return BOTTLE_THROW_PATTERN.test(content.trim());
}
