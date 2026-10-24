# Expected Weight Curve: Before vs After

Comparison for **sarim@runtogether.fit** using the stored weekly food/activity plan.

Profile: 95 kg → 78 kg, 180 cm, 25 years, male, ACTIVE intensity, AGGRESSIVE pace, walkOnly.

## What changed in the backend

| Area | Before | After |
|------|--------|-------|
| Expected weight source | AI-generated, then last week forced to goal weight | Computed from food, steps, walks, and dynamic TDEE |
| Week 1 logic | Same loss as later weeks despite higher calories | Lower loss when calories are higher |
| Last week | Artificial −1.9 kg snap to hit 78 kg | Smooth progression; goal reached without a cliff |
| TDEE | Effectively static (starting weight) | Recalculated each week as weight drops |
| Manual plan tweaks | Heuristic nudge to expected weight | Full curve recomputed from updated calories/activity |

Implementation: `backend/src/services/planning/expectedWeight.ts`, applied in `plan.routes.ts` after AI weekly plan generation.

---

## Week-by-week comparison

| Week | Food kcal/day | Before expected wt | Before weekly loss | After expected wt | After weekly loss |
|-----:|--------------:|-------------------:|-------------------:|------------------:|------------------:|
| 1 | 2,100 | 94.2 | −0.8 | **94.3** | **−0.7** |
| 2 | 2,050 | 93.4 | −0.8 | **93.5** | **−0.8** |
| 3 | 2,000 | 92.6 | −0.8 | **92.7** | **−0.8** |
| 4 | 1,950 | 91.7 | −0.9 | **91.8** | **−0.9** |
| 5 | 1,900 | 90.8 | −0.9 | **90.9** | **−0.9** |
| 6 | 1,850 | 89.9 | −0.9 | **89.9** | **−1.0** |
| 7 | 1,800 | 89.0 | −0.9 | **88.9** | **−1.0** |
| 8 | 1,750 | 88.0 | −1.0 | **87.9** | **−1.0** |
| 9 | 1,700 | 87.0 | −1.0 | **86.8** | **−1.1** |
| 10 | 1,680 | 86.0 | −1.0 | **85.7** | **−1.1** |
| 11 | 1,660 | 85.0 | −1.0 | **84.6** | **−1.1** |
| 12 | 1,640 | 84.0 | −1.0 | **83.5** | **−1.1** |
| 13 | 1,625 | 83.0 | −1.0 | **82.4** | **−1.1** |
| 14 | 1,610 | 82.0 | −1.0 | **81.3** | **−1.1** |
| 15 | 1,600 | 81.0 | −1.0 | **80.2** | **−1.1** |
| 16 | 1,590 | 79.9 | −1.1 | **79.1** | **−1.1** |
| 17 | 1,600 | 78.0 | **−1.9** | **78.0** | **−1.1** |

**Before** values are from the live database plan generated on 2026-09-09.  
**After** values are from `computeExpectedWeightsFromWeeklyPlan()` using the same food/steps/walk targets.

---

## Summary metrics

| Metric | Before | After |
|--------|-------:|------:|
| Total loss over 17 weeks | 17.0 kg | 17.0 kg |
| Week 1 loss | 0.8 kg | **0.7 kg** |
| Week 17 loss | **1.9 kg** | **1.1 kg** |
| Lag vs 1 kg/week linear model at week 16 | +0.9 kg behind | **+0.1 kg behind** |
| Week 1 loss vs physics (~0.6 kg implied) | Overstated | Closer to physics |

---

## Issues fixed

1. **Week 1 too aggressive** — Higher food in week 1 now maps to a smaller projected drop (−0.7 vs −0.8).
2. **Flat loss despite falling calories** — Weekly loss now steps up as food tightens (0.7 → 0.8 → 0.9 → 1.0 → 1.1).
3. **Fake final-week cliff** — Week 17 no longer shows −1.9 kg on the easiest activity week; loss stays ~1.1 kg.
4. **Cumulative lag then snap** — Curve stays on track through week 16; no 1 kg backlog dumped into week 17.

---

## What did not change

- Food calorie targets per week (still AI-generated)
- Steps and walk volume per week
- Frontend screens (they read `expectedWeight` from the API as before)
- Existing cached plans in the database until regenerated (`POST /plan/generate-weekly?force=true`)

---

## How to regenerate a user plan with the new curve

```bash
# From backend/
npx tsx scripts/check-user-plan.ts sarim@runtogether.fit
```

Trigger a forced weekly plan regeneration for that user via the app or API to persist the new expected weights in the database.
