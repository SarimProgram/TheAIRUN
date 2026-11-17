import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Flame } from 'lucide-react-native';

export default function GoalStreakBadge({ count, name, compact = false }: { count: number; name?: string; compact?: boolean }) {
  if (count < 1) return null;
  return <View style={[styles.badge, compact && styles.compact]} accessible accessibilityLabel={`${name ? `${name}, ` : ''}${count}-day streak`}>
    <Flame size={13} color="#F97316" fill="#FDBA74" />
    <Text style={styles.text} numberOfLines={1}>{!compact && name ? `${name} · ` : ''}{count}-day{!compact ? ' streak' : ''}</Text>
  </View>;
}

const styles = StyleSheet.create({
  compact: { alignSelf: 'center', flexShrink: 0 },
  badge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: '#FFF1E6' },
  text: { fontSize: 11, fontWeight: '600', color: '#9A3412' },
});
