import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Flame, Utensils } from 'lucide-react-native';
import type { PassColors } from './passTheme';

/** A raised round card lit from above: a bevelled rim around a recessed well. Children sit centred in the well. */
export function DiscSurface({ size, colors, children }: { size: number; colors: PassColors; children?: React.ReactNode }) {
  const well = size * 0.84;
  return (
    <View style={[styles.disc, { width: size, height: size, borderRadius: size / 2 }]}>
      <LinearGradient colors={[colors.card, colors.soft]} start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]} />
      {/* Inset shadows paint under children, so the bevel lives on its own layer above the gradient. */}
      <View style={[StyleSheet.absoluteFill, { borderRadius: size / 2, boxShadow: `inset 0 2px 1px ${colors.bevelLight}, inset 0 -5px 10px ${colors.bevelShade}` }]} />
      <View style={[styles.well, { width: well, height: well, borderRadius: well / 2, boxShadow: `0 1px 0 ${colors.bevelLight}` }]}>
        <LinearGradient colors={[colors.soft, colors.card]} style={[StyleSheet.absoluteFill, { borderRadius: well / 2 }]} />
        <View style={[StyleSheet.absoluteFill, { borderRadius: well / 2, boxShadow: `inset 0 3px 8px ${colors.bevelShade}` }]} />
        {children}
      </View>
    </View>
  );
}

/** The food photo or cutout, lifted off the well; typed meals get a fork and knife. */
export function DiscFood({ size, imageUri, isCutout, colors }: { size: number; imageUri: string | null; isCutout: boolean; colors: PassColors }) {
  return (
    <View style={{ boxShadow: `0 6px 10px ${colors.bevelShade}`, borderRadius: size / 2 }}>
      {imageUri
        ? <Image source={{ uri: imageUri }} style={{ width: size, height: size, borderRadius: isCutout ? 0 : size / 2 }} resizeMode={isCutout ? 'contain' : 'cover'} />
        : <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}><Utensils size={size * 0.7} color={colors.accent} strokeWidth={2.2} /></View>}
    </View>
  );
}

/** Meal name and a calorie pill, scaled to the disc. */
export function DiscInfo({ size, title, kcal, colors }: { size: number; title?: string; kcal: number; colors: PassColors }) {
  const pill = Math.round(size * 0.12);
  return (
    <>
      <Text style={[styles.title, { color: colors.ink, fontSize: size * 0.078, lineHeight: size * 0.095, maxWidth: size * 0.7 }]} numberOfLines={1}>{title ?? 'Your meal'}</Text>
      <View style={[styles.pill, { height: pill, borderRadius: pill / 2, paddingHorizontal: pill * 0.42, gap: pill * 0.18, backgroundColor: colors.card, boxShadow: `0 2px 6px ${colors.bevelShade}, inset 0 1px 0 ${colors.bevelLight}` }]}>
        <Flame size={pill * 0.44} color={colors.fat} fill={colors.fat} strokeWidth={2} />
        <Text style={[styles.kcal, { color: colors.ink, fontSize: size * 0.053 }]}>{kcal.toLocaleString()} kcal</Text>
      </View>
    </>
  );
}

/** The plate as it travels between phones: same disc on the sender's throw and the partner's catch. */
export default function ThrowDisc({ size, imageUri, isCutout, title, kcal, colors }: {
  size: number; imageUri: string | null; isCutout: boolean; title?: string; kcal: number; colors: PassColors;
}) {
  return (
    <DiscSurface size={size} colors={colors}>
      <View style={[styles.stack, { gap: size * 0.04 }]}>
        <DiscFood size={Math.round(size * 0.28)} imageUri={imageUri} isCutout={isCutout} colors={colors} />
        <DiscInfo size={size} title={title} kcal={kcal} colors={colors} />
      </View>
    </DiscSurface>
  );
}

/** A plate's display name from its foods: "Chicken & rice", or the first two plus a count. */
export function plateTitle(names: string[]): string | undefined {
  if (!names.length) return undefined;
  if (names.length > 2) return `${names.slice(0, 2).join(', ')} + ${names.length - 2}`;
  return names.join(' & ');
}

const styles = StyleSheet.create({
  disc: { alignItems: 'center', justifyContent: 'center' },
  well: { alignItems: 'center', justifyContent: 'center' },
  stack: { alignItems: 'center' },
  title: { fontWeight: '800', letterSpacing: -0.4, textAlign: 'center', textTransform: 'capitalize' },
  pill: { flexDirection: 'row', alignItems: 'center' },
  kcal: { fontWeight: '700', fontVariant: ['tabular-nums'] },
});
