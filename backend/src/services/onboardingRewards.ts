import prisma from '../db/prisma';

type RewardCategory = 'Romantic' | 'Fun' | 'Chore' | 'Spicy';

export type Phase16Selections = {
  week1RewardId?: string | null;
  week2RewardId?: string | null;
  week3RewardId?: string | null;
  skipped?: boolean;
};

type NormalizedReward = {
  rewardId: string;
  cost: number;
};

type RewardSeed = {
  title: string;
  category: RewardCategory;
  emoji: string;
  colorFrom: string;
  colorTo: string;
};

const WEEK_POINTS = {
  week1RewardId: 700,
  week2RewardId: 1400,
  week3RewardId: 2100,
} as const;

const REWARD_MAP: Record<string, RewardSeed> = {
  coffee: { title: 'Coffee / Treat', category: 'Fun', emoji: '\u2615', colorFrom: '#FDE68A', colorTo: '#F59E0B' },
  movie: { title: 'Movie Night', category: 'Fun', emoji: '\u{1F3AC}', colorFrom: '#C4B5FD', colorTo: '#8B5CF6' },
  gift: { title: 'Surprise Gift', category: 'Romantic', emoji: '\u{1F381}', colorFrom: '#FBCFE8', colorTo: '#F472B6' },
  date: { title: 'Special Date', category: 'Romantic', emoji: '\u{1F4C5}', colorFrom: '#FDA4AF', colorTo: '#FB7185' },
  heart: { title: 'Quality Time', category: 'Romantic', emoji: '\u2764\uFE0F', colorFrom: '#FECACA', colorTo: '#EF4444' },
  trophy: { title: 'Bigger Prize', category: 'Fun', emoji: '\u{1F3C6}', colorFrom: '#BFDBFE', colorTo: '#3B82F6' },
};

function getPairKey(userAId: string, userBId: string): string {
  return [userAId, userBId].sort((a, b) => a.localeCompare(b)).join(':');
}

export function normalizePhase16Selections(selections: Phase16Selections): NormalizedReward[] {
  if (selections.skipped) return [];

  const costsByReward = new Map<string, number>();
  (Object.keys(WEEK_POINTS) as Array<keyof typeof WEEK_POINTS>).forEach((weekKey) => {
    const rewardId = selections[weekKey];
    if (!rewardId || !REWARD_MAP[rewardId]) return;

    const points = WEEK_POINTS[weekKey];
    const existing = costsByReward.get(rewardId);
    if (existing === undefined || points < existing) {
      costsByReward.set(rewardId, points);
    }
  });

  return Array.from(costsByReward.entries()).map(([rewardId, cost]) => ({ rewardId, cost }));
}

export function rewardIdToMarketplaceSeed(rewardId: string, cost: number) {
  const reward = REWARD_MAP[rewardId];
  if (!reward) return null;

  return {
    title: reward.title,
    description: `Onboarding reward (${cost} points milestone)`,
    cost,
    category: reward.category,
    emoji: reward.emoji,
    colorFrom: reward.colorFrom,
    colorTo: reward.colorTo,
  };
}

export async function syncUserScopedOnboardingRewards(userId: string, selections: Phase16Selections) {
  await prisma.marketplaceItem.updateMany({
    where: {
      source: 'ONBOARDING',
      createdByUserId: userId,
      pairKey: null,
      isActive: true,
    },
    data: { isActive: false },
  });

  const normalized = normalizePhase16Selections(selections);
  if (normalized.length === 0) return [];

  const payload = normalized
    .map((entry, index) => {
      const seed = rewardIdToMarketplaceSeed(entry.rewardId, entry.cost);
      if (!seed) return null;

      return {
        title: seed.title,
        description: seed.description,
        cost: seed.cost,
        category: seed.category,
        emoji: seed.emoji,
        colorFrom: seed.colorFrom,
        colorTo: seed.colorTo,
        sortOrder: 900 + index,
        isCustom: true,
        source: 'ONBOARDING' as const,
        pairKey: null,
        createdByUserId: userId,
        isActive: true,
      };
    })
    .filter(Boolean) as Array<any>;

  if (payload.length > 0) {
    await prisma.marketplaceItem.createMany({ data: payload });
  }

  return payload;
}

export async function promoteToPairOnboardingRewards(
  userAId: string,
  userBId: string,
  ownerSelection: Phase16Selections & { ownerUserId: string }
) {
  const pairKey = getPairKey(userAId, userBId);

  await prisma.marketplaceItem.updateMany({
    where: { source: 'ONBOARDING', pairKey, isActive: true },
    data: { isActive: false },
  });

  await prisma.marketplaceItem.updateMany({
    where: {
      source: 'ONBOARDING',
      pairKey: null,
      isActive: true,
      createdByUserId: { in: [userAId, userBId] },
    },
    data: { isActive: false },
  });

  const normalized = normalizePhase16Selections(ownerSelection);
  if (normalized.length === 0) return [];

  const payload = normalized
    .map((entry, index) => {
      const seed = rewardIdToMarketplaceSeed(entry.rewardId, entry.cost);
      if (!seed) return null;

      return {
        title: seed.title,
        description: seed.description,
        cost: seed.cost,
        category: seed.category,
        emoji: seed.emoji,
        colorFrom: seed.colorFrom,
        colorTo: seed.colorTo,
        sortOrder: 900 + index,
        isCustom: true,
        source: 'ONBOARDING' as const,
        pairKey,
        createdByUserId: ownerSelection.ownerUserId,
        isActive: true,
      };
    })
    .filter(Boolean) as Array<any>;

  if (payload.length > 0) {
    await prisma.marketplaceItem.createMany({ data: payload });
  }

  return payload;
}

