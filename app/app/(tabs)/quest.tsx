import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Award, Zap, Activity, CheckCircle2, Heart, Sparkles } from 'lucide-react-native';

import { useAuth } from '@/src/auth/authContext';
import { usePoints } from '@/hooks/usePoints';
import { API_BASE_URL } from '@/config/api';
import { getMappedDays } from '@/utils/planProjection';
import { loadRuns } from '@/lib/run-storage';

const REDEEMED_WEEK_PREFIX = 'weekly_quest_redeemed_v1';
const COLORS = {
  bg: '#FFFFFF',
  text: '#1F1728',
  textMuted: '#8E8694',
  card: '#FFFFFF',
  border: 'rgba(0,0,0,0.05)',
  pink: '#FF4785',
  green: '#2DBE8D',
};

type QuestStatus = 'locked' | 'available' | 'redeemed' | 'completed';

type WeeklyQuestState = {
  id: string;
  type: 'weekly' | 'daily' | 'milestone';
  title: string;
  subtitle: string;
  requiredValue: number;
  currentValue: number;
  pointsReward: number;
  status: QuestStatus;
  canRedeem: boolean;
  icon: React.ReactNode;
  color: string;
};

function getStartOfWeek(date: Date) {
  const result = new Date(date);
  const day = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - day);
  result.setHours(0, 0, 0, 0);
  return result;
}

function formatWeekLabel(date: Date) {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function buildWeeklyQuest(longestPlannedKm: number, redeemed: boolean, completedQuestRun: boolean): WeeklyQuestState {
  const weekStart = getStartOfWeek(new Date());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  const weekKey = weekStart.toISOString().slice(0, 10);
  const requiredKm = longestPlannedKm > 0 ? Number((longestPlannedKm * 2).toFixed(1)) : 0;

  return {
    id: weekKey,
    type: 'weekly',
    title: `Run ${requiredKm}km this week`,
    subtitle: `${formatWeekLabel(weekStart)} - ${formatWeekLabel(weekEnd)}`,
    requiredValue: requiredKm,
    currentValue: completedQuestRun ? requiredKm : 0,
    pointsReward: 100,
    status: redeemed ? 'redeemed' : 'available',
    canRedeem: completedQuestRun && !redeemed,
    icon: <Zap size={20} color="#FFFFFF" fill="#FFFFFF" />,
    color: COLORS.pink,
  };
}

export default function QuestScreen() {
  const router = useRouter();
  const { accessToken, authFetch } = useAuth();
  const { earn, refetch: refetchPoints } = usePoints({ accessToken });
  const [weeklyQuest, setWeeklyQuest] = useState<WeeklyQuestState | null>(null);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(false);

  const loadQuest = useCallback(async () => {
    try {
      setLoading(true);
      const weekStart = getStartOfWeek(new Date());
      const redeemedKey = `${REDEEMED_WEEK_PREFIX}:${weekStart.toISOString().slice(0, 10)}`;
      const [weekRes, weeklyPlanRes, redeemedRaw, runs] = await Promise.all([
        authFetch(`${API_BASE_URL}/summary/week`),
        authFetch(`${API_BASE_URL}/plan/weekly`),
        AsyncStorage.getItem(redeemedKey),
        loadRuns(),
      ]);

      let currentWeek = 1;
      if (weekRes.ok) {
        const weekData = await weekRes.json();
        if (typeof weekData?.currentWeek === 'number' && Number.isFinite(weekData.currentWeek)) {
          currentWeek = weekData.currentWeek;
        }
      }

      let longestPlannedKm = 0;
      if (weeklyPlanRes.ok) {
        const planData = await weeklyPlanRes.json();
        const weeklyPlan = Array.isArray(planData?.['Weekly Plan Table']) ? planData['Weekly Plan Table'] : [];
        const currentWeekPlan = weeklyPlan.find((week: any) => week?.Week === currentWeek);
        const projectedDays = currentWeekPlan ? getMappedDays(currentWeekPlan) : [];
        longestPlannedKm = projectedDays.reduce((max: number, day: any) => {
          if (day?.type !== 'RUN') return max;
          const targetKm = typeof day?.targetKm === 'number' ? day.targetKm : 0;
          return Math.max(max, targetKm);
        }, 0);
      }

      const requiredKm = longestPlannedKm > 0 ? Number((longestPlannedKm * 2).toFixed(1)) : 0;
      const completedQuestRun = runs.some((run) => {
        const startedAt = new Date(run.startedAt).getTime();
        const inCurrentWeek = startedAt >= weekStart.getTime();
        const runKm = (run.totalDistanceMeters || 0) / 1000;
        return inCurrentWeek && runKm >= requiredKm;
      });

      setWeeklyQuest(buildWeeklyQuest(longestPlannedKm, redeemedRaw === 'true', completedQuestRun));
    } catch (error) {
      console.error('Failed to load weekly quest', error);
      setWeeklyQuest(null);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useFocusEffect(
    useCallback(() => {
      loadQuest();
    }, [loadQuest])
  );

  const handleRedeem = useCallback(async (quest: WeeklyQuestState) => {
    if (quest.status !== 'available' || !quest.canRedeem || redeeming) return;

    const redeemedKey = `${REDEEMED_WEEK_PREFIX}:${quest.id}`;

    try {
      setRedeeming(true);
      const earned = await earn(quest.pointsReward, `Weekly quest ${quest.subtitle}`);
      if (!earned) {
        Alert.alert('Quest not redeemed', 'Could not award points right now.');
        return;
      }

      await AsyncStorage.setItem(redeemedKey, 'true');
      await refetchPoints();
      setWeeklyQuest((current) => (current ? { ...current, status: 'redeemed' } : current));
      Alert.alert('Quest redeemed', `You earned ${quest.pointsReward} points.`);
    } catch (error) {
      console.error('Failed to redeem quest', error);
      Alert.alert('Quest not redeemed', 'Something went wrong while redeeming.');
    } finally {
      setRedeeming(false);
    }
  }, [earn, redeeming, refetchPoints]);

  const allQuests = useMemo(() => {
    return weeklyQuest && weeklyQuest.requiredValue > 0 ? [weeklyQuest] : [];
  }, [weeklyQuest]);

  const handleRunNow = useCallback(() => {
    const questDistanceKm =
      weeklyQuest && weeklyQuest.requiredValue > 0
        ? String(weeklyQuest.requiredValue)
        : '7.2';

    router.push({
      pathname: '/runs/runscreen',
      params: {
        distanceKm: questDistanceKm,
        weekContext: 'Quest Run',
      },
    });
  }, [router, weeklyQuest]);

  return (
    <View style={styles.screen}>
      <LinearGradient colors={['#F8FBFF', '#FFFFFF', '#F2FFF9']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={22} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Challenges</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.heroContainer}>
            <View style={styles.heroTextLayer}>
              <Text style={styles.heroBackgroundText}>QUEST</Text>
            </View>

            <View style={styles.characterContainer}>
              <Image
                source={require('../../assets/quest.png')}
                style={[styles.charImage, styles.charLeft]}
                resizeMode="contain"
              />
              <Image
                source={require('../../assets/Gree.png')}
                style={[styles.charImage, styles.charRight]}
                resizeMode="contain"
              />
            </View>
          </View>

          <View style={styles.listContainer}>
            <View style={styles.listHeader}>
              <Text style={styles.listTitle}>Your Quests</Text>
              <Text style={styles.listSubtitle}>Complete tasks to earn rewards</Text>
            </View>

            {allQuests.map((q) => (
              <QuestItem
                key={q.id}
                quest={q}
                onRedeem={() => handleRedeem(q)}
                onRunNow={q.type === 'weekly' ? handleRunNow : undefined}
                loading={loading}
                redeeming={redeeming}
              />
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function QuestItem({
  quest,
  onRedeem,
  onRunNow,
  loading,
  redeeming
}: {
  quest: WeeklyQuestState;
  onRedeem: () => void;
  onRunNow?: () => void;
  loading: boolean;
  redeeming: boolean;
}) {
  const progress = Math.min(quest.currentValue / quest.requiredValue, 1);
  const isAvailable = quest.status === 'available';
  const isRedeemed = quest.status === 'redeemed';
  const canClaim = isAvailable && quest.canRedeem;

  return (
    <View style={styles.questItem}>
      <View style={styles.questTop}>
        <View style={[styles.iconContainer, { backgroundColor: quest.color }]}>
          {quest.icon}
        </View>
        <View style={styles.questInfo}>
          <Text style={styles.questItemTitle}>{quest.title}</Text>
          <Text style={styles.questItemSubtitle}>{quest.subtitle}</Text>
        </View>
        <View style={styles.rewardTag}>
          <Heart size={12} color={COLORS.pink} fill={COLORS.pink} />
          <Text style={styles.rewardAmount}>{quest.pointsReward}</Text>
          <Text style={styles.rewardUnit}>pts</Text>
        </View>
      </View>

      <View style={styles.progressSection}>
        <View style={styles.progressLabels}>
          <Text style={styles.progressText}>
            {quest.currentValue} / {quest.requiredValue} {quest.type === 'weekly' ? 'km' : quest.type === 'daily' ? 'days' : 'km'}
          </Text>
          <Text style={styles.percentageText}>{Math.round(progress * 100)}%</Text>
        </View>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progress * 100}%`, backgroundColor: quest.color }]} />
        </View>
      </View>

      {isAvailable ? (
        <View style={styles.actionRow}>
          {onRunNow ? (
            <TouchableOpacity style={styles.runNowButton} onPress={onRunNow}>
              <Text style={styles.runNowButtonText}>Run now</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: canClaim ? quest.color : '#D8D5DB' }]}
            onPress={onRedeem}
            disabled={redeeming || !canClaim}
          >
            <Text style={styles.actionButtonText}>
              {redeeming ? 'Redeeming...' : canClaim ? 'Claim Reward' : 'Complete run to earn'}
            </Text>
           
          </TouchableOpacity>
        </View>
      ) : isRedeemed ? (
        <View style={[styles.actionButton, styles.buttonRedeemed]}>
          <CheckCircle2 size={18} color={COLORS.green} />
          <Text style={styles.actionButtonTextRedeemed}>Already Claimed</Text>
        </View>
      ) : (
        <View style={styles.lockNotice}>
          <Text style={styles.lockNoticeText}>Keep going to unlock</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  heroContainer: {
    height: 240,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 0,
  },
  heroTextLayer: {
    position: 'absolute',
    top: 40,
    width: '100%',
    alignItems: 'center',
  },
  heroBackgroundText: {
    fontSize: 110,
    fontWeight: '900',
    color: 'rgba(0,0,0,0.03)',
    letterSpacing: -6,
  },
  characterContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    height: 200,
    marginTop: -30,
  },
  charImage: {
    width: 160,
    height: 180,
    bottom: -10,
  },
  charLeft: {
    marginBottom: -10,
    marginRight: -45,
    zIndex: 5,
    transform: [{ scale: 1.12 }],
  },
  charRight: {
    marginLeft: -45,
    zIndex: 1,
  },
  listContainer: {
    paddingHorizontal: 24,
    marginTop: 10,
  },
  listHeader: {
    marginBottom: 20,
  },
  listTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  listSubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  questItem: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 15,
    elevation: 2,
  },
  questTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  questInfo: {
    flex: 1,
    marginLeft: 14,
  },
  questItemTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  questItemSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  rewardTag: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  rewardAmount: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.text,
  },
  rewardUnit: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
  },
  progressSection: {
    marginBottom: 20,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  percentageText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#F1F3F5',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 16,
    gap: 8,
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  runNowButton: {
    height: 48,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E7E5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  runNowButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  buttonRedeemed: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  actionButtonTextRedeemed: {
    color: COLORS.green,
    fontSize: 14,
    fontWeight: '700',
  },
  lockNotice: {
    alignItems: 'center',
  },
  lockNoticeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
