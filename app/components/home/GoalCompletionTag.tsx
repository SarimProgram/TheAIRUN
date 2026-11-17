import { useColorScheme } from '@/hooks/use-color-scheme';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Check, X } from 'lucide-react-native';

export default function GoalCompletionTag({ complete, label, plain = false }: { complete: boolean; label: string; plain?: boolean }) {
  const dark = useColorScheme() === 'dark';
  const Icon = complete ? Check : X;
  const color = complete ? '#15803D' : '#B91C1C';
  const status = complete ? 'Complete' : 'Incomplete';
  if (plain) return <Text numberOfLines={1} accessibilityLabel={`${label}: ${status}`} style={{ fontSize: 13, lineHeight: 18, minHeight: 44, marginTop: -12, paddingTop: 4, color: complete ? dark ? '#5EEAD4' : '#147D78' : dark ? '#94A3B8' : '#7B8494' }}>{status}</Text>;
  return <View accessible accessibilityLabel={`${label}: ${status}`} style={[styles.tag, { backgroundColor: complete ? '#DCFCE7' : '#FEF2F2' }]}>
    <Icon size={14} strokeWidth={3} color={color} />
    <Text style={[styles.text, { color }]}>{status}</Text>
  </View>;
}

const styles = StyleSheet.create({
  tag: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  text: { fontSize: 11, fontWeight: '600' },
});
