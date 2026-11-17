import { useEffect, useRef } from 'react';
import type { PointCategory, PointCategoryKey } from './useDailyPoints';

// Home and Plan can both be mounted; only one should submit each award at a time.
const pending = new Set<string>();

export function useAutomaticDailyRewards({ accessToken, dayKey, categories, enabled, claimPoints }: {
  accessToken: string | null;
  dayKey: string;
  categories: PointCategory[];
  enabled: boolean;
  claimPoints: (category: PointCategoryKey) => Promise<boolean>;
}) {
  const latest = useRef({ categories, claimPoints, enabled });
  latest.current = { categories, claimPoints, enabled };
  const eligible = categories.filter(category => category.isAvailable && !category.isAwarded && (category.claimable ?? category.progress >= 1)).map(category => category.key).join(',');

  useEffect(() => {
    if (!accessToken || !dayKey || !enabled || !eligible) return;
    let active = true;
    const collect = async () => {
      for (const category of latest.current.categories) {
        if (!active || !latest.current.enabled) return;
        if (!category.isAvailable || category.isAwarded || !(category.claimable ?? category.progress >= 1)) continue;
        const key = `${accessToken}:${dayKey}:${category.key}`;
        if (pending.has(key)) continue;
        pending.add(key);
        try { await latest.current.claimPoints(category.key); }
        finally { pending.delete(key); }
      }
    };
    void collect();
    // Retry offline/failed awards without requiring another user action.
    const timer = setInterval(() => { void collect(); }, 15_000);
    return () => { active = false; clearInterval(timer); };
  }, [accessToken, dayKey, enabled, eligible]);
}
