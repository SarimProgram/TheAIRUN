import React, { useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { OnboardingScreen, ScreenTitle, WheelPicker, rise, useCompact } from './OnboardingKit';

const MIN_AGE = 13;
const MAX_AGE = 90;
const DEFAULT_AGE = 20;

interface Phase4Props {
  onComplete: (age: number) => void;
  onBack: () => void;
}

export default function Phase4Complete({ onComplete, onBack }: Phase4Props) {
  const compact = useCompact();
  const currentYear = new Date().getFullYear();
  const years = useMemo(
    () => Array.from({ length: MAX_AGE - MIN_AGE + 1 }, (_, i) => currentYear - MIN_AGE - i),
    [currentYear],
  );
  const initialIndex = DEFAULT_AGE - MIN_AGE;
  const [index, setIndex] = useState(initialIndex);

  return <OnboardingScreen onBack={onBack} showBrand ctaLabel="Next" onCta={() => onComplete(currentYear - years[index])}>
    <ScreenTitle lead={'What year were\nyou '} accent="born?" lines={2} />
    <Animated.View entering={rise(180)} style={styles.pickerArea}>
      <WheelPicker
        values={years}
        initialIndex={initialIndex}
        onChange={setIndex}
        itemHeight={compact ? 68 : 82}
        fontSize={compact ? 40 : 46}
        highlightHeight={compact ? 60 : 72}
        accessibilityLabel="Birth year"
      />
    </Animated.View>
  </OnboardingScreen>;
}

const styles = StyleSheet.create({
  pickerArea: { flexGrow: 1, justifyContent: 'center', paddingVertical: 24 },
});
