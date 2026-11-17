import type { buildWorkoutSessionPlan, MobilityExercise } from './GuidedMobility';
import { PARTNER_WORKOUTS, findPartnerWorkout, type PartnerWorkoutDefinition } from './partnerWorkoutDefinitions';

export type Workout = { id: string; title: string; subtitle: string; category: 'Strength' | 'Cardio' | 'HIIT' | 'Fun'; people: number; exercises: MobilityExercise[]; couple?: boolean; durationMinutes?: 5 | 10 };

const searchWords = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);

export function matchesWorkoutSearch(workout: Workout, query: string): boolean {
  const words = searchWords([
    workout.title, workout.subtitle, workout.category,
    workout.people === 2 ? 'partner couple together' : 'solo',
    workout.exercises.every(exercise => exercise.homeBased) ? 'home' : '',
    ...workout.exercises.flatMap(exercise => [exercise.name, exercise.bodyPart, ...exercise.benefits]),
  ].join(' '));
  return searchWords(query).every(term => words.some(word => word.startsWith(term)));
}

function makeExercise(definition: PartnerWorkoutDefinition, index: number): MobilityExercise {
  return {
    id: 101 + index, name: definition.name, description: definition.description,
    duration: definition.prescription, reps: definition.setLabel, instructions: definition.instructions,
    benefits: definition.targets, imagePlaceholder: definition.id, color: '#FF6069',
    objective: 'Better Running', kcals: 0, bodyPart: definition.bodyPart, selectionRole: definition.role,
    homeBased: true, ...(definition.count != null ? { baseReps: definition.count } : { timedSeconds: definition.seconds }),
    ...(definition.id === 'synchronized-lunges' ? { baseReps: 10, perLeg: true } : {}),
  };
}

export const PARTNER_SQUATS = makeExercise(PARTNER_WORKOUTS[0], 0);

export function makeWorkoutCatalog(): Workout[] {
  return PARTNER_WORKOUTS.map((definition, index) => ({
    id: definition.id, title: definition.name, subtitle: definition.description,
    category: definition.category, people: 2, couple: true, exercises: [makeExercise(definition, index)],
  }));
}

export function getRecommendedWorkout(preference: 'home' | 'strength' = 'strength', week = 1, workoutId?: string, dayIndex = 0): Workout {
  const catalog = makeWorkoutCatalog().filter(workout => preference === 'strength'
    ? workout.category === 'Strength' : workout.exercises.every(exercise => exercise.homeBased));
  return catalog.find(workout => workout.id === workoutId)
    ?? catalog[(Math.max(0, week - 1) + Math.max(0, dayIndex)) % catalog.length];
}

export function getWorkoutPlan(workout: Workout, week: number): ReturnType<typeof buildWorkoutSessionPlan> {
  const definition = findPartnerWorkout(workout.id);
  if (!workout.couple || !definition) throw new Error('This workout is no longer available. Choose a workout from the current library.');
  const dance = definition.id === 'couple-dance-cardio';
  const rounds = dance ? 1 : 3;
  const setSeconds = dance ? (workout.durationMinutes ?? 5) * 60 : definition.seconds;
  const setLabel = dance ? `${workout.durationMinutes ?? 5} minutes` : definition.setLabel;
  const phases: ReturnType<typeof buildWorkoutSessionPlan>['phases'] = [
    { key: 'warmup', type: 'warmup', title: 'Warm Up', subtitle: 'March, then reach', instruction: 'March gently in place for one minute. Then open your arms to shoulder height and reach overhead slowly for one minute.', durationSeconds: 120 },
  ];
  workout.exercises.forEach(exercise => {
    for (let round = 1; round <= rounds; round += 1) {
      phases.push({ key: `${exercise.id}-${round}`, type: 'exercise', title: exercise.name,
        subtitle: dance ? setLabel : `${definition.count == null ? 'Round' : 'Set'} ${round} of ${rounds} · ${setLabel}`,
        instruction: exercise.instructions.join(' '), durationSeconds: setSeconds,
        targetLabel: definition.prescription, roundNumber: round, roundTotal: rounds, exercise });
    }
  });
  phases.push({ key: 'cooldown', type: 'cooldown', title: 'Cool Down', subtitle: 'Walk, stretch, breathe', instruction: 'Walk slowly for 30 seconds. Gently stretch one arm across your chest for 15 seconds, switching arms halfway. Rest your hands on your ribs and breathe slowly for the final 15 seconds.', durationSeconds: 60 });
  return {
    week, warmupMinutes: 2, cooldownMinutes: 1, totalMinutes: Math.ceil(phases.reduce((sum, phase) => sum + phase.durationSeconds, 0) / 60), phases,
    workoutExercises: workout.exercises.map(exercise => ({ exercise, rounds, targetLabel: definition.prescription, setLabel, setDurationSeconds: setSeconds })),
  };
}
