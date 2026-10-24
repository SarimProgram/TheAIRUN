import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import {
  Coffee,
  Utensils,
  Moon,
  Plus,
  User,
  Users,
  Droplets,
  Camera,
  Apple,
  Check,
} from 'lucide-react-native';
import Reanimated, { FadeInUp, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { API_BASE_URL } from '../../config/api';
import { useAuth } from '@/src/auth/authContext';
import { useWaterSync } from '../../hooks/useWaterSync';
import { usePartnerSummary } from '../../hooks/usePartnerSummary';
import { useChat } from '../../contexts/ChatContext';
import { usePoints } from '../../hooks/usePoints';
import { ReminderPartnerSheet } from '../partner/ReminderPartnerSheet';
import { PARTNER_REMINDER_CATEGORIES } from '../partner/reminderAssets';

const COLORS = {
  primary: '#FF6B6B',
  action: '#C5305F',
  water: '#38BDF8',
  bg: 'transparent',
  card: '#FFFFFF',
  text: '#111827',
  textMuted: '#9CA3AF',
  white: '#FFFFFF',
  border: '#F1F5F9',
};

const MEAL_TYPES = ["BREAKFAST", "LUNCH", "SNACK", "DINNER"];
const WATER_GLASS_GOAL = 8;
const PARTNER_WATER_STALE_MS = 2 * 60 * 60 * 1000;
const HYDRATION_REMINDER_CATEGORIES = PARTNER_REMINDER_CATEGORIES.filter(
  (category) => category.id === 'hydration',
);

function partnerNeedsWaterNudge(partnerSummary) {
  if (!partnerSummary) return false;

  const now = new Date();
  if ((partnerSummary.waterMl ?? 0) === 0) {
    return now.getHours() >= 10;
  }

  if (!partnerSummary.lastWaterUpdate) return false;

  const diff = Date.now() - new Date(partnerSummary.lastWaterUpdate).getTime();
  return diff > PARTNER_WATER_STALE_MS;
}

const GLASS_BODY =
  'M 18 14 C 18 9 46 9 46 14 L 48 66 C 48 72 16 72 16 66 Z';
const GLASS_WATER =
  'M 20 30 L 18.5 64 C 18.5 68 45.5 68 45.5 64 L 44 30 Z';
const GLASS_RIM =
  'M 18 14 C 18 10 46 10 46 14';
const GLASS_HIGHLIGHT =
  'M 22 18 L 21 62 C 21 65 24 65 26 65 L 27 18 Z';

function HydrationGlass({ filled, onPress, disabled, index }) {
  const gradientId = `hydration-water-${index}`;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={styles.glassBtn}
      activeOpacity={disabled ? 1 : 0.8}
    >
      <Svg width={34} height={42} viewBox="0 0 64 80">
        <Defs>
          <LinearGradient id={gradientId} x1="32" y1="28" x2="32" y2="70" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#BAE6FD" />
            <Stop offset="1" stopColor={COLORS.water} />
          </LinearGradient>
        </Defs>

        <Path
          d={GLASS_BODY}
          fill={filled ? '#F0F9FF' : '#F8FAFC'}
          stroke={filled ? '#7DD3FC' : '#CBD5E1'}
          strokeWidth={2}
        />

        {filled ? (
          <Path d={GLASS_WATER} fill={`url(#${gradientId})`} />
        ) : null}

        <Path d={GLASS_HIGHLIGHT} fill="rgba(255,255,255,0.42)" />
        <Path
          d={GLASS_RIM}
          fill="none"
          stroke={filled ? COLORS.water : '#94A3B8'}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      </Svg>
    </TouchableOpacity>
  );
}

const ICON_MAP = {
  BREAKFAST: Coffee,
  LUNCH: Utensils,
  DINNER: Moon,
  SNACK: Apple,
};

const MealTrackerSection = () => {
  const { authFetch, isAuthenticated, accessToken } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { sendMessage, connected: chatConnected } = useChat();
  const { balance: pointsBalance } = usePoints({ accessToken });
  const [activeUser, setActiveUser] = useState('me');
  const [showWaterReminderSheet, setShowWaterReminderSheet] = useState(false);
  const [waterNudgeSent, setWaterNudgeSent] = useState(false);
  const [devForceWaterNudge, setDevForceWaterNudge] = useState(false);
  
  // Get partner summary for hydration tracking
  const { partnerData, hasPartner, loading: partnerSummaryLoading } = usePartnerSummary({ accessToken });

  const [loading, setLoading] = useState(true);
  const [meals, setMeals] = useState([]);
  const [dailyTotalCalories, setDailyTotalCalories] = useState(0);

  // Water tracking with offline-first sync
  const { glassCount, setWaterTotal } = useWaterSync({ accessToken });

  // Partner data state
  const [partnerLoading, setPartnerLoading] = useState(false);
  const [partnerMeals, setPartnerMeals] = useState([]);
  const [partnerTotalCalories, setPartnerTotalCalories] = useState(0);
  const [partnerName, setPartnerName] = useState('Partner');

  const ACTIVE_COLOR = activeUser === 'me' ? COLORS.primary : COLORS.action;

  // Fetch user's meals
  const fetchTodayMeals = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const resp = await authFetch(`${API_BASE_URL}/nutrition/meals/today`);
      if (!resp.ok) throw new Error(`Failed to fetch meals: ${resp.status}`);
      const json = await resp.json();
      setMeals(json?.meals || []);
      setDailyTotalCalories(json?.totalCalories || 0);
    } catch (e) {
      console.error('Failed to fetch meals:', e);
    } finally {
      setLoading(false);
    }
  }, [authFetch, isAuthenticated]);

  // Fetch partner's meals
  const fetchPartnerMeals = useCallback(async () => {
    if (!accessToken) {
      setPartnerLoading(false);
      return;
    }
    try {
      setPartnerLoading(true);
      const resp = await fetch(`${API_BASE_URL}/nutrition/meals/partner/today`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      if (!resp.ok) throw new Error(`Failed to fetch partner meals: ${resp.status}`);
      const json = await resp.json();
      setPartnerMeals(json?.meals || []);
      setPartnerTotalCalories(json?.totalCalories || 0);
      if (json?.partner?.name) {
        setPartnerName(json.partner.name);
      }
    } catch (e) {
      console.error('Failed to fetch partner meals:', e);
    } finally {
      setPartnerLoading(false);
    }
  }, [accessToken]);

  const openLogFood = useCallback((mealType) => {
    const params = { action: 'logFood', t: Date.now() };
    router.push({
      pathname: '/activity',
      params: mealType ? { ...params, mealType } : params,
    });
  }, [router]);

  const handleUpdateWater = useCallback(async (glasses) => {
    if (activeUser !== 'me') return;

    try {
      await setWaterTotal(glasses * 250);
    } catch (e) {
      console.error('Water update error:', e);
    }
  }, [activeUser, setWaterTotal]);

  useEffect(() => {
    fetchTodayMeals();
    fetchPartnerMeals();
  }, [fetchTodayMeals, fetchPartnerMeals]);

  useFocusEffect(
    useCallback(() => {
      fetchTodayMeals();
      if (activeUser === 'partner') {
        fetchPartnerMeals();
      }
    }, [activeUser, fetchPartnerMeals, fetchTodayMeals])
  );

  // Re-fetch partner data when switching to partner view
  useEffect(() => {
    if (activeUser === 'partner') {
      fetchPartnerMeals();
    }
  }, [activeUser, fetchPartnerMeals]);

  // Optimized State Selection
  const { currentMeals, currentDailyCals, currentWater, isLoading } = useMemo(() => ({
    currentMeals: activeUser === 'me' ? meals : partnerMeals,
    currentDailyCals: activeUser === 'me' ? dailyTotalCalories : partnerTotalCalories,
    currentWater: activeUser === 'me' ? glassCount : (partnerData?.waterMl ? Math.floor(partnerData.waterMl / 250) : 0),
    isLoading: activeUser === 'me' ? loading : (partnerLoading || partnerSummaryLoading)
  }), [activeUser, meals, partnerMeals, dailyTotalCalories, partnerTotalCalories, glassCount, loading, partnerLoading, partnerData, partnerSummaryLoading]);

  const totalSugar = useMemo(() => Math.round(currentDailyCals * 0.05), [currentDailyCals]);
  const sugarLimit = 40;
  const showPartnerWaterNudge = useMemo(
    () => (__DEV__ && devForceWaterNudge) || (hasPartner && partnerNeedsWaterNudge(partnerData)),
    [devForceWaterNudge, hasPartner, partnerData],
  );
  const shouldShowWaterNudgeBanner = showPartnerWaterNudge
    && (activeUser === 'partner' || (__DEV__ && devForceWaterNudge));
  const partnerReminderName = partnerName || partnerData?.name || 'Partner';
  const partnerFirstName = partnerReminderName.split(/\s+/)[0] || 'Partner';

  const handleSendWaterReminder = useCallback((message) => {
    if (sendMessage) {
      sendMessage(message);
    }

    setWaterNudgeSent(true);
    setTimeout(() => {
      setWaterNudgeSent(false);
    }, 3000);
  }, [sendMessage]);

  return (
    <View style={styles.container}>
      <View style={styles.topNav}>
        <Text style={styles.sectionTitle}>NUTRITION</Text>
        <View style={styles.pillSelector}>
          <TouchableOpacity onPress={() => setActiveUser('me')} style={[styles.pill, activeUser === 'me' && styles.pillActive]}>
            <User size={14} color={activeUser === 'me' ? COLORS.primary : COLORS.textMuted} />
            <Text style={[styles.pillText, activeUser === 'me' && { color: COLORS.primary }]}>You</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setActiveUser('partner')} style={[styles.pill, activeUser === 'partner' && styles.pillActive]}>
            <Users size={14} color={activeUser === 'partner' ? COLORS.action : COLORS.textMuted} />
            <Text style={[styles.pillText, activeUser === 'partner' && { color: COLORS.action }]}>{partnerName}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.miniLabel}>DAILY INTAKE</Text>
        {activeUser === 'me' && (
          <TouchableOpacity style={styles.logBtn} onPress={() => openLogFood()}>
            <Camera size={14} color={COLORS.white} />
            <Text style={styles.logBtnText}>Log Meal</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.listContainer}>
        {isLoading ? (
          <ActivityIndicator color={ACTIVE_COLOR} style={{ margin: 20 }} />
        ) : (
          MEAL_TYPES.map((type) => {
            const mealsOfType = currentMeals.filter(m => m.mealType === type);
            const hasMeals = mealsOfType.length > 0;
            const totalCaloriesForType = mealsOfType.reduce((sum, meal) => sum + (meal.totalCalories || 0), 0);
            const allItems = mealsOfType.flatMap(meal => meal.items || []);
            const Icon = ICON_MAP[type];
            const canLogMeal = activeUser === 'me';

            return (
              <TouchableOpacity
                key={type}
                activeOpacity={canLogMeal ? 0.85 : 1}
                disabled={!canLogMeal}
                onPress={() => canLogMeal && openLogFood(type)}
                style={[styles.mealCard, !hasMeals && styles.mealCardEmpty]}
              >
                <View style={[styles.iconContainer, { backgroundColor: hasMeals ? ACTIVE_COLOR : '#F8FAFC' }]}>
                  <Icon size={20} color={hasMeals ? COLORS.white : COLORS.textMuted} />
                </View>

                <View style={styles.mealInfoContainer}>
                  <Text style={styles.mealTypeName}>
                    {type.charAt(0) + type.slice(1).toLowerCase()}
                  </Text>

                  {hasMeals ? (
                    <View style={styles.itemsWrapper}>
                      {allItems.map((item, idx) => (
                        <Text key={item.id || idx} style={styles.bulletText} numberOfLines={2} ellipsizeMode="tail">
                          • {item.foodName}
                        </Text>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.noMealText}>No meal yet</Text>
                  )}
                </View>

                {hasMeals ? (
                  <View style={styles.calorieBadge}>
                    <Text style={[styles.boldNumber, { color: ACTIVE_COLOR }]}>{totalCaloriesForType}</Text>
                    <Text style={styles.unit}>kcal</Text>
                  </View>
                ) : (
                  activeUser === 'me' ? (
                    <TouchableOpacity onPress={() => openLogFood(type)} style={styles.plusCircle}>
                      <Plus size={16} color={COLORS.textMuted} />
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.plusCircle}>
                      <Text style={styles.dashText}>—</Text>
                    </View>
                  )
                )}
              </TouchableOpacity>
            );
          })
        )}
      </View>

      <View style={styles.waterSection}>
        <View style={styles.sectionHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Droplets size={16} color={COLORS.water} />
            <Text style={styles.miniLabel}>HYDRATION</Text>
          </View>
          <Text style={styles.waterCount}>
            {currentWater} of {WATER_GLASS_GOAL} glasses
          </Text>
        </View>

        {shouldShowWaterNudgeBanner ? (
          <View style={styles.partnerWaterAlert}>
            <View style={styles.partnerWaterAlertCopy}>
              <Droplets size={16} color={COLORS.water} />
              <Text style={styles.partnerWaterAlertText}>
                {partnerFirstName} hasn&apos;t drunk water for a while now
              </Text>
            </View>
            <TouchableOpacity
              style={styles.partnerWaterAlertBtn}
              onPress={() => setShowWaterReminderSheet(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.partnerWaterAlertBtnText}>Remind now</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.glassRow}>
          {[...Array(WATER_GLASS_GOAL)].map((_, i) => (
            <HydrationGlass
              key={i}
              index={i}
              filled={i < currentWater}
              onPress={() => handleUpdateWater(i + 1)}
              disabled={activeUser !== 'me'}
            />
          ))}
        </View>

        {__DEV__ ? (
          <TouchableOpacity
            style={[styles.devWaterToggle, devForceWaterNudge && styles.devWaterToggleActive]}
            onPress={() => setDevForceWaterNudge((current) => !current)}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.devWaterToggleText,
                devForceWaterNudge && styles.devWaterToggleTextActive,
              ]}
            >
              {devForceWaterNudge ? 'Dev: water nudge on' : 'Dev: water nudge'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.sugarSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.miniLabel}>DAILY SUGAR</Text>
          <Text style={styles.boldNumber}>{totalSugar}<Text style={styles.unit}>g</Text></Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressBar, {
            width: `${Math.min((totalSugar / sugarLimit) * 100, 100)}%`,
            backgroundColor: ACTIVE_COLOR
          }]} />
        </View>
      </View>

      <ReminderPartnerSheet
        visible={showWaterReminderSheet}
        onClose={() => setShowWaterReminderSheet(false)}
        bottomInset={insets.bottom}
        partnerName={partnerReminderName}
        pointsBalance={pointsBalance}
        chatConnected={chatConnected}
        categories={HYDRATION_REMINDER_CATEGORIES}
        onSendReminder={handleSendWaterReminder}
      />

      {waterNudgeSent ? (
        <Reanimated.View entering={FadeInUp} exiting={FadeOut} style={styles.sentOverlay}>
          <View style={styles.sentPill}>
            <Check size={14} color="#FFF" strokeWidth={2.5} />
            <Text style={styles.sentPillText}>Sent to {partnerFirstName}</Text>
          </View>
        </Reanimated.View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingVertical: 10, position: 'relative' },
  topNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: COLORS.text, letterSpacing: -0.5 },
  pillSelector: { flexDirection: 'row', backgroundColor: '#F1F5F9', padding: 4, borderRadius: 100 },
  pill: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 100, gap: 6 },
  pillActive: { backgroundColor: COLORS.white, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
  pillText: { fontSize: 13, fontWeight: '700', color: COLORS.textMuted },

  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  logBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primary, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 100 },
  logBtnText: { color: COLORS.white, fontSize: 12, fontWeight: '700' },

  listContainer: { gap: 12, marginBottom: 30 },
  mealCard: { backgroundColor: COLORS.card, padding: 16, borderRadius: 24, flexDirection: 'row', alignItems: 'center', gap: 16, borderWidth: 1, borderColor: '#F8FAFC' },
  mealCardEmpty: { borderStyle: 'dashed', borderColor: '#E2E8F0', opacity: 0.8 },
  iconContainer: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },

  // Optimized Container for long names
  mealInfoContainer: { flex: 1, justifyContent: 'center' },
  mealTypeName: { fontSize: 16, fontWeight: '800', color: COLORS.text, marginBottom: 2 },
  itemsWrapper: { flexDirection: 'column', flexShrink: 1 },
  bulletText: { fontSize: 13, color: COLORS.textMuted, fontWeight: '500', lineHeight: 18 },

  noMealText: { fontSize: 13, color: '#CBD5E1', fontStyle: 'italic' },
  calorieBadge: { alignItems: 'flex-end', minWidth: 50 },
  boldNumber: { fontSize: 18, fontWeight: '900' },
  unit: { fontSize: 10, color: COLORS.textMuted, fontWeight: '700' },
  plusCircle: { width: 32, height: 32, borderRadius: 16, borderStyle: 'dashed', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  dashText: { fontSize: 14, color: COLORS.textMuted },

  waterSection: { marginBottom: 30 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  miniLabel: { fontSize: 11, fontWeight: '900', color: COLORS.textMuted, letterSpacing: 1 },
  waterCount: { fontSize: 14, fontWeight: '800', color: COLORS.water },
  partnerWaterAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  partnerWaterAlertCopy: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  partnerWaterAlertText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: '#0C4A6E',
  },
  partnerWaterAlertBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: COLORS.water,
  },
  partnerWaterAlertBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 0.2,
  },
  glassRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'space-between',
  },
  glassBtn: {
    width: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  devWaterToggle: {
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  devWaterToggleActive: {
    backgroundColor: '#F0F9FF',
    borderColor: COLORS.water,
  },
  devWaterToggleText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textMuted,
  },
  devWaterToggleTextActive: {
    color: '#0369A1',
  },

  sugarSection: { paddingBottom: 40 },
  progressTrack: { height: 10, backgroundColor: '#F1F5F9', borderRadius: 5, overflow: 'hidden', marginTop: 8 },
  progressBar: { height: '100%', borderRadius: 5 },
  sentOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  sentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: COLORS.water,
    gap: 8,
    shadowColor: COLORS.water,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  sentPillText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: -0.1,
  },
});

export default MealTrackerSection;
