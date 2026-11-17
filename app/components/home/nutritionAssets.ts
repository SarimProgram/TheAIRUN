import { Image as NativeImage } from 'react-native';
import { Image } from 'expo-image';
import { getOppositeGender, normalizeGender } from '../../utils/genderMascot';
import { nutritionReaction, type NutritionReaction } from './nutritionReaction';

const CHARACTERS: Record<'male' | 'female', Record<NutritionReaction, number>> = {
  male: {
    idle: require('../../assets/avatars/nutrition/male-idle.png'),
    progress: require('../../assets/avatars/nutrition/male-progress.png'),
    winning: require('../../assets/avatars/nutrition/male-winning.png'),
    'over-target': require('../../assets/avatars/nutrition/male-over-target.png'),
  },
  female: {
    idle: require('../../assets/avatars/nutrition/female-idle.png'),
    progress: require('../../assets/avatars/nutrition/female-progress.png'),
    winning: require('../../assets/avatars/nutrition/female-winning.png'),
    'over-target': require('../../assets/avatars/nutrition/female-over-target.png'),
  },
};

export const NUTRITION_FOOD = {
  left: require('../../assets/avatars/nutrition/food-left.png'),
  right: require('../../assets/avatars/nutrition/food-right.png'),
} as const;

export function nutritionCharacterSource(gender: 'male' | 'female', reaction: NutritionReaction): number {
  return CHARACTERS[gender][reaction];
}

type NutritionTotals = Parameters<typeof nutritionReaction>[0];
type Selection = { mine: NutritionTotals; partner: NutritionTotals; gender?: string | null; partnerGender?: string | null };

export function currentNutritionArtwork({ mine, partner, gender, partnerGender }: Selection): number[] {
  const sources = [
    nutritionCharacterSource(normalizeGender(gender) || 'male', nutritionReaction(mine, partner)),
    nutritionCharacterSource(normalizeGender(partnerGender) || getOppositeGender(gender), nutritionReaction(partner, mine)),
  ];
  if ((mine?.food ?? 0) > 0) sources.push(NUTRITION_FOOD.left);
  if ((partner?.food ?? 0) > 0) sources.push(NUTRITION_FOOD.right);
  return [...new Set(sources)];
}

const requests = new Map<string, Promise<void>>();

// Warm only the selected poses and visible food, never all eight poses or the atlases.
export async function preloadNutritionArtwork(selection: Selection): Promise<void> {
  await Promise.all(currentNutritionArtwork(selection).map(source => {
    const uri = NativeImage.resolveAssetSource(source)?.uri;
    if (!uri) return Promise.resolve();
    const existing = requests.get(uri);
    if (existing) return existing;
    const request = Promise.resolve().then(async () => {
      if (!await Image.prefetch(uri, 'memory-disk')) requests.delete(uri);
    }).catch(() => { requests.delete(uri); });
    requests.set(uri, request);
    return request;
  }));
}
