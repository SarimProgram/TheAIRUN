import { DeviceEventEmitter } from 'react-native';
import type { PointCategoryKey } from '../hooks/useDailyPoints';

export type DailyRewardEvent = { category: PointCategoryKey; points: number; dayKey?: string };
const EVENT = 'daily-reward-earned';

export function notifyDailyReward(reward: DailyRewardEvent) {
  DeviceEventEmitter.emit(EVENT, reward);
}

export function subscribeToDailyRewards(listener: (reward: DailyRewardEvent) => void) {
  const subscription = DeviceEventEmitter.addListener(EVENT, listener);
  return () => subscription.remove();
}
