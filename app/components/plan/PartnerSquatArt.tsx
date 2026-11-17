import React, { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { AccessibilityInfo, AppState, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { ui, usePlanColors } from './PlanVisuals';

import { PARTNER_SQUAT_FRAME_LABELS, type PartnerSquatMode } from './partnerSquatMotion';
import { getPartnerWorkoutMotion } from './partnerWorkoutMotion';
import { PARTNER_WORKOUT_SHEETS } from './partnerWorkoutAssets';
import { findPartnerWorkout } from './partnerWorkoutDefinitions';
import { getPartnerWorkoutCrop } from './partnerWorkoutCrop';

/** Render one atlas cell; player demonstrations share the session's precise clock. */
export function PartnerSquatArt({ frame, style, mode = 'squat', animate = false, elapsedMs, exerciseId = 'partner-squats' }: {
  frame?: number; style?: ViewStyle; mode?: PartnerSquatMode; animate?: boolean; elapsedMs?: number; exerciseId?: string;
}) {
  const c = usePlanColors();
  const [size, setSize] = useState(0);
  const [previewMs, setPreviewMs] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReducedMotion(value); }).catch(() => {});
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    const app = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => { active = false; motion.remove(); app.remove(); };
  }, []);
  useEffect(() => {
    if (!animate || elapsedMs != null || reducedMotion || !foreground) return;
    const start = Date.now();
    const timer = setInterval(() => setPreviewMs(Date.now() - start), 100);
    return () => clearInterval(timer);
  }, [animate, elapsedMs, reducedMotion, foreground, mode, exerciseId]);
  const motion = getPartnerWorkoutMotion(exerciseId, mode, elapsedMs ?? previewMs, reducedMotion);
  const sourceId = mode === 'squat' ? exerciseId : 'partner-squats';
  const atlas = PARTNER_WORKOUT_SHEETS[sourceId] ?? PARTNER_WORKOUT_SHEETS['partner-squats'];
  const localFrame = animate ? motion.frame : frame ?? (mode === 'warmup' ? 0 : mode === 'cooldown' ? 15 : sourceId === 'partner-squats' ? 7 : 3);
  const cell = sourceId === 'partner-squats' ? localFrame : atlas.firstFrame + localFrame;
  const crop = getPartnerWorkoutCrop(atlas, cell, size);
  const definition = findPartnerWorkout(exerciseId);
  const label = sourceId === 'partner-squats' ? PARTNER_SQUAT_FRAME_LABELS[cell] : definition?.poses[localFrame];
  return <View accessibilityRole="image" accessibilityLabel={`${definition?.name ?? 'Partner workout'}: ${label}`} style={[s.art, { backgroundColor: c.soft }, style]}
    onLayout={({ nativeEvent: { layout } }) => setSize(Math.min(layout.width, layout.height))}>
    {size > 0 && <View pointerEvents="none" style={{ width: crop.viewportWidth, height: crop.viewportHeight, overflow: 'hidden' }}>
      <Image source={atlas.source} contentFit="fill" transition={0} style={{ position: 'absolute', width: crop.imageWidth, height: crop.imageHeight, left: crop.imageLeft, top: crop.imageTop }} />
    </View>}
  </View>;
}

export function PartnerSquatSequence({ exerciseId = 'partner-squats' }: { exerciseId?: string }) {
  const c = usePlanColors();
  const definition = findPartnerWorkout(exerciseId);
  const isSquat = exerciseId === 'partner-squats';
  return <View style={{ gap: 20 }}>{[
    { title: 'Warm up', frames: [0, 1, 2, 3], source: 'partner-squats' },
    { title: isSquat ? 'Squat: lower together' : 'Movement: first half', frames: isSquat ? [4, 5, 6, 7] : [0, 1, 2, 3], source: exerciseId },
    { title: isSquat ? 'Squat: rise together' : 'Movement: second half', frames: isSquat ? [8, 9, 10, 11] : [4, 5, 6, 7], source: exerciseId },
    { title: 'Cool down', frames: [12, 13, 14, 15], source: 'partner-squats' },
  ].map(group => <View key={group.title} style={{ gap: 12 }}>
    <Text style={[ui.heading, { color: c.text }]}>{group.title}</Text>
    <View style={s.sequence}>{group.frames.map(frame => <View key={frame} style={s.step}>
      <PartnerSquatArt exerciseId={group.source} frame={frame} style={{ width: '100%', aspectRatio: 1 }} />
      <Text style={[ui.meta, { color: c.text }]}>{group.source === 'partner-squats' ? PARTNER_SQUAT_FRAME_LABELS[frame] : definition?.poses[frame]}</Text>
    </View>)}</View>
  </View>)}</View>;
}

const s = StyleSheet.create({
  art: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 24, borderCurve: 'continuous' },
  sequence: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  step: { width: '47%', flexGrow: 1, gap: 8 },
});
