import { useColorScheme } from '@/hooks/use-color-scheme';
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, Minus, X } from 'lucide-react-native';

export default function StepGoalStatus({ steps, target, compact = false, plain = false, upcoming = false, today = false, dayLabel }: {
  steps?: number | null; target?: number | null; compact?: boolean; plain?: boolean; upcoming?: boolean; today?: boolean; dayLabel?: string;
}) {
  const dark = useColorScheme() === 'dark';
  const [open, setOpen] = useState(false);
  const current = steps != null && Number.isFinite(steps) ? Math.max(0, Math.floor(steps)) : 0;
  const goal = target != null && Number.isFinite(target) && target > 0 ? Math.ceil(target) : 10000;
  const unavailable = steps == null || !Number.isFinite(steps) || target == null || !Number.isFinite(target) || target <= 0;
  const neutral = upcoming || unavailable;
  const complete = !neutral && current >= goal;
  const label = upcoming ? 'Upcoming' : unavailable && (compact || plain) ? 'Unavailable'
    : complete ? plain ? 'Target reached' : 'Complete'
      : plain ? current === 0 ? 'Nothing logged'
        : current >= goal * 0.9 ? 'Near target'
          : `${current.toLocaleString()} / ${goal.toLocaleString()} steps`
        : 'Incomplete';
  const color = complete ? '#15803D' : neutral ? '#6B7280' : '#B91C1C';
  const Icon = neutral ? Minus : complete ? Check : X;
  const details = upcoming ? ['This day has not started yet.'] : unavailable ? ['Step count or personal target is unavailable for this day.'] : [
    complete ? 'Your personal step goal has been reached.' : 'Your personal step goal has not been reached yet.',
    `Steps taken: ${current.toLocaleString()} steps.`,
    `Personal goal: ${goal.toLocaleString()} steps.`,
    ...(!complete ? [`${(goal - current).toLocaleString()} more steps needed to complete your goal.`] : []),
  ];
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={`${dayLabel ? `${dayLabel}, ` : 'Personal step goal: '}${label}${today ? ', today' : ''}`} accessibilityHint="Shows your steps and personal goal" onPress={() => setOpen(true)} style={plain ? styles.plainTarget : compact ? styles.compactTarget : styles.trigger}>
        {plain ? <Text numberOfLines={1} style={[styles.plainText, { color: complete ? dark ? '#5EEAD4' : '#147D78' : dark ? '#94A3B8' : '#7B8494' }]}>{label}</Text> : (
        <View style={[styles.badge, compact && styles.circle, today && styles.today, { backgroundColor: complete ? '#DCFCE7' : neutral ? '#F3F4F6' : '#FEF2F2' }]}>
          <Icon size={compact ? 12 : 14} color={color} strokeWidth={3} />
          {!compact && <Text style={[styles.label, { color }]}>{label}</Text>}
        </View>)}
      </Pressable>
      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Dismiss step goal details">
          <Pressable style={styles.tooltip} onPress={event => event.stopPropagation()} accessibilityViewIsModal>
            <Text style={styles.title}>{dayLabel ? `${dayLabel} · ` : ''}{label}</Text>
            <View style={styles.details}>
              {details.map(detail => (
                <View key={detail} style={styles.row}>
                  <Text style={styles.message} accessible={false}>•</Text>
                  <Text style={[styles.message, styles.detail]}>{detail}</Text>
                </View>
              ))}
            </View>
            <Pressable onPress={() => setOpen(false)} accessibilityRole="button" style={styles.close}><Text style={styles.closeText}>Got it</Text></Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  plainTarget: { minHeight: 44, justifyContent: 'flex-start', alignSelf: 'flex-start', marginTop: -12, paddingTop: 4 },
  plainText: { fontSize: 13, lineHeight: 18 },
  compactTarget: { minHeight: 44, width: '100%', alignItems: 'center', justifyContent: 'center' },
  circle: { width: 20, height: 20, paddingHorizontal: 0, paddingVertical: 0, borderRadius: 10, justifyContent: 'center' },
  today: { borderWidth: 1, borderColor: '#6B7280' },
  trigger: { minHeight: 44, flexShrink: 0, justifyContent: 'center', alignSelf: 'flex-start' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  label: { fontSize: 11, fontWeight: '600' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  tooltip: { width: '100%', maxWidth: 320, padding: 20, borderRadius: 16, borderCurve: 'continuous', backgroundColor: '#FFFFFF' },
  title: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 8 },
  details: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  message: { fontSize: 14, lineHeight: 21, color: '#4B5563' },
  detail: { flex: 1 },
  close: { minHeight: 44, alignItems: 'flex-end', justifyContent: 'center', marginTop: 8 },
  closeText: { color: '#111827', fontWeight: '600' },
});
