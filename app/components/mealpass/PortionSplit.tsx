import React, { useRef, useState } from 'react';
import { LayoutAnimation, Pressable, StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useReducedMotion } from 'react-native-reanimated';
import PassAvatar from './PassAvatar';
import {
  MAX_SERVING, MAX_SHARE, MIN_SERVING, MIN_SHARE, overallShare, percent, plateTotals,
  recipientPortion, senderPortion, uniformShares, type PassMode, type PlateItem,
} from '@/lib/meal-pass';
import type { PassColors } from './passTheme';

export type SplitPerson = { label: string; avatarKey?: string; gender?: string | null };

type Props = {
  mode: PassMode;
  items: PlateItem[];
  /** Always the recipient's shares (SPLIT fractions or COPY servings), whichever phone is showing this. */
  shares: number[];
  onChange?: (shares: number[]) => void;
  /** The person on this phone, shown on the left. */
  you: SplitPerson;
  other: SplitPerson;
  youAreRecipient: boolean;
  colors: PassColors;
};

const COPY_STEP = 0.25;

/** Both avatars with the portion between them; numbers update in place so the meal photo above stays still. */
export default function PortionSplit({ mode, items, shares, onChange, you, other, youAreRecipient, colors }: Props) {
  const reduced = useReducedMotion();
  const [adjusting, setAdjusting] = useState(false);
  const lastTick = useRef<string | null>(null);
  const recipient = plateTotals(recipientPortion(items, shares));
  const sender = plateTotals(senderPortion(items, shares, mode));
  const yours = youAreRecipient ? recipient : sender;
  const theirs = youAreRecipient ? sender : recipient;
  const share = overallShare(items, shares);
  const copy = mode === 'COPY';
  // In a copy, only the recipient's own serving is adjustable; the sender's plate is never touched.
  const editable = !!onChange && (!copy || youAreRecipient);
  const yourLabel = copy ? (youAreRecipient ? percent(share) : percent(1)) : percent(youAreRecipient ? share : 1 - share);
  const theirLabel = copy ? (youAreRecipient ? percent(1) : percent(share)) : percent(youAreRecipient ? 1 - share : share);

  const tick = (label: string) => {
    if (lastTick.current === label) return;
    lastTick.current = label;
    void Haptics.selectionAsync().catch(() => {});
  };
  // The slider reads left-to-right as "your side", on either phone.
  const sliderValue = copy ? share : youAreRecipient ? share : 1 - share;
  const changeAll = (value: number) => {
    const next = copy ? value : youAreRecipient ? value : 1 - value;
    const rounded = Math.round(next * 100) / 100;
    tick(String(rounded));
    onChange?.(uniformShares(items, rounded));
  };
  const changeItem = (index: number, value: number) => {
    const next = copy ? value : youAreRecipient ? value : 1 - value;
    const rounded = Math.round(next * 100) / 100;
    tick(`${index}:${rounded}`);
    onChange?.(shares.map((current, i) => (i === index ? rounded : current)));
  };
  const toggleAdjust = () => {
    if (!reduced) LayoutAnimation.configureNext(LayoutAnimation.create(200, 'easeInEaseOut', 'opacity'));
    setAdjusting((value) => !value);
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card, boxShadow: colors.cardShadow }]}>
      <View style={styles.people}>
        <Person person={you} label={yourLabel} kcal={yours.calories} ring={colors.you} soft={colors.youSoft} colors={colors} />
        <View style={styles.between}>
          {editable ? (
            <Slider
              accessibilityLabel={copy ? 'Your serving' : `Your share of the plate, ${yourLabel}. ${other.label} gets ${theirLabel}.`}
              style={styles.slider}
              value={sliderValue}
              minimumValue={copy ? MIN_SERVING : MIN_SHARE}
              maximumValue={copy ? MAX_SERVING : MAX_SHARE}
              step={copy ? COPY_STEP : 0.05}
              onValueChange={changeAll}
              minimumTrackTintColor={colors.you}
              maximumTrackTintColor={copy ? colors.line : colors.partner}
              thumbTintColor="#FFFFFF"
            />
          ) : (
            <View style={copy ? styles.copyPlates : styles.staticTrack} accessible accessibilityLabel={copy ? `You each get a full plate.` : `You ${yourLabel}, ${other.label} ${theirLabel}`}>
              {copy ? <>
                <View style={[styles.copyPlate, { borderColor: colors.you, backgroundColor: colors.youSoft }]} />
                <View style={[styles.copyPlate, { borderColor: colors.partner, backgroundColor: colors.partnerSoft }]} />
              </> : <>
                <View style={[styles.trackPart, { flex: Math.max(0.05, youAreRecipient ? share : 1 - share), backgroundColor: colors.you }]} />
                <View style={[styles.trackPart, { flex: Math.max(0.05, youAreRecipient ? 1 - share : share), backgroundColor: colors.partner }]} />
              </>}
            </View>
          )}
        </View>
        <Person person={other} label={theirLabel} kcal={theirs.calories} ring={colors.partner} soft={colors.partnerSoft} colors={colors} />
      </View>

      {editable && items.length > 1 && (
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: adjusting }} onPress={toggleAdjust}
          style={({ pressed }) => [styles.adjust, { opacity: pressed ? 0.6 : 1 }]}>
          <Text style={[styles.adjustText, { color: colors.ink }]}>Adjust foods</Text>
          {adjusting ? <ChevronUp size={16} color={colors.muted} /> : <ChevronDown size={16} color={colors.muted} />}
        </Pressable>
      )}
      {editable && adjusting && items.length > 1 && (
        <View style={styles.foods}>
          {items.map((item, index) => {
            const factor = shares[index] ?? 0;
            const theirPart = Math.round(item.calories * factor);
            const recipientKcal = theirPart;
            const senderKcal = copy ? item.calories : item.calories - theirPart;
            const yourKcal = youAreRecipient ? recipientKcal : senderKcal;
            const otherKcal = youAreRecipient ? senderKcal : recipientKcal;
            return (
              <View key={`${item.foodName}-${index}`} style={[styles.food, { borderColor: colors.line }]}>
                <View style={styles.foodTop}>
                  <Text style={[styles.foodName, { color: colors.ink }]} numberOfLines={1}>{item.foodName}</Text>
                  <Text style={[styles.foodKcal, { color: colors.muted }]}>
                    <Text style={{ color: colors.you }}>{yourKcal}</Text>
                    {' \u00b7 '}
                    <Text style={{ color: colors.partner }}>{otherKcal}</Text>
                    {' kcal'}
                  </Text>
                </View>
                <Slider
                  accessibilityLabel={`${item.foodName}: you ${yourKcal} calories, ${other.label} ${otherKcal}`}
                  style={styles.foodSlider}
                  value={copy ? factor : youAreRecipient ? factor : 1 - factor}
                  minimumValue={0}
                  maximumValue={copy ? MAX_SERVING : 1}
                  step={copy ? COPY_STEP : 0.05}
                  onValueChange={(value) => changeItem(index, value)}
                  minimumTrackTintColor={colors.you}
                  maximumTrackTintColor={copy ? colors.line : colors.partner}
                  thumbTintColor="#FFFFFF"
                />
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function Person({ person, label, kcal, ring, soft, colors }: { person: SplitPerson; label: string; kcal: number; ring: string; soft: string; colors: PassColors }) {
  return (
    <View style={styles.person} accessible accessibilityLabel={`${person.label}, ${label}, ${kcal} kcal`}>
      <PassAvatar avatarKey={person.avatarKey} name={person.label} gender={person.gender} size={56} ring={ring} soft={soft} />
      <Text style={[styles.personShare, { color: ring }]}>{label}</Text>
      <Text selectable style={[styles.kcal, { color: colors.muted }]}>{kcal.toLocaleString()} kcal</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, borderCurve: 'continuous', padding: 16, gap: 16 },
  people: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  person: { width: 76, alignItems: 'center', gap: 4 },
  personShare: { fontSize: 22, fontWeight: '800', letterSpacing: -0.6, fontVariant: ['tabular-nums'], marginTop: 4 },
  kcal: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  between: { flex: 1, height: 56, justifyContent: 'center' },
  slider: { width: '100%', height: 44 },
  staticTrack: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', gap: 2, alignItems: 'center', justifyContent: 'center' },
  trackPart: { height: 6, borderRadius: 3 },
  copyPlates: { flexDirection: 'row', gap: 6, justifyContent: 'center' },
  copyPlate: { width: 22, height: 22, borderRadius: 11, borderWidth: 2.5 },
  adjust: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  adjustText: { fontSize: 13, fontWeight: '700' },
  foods: { gap: 12, marginTop: -4 },
  food: { borderTopWidth: 1, paddingTop: 12, gap: 4 },
  foodTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  foodName: { flex: 1, fontSize: 14, fontWeight: '500' },
  foodKcal: { fontSize: 12, fontVariant: ['tabular-nums'] },
  foodSlider: { width: '100%', height: 40 },
});
