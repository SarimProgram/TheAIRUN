export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function calendarWeek(dayKey: string): string[] {
  const date = new Date(`${dayKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  return WEEKDAY_LABELS.map((_, index) => {
    const day = new Date(date);
    day.setUTCDate(day.getUTCDate() + index);
    return day.toISOString().slice(0, 10);
  });
}

// Today can extend a streak; an unfinished today does not end yesterday's streak.
export function weeklyStreak(days: string[], today: string, complete: (day: string) => boolean): number {
  let index = days.indexOf(today);
  if (index < 0) return 0;
  if (!complete(today)) index -= 1;
  let count = 0;
  while (index >= 0 && complete(days[index])) { count += 1; index -= 1; }
  return count;
}
