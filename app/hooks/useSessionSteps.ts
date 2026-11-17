// app/hooks/useSessionSteps.ts
// Counts steps taken during the active session only (pauses excluded).

import { useEffect, useRef, useState } from 'react';
import { Pedometer } from 'expo-sensors';

type SessionState = 'idle' | 'running' | 'paused' | 'finished';

export function useSessionSteps(state: SessionState): number {
    const [steps, setSteps] = useState(0);
    const stepsRef = useRef(0);
    const baseRef = useRef(0);

    useEffect(() => {
        if (state === 'idle') {
            stepsRef.current = 0;
            baseRef.current = 0;
            setSteps(0);
            return;
        }

        if (state !== 'running') return;

        let cancelled = false;
        let subscription: { remove: () => void } | null = null;
        baseRef.current = stepsRef.current;

        (async () => {
            try {
                if (!(await Pedometer.isAvailableAsync())) return;
                const permission = await Pedometer.requestPermissionsAsync();
                if (!permission.granted || cancelled) return;

                subscription = Pedometer.watchStepCount(({ steps: segmentSteps }) => {
                    const next = baseRef.current + segmentSteps;
                    stepsRef.current = next;
                    setSteps(next);
                });
            } catch (error) {
                console.warn('Session step counting unavailable', error);
            }
        })();

        return () => {
            cancelled = true;
            subscription?.remove();
        };
    }, [state]);

    return steps;
}
