import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import { ChartPie, Flame, Salad, Send, UtensilsCrossed } from 'lucide-react-native';
import Animated, {
  Extrapolation, interpolate, interpolateColor, useAnimatedStyle, useReducedMotion, useSharedValue,
  withDelay, withSpring, withTiming, type SharedValue,
} from 'react-native-reanimated';
import PassAvatar from '@/components/mealpass/PassAvatar';
import { EASE_OUT, POP, type PassColors } from '@/components/mealpass/passTheme';
import { MAX_SHARE, MIN_SHARE, percent, type PlateTotals } from '@/lib/meal-pass';

/** How small the plate gets when it tucks into the corner of the send page. */
export const TUCKED = 0.6;

type Person = { name: string; avatarKey?: string; gender?: string | null };
export type MacroValues = { proteinG: number | null; carbsG: number | null; fatG: number | null };
const MACROS = [
  { key: 'proteinG', label: 'Protein', short: 'P', tone: 'protein', kcalPerGram: 4 },
  { key: 'carbsG', label: 'Carbs', short: 'C', tone: 'carbs', kcalPerGram: 4 },
  { key: 'fatG', label: 'Fat', short: 'F', tone: 'fat', kcalPerGram: 9 },
] as const;
const grams = (value: number | null) => (value == null ? '\u2014' : `${Math.round(value)} g`);

function usePress(reduced: boolean) {
  const press = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: press.get() }] }));
  return {
    style,
    onPressIn: () => { if (!reduced) press.set(withTiming(0.97, { duration: 110, easing: EASE_OUT })); },
    onPressOut: () => press.set(withTiming(1, { duration: 160, easing: EASE_OUT })),
  };
}

/**
 * One plate that morphs between pages: centred and large while logging, tucked beside the
 * title while sending. Driven by `progress` (0 = log, 1 = send) so it can be grabbed mid-flight.
 */
export function ReviewHero({ progress, sending, width, plateSize, plate, plateRef, name, kcal, foods, colors }: {
  progress: SharedValue<number>; sending: boolean; width: number; plateSize: number; plate: React.ReactNode;
  /** Sits where the tucked plate lands, so the throw stage always measures an untransformed frame. */
  plateRef: React.RefObject<View | null>;
  name: string; kcal: number; foods: number; colors: PassColors;
}) {
  const [textHeight, setTextHeight] = useState(72);
  const small = plateSize * TUCKED;
  const open = plateSize + 16 + textHeight;
  const foodsLabel = `${foods} ${foods === 1 ? 'food' : 'foods'}`;

  const frame = useAnimatedStyle(() => ({ height: interpolate(progress.get(), [0, 1], [open, small], Extrapolation.CLAMP) }));
  const plateMotion = useAnimatedStyle(() => {
    const p = progress.get();
    return { transform: [{ translateX: p * (small / 2 - width / 2) }, { translateY: p * (small / 2 - plateSize / 2) }, { scale: 1 - p * (1 - TUCKED) }] };
  });
  const logText = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      opacity: interpolate(p, [0, 0.45], [1, 0], Extrapolation.CLAMP),
      transform: [{ translateY: interpolate(p, [0, 1], [0, -14]) }, { scale: interpolate(p, [0, 1], [1, 0.94], Extrapolation.CLAMP) }],
    };
  });
  const sendText = useAnimatedStyle(() => {
    const p = progress.get();
    return { opacity: interpolate(p, [0.35, 1], [0, 1], Extrapolation.CLAMP), transform: [{ translateX: interpolate(p, [0, 1], [28, 0]) }] };
  });

  return (
    <Animated.View style={[{ width }, frame]}>
      <View ref={plateRef} collapsable={false} pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: small, height: small }} />
      <Animated.View style={[styles.plateSlot, { left: (width - plateSize) / 2, width: plateSize, height: plateSize }, plateMotion]}>
        <View pointerEvents="none" style={[styles.halo, { borderRadius: (plateSize + 20) / 2, backgroundColor: colors.card, boxShadow: colors.cardShadow }]} />
        {plate}
      </Animated.View>

      <Animated.View pointerEvents="none" accessibilityElementsHidden={sending} importantForAccessibility={sending ? 'no-hide-descendants' : 'auto'}
        onLayout={(event) => setTextHeight(Math.ceil(event.nativeEvent.layout.height))}
        style={[styles.logText, { top: plateSize + 16 }, logText]}>
        <Text style={[styles.heroTitle, { color: colors.ink }]} numberOfLines={2}>{name}</Text>
        <View style={styles.chips}>
          <View style={[styles.chip, { backgroundColor: colors.accentSoft }]}>
            <Flame size={15} color={colors.accent} strokeWidth={2.4} />
            <Text selectable style={[styles.chipText, { color: colors.accent }]}>{kcal.toLocaleString()} kcal</Text>
          </View>
          <View style={[styles.chip, { backgroundColor: colors.soft }]}>
            <UtensilsCrossed size={14} color={colors.muted} strokeWidth={2.2} />
            <Text style={[styles.chipText, { color: colors.muted }]}>{foodsLabel}</Text>
          </View>
        </View>
      </Animated.View>

      <Animated.View pointerEvents="none" accessibilityElementsHidden={!sending} importantForAccessibility={sending ? 'auto' : 'no-hide-descendants'}
        style={[styles.sendText, { left: small + 16, height: small }, sendText]}>
        <Text style={[styles.sendTitle, { color: colors.ink }]} numberOfLines={2}>{name}</Text>
        <Text style={[styles.sendMeta, { color: colors.muted }]}>{kcal.toLocaleString()} kcal {'\u00b7'} {foodsLabel}</Text>
      </Animated.View>
    </Animated.View>
  );
}

function MacroSegment({ flex, color, track, order, reduced }: { flex: number; color: string; track: string; order: number; reduced: boolean }) {
  const grow = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) grow.set(withDelay(140 + order * 90, withTiming(1, { duration: 560, easing: EASE_OUT })));
  }, [grow, order, reduced]);
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: grow.get() }] }));
  return (
    <View style={[styles.segment, { flex, backgroundColor: track }]}>
      <Animated.View style={[styles.segmentFill, { backgroundColor: color }, fill]} />
    </View>
  );
}

/** Calorie-weighted macro bar that fills left to right when the review appears. */
export function MacroCard({ values, colors }: { values: MacroValues; colors: PassColors }) {
  const reduced = useReducedMotion();
  if (MACROS.every(({ key }) => values[key] == null)) return null;
  const energy = MACROS.map(({ key, kcalPerGram }) => (values[key] ?? 0) * kcalPerGram);
  const sum = energy.reduce((total, value) => total + value, 0);
  return (
    <View style={[styles.card, styles.macroCard, { backgroundColor: colors.card, boxShadow: colors.cardShadow }]}>
      <View style={styles.bar}>
        {MACROS.map(({ key, tone }, index) => (
          <MacroSegment key={key} order={index} reduced={reduced} color={colors[tone]} track={colors.soft}
            flex={Math.max(0.06, sum > 0 ? energy[index] / sum : 1 / 3)} />
        ))}
      </View>
      <View style={styles.macroRow}>
        {MACROS.map(({ key, label, tone }, index) => (
          <View key={key} style={[styles.macroCell, index > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderColor: colors.line }]}>
            <View style={styles.macroLabelRow}>
              <View style={[styles.dot, { backgroundColor: colors[tone] }]} />
              <Text style={[styles.macroLabel, { color: colors.muted }]}>{label}</Text>
            </View>
            <Text selectable style={[styles.macroValue, { color: colors.ink }]}>{grams(values[key])}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** The doorway to the send page: both of you, and a paper plane that pushes the page in. */
export function SendRow({ you, partner, name, disabled, onPress, colors }: {
  you: Person; partner: Person; name: string; disabled: boolean; onPress: () => void; colors: PassColors;
}) {
  const reduced = useReducedMotion();
  const press = usePress(reduced);
  return (
    <Animated.View style={press.style}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Send log to ${name}`} accessibilityHint="Choose the full meal or a portion"
        disabled={disabled} onPress={onPress} onPressIn={press.onPressIn} onPressOut={press.onPressOut}
        style={[styles.card, styles.sendRow, { backgroundColor: colors.card, boxShadow: colors.cardShadow, opacity: disabled ? 0.5 : 1 }]}>
        <View style={styles.pair}>
          <PassAvatar avatarKey={you.avatarKey} name={you.name} gender={you.gender} size={38} ring={colors.you} soft={colors.youSoft} />
          <View style={[styles.pairBack, { borderColor: colors.card }]}>
            <PassAvatar avatarKey={partner.avatarKey} name={partner.name} gender={partner.gender} size={38} ring={colors.partner} soft={colors.partnerSoft} />
          </View>
        </View>
        <View style={[styles.rule, { backgroundColor: colors.line }]} />
        <View style={styles.sendCopy}>
          <Text style={[styles.sendRowTitle, { color: colors.ink }]} numberOfLines={1}>Send log to {name}</Text>
          <Text style={[styles.sendRowSub, { color: colors.muted }]} numberOfLines={1}>Full meal or a portion</Text>
        </View>
        <View style={[styles.sendButton, { backgroundColor: colors.accent, boxShadow: colors.accentShadow }]}>
          <Send size={18} color={colors.onAccent} strokeWidth={2.4} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

function OptionCard({ selected, locked, onPress, title, body, Icon, colors }: {
  selected: boolean; locked: boolean; onPress: () => void; title: string; body: string;
  Icon: typeof Salad; colors: PassColors;
}) {
  const reduced = useReducedMotion();
  const press = usePress(reduced);
  const on = useSharedValue(selected ? 1 : 0);
  useEffect(() => { on.set(withTiming(selected ? 1 : 0, { duration: reduced ? 0 : 220, easing: EASE_OUT })); }, [on, reduced, selected]);
  const { card, accentSoft, line, accent } = colors;
  const surface = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.get(), [0, 1], [card, accentSoft]),
    borderColor: interpolateColor(on.get(), [0, 1], [line, accent]),
  }));
  const ring = useAnimatedStyle(() => ({ borderColor: interpolateColor(on.get(), [0, 1], [line, accent]) }));
  const dot = useSharedValue(selected ? 1 : 0);
  useEffect(() => { dot.set(reduced ? (selected ? 1 : 0) : withSpring(selected ? 1 : 0, POP)); }, [dot, reduced, selected]);
  const dotStyle = useAnimatedStyle(() => ({ transform: [{ scale: dot.get() }] }));
  return (
    <Animated.View style={[styles.optionWrap, press.style]}>
      <Pressable accessibilityRole="radio" accessibilityState={{ selected, disabled: locked }} accessibilityLabel={`${title}. ${body}`}
        disabled={locked} onPress={onPress} onPressIn={press.onPressIn} onPressOut={press.onPressOut}
        style={{ opacity: locked && !selected ? 0.5 : 1 }}>
        <Animated.View style={[styles.option, { boxShadow: colors.cardShadow }, surface]}>
          <Animated.View style={[styles.radio, ring]}>
            <Animated.View style={[styles.radioDot, { backgroundColor: accent }, dotStyle]} />
          </Animated.View>
          <Icon size={34} color={selected ? accent : colors.muted} strokeWidth={1.8} />
          <Text style={[styles.optionTitle, { color: colors.ink }]} numberOfLines={1}>{title}</Text>
          <Text style={[styles.optionBody, { color: colors.muted }]} numberOfLines={1}>{body}</Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

/** Full meal (they log their own copy) or a portion (you split this plate). */
export function SendOptions({ portion, locked, onChoose, fullKcal, colors }: {
  portion: boolean; locked: boolean; onChoose: (portion: boolean) => void; fullKcal: number; colors: PassColors;
}) {
  const pick = (next: boolean) => {
    if (locked || next === portion) return;
    void Haptics.selectionAsync().catch(() => {});
    onChoose(next);
  };
  return (
    <View style={styles.options} accessibilityRole="radiogroup">
      <OptionCard selected={!portion} locked={locked} onPress={() => pick(false)} colors={colors}
        Icon={Salad} title="Send full meal" body={`${fullKcal.toLocaleString()} kcal`} />
      <OptionCard selected={portion} locked={locked} onPress={() => pick(true)} colors={colors}
        Icon={ChartPie} title="Send a portion" body="Choose amount" />
    </View>
  );
}

/** Their share of this plate, with what it carries updating live under the slider. */
export function PortionCard({ share, totals, keepKcal, locked, onChange, colors }: {
  share: number; totals: PlateTotals; keepKcal: number; locked: boolean; onChange: (share: number) => void; colors: PassColors;
}) {
  const last = useRef(share);
  const change = (value: number) => {
    const rounded = Math.round(value * 100) / 100;
    if (rounded === last.current) return;
    last.current = rounded;
    void Haptics.selectionAsync().catch(() => {});
    onChange(rounded);
  };
  return (
    <View style={[styles.card, styles.portion, { backgroundColor: colors.card, boxShadow: colors.cardShadow }]}>
      <View style={styles.portionHeader}>
        <Text style={[styles.portionTitle, { color: colors.ink }]}>Portion size</Text>
        <Text style={[styles.portionValue, { color: colors.accent }]}>{percent(share)}</Text>
      </View>
      <Slider
        accessibilityLabel={`Portion to send, ${percent(share)}. You keep ${keepKcal} calories.`}
        style={styles.slider} value={share} disabled={locked}
        minimumValue={MIN_SHARE} maximumValue={MAX_SHARE} step={0.05} onValueChange={change}
        minimumTrackTintColor={colors.accent} maximumTrackTintColor={colors.line} thumbTintColor="#FFFFFF"
      />
      <View style={[styles.readout, { backgroundColor: colors.soft }]}>
        <View style={[styles.chip, styles.readoutKcal, { backgroundColor: colors.accentSoft }]}>
          <Flame size={14} color={colors.accent} strokeWidth={2.4} />
          <Text selectable style={[styles.chipText, { color: colors.accent }]}>{totals.calories.toLocaleString()} kcal</Text>
        </View>
        {MACROS.map(({ key, short, tone }) => (
          <View key={key} style={styles.readoutMacro}>
            <View style={[styles.dot, { backgroundColor: colors[tone] }]} />
            <Text style={[styles.readoutText, { color: colors.ink }]}>{short} {Math.round(totals[key])} g</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  plateSlot: { position: 'absolute', top: 0, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', top: -10, left: -10, right: -10, bottom: -10 },
  logText: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  heroTitle: { fontSize: 26, lineHeight: 31, fontWeight: '800', letterSpacing: -0.6, textAlign: 'center', textTransform: 'capitalize' },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { height: 32, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 16 },
  chipText: { fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
  sendText: { position: 'absolute', top: 0, right: 0, justifyContent: 'center', gap: 4 },
  sendTitle: { fontSize: 22, lineHeight: 27, fontWeight: '800', letterSpacing: -0.5, textTransform: 'capitalize' },
  sendMeta: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  card: { borderRadius: 24, borderCurve: 'continuous' },
  macroCard: { padding: 16, gap: 16 },
  bar: { flexDirection: 'row', gap: 4 },
  segment: { height: 8, borderRadius: 4, overflow: 'hidden' },
  segmentFill: { flex: 1, borderRadius: 4, transformOrigin: 'left' },
  macroRow: { flexDirection: 'row' },
  macroCell: { flex: 1, alignItems: 'center', gap: 4 },
  macroLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  macroLabel: { fontSize: 13, fontWeight: '600' },
  macroValue: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
  sendRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 16, paddingRight: 12, paddingVertical: 12 },
  pair: { flexDirection: 'row' },
  pairBack: { marginLeft: -10, borderRadius: 21, borderWidth: 2 },
  rule: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginVertical: 4 },
  sendCopy: { flex: 1, gap: 2 },
  sendRowTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  sendRowSub: { fontSize: 12, fontWeight: '600' },
  sendButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  options: { flexDirection: 'row', gap: 12 },
  optionWrap: { flex: 1 },
  option: { minHeight: 148, borderRadius: 24, borderCurve: 'continuous', borderWidth: 1.5, padding: 16, gap: 6, alignItems: 'center', justifyContent: 'center' },
  radio: { position: 'absolute', top: 12, right: 12, width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 12, height: 12, borderRadius: 6 },
  optionTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2, marginTop: 6 },
  optionBody: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  portion: { padding: 16, gap: 8 },
  portionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  portionTitle: { fontSize: 16, fontWeight: '800' },
  portionValue: { fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  slider: { width: '100%', height: 44 },
  readout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4, padding: 4, borderRadius: 20, borderCurve: 'continuous' },
  readoutKcal: { height: 32 },
  readoutMacro: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 6 },
  readoutText: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
