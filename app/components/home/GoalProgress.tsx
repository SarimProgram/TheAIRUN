import { useColorScheme } from '@/hooks/use-color-scheme';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { goalProgressState } from './goalProgressState';

export default function GoalProgress({ current, target, unit, calorie = false }: {
  current?: number | null;
  target?: number | null;
  unit: string;
  calorie?: boolean;
}) {
  const dark = useColorScheme() === 'dark';
  const { value, goal, ratio, complete, overTarget } = goalProgressState(current, target, calorie);
  const metrics = `${value == null ? '—' : Math.round(value).toLocaleString()} / ${goal == null ? '—' : Math.round(goal).toLocaleString()} ${unit}`;
  const percentage = `${ratio == null ? '—' : Math.round(ratio * 100)}%`;
  const label = `${metrics}, ${overTarget ? 'Over target' : complete ? 'Complete' : percentage}`;
  const accent = overTarget ? dark ? '#FCA5A5' : '#B91C1C' : complete ? dark ? '#5EEAD4' : '#15803D' : '#FF6B6B';

  return <View accessible accessibilityLabel={label} style={styles.container}>
    <View style={styles.metricsRow}>
      <Text style={[styles.text, { color: dark ? '#CBD5E1' : '#64748B' }]}>{metrics}{!complete && !overTarget ? ` - ${percentage}` : ''}</Text>
      {(complete || overTarget) && (overTarget ? <X accessible={false} size={15} strokeWidth={3} color={accent} /> : <Check accessible={false} size={15} strokeWidth={3} color={accent} />)}
    </View>
    <View style={[styles.track, { backgroundColor: dark ? '#39252C' : '#FFF1F2' }]}>
      <View style={[styles.fill, { width: `${Math.min(1, ratio ?? 0) * 100}%`, backgroundColor: accent }]} />
    </View>
  </View>;
}

const styles = StyleSheet.create({
  container: { minHeight: 44, justifyContent: 'flex-start', marginTop: -12, paddingTop: 4, gap: 6, alignSelf: 'stretch' },
  metricsRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  text: { fontSize: 12, lineHeight: 16, fontWeight: '600', fontVariant: ['tabular-nums'] },
  track: { height: 8, borderRadius: 999, borderCurve: 'continuous', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999, borderCurve: 'continuous', backgroundColor: '#FF6B6B' },
});
