import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

// One bundled, cached texture for the entire branch, including the date dialog.
const ATLAS = require('../../assets/onboarding/running-icons/running-icons-v1.webp');
const CELLS = {
  '5k': 0,
  '10k': 1,
  halfMarathon: 2,
  speedImprovement: 3,
  beginner: 4,
  intermediate: 5,
  advanced: 6,
  absolute_new: 7,
  estimate: 8,
  yes: 9,
  notYet: 10,
  performance: 11,
  weightloss: 12,
  faster: 13,
  longer: 14,
  form: 15,
} as const;

export type RunningIconName = keyof typeof CELLS;

export const RunningOptionArt = memo(function RunningOptionArt({ name, size = 76 }: {
  name: RunningIconName;
  size?: number;
}) {
  const cell = CELLS[name];
  return <View pointerEvents="none" accessible={false} style={[styles.crop, { width: size, height: size }]}>
    <Image
      source={ATLAS}
      contentFit="fill"
      cachePolicy="memory-disk"
      transition={0}
      accessible={false}
      style={{ position: 'absolute', width: size * 4, height: size * 4, left: -(cell % 4) * size, top: -Math.floor(cell / 4) * size }}
    />
  </View>;
});

const styles = StyleSheet.create({ crop: { overflow: 'hidden', flexShrink: 0 } });
