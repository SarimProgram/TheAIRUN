import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizePhase16Selections,
  rewardIdToMarketplaceSeed,
} from "./onboardingRewards";
test("new prize options preserve their names and milestone costs", () => {
  const selections = normalizePhase16Selections({
    week1RewardId: "massage",
    week2RewardId: "cook",
    week3RewardId: "custom:Breakfast in bed",
  });
  assert.deepEqual(selections, [
    { rewardId: "massage", cost: 700 },
    { rewardId: "cook", cost: 1400 },
    { rewardId: "custom:Breakfast in bed", cost: 2100 },
  ]);
  assert.equal(
    rewardIdToMarketplaceSeed("custom:Breakfast in bed", 700)?.title,
    "Breakfast in bed",
  );
  assert.equal(
    rewardIdToMarketplaceSeed("money:25.50", 700)?.title,
    "$25.50 money reward",
  );
  assert.equal(
    rewardIdToMarketplaceSeed("money:99999", 700)?.title,
    "$99,999 money reward",
  );
});
test("invalid custom and money values never create rewards", () => {
  for (const value of [
    "custom:",
    "custom:   ",
    `custom:${"a".repeat(41)}`,
    "money:0",
    "money:-5",
    "money:NaN",
    "money:100000",
    "money:1.234",
    "money:1e3",
    "toString",
    "__proto__",
  ]) {
    assert.equal(rewardIdToMarketplaceSeed(value, 700), null, value);
    assert.deepEqual(
      normalizePhase16Selections({ week1RewardId: value }),
      [],
      value,
    );
  }
});
test("legacy options, skipping and reward deduplication still work", () => {
  assert.equal(
    rewardIdToMarketplaceSeed("coffee", 700)?.title,
    "Coffee / Treat",
  );
  assert.deepEqual(
    normalizePhase16Selections({ skipped: true, week1RewardId: "massage" }),
    [],
  );
  assert.deepEqual(
    normalizePhase16Selections({
      week1RewardId: "massage",
      week2RewardId: "massage",
    }),
    [{ rewardId: "massage", cost: 700 }],
  );
});
