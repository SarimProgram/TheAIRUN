import { useColorScheme } from '@/hooks/use-color-scheme';
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, X, Minus } from 'lucide-react-native';
import { calorieGoalStatus } from './calorieGoalStatus';
import GoalProgress from './GoalProgress';

export default function CalorieStatus({ calories, target, compact = false, plain = false, showProgress = false, upcoming = false, today = false, dayLabel }: {
  calories?: number | null; target?: number | null; compact?: boolean; plain?: boolean; showProgress?: boolean; upcoming?: boolean; today?: boolean; dayLabel?: string;
}) {
  const dark = useColorScheme() === 'dark';
  const [open, setOpen] = useState(false);
  const status = calorieGoalStatus(calories, target);
  const current = calories != null && Number.isFinite(calories) ? Math.max(0, calories) : null;
  const goal = target != null && Number.isFinite(target) && target > 0 ? target : null;
  const percentage = current != null && goal != null ? `${Math.round(current / goal * 100)}%` : '—%';
  const progressLabel = `${current == null ? '—' : Math.round(current).toLocaleString()} / ${goal == null ? '—' : Math.round(goal).toLocaleString()} kcals, ${status.label === 'Over target' ? 'Over target' : status.complete ? 'Complete' : percentage}`;
  const neutral = upcoming || status.label === 'Unavailable';
  const complete = !neutral && status.complete;
  const badgeLabel = upcoming ? 'Upcoming' : complete ? 'Complete' : 'Incomplete';
  const label = !plain || upcoming ? badgeLabel
    : status.label === 'Unavailable' ? 'Unavailable'
      : status.label === 'Nothing logged' ? 'Nothing logged'
        : status.label === 'Over target' ? 'Over target'
          : complete ? calories === target ? 'Target reached' : 'Near target'
            : `${Math.round(calories ?? 0).toLocaleString()} kcals logged`;
  const details = upcoming
    ? ['This day has not started yet.']
    : status.label === 'Unavailable'
      ? [status.message]
      : [
          status.label === 'Nothing logged' ? 'Nothing logged.'
            : status.label === 'Over target' ? 'Your calorie intake is over the target.'
              : !complete ? 'Your calorie intake is below the completion range.'
                : 'Your calorie intake is within the completion range.',
          `Logged: ${Math.round(calories ?? 0).toLocaleString()} calories.`,
          ...(target != null && Number.isFinite(target) && target > 0
            ? [`Complete when intake is between ${Math.ceil(target * 0.7).toLocaleString()} and ${Math.floor(target).toLocaleString()} calories, inclusive.`]
            : ['Your calorie target is unavailable.']),
        ];
  const color = complete ? '#15803D' : neutral ? '#6B7280' : '#B91C1C';
  const Icon = neutral ? Minus : complete ? Check : X;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${dayLabel ? `${dayLabel}, ` : ''}${showProgress ? `${progressLabel}, ` : ''}${label}${today ? ', today' : ''}`}
        accessibilityHint="Shows calorie goal details"
        onPress={() => setOpen(true)}
        style={showProgress ? undefined : plain ? styles.plainTarget : compact ? styles.compactTarget : styles.badgeTarget}
      >
        {showProgress ? <GoalProgress current={calories} target={target} unit="kcals" calorie /> : plain ? <Text numberOfLines={1} style={[styles.plainText, { color: complete ? dark ? '#5EEAD4' : '#147D78' : dark ? '#94A3B8' : '#7B8494' }]}>{label}</Text> : (
        <View style={[styles.badge, compact && styles.circle, { backgroundColor: complete ? '#DCFCE7' : neutral ? '#F3F4F6' : '#FEF2F2' }, today && styles.today]}>
          <Icon size={compact ? 12 : 14} color={color} strokeWidth={3} />
          {!compact && <Text style={[styles.label, { color }]}>{badgeLabel}</Text>}
        </View>)}
      </Pressable>
      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Dismiss calorie details">
          <Pressable style={styles.tooltip} onPress={event => event.stopPropagation()} accessibilityViewIsModal>
            <Text style={styles.title}>{dayLabel ? `${dayLabel} · ` : ''}{badgeLabel}</Text>
            <View style={styles.details}>
              {details.map(detail => (
                <View key={detail} style={styles.bulletRow}>
                  <Text style={styles.message} accessible={false}>•</Text>
                  <Text style={[styles.message, styles.bulletText]}>{detail}</Text>
                </View>
              ))}
            </View>
            <Pressable onPress={() => setOpen(false)} accessibilityRole="button" style={styles.close}>
              <Text style={styles.closeText}>Got it</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  plainTarget: { minHeight: 44, justifyContent: 'flex-start', alignSelf: 'flex-start', marginTop: -12, paddingTop: 4 },
  plainText: { fontSize: 13, lineHeight: 18 },
  badgeTarget: { minHeight: 44, justifyContent: 'center' },
  compactTarget: { minHeight: 44, width: '100%', alignItems: 'center', justifyContent: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  circle: { width: 20, height: 20, paddingHorizontal: 0, paddingVertical: 0, borderRadius: 10, justifyContent: 'center' },
  today: { borderWidth: 1, borderColor: '#6B7280' },
  label: { fontSize: 11, fontWeight: '600' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  tooltip: { width: '100%', maxWidth: 320, padding: 20, borderRadius: 16, borderCurve: 'continuous', backgroundColor: '#FFFFFF' },
  title: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 8 },
  message: { fontSize: 14, lineHeight: 21, color: '#4B5563' },
  details: { gap: 8 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  bulletText: { flex: 1 },
  close: { minHeight: 44, alignItems: 'flex-end', justifyContent: 'center', marginTop: 8 },
  closeText: { color: '#111827', fontWeight: '600' },
});
