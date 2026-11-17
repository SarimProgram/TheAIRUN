import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useRaceSocketContext } from '@/contexts/RaceSocketContext';

/** Shared by the Home carousel and the invitation overlay on other screens. */
export function useRaceInviteResponse({ navigateOnAccept = true }: { navigateOnAccept?: boolean } = {}) {
  const router = useRouter();
  const race = useRaceSocketContext();
  const { raceState, isConnected, acceptInvite, declineInvite } = race;
  const pending = useRef<{ resolve: () => void; reject: (error: Error) => void } | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!pending.current || (raceState === 'invited' && isConnected)) return;
    const response = pending.current;
    pending.current = null;
    if (timeout.current) clearTimeout(timeout.current);
    if (['selectDistance', 'countdown', 'racing'].includes(raceState)) {
      response.resolve();
      if (navigateOnAccept) router.push('/race/virtual');
    } else response.reject(new Error('The race could not be accepted. Please try again.'));
  }, [raceState, isConnected, router, navigateOnAccept]);

  useEffect(() => () => {
    if (timeout.current) clearTimeout(timeout.current);
    pending.current?.reject(new Error('The invitation was closed.'));
    pending.current = null;
  }, []);

  const onAccept = useCallback(() => new Promise<void>((resolve, reject) => {
    if (!isConnected) { reject(new Error('Reconnect to accept this invitation.')); return; }
    pending.current = { resolve, reject };
    timeout.current = setTimeout(() => {
      pending.current = null;
      reject(new Error('No response yet. Please try accepting again.'));
    }, 12000);
    acceptInvite();
  }), [isConnected, acceptInvite]);

  const onDeny = useCallback(async () => {
    if (!isConnected) throw new Error('Reconnect to deny this invitation.');
    declineInvite();
  }, [isConnected, declineInvite]);

  return { ...race, onAccept, onDeny };
}
