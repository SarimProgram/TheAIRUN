import { useColorScheme } from '@/hooks/use-color-scheme';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  } from 'react-native';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSpring,
  interpolate,
  Easing,
  cancelAnimation,
  runOnJS,
  FadeInDown,
  Layout,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Droplets, Send, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedBeggingCat } from '@/components/partner/AnimatedBeggingCat';
import { resolveReminderSendMessage } from '@/components/partner/reminderAssets';
import type { PartnerReminderOption } from '@/components/partner/reminderAssets';
import { getDisplayContent } from '@/components/chat/partnerNoteShared';
import {
  HOME_WATER_CUSTOM_OPTION,
  HOME_WATER_REMINDER_OPTIONS,
  buildHomeWaterCustomMessage,
} from './waterReminderOptions';

const DROP_BURST = [
  { left: '8%' as const, delay: 0, size: 14, drift: -8 },
  { left: '28%' as const, delay: 120, size: 17, drift: 6 },
  { left: '48%' as const, delay: 70, size: 12, drift: -4 },
  { left: '68%' as const, delay: 200, size: 16, drift: 10 },
  { left: '88%' as const, delay: 50, size: 13, drift: -12 },
];

const COLORS = {
  water: '#08B8E1',
  waterSoft: '#B0EEFA',
  canvas: '#F0FAFF',
  ink: '#0F172A',
  muted: '#64748B',
  line: '#E2E8F0',
};

type SheetShellProps = {
  visible: boolean;
  onClose: () => void;
  bottomInset: number;
  children: React.ReactNode;
};

function SheetShell({ visible, onClose, bottomInset, children }: SheetShellProps) {
  const [mounted, setMounted] = useState(false);
  const translateY = useSharedValue(560);
  const backdrop = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.value = 560;
      backdrop.value = 0;
      backdrop.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) });
      translateY.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) });
      return undefined;
    }

    backdrop.value = withTiming(0, { duration: 220, easing: Easing.in(Easing.cubic) });
    translateY.value = withTiming(
      560,
      { duration: 300, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) {
          runOnJS(setMounted)(false);
        }
      },
    );
    return undefined;
  }, [visible, backdrop, translateY]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdrop.value * 0.45,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!mounted) {
    return null;
  }

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Reanimated.View pointerEvents="none" style={[styles.backdrop, backdropStyle]} />
        <Pressable style={styles.dismiss} onPress={onClose} accessibilityRole="button" />
        <Reanimated.View
          style={[styles.panel, { paddingBottom: Math.max(bottomInset, 20) }, sheetStyle]}
        >
          <View style={styles.handle} />
          {children}
        </Reanimated.View>
      </View>
    </Modal>
  );
}

function FloatingDrop({
  left,
  delay,
  size,
  drift,
}: {
  left: string;
  delay: number;
  size: number;
  drift: number;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: 2400, easing: Easing.out(Easing.cubic) }),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(progress);
  }, [delay, progress]);

  const dropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.12, 0.65, 1], [0, 1, 0.85, 0]),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [24, -110]) },
      { translateX: interpolate(progress.value, [0, 0.5, 1], [0, drift, drift * 1.2]) },
      { scale: interpolate(progress.value, [0, 0.25, 0.6, 1], [0.35, 1.1, 1, 0.75]) },
    ],
  }));

  return (
    <Reanimated.View style={[styles.floatingDrop, { left }, dropStyle]}>
      <Text style={{ fontSize: size }}>💧</Text>
    </Reanimated.View>
  );
}

type WaterReminderBottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  partnerName: string;
  chatConnected: boolean;
  onSend: (option: PartnerReminderOption, message: string) => void;
};

export default function WaterReminderBottomSheet({
  visible,
  onClose,
  partnerName,
  chatConnected,
  onSend,
}: WaterReminderBottomSheetProps) {
  const insets = useSafeAreaInsets();
  const dark = useColorScheme() === 'dark';
  const ink = dark ? '#F1F5F9' : COLORS.ink;
  const muted = dark ? '#94A3B8' : COLORS.muted;
  const previewBg = dark ? '#1E3A4A' : COLORS.canvas;

  const options = useMemo(() => HOME_WATER_REMINDER_OPTIONS, []);
  const [selectedId, setSelectedId] = useState(options[0]?.id ?? 'water-1');
  const [customText, setCustomText] = useState('');
  const [useCustom, setUseCustom] = useState(false);

  const selected = useMemo(
    () => (useCustom ? HOME_WATER_CUSTOM_OPTION : options.find((o) => o.id === selectedId) ?? options[0]),
    [options, selectedId, useCustom],
  );

  const previewTitle = useMemo(() => {
    if (useCustom && customText.trim()) {
      return customText.trim();
    }
    if (!selected) {
      return 'Drink some water.';
    }
    return selected.previewTitle;
  }, [customText, selected, useCustom]);

  const previewScale = useSharedValue(1);

  useEffect(() => {
    if (!visible) {
      return;
    }
    previewScale.value = 0.96;
    previewScale.value = withSpring(1, { damping: 16, stiffness: 220, mass: 0.85 });
  }, [previewTitle, previewScale, selectedId, useCustom, visible]);

  const previewCardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: previewScale.value }],
  }));

  const handleSend = useCallback(async () => {
    if (!chatConnected) {
      Alert.alert('Chat unavailable', 'Live partner chat is not available right now.');
      return;
    }
    if (!selected) {
      return;
    }

    const message = useCustom
      ? buildHomeWaterCustomMessage(customText)
      : await resolveReminderSendMessage(selected, partnerName);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSend(selected, message);
    onClose();
  }, [chatConnected, customText, onClose, onSend, partnerName, selected, useCustom]);

  return (
    <SheetShell visible={visible} onClose={onClose} bottomInset={insets.bottom}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Droplets size={22} color={COLORS.water} fill={COLORS.waterSoft} />
          <Text style={[styles.title, { color: ink }]}>Water reminder</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={10} accessibilityRole="button">
          <X size={18} color={muted} strokeWidth={2.2} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={[styles.sectionLabel, { color: muted }]}>Preview — what your partner sees</Text>

        <Reanimated.View
          style={[
            styles.previewCard,
            previewCardStyle,
            { backgroundColor: previewBg, borderColor: dark ? '#334155' : '#CDEEF8' },
          ]}
        >
          <View style={styles.previewBurst} pointerEvents="none">
            {DROP_BURST.map((drop, index) => (
              <FloatingDrop key={`drop-${index}`} {...drop} />
            ))}
          </View>

          {selected?.previewImage ? (
            <AnimatedBeggingCat
              source={selected.previewImage}
              animation={selected.photoAnimation ?? 'float'}
              style={styles.previewMascot}
            />
          ) : null}

          <Text style={styles.previewEyebrow}>YOU · HYDRATION</Text>
          <Reanimated.Text
            key={previewTitle}
            entering={FadeInDown.duration(280).springify().damping(18)}
            style={[styles.previewMessage, { color: ink }]}
            numberOfLines={3}
          >
            {previewTitle}
          </Reanimated.Text>
        </Reanimated.View>

        <Text style={[styles.sectionLabel, styles.sectionLabelSpaced, { color: muted }]}>Choose a nudge</Text>
        <View style={styles.optionStack}>
          {options.map((option) => {
            const active = !useCustom && option.id === selectedId;
            return (
              <Reanimated.View key={option.id} layout={Layout.springify().damping(20)}>
                <TouchableOpacity
                  activeOpacity={0.88}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setUseCustom(false);
                    setSelectedId(option.id);
                  }}
                  style={[
                    styles.optionCard,
                    {
                      backgroundColor: active ? (dark ? '#164E63' : '#E0F7FE') : dark ? '#1E293B' : '#F8FAFC',
                      borderColor: active ? COLORS.water : COLORS.line,
                    },
                  ]}
                >
                  <Text style={[styles.optionLabel, { color: active ? COLORS.water : ink }]}>{option.label}</Text>
                  <Text style={[styles.optionPreview, { color: muted }]} numberOfLines={1}>
                    {getDisplayContent(option.buildMessage(partnerName))}
                  </Text>
                </TouchableOpacity>
              </Reanimated.View>
            );
          })}

          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => {
              Haptics.selectionAsync();
              setUseCustom(true);
            }}
            style={[
              styles.optionCard,
              {
                backgroundColor: useCustom ? (dark ? '#164E63' : '#E0F7FE') : dark ? '#1E293B' : '#F8FAFC',
                borderColor: useCustom ? COLORS.water : COLORS.line,
              },
            ]}
          >
            <Text style={[styles.optionLabel, { color: useCustom ? COLORS.water : ink }]}>Custom note</Text>
            <TextInput
              value={customText}
              onChangeText={(t) => {
                setCustomText(t);
                setUseCustom(true);
              }}
              placeholder="Write your hydration message…"
              placeholderTextColor={muted}
              style={[styles.customInput, { color: ink }]}
              multiline
              maxLength={120}
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.9}
          onPress={() => void handleSend()}
          style={styles.sendButton}
        >
          <Send size={18} color="#FFFFFF" strokeWidth={2.4} />
          <Text style={styles.sendLabel}>Send to {partnerName.split(/\s+/)[0] || 'partner'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SheetShell>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#020617',
  },
  dismiss: {
    ...StyleSheet.absoluteFillObject,
  },
  panel: {
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 22,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.16,
    shadowRadius: 32,
    elevation: 28,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#CBD5E1',
    marginTop: 10,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: 12,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  sectionLabelSpaced: {
    marginTop: 20,
  },
  previewCard: {
    borderRadius: 24,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    paddingVertical: 20,
    paddingHorizontal: 18,
    alignItems: 'center',
    overflow: 'hidden',
    minHeight: 200,
  },
  previewBurst: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  floatingDrop: {
    position: 'absolute',
    bottom: 24,
    zIndex: 0,
  },
  previewMascot: {
    width: 120,
    height: 120,
    marginBottom: 8,
    zIndex: 1,
  },
  previewEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: COLORS.water,
    marginBottom: 6,
    zIndex: 1,
  },
  previewMessage: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
    lineHeight: 28,
    zIndex: 1,
    paddingHorizontal: 8,
  },
  optionStack: {
    gap: 10,
  },
  optionCard: {
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 4,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '800',
  },
  optionPreview: {
    fontSize: 13,
    fontWeight: '500',
  },
  customInput: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 6,
    minHeight: 44,
    paddingVertical: 4,
  },
  sendButton: {
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.water,
    borderRadius: 20,
    borderCurve: 'continuous',
    minHeight: 54,
    shadowColor: '#08B8E1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
  },
  sendLabel: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
});
