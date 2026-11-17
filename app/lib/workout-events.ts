import { DeviceEventEmitter } from 'react-native';

const EVENT = 'workout-overview:changed';
export const notifyWorkoutOverview = () => DeviceEventEmitter.emit(EVENT);
export function subscribeToWorkoutChanges(refresh: () => void) {
  const subscription = DeviceEventEmitter.addListener(EVENT, refresh);
  return () => subscription.remove();
}
