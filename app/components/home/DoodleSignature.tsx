import React, { useEffect, useRef, useState } from 'react';
import { Alert, Modal, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { WeeklyRewardColors } from './weeklyRewardTheme';

// Paths are stored in this fixed box so they render the same on both partners' screens.
const PAD_WIDTH = 320;
const PAD_HEIGHT = 160;

export function DoodleThumb({ paths, color, height, align = 'left' }: { paths: string[]; color: string; height: number; align?: 'left' | 'right' }) {
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${PAD_WIDTH} ${PAD_HEIGHT}`} preserveAspectRatio={align === 'left' ? 'xMinYMid meet' : 'xMaxYMid meet'} accessible={false}>
      {paths.map((path, index) => <Path key={index} d={path} stroke={color} strokeWidth={8} fill="none" strokeLinecap="round" strokeLinejoin="round" />)}
    </Svg>
  );
}

type SheetProps = {
  visible: boolean;
  initialPaths: string[];
  partnerName: string;
  colors: WeeklyRewardColors;
  onClose: () => void;
  onSave: (paths: string[]) => Promise<void>;
};

export function DoodleSignatureSheet({ visible, initialPaths, partnerName, colors, onClose, onSave }: SheetProps) {
  const insets = useSafeAreaInsets();
  const [draftPaths, setDraftPaths] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const draftRef = useRef<string[]>([]);
  const padSize = useRef({ width: PAD_WIDTH, height: PAD_HEIGHT });

  useEffect(() => {
    if (!visible) return;
    draftRef.current = [...initialPaths];
    setDraftPaths(draftRef.current);
    // Only reset the draft when the sheet opens, not when a background refetch changes the saved doodle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const point = (locationX: number, locationY: number) => {
    const x = Math.max(0, Math.min(PAD_WIDTH, locationX * PAD_WIDTH / padSize.current.width));
    const y = Math.max(0, Math.min(PAD_HEIGHT, locationY * PAD_HEIGHT / padSize.current.height));
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  };
  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
    onPanResponderGrant: ({ nativeEvent }) => {
      draftRef.current = [...draftRef.current, `M${point(nativeEvent.locationX, nativeEvent.locationY)} l0.1 0`];
      setDraftPaths(draftRef.current);
    },
    onPanResponderMove: ({ nativeEvent }) => {
      if (!draftRef.current.length) return;
      const next = [...draftRef.current];
      next[next.length - 1] += ` L${point(nativeEvent.locationX, nativeEvent.locationY)}`;
      draftRef.current = next;
      setDraftPaths(next);
    },
  })).current;

  const save = async () => {
    if (!draftRef.current.length || saving) return;
    setSaving(true);
    try {
      await onSave([...draftRef.current]);
      onClose();
    } catch (cause) {
      Alert.alert('Could not save your doodle', cause instanceof Error ? cause.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen" allowSwipeDismissal={false} onRequestClose={() => { if (!saving) onClose(); }}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: Math.max(20, insets.bottom) }]}>
          <View style={styles.header}>
            <Pressable accessibilityRole="button" disabled={saving} onPress={onClose} style={styles.action}>
              <Text style={{ color: colors.muted }}>Cancel</Text>
            </Pressable>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.ink }]}>Doodle to sign</Text>
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: !draftPaths.length || saving, busy: saving }} disabled={!draftPaths.length || saving} onPress={save} style={styles.action}>
              <Text style={{ color: draftPaths.length ? colors.coral : colors.muted, fontWeight: '700' }}>{saving ? 'Saving...' : 'Save'}</Text>
            </Pressable>
          </View>
          <Text style={[styles.hint, { color: colors.muted }]}>Draw your mark below. {partnerName} will see it on this week&apos;s reward.</Text>
          <View accessibilityLabel="Signature drawing area" style={[styles.pad, { borderColor: colors.border }]}
            onLayout={event => { padSize.current = event.nativeEvent.layout; }} {...responder.panHandlers}>
            <Svg width="100%" height="100%" viewBox={`0 0 ${PAD_WIDTH} ${PAD_HEIGHT}`} preserveAspectRatio="none" pointerEvents="none">
              <Path d="M16 130 H304" stroke={colors.track} strokeWidth={1} />
              {draftPaths.map((path, index) => <Path key={index} d={path} stroke={colors.ink} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />)}
            </Svg>
          </View>
          <Pressable accessibilityRole="button" disabled={saving} onPress={() => { draftRef.current = []; setDraftPaths([]); }} style={styles.action}>
            <Text style={{ color: colors.coral }}>Clear drawing</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { padding: 16, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderCurve: 'continuous' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  action: { minHeight: 44, minWidth: 60, alignItems: 'center', justifyContent: 'center' },
  title: { flexShrink: 1, fontSize: 18, fontWeight: '700' },
  hint: { fontSize: 12, lineHeight: 17, marginVertical: 8 },
  pad: { width: '100%', height: 140, borderWidth: 1, borderRadius: 16, borderCurve: 'continuous', overflow: 'hidden' },
});
