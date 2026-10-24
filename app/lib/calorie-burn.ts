export const REFERENCE_WEIGHT_KG = 70;
export const BASE_KCAL_PER_STEP = 0.04;
export const STEPS_PER_KM = 1300;

export type BurnProfile = {
  weightKg?: number | null;
  heightCm?: number | null;
  ageYears?: number | null;
  gender?: string | null;
};

export function resolveWeightKg(profile?: BurnProfile | null, fallback = REFERENCE_WEIGHT_KG): number {
  const weight = profile?.weightKg;
  return weight && weight > 0 ? weight : fallback;
}

export function kcalPerStep(weightKg = REFERENCE_WEIGHT_KG): number {
  const weight = weightKg > 0 ? weightKg : REFERENCE_WEIGHT_KG;
  return BASE_KCAL_PER_STEP * (weight / REFERENCE_WEIGHT_KG);
}

export function estimateDistanceCalories(
  distanceMeters: number,
  workoutType: 'RUN' | 'WALK' | 'INTERVAL' | 'CYCLING' | 'SWIMMING' | 'GYM' | 'OTHER' = 'RUN',
  weightKg = REFERENCE_WEIGHT_KG,
): number {
  const distanceKm = distanceMeters / 1000;
  if (distanceKm <= 0) return 0;

  let factor = 1;
  if (workoutType === 'WALK') factor = 0.5;
  else if (workoutType === 'CYCLING') factor = 0.35;
  else if (workoutType === 'SWIMMING') factor = 1.1;

  return Math.round(resolveWeightKg({ weightKg }) * distanceKm * factor);
}

export function estimateStepCalories(steps: number, weightKg = REFERENCE_WEIGHT_KG): number {
  return Math.round(Math.max(0, steps) * kcalPerStep(weightKg));
}

export function estimateWorkoutStepsCovered(distanceKm: number, workoutType: string): number {
  if (distanceKm > 0) {
    return Math.round(distanceKm * STEPS_PER_KM);
  }

  if (workoutType === 'GYM' || workoutType === 'OTHER') {
    return 0;
  }

  return 0;
}

export function computeActiveCaloriesFromTotals(input: {
  totalSteps: number;
  workoutDistanceKm: number;
  workoutType?: string;
  workoutDurationMinutes?: number;
  profile?: BurnProfile | null;
}): number {
  const weightKg = resolveWeightKg(input.profile);
  const workoutType = input.workoutType ?? 'RUN';
  const workoutCalories = estimateDistanceCalories(
    input.workoutDistanceKm * 1000,
    workoutType as 'RUN',
    weightKg,
  );
  const coveredSteps = estimateWorkoutStepsCovered(input.workoutDistanceKm, workoutType);
  const remainingSteps = Math.max(0, input.totalSteps - coveredSteps);
  return workoutCalories + estimateStepCalories(remainingSteps, weightKg);
}
