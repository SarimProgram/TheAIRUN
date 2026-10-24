import React, { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions, ScrollView, InteractionManager } from 'react-native';
import { Utensils, Dumbbell, Flame, Plus, Swords, RefreshCw, AlertTriangle } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg'; // Ensure react-native-svg is installed
import Animated, {
  useSharedValue,
  withTiming,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  FadeInDown,
  ZoomIn
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import GoalMascot from './GoalMascot';
import PremiumNotification from './PremiumNotification';
import { useDailySummary, getDashboardData } from '../../hooks/useDailySummary';
import { useAuth } from '../../src/auth/authContext';

const { width } = Dimensions.get('window');

const HERO_PAGE = {
  NOTIFICATION: 0,
  CALORIES: 1,
};

const COLORS = {
  primary: '#FF6B6B',
  primaryLight: '#FF8E8E', // Added for wave layering
  primarySoft: '#FFF1F1',  // Added for background tint
  teal: '#1F938A',
  textMain: '#1F2937',
  textMuted: '#6B7280',
  border: '#F3F4F6',
  cardBg: '#FFFFFF',
  softPrimary: '#FFF5F5',
  softTeal: '#E6FFFA',
};

// --- Wavy Background Component ---
const WavyBackground = () => (
  <View style={styles.waveContainer}>
    <Svg
      height="280"
      width={width}
      viewBox={`0 0 ${width} 280`}
      style={styles.svgWave}
    >
      <Path
        fill={COLORS.primarySoft}
        d="M0,160L48,144C96,128,192,96,288,106.7C384,117,480,171,576,186.7C672,203,768,181,864,149.3C960,117,1056,75,1152,64C1248,53,1344,75,1392,85.3L1440,96L1440,0L1392,0C1344,0,1248,0,1152,0C1056,0,960,0,864,0C768,0,672,0,576,0C480,0,384,0,288,0C192,0,96,0,48,0L0,0Z"
      />
      <Path
        fill={COLORS.softPrimary}
        opacity="0.6"
        d="M0,128L60,138.7C120,149,240,171,360,165.3C480,160,600,128,720,128C840,128,960,160,1080,165.3C1200,171,1320,149,1380,138.7L1440,128L1440,0L1380,0C1320,0,1200,0,1080,0C960,0,840,0,720,0C600,0,480,0,360,0C240,0,120,0,60,0L0,0Z"
      />
    </Svg>
  </View>
);

// Animated Counter: Displays rolling numbers
const AnimatedCounter = ({ value, style }) => {
  const [displayValue, setDisplayValue] = React.useState(0);

  useEffect(() => {
    let start = displayValue;
    const end = value;
    if (start === end) return;

    let totalDuration = 1000;
    let startTime = Date.now();

    const timer = setInterval(() => {
      let timePassed = Date.now() - startTime;
      let progress = Math.min(timePassed / totalDuration, 1);

      let current = Math.floor(start + (end - start) * progress);
      setDisplayValue(current);

      if (progress === 1) clearInterval(timer);
    }, 16);

    return () => clearInterval(timer);
  }, [value]);

  return <Text style={style}>{displayValue}</Text>;
};

const TodayGoalHero = ({
  partnerData,
  onLogFood,
  onIntervene,
  interveneSent,
  celebrationRequest = null,
  onNotificationDismiss,
}) => {
  const router = useRouter();
  const { accessToken } = useAuth();
  const { summary, loading, error, refetch, recalculate } = useDailySummary({ accessToken });
  const heroPagerRef = useRef(null);
  const activePageRef = useRef(HERO_PAGE.CALORIES);
  const [activePage, setActivePage] = useState(HERO_PAGE.CALORIES);
  const heroPageWidth = width - 32;

  useEffect(() => {
    activePageRef.current = activePage;
  }, [activePage]);

  const myData = useMemo(() => getDashboardData(summary), [summary]);

  const partnerIsNegative = useMemo(() => {
    if (!partnerData) return false;
    const remaining = partnerData.goal - (partnerData.food - partnerData.exercise);
    return remaining < 0;
  }, [partnerData]);

  const openActivity = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/activity', params: { tab: 'NUTRITION' } });
  };

  const teamProgress = useMemo(() => {
    const myRemaining = myData.goal - (myData.food - myData.exercise);
    const partnerRemaining = partnerData
      ? partnerData.goal - (partnerData.food - partnerData.exercise)
      : 0;
    const totalGoal = myData.goal + (partnerData?.goal || 0);
    if (totalGoal === 0) return 0;
    return ((totalGoal - myRemaining - partnerRemaining) / totalGoal) * 100;
  }, [myData, partnerData]);

  const handleRefresh = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await recalculate();
    } catch (e) {
      console.error('[TodayGoalHero] Recalculate failed:', e);
    }
  };

  const scrollToPage = (pageIndex) => {
    heroPagerRef.current?.scrollTo({ x: heroPageWidth * pageIndex, animated: true });
    activePageRef.current = pageIndex;
    setActivePage(pageIndex);
  };

  const resetToCaloriesPage = useCallback(() => {
    heroPagerRef.current?.scrollTo({
      x: heroPageWidth * HERO_PAGE.CALORIES,
      animated: false,
    });
    activePageRef.current = HERO_PAGE.CALORIES;
    setActivePage(HERO_PAGE.CALORIES);
  }, [heroPageWidth]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const task = InteractionManager.runAfterInteractions(() => {
        if (!active || activePageRef.current === HERO_PAGE.CALORIES) return;
        resetToCaloriesPage();
      });

      return () => {
        active = false;
        task.cancel?.();
      };
    }, [resetToCaloriesPage])
  );

  if (loading && !summary) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="small" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Background Waves */}
      <WavyBackground />

      <View style={styles.header}>
        <Animated.View entering={FadeInDown.delay(100).duration(600)}>
          <Text style={styles.title}>The Daily Stance</Text>
        </Animated.View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={handleRefresh} style={styles.refreshBtn}>
            <RefreshCw size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
          {activePage === HERO_PAGE.CALORIES ? (
            <Animated.View entering={ZoomIn.delay(300)} style={styles.mascotWrapper}>
              <GoalMascot progress={teamProgress} />
            </Animated.View>
          ) : null}
        </View>
      </View>

      <ScrollView
        ref={heroPagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        contentOffset={{ x: heroPageWidth * HERO_PAGE.CALORIES, y: 0 }}
        onMomentumScrollEnd={(e) => {
          const x = e.nativeEvent.contentOffset.x;
          const page = Math.round(x / heroPageWidth);
          activePageRef.current = page;
          setActivePage(page);
        }}
        scrollEventThrottle={16}
        style={styles.heroPager}
      >
        <View style={[styles.heroPage, { width: heroPageWidth }]}>
          <PremiumNotification
            variant="light"
            celebrationRequest={celebrationRequest}
            onDismiss={onNotificationDismiss}
          />
        </View>

        <View style={[styles.heroPage, { width: heroPageWidth }]}>
          <View style={styles.grid}>
            <Animated.View style={{ flex: 1 }} entering={FadeInDown.delay(400).springify()}>
              <UserCard
                title="YOU"
                data={myData}
                accent={COLORS.primary}
                isMain
                onLog={onLogFood}
                onPress={openActivity}
              />
            </Animated.View>

            {partnerData && (
              <>
                <Animated.View entering={ZoomIn.delay(800)} style={styles.vsFloating}>
                  <View style={styles.vsInner}>
                    <Swords size={12} color={COLORS.textMuted} />
                  </View>
                </Animated.View>

                <Animated.View style={{ flex: 1 }} entering={FadeInDown.delay(600).springify()}>
                  <UserCard
                    title={partnerData.name || "PARTNER"}
                    data={partnerData}
                    accent={COLORS.teal}
                    showIntervene={partnerIsNegative && !!onIntervene}
                    onIntervene={onIntervene}
                    interveneLabel={interveneSent ? 'Sent' : 'Intervene!'}
                  />
                </Animated.View>
              </>
            )}
          </View>
        </View>
      </ScrollView>

      <View style={styles.paginationContainer}>
        {[HERO_PAGE.NOTIFICATION, HERO_PAGE.CALORIES].map((i) => (
          <TouchableOpacity
            key={i}
            onPress={() => scrollToPage(i)}
            activeOpacity={0.8}
            style={styles.dotTapTarget}
          >
            <View style={[styles.dot, activePage === i ? styles.activeDot : styles.inactiveDot]} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const UserCard = ({
  title,
  data,
  accent,
  isMain,
  onLog,
  onPress,
  showIntervene,
  onIntervene,
  interveneLabel,
}) => {
  const pulse = useSharedValue(1);
  const intervenePulse = useSharedValue(1);

  const remaining = data.goal - (data.food - data.exercise);
  const isNegative = remaining < 0;
  const statusColor = isNegative ? '#EF4444' : accent;
  const pulsePeak = isNegative ? 1.12 : 1.08;

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(pulsePeak, { duration: 1100 }),
        withTiming(1, { duration: 1100 })
      ),
      -1,
      true
    );
  }, [pulsePeak]);

  useEffect(() => {
    if (!showIntervene) {
      intervenePulse.value = 1;
      return;
    }

    intervenePulse.value = withRepeat(
      withSequence(
        withTiming(1.03, { duration: 1000 }),
        withTiming(1, { duration: 1000 })
      ),
      -1,
      true
    );
  }, [showIntervene]);

  const animatedFlameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 0.96 + (pulse.value - 1) * 0.35,
  }));

  const animatedInterveneStyle = useAnimatedStyle(() => ({
    transform: [{ scale: intervenePulse.value }],
  }));

  return (
    <View style={[styles.cardOuter, isMain && { shadowColor: statusColor }]}>
      <TouchableOpacity
        style={styles.cardInner}
        activeOpacity={0.9}
        onPress={onPress}
        disabled={!onPress}
      >
        <Text style={[styles.microTag, { color: statusColor }]}>{title}</Text>

        <View style={styles.mainStatRow}>
          <AnimatedCounter
            value={remaining}
            style={[styles.bigNum, isNegative && styles.bigNumWarning]}
          />
          <Animated.View style={animatedFlameStyle}>
            {isNegative ? (
              <AlertTriangle size={20} color="#EF4444" fill="#FEE2E2" />
            ) : (
              <Flame size={18} color={accent} fill={accent} />
            )}
          </Animated.View>
        </View>
        <Text style={styles.subLabel}>{isNegative ? 'KCAL OVER' : 'KCAL LEFT'}</Text>

        <View style={styles.statsContainer}>
          <StatRow
            icon={<Utensils size={14} color={COLORS.textMuted} />}
            value={data.food}
            label="eaten"
          />
          <StatRow
            icon={<Dumbbell size={14} color={COLORS.textMuted} />}
            value={data.exercise}
            label="burned"
          />
        </View>

        {isMain && (
          <TouchableOpacity
            activeOpacity={0.7}
            style={[styles.blockButtonLike, { backgroundColor: accent }]}
            onPress={(e) => {
              e?.stopPropagation?.();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onLog?.();
            }}
          >
            <Plus size={16} color="#FFF" strokeWidth={3} />
          </TouchableOpacity>
        )}
        {!isMain && showIntervene && onIntervene && (
          <Animated.View style={[styles.interveneButton, animatedInterveneStyle]}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.interveneButtonPress}
              onPress={(e) => {
                e?.stopPropagation?.();
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                onIntervene();
              }}
            >
              <AlertTriangle size={13} color="#DC2626" fill="#FEE2E2" />
              <Text style={styles.interveneButtonText}>{interveneLabel || 'Intervene!'}</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </TouchableOpacity>
    </View>
  );
};

const StatRow = ({ icon, value }) => (
  <View style={styles.consistentRow}>
    <View style={styles.iconBox}>{icon}</View>
    <Text style={styles.statValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { 
    paddingHorizontal: 16, 
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden', // Keeps waves within bounds
    borderRadius: 32,
  },
  waveContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: -1, // Places it behind cards
  },
  svgWave: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60
  },
  loadingText: {
    marginTop: 8,
    color: COLORS.textMuted,
    fontSize: 12
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refreshBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.textMain,
    letterSpacing: -0.5
  },
  mascotWrapper: { width: 55, height: 55 },
  heroPager: {
    marginBottom: 8,
  },
  heroPage: {
    minHeight: 210,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  dot: {
    height: 4,
    borderRadius: 2,
  },
  dotTapTarget: {
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  activeDot: {
    width: 18,
    backgroundColor: COLORS.primary,
  },
  inactiveDot: {
    width: 6,
    backgroundColor: COLORS.teal,
  },
  grid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardOuter: {
    backgroundColor: '#FFF',
    padding: 4,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 8,
  },
  cardInner: {
    padding: 12,
    borderRadius: 20,
    alignItems: 'center',
    height: 199,
    overflow: 'visible',
  },
  microTag: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 10
  },
  mainStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  bigNum: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.textMain
  },
  bigNumWarning: {
    color: '#EF4444',
  },
  subLabel: {
    fontSize: 8,
    color: COLORS.textMuted,
    letterSpacing: 1,
    marginBottom: 15,
    fontWeight: '700'
  },
  statsContainer: { width: '100%', gap: 8 },
  consistentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F9FAFB',
    padding: 6,
    borderRadius: 12,
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center'
  },
  statValue: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textMain
  },
  blockButtonLike: {
    position: 'absolute',
    bottom: -8,
    right: 8,
    width: 40,
    height: 40,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  interveneButton: {
    position: 'absolute',
    bottom: -10,
    right: -5,
    zIndex: 20,
    elevation: 8,
    shadowColor: '#DC2626',
    shadowOpacity: 0.18,
    shadowRadius: 8,
  },
  interveneButtonPress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    paddingVertical: 8,
    paddingHorizontal: 11,
    borderRadius: 14,
  },
  interveneButtonText: {
    color: '#DC2626',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  vsFloating: {
    position: 'absolute',
    left: '50%',
    top: '35%',
    marginLeft: -16,
    zIndex: 10,
    padding: 3,
    backgroundColor: '#FFF',
    borderRadius: 20,
  },
  vsInner: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default TodayGoalHero;
