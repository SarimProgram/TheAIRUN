import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeOut } from 'react-native-reanimated';
import { OnboardingScreen, ScreenTitle, UnitToggle, WheelPicker, rise, useCompact } from './OnboardingKit';

type WeightUnit = 'kg' | 'lbs';
type HeightUnit = 'cm' | 'ft';

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const LB_PER_KG = 2.20462;
const CM_PER_INCH = 2.54;

const WEIGHTS: Record<WeightUnit, number[]> = { kg: range(30, 150), lbs: range(70, 330) };
const CM = range(100, 250);
const INCHES = range(36, 96);
const FEET = INCHES.map((inches) => `${Math.floor(inches / 12)}'${inches % 12}"`);

const WEIGHT_UNITS = [{ id: 'kg', label: 'kg' }, { id: 'lbs', label: 'lb' }] as const;
const HEIGHT_UNITS = [{ id: 'cm', label: 'cm' }, { id: 'ft', label: 'ft' }] as const;

const indexIn = (list: number[], value: number) => Math.min(list.length - 1, Math.max(0, value - list[0]));

interface Props {
  onContinue: (data: { weight: number | string, height: number | string, weightUnit: string, heightUnit: string }) => void;
  onBack: () => void;
}

export default function WeightHeightSelection({ onContinue, onBack }: Props) {
  const compact = useCompact();
  const [step, setStep] = useState<0 | 1>(0);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');
  const [heightUnit, setHeightUnit] = useState<HeightUnit>('cm');
  const [weightIndex, setWeightIndex] = useState(indexIn(WEIGHTS.kg, 70));
  const [heightIndex, setHeightIndex] = useState(indexIn(CM, 170));

  const isWeight = step === 0;
  const heightValues = heightUnit === 'cm' ? CM : FEET;

  const changeWeightUnit = (next: WeightUnit) => {
    const value = WEIGHTS[weightUnit][weightIndex];
    const converted = Math.round(next === 'lbs' ? value * LB_PER_KG : value / LB_PER_KG);
    setWeightIndex(indexIn(WEIGHTS[next], converted));
    setWeightUnit(next);
  };

  const changeHeightUnit = (next: HeightUnit) => {
    const converted = next === 'ft'
      ? indexIn(INCHES, Math.round(CM[heightIndex] / CM_PER_INCH))
      : indexIn(CM, Math.round(INCHES[heightIndex] * CM_PER_INCH));
    setHeightIndex(converted);
    setHeightUnit(next);
  };

  const handleNext = () => {
    if (isWeight) {
      setStep(1);
      return;
    }
    onContinue({
      weight: WEIGHTS[weightUnit][weightIndex],
      height: heightValues[heightIndex],
      weightUnit,
      heightUnit,
    });
  };

  const handleBack = () => {
    if (isWeight) onBack();
    else setStep(0);
  };

  const wheelSize = {
    itemHeight: compact ? 72 : 86,
    fontSize: compact ? 52 : 60,
    highlightHeight: compact ? 76 : 90,
    highlightWidth: compact ? 248 : 280,
  };

  return <OnboardingScreen onBack={handleBack} ctaLabel="Next" onCta={handleNext}>
    <Animated.View key={step} exiting={FadeOut.duration(140)} style={styles.step}>
      <ScreenTitle lead="Your " accent={isWeight ? 'weight?' : 'height?'} />
      <Animated.View entering={rise(160)} style={{ marginTop: compact ? 24 : 36 }}>
        {isWeight
          ? <UnitToggle options={WEIGHT_UNITS} value={weightUnit} onChange={changeWeightUnit} />
          : <UnitToggle options={HEIGHT_UNITS} value={heightUnit} onChange={changeHeightUnit} />}
      </Animated.View>
      <Animated.View entering={rise(220)} style={styles.pickerArea}>
        {isWeight
          ? <WheelPicker
              key={weightUnit}
              values={WEIGHTS[weightUnit]}
              initialIndex={weightIndex}
              onChange={setWeightIndex}
              accessibilityLabel="Weight"
              unit={weightUnit === 'kg' ? 'kilograms' : 'pounds'}
              {...wheelSize}
            />
          : <WheelPicker
              key={heightUnit}
              values={heightValues}
              initialIndex={heightIndex}
              onChange={setHeightIndex}
              accessibilityLabel="Height"
              unit={heightUnit === 'cm' ? 'centimeters' : ''}
              {...wheelSize}
            />}
      </Animated.View>
    </Animated.View>
  </OnboardingScreen>;
}

const styles = StyleSheet.create({
  step: { flexGrow: 1 },
  pickerArea: { flexGrow: 1, justifyContent: 'center', paddingVertical: 24 },
});
