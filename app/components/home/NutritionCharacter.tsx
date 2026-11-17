import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { nutritionCharacterSource } from './nutritionAssets';
import { useHomeAvatar } from '../../lib/home-avatar';
import HomeAvatarPose from './HomeAvatarPose';

import type { NutritionReaction } from './nutritionReaction';
export { nutritionReaction } from './nutritionReaction';

export default function NutritionCharacter({ gender, reaction, facing, role = 'you' }: {
  gender: 'male' | 'female'; reaction: NutritionReaction; facing: 'left' | 'right'; role?: 'you' | 'partner';
}) {
  const avatar = useHomeAvatar(role);
  if (avatar?.kind === 'home-sheet') return <HomeAvatarPose uri={avatar.uri} pose={`nutrition-${reaction}`} mirrored={facing === 'left'} />;
  return <View pointerEvents="none" style={styles.frame}>
    <View style={[styles.sprite, facing === 'left' && styles.mirrored]}>
      <Image source={nutritionCharacterSource(gender, reaction)} style={StyleSheet.absoluteFill}
        contentFit="contain" contentPosition="bottom" cachePolicy="memory-disk" priority="high" transition={0} accessible={false} />
    </View>
  </View>;
}

const styles = StyleSheet.create({
  frame: { width: '100%', height: '100%', overflow: 'hidden' },
  sprite: { ...StyleSheet.absoluteFillObject },
  mirrored: { transform: [{ scaleX: -1 }] },
});
