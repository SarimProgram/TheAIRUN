import React, { useEffect, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Image } from 'expo-image';
import Animated, { cancelAnimation, Easing, type SharedValue, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient as SvgGradient, Path, Rect, Stop } from 'react-native-svg';
import { preloadRaceArtwork, RACE_RUNNERS as RUNNERS, RACE_SCENERY as SCENERY } from './raceAssets';

import { FINISH_ROAD_FRACTION, METRES_PER_MARKER, START_BOTTOM_SPACE, getFinishY } from './raceCourseGeometry';

const CORAL = '#FF626B';
const TEAL = '#009F97';

export function ScenerySprite({ kind, size, height = size }: { kind: 'tree' | 'pine' | 'bush' | 'finish' | 'shoe' | 'flag'; size: number; height?: number }) {
  const cell = { tree: 0, pine: 1, bush: 2, finish: 3, shoe: 4, flag: 5 }[kind];
  return <View pointerEvents="none" style={{ width: size, height, overflow: 'hidden' }}>
    <Image accessible={false} source={SCENERY} contentFit="fill" transition={0} cachePolicy="memory-disk" style={{ width: size * 3, height: height * 2, position: 'absolute', left: -(cell % 3) * size, top: -Math.floor(cell / 3) * height }} />
  </View>;
}

// Opaque bounds of the finish arch inside its 512 × 512 atlas cell.
const ARCH_LEFT = 0.06;
const ARCH_RIGHT = 0.95;
const ARCH_BOTTOM = 0.83;
const LABEL_HEIGHT = 34;

function Runner({ progress, distance, name, female, partner, width, startY, finishY, phase, preview }: {
  progress: SharedValue<number>; distance: number; name: string; female: boolean; partner: boolean;
  width: number; startY: number; finishY: number; phase: SharedValue<number>; preview: boolean;
}) {
  const color = partner ? TEAL : CORAL;
  const spriteHeight = Math.min(120, width * 0.31, Math.max(48, (finishY - 40) / 0.93));
  const spriteWidth = spriteHeight / 2;
  const travel = startY - finishY;
  const position = useAnimatedStyle(() => {
    const y = startY - Math.max(0, Math.min(1, progress.get())) * travel;
    // Lane centres follow the same taper as the road, including at the finish.
    const halfRoad = width * (FINISH_ROAD_FRACTION / 2 + (0.32 - FINISH_ROAD_FRACTION / 2) * (y - finishY) / travel);
    return { transform: [{ translateX: (partner ? -1 : 1) * halfRoad / 2 }, { translateY: y - startY }] };
  });
  const frame = useAnimatedStyle(() => ({ transform: [
    { translateX: -(progress.get() >= 1 ? 0 : Math.floor((phase.get() + (partner ? 3 : 0)) % 6)) * spriteWidth },
    { translateY: female ? -spriteHeight : 0 },
  ] }));
  const feetY = spriteHeight * 0.93;
  return <Animated.View style={[styles.runner, { left: width / 2 - 50, top: startY - feetY, width: 100 }, position]}>
    <View style={[styles.halo, { top: feetY - 8, borderColor: partner ? '#C0FFF6' : '#FFE6EB', backgroundColor: partner ? '#35D7C84D' : '#FF6B814D' }]} />
    <View style={{ width: spriteWidth, height: spriteHeight, overflow: 'hidden', alignSelf: 'center' }}>
      <Animated.View style={[{ width: spriteWidth * 6, height: spriteHeight * 2 }, frame]}>
        <Image source={RUNNERS} accessible={false} contentFit="fill" transition={0} cachePolicy="memory-disk" style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
    <View style={[styles.label, { top: spriteHeight + 4, backgroundColor: partner ? '#F0FFFC' : '#FFF3F4' }]}>
      <Text numberOfLines={1} style={[styles.name, { color }]}>{name}</Text>
      <Text style={[styles.distance, { color: partner ? '#15514F' : '#AD3545' }]}>{preview ? 'Ready' : `${Math.round(Math.max(0, distance)).toLocaleString()} m`}</Text>
    </View>

  </Animated.View>;
}

/** A single coordinate system keeps markers, finish line and both runners in sync. */
export default function RaceScene({ width, height, myProgress, theirProgress, myDistance = 0, partnerDistance = 0, raceDistance = 1000, gender, running = true, preview = false, dark = false }: {
  width: number; height: number; myProgress: SharedValue<number>; theirProgress: SharedValue<number>;
  myDistance?: number; partnerDistance?: number; raceDistance?: number; gender?: string | null;
  running?: boolean; preview?: boolean; dark?: boolean;
}) {
  const focused = useIsFocused();
  const reduced = useReducedMotion();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const phase = useSharedValue(0);
  useEffect(() => { void preloadRaceArtwork(); }, []);
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => listener.remove();
  }, []);
  useEffect(() => {
    phase.set(0);
    if (focused && foreground && running && !reduced) phase.set(withRepeat(withTiming(6, { duration: 720, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(phase);
  }, [focused, foreground, running, reduced, phase]);
  // The atlas cell is square: use uniform scaling, never flatten the arch.
  const archWidth = (width * FINISH_ROAD_FRACTION + 8) / (ARCH_RIGHT - ARCH_LEFT);
  const archHeight = archWidth;
  const finishY = getFinishY(width);
  const startY = height - START_BOTTOM_SPACE;
  const total = Number.isFinite(raceDistance) && raceDistance > 0 ? raceDistance : 1000;
  const markers = Array.from(
    { length: Math.max(0, Math.ceil(total / METRES_PER_MARKER) - 1) },
    (_, i) => (i + 1) * METRES_PER_MARKER,
  );
  const roadLeft = (y: number) => width * ((1 - FINISH_ROAD_FRACTION) / 2 - (0.32 - FINISH_ROAD_FRACTION / 2) * Math.max(0, Math.min(1, (y - finishY) / (startY - finishY))));
  const roadRight = (y: number) => width - roadLeft(y);
  // Leave room to run through the arch instead of ending the asphalt at the stripe.
  const roadTop = 0;
  const roadBottom = height;
  const archTop = finishY - archHeight * ARCH_BOTTOM;
  const formatMetres = (metres: number) => metres >= 1000 ? `${+(metres / 1000).toFixed(1)} km` : `${metres} m`;
  const treeSize = Math.min(60, width * 0.15);
  return <View style={[styles.scene, { width, height, backgroundColor: dark ? '#263F36' : '#D6E9BD' }]} accessibilityLabel={preview ? 'Race preview. Two runners on a tree-lined track.' : `Race course. You ${Math.round(myDistance)} metres. Partner ${Math.round(partnerDistance)} metres. Goal ${total} metres.`}>
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
      <Defs><SvgGradient id="asphalt" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor={dark ? '#414B59' : '#C4CAD5'} /><Stop offset="0.5" stopColor={dark ? '#505B69' : '#E0E4EB'} /><Stop offset="1" stopColor={dark ? '#414B59' : '#C4CAD5'} /></SvgGradient></Defs>
      <Path d={`M ${roadLeft(roadTop)} ${roadTop} H ${roadRight(roadTop)} V ${finishY} L ${roadRight(roadBottom)} ${roadBottom} L ${roadLeft(roadBottom)} ${roadBottom} L ${roadLeft(finishY)} ${finishY} Z`} fill="url(#asphalt)" />
      {[false, true].map(right => <React.Fragment key={String(right)}>
        <Path d={`M ${right ? roadRight(roadTop) : roadLeft(roadTop)} ${roadTop} V ${finishY} L ${right ? roadRight(roadBottom) : roadLeft(roadBottom)} ${roadBottom}`} fill="none" stroke="#FFF9ED" strokeWidth={8} />
        <Path d={`M ${right ? roadRight(roadTop) : roadLeft(roadTop)} ${roadTop} V ${finishY} L ${right ? roadRight(roadBottom) : roadLeft(roadBottom)} ${roadBottom}`} fill="none" stroke="#FFBE70" strokeWidth={8} strokeDasharray="25 25" />
      </React.Fragment>)}
      <Path d={`M ${width / 2} ${finishY + 12} V ${roadBottom}`} fill="none" stroke={dark ? '#8995A3' : '#FFFFFF'} strokeWidth={2.5} strokeDasharray="10 12" />
      {[0, ...markers].map(metres => {
        const y = startY - metres / total * (startY - finishY);
        return <Path key={metres} d={`M ${roadLeft(y) + 5} ${y} H ${roadRight(y) - 5}`} fill="none" stroke="#FFFFFF55" strokeWidth={1} />;
      })}
      {Array.from({ length: 20 }, (_, i) => {
        const cellWidth = (roadRight(finishY) - roadLeft(finishY)) / 10;
        return <Rect key={`finish-${i}`} x={roadLeft(finishY) + (i % 10) * cellWidth} y={finishY - 8 + Math.floor(i / 10) * 8} width={cellWidth} height={8} fill={(i + Math.floor(i / 10)) % 2 ? '#FFFFFF' : '#35445C'} />;
      })}
    </Svg>
    {Array.from({ length: Math.max(2, Math.ceil((startY - finishY) / 140)) * 2 }, (_, i) => {
      const right = i % 2 === 1;
      // Trees sit beside the kerb; stagger them between milestone labels.
      const fraction = (Math.floor(i / 2) + 0.5) / Math.max(2, Math.ceil((startY - finishY) / 140));
      const y = startY - fraction * (startY - finishY);
      const size = treeSize * (0.8 + (y / height) * 0.25);
      return <View key={i} style={{ position: 'absolute', top: y - size / 2, left: right ? roadRight(y) + 6 : roadLeft(y) - size - 6 }}><ScenerySprite kind={i % 3 === 0 ? 'pine' : 'tree'} size={size} /></View>;
    })}
    {markers.map(metres => {
      const y = startY - metres / total * (startY - finishY);
      return <View key={metres} style={[styles.marker, { top: y - 10, left: roadRight(y) + 8 }]}><Text style={styles.markerText}>{formatMetres(metres)}</Text></View>;
    })}
    <View style={{ position: 'absolute', top: archTop, left: roadLeft(finishY) - 4 - archWidth * ARCH_LEFT }}><ScenerySprite kind="finish" size={archWidth} /></View>
    <View style={[styles.goal, { top: 12 }]}><Text style={styles.goalText}>FINISH · {formatMetres(total)}</Text></View>
    <View style={[styles.start, { top: height - 24 }]}><Text style={styles.startText}>START</Text></View>
    <Runner progress={theirProgress} distance={partnerDistance} name="Partner" female={gender === 'male'} partner width={width} startY={startY} finishY={finishY} phase={phase} preview={preview} />
    <Runner progress={myProgress} distance={myDistance} name="You" female={gender !== 'male'} partner={false} width={width} startY={startY} finishY={finishY} phase={phase} preview={preview} />
  </View>;
}

const styles = StyleSheet.create({
  scene: { overflow: 'hidden' },
  runner: { position: 'absolute', alignItems: 'center' },
  label: { position: 'absolute', height: LABEL_HEIGHT, justifyContent: 'center', minWidth: 52, maxWidth: 100, paddingHorizontal: 8, borderRadius: 10, borderCurve: 'continuous', alignItems: 'center', marginBottom: 6, boxShadow: '0 3px 8px #25364618' },
  name: { fontSize: 10, fontWeight: '800' },
  distance: { fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  pointer: { position: 'absolute', bottom: -5, borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 6, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  halo: { position: 'absolute', width: 40, height: 12, borderRadius: 24, borderWidth: 2 },
  marker: { position: 'absolute', backgroundColor: '#FFFFFFEB', borderRadius: 12, paddingHorizontal: 6, paddingVertical: 3 },
  markerText: { fontSize: 10, color: '#35445C', fontWeight: '800', fontVariant: ['tabular-nums'] },
  goal: { position: 'absolute', alignSelf: 'center', backgroundColor: '#FFFFFFEB', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  goalText: { fontSize: 10, color: '#35445C', fontWeight: '800', letterSpacing: 1, fontVariant: ['tabular-nums'] },
  start: { position: 'absolute', alignSelf: 'center', backgroundColor: '#FFFFFF99', paddingHorizontal: 15, paddingVertical: 4, borderRadius: 8 },
  startText: { color: '#566377', fontSize: 9, fontWeight: '800', letterSpacing: 3 },
});
