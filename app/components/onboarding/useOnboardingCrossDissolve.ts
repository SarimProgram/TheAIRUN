import { useCallback, useRef, useState } from 'react';
import { ONBOARDING_STEP_TRANSITION_MS } from './OnboardingPhaseTransition';

export { ONBOARDING_STEP_TRANSITION_MS };

export function useOnboardingCrossDissolve(initialPhase = 0) {
  const [currentPhase, setCurrentPhase] = useState(initialPhase);
  const lockedRef = useRef(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const setPhaseInstant = useCallback((phase: number) => {
    lockedRef.current = false;
    setIsTransitioning(false);
    setCurrentPhase(phase);
  }, []);

  const transitionToPhase = useCallback((nextPhase: number) => {
    setCurrentPhase((prev) => {
      if (prev === nextPhase) return prev;
      if (lockedRef.current) return prev;

      lockedRef.current = true;
      setIsTransitioning(true);
      setTimeout(() => {
        lockedRef.current = false;
        setIsTransitioning(false);
      }, ONBOARDING_STEP_TRANSITION_MS);

      return nextPhase;
    });
  }, []);

  return {
    currentPhase,
    isTransitioning,
    transitionToPhase,
    setPhaseInstant,
  };
}
