import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing as ReanimatedEasing,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Heart, X, Send } from 'lucide-react-native';

export const INTERVENE_ANIMATION_COST = 25;

export function formatPointsAlert(amount) {
  return `Need ❤ ${amount.toLocaleString()} pts`;
}

function PointsMark({
  amount,
  loading = false,
  variant = 'default',
  heartSize = 15,
  textStyle,
}) {
  const heartColor = variant === 'light' ? '#FFFFFF' : COLORS.coral;
  const valueStyle = [
    variant === 'light' ? styles.pointsMarkTextLight : styles.pointsMarkText,
    textStyle,
  ];

  return (
    <View style={styles.pointsMark}>
      <Heart size={heartSize} color={heartColor} fill={heartColor} />
      <Text style={valueStyle}>
        {loading ? '—' : `${Number(amount).toLocaleString()} pts`}
      </Text>
    </View>
  );
}

const COLORS = {
  text: '#0F172A',
  textMuted: '#64748B',
  textSoft: '#94A3B8',
  line: '#E2E8F0',
  canvas: '#F8FAFC',
  coral: '#FF6B6B',
};

function SheetShell({ visible, onClose, bottomInset, children }) {
  const [mounted, setMounted] = useState(false);
  const translateY = useSharedValue(520);
  const backdrop = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.value = 520;
      backdrop.value = 0;
      backdrop.value = withTiming(1, {
        duration: 260,
        easing: ReanimatedEasing.out(ReanimatedEasing.cubic),
      });
      translateY.value = withTiming(0, {
        duration: 380,
        easing: ReanimatedEasing.out(ReanimatedEasing.cubic),
      });
      return undefined;
    }

    backdrop.value = withTiming(0, {
      duration: 220,
      easing: ReanimatedEasing.in(ReanimatedEasing.cubic),
    });
    translateY.value = withTiming(
      520,
      {
        duration: 300,
        easing: ReanimatedEasing.in(ReanimatedEasing.cubic),
      },
      (finished) => {
        if (finished) {
          runOnJS(setMounted)(false);
        }
      }
    );

    return undefined;
  }, [visible, backdrop, translateY]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdrop.value * 0.42,
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
          style={[
            styles.panel,
            { paddingBottom: Math.max(bottomInset, 20) },
            sheetStyle,
          ]}
        >
          <View style={styles.handle} />
          {children}
        </Reanimated.View>
      </View>
    </Modal>
  );
}

const InterveneBottomSheet = ({
  visible,
  onClose,
  bottomInset = 0,
  pointsBalance = 0,
  pointsLoading = false,
  onSendMessage,
  onSendAnimation,
}) => {
  const [busy, setBusy] = useState(false);
  const canAffordAnimation = pointsBalance >= INTERVENE_ANIMATION_COST;

  const messageOptions = useMemo(() => ([
    { id: 'gentle', label: 'Gentle', text: 'You’ve got this. Small reset and finish strong today ❤️' },
    { id: 'coach', label: 'Coach', text: 'Keep the next meal lighter — you can still recover 💪' },
    { id: 'funny', label: 'Funny', text: 'Calories are getting spicy 😅 One smart choice fixes it.' },
  ]), []);

  const animationOptions = useMemo(() => ([
    {
      id: 'calorie-check',
      mode: 'angry',
      text: 'Eat less!!',
      eyebrow: 'Calorie check',
      title: 'Eat less!!',
      emoji: '😠',
      cardStyle: styles.animationCardAngry,
    },
  ]), []);

  const handleMessage = (option) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSendMessage?.(option.text, option.label);
    onClose?.();
  };

  const handleAnimation = async (option) => {
    if (busy) return;
    if (!canAffordAnimation) {
      Alert.alert('Not enough points', formatPointsAlert(INTERVENE_ANIMATION_COST));
      return;
    }

    try {
      setBusy(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const ok = await onSendAnimation?.(option);
      if (ok) {
        onClose?.();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <SheetShell visible={visible} onClose={onClose} bottomInset={bottomInset}>
      <View style={styles.header}>
        <Text style={styles.title}>Intervene</Text>
        <View style={styles.headerRight}>
          <View style={styles.pointsPill}>
            <PointsMark amount={pointsBalance} loading={pointsLoading} />
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={10}>
            <X size={18} color={COLORS.textMuted} strokeWidth={2.2} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.sectionTitle}>Animation</Text>
        <View style={styles.animationRow}>
          {animationOptions.map((option) => (
            <TouchableOpacity
              key={option.id}
              onPress={() => handleAnimation(option)}
              activeOpacity={0.9}
              disabled={busy || !canAffordAnimation}
              style={[
                styles.animationCard,
                option.cardStyle,
                !canAffordAnimation && styles.animationCardDisabled,
              ]}
            >
              <View style={styles.animationIconWrap}>
                <Text style={styles.animationEmoji}>{option.emoji}</Text>
              </View>
              <Text style={styles.animationEyebrow}>{option.eyebrow}</Text>
              <Text style={styles.animationTitle}>{option.title}</Text>
              <View style={styles.animationCostWrap}>
                <PointsMark amount={INTERVENE_ANIMATION_COST} heartSize={12} textStyle={styles.animationCostText} />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Messages</Text>
        <View style={styles.messageStack}>
          {messageOptions.map((option) => (
            <TouchableOpacity
              key={option.id}
              onPress={() => handleMessage(option)}
              style={styles.messageCard}
              activeOpacity={0.88}
            >
              <View style={styles.messageIconWrap}>
                <Send size={16} color={COLORS.coral} strokeWidth={2.4} />
              </View>
              <View style={styles.messageCopy}>
                <Text style={styles.messageLabel}>{option.label}</Text>
                <Text style={styles.messagePreview} numberOfLines={1}>
                  {option.text}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SheetShell>
  );
};

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
    maxHeight: '84%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
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
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pointsPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.canvas,
  },
  pointsMark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pointsMarkText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  pointsMarkTextLight: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.2,
    marginBottom: 14,
  },
  sectionTitleSpaced: {
    marginTop: 32,
  },
  animationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 4,
  },
  animationCard: {
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 148,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  animationCardAngry: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  animationCardDisabled: {
    opacity: 0.5,
  },
  animationIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  animationEmoji: {
    fontSize: 26,
  },
  animationEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
    textAlign: 'center',
  },
  animationTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.2,
    textAlign: 'center',
    marginBottom: 12,
  },
  animationCostWrap: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  animationCostText: {
    fontSize: 12,
    fontWeight: '800',
  },
  messageStack: {
    gap: 12,
  },
  messageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderRadius: 22,
    backgroundColor: COLORS.canvas,
  },
  messageIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  messageCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  messageLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  messagePreview: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    lineHeight: 20,
  },
});

export default InterveneBottomSheet;
