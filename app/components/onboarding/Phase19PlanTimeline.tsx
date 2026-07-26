import React, { useEffect, useRef, useMemo } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
  Platform,
  StatusBar,
  Animated,
} from 'react-native';
import { Bell, ChevronRight, Eye, Heart, ShoppingBag, Sparkles, Users } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';

const { width: windowWidth, height: windowHeight } = Dimensions.get('window');
const height = Math.min(windowHeight, 800);
const isAirLayout = windowWidth >= 700 || (Platform.OS === 'ios' && Platform.isPad);
const isCompactFrame = windowHeight <= 820;
const useCompactLayout = isAirLayout || isCompactFrame;

const COLORS = {
  brand: '#FF3B3B', // Vibrant high-energy red
  brandDark: '#D62F2F',
  ink: '#121212',
  white: '#FFFFFF',
  muted: '#94A3B8',
  soft: '#F8FAFC',
  border: '#F1F5F9',
  success: '#10B981',
};

type Props = {
  userName?: string;
  userGender?: string | null;
  partnerName?: string;
  weeklyPlan?: any[];
  currentWeight?: string | number;
  weightUnit?: string;
  mainGoal?: 'weightloss' | 'running' | 'both' | string | null;
  onBack: () => void;
  onContinue: () => void;
};

export default function Phase19PlanTimeline({
  userName = 'YOU',
  userGender,
  partnerName,
  weeklyPlan = [],
  currentWeight,
  weightUnit = 'kg',
  mainGoal,
  onBack,
  onContinue,
}: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 20, useNativeDriver: true }),
    ]).start();
  }, []);

  const roadmapCheckpoints = useMemo(() => {
    const safePlan = Array.isArray(weeklyPlan) ? weeklyPlan : [];
    const normalizedPlan = safePlan
      .map((item) => ({
        week: Number(item?.Week),
        weekName: item?.['Week name'],
        expectedWeight: typeof item?.['Expected weight'] === 'number' ? item['Expected weight'] : null,
        runKm: typeof item?.['Run km/week'] === 'number' ? item['Run km/week'] : 0,
        stepsTarget: typeof item?.['Steps/day target'] === 'number' ? item['Steps/day target'] : 0,
      }))
      .filter((item) => Number.isFinite(item.week) && item.week > 0)
      .sort((a, b) => a.week - b.week);

    const totalWeeks = Math.max(1, normalizedPlan[normalizedPlan.length - 1]?.week ?? normalizedPlan.length ?? 1);
    const currentWeightNum = typeof currentWeight === 'number' ? currentWeight : typeof currentWeight === 'string' ? Number(currentWeight) : NaN;
    const goalMode =
      mainGoal === 'both'
        ? 'combined'
        : mainGoal === 'running'
          ? 'running'
          : mainGoal === 'weightloss'
            ? 'weight'
            : normalizedPlan.some((item) => item.runKm > 0)
              ? 'running'
              : 'weight';

    const checkpointWeeks = Array.from(
      new Set([
        1,
        Math.max(1, Math.ceil(totalWeeks * 0.33)),
        Math.max(1, Math.ceil(totalWeeks * 0.66)),
        totalWeeks,
      ])
    );

    const getClosestWeek = (week: number) => {
      if (!normalizedPlan.length) return null;
      return normalizedPlan.reduce((closest, item) => {
        return Math.abs(item.week - week) < Math.abs(closest.week - week) ? item : closest;
      }, normalizedPlan[0]);
    };

    const checkpoints = checkpointWeeks.map((week, index) => {
      const weekData = getClosestWeek(week);
      const isStart = index === 0;
      const isFinal = index === checkpointWeeks.length - 1;
      const expectedWeight = weekData?.expectedWeight;
      const diff = expectedWeight != null && Number.isFinite(currentWeightNum)
        ? Number((currentWeightNum - expectedWeight).toFixed(1))
        : null;

      if (goalMode === 'combined') {
        const runValue = weekData?.runKm ? `${weekData.runKm.toFixed(1)} km/week` : 'steady weekly training';

        return {
          key: `checkpoint-${week}`,
          weekLabel: isStart ? 'Today' : `Week ${week}`,
          summary: isStart
            ? 'Your fat-loss run plan starts.'
            : isFinal
              ? `You finish leaner and stronger.`
              : index === 1
                ? diff && diff > 0
                  ? `You may be down about ${diff} ${weightUnit}.`
                  : 'You should feel lighter and steadier.'
                : `You build toward ${runValue}.`,
        };
      }

      if (goalMode === 'running') {
        const runValue = weekData?.runKm ? `${weekData.runKm.toFixed(1)} km/week` : 'your running routine';
        return {
          key: `checkpoint-${week}`,
          weekLabel: isStart ? 'Today' : `Week ${week}`,
          summary: isStart
            ? 'Your running plan starts now.'
            : isFinal
              ? 'You finish with a stronger running base.'
              : index === 1
                ? 'Runs should start feeling easier.'
                : `You build toward ${runValue}.`,
        };
      }

      return {
        key: `checkpoint-${week}`,
        weekLabel: isStart ? 'Today' : `Week ${week}`,
        summary: isStart
          ? 'Your fat-loss plan starts today.'
          : isFinal
            ? expectedWeight != null
              ? `Target is about ${expectedWeight} ${weightUnit}.`
              : 'You finish leaner and more consistent.'
            : index === 1
              ? diff && diff > 0
                ? `You may be down about ${diff} ${weightUnit}.`
                : 'You should start seeing progress.'
              : 'The routine should feel easier.',
      };
    });

    return checkpoints.slice(0, 4);
  }, [currentWeight, mainGoal, weightUnit, weeklyPlan]);

  const userAvatarSource = useMemo(() => {
    const normalizedGender = String(userGender || '').trim().toLowerCase();
    return normalizedGender === 'female'
      ? require('../../assets/pink.png')
      : require('../../assets/Gree.png');
  }, [userGender]);

  const partnerAvatarSource = useMemo(() => {
    const normalizedGender = String(userGender || '').trim().toLowerCase();
    return normalizedGender === 'female'
      ? require('../../assets/Gree.png')
      : require('../../assets/pink.png');
  }, [userGender]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* 1. Large High-Aesthetic Hero Container */}
      <LinearGradient colors={[COLORS.brand, COLORS.brandDark]} style={[styles.hero, useCompactLayout && styles.heroCompact]}>
        <Text style={styles.watermarkText}>TOGETHER</Text>
        <SafeAreaView style={styles.heroSafe}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <ChevronRight color={COLORS.white} size={28} style={{ transform: [{ rotate: '180deg' }] }} />
          </TouchableOpacity>

          <View style={styles.heroContent}>
            <View style={styles.avatarsWrapper}>
                <View style={styles.connectionLine} />
                
                <View style={styles.avatarIdGroup}>
                    <Image 
                        source={userAvatarSource}
                        style={styles.mainAvatar} 
                        contentFit="contain"
                    />
                    <Text style={styles.avatarNameLabel}>{userName}</Text>
                </View>

                <View style={styles.syncRing}>
                    <Heart size={20} color={COLORS.brand} fill={COLORS.brand} />
                </View>

                <View style={styles.avatarIdGroup}>
                    <Image 
                        source={partnerAvatarSource} 
                        style={styles.mainAvatar} 
                        contentFit="contain"
                    />
                    <Text style={[styles.avatarNameLabel, { opacity: partnerName ? 1 : 0.6 }]}>
                        {partnerName || 'AWAITING...'}
                    </Text>
                </View>
            </View>
            <View style={[styles.heroBadge, useCompactLayout && styles.heroBadgeCompact]}>
                <Text style={styles.heroBadgeText}>BUILT FOR TWO</Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* 2. Floating Info Card (The Split Section) */}
      <Animated.View style={[styles.overlapCard, useCompactLayout && styles.overlapCardCompact, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <ScrollView
          contentContainerStyle={styles.overlapScrollContent}
          showsVerticalScrollIndicator={false}
        >
        <View style={[styles.cardHeader, useCompactLayout && styles.cardHeaderCompact]}>
            <Text style={styles.cardHeaderTitle}>Your Plan, Better Together</Text>
        </View>

        <View style={[styles.splitRow, useCompactLayout && styles.splitRowCompact]}>
            {/* Left: My Blueprint */}
            <View style={styles.column}>
                <Text style={styles.columnLabel}>Your Plan</Text>
                <View style={[styles.blueprintBulletList, useCompactLayout && styles.blueprintBulletListCompact]}>
                    {roadmapCheckpoints.slice(0, useCompactLayout ? 3 : 4).map((item) => (
                        <View key={item.key} style={styles.blueprintBulletRow}>
                            <View style={styles.blueprintBulletDot} />
                            <View style={styles.blueprintBulletContent}>
                                <Text style={styles.blueprintBulletWeek}>{item.weekLabel}</Text>
                                <Text style={styles.blueprintBulletSummary}>{item.summary}</Text>
                            </View>
                        </View>
                    ))}
                </View>
            </View>

            <View style={styles.cardDivider} />

            {/* Right: Partner Sync */}
            <View style={[styles.column, styles.partnerColumn]}>
                <Text style={[styles.columnLabel, { color: COLORS.success }]}>WITH A PARTNER</Text>
                <View style={[styles.perksList, useCompactLayout && styles.perksListCompact]}>
                    <View style={styles.perk}>
                        <View style={styles.perkIconWrap}>
                          <Eye size={14} color={COLORS.brand} strokeWidth={2.2} />
                        </View>
                        <Text style={styles.perkText}>See each other’s progress</Text>
                    </View>
                    <View style={styles.perk}>
                        <View style={styles.perkIconWrap}>
                          <Users size={14} color={COLORS.brand} strokeWidth={2.2} />
                        </View>
                        <Text style={styles.perkText}>Stay accountable together</Text>
                    </View>
                    <View style={styles.perk}>
                        <View style={styles.perkIconWrap}>
                          <Bell size={14} color={COLORS.brand} strokeWidth={2.2} />
                        </View>
                        <Text style={styles.perkText}>Send reminders</Text>
                    </View>
                    <View style={styles.perk}>
                        <View style={styles.perkIconWrap}>
                          <Heart size={14} color={COLORS.brand} strokeWidth={2.2} />
                        </View>
                        <Text style={styles.perkText}>Run together in real time</Text>
                    </View>
                    {!useCompactLayout && <View style={styles.perk}>
                        <View style={styles.perkIconWrap}>
                          <ShoppingBag size={14} color={COLORS.brand} strokeWidth={2.2} />
                        </View>
                        <Text style={styles.perkText}>Couple marketplace access</Text>
                    </View>}
                    {!useCompactLayout && <View style={styles.perk}>
                        <View style={styles.perkIconWrap}>
                          <Sparkles size={14} color={COLORS.brand} strokeWidth={2.2} />
                        </View>
                        <Text style={styles.perkText}>Celebrate wins as a team</Text>
                    </View>}
                </View>
            </View>
        </View>
        </ScrollView>
      </Animated.View>

      {/* 3. High-Impact Footer */}
      <View style={[styles.footer, useCompactLayout && styles.footerCompact]}>
        <TouchableOpacity style={[styles.cta, useCompactLayout && styles.ctaCompact]} onPress={onContinue} activeOpacity={0.9}>
            <LinearGradient 
                colors={[COLORS.brand, COLORS.brandDark]} 
                style={styles.ctaGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
            >
                <Text style={styles.ctaText}>START MY JOURNEY</Text>
                <ChevronRight color={COLORS.white} size={20} strokeWidth={3} />
            </LinearGradient>
        </TouchableOpacity>
        {!useCompactLayout && <Text style={styles.footerNote}>Start your plan and bring someone with you.</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  hero: {
    height: height * 0.38,
  },
  heroCompact: {
    height: height * 0.3,
  },
  heroSafe: {
    flex: 1,
  },
  watermarkText: {
    position: 'absolute',
    top: height * 0.06,
    left: 0,
    right: 0,
    fontSize: 90,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.06)',
    letterSpacing: -5,
    textAlign: 'center',
    zIndex: 0,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 20,
    marginTop: 10,
  },
  heroContent: {
    flex: 1,
    paddingTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarsWrapper: {
    flex: 1,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    marginTop: -15, 
    marginBottom: 5, 
  },
  connectionLine: {
    position: 'absolute',
    top: '50%',
    left: '20%',
    right: '20%',
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    zIndex: 0,
    transform: [{ translateY: -15 }],
  },
  avatarIdGroup: {
    width: '50%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainAvatar: {
    width: '100%', 
    flex: 1,
    transform: [{ scale: 1.3 }],
  },
  avatarNameLabel: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginTop: 12,
    textTransform: 'uppercase',
  },
  syncRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 15,
    marginHorizontal: -10,
    transform: [{ translateY: -15 }], 
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: -0.5,
    marginTop: 15,
  },
  heroBadge: {
    backgroundColor: 'rgba(0,0,0,0.12)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 5,
    marginBottom: 35, // pushes it comfortably away from the bottom so it doesn't look bad
  },
  heroBadgeCompact: {
    paddingVertical: 7,
    marginBottom: 18,
  },
  heroBadgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
  },
  overlapCard: {
    flex: 1,
    marginTop: 0, // Removed negative margin to keep hero content clear
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingHorizontal: 25,
    paddingTop: 30,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 8,
  },
  overlapCardCompact: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  overlapScrollContent: {
    paddingBottom: 12,
    flexGrow: 1,
  },
  cardHeader: {
    marginBottom: 30,
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.border,
    paddingBottom: 20,
  },
  cardHeaderCompact: {
    marginBottom: 16,
    paddingBottom: 12,
  },
  cardHeaderTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.brand,
    letterSpacing: 2,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  splitRow: {
    flexDirection: 'row',
  },
  splitRowCompact: {
    flexShrink: 1,
  },
  column: {
    flex: 1,
  },
  partnerColumn: {
    paddingRight: 0,
  },
  columnLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.ink,
    letterSpacing: 1,
    marginBottom: 16,
    textAlign: 'center',
    opacity: 0.4,
  },
  cardDivider: {
    width: 1.5,
    backgroundColor: COLORS.border,
    marginHorizontal: 15,
  },
  blueprintBulletList: {
    gap: 10,
  },
  blueprintBulletListCompact: {
    gap: 7,
  },
  blueprintBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  blueprintBulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.brand,
    marginTop: 6,
  },
  blueprintBulletContent: {
    flex: 1,
  },
  blueprintBulletWeek: {
    fontSize: 9,
    fontWeight: '900',
    color: COLORS.brand,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  blueprintBulletSummary: {
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.ink,
    fontWeight: '700',
  },
  perksList: {
    gap: 9,
  },
  perksListCompact: {
    gap: 7,
  },
  perk: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  perkIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 59, 59, 0.08)',
    marginTop: 1,
  },
  perkText: {
    flex: 1,
    flexShrink: 1,
    fontSize: 11,
    lineHeight: 12,
    fontWeight: '700',
    color: COLORS.ink,
  },
  footer: {
    marginTop: 'auto',
    paddingHorizontal: 25,
    paddingBottom: Platform.OS === 'ios' ? 45 : 30,
  },
  footerCompact: {
    paddingHorizontal: 25,
    paddingBottom: Platform.OS === 'ios' ? 12 : 20,
  },
  cta: {
    height: 70,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: COLORS.brand,
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  ctaCompact: {
    height: 58,
    borderRadius: 20,
  },
  ctaGrad: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  ctaText: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 1,
  },
  footerNote: {
    fontSize: 12,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 15,
    fontWeight: '500',
  },
});
