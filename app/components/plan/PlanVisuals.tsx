import React, { createContext, useContext } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Activity, type LucideIcon } from 'lucide-react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { normalizeGender } from '../../utils/genderMascot';

const PlanGenderContext = createContext<string | null | undefined>(undefined);
export const PlanGenderProvider = PlanGenderContext.Provider;

export function usePlanColors(gender?: string | null) {
  const inheritedGender = useContext(PlanGenderContext);
  const isFemale = normalizeGender(gender ?? inheritedGender) === 'female';
  const dark = useColorScheme() === 'dark';
  return { dark, isFemale, bg: dark ? '#17151B' : '#FFF8F9', card: dark ? '#242129' : '#FFFFFF',
    text: dark ? '#F8F5F7' : '#18202F', sub: dark ? '#B6B0BD' : '#7C8191',
    line: dark ? '#39343F' : '#F0EDF1', soft: dark ? '#3B262F' : '#FFF0F2',
    accent: '#FF6069', secondary: isFemale ? (dark ? '#FF9BA1' : '#B52E3A') : (dark ? '#6AD7D0' : '#099D9B'),
    secondarySoft: isFemale ? (dark ? '#3B262F' : '#FFF0F2') : (dark ? '#203939' : '#E4F8F7') };
}

/** Deliberately image-free until the illustration set is approved. */
export function ArtPlaceholder({ label, style, compact = false }: { label: string; style?: ViewStyle; compact?: boolean }) {
  const c = usePlanColors();
  return <View accessibilityLabel={`${label} illustration placeholder`} style={[ui.art, { backgroundColor: c.soft }, style]}>
    <View style={[ui.artHalo, { backgroundColor: c.secondarySoft }]} />
    <View style={{ zIndex: 1 }}><Activity size={compact ? 24 : 48} color={c.accent} strokeWidth={1.4} /></View>
    {!compact && <Text style={[ui.artLabel, { color: c.sub, zIndex: 1 }]}>{label}</Text>}
  </View>;
}

export function IconButton({ icon: Icon, label, onPress, disabled = false }: { icon: LucideIcon; label: string; onPress: () => void; disabled?: boolean }) {
  const c = usePlanColors();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [ui.iconButton, { backgroundColor: c.card, opacity: disabled ? 0.3 : pressed ? 0.6 : 1 }]}>
    <Icon size={24} color={c.text} />
  </Pressable>;
}

export const ui = StyleSheet.create({
  card: { borderRadius: 28, borderCurve: 'continuous', padding: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.8 },
  heading: { fontSize: 21, fontWeight: '800', letterSpacing: -0.4 },
  body: { fontSize: 15, lineHeight: 22 },
  meta: { fontSize: 13, fontVariant: ['tabular-nums'] },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  art: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: 24, borderCurve: 'continuous', gap: 12 },
  artHalo: { position: 'absolute', width: '70%', height: '70%', borderRadius: 120, transform: [{ rotate: '-25deg' }] },
  artLabel: { fontSize: 12, textAlign: 'center', paddingHorizontal: 12 },
  primary: { minHeight: 56, borderRadius: 28, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10, paddingHorizontal: 20 },
  primaryText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
});
