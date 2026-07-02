import { Router } from 'express';
import { prisma } from '../db/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { getTodayUtcMidnight } from '../utils/date';
import { emitStepUpdateToPartner } from '../socket';
import { pushPartnerSurfaceUpdateForChangedUser } from '../lib/partnerSurface';

const router = Router();

function parseDayKey(dayKey: string): { year: number; month: number; day: number } {
  const [year, month, day] = dayKey.split('-').map(Number);
  return { year, month, day };
}

function dayKeyToUtcDate(dayKey: string): Date {
  const { year, month, day } = parseDayKey(dayKey);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function utcDateToDayKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dayKeyInTimezone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find(p => p.type === 'year')?.value ?? '1970';
  const month = parts.find(p => p.type === 'month')?.value ?? '01';
  const day = parts.find(p => p.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

function addDaysToDayKey(dayKey: string, delta: number): string {
  const d = dayKeyToUtcDate(dayKey);
  d.setUTCDate(d.getUTCDate() + delta);
  return utcDateToDayKey(d);
}

function offsetMinutesForTimezone(date: Date, timezone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
      hour: '2-digit',
    }).formatToParts(date);
    const offsetPart = parts.find(p => p.type === 'timeZoneName')?.value ?? 'GMT+0';
    const m = offsetPart.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
    if (!m) return 0;
    const sign = m[1] === '-' ? -1 : 1;
    const hours = Number(m[2] || 0);
    const minutes = Number(m[3] || 0);
    return sign * (hours * 60 + minutes);
  } catch {
    return 0;
  }
}

function getNextMidnightUtcIso(timezone: string, now: Date): string {
  const todayKey = dayKeyInTimezone(now, timezone);
  const tomorrowKey = addDaysToDayKey(todayKey, 1);
  const { year, month, day } = parseDayKey(tomorrowKey);
  const baseUtc = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  const offsetMinutes = offsetMinutesForTimezone(baseUtc, timezone);
  const midnightUtc = new Date(baseUtc.getTime() - offsetMinutes * 60_000);
  return midnightUtc.toISOString();
}

async function getStepsByDayKey(userId: string, dayKey: string): Promise<number> {
  const date = dayKeyToUtcDate(dayKey);
  const row = await prisma.dailyStep.findUnique({
    where: { userId_date: { userId, date } },
    select: { steps: true },
  });
  return row?.steps ?? 0;
}

async function getStepMapByDayKeys(userId: string, dayKeys: string[]): Promise<Map<string, number>> {
  const uniqueDayKeys = [...new Set(dayKeys)];
  const dates = uniqueDayKeys.map(dayKeyToUtcDate);
  const rows = await prisma.dailyStep.findMany({
    where: { userId, date: { in: dates } },
    select: { date: true, steps: true },
  });
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(utcDateToDayKey(row.date), row.steps);
  }
  return map;
}

function formatCountdown(ms: number): string {
  const clamped = Math.max(0, ms);
  const totalMinutes = Math.floor(clamped / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

// GET /activity/steps/tracer-state
// Returns transition-aware state for StepTracer UI
router.get('/steps/tracer-state', authMiddleware, async (req, res, next) => {
  try {
    const userId = (req as AuthRequest).user!.id;
    const now = new Date();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        timezone: true,
        partnerId: true,
        partner: {
          select: {
            id: true,
            displayName: true,
            timezone: true,
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.partnerId || !user.partner) {
      return res.json({
        hasPartner: false,
        participants: null,
        transition: { isSplitDay: false, countdownToUtc: null, countdownLabel: null },
        comparison: { mode: 'LIVE', youSteps: 0, partnerSteps: 0 },
        yesterday: { winner: 'TIE', youSteps: 0, partnerSteps: 0 },
        lastMonth: { youWins: 0, partnerWins: 0, ties: 0, comparedDays: 0 },
      });
    }

    const youTimezone = user.timezone || 'UTC';
    const partnerTimezone = user.partner.timezone || 'UTC';

    const youTodayKey = dayKeyInTimezone(now, youTimezone);
    const partnerTodayKey = dayKeyInTimezone(now, partnerTimezone);
    const youYesterdayKey = addDaysToDayKey(youTodayKey, -1);
    const partnerYesterdayKey = addDaysToDayKey(partnerTodayKey, -1);

    const [
      youLiveTodaySteps,
      partnerLiveTodaySteps,
      youLastDaySteps,
      partnerLastDaySteps
    ] = await Promise.all([
      getStepsByDayKey(user.id, youTodayKey),
      getStepsByDayKey(user.partner.id, partnerTodayKey),
      getStepsByDayKey(user.id, youYesterdayKey),
      getStepsByDayKey(user.partner.id, partnerYesterdayKey),
    ]);

    const youNextMidnightUtc = getNextMidnightUtcIso(youTimezone, now);
    const partnerNextMidnightUtc = getNextMidnightUtcIso(partnerTimezone, now);

    const isSplitDay = youTodayKey !== partnerTodayKey;
    const youRemaining = new Date(youNextMidnightUtc).getTime() - now.getTime();
    const partnerRemaining = new Date(partnerNextMidnightUtc).getTime() - now.getTime();
    const countdownTarget = youRemaining <= partnerRemaining
      ? { name: user.displayName, utc: youNextMidnightUtc, ms: youRemaining }
      : { name: user.partner.displayName, utc: partnerNextMidnightUtc, ms: partnerRemaining };

    const comparisonMode = isSplitDay ? 'PREVIOUS_DAY_PINNED' : 'LIVE';
    const comparison = {
      mode: comparisonMode,
      youSteps: isSplitDay ? youLastDaySteps : youLiveTodaySteps,
      partnerSteps: isSplitDay ? partnerLastDaySteps : partnerLiveTodaySteps,
    };

    const yesterdayWinner = youLastDaySteps > partnerLastDaySteps
      ? 'YOU'
      : partnerLastDaySteps > youLastDaySteps
        ? 'PARTNER'
        : 'TIE';

    // Rolling 30-day window, inclusive of today, using stable UTC-noon anchors.
    const youRollingDayKeys: string[] = [];
    const partnerRollingDayKeys: string[] = [];
    const pairedRollingDays: Array<{ youDayKey: string; partnerDayKey: string }> = [];

    for (let offset = 29; offset >= 0; offset--) {
      const anchorDay = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - offset,
        12,
        0,
        0,
        0
      ));
      const yk = dayKeyInTimezone(anchorDay, youTimezone);
      const pk = dayKeyInTimezone(anchorDay, partnerTimezone);
      youRollingDayKeys.push(yk);
      partnerRollingDayKeys.push(pk);
      pairedRollingDays.push({ youDayKey: yk, partnerDayKey: pk });
    }

    const [youMonthMap, partnerMonthMap] = await Promise.all([
      getStepMapByDayKeys(user.id, youRollingDayKeys),
      getStepMapByDayKeys(user.partner.id, partnerRollingDayKeys),
    ]);

    let youWins = 0;
    let partnerWins = 0;
    let ties = 0;
    const dayBreakdown: Array<{
      dayKey: string;
      youSteps: number;
      partnerSteps: number;
      winner: 'YOU' | 'PARTNER' | 'TIE';
    }> = [];

    for (const pair of pairedRollingDays) {
      const ys = youMonthMap.get(pair.youDayKey) ?? 0;
      const ps = partnerMonthMap.get(pair.partnerDayKey) ?? 0;
      let winner: 'YOU' | 'PARTNER' | 'TIE' = 'TIE';
      if (ys > ps) {
        youWins += 1;
        winner = 'YOU';
      } else if (ps > ys) {
        partnerWins += 1;
        winner = 'PARTNER';
      } else {
        ties += 1;
      }
      dayBreakdown.push({
        dayKey: pair.youDayKey,
        youSteps: ys,
        partnerSteps: ps,
        winner,
      });
    }

    return res.json({
      hasPartner: true,
      participants: {
        you: {
          name: user.displayName || 'You',
          timezone: youTimezone,
          liveTodaySteps: youLiveTodaySteps,
          lastDaySteps: youLastDaySteps,
          nextMidnightUtc: youNextMidnightUtc,
        },
        partner: {
          name: user.partner.displayName || 'Partner',
          timezone: partnerTimezone,
          liveTodaySteps: partnerLiveTodaySteps,
          lastDaySteps: partnerLastDaySteps,
          nextMidnightUtc: partnerNextMidnightUtc,
        }
      },
      transition: {
        isSplitDay,
        countdownToUtc: isSplitDay ? countdownTarget.utc : null,
        countdownLabel: isSplitDay ? `${countdownTarget.name}'s day ends in ${formatCountdown(countdownTarget.ms)}` : null,
      },
      comparison,
      yesterday: {
        winner: yesterdayWinner,
        youSteps: youLastDaySteps,
        partnerSteps: partnerLastDaySteps,
      },
      lastMonth: {
        youWins,
        partnerWins,
        ties,
        comparedDays: pairedRollingDays.length,
        days: dayBreakdown,
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /activity/steps/today
// Accepts optional ?dayKey=YYYY-MM-DD query param (client's local date)
router.get('/steps/today', authMiddleware, async (req, res, next) => {
  try {
    const userId = (req as AuthRequest).user!.id;
    const dayKeyParam = req.query.dayKey as string | undefined;

    // Use client's dayKey if provided, otherwise fall back to UTC
    let dateForQuery: Date;
    if (dayKeyParam && typeof dayKeyParam === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dayKeyParam)) {
      const [year, month, day] = dayKeyParam.split('-').map(Number);
      dateForQuery = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    } else {
      dateForQuery = getTodayUtcMidnight();
    }

    const record = await prisma.dailyStep.findUnique({
      where: {
        userId_date: {
          userId,
          date: dateForQuery,
        },
      },
    });

    res.json({
      date: dateForQuery.toISOString(),
      steps: record?.steps ?? 0,
    });
  } catch (err) {
    next(err);
  }
});

// POST /activity/steps/sync
// body: { delta: number, eventId: string, dayKey: string, createdAt: string }
// Idempotent: eventId is used to prevent duplicate processing
router.post('/steps/sync', authMiddleware, async (req, res, next) => {
  try {
    const userId = (req as AuthRequest).user!.id;
    const { delta, eventId, dayKey, createdAt } = req.body;

    const parsedDelta = Number(delta) || 0;
    if (parsedDelta <= 0) {
      return res.status(400).json({ error: 'delta must be > 0' });
    }

    // Validate required fields for idempotent sync
    if (!eventId || typeof eventId !== 'string') {
      return res.status(400).json({ error: 'eventId is required' });
    }

    // Use dayKey from client (YYYY-MM-DD in their local timezone)
    // Fall back to server's UTC date if not provided
    let dateForRecord: Date;
    if (dayKey && typeof dayKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dayKey)) {
      // Parse as UTC midnight for that date
      const [year, month, day] = dayKey.split('-').map(Number);
      dateForRecord = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    } else {
      dateForRecord = getTodayUtcMidnight();
    }

    // Use transaction with duplicate handling to prevent race conditions
    let result;
    let deduplicated = false;

    try {
      result = await prisma.$transaction(async (tx) => {
        // Check for duplicate event inside transaction
        const existingEvent = await tx.stepSyncEvent.findUnique({
          where: {
            userId_eventId: { userId, eventId },
          },
        });

        if (existingEvent) {
          // Already processed - return current count
          const currentRecord = await tx.dailyStep.findUnique({
            where: { userId_date: { userId, date: dateForRecord } },
          });
          return { steps: currentRecord?.steps ?? 0, date: dateForRecord, deduplicated: true };
        }

        // Record the event for future dedupe
        await tx.stepSyncEvent.create({
          data: {
            eventId,
            userId,
            dayKey: dayKey || dateForRecord.toISOString().split('T')[0],
            delta: parsedDelta,
          },
        });

        // Upsert the daily step count
        const record = await tx.dailyStep.upsert({
          where: {
            userId_date: { userId, date: dateForRecord },
          },
          create: {
            userId,
            date: dateForRecord,
            steps: parsedDelta,
          },
          update: {
            steps: { increment: parsedDelta },
          },
        });

        return { ...record, deduplicated: false };
      });

      deduplicated = result.deduplicated;
    } catch (err: any) {
      // Handle race condition where duplicate was inserted between check and create
      if (err?.code === 'P2002' && err?.meta?.target?.includes('eventId')) {
        const currentRecord = await prisma.dailyStep.findUnique({
          where: { userId_date: { userId, date: dateForRecord } },
        });
        return res.json({
          date: dateForRecord.toISOString(),
          steps: currentRecord?.steps ?? 0,
          deduplicated: true,
        });
      }
      throw err; // Re-throw other errors
    }

    if (deduplicated) {
      return res.json({
        date: result.date.toISOString(),
        steps: result.steps,
        deduplicated: true,
      });
    }

    res.json({ date: result.date.toISOString(), steps: result.steps });

    // Emit real-time update to partner via Socket.IO
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { displayName: true }
      });

      if (user) {
        emitStepUpdateToPartner(userId, result.steps, user.displayName);
      }
    } catch (socketErr) {
      // Don't fail the request if socket emit fails
      console.error('[Steps] Socket emit error:', socketErr);
    }

    void pushPartnerSurfaceUpdateForChangedUser(userId, 'steps_synced');
  } catch (err) {
    next(err);
  }
});

// PUT /activity/steps/correct
// body: { steps: number, dayKey: string }
// Used to correct server when it has drifted above OS step count
router.put('/steps/correct', authMiddleware, async (req, res, next) => {
  try {
    const userId = (req as AuthRequest).user!.id;
    const { steps: absoluteSteps, dayKey } = req.body;

    const parsedSteps = Number(absoluteSteps);
    if (!Number.isFinite(parsedSteps) || parsedSteps < 0) {
      return res.status(400).json({ error: 'steps must be a non-negative number' });
    }

    // Use dayKey from client (YYYY-MM-DD in their local timezone)
    let dateForRecord: Date;
    if (dayKey && typeof dayKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dayKey)) {
      const [year, month, day] = dayKey.split('-').map(Number);
      dateForRecord = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    } else {
      dateForRecord = getTodayUtcMidnight();
    }

    // Upsert with absolute value
    const record = await prisma.dailyStep.upsert({
      where: {
        userId_date: { userId, date: dateForRecord },
      },
      create: {
        userId,
        date: dateForRecord,
        steps: parsedSteps,
      },
      update: {
        steps: parsedSteps,
      },
    });

    console.log(`[Steps] Corrected steps for user ${userId} to ${parsedSteps} for ${dayKey}`);

    res.json({ date: record.date.toISOString(), steps: record.steps });

    // Emit real-time update to partner via Socket.IO
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { displayName: true }
      });

      if (user) {
        emitStepUpdateToPartner(userId, record.steps, user.displayName);
      }
    } catch (socketErr) {
      console.error('[Steps] Socket emit error:', socketErr);
    }

    void pushPartnerSurfaceUpdateForChangedUser(userId, 'steps_corrected');
  } catch (err) {
    next(err);
  }
});

// POST /activity/steps/backfill
// body: { days: [{ dayKey: "YYYY-MM-DD", steps: number }] }
// Batch upsert historical step data from health APIs (for days app wasn't opened)
router.post('/steps/backfill', authMiddleware, async (req, res, next) => {
  try {
    const userId = (req as AuthRequest).user!.id;
    const { days } = req.body;

    if (!Array.isArray(days) || days.length === 0) {
      return res.status(400).json({ error: 'days must be a non-empty array' });
    }

    // Limit to 14 days max to prevent abuse
    const validDays = days.slice(0, 14).filter(
      (d: any) => d.dayKey && /^\d{4}-\d{2}-\d{2}$/.test(d.dayKey) && typeof d.steps === 'number' && d.steps >= 0
    );

    const results: { dayKey: string; steps: number }[] = [];

    for (const day of validDays) {
      const [year, month, d] = day.dayKey.split('-').map(Number);
      const dateForRecord = new Date(Date.UTC(year, month - 1, d, 0, 0, 0, 0));

      // Only upsert if we don't already have data OR the health data is higher
      const existing = await prisma.dailyStep.findUnique({
        where: { userId_date: { userId, date: dateForRecord } },
      });

      if (!existing || existing.steps < day.steps) {
        const record = await prisma.dailyStep.upsert({
          where: { userId_date: { userId, date: dateForRecord } },
          create: {
            userId,
            date: dateForRecord,
            steps: Math.round(day.steps),
          },
          update: {
            steps: Math.round(day.steps),
          },
        });
        results.push({ dayKey: day.dayKey, steps: record.steps });

        // Also update the daily summary steps if it exists
        await prisma.dailySummary.updateMany({
          where: { userId, dayKey: day.dayKey },
          data: { steps: Math.round(day.steps) },
        });
      } else {
        results.push({ dayKey: day.dayKey, steps: existing.steps });
      }
    }

    console.log(`[Steps] Backfilled ${results.length} days for user ${userId}`);
    res.json({ backfilled: results });
  } catch (err) {
    next(err);
  }
});

// GET /activity/steps/history?from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns step counts for a date range
router.get('/steps/history', authMiddleware, async (req, res, next) => {
  try {
    const userId = (req as AuthRequest).user!.id;
    const from = req.query.from as string;
    const to = req.query.to as string;

    if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return res.status(400).json({ error: 'from and to query params must be YYYY-MM-DD' });
    }

    // Generate date range
    const startDate = new Date(from + 'T00:00:00Z');
    const endDate = new Date(to + 'T00:00:00Z');

    const records = await prisma.dailyStep.findMany({
      where: {
        userId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { date: 'asc' },
    });

    // Build a map for the full range
    const history: { dayKey: string; steps: number }[] = [];
    for (let d = new Date(startDate); d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      const dk = `${y}-${m}-${day}`;

      const record = records.find(r => {
        const rd = new Date(r.date);
        return rd.getUTCFullYear() === d.getUTCFullYear()
          && rd.getUTCMonth() === d.getUTCMonth()
          && rd.getUTCDate() === d.getUTCDate();
      });

      history.push({ dayKey: dk, steps: record?.steps ?? 0 });
    }

    res.json({ history });
  } catch (err) {
    next(err);
  }
});

export default router;
