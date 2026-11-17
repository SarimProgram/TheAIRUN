import { Platform } from 'react-native';

import {
  getDatabase,
  getLastWaterLog,
  getTimeBucket,
  getTodayWaterTotal,
  insertWaterLog,
} from '@/db/offlineDb';
import { DEFAULT_WATER_TARGET_ML, notifyWaterListeners } from '@/hooks/useWaterSync';
import type { WaterWidgetProps } from '@/widgets/WaterWidget';

type WidgetTap = { id: string; ml: number; at: string };

type WaterWidgetController = {
  getTimeline: () => Promise<{ date: Date; props: Partial<WaterWidgetProps> }[]>;
  updateTimeline: (entries: { date: Date; props: WaterWidgetProps }[]) => void;
};

let waterWidgetController: WaterWidgetController | null | undefined;
let inFlight: Promise<void> | null = null;
let rerunRequested = false;

function getWaterWidgetController(): WaterWidgetController | null {
  if (waterWidgetController !== undefined) {
    return waterWidgetController;
  }

  if (Platform.OS !== 'ios') {
    waterWidgetController = null;
    return waterWidgetController;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@/widgets/WaterWidget') as {
      WaterWidget?: WaterWidgetController;
      default?: WaterWidgetController;
    };
    waterWidgetController = mod.WaterWidget ?? mod.default ?? null;
  } catch {
    waterWidgetController = null;
  }

  return waterWidgetController;
}

function dayKeyLocal(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function nextLocalMidnight(from: Date): Date {
  const d = new Date(from);
  d.setHours(24, 0, 0, 0);
  return d;
}

function parseTaps(raw: unknown): WidgetTap[] {
  if (typeof raw !== 'string' || !raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (tap): tap is WidgetTap =>
        typeof tap?.id === 'string' &&
        Number.isFinite(tap?.ml) &&
        tap.ml > 0 &&
        !Number.isNaN(new Date(tap?.at).getTime()),
    );
  } catch {
    return [];
  }
}

/** A tap can sit in either timeline entry (before or after midnight), so merge both by id. */
async function collectWidgetTaps(widget: WaterWidgetController): Promise<WidgetTap[]> {
  const entries = await widget.getTimeline().catch(() => []);
  const byId = new Map<string, WidgetTap>();
  for (const entry of entries) {
    for (const tap of parseTaps(entry.props?.pendingTaps)) {
      byId.set(tap.id, tap);
    }
  }
  return [...byId.values()];
}

async function importWidgetTaps(taps: WidgetTap[]): Promise<number> {
  let imported = 0;
  const createdAt = new Date().toISOString();

  for (const tap of taps) {
    const at = new Date(tap.at);
    try {
      await insertWaterLog({
        id: tap.id,
        dayKey: dayKeyLocal(at),
        timeBucket: getTimeBucket(at),
        amountMl: Math.round(tap.ml),
        loggedAt: at.toISOString(),
        createdAt,
      });
      imported += 1;
    } catch {
      // Duplicate primary key: this tap was imported by an earlier sync.
    }
  }

  return imported;
}

async function runWaterWidgetSync() {
  const widget = getWaterWidgetController();
  if (!widget) return;

  await getDatabase();

  const taps = await collectWidgetTaps(widget);
  const imported = await importWidgetTaps(taps);
  const handledIds = new Set(taps.map((tap) => tap.id));

  const now = new Date();
  const today = dayKeyLocal(now);
  const [totalMl, lastLog] = await Promise.all([getTodayWaterTotal(today), getLastWaterLog(today)]);

  // Taps made on the widget while we were importing stay pending for the next pass.
  const lateTaps = (await collectWidgetTaps(widget)).filter((tap) => !handledIds.has(tap.id));
  const lateTodayMl = lateTaps
    .filter((tap) => dayKeyLocal(new Date(tap.at)) === today)
    .reduce((sum, tap) => sum + tap.ml, 0);
  const lastLoggedAt =
    [lastLog?.loggedAt, ...lateTaps.map((tap) => tap.at)]
      .filter((value): value is string => Boolean(value))
      .sort()
      .pop() ?? '';

  const props: WaterWidgetProps = {
    waterMl: totalMl + lateTodayMl,
    goalMl: DEFAULT_WATER_TARGET_ML,
    dayKey: today,
    lastLoggedAt,
    pendingTaps: JSON.stringify(lateTaps),
  };

  // The midnight entry carries the same props; the widget renders it as a fresh day.
  widget.updateTimeline([
    { date: now, props },
    { date: nextLocalMidnight(now), props },
  ]);

  if (lateTaps.length > 0) {
    rerunRequested = true;
  }
  if (imported > 0) {
    notifyWaterListeners();
  }
}

/**
 * Imports water logged from the home screen widget into SQLite, then pushes
 * today's total back to the widget. Safe to call often; concurrent calls coalesce.
 */
export function syncWaterWidget(): Promise<void> {
  if (Platform.OS !== 'ios') {
    return Promise.resolve();
  }

  if (inFlight) {
    rerunRequested = true;
    return inFlight;
  }

  inFlight = (async () => {
    try {
      do {
        rerunRequested = false;
        await runWaterWidgetSync();
      } while (rerunRequested);
    } catch (error) {
      console.warn('[WaterWidget] Sync failed:', error);
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}
