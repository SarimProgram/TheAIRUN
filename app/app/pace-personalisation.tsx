import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import { RefreshCw, RotateCcw, Undo2 } from 'lucide-react-native';
import { API_BASE_URL } from '@/config/api';
import { usePaceProfile } from '@/hooks/usePaceProfile';
import { formatPace, getPaceStatusText, type PaceModeState, type PaceProfile } from '@/lib/pace-personalization';
import { useAuth } from '@/src/auth/authContext';

const COLORS = {
  accent: '#FF6B6B',
  background: '#F6F8FA',
  border: '#E7EBEF',
  muted: '#64748B',
  surface: '#FFFFFF',
  text: '#0F172A',
};

function PaceCard({ label, state }: { label: string; state: PaceModeState }) {
  const statusText = getPaceStatusText(state);
  return (
    <View style={styles.paceCard}>
      <Text style={styles.paceLabel}>{label}</Text>
      <Text selectable style={styles.paceValue}>{formatPace(state.baselinePaceSecPerKm)}</Text>
      {statusText ? <Text style={styles.paceStatus}>{statusText}</Text> : null}
    </View>
  );
}

export default function PacePersonalisationScreen() {
  const { authFetch } = useAuth();
  const { profile, setProfile, loading, error, refresh } = usePaceProfile(true);
  const [action, setAction] = useState<'toggle' | 'recalculate' | 'reset' | 'undo' | null>(null);

  const request = async (path: string, method: 'PATCH' | 'POST', body?: object) => {
    setAction(path.includes('recalculate') ? 'recalculate' : path.includes('reset') ? 'reset' : path.includes('undo') ? 'undo' : 'toggle');
    try {
      const response = await authFetch(`${API_BASE_URL}/profile/pace${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      });
      if (!response.ok) throw new Error('Pace could not be updated');
      const data = await response.json() as PaceProfile;
      setProfile(data);
    } catch (nextError) {
      Alert.alert('Update failed', nextError instanceof Error ? nextError.message : 'Try again.');
      await refresh();
    } finally {
      setAction(null);
    }
  };

  const confirmReset = () => {
    Alert.alert('Reset pace?', 'Recent pace learning will be cleared.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => void request('/reset', 'POST') },
    ]);
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      style={styles.screen}
    >
      <Stack.Screen options={{ title: 'Pace personalisation', headerBackTitle: 'Profile' }} />

      {loading && !profile ? <ActivityIndicator color={COLORS.accent} style={styles.loader} /> : null}
      {error && !profile ? (
        <TouchableOpacity style={styles.errorCard} onPress={() => void refresh()}>
          <Text style={styles.errorText}>Could not load pace</Text>
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      ) : null}

      {profile ? (
        <>
          <View style={styles.paceGrid}>
            <PaceCard label="RUNNING" state={profile.running} />
            <PaceCard label="WALKING" state={profile.walking} />
          </View>

          <View style={styles.settingsCard}>
            <View style={styles.switchRow}>
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>Automatic adjustments</Text>
                <Text style={styles.rowSubtitle}>Uses recent workouts</Text>
              </View>
              <Switch
                accessibilityLabel="Automatic pace adjustments"
                disabled={action === 'toggle'}
                onValueChange={(autoAdjust) => void request('', 'PATCH', { autoAdjust })}
                trackColor={{ false: '#CBD5E1', true: '#FFAAA9' }}
                thumbColor="#FFFFFF"
                value={profile.autoAdjust}
              />
            </View>
          </View>

          <View style={styles.actionsCard}>
            <TouchableOpacity
              disabled={action !== null}
              onPress={() => void request('/recalculate', 'POST')}
              style={styles.actionRow}
            >
              <RefreshCw color={COLORS.accent} size={19} />
              <Text style={styles.actionText}>Recalculate pace</Text>
              {action === 'recalculate' ? <ActivityIndicator color={COLORS.accent} size="small" /> : null}
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity
              disabled={action !== null || (!profile.running.previousBaselinePaceSecPerKm && !profile.walking.previousBaselinePaceSecPerKm)}
              onPress={() => void request('/undo', 'POST')}
              style={styles.actionRow}
            >
              <Undo2 color={COLORS.accent} size={19} />
              <Text style={styles.actionText}>Undo last change</Text>
              {action === 'undo' ? <ActivityIndicator color={COLORS.accent} size="small" /> : null}
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity disabled={action !== null} onPress={confirmReset} style={styles.actionRow}>
              <RotateCcw color="#DC2626" size={19} />
              <Text style={[styles.actionText, styles.resetText]}>Reset pace</Text>
              {action === 'reset' ? <ActivityIndicator color="#DC2626" size="small" /> : null}
            </TouchableOpacity>
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: COLORS.background },
  content: { gap: 16, padding: 16, paddingBottom: 40 },
  loader: { marginTop: 40 },
  paceGrid: { gap: 12 },
  paceCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
  },
  paceLabel: { color: COLORS.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  paceValue: {
    color: COLORS.text,
    fontSize: 28,
    fontVariant: ['tabular-nums'],
    fontWeight: '900',
    marginTop: 5,
  },
  paceStatus: { color: COLORS.muted, fontSize: 13, fontWeight: '600', marginTop: 4 },
  settingsCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  switchRow: { alignItems: 'center', flexDirection: 'row', minHeight: 72 },
  rowCopy: { flex: 1, paddingRight: 12 },
  rowTitle: { color: COLORS.text, fontSize: 16, fontWeight: '800' },
  rowSubtitle: { color: COLORS.muted, fontSize: 13, marginTop: 2 },
  actionsCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: 16,
  },
  actionRow: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 56 },
  actionText: { color: COLORS.text, flex: 1, fontSize: 15, fontWeight: '700' },
  resetText: { color: '#DC2626' },
  divider: { backgroundColor: COLORS.border, height: StyleSheet.hairlineWidth, marginLeft: 31 },
  errorCard: {
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderCurve: 'continuous',
    borderRadius: 16,
    gap: 4,
    padding: 20,
  },
  errorText: { color: '#991B1B', fontSize: 15, fontWeight: '800' },
  retryText: { color: '#DC2626', fontSize: 13, fontWeight: '700' },
});
