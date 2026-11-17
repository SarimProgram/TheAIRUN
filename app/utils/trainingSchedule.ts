export type WorkoutPreference = 'gym' | 'home' | 'strength';
export type TrainingActivity = 'RUN' | 'WALK' | 'WORKOUT';
export type TrainingSession = { dayOfWeek: number; activity: TrainingActivity; workoutPreference?: WorkoutPreference; workoutId?: string };
export type TrainingSchedule = { version: 1; customizationCompleted: boolean; sessions: TrainingSession[] };

export function getTrainingSchedule(weekDailys: unknown): TrainingSchedule | null {
  const schedule = (weekDailys as { trainingSchedule?: TrainingSchedule } | undefined)?.trainingSchedule;
  return schedule?.version === 1 && Array.isArray(schedule.sessions) ? schedule : null;
}

export function workoutLabel(preference?: WorkoutPreference) {
  return preference === 'gym' ? 'GYM' : preference === 'home' ? 'Home workout' : 'Strength workout';
}
