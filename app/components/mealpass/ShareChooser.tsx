import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, ZoomIn, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Check } from 'lucide-react-native';
import type { PartnerWords } from '@/lib/meal-pass';
import PassAvatar from './PassAvatar';
import { EASE_OUT, type PassColors } from './passTheme';
import type { PassChoice } from './useMealPassComposer';

type Person = { name: string; avatarKey?: string; gender?: string | null };
type Props = {
  choice: PassChoice;
  onChoose: (choice: PassChoice) => void;
  you: Person;
  partner: Person;
  words: PartnerWords;
  locked: boolean;
  colors: PassColors;
};

/** "Share with Sam" switch; turning it on reveals the two ways to share as side-by-side cards. */
export default function ShareChooser({ choice, onChoose, you, partner, words, locked, colors }: Props) {
  const reduced = useReducedMotion();
  const on = choice !== 'SOLO';
  const pick = (next: PassChoice) => {
    if (locked || next === choice) return;
    void Haptics.selectionAsync().catch(() => {});
    onChoose(next);
  };

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="switch" accessibilityState={{ checked: on, disabled: locked }}
        accessibilityLabel={`Share this meal with ${words.name}`}
        disabled={locked} onPress={() => pick(on ? 'SOLO' : 'SPLIT')}
        style={({ pressed }) => [styles.toggle, {
          backgroundColor: colors.card, borderColor: on ? colors.accentBorder : 'transparent', boxShadow: colors.cardShadow,
          transform: [{ scale: pressed && !reduced ? 0.98 : 1 }],
        }]}
      >
        <View style={styles.pair}>
          <PassAvatar avatarKey={you.avatarKey} name={you.name} gender={you.gender} size={40} ring={colors.you} soft={colors.youSoft} />
          <View style={[styles.pairBack, { borderColor: colors.card }]}>
            <PassAvatar avatarKey={partner.avatarKey} name={partner.name} gender={partner.gender} size={40} ring={colors.partner} soft={colors.partnerSoft} />
          </View>
        </View>
        <Text style={[styles.toggleTitle, { color: colors.ink }]} numberOfLines={1}>Share with {words.name}</Text>
        <Switch
          value={on} disabled={locked} onValueChange={(value) => pick(value ? 'SPLIT' : 'SOLO')}
          trackColor={{ false: colors.line, true: colors.accent }} thumbColor="#FFFFFF" ios_backgroundColor={colors.line}
          accessibilityElementsHidden importantForAccessibility="no"
        />
      </Pressable>

      {on && (
        <Animated.View entering={reduced ? FadeIn.duration(150) : FadeInDown.duration(280).easing(EASE_OUT)} exiting={FadeOut.duration(150)} style={styles.options} accessibilityRole="radiogroup">
          <OptionCard
            selected={choice === 'SPLIT'} locked={locked} onPress={() => pick('SPLIT')} colors={colors}
            title="Split" body="Divide this plate and choose who gets how much" art={<SplitArt colors={colors} />}
          />
          <OptionCard
            selected={choice === 'COPY'} locked={locked} onPress={() => pick('COPY')} colors={colors}
            title="Full plate" body={`${words.subject} gets an identical plate of ${words.possessive} own`} art={<CopyArt colors={colors} />}
          />
        </Animated.View>
      )}
    </View>
  );
}

function OptionCard({ selected, locked, onPress, colors, title, body, art }: {
  selected: boolean; locked: boolean; onPress: () => void; colors: PassColors; title: string; body: string; art: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  const press = useSharedValue(1);
  const motion = useAnimatedStyle(() => ({ transform: [{ scale: press.get() }] }));
  return (
    <Animated.View style={[styles.optionWrap, motion]}>
      <Pressable
        accessibilityRole="radio" accessibilityState={{ selected, disabled: locked && !selected }} accessibilityLabel={`${title}. ${body}`}
        disabled={locked} onPress={onPress}
        onPressIn={() => { if (!reduced) press.set(withTiming(0.97, { duration: 110, easing: EASE_OUT })); }}
        onPressOut={() => press.set(withTiming(1, { duration: 160, easing: EASE_OUT }))}
        style={[styles.option, {
          backgroundColor: selected ? colors.accentSoft : colors.card,
          borderColor: selected ? colors.accent : colors.line,
          boxShadow: selected ? 'none' : colors.cardShadow,
          opacity: locked && !selected ? 0.5 : 1,
        }]}
      >
        {selected && (
          <Animated.View entering={reduced ? FadeIn.duration(120) : ZoomIn.springify().damping(14)} style={[styles.check, { backgroundColor: colors.accent }]}>
            <Check size={13} color="#FFFFFF" strokeWidth={3.2} />
          </Animated.View>
        )}
        <View style={styles.art}>{art}</View>
        <Text style={[styles.optionTitle, { color: selected ? colors.accent : colors.ink }]} numberOfLines={1}>{title}</Text>
      </Pressable>
    </Animated.View>
  );
}

/** One plate cut in two: your teal half, their coral half. */
function SplitArt({ colors }: { colors: PassColors }) {
  return (
    <View style={[styles.splitPlate, { borderColor: colors.line }]}>
      <View style={[styles.half, { backgroundColor: colors.you, borderTopLeftRadius: 22, borderBottomLeftRadius: 22 }]} />
      <View style={[styles.half, { backgroundColor: colors.partner, borderTopRightRadius: 22, borderBottomRightRadius: 22 }]} />
    </View>
  );
}

/** Two matching plates, one for each of you. */
function CopyArt({ colors }: { colors: PassColors }) {
  return (
    <View style={styles.copyArt}>
      <View style={[styles.copyPlate, { borderColor: colors.you, backgroundColor: colors.youSoft }]} />
      <View style={[styles.copyPlate, styles.copyFront, { borderColor: colors.partner, backgroundColor: colors.partnerSoft }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  toggle: { minHeight: 72, borderRadius: 24, borderCurve: 'continuous', borderWidth: 1.5, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  pair: { flexDirection: 'row', width: 68 },
  pairBack: { marginLeft: -12, borderRadius: 22, borderWidth: 2 },
  toggleTitle: { flex: 1, fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  options: { flexDirection: 'row', gap: 12 },
  optionWrap: { flex: 1 },
  option: { minHeight: 112, borderRadius: 24, borderCurve: 'continuous', borderWidth: 1.5, padding: 16, gap: 8, alignItems: 'center', justifyContent: 'center' },
  check: { position: 'absolute', top: 12, right: 12, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  art: { height: 56, justifyContent: 'center' },
  optionTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  splitPlate: { width: 52, height: 52, borderRadius: 26, borderWidth: 3, flexDirection: 'row', gap: 3, padding: 3, backgroundColor: '#FFFFFF' },
  half: { flex: 1 },
  copyArt: { width: 76, height: 52 },
  copyPlate: { position: 'absolute', top: 4, left: 0, width: 44, height: 44, borderRadius: 22, borderWidth: 3 },
  copyFront: { left: 26, top: 6 },
});
