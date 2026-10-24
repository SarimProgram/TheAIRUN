import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
  Keyboard,
} from 'react-native';
import { Send } from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
  runOnJS,
  interpolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { COLORS, mono } from './partnerNoteShared';

type FlySnapshot = {
  text: string;
};

type Props = {
  partnerName: string;
  compact?: boolean;
  disabled?: boolean;
  onSend: (content: string) => void;
};

function FlyingNoteClone({
  snapshot,
  compact,
  style,
}: {
  snapshot: FlySnapshot;
  compact?: boolean;
  style: object;
}) {
  return (
    <Animated.View
      style={[
        styles.annotationBox,
        compact && styles.annotationBoxCompact,
        styles.flyingClone,
        style,
      ]}
      pointerEvents="none"
    >
      <View style={styles.annotationTape} />
      <Text style={[styles.cloneText, compact && styles.cloneTextCompact]} numberOfLines={6}>
        {snapshot.text}
      </Text>
    </Animated.View>
  );
}

export default function PartnerNoteCompose({
  partnerName,
  compact,
  disabled,
  onSend,
}: Props) {
  const [text, setText] = useState('');
  const [isFlying, setIsFlying] = useState(false);
  const [flySnapshot, setFlySnapshot] = useState<FlySnapshot | null>(null);

  const flyProgress = useSharedValue(0);

  const resetCompose = useCallback(() => {
    setText('');
    setFlySnapshot(null);
    setIsFlying(false);
    flyProgress.value = 0;
  }, [flyProgress]);

  const finishSend = useCallback(
    (content: string) => {
      onSend(content);
      resetCompose();
    },
    [onSend, resetCompose]
  );

  const playLetterAnimation = useCallback(
    (content: string, snapshot: FlySnapshot) => {
      if (isFlying) return;
      Keyboard.dismiss();
      setFlySnapshot(snapshot);
      setIsFlying(true);

      if (Platform.OS !== 'web') {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      flyProgress.value = 0;
      flyProgress.value = withSequence(
        withTiming(0.12, { duration: 80, easing: Easing.out(Easing.quad) }),
        withTiming(
          1,
          { duration: 720, easing: Easing.inOut(Easing.cubic) },
          (finished) => {
            if (finished) {
              runOnJS(finishSend)(content);
            }
          }
        )
      );
    },
    [finishSend, flyProgress, isFlying]
  );

  const handleSend = useCallback(() => {
    if (disabled || isFlying) return;

    const msg = text.trim();
    if (!msg) return;
    playLetterAnimation(msg, { text: msg });
  }, [disabled, isFlying, playLetterAnimation, text]);

  const flyingStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(flyProgress.value, [0, 1], [0, compact ? 100 : 130]) },
      { translateY: interpolate(flyProgress.value, [0, 0.35, 1], [0, -24, compact ? -150 : -190]) },
      { rotate: `${interpolate(flyProgress.value, [0, 1], [0, -16])}deg` },
      { scale: interpolate(flyProgress.value, [0, 0.25, 1], [1, 0.96, 0.28]) },
    ],
    opacity: interpolate(flyProgress.value, [0, 0.75, 1], [1, 0.9, 0]),
  }));

  const trailStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flyProgress.value, [0, 0.2, 0.8, 1], [0, 0.5, 0.2, 0]),
    transform: [
      { translateX: interpolate(flyProgress.value, [0, 1], [0, compact ? 60 : 80]) },
      { translateY: interpolate(flyProgress.value, [0, 1], [0, compact ? -90 : -120]) },
      { scale: interpolate(flyProgress.value, [0, 1], [0.6, 0.2]) },
    ],
  }));

  const canSend = !disabled && !isFlying && text.trim().length > 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.stage}>
        {isFlying && (
          <Animated.View style={[styles.trail, trailStyle]} pointerEvents="none">
            <Text style={styles.trailText}>✉️</Text>
          </Animated.View>
        )}

        {isFlying && flySnapshot && (
          <FlyingNoteClone snapshot={flySnapshot} compact={compact} style={flyingStyle} />
        )}

        <View style={[styles.annotationBox, compact && styles.annotationBoxCompact]}>
          <View style={styles.annotationTape} />
          <TextInput
            style={[styles.annotationInput, compact && styles.annotationInputCompact]}
            placeholder={`Write something for ${partnerName}...`}
            placeholderTextColor="#94A3B8"
            value={text}
            onChangeText={setText}
            multiline
            maxLength={500}
            textAlignVertical="top"
            editable={!disabled && !isFlying}
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!canSend}
            activeOpacity={0.8}
            style={[styles.inlineSendBtn, !canSend && styles.inlineSendBtnDisabled]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Send size={compact ? 15 : 16} color={canSend ? COLORS.coral : '#94A3B8'} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 0 },
  stage: {
    position: 'relative',
    overflow: 'visible',
  },
  trail: {
    position: 'absolute',
    top: '30%',
    left: '40%',
    zIndex: 3,
  },
  trailText: { fontSize: 28 },
  annotationBox: {
    backgroundColor: COLORS.noteYellow,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.noteYellowDark,
    borderStyle: 'dashed',
    minHeight: 110,
    paddingHorizontal: 14,
    paddingVertical: 14,
    paddingTop: 18,
    paddingRight: 44,
    shadowColor: '#5C4033',
    shadowOffset: { width: 1, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 3,
    zIndex: 1,
  },
  annotationBoxCompact: {
    minHeight: 88,
    paddingVertical: 10,
    paddingTop: 16,
    paddingRight: 40,
  },
  flyingClone: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 8,
  },
  annotationTape: {
    position: 'absolute',
    top: -5,
    alignSelf: 'center',
    width: 48,
    height: 13,
    backgroundColor: COLORS.tapeColor,
    borderRadius: 1,
    zIndex: 2,
  },
  annotationInput: {
    flex: 1,
    minHeight: 72,
    fontFamily: mono,
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.inkDark,
    fontWeight: '600',
    paddingRight: 4,
  },
  annotationInputCompact: {
    minHeight: 56,
    fontSize: 14,
    lineHeight: 20,
  },
  inlineSendBtn: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(92, 64, 51, 0.12)',
  },
  inlineSendBtnDisabled: {
    opacity: 0.45,
  },
  cloneText: {
    fontFamily: mono,
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.inkDark,
    fontWeight: '600',
    minHeight: 72,
  },
  cloneTextCompact: {
    fontSize: 14,
    lineHeight: 20,
    minHeight: 56,
  },
});
