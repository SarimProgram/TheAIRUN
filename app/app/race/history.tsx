import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { ChevronLeft, Clock3, Trophy, CalendarX2, Info, ArrowLeft } from 'lucide-react-native';
import { useAuth } from '@/src/auth/authContext';
import { API_BASE_URL } from '@/config/api';
import { LinearGradient } from 'expo-linear-gradient';

const THEME = {
  bg: '#FFFFFF',
  card: '#FFFFFF',
  text: '#2D3436',
  muted: '#8395A7',
  border: 'rgba(0,0,0,0.04)',
  primary: '#FF6B81',
  secondary: '#2EC4B6',
  accent: '#FF9F43',
  glass: 'rgba(255, 255, 255, 0.9)',
};

type RaceHistoryStats = {
  totalRaces: number;
  youWins: number;
  partnerWins: number;
  youName: string;
  partnerName: string;
};

type RaceHistoryRace = {
  id: string;
  finishedAt: string;
  distanceKm: number;
  durationMs: number;
  winnerUserId: string;
  winnerName: string;
  didYouWin: boolean;
  opponent: { id: string; displayName: string };
};

type ScheduledHistoryItem = {
  id: string;
  partnerName: string;
  scheduledTime: string;
  distanceKm: number;
  status: 'DECLINED' | 'EXPIRED';
  isSender: boolean;
};

type HistoryResponse = {
  stats: RaceHistoryStats;
  races: RaceHistoryRace[];
  scheduled: ScheduledHistoryItem[];
};

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatDuration = (ms: number) => {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

export default function RaceHistoryPage() {
  const router = useRouter();
  const { authFetch } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<HistoryResponse | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await authFetch(`${API_BASE_URL}/runtogether/history`);
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || 'Failed to load race history');
      }
      const json = (await resp.json()) as HistoryResponse;
      setData(json);
    } catch (e: any) {
      setError(e?.message || 'Failed to load race history');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Floating Back Button */}
      <TouchableOpacity 
        onPress={() => router.back()} 
        style={styles.floatingBack}
      >
        <ArrowLeft size={20} color={THEME.text} />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>Race History</Text>
          <Text style={styles.heroSubtitle}>Your performance journey</Text>
        </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={THEME.primary} />
              <Text style={styles.mutedText}>Loading history...</Text>
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={loadHistory}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.statsContainer}>
                <View
                  style={[styles.statCard, { backgroundColor: 'rgba(255, 107, 129, 0.08)' }]}
                >
                  <Text style={styles.statLabel}>{data?.stats.youName || 'YOU'}</Text>
                  <Text style={[styles.statValue, { color: THEME.primary }]}>{data?.stats.youWins ?? 0}</Text>
                  <Text style={styles.statSub}>WINS</Text>
                </View>

                <View
                  style={[styles.statCard, { backgroundColor: 'rgba(46, 196, 182, 0.08)' }]}
                >
                  <Text style={styles.statLabel}>{data?.stats.partnerName || 'PARTNER'}</Text>
                  <Text style={[styles.statValue, { color: THEME.secondary }]}>{data?.stats.partnerWins ?? 0}</Text>
                  <Text style={styles.statSub}>WINS</Text>
                </View>

                <View style={[styles.statCard, { backgroundColor: '#FFF' }]}>
                  <Text style={styles.statLabel}>TOTAL</Text>
                  <Text style={styles.statValue}>{data?.stats.totalRaces ?? 0}</Text>
                  <Text style={styles.statSub}>RACES</Text>
                </View>
              </View>

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Trophy size={16} color={THEME.primary} />
                  <Text style={styles.sectionTitle}>COMPLETED RACES</Text>
                </View>
                {(data?.races?.length ?? 0) === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No race results recorded yet.</Text>
                  </View>
                ) : (
                  data!.races.map((race) => (
                    <View key={race.id} style={styles.raceCard}>
                      <View style={styles.cardHeader}>
                        <View style={[styles.resultBadge, race.didYouWin ? styles.winBadge : styles.lossBadge]}>
                          <Text style={styles.resultBadgeText}>{race.didYouWin ? 'WIN' : 'LOSS'}</Text>
                        </View>
                        <Text style={styles.cardDate}>{formatDateTime(race.finishedAt)}</Text>
                      </View>
                      
                      <View style={styles.cardBody}>
                        <View style={styles.cardMainInfo}>
                          <Text style={styles.cardTitle}>{race.winnerName} won</Text>
                          <Text style={styles.cardOpponent}>vs {race.opponent?.displayName || 'Partner'}</Text>
                        </View>
                        <View style={styles.cardStatsRight}>
                          <Text style={styles.cardDistance}>{race.distanceKm.toFixed(2)}km</Text>
                          <Text style={styles.cardDuration}>{formatDuration(race.durationMs)}</Text>
                        </View>
                      </View>
                    </View>
                  ))
                )}
              </View>

              <View style={[styles.section, { marginBottom: 40 }]}>
                <View style={styles.sectionHeader}>
                  <CalendarX2 size={16} color={THEME.accent} />
                  <Text style={styles.sectionTitle}>SCHEDULE HISTORY</Text>
                </View>
                {(data?.scheduled?.length ?? 0) === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No expired or declined runs.</Text>
                  </View>
                ) : (
                  data!.scheduled.map((run) => (
                    <View key={run.id} style={[styles.raceCard, { opacity: 0.7 }]}>
                      <View style={styles.cardHeader}>
                        <View style={[styles.resultBadge, run.status === 'EXPIRED' ? styles.expiredBadge : styles.declinedBadge]}>
                          <Text style={styles.resultBadgeText}>{run.status}</Text>
                        </View>
                        <Text style={styles.cardDate}>{formatDateTime(run.scheduledTime)}</Text>
                      </View>
                      <View style={styles.cardBody}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cardTitle}>
                            {run.isSender ? `Scheduled with ${run.partnerName}` : `Invite from ${run.partnerName}`}
                          </Text>
                          <Text style={styles.cardDistance}>{run.distanceKm.toFixed(2)}km</Text>
                        </View>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </>
          )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  floatingBack: {
    position: 'absolute',
    top: 50,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  content: { paddingHorizontal: 20, paddingTop: 110, paddingBottom: 40 },
  heroSection: { marginBottom: 30 },
  heroTitle: { fontSize: 32, fontWeight: '900', color: THEME.text, letterSpacing: -1 },
  heroSubtitle: { fontSize: 14, color: THEME.muted, fontWeight: '600', marginTop: 4 },
  
  statsContainer: { flexDirection: 'row', gap: 12, marginBottom: 30 },
  statCard: {
    flex: 1,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: { fontSize: 9, color: THEME.muted, fontWeight: '900', letterSpacing: 1 },
  statValue: { fontSize: 24, color: THEME.text, fontWeight: '900', marginVertical: 4 },
  statSub: { fontSize: 9, color: THEME.muted, fontWeight: '900', letterSpacing: 1 },

  section: { marginBottom: 25 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 15 },
  sectionTitle: { fontSize: 11, fontWeight: '900', color: THEME.muted, letterSpacing: 2 },
  
  raceCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: THEME.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  resultBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  resultBadgeText: { fontSize: 10, fontWeight: '900', color: '#FFF' },
  winBadge: { backgroundColor: THEME.secondary },
  lossBadge: { backgroundColor: '#B2BEC3' },
  expiredBadge: { backgroundColor: THEME.accent },
  declinedBadge: { backgroundColor: '#FF7675' },
  cardDate: { fontSize: 11, fontWeight: '700', color: THEME.muted },

  cardBody: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardMainInfo: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: THEME.text },
  cardOpponent: { fontSize: 12, fontWeight: '600', color: THEME.muted, marginTop: 2 },
  
  cardStatsRight: { alignItems: 'flex-end' },
  cardDistance: { fontSize: 16, fontWeight: '900', color: THEME.text },
  cardDuration: { fontSize: 12, fontWeight: '700', color: THEME.primary, marginTop: 2 },

  emptyContainer: { backgroundColor: '#FFF', padding: 30, borderRadius: 20, alignItems: 'center', borderWidth: 1, borderColor: THEME.border },
  emptyText: { color: THEME.muted, fontWeight: '600', fontSize: 13 },
  
  center: { height: 200, alignItems: 'center', justifyContent: 'center', gap: 12 },
  mutedText: { color: THEME.muted, fontWeight: '600' },
  errorText: { color: '#B91C1C', textAlign: 'center', fontWeight: '600' },
  retryBtn: { backgroundColor: THEME.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  retryText: { color: '#FFF', fontWeight: '800' },
});
