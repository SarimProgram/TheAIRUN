import React from 'react';
import { WorkoutFlow } from './WorkoutFlow';
import type { WorkoutPhotosController } from '../../hooks/useWorkoutPhotos';
import type { Workout } from './workoutCatalog';

type Props = {
    visible: boolean; onClose: () => void; currentWeek: number; onMixedSessionComplete?: () => void;
    initialDetail?: boolean; workoutPreference?: 'home' | 'strength'; workoutId?: string; dayIndex?: number;
    proofController?: WorkoutPhotosController;
    saveCompletion?: (workout: Workout, startedAt: Date) => Promise<void>;
};
export function MobilityExercises({ visible, onClose, currentWeek, onMixedSessionComplete, initialDetail, workoutPreference, workoutId, dayIndex, proofController, saveCompletion }: Props) {
    return <WorkoutFlow visible={visible} onClose={onClose} currentWeek={currentWeek}
        onComplete={onMixedSessionComplete} initialDetail={initialDetail} workoutPreference={workoutPreference}
        workoutId={workoutId} dayIndex={dayIndex} proofController={proofController} saveCompletion={saveCompletion} />;
}
