import React, { useRef, useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Dimensions,
  SafeAreaView,
  Animated,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import {
  Target,
  TrendingUp,
  User,
  Activity,
  ChevronRight,
  AlertTriangle,
  Users,
  Calendar,
} from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/auth/authContext';
import { useGoalsData } from '../../hooks/useGoalsData';

const { width } = Dimensions.get('window');

const COLORS = {
  primary: '#FF6B6B',      // Vibrant Pink
  secondary: '#1F938A',    // Deep Teal
  accent: '#6366F1',       // Indigo for balance
  bg: '#F8FAFC',           // Off-white/Blueish grey
  card: '#FFFFFF',
  text: '#0F172A',
  textMuted: '#64748B',
  border: '#E2E8F0',
  success: '#10B981',
  warning: '#F59E0B',
  pinkLight: '#FFF1F2',
};

export default function GoalsScreen() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const { data, loading, error, refetch } = useGoalsData({ accessToken });

  const [activeTab, setActiveTab] = useState<'me' | 'partner'>('me');
  const barAnim = useRef(new Animated.Value(0)).current;

  const combinedLost = data?.weight.combinedLost ?? 0;
  const combinedGoal = data?.weight.goal ?? 0;
  const hasGainedWeight = combinedLost < 0;

  const weightProgress = combinedGoal > 0 && combinedLost > 0
    ? Math.min(100, (combinedLost / combinedGoal) * 100)
    : 0;

  useEffect(() => {
    Animated.spring(barAnim, {
      toValue: weightProgress,
      useNativeDriver: false,
      tension: 20,
      friction: 7,
    }).start();
  }, [weightProgress]);

  useFocusEffect(
    React.useCallback(() => {
      refetch();
    }, [refetch])
  );

  const formatWeight = (value: number) => `${Math.abs(value).toFixed(1)}kg`;

  const getMonthlyBarHeight = (km: number) => {
    const maxKm = 100;
    return `${Math.min(100, (km / maxKm) * 100)}%`;
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (error && !data) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }]}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 8 }}>Unable to load goals</Text>
        <Text style={{ fontSize: 13, color: COLORS.textMuted, textAlign: 'center' }}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={{ flex: 1 }}>

        {/* HEADER */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerSubtitle}>Your Journey</Text>
            <Text style={styles.headerTitle}>Goals</Text>
          </View>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/Partner')}>
            <Users size={24} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
        >
          {/* 1. TOGETHER GOAL (WEIGHT) - FEATURE CARD */}
          <View style={styles.mainCard}>
            <View style={styles.cardHeader}>
              <View style={styles.iconCircle}>
                <Users size={20} color={COLORS.primary} />
              </View>
              <View style={styles.targetBadge}>
                <Target size={14} color={COLORS.textMuted} />
                <Text style={styles.targetBadgeText}>
                  {data?.weight.goal ? `${data.weight.goal.toFixed(0)}KG GOAL` : 'NO GOAL'}
                </Text>
              </View>
            </View>

            <View style={styles.weightTextContainer}>
              <Text style={styles.cardLabel}>WEIGHT PROGRESS</Text>
              <Text style={styles.togetherLostText}>
                {hasGainedWeight ? 'Together gained ' : 'Together lost '}
                <Text style={{ color: hasGainedWeight ? COLORS.warning : COLORS.primary }}>
                  {formatWeight(combinedLost)}
                </Text>
              </Text>
            </View>

            {/* PROGRESS BAR */}
            <View style={styles.progressContainer}>
              <View style={styles.thickBarTrack}>
                <Animated.View
                  style={[styles.thickBarFill, {
                    width: barAnim.interpolate({
                      inputRange: [0, 100],
                      outputRange: ['0%', '100%']
                    })
                  }]}
                />
              </View>
              <Text style={styles.progressPercent}>{weightProgress.toFixed(0)}%</Text>
            </View>

            <View style={styles.weightSplitRow}>
              <View style={styles.userStat}>
                <Text style={styles.weightName}>YOU</Text>
                <Text style={[styles.weightValue, { color: (data?.weight.user.lost ?? 0) < 0 ? COLORS.warning : COLORS.primary }]}>
                  {(data?.weight.user.lost ?? 0) < 0 ? '+' : '-'}{formatWeight(data?.weight.user.lost ?? 0)}
                </Text>
              </View>
              <View style={styles.verticalDivider} />
              {data?.weight.partner && (
                <View style={styles.userStat}>
                  <Text style={styles.weightName}>{data.weight.partner.name.toUpperCase()}</Text>
                  <Text style={[styles.weightValue, { color: data.weight.partner.lost < 0 ? COLORS.warning : COLORS.secondary }]}>
                    {data.weight.partner.lost < 0 ? '+' : '-'}{formatWeight(data.weight.partner.lost)}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* 2. MONTHLY INSIGHTS */}
          <View style={[styles.mainCard, { marginTop: 20 }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconCircle, { backgroundColor: COLORS.accent + '15' }]}>
                <Calendar size={20} color={COLORS.accent} />
              </View>
              <Text style={styles.cardLabel}>LAST MONTH DISTANCE</Text>
            </View>

            <View style={styles.chartContainer}>
              <View style={styles.monthlyBlock}>
                <View style={styles.chartBarWrapper}>
                  <View style={styles.largeBarTrack}>
                    <View style={[styles.largeBarFill, {
                      height: getMonthlyBarHeight(data?.monthlyKm.user.km ?? 0) as any,
                      backgroundColor: COLORS.primary
                    }]} />
                  </View>
                  <User size={14} color={COLORS.textMuted} style={styles.barIcon} />
                </View>
                <Text style={styles.barKm}>{data?.monthlyKm.user.km.toFixed(1)}<Text style={styles.unitSmall}>km</Text></Text>
                <Text style={styles.barLabel}>You</Text>
              </View>

              {data?.monthlyKm.partner && (
                <View style={styles.monthlyBlock}>
                  <View style={styles.chartBarWrapper}>
                    <View style={styles.largeBarTrack}>
                      <View style={[styles.largeBarFill, {
                        height: getMonthlyBarHeight(data.monthlyKm.partner.km) as any,
                        backgroundColor: COLORS.secondary
                      }]} />
                    </View>
                    <TrendingUp size={14} color={COLORS.textMuted} style={styles.barIcon} />
                  </View>
                  <Text style={styles.barKm}>{data.monthlyKm.partner.km.toFixed(1)}<Text style={styles.unitSmall}>km</Text></Text>
                  <Text style={styles.barLabel}>{data.monthlyKm.partner.name}</Text>
                </View>
              )}
            </View>
          </View>

          {/* 3. ACTIVITY BREAKDOWN */}
          <View style={[styles.mainCard, { marginTop: 20, paddingBottom: 10 }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconCircle, { backgroundColor: COLORS.success + '15' }]}>
                <Activity size={20} color={COLORS.success} />
              </View>
              <Text style={styles.cardLabel}>ACTIVITY BREAKDOWN</Text>
            </View>

            {/* SEGMENTED TAB SELECTOR */}
            <View style={styles.segmentedControl}>
              <TouchableOpacity
                style={[styles.segmentButton, activeTab === 'me' && styles.segmentActive]}
                onPress={() => setActiveTab('me')}
              >
                <Text style={[styles.segmentText, activeTab === 'me' && styles.segmentTextActive]}>You</Text>
              </TouchableOpacity>
              {data?.activity.partner && (
                <TouchableOpacity
                  style={[styles.segmentButton, activeTab === 'partner' && styles.segmentActive]}
                  onPress={() => setActiveTab('partner')}
                >
                  <Text style={[styles.segmentText, activeTab === 'partner' && styles.segmentTextActive]}>
                    {data.activity.partner.name}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.statList}>
              <StatItem
                label="Today's Distance"
                value={activeTab === 'me' ? data?.activity.user.todayKm : data?.activity.partner?.todayKm}
                target={activeTab === 'me' ? data?.activity.user.todayTarget : data?.activity.partner?.todayTarget}
                color={activeTab === 'me' ? COLORS.primary : COLORS.secondary}
              />
              <View style={styles.statDivider} />
              <StatItem
                label="Weekly Total"
                value={activeTab === 'me' ? data?.activity.user.weeklyKm : data?.activity.partner?.weeklyKm}
                target={activeTab === 'me' ? data?.activity.user.weeklyTarget : data?.activity.partner?.weeklyTarget}
                color={activeTab === 'me' ? COLORS.primary : COLORS.secondary}
              />
            </View>
          </View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// Sub-component for Activity Stats
const StatItem = ({ label, value, target, color }: any) => (
  <View style={styles.statRow}>
    <View>
      <Text style={styles.statMainLabel}>{label}</Text>
      <View style={styles.statTargetContainer}>
        <Target size={12} color={COLORS.textMuted} />
        <Text style={styles.statTargetText}>Goal: {target?.toFixed(1)} km</Text>
      </View>
    </View>
    <View style={styles.statValueContainer}>
      <Text style={[styles.statValue, { color }]}>{value?.toFixed(1)}</Text>
      <Text style={styles.statUnit}>KM</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  /* Header */
  header: {
    paddingHorizontal: 24,
    paddingTop: 15,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  headerSubtitle: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
  headerTitle: { fontSize: 34, fontWeight: '800', color: COLORS.text, marginTop: -2 },
  iconButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.card, justifyContent: 'center', alignItems: 'center', ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 }, android: { elevation: 3 } }) },

  /* Card Styling */
  mainCard: {
    backgroundColor: COLORS.card,
    borderRadius: 28,
    padding: 20,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12 },
      android: { elevation: 4 }
    }),
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  iconCircle: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.pinkLight || '#FFF1F2', justifyContent: 'center', alignItems: 'center' },
  cardLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 1 },

  /* Weight Section */
  targetBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.bg, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  targetBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted },
  togetherLostText: { fontSize: 26, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
  weightTextContainer: { marginBottom: 15 },

  progressContainer: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 25 },
  thickBarTrack: { flex: 1, height: 14, backgroundColor: COLORS.bg, borderRadius: 7, overflow: 'hidden' },
  thickBarFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 7 },
  progressPercent: { fontSize: 14, fontWeight: '700', color: COLORS.text },

  weightSplitRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bg, borderRadius: 20, padding: 15 },
  userStat: { flex: 1, alignItems: 'center' },
  verticalDivider: { width: 1, height: 30, backgroundColor: COLORS.border },
  weightValue: { fontSize: 20, fontWeight: '800', marginTop: 2 },
  weightName: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted },

  /* Monthly Section */
  chartContainer: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 10 },
  monthlyBlock: { alignItems: 'center' },
  chartBarWrapper: { alignItems: 'center', marginBottom: 10 },
  largeBarTrack: { width: 50, height: 160, backgroundColor: COLORS.bg, borderRadius: 25, justifyContent: 'flex-end', overflow: 'hidden' },
  largeBarFill: { width: '100%', borderRadius: 25 },
  barIcon: { position: 'absolute', bottom: 10, opacity: 0.5 },
  barKm: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  barLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted, marginTop: 2 },
  unitSmall: { fontSize: 10, color: COLORS.textMuted },

  /* Activity Tabs */
  segmentedControl: { flexDirection: 'row', backgroundColor: COLORS.bg, padding: 4, borderRadius: 14, marginBottom: 20 },
  segmentButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  segmentActive: { backgroundColor: COLORS.card, ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 }, android: { elevation: 2 } }) },
  segmentText: { fontSize: 14, fontWeight: '600', color: COLORS.textMuted },
  segmentTextActive: { color: COLORS.text, fontWeight: '700' },

  /* Stat List */
  statList: { gap: 15 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statMainLabel: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  statTargetContainer: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  statTargetText: { fontSize: 12, color: COLORS.textMuted, fontWeight: '500' },
  statValueContainer: { alignItems: 'flex-end' },
  statValue: { fontSize: 24, fontWeight: '800' },
  statUnit: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, marginTop: -4 },
  statDivider: { height: 1, backgroundColor: COLORS.border, width: '100%' },
});
