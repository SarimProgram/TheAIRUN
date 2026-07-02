/* eslint-disable react/no-unescaped-entities */
import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { 
  Calendar, 
  MapPin, 
  Flame, 
  ChevronRight, 
  ArrowLeft,
  Clock,
  Zap,
  Activity,
  Trophy
} from 'lucide-react-native';
import { loadRuns } from '@/lib/run-storage';
import type { Run } from '@/types/run';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const THEME = {
  primary: '#FF6B6B',
  secondary: '#2EC4B6',
  accent: '#A29BFE',
  bg: '#F8F9FA',
  surface: '#FFFFFF',
  text: '#1A1A1A',
  textMuted: '#94A3B8',
  white: '#FFFFFF',
  border: 'rgba(0, 0, 0, 0.05)',
  shadow: 'rgba(255, 107, 107, 0.15)',
};

function formatDuration(totalSec: number): string {
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return hours > 0
    ? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    : `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatPace(secPerKm: number | null): string {
  if (!secPerKm) return '--:--';
  const mins = Math.floor(secPerKm / 60);
  const secs = Math.floor(secPerKm % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

const RunCard = ({ run, index }: { run: Run; index: number }) => {
  const distanceKm = (run.totalDistanceMeters / 1000).toFixed(2);
  const calories = Math.floor((run.totalDistanceMeters / 1000) * 60);
  
  return (
    <TouchableOpacity style={styles.runCard} activeOpacity={0.9}>
      <View style={styles.cardHeader}>
        <View style={styles.dateBadge}>
          <Text style={styles.dateLabel}>{formatDate(run.startedAt).toUpperCase()}</Text>
        </View>
        <ChevronRight size={18} color={THEME.textMuted} />
      </View>

      <View style={styles.cardMain}>
        <View style={styles.distanceBlock}>
          <Text style={styles.distanceValue}>{distanceKm}</Text>
          <Text style={styles.distanceLabel}>KILOMETERS</Text>
        </View>
        
        <View style={styles.cardDivider} />

        <View style={styles.statsColumn}>
          <View style={styles.statItem}>
            <Clock size={14} color={THEME.primary} />
            <Text style={styles.statText}>{formatDuration(run.durationSeconds)}</Text>
          </View>
          <View style={styles.statItem}>
            <Activity size={14} color={THEME.secondary} />
            <Text style={styles.statText}>{formatPace(run.avgPaceSecPerKm)} /km</Text>
          </View>
          <View style={styles.statItem}>
            <Flame size={14} color="#FFA502" />
            <Text style={styles.statText}>{calories} kcal</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default function RunHistoryScreen() {
  const router = useRouter();
  const [runs, setRuns] = useState<Run[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRuns = async () => {
    const savedRuns = await loadRuns();
    setRuns(savedRuns);
  };

  useEffect(() => {
    fetchRuns();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchRuns();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" />

      {/* Floating Back Button */}
      <TouchableOpacity 
        onPress={() => router.back()} 
        style={styles.floatingBack}
      >
        <ArrowLeft size={20} color={THEME.text} />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={THEME.primary} />
        }
      >
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Run History</Text>
          <Text style={styles.heroSubtitle}>Your persistent progress and logs</Text>
        </View>

        <View style={styles.overviewRow}>
          <View style={styles.summaryBox}>
            <View style={[styles.iconBox, { backgroundColor: 'rgba(255, 107, 107, 0.1)' }]}>
              <Zap size={20} color={THEME.primary} />
            </View>
            <Text style={styles.summaryValue}>{runs.length}</Text>
            <Text style={styles.summaryLabel}>TOTAL RUNS</Text>
          </View>

          <View style={styles.summaryBox}>
            <View style={[styles.iconBox, { backgroundColor: 'rgba(46, 196, 182, 0.1)' }]}>
              <Trophy size={20} color={THEME.secondary} />
            </View>
            <Text style={styles.summaryValue}>
              {runs.length === 0
                ? '0.0'
                : (runs.reduce((sum, r) => sum + (r.totalDistanceMeters || 0), 0) / 1000).toFixed(1)}
            </Text>
            <Text style={styles.summaryLabel}>KM LOGGED</Text>
          </View>
        </View>

        <View style={styles.listHeader}>
          <Text style={styles.listHeaderText}>ALL SESSIONS</Text>
          <View style={styles.headerLine} />
        </View>

        {runs.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyCircle}>
              <Activity size={48} color="rgba(0,0,0,0.05)" />
            </View>
            <Text style={styles.emptyTitle}>Empty Road</Text>
            <Text style={styles.emptySubtitle}>
              You haven't recorded any runs yet. Start your journey today!
            </Text>
          </View>
        ) : (
          <View style={styles.runsList}>
            {[...runs].reverse().map((run, index) => (
              <RunCard key={run.id || index} run={run} index={index} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.bg,
  },
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
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 110,
    paddingBottom: 60,
  },
  hero: {
    marginBottom: 32,
  },
  heroTitle: {
    fontSize: 34,
    fontWeight: '900',
    color: THEME.text,
    letterSpacing: -1,
  },
  heroSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.textMuted,
    marginTop: 4,
  },
  overviewRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 40,
  },
  summaryBox: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: THEME.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: '900',
    color: THEME.text,
    letterSpacing: -0.5,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.textMuted,
    letterSpacing: 1,
    marginTop: 2,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  listHeaderText: {
    fontSize: 12,
    fontWeight: '900',
    color: THEME.textMuted,
    letterSpacing: 2,
  },
  headerLine: {
    flex: 1,
    height: 1,
    backgroundColor: THEME.border,
  },
  runsList: {
    gap: 16,
  },
  runCard: {
    backgroundColor: '#FFF',
    borderRadius: 28,
    padding: 24,
    borderWidth: 1.5,
    borderColor: THEME.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  dateBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
  },
  dateLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: THEME.textMuted,
    letterSpacing: 0.5,
  },
  cardMain: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  distanceBlock: {
    flex: 1,
  },
  distanceValue: {
    fontSize: 42,
    fontWeight: '900',
    color: THEME.text,
    letterSpacing: -2,
  },
  distanceLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: THEME.primary,
    letterSpacing: 1,
    marginTop: -4,
  },
  cardDivider: {
    width: 1,
    height: 60,
    backgroundColor: THEME.border,
    marginHorizontal: 20,
  },
  statsColumn: {
    flex: 1,
    gap: 10,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statText: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.text,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 80,
    gap: 16,
  },
  emptyCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(0,0,0,0.02)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: THEME.text,
  },
  emptySubtitle: {
    fontSize: 15,
    color: THEME.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
});
