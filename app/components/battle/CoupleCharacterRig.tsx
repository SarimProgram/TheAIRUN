import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { COUPLE_RIG, OPPONENT_RIG } from './coupleArenaAssets';
import type { TugIdentity } from './tugSprite';
import { CHEST_STRETCH, FRONT_ARM_PIVOT, FRONT_ARM_SWING, HEAD_PIVOT, HEAD_TILT, OPENING_FRONT_SWING, OPENING_HEAD_TILT, OPENING_LEAN, OPENING_REAR_SWING, OPENING_STRETCH, REAR_ARM_PIVOT, REAR_ARM_SWING, RIG_BASELINE, RIG_HEIGHT, RIG_PIVOT, RIG_WIDTH, TORSO_SWAY, rigBreath } from './coupleRigGeometry';

type Part = 'legs' | 'torso' | 'head' | 'rear' | 'front';

// Pre-baked cutouts share the native image cache; only transforms run per frame.
function RigLayer({ identity, index, part, scale }: { identity: TugIdentity; index: number; part: Part; scale: number }) {
  return <Image source={(index > 1 ? OPPONENT_RIG : COUPLE_RIG)[identity][part]} accessible={false} contentFit="fill"
    cachePolicy="memory-disk" transition={0}
    style={{ position: 'absolute', width: RIG_WIDTH * scale, height: RIG_HEIGHT * scale }} />;
}

export default function CoupleCharacterRig({ identity, index, phase, openingPull, scale, left, floor }: {
  identity: TugIdentity; index: number; phase: SharedValue<number>; openingPull: SharedValue<number>; scale: number;
  left: number; floor: number;
}) {
  const torso = useAnimatedStyle(() => {
    const breath = rigBreath(phase.get(), index);
    const pull = openingPull.get();
    return { transform: [{ rotate: `${breath * TORSO_SWAY + pull * OPENING_LEAN}deg` }, { scaleY: 1 + breath * CHEST_STRETCH + pull * OPENING_STRETCH }] };
  });
  const head = useAnimatedStyle(() => ({ transform: [{ rotate: `${rigBreath(phase.get(), index) * HEAD_TILT + openingPull.get() * OPENING_HEAD_TILT}deg` }] }));
  const rearArm = useAnimatedStyle(() => ({ transform: [{ rotate: `${rigBreath(phase.get(), index) * REAR_ARM_SWING + openingPull.get() * OPENING_REAR_SWING}deg` }] }));
  const frontArm = useAnimatedStyle(() => ({ transform: [{ rotate: `${rigBreath(phase.get(), index) * FRONT_ARM_SWING + openingPull.get() * OPENING_FRONT_SWING}deg` }] }));

  return <View pointerEvents="none" style={{ position: 'absolute', left, top: floor - RIG_BASELINE * scale,
    width: RIG_WIDTH * scale, height: RIG_HEIGHT * scale, transform: [{ scaleX: index > 1 ? -1 : 1 }] }}>
    <RigLayer identity={identity} index={index} part="legs" scale={scale} />
    <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: [RIG_PIVOT.x * scale, RIG_PIVOT.y * scale, 0] }, torso]}>
      <RigLayer identity={identity} index={index} part="torso" scale={scale} />
      <Animated.View renderToHardwareTextureAndroid shouldRasterizeIOS style={[StyleSheet.absoluteFill, { transformOrigin: [HEAD_PIVOT.x * scale, HEAD_PIVOT.y * scale, 0] }, head]}>
        <RigLayer identity={identity} index={index} part="head" scale={scale} />
      </Animated.View>
      <Animated.View renderToHardwareTextureAndroid shouldRasterizeIOS style={[StyleSheet.absoluteFill, { transformOrigin: [REAR_ARM_PIVOT.x * scale, REAR_ARM_PIVOT.y * scale, 0] }, rearArm]}>
        <RigLayer identity={identity} index={index} part="rear" scale={scale} />
      </Animated.View>
      <Animated.View renderToHardwareTextureAndroid shouldRasterizeIOS style={[StyleSheet.absoluteFill, { transformOrigin: [FRONT_ARM_PIVOT.x * scale, FRONT_ARM_PIVOT.y * scale, 0] }, frontArm]}>
        <RigLayer identity={identity} index={index} part="front" scale={scale} />
      </Animated.View>
    </Animated.View>
  </View>;
}
