function parseDayKey(dayKey: string): { year: number; month: number; day: number } {
    const [year, month, day] = dayKey.split('-').map(Number);
    return { year, month, day };
}

export function dayKeyToUtcDate(dayKey: string): Date {
    const { year, month, day } = parseDayKey(dayKey);
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function utcDateToDayKey(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function dayKeyInTimezone(date: Date, timezone: string): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);

    const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
    const month = parts.find((part) => part.type === 'month')?.value ?? '01';
    const day = parts.find((part) => part.type === 'day')?.value ?? '01';
    return `${year}-${month}-${day}`;
}

function addDaysToDayKey(dayKey: string, delta: number): string {
    const date = dayKeyToUtcDate(dayKey);
    date.setUTCDate(date.getUTCDate() + delta);
    return utcDateToDayKey(date);
}

export function getWeekStartMondayDayKey(dayKey: string): string {
    const date = dayKeyToUtcDate(dayKey);
    const dayOfWeek = date.getUTCDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    date.setUTCDate(date.getUTCDate() + mondayOffset);
    return utcDateToDayKey(date);
}

function offsetMinutesForTimezone(date: Date, timezone: string): number {
    try {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            timeZoneName: 'shortOffset',
            hour: '2-digit',
        }).formatToParts(date);

        const offsetPart = parts.find((part) => part.type === 'timeZoneName')?.value ?? 'GMT+0';
        const match = offsetPart.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
        if (!match) return 0;

        const sign = match[1] === '-' ? -1 : 1;
        const hours = Number(match[2] || 0);
        const minutes = Number(match[3] || 0);
        return sign * (hours * 60 + minutes);
    } catch {
        return 0;
    }
}

function getLocalMidnightUtc(dayKey: string, timezone: string): Date {
    const { year, month, day } = parseDayKey(dayKey);
    const baseUtc = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    const offsetMinutes = offsetMinutesForTimezone(baseUtc, timezone);
    return new Date(baseUtc.getTime() - offsetMinutes * 60_000);
}

function getNextMidnightUtc(timezone: string, now: Date): Date {
    const todayKey = dayKeyInTimezone(now, timezone);
    const tomorrowKey = addDaysToDayKey(todayKey, 1);
    return getLocalMidnightUtc(tomorrowKey, timezone);
}

export function getLaterEndingTimezone(timezoneA?: string | null, timezoneB?: string | null, now: Date = new Date()): string {
    const left = timezoneA || 'UTC';
    const right = timezoneB || 'UTC';
    const leftDayEnd = getNextMidnightUtc(left, now).getTime();
    const rightDayEnd = getNextMidnightUtc(right, now).getTime();
    return leftDayEnd >= rightDayEnd ? left : right;
}

export function getCurrentWeekBounds(timezoneA?: string | null, timezoneB?: string | null, now: Date = new Date()): { weekStart: Date; weekEnd: Date; timezone: string } {
    const timezone = getLaterEndingTimezone(timezoneA, timezoneB, now);
    const todayKey = dayKeyInTimezone(now, timezone);
    const weekStartKey = getWeekStartMondayDayKey(todayKey);
    const nextWeekStartKey = addDaysToDayKey(weekStartKey, 7);
    const weekStart = getLocalMidnightUtc(weekStartKey, timezone);
    const weekEnd = new Date(getLocalMidnightUtc(nextWeekStartKey, timezone).getTime() - 1);

    return { weekStart, weekEnd, timezone };
}

export function getWeekDayKeysForRange(weekStart: Date, weekEnd: Date, timezone: string): string[] {
    const startDayKey = dayKeyInTimezone(weekStart, timezone);
    const endDayKey = dayKeyInTimezone(weekEnd, timezone);
    const dayKeys: string[] = [];
    let cursor = startDayKey;

    while (cursor <= endDayKey) {
        dayKeys.push(cursor);
        cursor = addDaysToDayKey(cursor, 1);
    }

    return dayKeys;
}

