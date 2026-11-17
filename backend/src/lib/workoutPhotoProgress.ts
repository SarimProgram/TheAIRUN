import { getWeekStartMondayDayKey } from './weekBounds';

export function workoutPhotoProgress(days: string[], today: string) {
    const unique = new Set(days.filter(day => day <= today));
    const start = getWeekStartMondayDayKey(today);
    const completedDays = [...unique].filter(day => day >= start).sort();
    const weeklyCount = completedDays.length;
    let cursor = new Date(`${today}T12:00:00Z`);
    const key = () => cursor.toISOString().slice(0, 10);
    if (!unique.has(key())) cursor.setUTCDate(cursor.getUTCDate() - 1);
    let streak = 0;
    while (unique.has(key())) {
        streak++;
        cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
    return { weeklyCount, streak, todayCompleted: unique.has(today), completedDays };
}

export function workoutPhotoVisibility(userId: string, partnerId: string | null) {
    return { OR: [
        { authorUserId: userId },
        ...(partnerId ? [{ authorUserId: partnerId, recipientUserId: userId }] : []),
    ] };
}
