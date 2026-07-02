import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { X, Flame, Utensils, TrendingUp, Zap, ChevronRight, Plus, PersonStanding, Info, Award, Target, LayoutDashboard, Footprints, Beef, Apple, Fish, Timer } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { BlurView } from 'expo-blur';
import Animated, { 
  FadeIn, 
  FadeInUp, 
  FadeInDown, 
  Layout, 
  useAnimatedStyle, 
  useSharedValue, 
  withTiming, 
  withSpring,
  interpolate,
  Extrapolate
} from 'react-native-reanimated';
import { useAuth } from '../src/auth/authContext';
import { useDailySummary } from '../hooks/useDailySummary';
import { usePartnerSummary } from '../hooks/usePartnerSummary';
import { API_BASE_URL } from '../config/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const COLORS = {
  bg: '#010101',
  surface: '#0A0A0B',
  surfaceCard: '#121214',
  primary: '#FF6B6B', // THEME CORAL
  primaryDark: '#EE5253',
  primaryLight: '#FFF5F5',
  green: '#10B981',
  amber: '#F59E0B',
  blue: '#3B82F6',
  white: '#FFFFFF',
  text: '#FFFFFF',
  textMuted: '#8E8E93',
  border: 'rgba(255,255,255,0.06)',
};

const MEAL_ORDER = ['BREAKFAST', 'LUNCH', 'SNACK', 'DINNER'] as const;
const MEAL_LABELS: Record<(typeof MEAL_ORDER)[number], string> = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  SNACK: 'Snack',
  DINNER: 'Dinner',
};

type MealItem = { id?: string; foodName?: string; calories?: number };
type Meal = { id?: string; mealType?: string; totalCalories?: number; items?: MealItem[] };

type EnergyMetrics = {
  name: string;
  goal: number;
  intake: number;
  activeBurn: number;
  restingBurn: number | null;
  totalBurn: number | null;
  net: number;
  left: number;
  steps: number;
  stepsTarget: number;
  protein: number;
  carbs: number;
  fat: number;
  exerciseMinutes: number;
};

function toNumber(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function getDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildEnergyMetrics(input: any): EnergyMetrics {
  const goal = Math.max(0, toNumber(input.goal || input.calorieTarget));
  const intake = Math.max(0, toNumber(input.intake || input.food || input.consumedCalories));
  const activeBurn = Math.max(0, toNumber(input.activeBurn || input.exercise || input.activeCalories));
  const restingBurn = input.restingBurn == null ? null : Math.max(0, toNumber(input.restingBurn || input.restingCalories));
  const totalBurn = input.totalBurn == null ? null : Math.max(0, toNumber(input.totalBurn || input.totalBurnedCalories));
  const net = intake - activeBurn;

  return {
    name: input.name || 'YOU',
    goal,
    intake,
    activeBurn,
    restingBurn,
    totalBurn,
    net,
    left: goal - net,
    steps: Math.max(0, toNumber(input.steps)),
    stepsTarget: Math.max(0, toNumber(input.stepsTarget)),
    protein: Math.max(0, toNumber(input.proteinG || input.protein)),
    carbs: Math.max(0, toNumber(input.carbsG || input.carbs)),
    fat: Math.max(0, toNumber(input.fatG || input.fat)),
    exerciseMinutes: Math.max(0, toNumber(input.exerciseMinutes)),
  };
}

function summarizeMeals(meals: Meal[]) {
  return MEAL_ORDER.map((mealType) => {
    const meal = meals.find((entry) => String(entry?.mealType || '').toUpperCase() === mealType);
    const items = Array.isArray(meal?.items) ? meal.items : [];
    const total = typeof meal?.totalCalories === 'number' ? meal.totalCalories : items.reduce((sum, item) => sum + toNumber(item?.calories), 0);
    return {
      mealType,
      label: MEAL_LABELS[mealType],
      total: Math.max(0, Math.round(total)),
      items: items.map((item, index) => ({
        id: item?.id || `${mealType}-${index}`,
        name: item?.foodName || 'Item',
        calories: Math.max(0, Math.round(toNumber(item?.calories))),
      })),
    };
  });
}

export default function KcalDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { accessToken, authFetch } = useAuth();
  const { width } = useWindowDimensions();

  const [activeTab, setActiveTab] = useState<'you' | 'partner'>('you');
  const [myMeals, setMyMeals] = useState<Meal[]>([]);
  const [partnerMeals, setPartnerMeals] = useState<Meal[]>([]);

  const todaySummary = useDailySummary({ accessToken });
  const yesterdayKey = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return getDayKey(d);
  }, []);
  const yesterdaySummary = useDailySummary({ accessToken, dayKey: yesterdayKey });
  const { partnerData } = usePartnerSummary({ accessToken });

  // Animations
  const barProgress = useSharedValue(0);

  useEffect(() => {
    if (!accessToken) return;
    const fetchAll = async () => {
      try {
        const [myResp, partnerResp] = await Promise.allSettled([
          authFetch(`${API_BASE_URL}/nutrition/meals/today`),
          fetch(`${API_BASE_URL}/nutrition/meals/partner/today`, { headers: { Authorization: `Bearer ${accessToken}` } }),
        ]);
        if (myResp.status === 'fulfilled' && myResp.value.ok) {
          const json = await myResp.value.json();
          setMyMeals(Array.isArray(json?.meals) ? json.meals : []);
        }
        if (partnerResp.status === 'fulfilled' && partnerResp.value.ok) {
          const json = await partnerResp.value.json();
          setPartnerMeals(Array.isArray(json?.meals) ? json.meals : []);
        }
      } catch {}
    };
    fetchAll();
  }, [accessToken, authFetch]);

  const myMetrics = useMemo(() => {
    const s = todaySummary.summary;
    const fallback = params.myData ? JSON.parse(typeof params.myData === 'string' ? params.myData : params.myData[0]) : {};
    return buildEnergyMetrics(s || fallback);
  }, [todaySummary.summary, params.myData]);

  const partnerMetrics = useMemo(() => {
    if (!partnerData) return null;
    return buildEnergyMetrics({ ...partnerData as any, name: (partnerData as any).name || params.partnerName || 'PARTNER' });
  }, [partnerData, params.partnerName]);

  const yMetrics = useMemo(() => yesterdaySummary.summary ? buildEnergyMetrics(yesterdaySummary.summary) : null, [yesterdaySummary.summary]);

  const activeMetrics = activeTab === 'you' ? myMetrics : partnerMetrics || myMetrics;
  const activeMealSummary = summarizeMeals(activeTab === 'you' ? myMeals : partnerMeals);

  useEffect(() => {
    barProgress.value = 0;
    barProgress.value = withTiming(Math.min(1, activeMetrics.intake / (activeMetrics.goal || 1200)), { duration: 1200 });
  }, [activeMetrics.intake, activeMetrics.goal, activeTab]);

  const animatedBarStyle = useAnimatedStyle(() => {
    return {
      width: `${barProgress.value * 100}%`,
    };
  });

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* FLUID HEADER */}
      <BlurView intensity={20} style={styles.header} tint="dark">
        <TouchableOpacity onPress={() => router.back()} style={styles.headerIcon}>
          <X size={22} color={COLORS.white} strokeWidth={2.5} />
        </TouchableOpacity>
        
        <View style={styles.segmentedControl}>
          <TouchableOpacity onPress={() => setActiveTab('you')} style={[styles.segment, activeTab === 'you' && styles.segmentActive]}>
            <Text style={[styles.segmentText, activeTab === 'you' && styles.segmentTextActive]}>ME</Text>
          </TouchableOpacity>
          {partnerMetrics && (
            <TouchableOpacity onPress={() => setActiveTab('partner')} style={[styles.segment, activeTab === 'partner' && styles.segmentActive]}>
              <Text style={[styles.segmentText, activeTab === 'partner' && styles.segmentTextActive]}>PARTNER</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ width: 44 }} />
      </BlurView>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* ENERGY CENTER */}
        <Animated.View entering={FadeIn.duration(800)} style={styles.performanceSection}>
          <View style={styles.energyLabelRow}>
            <View>
              <Text style={styles.energyTitle}>CALORIES CONSUMED</Text>
              <Text style={styles.energyValue}>{Math.round(activeMetrics.intake).toLocaleString()}</Text>
            </View>
            <View style={styles.energyGoalBox}>
              <Text style={styles.goalLabel}>DAILY TARGET</Text>
              <Text style={styles.goalValue}>{activeMetrics.goal.toLocaleString()}</Text>
            </View>
          </View>

          <View style={styles.progressBarBg}>
            <Animated.View style={[styles.progressBarFill, animatedBarStyle]} />
          </View>

          <View style={styles.statusRow}>
            <View style={styles.statusPill}>
              <View style={[styles.statusDot, { backgroundColor: COLORS.primary }]} />
              <Text style={styles.statusText}>{activeMetrics.intake >= activeMetrics.goal ? 'TARGET EXCEEDED' : 'ACTIVE PERFORMANCE'}</Text>
            </View>
            <Text style={styles.percentText}>{Math.round((activeMetrics.intake / (activeMetrics.goal || 1)) * 100)}% CONSUMED</Text>
          </View>
        </Animated.View>

        {/* MACRO DASHBOARD */}
        <Animated.View entering={FadeInUp.delay(300)} style={styles.macroDashboard}>
          <Text style={styles.sectionTitle}>MACRO BREAKDOWN</Text>
          <View style={styles.macroGrid}>
            <MacroCard label="PROTEIN" value={activeMetrics.protein} unit="G" icon={<Beef size={14} color={COLORS.primary} />} color={COLORS.primary} />
            <MacroCard label="CARBS" value={activeMetrics.carbs} unit="G" icon={<Apple size={14} color={COLORS.blue} />} color={COLORS.blue} />
            <MacroCard label="FAT" value={activeMetrics.fat} unit="G" icon={<Fish size={14} color={COLORS.amber} />} color={COLORS.amber} />
          </View>
        </Animated.View>

        {/* QUICK STATS ROW */}
        <View style={styles.quickStatsRow}>
          <QuickStat label="IN" value={activeMetrics.intake} icon={<Utensils size={14} color={COLORS.primary} />} />
          <QuickStat label="METABOLIC" value={activeMetrics.restingBurn || 0} icon={<PersonStanding size={14} color={COLORS.textMuted} />} />
          <QuickStat label="NET" value={activeMetrics.net} icon={<TrendingUp size={14} color={COLORS.blue} />} />
        </View>

        {/* LOG MEAL CTA */}
        <Animated.View entering={FadeInUp.delay(400)} style={styles.ctaContainer}>
          <TouchableOpacity 
            style={styles.ctaButton}
            onPress={() => router.push({ pathname: '/activity', params: { action: 'logFood', t: Date.now() } })}
          >
            <View style={styles.ctaIconShell}>
              <Plus size={20} color="#000" strokeWidth={3} />
            </View>
            <Text style={styles.ctaText}>LOG NUTRITION SESSION</Text>
            <ChevronRight size={18} color={COLORS.primary} />
          </TouchableOpacity>
        </Animated.View>

        {/* MEAL LOG */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>NUTRITION LOG</Text>
          {activeMealSummary.map((meal, index) => (
            <Animated.View 
              key={meal.mealType} 
              entering={FadeInDown.delay(500 + index * 100)}
              style={styles.mealCard}
            >
              <View style={styles.mealHeader}>
                <View style={styles.mealTitleRow}>
                  <View style={[styles.mealIndicator, { backgroundColor: COLORS.primary }]} />
                  <Text style={styles.mealLabel}>{meal.label.toUpperCase()}</Text>
                </View>
                <Text style={styles.mealTotal}>{meal.total} <Text style={styles.mealUnit}>KCAL</Text></Text>
              </View>
              
              <View style={styles.mealBody}>
                {meal.items.length > 0 ? (
                  meal.items.map(item => (
                    <View key={item.id} style={styles.itemRow}>
                      <Text style={itemNameStyle(item.name)} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.itemCals}>{item.calories} <Text style={styles.unitSmall}>kcal</Text></Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>No manual entries available</Text>
                )}
              </View>
            </Animated.View>
          ))}
        </View>

        {/* COMPACT BURN BREAKDOWN (Moved to bottom small) */}
        <View style={styles.compactBurnSection}>
          <Text style={styles.sectionTitleSmall}>ACTIVE BURN ANALYSIS</Text>
          <View style={styles.burnStrip}>
            <View style={styles.burnCell}>
              <Flame size={12} color={COLORS.green} />
              <Text style={styles.burnCellVal}>{Math.round(activeMetrics.activeBurn)} <Text style={styles.burnCellLabel}>ACTIVE</Text></Text>
            </View>
            <View style={styles.burnCellDivider} />
            <View style={styles.burnCell}>
              <Footprints size={12} color={COLORS.textMuted} />
              <Text style={styles.burnCellVal}>{activeMetrics.steps.toLocaleString()} <Text style={styles.burnCellLabel}>STEPS</Text></Text>
            </View>
            <View style={styles.burnCellDivider} />
            <View style={styles.burnCell}>
              <Timer size={12} color={COLORS.textMuted} />
              <Text style={styles.burnCellVal}>{activeMetrics.exerciseMinutes} <Text style={styles.burnCellLabel}>MINS</Text></Text>
            </View>
          </View>
        </View>

        <View style={{ height: 160 }} />
      </ScrollView>

      {/* STICKY MOTION BAR */}
      <View style={styles.footerBar}>
        <BlurView intensity={30} style={styles.footerBlur} tint="dark">
          <TouchableOpacity 
            style={styles.motionButton}
            onPress={() => router.push({
              pathname: '/remaining-steps',
              params: { current: activeMetrics.steps, target: activeMetrics.stepsTarget || 10000 }
            })}
          >
            <View style={styles.motionLeft}>
              <View style={styles.motionIconShell}>
                <Footprints size={18} color={COLORS.primary} />
              </View>
              <View>
                <Text style={styles.motionLabel}>STEP PROGRESSION</Text>
                <Text style={styles.motionValue}>
                  {activeMetrics.steps.toLocaleString()} <Text style={styles.motionSub}>/ {(activeMetrics.stepsTarget || 10000).toLocaleString()} STEPS</Text>
                </Text>
              </View>
            </View>
            <ChevronRight size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
        </BlurView>
      </View>
    </View>
  );
}

function itemNameStyle(name: string) {
    return { fontSize: 14, fontWeight: '600' as const, color: COLORS.textMuted, flex: 1 };
}

function MacroCard({ label, value, unit, icon, color }: any) {
  return (
    <View style={styles.macroCard}>
      <View style={[styles.macroIconBox, { backgroundColor: color + '15' }]}>{icon}</View>
      <Text style={styles.macroLabel}>{label}</Text>
      <View style={styles.macroValRow}>
        <Text style={styles.macroValue}>{Math.round(value)}</Text>
        <Text style={styles.macroUnit}>{unit}</Text>
      </View>
      <View style={styles.macroBarBg}>
        <View style={[styles.macroBarFill, { backgroundColor: color, width: '40%' }]} />
      </View>
    </View>
  );
}

function QuickStat({ label, value, icon }: any) {
  return (
    <View style={styles.quickStat}>
      <Text style={styles.quickStatLabel}>{label}</Text>
      <View style={styles.quickStatValueRow}>
        {icon}
        <Text style={styles.quickStatValue}>{Math.round(value).toLocaleString()}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 54, paddingBottom: 14, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  segmentedControl: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 20, padding: 3, gap: 4
  },
  segment: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 16 },
  segmentActive: { backgroundColor: 'rgba(255,255,255,0.12)' },
  segmentText: { fontSize: 11, fontWeight: '900', color: COLORS.textMuted, letterSpacing: 1 },
  segmentTextActive: { color: COLORS.white },
  
  scrollContent: { paddingTop: 130, paddingHorizontal: 20 },

  performanceSection: { marginBottom: 32 },
  energyLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 },
  energyTitle: { fontSize: 11, fontWeight: '900', color: COLORS.textMuted, letterSpacing: 1.5, marginBottom: 4 },
  energyValue: { fontSize: 48, fontWeight: '900', color: COLORS.white, letterSpacing: -2 },
  energyGoalBox: { alignItems: 'flex-end' },
  goalLabel: { fontSize: 9, fontWeight: '900', color: COLORS.textMuted, letterSpacing: 1 },
  goalValue: { fontSize: 18, fontWeight: '900', color: COLORS.white, marginTop: 2 },
  
  progressBarBg: { height: 12, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 6, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 6 },
  
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '900', color: COLORS.textMuted, letterSpacing: 0.5 },
  percentText: { fontSize: 10, fontWeight: '900', color: COLORS.primary },

  macroDashboard: { marginBottom: 36 },
  macroGrid: { flexDirection: 'row', gap: 10, marginTop: 16 },
  macroCard: { flex: 1, backgroundColor: COLORS.surfaceCard, borderRadius: 22, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  macroIconBox: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  macroLabel: { fontSize: 9, fontWeight: '900', color: COLORS.textMuted, letterSpacing: 1, marginBottom: 4 },
  macroValRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2, marginBottom: 8 },
  macroValue: { fontSize: 20, fontWeight: '900', color: COLORS.white },
  macroUnit: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted },
  macroBarBg: { height: 4, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 2 },
  macroBarFill: { height: '100%', borderRadius: 2 },

  quickStatsRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: COLORS.surfaceCard, padding: 20, borderRadius: 28, marginBottom: 40, borderWidth: 1, borderColor: COLORS.border },
  quickStat: { alignItems: 'center' },
  quickStatLabel: { fontSize: 9, fontWeight: '900', color: COLORS.textMuted, letterSpacing: 1, marginBottom: 6 },
  quickStatValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  quickStatValue: { fontSize: 17, fontWeight: '900', color: COLORS.white },

  ctaContainer: { marginBottom: 48 },
  ctaButton: { 
    height: 72, backgroundColor: COLORS.surfaceCard, borderRadius: 24, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', gap: 16, borderWidth: 1, borderColor: COLORS.border 
  },
  ctaIconShell: { width: 44, height: 44, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  ctaText: { flex: 1, fontSize: 15, fontWeight: '900', color: COLORS.white, letterSpacing: 0.5 },

  sectionContainer: { marginBottom: 36 },
  sectionTitle: { fontSize: 11, fontWeight: '900', color: COLORS.textMuted, letterSpacing: 2 },
  
  mealCard: { backgroundColor: COLORS.surfaceCard, borderRadius: 28, padding: 22, marginTop: 16, borderWidth: 1, borderColor: COLORS.border },
  mealHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mealTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mealIndicator: { width: 4, height: 16, borderRadius: 2 },
  mealLabel: { fontSize: 15, fontWeight: '900', color: COLORS.white, letterSpacing: 0.5 },
  mealTotal: { fontSize: 20, fontWeight: '900', color: COLORS.white },
  mealUnit: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted },
  mealBody: { marginTop: 20, paddingTop: 18, borderTopWidth: 1, borderTopColor: COLORS.border, gap: 12 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemName: { fontSize: 14, fontWeight: '600', color: COLORS.textMuted, flex: 1 },
  itemCals: { fontSize: 14, fontWeight: '800', color: COLORS.white },
  unitSmall: { fontSize: 10, fontWeight: '600', color: COLORS.textMuted },
  emptyText: { fontSize: 13, color: COLORS.textMuted, fontStyle: 'italic' },

  compactBurnSection: { marginBottom: 40 },
  sectionTitleSmall: { fontSize: 9, fontWeight: '900', color: COLORS.textMuted, letterSpacing: 1.5, marginBottom: 16 },
  burnStrip: { 
    flexDirection: 'row', backgroundColor: COLORS.surfaceCard, borderRadius: 20, 
    padding: 16, alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: COLORS.border 
  },
  burnCell: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  burnCellVal: { fontSize: 14, fontWeight: '900', color: COLORS.white },
  burnCellLabel: { fontSize: 9, fontWeight: '700', color: COLORS.textMuted },
  burnCellDivider: { width: 1, height: 12, backgroundColor: COLORS.border },

  footerBar: { position: 'absolute', bottom: 30, left: 20, right: 20, zIndex: 100 },
  footerBlur: { borderRadius: 32, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },
  motionButton: { 
    padding: 12, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', 
    justifyContent: 'space-between', backgroundColor: 'rgba(10,10,10,0.8)' 
  },
  motionLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  motionIconShell: { width: 44, height: 44, borderRadius: 16, backgroundColor: 'rgba(255,107,107,0.1)', alignItems: 'center', justifyContent: 'center' },
  motionLabel: { fontSize: 10, fontWeight: '900', color: COLORS.textMuted, letterSpacing: 1 },
  motionValue: { fontSize: 18, fontWeight: '900', color: COLORS.white, marginTop: 2 },
  motionSub: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted },
});
