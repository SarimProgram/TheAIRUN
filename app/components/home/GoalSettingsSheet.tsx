import React from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArrowDown, ArrowUp, Check, Trash2, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { HOME_GOAL_LABELS, type HomeGoal, type useHomeGoals } from '@/hooks/useHomeGoals';

type Props = { visible: boolean; onClose: () => void; goals: ReturnType<typeof useHomeGoals>; partnerName: string };

export default function GoalSettingsSheet({ visible, onClose, goals, partnerName }: Props) {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const color = dark ? '#F1F5F9' : '#182033';
  const muted = dark ? '#CBD5E1' : '#64748B';
  const surface = dark ? '#1E293B' : '#F8FAFC';
  const disabled = goals.busy || !goals.ready;
  const move = (goal: HomeGoal, delta: number) => {
    const next = [...goals.order];
    const from = next.indexOf(goal);
    const to = next.indexOf(goals.visible[goals.visible.indexOf(goal) + delta]);
    if (to < 0) return;
    [next[from], next[to]] = [next[to], next[from]];
    void goals.reorder(next);
  };
  const requestRemoval = (goal: HomeGoal) => Alert.alert(
    `Remove ${HOME_GOAL_LABELS[goal].toLowerCase()} this week?`,
    `${partnerName} must accept first. Once accepted, this goal is removed from both of your weekly challenges. It returns next week.`,
    [{ text: 'Cancel', style: 'cancel' }, { text: 'Ask partner', onPress: () => { void goals.requestRemoval(goal); } }],
  );
  const incoming = goals.removals.filter(row => !row.accepted && !row.requestedByYou);
  return <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
    <View style={styles.overlay}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close goal settings" onPress={onClose} style={StyleSheet.absoluteFill} />
      <View accessibilityViewIsModal style={[styles.sheet, { backgroundColor: dark ? '#0F172A' : '#FFFFFF', paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={[styles.title, { color }]}>Goal settings</Text>
          {goals.busy && <ActivityIndicator color="#FF6B6B" accessibilityLabel="Saving goals" />}
          <Pressable accessibilityRole="button" accessibilityLabel="Close goal settings" onPress={onClose} style={styles.iconButton}><X size={22} color={muted} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={[styles.subtitle, { color: muted }]}>This week’s challenge</Text>
          <Text style={[styles.body, { color: muted }]}>Rearrange your goals below. Removing a goal needs your partner’s approval.</Text>
          {goals.error ? <View accessibilityLiveRegion="polite" style={styles.error}>
            <Text style={[styles.body, { color }]}>{goals.error}</Text>
            <Pressable accessibilityRole="button" onPress={() => { void goals.refresh(); }} style={styles.action}><Text style={styles.actionText}>Retry</Text></Pressable>
          </View> : !goals.ready && <ActivityIndicator color="#FF6B6B" accessibilityLabel="Loading goal settings" />}
          {incoming.map(row => <View key={row.id} style={[styles.card, { backgroundColor: surface }]}>
            <Text style={[styles.label, { color }]}>{partnerName} wants to remove {HOME_GOAL_LABELS[row.goal].toLowerCase()}</Text>
            <Text style={[styles.body, { color: muted }]}>Accept to remove it for both of you this week.</Text>
            <View style={styles.responseActions}>
              <Pressable accessibilityRole="button" disabled={disabled} onPress={() => { void goals.respond(row, false); }} style={[styles.action, disabled && styles.disabled]}><Text style={[styles.actionText, { color: muted }]}>Keep goal</Text></Pressable>
              <Pressable accessibilityRole="button" disabled={disabled} onPress={() => { void goals.respond(row, true); }} style={[styles.action, disabled && styles.disabled]}><Text style={styles.actionText}>Accept removal</Text></Pressable>
            </View>
          </View>)}
          <Text style={[styles.label, { color }]}>Rearrange goals</Text>
          <Text style={[styles.body, { color: muted }]}>Use the arrows to change the order on your home screen.</Text>
          {goals.visible.map((goal, index) => {
            const pending = goals.removals.find(row => row.goal === goal && !row.accepted);
            return <View key={goal} style={[styles.card, { backgroundColor: surface }]}>
              <View style={styles.row}>
                <Text style={[styles.label, styles.goalName, { color }]}>{HOME_GOAL_LABELS[goal]}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel={`Move ${HOME_GOAL_LABELS[goal].toLowerCase()} up`} disabled={disabled || index === 0} onPress={() => move(goal, -1)} style={[styles.iconButton, (disabled || index === 0) && styles.disabled]}><ArrowUp size={20} color={color} /></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`Move ${HOME_GOAL_LABELS[goal].toLowerCase()} down`} disabled={disabled || index === goals.visible.length - 1} onPress={() => move(goal, 1)} style={[styles.iconButton, (disabled || index === goals.visible.length - 1) && styles.disabled]}><ArrowDown size={20} color={color} /></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`Request removal of ${HOME_GOAL_LABELS[goal].toLowerCase()}`} disabled={disabled || !!pending || !goals.hasPartner} onPress={() => requestRemoval(goal)} style={[styles.iconButton, (disabled || !!pending || !goals.hasPartner) && styles.disabled]}><Trash2 size={19} color={muted} /></Pressable>
              </View>
              {pending && <Text accessibilityLiveRegion="polite" style={[styles.body, { color: muted }]}>{pending.requestedByYou ? `Waiting for ${partnerName}’s approval` : 'Waiting for your decision above'}</Text>}
            </View>;
          })}
          {!goals.hasPartner && goals.ready && <Text style={[styles.body, { color: muted }]}>Connect a partner to request a goal removal.</Text>}
          {goals.removals.some(row => row.accepted) && <>
            <Text style={[styles.label, { color }]}>Removed for this week</Text>
            {goals.removals.filter(row => row.accepted).map(row => <View key={row.id} style={[styles.removed, { backgroundColor: surface }]}><Check size={18} color={muted} /><Text style={[styles.body, { color: muted }]}>{HOME_GOAL_LABELS[row.goal]} · Both agreed</Text></View>)}
            <Text style={[styles.body, { color: muted }]}>These goals return automatically next week.</Text>
          </>}
        </ScrollView>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '90%', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderCurve: 'continuous', paddingTop: 12 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 12 },
  title: { fontSize: 22, fontWeight: '700', flex: 1 },
  subtitle: { fontSize: 17, fontWeight: '600' },
  content: { padding: 20, gap: 12 },
  body: { fontSize: 14, lineHeight: 21 },
  label: { fontSize: 16, fontWeight: '600' },
  goalName: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  card: { padding: 12, borderRadius: 16, borderCurve: 'continuous', gap: 8 },
  iconButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  responseActions: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 12 },
  action: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  actionText: { fontSize: 15, fontWeight: '600', color: '#D64545' },
  disabled: { opacity: 0.3 },
  error: { borderWidth: 1, borderColor: '#FF6B6B', padding: 12, borderRadius: 16, borderCurve: 'continuous' },
  removed: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 16, borderCurve: 'continuous' },
});
