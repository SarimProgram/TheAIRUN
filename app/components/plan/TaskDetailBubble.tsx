import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { BedDouble, Check, Droplet, Flame, Footprints, Heart, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PointCategory } from '../../hooks/useDailyPoints';
import type { DailyTaskProgress } from './dailyTaskProgress';
import { ui, usePlanColors } from './PlanVisuals';

export type TaskReward = Pick<PointCategory, 'key' | 'maxPoints' | 'isAvailable'> & Partial<Pick<PointCategory, 'earnedPoints' | 'isAwarded' | 'progress' | 'claimable'>>;
export type TaskAnchor = { x: number; y: number; width: number; height: number };
type Props = {
  task: DailyTaskProgress;
  anchor: TaskAnchor;
  reward?: TaskReward;
  loading: boolean;
  error?: string | null;
  pointsLoading?: boolean;
  pointsError?: string | null;
  onClose: () => void;
};

export function TaskDetailBubble({ task, anchor, reward, loading, error, pointsLoading, pointsError, onClose }: Props) {
  const c = usePlanColors();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const expand = useRef(new Animated.Value(0)).current;
  const shade = useRef(new Animated.Value(0)).current;
  const reducedMotion = useRef(false);
  const closing = useRef(false);
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then(reduced => {
      if (cancelled) return;
      reducedMotion.current = reduced;
      Animated.parallel([
        Animated.timing(shade, { toValue: 1, duration: reduced ? 0 : 140, useNativeDriver: true }),
        reduced ? Animated.timing(expand, { toValue: 1, duration: 0, useNativeDriver: true })
          : Animated.spring(expand, { toValue: 1, stiffness: 280, damping: 28, mass: 0.8, overshootClamping: true, useNativeDriver: true }),
      ]).start();
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', reduced => {
      reducedMotion.current = reduced;
      if (reduced) { expand.stopAnimation(); shade.stopAnimation(); expand.setValue(1); shade.setValue(1); }
    });
    return () => { cancelled = true; subscription.remove(); expand.stopAnimation(); shade.stopAnimation(); };
  }, [expand, shade]);
  const awarded = !!reward?.isAwarded;
  const earned = reward?.isAwarded ? reward.earnedPoints ?? 0 : 0;
  const available = reward?.isAvailable ? reward.maxPoints : 0;
  const unavailable = loading || !!error;
  const opensUp = anchor.y > height * 0.45;
  const bubbleWidth = Math.min(width - 32, anchor.width + 24, 360);
  const left = Math.max(16, Math.min(anchor.x - 12, width - bubbleWidth - 16));
  const edge = opensUp ? Math.max(insets.bottom + 16, height - anchor.y - anchor.height - 8) : Math.max(insets.top + 16, anchor.y - 8);
  const maxHeight = Math.max(160, height - edge - (opensUp ? insets.top : insets.bottom) - 16);
  const Icon = { steps: Footprints, food: Flame, water: Droplet, sleep: BedDouble }[task.key];
  const iconColor = c.accent;
  const dismiss = () => {
    if (closing.current) return;
    closing.current = true;
    Animated.parallel([
      Animated.timing(expand, { toValue: 0, duration: reducedMotion.current ? 0 : 120, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(shade, { toValue: 0, duration: reducedMotion.current ? 0 : 100, useNativeDriver: true }),
    ]).start(({ finished }) => { if (finished) onClose(); });
  };

  return <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={dismiss}>
    <View style={s.overlay}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: shade, backgroundColor: c.dark ? 'rgba(0,0,0,0.5)' : 'rgba(22,25,36,0.25)' }]} />
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss task details" onPress={dismiss} style={StyleSheet.absoluteFill} />
      <Animated.View accessibilityViewIsModal style={[s.bubble, { backgroundColor: c.card, left, width: bubbleWidth, maxHeight, ...(opensUp ? { bottom: edge } : { top: edge }), opacity: expand,
        transform: [{ translateY: expand.interpolate({ inputRange: [0, 1], outputRange: [opensUp ? 8 : -8, 0] }) }, { scaleX: expand.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }) }, { scaleY: expand.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] }]}>
        <View style={[s.pointer, { backgroundColor: c.card }, opensUp ? { bottom: -8 } : { top: -8 }]} />
        <ScrollView contentContainerStyle={s.content} bounces={false}>
          <View style={[ui.row, { borderBottomColor: c.line, borderBottomWidth: 1, paddingBottom: 16 }]}>
            <View style={[s.taskIcon, { backgroundColor: c.soft }]}><Icon size={23} color={iconColor} /></View>
            <View style={{ flex: 1, gap: 6 }}><Text style={[s.title, { color: c.text }]}>{task.label}</Text><View style={[s.headerReward, { backgroundColor: c.soft }]}><Heart size={11} color={c.accent} fill={c.accent} /><Text style={{ color: c.accent, fontSize: 11, fontWeight: '800' }}>{available > 0 ? '+' : ''}{available}</Text><Text style={{ color: c.accent, fontSize: 9, fontWeight: '600' }}>pts</Text></View></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close task details" onPress={dismiss} style={s.close}><X size={20} color={c.sub} /></Pressable>
          </View>
          <Text style={[s.metric, { color: c.text }]}>{loading ? 'Loading progress…' : error ? 'Progress unavailable' : task.metric}</Text>
          <View style={[s.track, { backgroundColor: c.line }]}><View style={[s.fill, { width: `${unavailable ? 0 : task.progress * 100}%`, backgroundColor: c.accent }]} /></View>
          <Text style={[s.description, { color: c.sub }]}>{unavailable ? 'Your connected activity and logs need to load before this task can be verified.' : task.remaining}</Text>
          <View style={[s.points, { backgroundColor: c.soft }]}>
            <Heart size={24} color={c.accent} fill={c.accent} />
            <View style={{ flex: 1, gap: 4 }}><Text style={[s.earned, { color: c.text }]}>{pointsLoading ? 'Loading points…' : pointsError ? 'Points unavailable' : <>{earned.toLocaleString()} <Text style={s.earnedUnit}>pts</Text> earned</>}</Text><Text style={[s.description, { color: c.sub }]}>{awarded ? 'Reward already collected for this day.' : task.key === 'sleep' ? 'No reward available until tracking is connected.' : !reward || pointsError ? 'Reward details could not be loaded.' : `${available.toLocaleString()} pts added automatically when your goal is met.`}</Text></View>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Done" onPress={dismiss} style={({ pressed }) => [s.complete, { backgroundColor: c.accent, opacity: pressed ? 0.7 : 1 }]}>
            <Check size={22} color="#FFFFFF" strokeWidth={3} /><Text style={s.completeText}>Done</Text>
          </Pressable>
        </ScrollView>
      </Animated.View>
    </View>
  </Modal>;
}

const s = StyleSheet.create({
  overlay: { flex: 1 },
  bubble: { position: 'absolute', borderRadius: 28, borderCurve: 'continuous' },
  pointer: { position: 'absolute', width: 20, height: 20, left: 36, borderRadius: 5, transform: [{ rotate: '45deg' }] },
  content: { padding: 22, gap: 16 },
  title: { fontSize: 16, lineHeight: 22, fontWeight: '700' },
  taskIcon: { width: 40, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  headerReward: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, paddingHorizontal: 6, paddingVertical: 5, borderRadius: 12 },
  close: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', marginRight: -10 },
  metric: { fontSize: 24, lineHeight: 32, fontWeight: '800', fontVariant: ['tabular-nums'] },
  track: { height: 7, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  description: { fontSize: 13, lineHeight: 20 },
  points: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 20 },
  earned: { fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  earnedUnit: { fontSize: 12, fontWeight: '600' },
  feedback: { fontSize: 13, lineHeight: 20, fontWeight: '600' },
  complete: { minHeight: 48, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 16 },
  completeText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
