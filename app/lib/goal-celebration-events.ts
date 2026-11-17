import { DeviceEventEmitter } from 'react-native';
import type { HomeGoal } from '@/hooks/useHomeGoals';

export type GoalCelebrationEvent = {
  goal: HomeGoal;
  period: string;
  preview?: boolean;
};
const EVENT = 'home-goal-complete';

export function notifyGoalComplete(event: GoalCelebrationEvent) {
  DeviceEventEmitter.emit(EVENT, event);
}

export function subscribeToGoalCompletions(listener: (event: GoalCelebrationEvent) => void) {
  const subscription = DeviceEventEmitter.addListener(EVENT, listener);
  return () => subscription.remove();
}
