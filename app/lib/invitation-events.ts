import { DeviceEventEmitter } from 'react-native';

export type InvitationChange = { scope: 'weekly_prize' | 'couple_challenge' | 'home_goals'; data?: Record<string, unknown> };
const EVENT = 'invitations:changed';

export function notifyInvitationChange(change: InvitationChange) {
  DeviceEventEmitter.emit(EVENT, change);
}

export function subscribeToInvitationChanges(listener: (change: InvitationChange) => void) {
  const subscription = DeviceEventEmitter.addListener(EVENT, listener);
  return () => subscription.remove();
}
