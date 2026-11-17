// IDs of the current animated library. Never reference the retired solo exercise list.
export const ANIMATED_WORKOUT_IDS = [
    'partner-squats', 'plank-high-fives', 'couple-push-up-challenge', 'partner-sit-ups',
    'synchronized-lunges', 'wall-sit-challenge', 'mountain-climber-race',
    'jumping-jacks-together', 'glute-bridge-challenge', 'couple-dance-cardio',
] as const;
export type AnimatedWorkoutId = typeof ANIMATED_WORKOUT_IDS[number];

const STRENGTH: AnimatedWorkoutId[] = ['partner-squats', 'couple-push-up-challenge', 'glute-bridge-challenge',
    'synchronized-lunges', 'plank-high-fives', 'wall-sit-challenge', 'partner-sit-ups'];
const HOME: AnimatedWorkoutId[] = ['partner-squats', 'jumping-jacks-together', 'couple-push-up-challenge',
    'synchronized-lunges', 'plank-high-fives', 'glute-bridge-challenge', 'wall-sit-challenge',
    'partner-sit-ups', 'mountain-climber-race', 'couple-dance-cardio'];

export function recommendedWorkoutId(preference: 'home' | 'strength', week: number, sessionIndex: number, sessionsPerWeek: number,
    selected?: AnimatedWorkoutId): AnimatedWorkoutId {
    const pool = preference === 'strength' ? STRENGTH : HOME;
    if (selected && pool.includes(selected)) return selected;
    return pool[(Math.max(0, week - 1) * sessionsPerWeek + sessionIndex) % pool.length];
}
