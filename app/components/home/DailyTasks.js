/* eslint-disable react/no-unescaped-entities */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput
} from 'react-native';
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
  MessageSquare,
  Zap
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { API_BASE_URL } from '../../config/api';
import { useAuth } from '@/src/auth/authContext';
import { useWaterSync } from '../../hooks/useWaterSync';
import { usePartnerSummary } from '../../hooks/usePartnerSummary';
import { useChat } from '../../contexts/ChatContext';

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
  danger: '#F43F5E',
};

const MEAL_TYPES = ["BREAKFAST", "LUNCH", "SNACK", "DINNER"];

const ICON_MAP = {
  BREAKFAST: Coffee,
  LUNCH: Utensils,
  DINNER: Moon,
  SNACK: Apple,
};

const MealTrackerSection = () => {
  const { authFetch, isAuthenticated, accessToken } = useAuth();
  const { sendMessage } = useChat();
  const router = useRouter();
  const [activeUser, setActiveUser] = useState('me');
  
  // Get partner summary for hydration tracking
  const { partnerData, loading: partnerSummaryLoading } = usePartnerSummary({ accessToken });

  // Nudge state
  const [nudgeExpanded, setNudgeExpanded] = useState(false);
  const [customNudge, setCustomNudge] = useState('');
  const [nudgeSentAt, setNudgeSentAt] = useState(null);

  // Auto-clear nudge cooldown after 1 hour
  useEffect(() => {
    if (!nudgeSentAt) return;
    const remaining = 60 * 60 * 1000 - (Date.now() - nudgeSentAt);
    if (remaining <= 0) { setNudgeSentAt(null); return; }
    const timer = setTimeout(() => setNudgeSentAt(null), remaining);
    return () => clearTimeout(timer);
  }, [nudgeSentAt]);

  const [loading, setLoading] = useState(true);
  const [meals, setMeals] = useState([]);
  const [dailyTotalCalories, setDailyTotalCalories] = useState(0);

  // Water tracking with offline-first sync
  const { waterMl, glassCount, logWater, lastLoggedAt } = useWaterSync({ accessToken });

  // Partner data state
  const [partnerLoading, setPartnerLoading] = useState(false);
  const [partnerMeals, setPartnerMeals] = useState([]);
  const [partnerTotalCalories, setPartnerTotalCalories] = useState(0);
  const [partnerName, setPartnerName] = useState('Partner');
  const [hasPartner, setHasPartner] = useState(false);

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
      setHasPartner(json?.hasPartner || false);
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
  const { currentMeals, currentDailyCals, currentWater, currentWaterMl, isLoading } = useMemo(() => ({
    currentMeals: activeUser === 'me' ? meals : partnerMeals,
    currentDailyCals: activeUser === 'me' ? dailyTotalCalories : partnerTotalCalories,
    currentWater: activeUser === 'me' ? glassCount : (partnerData?.waterMl ? Math.floor(partnerData.waterMl / 250) : 0),
    currentWaterMl: activeUser === 'me' ? waterMl : (partnerData?.waterMl || 0),
    isLoading: activeUser === 'me' ? loading : (partnerLoading || partnerSummaryLoading)
  }), [activeUser, meals, partnerMeals, dailyTotalCalories, partnerTotalCalories, glassCount, waterMl, loading, partnerLoading, partnerData, partnerSummaryLoading]);

  const totalSugar = useMemo(() => Math.round(currentDailyCals * 0.05), [currentDailyCals]);
  const sugarLimit = 40;
  
  // Calculate if partner's last water log was > 6 hours ago
  const partnerDehydrated = useMemo(() => {
    if (activeUser !== 'partner' || !partnerData) return false;
    
    const now = new Date();
    const currentHour = now.getHours();

    // If NO water logged today at all
    if (partnerData.waterMl === 0) {
      // Show nudge if it's past 10 AM and they haven't logged anything
      return currentHour >= 10;
    }
    
    // If they have logged water, check the last update time
    if (!partnerData.lastWaterUpdate) return false;

    const diff = Date.now() - new Date(partnerData.lastWaterUpdate).getTime();
    return diff > 6 * 60 * 60 * 1000;
  }, [partnerData, activeUser]);

  const showPartnerWaterNudge = partnerDehydrated;

  const handleSendNudge = () => {
    const funnyMessages = [
      `HEY ${partnerName.toUpperCase()}! Your kidneys called. They're thirsty. 🏜️`,
      `DRINK WATER you raisin! 🏜️`,
      `The desert is jealous of your hydration levels. Drink up! 🐫`,
      `Water is life. Don't be a ghost. 👻`,
      `Log some water or I'm calling the H2O police. 📉`
    ];
    const msg = funnyMessages[Math.floor(Math.random() * funnyMessages.length)];
    sendMessage(msg);
  };

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

      {showPartnerWaterNudge && !nudgeSentAt && (
        <View style={[styles.alertCard, { backgroundColor: COLORS.water, flexDirection: 'column', paddingBottom: nudgeExpanded ? 14 : 12 }]}>
          <TouchableOpacity 
            style={{ flexDirection: 'row', alignItems: 'center' }}
            onPress={() => setNudgeExpanded(!nudgeExpanded)}
            activeOpacity={0.8}
          >
            <View style={[styles.alertCircle, { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
              <Droplets size={20} color={COLORS.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.alertTitle}>Dry Spell! 🏜️</Text>
              <Text style={styles.alertSub}>Tap to nudge {partnerName}</Text>
            </View>
            <Zap size={24} color={COLORS.white} />
          </TouchableOpacity>

          {nudgeExpanded && (
            <View style={{ marginTop: 10 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {[
                  `DRINK WATER you raisin! 🏜️`,
                  `Your kidneys called... 💧`,
                  `Don't be a desert 🐫`,
                ].map((preset, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => { sendMessage(preset); setNudgeSentAt(Date.now()); setNudgeExpanded(false); }}
                    style={{ backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 }}
                  >
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{preset}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, paddingHorizontal: 10 }}>
                <TextInput
                  value={customNudge}
                  onChangeText={setCustomNudge}
                  placeholder="Type your own nudge..."
                  placeholderTextColor="rgba(255,255,255,0.6)"
                  style={{ flex: 1, color: '#fff', fontSize: 13, paddingVertical: 8 }}
                />
                <TouchableOpacity 
                  onPress={() => { 
                    if (customNudge.trim()) { sendMessage(customNudge.trim()); setCustomNudge(''); setNudgeSentAt(Date.now()); setNudgeExpanded(false); }
                  }}
                  style={{ padding: 6 }}
                >
                  <MessageSquare size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      {nudgeSentAt && showPartnerWaterNudge && (
        <View style={[styles.alertCard, { backgroundColor: '#10B981' }]}>
          <View style={[styles.alertCircle, { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
            <Droplets size={20} color={COLORS.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.alertTitle}>Nudge Sent ✓</Text>
            <Text style={styles.alertSub}>You'll be able to nudge again in 1hr</Text>
          </View>
        </View>
      )}

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
          <Text style={styles.waterCount}>{currentWaterMl}ml</Text>
        </View>
        <View style={styles.waterGrid}>
          {[...Array(8)].map((_, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => activeUser === 'me' && i >= currentWater && logWater()}
              style={[styles.waterDrop, i < currentWater ? { backgroundColor: COLORS.water } : { backgroundColor: '#F1F5F9' }]}
            />
          ))}
        </View>
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingVertical: 10 },
  topNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: COLORS.text, letterSpacing: -0.5 },
  pillSelector: { flexDirection: 'row', backgroundColor: '#F1F5F9', padding: 4, borderRadius: 100 },
  pill: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 100, gap: 6 },
  pillActive: { backgroundColor: COLORS.white, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
  pillText: { fontSize: 13, fontWeight: '700', color: COLORS.textMuted },

  alertCard: { backgroundColor: COLORS.danger, borderRadius: 24, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 25 },
  alertCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  alertTitle: { color: 'white', fontWeight: '900', fontSize: 16 },
  alertSub: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },

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
  waterGrid: { flexDirection: 'row', gap: 8 },
  waterDrop: { flex: 1, height: 35, borderRadius: 10 },

  sugarSection: { paddingBottom: 40 },
  progressTrack: { height: 10, backgroundColor: '#F1F5F9', borderRadius: 5, overflow: 'hidden', marginTop: 8 },
  progressBar: { height: '100%', borderRadius: 5 },

  
});

export default MealTrackerSection;
