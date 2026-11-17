import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Utensils } from 'lucide-react-native';
import type { PassColors } from './passTheme';

type Props = { size: number; colors: PassColors; title?: string };

/** The plate's face when a meal was typed in rather than photographed: a soft well with a fork and knife. */
export default function DrawnPlate({ size, colors, title }: Props) {
  const showTitle = !!title && size >= 120;
  return (
    <View style={[styles.well, { borderRadius: size / 2, backgroundColor: colors.soft, borderColor: colors.line }]}>
      <Utensils size={Math.max(16, Math.round(size * (showTitle ? 0.2 : 0.34)))} color={colors.muted} strokeWidth={1.75} />
      {showTitle && <Text style={[styles.title, { color: colors.ink, maxWidth: size * 0.66 }]} numberOfLines={2}>{title}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  well: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 14, lineHeight: 18, fontWeight: '600', textAlign: 'center' },
});
