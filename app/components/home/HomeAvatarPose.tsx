import React, { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { ClipPath, Defs, G, Image, Rect } from 'react-native-svg';

export type HomePose = 'portrait' | 'nutrition-idle' | 'nutrition-progress' | 'nutrition-winning' | 'nutrition-over-target'
  | 'water-idle' | 'water-drink' | 'steps-0' | 'steps-1' | 'steps-2' | 'steps-3' | 'workout';
export const HOME_POSES: HomePose[] = ['portrait', 'nutrition-idle', 'nutrition-progress', 'nutrition-winning', 'nutrition-over-target', 'water-idle', 'water-drink', 'steps-0', 'steps-1', 'steps-2', 'steps-3', 'workout'];
const CELL_W = 512 / 3, CELL_H = 192;

/** A state selects one pose; no timeline, frame playback, bobbing or waving. */
export default function HomeAvatarPose({ uri, pose, mirrored = false, onLoad }: { uri: string; pose: HomePose; mirrored?: boolean; onLoad?: () => void }) {
  const id = `home-pose-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const index = HOME_POSES.indexOf(pose);
  const x = (index % 3) * CELL_W, y = Math.floor(index / 3) * CELL_H;
  // Reference tiles fit the original canvases, centered horizontally, feet fixed.
  // Crop the original canvas back out so feet and StepTracer rope grips align.
  const width = pose.startsWith('nutrition') ? 112.5 : pose.startsWith('steps') ? 128 : pose.startsWith('water') ? 94.16 : CELL_W;
  const inset = pose.startsWith('water') ? 47.8 : (CELL_W - width) / 2;
  return <View pointerEvents="none" style={[styles.frame, mirrored && styles.mirrored]}>
    <Svg width="100%" height="100%" viewBox={`${x + inset} ${y} ${width} ${CELL_H}`} preserveAspectRatio="xMidYMax meet" accessible={false}>
      <Defs><ClipPath id={id}><Rect x={x + inset} y={y} width={width} height={CELL_H} /></ClipPath></Defs>
      <G clipPath={`url(#${id})`}><Image href={{ uri }} width={512} height={768} onLoad={onLoad} /></G>
    </Svg>
  </View>;
}
const styles = StyleSheet.create({ frame: { width: '100%', height: '100%', overflow: 'hidden' }, mirrored: { transform: [{ scaleX: -1 }] } });
