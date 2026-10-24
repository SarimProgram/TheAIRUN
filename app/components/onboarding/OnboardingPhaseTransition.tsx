import React from 'react';
import { StyleSheet, View } from 'react-native';
import Reanimated, {
  Easing,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';

const EXIT_MS = 220;
const ENTER_MS = 380;

/** Total time before another transition can start. */
export const ONBOARDING_STEP_TRANSITION_MS = EXIT_MS + ENTER_MS;

type Props = {
  currentPhase: number;
  renderPhase: (phase: number) => React.ReactNode;
};

const phaseEntering = FadeIn.duration(ENTER_MS)
  .delay(EXIT_MS)
  .easing(Easing.out(Easing.cubic));

const phaseExiting = FadeOut.duration(EXIT_MS)
  .easing(Easing.in(Easing.cubic));

export default function OnboardingPhaseTransition({ currentPhase, renderPhase }: Props) {
  return (
    <View style={styles.container} pointerEvents="box-none">
      <Reanimated.View
        key={currentPhase}
        entering={phaseEntering}
        exiting={phaseExiting}
        style={styles.layer}
      >
        {renderPhase(currentPhase)}
      </Reanimated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
  },
});
