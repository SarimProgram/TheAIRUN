import { useCallback, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';

type TransitionDirection = 'forward' | 'back';

type TransitionOptions = {
  /** When false, only plays the exit animation (e.g. before leaving onboarding). */
  enter?: boolean;
};

const EXIT_MS = 160;
const ENTER_MS = 200;

function deferToNextFrame(callback: () => void) {
  requestAnimationFrame(() => {
    requestAnimationFrame(callback);
  });
}

export function useSmoothStepTransition() {
  const opacity = useRef(new Animated.Value(1)).current;
  const locked = useRef(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const runTransition = useCallback((
    onComplete: () => void,
    _nextDirection: TransitionDirection = 'forward',
    options?: TransitionOptions,
  ) => {
    if (locked.current) return;

    locked.current = true;
    setIsTransitioning(true);

    const shouldEnter = options?.enter !== false;

    Animated.timing(opacity, {
      toValue: 0,
      duration: EXIT_MS,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      onComplete();

      if (!shouldEnter) {
        locked.current = false;
        setIsTransitioning(false);
        return;
      }

      deferToNextFrame(() => {
        Animated.timing(opacity, {
          toValue: 1,
          duration: ENTER_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start(() => {
          locked.current = false;
          setIsTransitioning(false);
        });
      });
    });
  }, [opacity]);

  const animatedStyle = {
    opacity,
  };

  return { animatedStyle, isTransitioning, runTransition };
}
