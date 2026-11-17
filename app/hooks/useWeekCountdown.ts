import { useEffect, useState } from 'react';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function localWeekDeadline() {
  const end = new Date();
  end.setDate(end.getDate() + (7 - end.getDay()) % 7);
  end.setHours(23, 59, 59, 999);
  return end.getTime();
}

/** Counts down to the end of the prize week, ticking only while the card is on screen. */
export function useWeekCountdown(weekEnd: string | undefined, active: boolean) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, [active]);

  const parsed = weekEnd ? Date.parse(weekEnd) : NaN;
  const remaining = (Number.isFinite(parsed) ? parsed : localWeekDeadline()) - now;
  const days = Math.floor(remaining / DAY);
  const label = remaining <= 0 ? 'Week ended'
    : remaining < HOUR ? `${Math.max(1, Math.ceil(remaining / 60_000))}m left`
      : remaining < DAY ? `${Math.ceil(remaining / HOUR)}h left`
        : days === 1 ? '1 day left' : `${days} days left`;
  return { remaining, label, urgent: remaining > 0 && remaining < DAY };
}
