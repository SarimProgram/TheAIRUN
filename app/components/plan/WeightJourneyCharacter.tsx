import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { normalizeGender } from '../../utils/genderMascot';
import { CoachBrushStroke } from './PlanCoachArt';

const STANDING_SHEETS = {
  male: require('../../assets/plan/weight-journey-men-v1.png'),
  female: require('../../assets/plan/weight-journey-women-v1.png'),
};

const ACTIVITY_SHEETS = {
  male: require('../../assets/plan/weight-journey-men-poses-v2.png'),
  female: require('../../assets/plan/weight-journey-women-poses-v2.png'),
};

/** Decorative journey stages, relative to this plan's weight range, not a BMI assessment. */
export function getWeightJourneyStage(
  startKg: number | null | undefined,
  goalKg: number | null | undefined,
  weightKg: number | null | undefined,
) {
  if (typeof startKg !== 'number' || !Number.isFinite(startKg) ||
      typeof goalKg !== 'number' || !Number.isFinite(goalKg) ||
      typeof weightKg !== 'number' || !Number.isFinite(weightKg) || startKg <= goalKg) return 0;
  return Math.round(Math.min(1, Math.max(0, (startKg - weightKg) / (startKg - goalKg))) * 9);
}

/** Clip a cell from one bundled 5 × 2 sheet, reusing the same image for all weeks. */
export function WeightJourneyCharacter({ gender, stage, width, height, pose = 'activity' }: {
  gender?: string | null;
  pose?: 'standing' | 'activity';
  stage: number;
  width: number;
  height: number;
}) {
  const index = Number.isFinite(stage) ? Math.min(9, Math.max(0, Math.round(stage))) : 0;
  const identity = normalizeGender(gender) ?? 'male';
  // Keep wider activity poses inside the viewport without stretching their proportions.
  const cellSize = pose === 'activity' ? Math.min(height, width / 0.8) : height;
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width, height, overflow: 'hidden', justifyContent: 'center' }}>
      <CoachBrushStroke gender={gender} />
      <View style={{ width, height: cellSize, overflow: 'hidden' }}>
        <Image
          source={(pose === 'standing' ? STANDING_SHEETS : ACTIVITY_SHEETS)[identity]}
          accessible={false}
          fadeDuration={0}
          resizeMode="stretch"
          style={[styles.sheet, {
            width: cellSize * 5,
            height: cellSize * 2,
            left: -(index % 5) * cellSize - (cellSize - width) / 2,
            top: -Math.floor(index / 5) * cellSize,
          }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({ sheet: { position: 'absolute' } });
