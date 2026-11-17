import { randomInt } from 'node:crypto';

export const CHALLENGE_TARGET_STEPS = 100_000;
// No O/0 or I/1 so codes read cleanly when shared aloud or by text.
export const COUPLE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const COUPLE_CODE_LENGTH = 6;

export type ChallengeType = 'FIRST_TO_100K' | 'MOST_STEPS_WEEK';

export type MemberBaseline = { dayKey: string; steps: number };
export type Baselines = Record<string, MemberBaseline>;

export function generateCoupleCode(pick: (max: number) => number = randomInt): string {
    let code = '';
    for (let i = 0; i < COUPLE_CODE_LENGTH; i += 1) {
        code += COUPLE_CODE_ALPHABET[pick(COUPLE_CODE_ALPHABET.length)];
    }
    return code;
}

export function normalizeCoupleCode(input: string): string {
    return input.replace(/[\s-]/g, '').toUpperCase();
}

export function isValidCoupleCode(code: string): boolean {
    return code.length === COUPLE_CODE_LENGTH && [...code].every(char => COUPLE_CODE_ALPHABET.includes(char));
}

export function coupleName(names: string[]): string {
    return names.map(name => name.trim().split(/\s+/)[0] || 'Partner').join(' & ');
}

/**
 * Steps a member has earned inside the challenge window. Rows are that member's
 * DailyStep totals keyed by their local day. The baseline removes steps that were
 * already on the start day before the challenge began.
 */
export function memberChallengeSteps(
    rows: { dayKey: string; steps: number }[],
    window: { startDayKey: string; endDayKey: string },
    baseline?: MemberBaseline,
): number {
    let total = 0;
    for (const row of rows) {
        if (row.dayKey < window.startDayKey || row.dayKey > window.endDayKey) continue;
        total += row.dayKey === baseline?.dayKey ? Math.max(0, row.steps - baseline.steps) : row.steps;
    }
    return total;
}

export type ChallengeOutcome =
    | { finished: false }
    | { finished: true; winner: 'challenger' | 'opponent' | null; isTie: boolean };

export function evaluateChallenge(params: {
    type: ChallengeType;
    challengerSteps: number;
    opponentSteps: number;
    now: Date;
    endsAt?: Date | null;
}): ChallengeOutcome {
    const { type, challengerSteps, opponentSteps, now, endsAt } = params;
    const finished = type === 'FIRST_TO_100K'
        ? challengerSteps >= CHALLENGE_TARGET_STEPS || opponentSteps >= CHALLENGE_TARGET_STEPS
        : !!endsAt && now.getTime() > endsAt.getTime();
    if (!finished) return { finished: false };
    if (challengerSteps === opponentSteps) return { finished: true, winner: null, isTie: true };
    return { finished: true, winner: challengerSteps > opponentSteps ? 'challenger' : 'opponent', isTie: false };
}
