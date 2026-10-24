import { Easing, FadeIn, FadeOut } from 'react-native-reanimated';

export type StepDirection = 'forward' | 'back';

/** Total time before another step transition is allowed. */
export const ONBOARDING_STEP_TRANSITION_MS = 440;

const stepEnter = FadeIn.duration(360)
  .delay(80)
  .easing(Easing.out(Easing.cubic));

const stepExit = FadeOut.duration(280)
  .easing(Easing.in(Easing.cubic));

export function getOnboardingStepEntering(_direction: StepDirection) {
  return stepEnter;
}

export function getOnboardingStepExiting(_direction: StepDirection) {
  return stepExit;
}
