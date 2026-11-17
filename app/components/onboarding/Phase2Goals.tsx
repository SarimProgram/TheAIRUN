import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { Easing, cancelAnimation, interpolate, interpolateColor, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Check } from 'lucide-react-native';
import { C, EASE_OUT, OnboardingScreen, SURFACE, SURFACE_SELECTED, ScreenTitle, rise, useCompact } from './OnboardingKit';

const SETTLE = { duration: 400, dampingRatio: 0.72 };
const RING = '#D8D9DB';
const LABEL = 'rgba(8, 36, 55, 0.5)';

type Gender = 'male' | 'female';
type Props = { onNext: (name: string, gender: Gender) => void; onBack: () => void; prefilledName?: string };

const GENDERS: { id: Gender; label: string }[] = [
  { id: 'female', label: 'Female' },
  { id: 'male', label: 'Male' },
];

export default function Phase2Goals({ onNext, onBack, prefilledName = '' }: Props) {
  const compact = useCompact();
  const nameInput = useRef<TextInput>(null);
  const [name, setName] = useState(prefilledName.trim());
  const [gender, setGender] = useState<Gender>('female');
  const canContinue = name.trim().length > 0;
  const isNameEmpty = name.length === 0;
  const reduceMotion = useReducedMotion();

  const focus = useSharedValue(0);
  const placeholderOpacity = useSharedValue(1);

  useEffect(() => {
    placeholderOpacity.set(1);
    if (isNameEmpty && !reduceMotion) {
      placeholderOpacity.set(withRepeat(
        withTiming(0.55, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ));
    }
    return () => cancelAnimation(placeholderOpacity);
  }, [isNameEmpty, reduceMotion, placeholderOpacity]);

  const placeholderStyle = useAnimatedStyle(() => ({ opacity: placeholderOpacity.get() }));
  const nameFieldStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(focus.get(), [0, 1], [C.border, C.coral]),
    backgroundColor: interpolateColor(focus.get(), [0, 1], [SURFACE, C.white]),
  }));

  const selectGender = (option: Gender) => {
    if (option === gender) return;
    Haptics.selectionAsync().catch(() => {});
    setGender(option);
  };

  return <OnboardingScreen
    onBack={onBack}
    showBrand
    scrollable
    avoidKeyboard
    ctaLabel="Continue"
    onCta={() => onNext(name.trim(), gender)}
    ctaDisabled={!canContinue}
  >
    <ScreenTitle lead="Tell us about " accent="you" sparkles delay={80} />

    <View style={{ marginTop: compact ? 28 : 40, gap: compact ? 20 : 28 }}>
      <Animated.View entering={rise(180)} style={styles.section}>
        <Text style={styles.label}>Name</Text>
        <Pressable onPress={() => nameInput.current?.focus()} accessible={false}>
          <Animated.View style={[styles.nameField, compact && styles.nameFieldCompact, nameFieldStyle]}>
            {isNameEmpty && <Animated.Text pointerEvents="none" accessible={false} style={[styles.namePlaceholder, placeholderStyle]}>
              Your name
            </Animated.Text>}
            <TextInput
              ref={nameInput}
              style={styles.nameInput}
              defaultValue={name}
              onChangeText={setName}
              selectionColor={C.coral}
              onFocus={() => focus.set(withTiming(1, { duration: 200, easing: EASE_OUT }))}
              onBlur={() => focus.set(withTiming(0, { duration: 160, easing: EASE_OUT }))}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
              accessibilityLabel="Your name"
            />
          </Animated.View>
        </Pressable>
      </Animated.View>

      <Animated.View entering={rise(250)} style={styles.section}>
        <Text style={styles.label}>Gender</Text>
        <View style={styles.genderRow} accessibilityRole="radiogroup">
          {GENDERS.map((option) => (
            <View key={option.id} style={styles.fill}>
              <GenderBox option={option} selected={gender === option.id} compact={compact} onSelect={selectGender} />
            </View>
          ))}
        </View>
      </Animated.View>
    </View>
  </OnboardingScreen>;
}

function GenderBox({ option, selected, compact, onSelect }: {
  option: (typeof GENDERS)[number];
  selected: boolean;
  compact: boolean;
  onSelect: (option: Gender) => void;
}) {
  const progress = useSharedValue(selected ? 1 : 0);
  const badge = useSharedValue(selected ? 1 : 0);
  const pressed = useSharedValue(0);

  useEffect(() => {
    progress.set(withTiming(selected ? 1 : 0, { duration: 240, easing: EASE_OUT }));
    badge.set(selected ? withSpring(1, SETTLE) : withTiming(0, { duration: 140, easing: EASE_OUT }));
  }, [selected, progress, badge]);

  const boxStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(progress.get(), [0, 1], [C.border, C.coral]),
    backgroundColor: interpolateColor(progress.get(), [0, 1], [SURFACE, SURFACE_SELECTED]),
    transform: [{ scale: interpolate(pressed.get(), [0, 1], [1, 0.97]) }],
  }));
  const checkStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, badge.get() * 1.6),
    transform: [{ scale: interpolate(badge.get(), [0, 1], [0.55, 1]) }],
  }));
  const ringStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.get() }));

  return <Pressable
    onPress={() => onSelect(option.id)}
    onPressIn={() => pressed.set(withTiming(1, { duration: 110, easing: EASE_OUT }))}
    onPressOut={() => pressed.set(withTiming(0, { duration: 180, easing: EASE_OUT }))}
    accessibilityRole="radio"
    accessibilityState={{ selected }}
    accessibilityLabel={option.label}
  >
    <Animated.View style={[styles.genderBox, compact && styles.genderBoxCompact, boxStyle]}>
      <View style={styles.radio}>
        <Animated.View style={[styles.radioRing, ringStyle]} />
        <Animated.View style={[styles.radioChecked, checkStyle]}>
          <Check color={C.white} size={18} strokeWidth={3.4} />
        </Animated.View>
      </View>
      <Text style={styles.genderLabel} numberOfLines={1}>{option.label}</Text>
    </Animated.View>
  </Pressable>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  section: { gap: 10 },
  label: { marginLeft: 4, color: LABEL, fontSize: 15, fontWeight: '700' },
  nameField: { height: 64, borderRadius: 24, borderCurve: 'continuous', borderWidth: 1.5, borderColor: C.border, backgroundColor: SURFACE, justifyContent: 'center', paddingHorizontal: 22, boxShadow: '0 6px 18px rgba(8, 36, 55, 0.05)' },
  nameFieldCompact: { height: 58 },
  namePlaceholder: { position: 'absolute', left: 22, color: C.muted, fontSize: 19, fontWeight: '800', letterSpacing: -0.4 },
  nameInput: { height: '100%', paddingHorizontal: 0, paddingVertical: 0, color: C.ink, fontSize: 19, fontWeight: '800', letterSpacing: -0.4 },
  genderRow: { flexDirection: 'row', gap: 14 },
  genderBox: { height: 120, borderRadius: 24, borderCurve: 'continuous', borderWidth: 1.5, borderColor: C.border, backgroundColor: SURFACE, padding: 18, justifyContent: 'space-between', boxShadow: '0 6px 18px rgba(8, 36, 55, 0.05)' },
  genderBoxCompact: { height: 104, padding: 16 },
  genderLabel: { color: C.ink, fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  radio: { width: 28, height: 28, alignSelf: 'flex-end' },
  radioRing: { ...StyleSheet.absoluteFillObject, borderRadius: 14, borderWidth: 2, borderColor: RING },
  radioChecked: { ...StyleSheet.absoluteFillObject, borderRadius: 14, backgroundColor: C.coral, alignItems: 'center', justifyContent: 'center' },
});
