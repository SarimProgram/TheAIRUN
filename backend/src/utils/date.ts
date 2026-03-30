export function getTodayUtcMidnight(): Date {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const day = now.getUTCDate();
  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
}
