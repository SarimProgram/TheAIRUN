import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity, SafeAreaView,
  StatusBar, Dimensions, Modal, TextInput, ActivityIndicator,
  Alert, Animated, Platform, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, Image, LayoutAnimation, UIManager
} from 'react-native';

import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  X, Cookie, Clock, Trash2, User, Camera, Check, RotateCcw, Scale,
  ChevronRight, Droplets, ScanLine, Keyboard as KeyboardIcon,
  Zap, Info, TrendingUp, Plus, Flame, Coffee, Utensils, Moon, ChevronDown, Activity, BarChart2, Scan, Heart
} from 'lucide-react-native';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle as SvgCircle, Rect, Line as SvgLine, Path as SvgPath, Defs, Stop, LinearGradient as SvgGradient } from 'react-native-svg';

import * as ImageManipulator from 'expo-image-manipulator';
import * as Crypto from 'expo-crypto';
import NetInfo from '@react-native-community/netinfo';
import { API_BASE_URL } from '../../config/api';
import { useAuth } from '@/src/auth/authContext';
import { usePoints } from '../../hooks/usePoints';
import { useWaterSync } from '../../hooks/useWaterSync';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { loadRuns } from '@/lib/run-storage';
import {
  getLocalMealsForDay,
  getPendingLocalMeals,
  markLocalMealSynced,
  replaceSyncedLocalMealsForDay,
  upsertLocalMeal,
  deleteLocalMealItem,
} from '@/lib/offline-meals';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
const { width } = Dimensions.get('window');
const GRID_SPACING = 12;
const ITEM_WIDTH = (width - 48 - GRID_SPACING) / 2;

// Consistency COLORS
const COLORS = {
  bgPink: '#e65c5cff',
  bgPinkLight: '#ffc8c8d1',
  textDarkRed: '#8B2E2E',
  glassWhite: 'rgba(255, 255, 255, 0.3)',
  accent: '#FF6B6B',
  white: '#FFFFFF',
  textMain: '#1A1C1E',
  textSub: '#6C757D',
  primaryFade: 'rgba(255, 107, 107, 0.12)',
  success: '#00B894',
  successFade: 'rgba(0, 184, 148, 0.08)',
  afternoon: '#F59E0B',
  evening: '#6366F1',
  line: '#F1F3F5',
  inactive: '#DEE2E6',
  secondary: '#1F938A',
  water: '#3498DB',
  bg: '#F8F9FA',
  dark: '#1A1C1E',
};

type MealType = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
type WeightHistoryPoint = { weightKg: number; loggedAt: string };

const parseMealTypeParam = (value: unknown): MealType | null => {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === 'BREAKFAST' || raw === 'LUNCH' || raw === 'DINNER' || raw === 'SNACK') {
    return raw;
  }
  return null;
};

const parseStringParam = (value: unknown): string | null => {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === 'string' ? raw : null;
};

const dayOfWeekFromDayKey = (dayKey: string) => {
  const [year, month, day] = dayKey.split('-').map(Number);
  if (!year || !month || !day) return null;
  const utcDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return utcDay === 0 ? 7 : utcDay;
};

// --- SUB-COMPONENTS ---

const MacroTag = ({ label, value, unit, color, icon }: any) => (
  <View style={styles.macroTag}>
    <View style={[styles.macroIconCircle, { backgroundColor: `${color}15` }]}>
      {React.cloneElement(icon, { size: 10, color: color })}
    </View>
    <View>
      <Text style={styles.macroTagValue}>{value}{unit}</Text>
      <Text style={styles.macroTagLabel}>{label}</Text>
    </View>
  </View>
);

const WeeklyBarGraph = ({ data, target, dayKeys }: { data: number[], target: number, dayKeys?: string[] }) => {
  const maxVal = Math.max(...data, target * 1.2);
  const chartHeight = 64; 
  const [chartWidth, setChartWidth] = useState(0);
  const weeklyAverage = data.length ? Math.round(data.reduce((sum, value) => sum + value, 0) / data.length) : 0;
  const fallbackDays = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  const todayIdx = React.useMemo(() => {
    if (dayKeys?.length === 7) {
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const d = String(today.getDate()).padStart(2, '0');
      const todayKey = `${y}-${m}-${d}`;
      const idx = dayKeys.indexOf(todayKey);
      if (idx >= 0) return idx;
    }
    return (new Date().getDay() + 6) % 7; // fallback MON=0, SUN=6
  }, [dayKeys]);

  const dayLabels = React.useMemo(() => {
    if (dayKeys?.length === 7) {
      const map = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      return dayKeys.map((k) => {
        const [y, m, d] = k.split('-').map(Number);
        if (!y || !m || !d) return '---';
        const dt = new Date(Date.UTC(y, m - 1, d));
        return map[dt.getUTCDay()] || '---';
      });
    }
    return fallbackDays;
  }, [dayKeys]);

  const linePoints = React.useMemo(() => {
    if (chartWidth <= 0 || data.length === 0) return { path: '' };
    const denom = Math.max(1, data.length - 1);
    const points = data.map((val, i) => {
      const x = data.length === 1 ? chartWidth / 2 : (i / denom) * chartWidth;
      const y = chartHeight - (Math.max(0, val) / maxVal) * chartHeight;
      return { x, y: Math.max(2, Math.min(chartHeight - 2, y)) };
    });
    const path = points.map((point, i) => `${i === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
    return { path };
  }, [chartHeight, chartWidth, data, maxVal]);

  return (
    <View style={styles.premiumGraphContainer}>
      <View style={styles.kcalGraphHeader}>
        <View>
          <Text style={styles.kcalGraphEyebrow}>Weekly kcal</Text>
          <Text style={styles.kcalGraphTitle}>Daily intake vs target</Text>
        </View>
        <View style={styles.kcalGraphMeta}>
          <Text style={styles.kcalGraphMetaLabel}>Avg</Text>
          <Text style={styles.kcalGraphMetaValue}>{weeklyAverage}</Text>
        </View>
      </View>
      <View
        style={[styles.graphBody, { alignItems: 'flex-end', marginTop: 15 }]}
        onLayout={(event) => {
          const nextWidth = event.nativeEvent.layout.width;
          if (nextWidth && nextWidth !== chartWidth) {
            setChartWidth(nextWidth);
          }
        }}
      >
        {/* Target Line */}
        <View style={[styles.targetLine, { bottom: (target / maxVal) * chartHeight + 18 }]}>
          <View style={styles.targetLineLabel}>
             <Text style={styles.targetLineText}>{target}</Text>
          </View>
        </View>

        {linePoints.path ? (
          <Svg pointerEvents="none" style={styles.weeklyLineOverlay} width={chartWidth} height={chartHeight}>
            <SvgPath
              d={linePoints.path}
              stroke={COLORS.dark}
              strokeWidth={2.2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.6}
            />
          </Svg>
        ) : null}
        
        <View style={styles.barsRowPremium}>
          {data.map((val, i) => {
            const isToday = i === todayIdx;
            const isOverTarget = val > target;
            const barHeight = (val / maxVal) * chartHeight;

            return (
              <View key={i} style={styles.barColPremium}>
                <View style={styles.barContainerPremium}>
                  {val > 0 && (
                    <LinearGradient
                      colors={
                        isOverTarget
                          ? ['#EF4444', '#FCA5A5']
                          : isToday
                            ? [COLORS.accent, '#FF9B9B']
                            : ['#FB7185', '#FDBA74']
                      }
                      style={[
                        styles.barFillPremium,
                        isOverTarget && styles.barFillWarning,
                        { height: Math.max(barHeight, 4) },
                      ]}
                    />
                  )}
                </View>
                <Text style={[styles.barDayTextPremium, isToday && styles.todayDayText]}>
                  {dayLabels[i]}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
};

const WeightHistoryGraph = ({ history }: { history: WeightHistoryPoint[] }) => {
  const { sortedPoints, minVal, maxVal, weightChange, firstPoint, lastPoint } = React.useMemo(() => {
    if (!history || history.length === 0) return { sortedPoints: [], minVal: 0, maxVal: 0, weightChange: 0, firstPoint: null, lastPoint: null };
    const sorted = [...history].sort((a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime());
    const slice = sorted.slice(-14);
    if (slice.length === 0) return { sortedPoints: [], minVal: 0, maxVal: 0, weightChange: 0, firstPoint: null, lastPoint: null };
    const values = slice.map(p => p.weightKg);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const change = slice.length > 1 ? slice[slice.length - 1].weightKg - slice[0].weightKg : 0;
    return {
      sortedPoints: slice,
      minVal: min,
      maxVal: max,
      weightChange: change,
      firstPoint: slice[0],
      lastPoint: slice[slice.length - 1]
    };
  }, [history]);

  if (sortedPoints.length === 0) {
    return (
      <View style={styles.premiumGraphContainer}>
        <View style={styles.graphHeaderPremium}>
          <View style={styles.graphTitleBox}>
            <View style={styles.graphIconInner}>
              <TrendingUp size={16} color={COLORS.accent} />
            </View>
            <View>
              <Text style={styles.graphTitlePremium}>BODY WEIGHT</Text>
              <Text style={styles.graphSubPremium}>No weigh-ins yet</Text>
            </View>
          </View>
        </View>
        <View style={[styles.graphBody, { height: 110, justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={{ color: COLORS.textSub, fontWeight: '700' }}>Log your first weight to start the graph</Text>
        </View>
      </View>
    );
  }

  const chartHeight = 120;
  const chartWidth = width - 96; // Adjusting for container padding
  
  const range = Math.max(1, maxVal - minVal);
  const pad = range * 0.25;
  const minY = minVal - pad;
  const maxY = maxVal + pad;

  const HORIZ_PAD = 12;
  const toX = (idx: number) => {
    const denom = Math.max(1, sortedPoints.length - 1);
    return HORIZ_PAD + (idx / denom) * (chartWidth - HORIZ_PAD * 2);
  };
  const toY = (val: number) => {
    const ratio = (val - minY) / (maxY - minY);
    return (1 - ratio) * chartHeight;
  };

  const linePath = sortedPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(p.weightKg)}`).join(' ');
  const areaPath = sortedPoints.length > 1 
    ? `${linePath} L ${toX(sortedPoints.length - 1)} ${chartHeight} L ${toX(0)} ${chartHeight} Z`
    : '';

  const fmtDate = (iso: string) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <View style={styles.premiumGraphContainer}>
      <View style={styles.graphHeaderPremium}>
        <View style={styles.graphTitleBox}>
          <View style={styles.graphIconInner}>
            <TrendingUp size={16} color={COLORS.accent} />
          </View>
          <View>
            <Text style={styles.graphTitlePremium}>BODY WEIGHT</Text>
            <Text style={styles.graphSubPremium}>Last {sortedPoints.length} updates</Text>
          </View>
        </View>
        <View style={[styles.targetBadge, { backgroundColor: weightChange <= 0 ? COLORS.successFade : 'rgba(239, 68, 68, 0.1)' }]}>
           <Text style={[styles.targetBadgeText, { color: weightChange <= 0 ? COLORS.success : '#EF4444' }]}>
              {weightChange > 0 ? '+' : ''}{weightChange.toFixed(1)} kg
           </Text>
        </View>
      </View>

      <View style={{ marginTop: 10 }}>
        <Svg width={chartWidth} height={chartHeight}>
          <Defs>
            <SvgGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={COLORS.accent} stopOpacity="0.2" />
              <Stop offset="1" stopColor={COLORS.accent} stopOpacity="0.02" />
            </SvgGradient>
          </Defs>

          {[0, 0.5, 1].map((t, i) => (
            <SvgLine
              key={i}
              x1={0}
              y1={t * chartHeight}
              x2={chartWidth}
              y2={t * chartHeight}
              stroke="rgba(0,0,0,0.04)"
              strokeDasharray="4 4"
            />
          ))}

          {sortedPoints.length > 1 && (
            <>
              <SvgPath d={areaPath} fill="url(#weightGrad)" />
              <SvgPath d={linePath} stroke={COLORS.accent} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </>
          )}

          {sortedPoints.map((p, i) => {
            const isLast = i === sortedPoints.length - 1;
            return (
              <SvgCircle
                key={i}
                cx={toX(i)}
                cy={toY(p.weightKg)}
                r={isLast ? 6 : 4}
                fill={isLast ? COLORS.accent : COLORS.white}
                stroke={COLORS.accent}
                strokeWidth={isLast ? 3 : 2}
              />
            );
          })}
        </Svg>
        <View style={styles.graphFooterRow}>
          <Text style={styles.graphFooterText}>{fmtDate(firstPoint?.loggedAt || '')}</Text>
          <Text style={styles.graphFooterText}>{fmtDate(lastPoint?.loggedAt || '')}</Text>
        </View>
      </View>
    </View>
  );
};

const FoodItemCard = ({ item, color, onDelete, isDeleting }: any) => (
  <View style={styles.foodCard}>
    <TouchableOpacity 
      style={styles.foodDeleteBtn} 
      onPress={() => onDelete(item.mealId, item.itemId, item.name, item.calories)}
      disabled={isDeleting}
    >
      {isDeleting ? <ActivityIndicator size="small" color={COLORS.accent} /> : <X size={14} color={COLORS.textSub} />}
    </TouchableOpacity>
    <Text style={styles.foodName} numberOfLines={1}>{item.name}</Text>
    <View style={styles.foodFooter}>
       <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Flame size={12} color={color} strokeWidth={2.5} />
          <Text style={[styles.foodKcal, { color: color, transform: [{ translateY: 1 }] }]}>
            {item.calories} <Text style={{fontSize: 10, color: COLORS.textSub}}>kcal</Text>
          </Text>
       </View>
    </View>
  </View>
);

const MealGridSection = ({ type, title, icon: Icon, items, color, onAdd, onDelete, deletingId }: any) => (
  <View style={styles.sectionWrapper}>
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleGroup}>
        <View style={[styles.sectionIconBg, { backgroundColor: `${color}15` }]}>
          <Icon size={18} color={color} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <TouchableOpacity 
        style={[styles.sectionAddBtn, { backgroundColor: `${color}10` }]} 
        onPress={onAdd}
      >
        <Plus size={18} color={color} strokeWidth={3} />
      </TouchableOpacity>
    </View>

    <View style={styles.foodGrid}>
      {items.length > 0 ? (
        items.map((item: any) => (
          <FoodItemCard 
            key={item.itemId} 
            item={item} 
            color={color} 
            onDelete={onDelete} 
            isDeleting={deletingId === item.itemId}
          />
        ))
      ) : (
        <View style={styles.emptyGridPlaceholder}>
          <Text style={styles.emptyGridText}>No {title.toLowerCase()} logged</Text>
        </View>
      )}
    </View>
  </View>
);

export default function TodayActivityPage() {
  const { authFetch, isAuthenticated, accessToken, user } = useAuth();
  const router = useRouter();
  const { balance: points } = usePoints({ accessToken });
  const [activeTab, setActiveTab] = useState<'NUTRITION' | 'WEIGHT' | 'RUNNING'>('NUTRITION');
  
  // Data State
  const [mealSummary, setMealSummary] = useState<any>({ BREAKFAST: [], LUNCH: [], DINNER: [], SNACK: [] });
  const [macroTotals, setMacroTotals] = useState({ protein: 0, carbs: 0, fat: 0 });
  const [todayGoals, setTodayGoals] = useState({ calories: 2000, protein: 150, carbs: 250, fat: 70, steps: 10000, water: 8 });
  const [weeklyHistory, setWeeklyHistory] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [weeklyDayKeys, setWeeklyDayKeys] = useState<string[]>([]);
  const [currentWeight, setCurrentWeight] = useState<number | null>(null);
  const [weightHistory, setWeightHistory] = useState<WeightHistoryPoint[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Modals
  const [mealModalOpen, setMealModalOpen] = useState(false);
  const [weightModalOpen, setWeightModalOpen] = useState(false);
  const [activeMealType, setActiveMealType] = useState<MealType>('BREAKFAST');
  const [weightInput, setWeightInput] = useState('');

  // Scanning / Input State
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);
  const [scanStep, setScanStep] = useState<'camera' | 'manual' | 'analyzing' | 'results'>('camera');
  const [analyzedItems, setAnalyzedItems] = useState<any[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualKcal, setManualKcal] = useState('');
  const [isAnalyzingManual, setIsAnalyzingManual] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [runStats, setRunStats] = useState({
    totalRuns: 0,
    totalKm: 0,
    totalDurationMin: 0,
    totalCalories: 0,
    avgPaceSecPerKm: null as number | null,
    weekRuns: 0,
    weekKm: 0,
    longestRunKm: 0,
  });
  const [weeklyKmHistory, setWeeklyKmHistory] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [runGraphFilter, setRunGraphFilter] = useState<'WEEK' | 'MONTH'>('WEEK');
  const [monthlyKmHistory, setMonthlyKmHistory] = useState<{label: string, km: number}[]>([]);
  const { glassCount: waterIntake, setWaterTotal, reloadWater } = useWaterSync({ accessToken });

  const userKey = user?.id || user?.email || 'default-user';

  const getDayKeyForTimezone = useCallback((date: Date = new Date()) => {
    const timeZone = user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(date);
      const year = parts.find((p) => p.type === 'year')?.value;
      const month = parts.find((p) => p.type === 'month')?.value;
      const day = parts.find((p) => p.type === 'day')?.value;
      if (year && month && day) return `${year}-${month}-${day}`;
    } catch {
      // Fallback to device local date
    }
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [user?.timezone]);

  const bumpWeeklyHistoryForDay = useCallback((dayKey: string, calorieDelta: number) => {
    if (!Number.isFinite(calorieDelta) || calorieDelta === 0) return;

    setWeeklyHistory((prev) => {
      if (!Array.isArray(prev) || prev.length !== 7) return prev;
      const next = [...prev];

      let dayIdx = weeklyDayKeys.indexOf(dayKey);
      if (dayIdx < 0) {
        dayIdx = (new Date().getDay() + 6) % 7; // MON=0 fallback
      }
      if (dayIdx < 0 || dayIdx >= next.length) return prev;

      next[dayIdx] = Math.max(0, (Number(next[dayIdx]) || 0) + calorieDelta);
      return next;
    });
  }, [weeklyDayKeys]);

  const recalculateTodaySummary = useCallback(async (dayKeyOverride?: string) => {
    if (!isAuthenticated) return;
    try {
      await authFetch(`${API_BASE_URL}/summary/recalculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dayKey: dayKeyOverride || getDayKeyForTimezone(new Date()) }),
      });
    } catch (e) {
      console.warn('Summary recalculate failed after meal update', e);
    }
  }, [authFetch, getDayKeyForTimezone, isAuthenticated]);

  const applyMealsToUi = useCallback((rows: any[]) => {
    const grouped: any = { BREAKFAST: [], LUNCH: [], DINNER: [], SNACK: [] };
    let p = 0, c = 0, f = 0;

    rows.forEach((meal: any) => {
      p += meal.totalProteinG || 0;
      c += meal.totalCarbsG || 0;
      f += meal.totalFatG || 0;
      const type = meal.mealType?.toUpperCase();
      if (!grouped[type]) return;
      meal.items?.forEach((item: any) => {
        grouped[type].push({
          mealId: meal.serverMealId || meal.id || meal.clientMealId,
          itemId: item.id,
          name: item.foodName,
          calories: item.calories,
          time: new Date(meal.loggedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        });
      });
    });

    setMealSummary(grouped);
    setMacroTotals({ protein: p, carbs: c, fat: f });
  }, []);

  const loadLocalMealsForToday = useCallback(async () => {
    const dayKey = getDayKeyForTimezone(new Date());
    const localMeals = await getLocalMealsForDay(userKey, dayKey);
    applyMealsToUi(localMeals);
  }, [applyMealsToUi, getDayKeyForTimezone, userKey]);

  const syncPendingMeals = useCallback(async () => {
    if (!isAuthenticated || !isOnline) return;

    const pending = await getPendingLocalMeals(userKey);
    if (pending.length === 0) return;

    for (const meal of pending) {
      try {
        const resp = await authFetch(`${API_BASE_URL}/nutrition/meals`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientMealId: meal.clientMealId,
            mealType: meal.mealType,
            inputText: meal.inputText ?? undefined,
            hadImage: !!meal.hadImage,
            loggedAt: meal.loggedAt,
            items: meal.items.map((i) => ({
              foodName: i.foodName,
              calories: i.calories,
              proteinG: i.proteinG ?? null,
              carbsG: i.carbsG ?? null,
              fatG: i.fatG ?? null,
            })),
          }),
        });

        if (!resp.ok) continue;
        const saved = await resp.json();
        if (saved?.id && Array.isArray(saved?.items)) {
          // Rewrite local cached meal/items with server IDs so future deletes use valid IDs.
          await upsertLocalMeal({
            clientMealId: meal.clientMealId,
            userKey: meal.userKey,
            dayKey: meal.dayKey,
            mealType: meal.mealType,
            inputText: meal.inputText ?? null,
            hadImage: !!meal.hadImage,
            totalCalories: Number(saved.totalCalories ?? meal.totalCalories ?? 0),
            totalProteinG: saved.totalProteinG ?? meal.totalProteinG ?? null,
            totalCarbsG: saved.totalCarbsG ?? meal.totalCarbsG ?? null,
            totalFatG: saved.totalFatG ?? meal.totalFatG ?? null,
            loggedAt: saved.loggedAt || meal.loggedAt,
            synced: true,
            serverMealId: saved.id,
            createdAt: meal.createdAt,
            updatedAt: saved.updatedAt || new Date().toISOString(),
            items: (saved.items || []).map((it: any, idx: number) => ({
              id: String(it.id || `${meal.clientMealId}-srv-${idx}`),
              foodName: String(it.foodName || ''),
              calories: Number(it.calories) || 0,
              proteinG: it.proteinG ?? null,
              carbsG: it.carbsG ?? null,
              fatG: it.fatG ?? null,
            })),
          });
        }
        await markLocalMealSynced(userKey, meal.clientMealId, saved?.id);
      } catch {
        // Keep queued for next retry
      }
    }

    await loadLocalMealsForToday();
  }, [authFetch, isAuthenticated, isOnline, loadLocalMealsForToday, userKey]);

  const loadRunStats = useCallback(async () => {
    try {
      const runs = await loadRuns();
      const totalRuns = runs.length;
      const totalMeters = runs.reduce((sum, r) => sum + (r.totalDistanceMeters || 0), 0);
      const totalDurationSec = runs.reduce((sum, r) => sum + (r.durationSeconds || 0), 0);
      const totalCalories = runs.reduce(
        (sum, r) => sum + (r.calories || Math.round(((r.totalDistanceMeters || 0) / 1000) * 60)),
        0
      );

      const paceCandidates = runs.filter((r) => Number.isFinite(r.avgPaceSecPerKm as number) && (r.avgPaceSecPerKm as number) > 0);
      const avgPaceSecPerKm = paceCandidates.length
        ? Math.round(paceCandidates.reduce((sum, r) => sum + (r.avgPaceSecPerKm as number), 0) / paceCandidates.length)
        : null;

      const now = new Date();
      const monday = new Date(now);
      const dow = monday.getDay();
      const offset = dow === 0 ? -6 : 1 - dow;
      monday.setDate(monday.getDate() + offset);
      monday.setHours(0, 0, 0, 0);
      const mondayMs = monday.getTime();

      const weekRunsList = runs.filter((r) => new Date(r.startedAt).getTime() >= mondayMs);
      const weekRuns = weekRunsList.length;
      const weekKm = Math.round(
        weekRunsList.reduce((sum, r) => sum + (r.totalDistanceMeters || 0), 0) / 100
      ) / 10;

      const longestRunMeters = runs.length > 0 ? Math.max(...runs.map(r => r.totalDistanceMeters || 0)) : 0;

      // Calculate KM per day for the current week graph
      const kmPerDay = [0, 0, 0, 0, 0, 0, 0];
      weekRunsList.forEach(run => {
        const d = new Date(run.startedAt);
        const dayIdx = (d.getDay() + 6) % 7; // MON=0, SUN=6
        kmPerDay[dayIdx] += (run.totalDistanceMeters || 0) / 1000;
      });
      setWeeklyKmHistory(kmPerDay);

      // Calculate Monthly grouping for all time
      const monthlyMap = new Map<string, number>();
      runs.forEach(r => {
        const d = new Date(r.startedAt);
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthlyMap.set(k, (monthlyMap.get(k) || 0) + (r.totalDistanceMeters || 0) / 1000);
      });
      const sortedMonths = Array.from(monthlyMap.keys()).sort();
      const mHistory = sortedMonths.slice(-6).map(k => {
        const [y, m] = k.split('-');
        const d = new Date(parseInt(y), parseInt(m)-1, 1);
        return {
          label: d.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
          km: monthlyMap.get(k) || 0
        };
      });
      setMonthlyKmHistory(mHistory);

      setRunStats({
        totalRuns,
        totalKm: totalMeters / 1000,
        totalDurationMin: Math.round(totalDurationSec / 60),
        totalCalories,
        avgPaceSecPerKm,
        weekRuns,
        weekKm,
        longestRunKm: longestRunMeters / 1000,
      });
    } catch (e) {
      console.error('Run stats load error:', e);
    }
  }, []);

  const getHourInTimezone = useCallback((timeZone?: string) => {
    try {
      if (!timeZone) return new Date().getHours();
      const hourStr = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour: '2-digit',
        hour12: false,
      }).format(new Date());
      const parsed = parseInt(hourStr, 10);
      return Number.isFinite(parsed) ? parsed : new Date().getHours();
    } catch {
      return new Date().getHours();
    }
  }, []);

  const resolveCurrentMealType = useCallback((): MealType => {
    const tz = user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const hour = getHourInTimezone(tz);

    if (hour >= 5 && hour < 11) return 'BREAKFAST';
    if (hour >= 11 && hour < 16) return 'LUNCH';
    if (hour >= 16 && hour < 22) return 'DINNER';
    return 'SNACK';
  }, [getHourInTimezone, user?.timezone]);

  const ensureCameraAccess = useCallback(async () => {
    if (cameraPermission?.granted) return true;
    try {
      const result = await requestCameraPermission();
      return !!result.granted;
    } catch {
      return false;
    }
  }, [cameraPermission?.granted, requestCameraPermission]);

  const openMealLogger = useCallback(async (mealType: MealType) => {
    setActiveMealType(mealType);
    setScanStep('camera');
    setAnalyzedItems([]);
    setManualName('');
    setManualKcal('');
    setMealModalOpen(true);
    await ensureCameraAccess();
  }, [ensureCameraAccess]);

  const openLogFoodWithAutoMealType = useCallback(async () => {
    await openMealLogger(resolveCurrentMealType());
  }, [openMealLogger, resolveCurrentMealType]);

  const params = useLocalSearchParams();

  useEffect(() => {
    const action = parseStringParam(params.action);
    const tab = parseStringParam(params.tab);

    if (action === 'logFood') {
      const requestedMealType = parseMealTypeParam(params.mealType);
      if (requestedMealType) {
        openMealLogger(requestedMealType);
      } else {
        openLogFoodWithAutoMealType();
      }
      router.setParams({ action: undefined, mealType: undefined, t: undefined });
    }
    if (tab === 'RUNNING' || tab === 'WEIGHT' || tab === 'NUTRITION') {
      setActiveTab(tab as any);
      router.setParams({ tab: undefined });
    }
  }, [params.action, params.mealType, params.tab, openLogFoodWithAutoMealType, openMealLogger, router]);

  useEffect(() => {
    NetInfo.fetch().then((state) => {
      const online = !!state.isConnected && !!state.isInternetReachable;
      setIsOnline(online);
      if (online) syncPendingMeals();
    });
    const unsub = NetInfo.addEventListener((state) => {
      const online = !!state.isConnected && !!state.isInternetReachable;
      setIsOnline(online);
      if (online) {
        syncPendingMeals();
      }
    });
    return () => unsub();
  }, [syncPendingMeals]);

  const fetchData = useCallback(async () => {
    await loadLocalMealsForToday();
    await loadRunStats();
    if (!isAuthenticated) return;
    try {
      const [mealResp, weightResp, historyResp, weekResp] = await Promise.all([
        authFetch(`${API_BASE_URL}/nutrition/meals/today`),
        authFetch(`${API_BASE_URL}/weight`),
        authFetch(`${API_BASE_URL}/summary/nutrition-history`),
        authFetch(`${API_BASE_URL}/summary/week`)
      ]);

      if (mealResp.ok) {
        const json = await mealResp.json();
        const rows = Array.isArray(json) ? json : (json?.meals || []);
        const dayKey = getDayKeyForTimezone(new Date());
        await replaceSyncedLocalMealsForDay(
          userKey,
          dayKey,
          rows.map((meal: any) => ({
            clientMealId: meal.clientMealId || `srv-${meal.id}`,
            userKey,
            dayKey,
            mealType: meal.mealType,
            inputText: meal.inputText ?? null,
            hadImage: !!meal.hadImage,
            totalCalories: meal.totalCalories || 0,
            totalProteinG: meal.totalProteinG ?? null,
            totalCarbsG: meal.totalCarbsG ?? null,
            totalFatG: meal.totalFatG ?? null,
            loggedAt: meal.loggedAt || new Date().toISOString(),
            synced: true,
            serverMealId: meal.id || null,
            createdAt: meal.createdAt || new Date().toISOString(),
            updatedAt: meal.updatedAt || new Date().toISOString(),
            items: (meal.items || []).map((item: any) => ({
              id: item.id || `${meal.id || meal.clientMealId}-${item.foodName}-${item.calories}`,
              foodName: item.foodName,
              calories: item.calories,
              proteinG: item.proteinG ?? null,
              carbsG: item.carbsG ?? null,
              fatG: item.fatG ?? null,
            })),
          }))
        );
        await loadLocalMealsForToday();

        if (json?.goals) {
          setTodayGoals(prev => ({ ...prev, ...json.goals }));
        }
      }

      if (historyResp.ok) {
        const historyJson = await historyResp.json();
        if (Array.isArray(historyJson)) {
          setWeeklyHistory(historyJson.map((h: any) => Number(h?.calories) || 0));
          setWeeklyDayKeys(historyJson.map((h: any) => String(h?.day || '')));
        }
      }

      if (weekResp.ok) {
        const weekJson = await weekResp.json();
        const currentWeek = Number(weekJson?.currentWeek);
        const todayDayKey = getDayKeyForTimezone(new Date());
        const todayDayOfWeek = dayOfWeekFromDayKey(todayDayKey);

        if (Number.isFinite(currentWeek) && currentWeek > 0 && Number.isInteger(todayDayOfWeek)) {
          const dailyPlanResp = await authFetch(`${API_BASE_URL}/plan/daily/${currentWeek}`);
          if (dailyPlanResp.ok) {
            const dailyPlanJson = await dailyPlanResp.json();
            const todayPlan = Array.isArray(dailyPlanJson?.days)
              ? dailyPlanJson.days.find((day: any) => Number(day?.dayOfWeek) === todayDayOfWeek)
              : null;
            const caloriesTarget = Number(todayPlan?.calorieTarget);
            if (Number.isFinite(caloriesTarget) && caloriesTarget > 0) {
              setTodayGoals(prev => ({ ...prev, calories: caloriesTarget }));
            }
          }
        }
      }

      if (weightResp.ok) {
        const json = await weightResp.json();
        setCurrentWeight(json.currentWeight);
        setWeightHistory(Array.isArray(json.history) ? json.history : []);
      }
    } catch (e) {
      console.error('Activity Data Fetch Error:', e);
    }
  }, [authFetch, getDayKeyForTimezone, isAuthenticated, loadLocalMealsForToday, loadRunStats, userKey]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
      reloadWater();
    }, [fetchData, reloadWater])
  );

  const handleDelete = async (mealId: string, itemId: string, itemName?: string, itemCalories?: number) => {
    if (!mealId || !itemId) return;
    setDeletingId(itemId);
    try {
      let deletedLocally = false;

      if (isOnline) {
        let resp = await authFetch(`${API_BASE_URL}/nutrition/meals/${mealId}/items/${itemId}`, { method: "DELETE" });
        if (resp.ok) {
          await recalculateTodaySummary();
          await fetchData();
          return;
        }

        // If local cache has stale meal/item IDs, resolve current server IDs and retry.
        if (resp.status === 404 && itemName) {
          try {
            const mealsResp = await authFetch(`${API_BASE_URL}/nutrition/meals/today`);
            if (mealsResp.ok) {
              const json = await mealsResp.json();
              const rows = Array.isArray(json) ? json : (json?.meals || []);
              const exactServerMeal = rows.find((m: any) => (m?.id === mealId));

              const findMatchInMeal = (serverMeal: any) => serverMeal?.items?.find((it: any) =>
                String(it?.foodName || '').trim().toLowerCase() === String(itemName).trim().toLowerCase() &&
                Number(it?.calories) === Number(itemCalories ?? NaN)
              ) || serverMeal?.items?.find((it: any) =>
                String(it?.foodName || '').trim().toLowerCase() === String(itemName).trim().toLowerCase()
              );

              let serverMeal = exactServerMeal;
              let serverMatch = findMatchInMeal(serverMeal);

              // If mealId is local/stale, search across all today's meals for the item.
              if (!serverMatch) {
                for (const candidate of rows) {
                  const candidateMatch = findMatchInMeal(candidate);
                  if (candidateMatch) {
                    serverMeal = candidate;
                    serverMatch = candidateMatch;
                    break;
                  }
                }
              }

              if (serverMeal?.id && serverMatch?.id) {
                resp = await authFetch(`${API_BASE_URL}/nutrition/meals/${serverMeal.id}/items/${serverMatch.id}`, { method: "DELETE" });
                if (resp.ok) {
                  await recalculateTodaySummary();
                  await fetchData();
                  return;
                }
              }
            }
          } catch {
            // continue to local fallback below
          }
        }

        // Fallback for local/unsynced items (or ID mismatch against local cache)
        deletedLocally = await deleteLocalMealItem(userKey, mealId, itemId);
        if (!deletedLocally) {
          const errText = await resp.text().catch(() => '');
          Alert.alert('Delete Failed', errText || 'Could not delete this food item.');
          return;
        }
      } else {
        deletedLocally = await deleteLocalMealItem(userKey, mealId, itemId);
        if (!deletedLocally) {
          Alert.alert('Delete Failed', 'Could not delete this local food item.');
          return;
        }
      }

      await loadLocalMealsForToday();
    } finally { setDeletingId(null); }
  };

  const handleUpdateWater = async (glasses: number) => {
    try {
      await setWaterTotal(glasses * 250);
    } catch (e) { console.error('Water Update Error:', e); }
  };

  const handleLogWeight = async () => {
    const weight = parseFloat(weightInput);
    if (isNaN(weight) || weight <= 0) return;
    try {
      await authFetch(`${API_BASE_URL}/weight`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weightKg: weight }),
      });
      setWeightModalOpen(false);
      fetchData();
    } catch (e) { Alert.alert('Error', 'Failed to log weight'); }
  };

  // Scanning Handlers
  const handleCapture = async () => {
    const hasCameraAccess = await ensureCameraAccess();
    if (!hasCameraAccess) {
      Alert.alert('Camera Access Needed', 'Allow camera access to scan your meal, or use manual entry instead.');
      return;
    }
    if (!cameraRef.current || isCapturing) return;
    if (!isOnline) {
      Alert.alert('No Internet', 'Unable to run AI food analysis while offline. Enter calories manually to save offline.');
      return;
    }
    try {
      setIsCapturing(true);
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      setScanStep('analyzing');
      const manip = await ImageManipulator.manipulateAsync(photo.uri, [{ resize: { width: 900 } }], { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG });
      const formData = new FormData();
      formData.append('mealType', activeMealType);
      formData.append('image', { uri: manip.uri, type: 'image/jpeg', name: 'food.jpg' } as any);
      const resp = await authFetch(`${API_BASE_URL}/nutrition/meals/analyze`, { method: 'POST', body: formData });
      const result = await resp.json();
      setAnalyzedItems(result.items || []);
      setScanStep('results');
    } catch (e: any) {
      setScanStep('camera');
      Alert.alert('Analysis Failed', e.message);
    } finally { setIsCapturing(false); }
  };

  const handleManualIdentify = async () => {
    if (!manualName.trim()) return;
    if (manualKcal) {
       setAnalyzedItems([{ foodName: manualName.trim(), calories: parseInt(manualKcal, 10) }]);
       setScanStep('results');
       return;
    }
    if (!isOnline) {
      Alert.alert('No Internet', 'Unable to pull AI estimate while offline. Enter calories manually to save this food.');
      return;
    }
    setIsAnalyzingManual(true);
    setScanStep('analyzing');
    try {
      const formData = new FormData();
      formData.append('mealType', activeMealType);
      formData.append('text', manualName.trim());
      const resp = await authFetch(`${API_BASE_URL}/nutrition/meals/analyze`, { method: 'POST', body: formData });
      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(errText || 'Failed to analyze manual input');
      }
      const result = await resp.json();
      setAnalyzedItems(result.items || []);
      setScanStep('results');
    } catch (e: any) {
      setScanStep('manual');
      Alert.alert('Analysis Failed', e?.message || 'Could not analyze this food. Try again.');
    } finally { setIsAnalyzingManual(false); }
  };

  const handleSaveMeal = async () => {
    if (!analyzedItems.length) return;
    setIsSaving(true);
    try {
      const now = new Date();
      const nowIso = now.toISOString();
      const dayKey = getDayKeyForTimezone(now);
      const clientMealId = Crypto.randomUUID();
      const normalizedItems = analyzedItems.map((item: any, idx: number) => ({
        id: `${clientMealId}-i${idx}`,
        foodName: String(item.foodName || item.name || '').trim(),
        calories: Number(item.calories) || 0,
        proteinG: item.proteinG ?? null,
        carbsG: item.carbsG ?? null,
        fatG: item.fatG ?? null,
      })).filter((i: any) => i.foodName && i.calories >= 0);

      const totals = normalizedItems.reduce((acc: any, item: any) => {
        acc.calories += item.calories || 0;
        acc.protein += item.proteinG || 0;
        acc.carbs += item.carbsG || 0;
        acc.fat += item.fatG || 0;
        return acc;
      }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

      await upsertLocalMeal({
        clientMealId,
        userKey,
        dayKey,
        mealType: activeMealType,
        inputText: manualName.trim() || null,
        hadImage: scanStep === 'results' && !manualName.trim(),
        totalCalories: totals.calories,
        totalProteinG: totals.protein || null,
        totalCarbsG: totals.carbs || null,
        totalFatG: totals.fat || null,
        loggedAt: nowIso,
        synced: false,
        serverMealId: null,
        createdAt: nowIso,
        updatedAt: nowIso,
        items: normalizedItems,
      });

      await loadLocalMealsForToday();
      bumpWeeklyHistoryForDay(dayKey, totals.calories);
      setMealModalOpen(false);
      setScanStep('camera');
      setManualName('');
      setManualKcal('');
      setAnalyzedItems([]);

      if (isOnline) {
        await syncPendingMeals();
        await recalculateTodaySummary(dayKey);
        await fetchData();
      } else {
        Alert.alert('Saved Offline', 'Food saved locally and will sync when internet is back.');
      }
    } catch (e) { Alert.alert('Error', 'Failed to save meal locally'); }
    finally { setIsSaving(false); }
  };

  const totalKcal = Object.keys(mealSummary).reduce((sum, key) => sum + mealSummary[key].reduce((s: number, i: any) => s + i.calories, 0), 0);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <StatusBar barStyle="light-content" />
      
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        
        {/* SOLID HERO SECTION WITH LOG FOOD BUTTON */}
        <View style={styles.heroWrapper}>
          <View style={[styles.heroGradient, { backgroundColor: COLORS.bgPink }]}>
            <View style={styles.topNav}>
               <View>
                 <Text style={styles.navDate}>{new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', weekday: 'short' }).toUpperCase()}</Text>
                 <Text style={styles.navTitle}>Activity</Text>
               </View>
               <View style={styles.headerRightRow}>
                 <View style={styles.pointsSection}>
                    <Heart size={14} color="#FFF" fill="#FFF" />
                    <Text style={styles.pointsTextCombined}>{points.toLocaleString()}</Text>
                 </View>
                 <TouchableOpacity style={styles.profileBtn}>
                    <User size={20} color={COLORS.bgPink} />
                 </TouchableOpacity>
               </View>
            </View>

            {activeTab === 'RUNNING' ? (
              <View style={styles.heroSummaryBox}>
                <View style={styles.summaryTopRow}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={styles.summaryLabel}>{runGraphFilter === 'WEEK' ? 'WEEKLY' : 'MONTHLY'} DISTANCE</Text>
                      <View style={styles.runGraphFilterToggle}>
                        <TouchableOpacity 
                          onPress={() => setRunGraphFilter('WEEK')}
                          style={[styles.filterToggleBtn, runGraphFilter === 'WEEK' && styles.filterToggleBtnActive]}
                        >
                          <Text style={[styles.filterToggleText, runGraphFilter === 'WEEK' && styles.filterToggleTextActive]}>W</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          onPress={() => setRunGraphFilter('MONTH')}
                          style={[styles.filterToggleBtn, runGraphFilter === 'MONTH' && styles.filterToggleBtnActive]}
                        >
                          <Text style={[styles.filterToggleText, runGraphFilter === 'MONTH' && styles.filterToggleTextActive]}>M</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    <View style={styles.summaryValRow}>
                        <Activity size={20} color={COLORS.white} style={{ marginRight: 6, marginBottom: 2 }} />
                        <Text style={styles.summaryValueText}>
                          {runGraphFilter === 'WEEK' ? runStats.weekKm.toFixed(1) : runStats.totalKm.toFixed(1)}
                        </Text>
                        <Text style={styles.summaryUnitText}> km {runGraphFilter === 'WEEK' ? 'week' : 'total'}</Text>
                    </View>
                  </View>
                </View>
                <View style={{ height: 60, marginTop: 15, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                  {runGraphFilter === 'WEEK' ? (
                    weeklyKmHistory.map((km, i) => {
                      const maxKm = Math.max(...weeklyKmHistory, 5);
                      const h = Math.max((km / maxKm) * 40, 4);
                      const isToday = i === (new Date().getDay() + 6) % 7;
                      return (
                        <View key={i} style={{ alignItems: 'center' }}>
                          <View style={{ 
                            height: h, 
                            width: 8, 
                            backgroundColor: isToday ? COLORS.white : 'rgba(255,255,255,0.4)', 
                            borderRadius: 4 
                          }} />
                          <Text style={{ 
                            color: isToday ? COLORS.white : 'rgba(255,255,255,0.6)', 
                            fontSize: 8, 
                            fontWeight: '800', 
                            marginTop: 4 
                          }}>
                            {['M','T','W','T','F','S','S'][i]}
                          </Text>
                        </View>
                      );
                    })
                  ) : (
                    monthlyKmHistory.map((m, i) => {
                      const maxKm = Math.max(...monthlyKmHistory.map(mx => mx.km), 5);
                      const h = Math.max((m.km / maxKm) * 40, 4);
                      return (
                        <View key={i} style={{ alignItems: 'center' }}>
                          <View style={{ 
                            height: h, 
                            width: 14, 
                            backgroundColor: i === monthlyKmHistory.length - 1 ? COLORS.white : 'rgba(255,255,255,0.4)', 
                            borderRadius: 4 
                          }} />
                          <Text style={{ 
                            color: i === monthlyKmHistory.length - 1 ? COLORS.white : 'rgba(255,255,255,0.6)', 
                            fontSize: 8, 
                            fontWeight: '800', 
                            marginTop: 4 
                          }}>
                            {m.label}
                          </Text>
                        </View>
                      );
                    })
                  )}
                </View>
              </View>
            ) : (
              <View style={styles.heroSummaryBox}>
                <View style={styles.summaryTopRow}>
                   <View>
                     <Text style={styles.summaryLabel}>TOTAL LOGGED TODAY</Text>
                     <View style={styles.summaryValRow}>
                         <Flame size={20} color={COLORS.white} style={{ marginRight: 6, marginBottom: 2 }} />
                         <Text style={styles.summaryValueText}>{totalKcal}</Text>
                         <Text style={styles.summaryUnitText}> kcal</Text>
                     </View>
                   </View>
                   <TouchableOpacity 
                     style={styles.logFoodHeroBtn} 
                     onPress={openLogFoodWithAutoMealType}
                   >
                     <Scan size={18} color={COLORS.bgPink} strokeWidth={3} />
                     <Text style={styles.logFoodHeroText}>LOG FOOD</Text>
                   </TouchableOpacity>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryBottomRow}>
                   <View style={styles.miniStatItem}>
                      <Text style={styles.miniStatLabel}>PROTEIN</Text>
                      <Text style={styles.miniStatVal}>{Math.round(macroTotals.protein)}g</Text>
                   </View>
                   <View style={styles.miniStatItem}>
                      <Text style={styles.miniStatLabel}>CARBS</Text>
                      <Text style={styles.miniStatVal}>{Math.round(macroTotals.carbs)}g</Text>
                   </View>
                   <View style={styles.miniStatItem}>
                      <Text style={styles.miniStatLabel}>FAT</Text>
                      <Text style={styles.miniStatVal}>{Math.round(macroTotals.fat)}g</Text>
                   </View>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* TAB SWITCHER */}
        <View style={styles.tabBarWrapper}>
           <View style={styles.tabBar}>
              <TouchableOpacity 
                style={[styles.tabItem, activeTab === 'NUTRITION' && styles.activeTabItem]}
                onPress={() => { LayoutAnimation.easeInEaseOut(); setActiveTab('NUTRITION'); }}
              >
                 <Text style={[styles.tabText, activeTab === 'NUTRITION' && styles.activeTabText]}>Nutrition</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.tabItem, activeTab === 'WEIGHT' && styles.activeTabItem]}
                onPress={() => { LayoutAnimation.easeInEaseOut(); setActiveTab('WEIGHT'); }}
              >
                 <Text style={[styles.tabText, activeTab === 'WEIGHT' && styles.activeTabText]}>Weight & Body</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.tabItem, activeTab === 'RUNNING' && styles.activeTabItem]}
                onPress={() => { LayoutAnimation.easeInEaseOut(); setActiveTab('RUNNING'); }}
              >
                 <Text style={[styles.tabText, activeTab === 'RUNNING' && styles.activeTabText]}>Running</Text>
              </TouchableOpacity>
           </View>
        </View>

        {activeTab === 'NUTRITION' ? (
          <View style={styles.mainPadding}>
            
            {/* PREMIUM WEEKLY HISTORY GRAPH */}
            <WeeklyBarGraph data={weeklyHistory} target={todayGoals.calories} dayKeys={weeklyDayKeys} />

            {/* MEALS GRID */}
            <MealGridSection 
              type="BREAKFAST" title="Breakfast" icon={Coffee} color={COLORS.secondary} 
              items={mealSummary.BREAKFAST} onAdd={() => { openMealLogger('BREAKFAST'); }}
              onDelete={handleDelete} deletingId={deletingId}
            />
            <MealGridSection 
              type="LUNCH" title="Lunch" icon={Utensils} color={COLORS.afternoon} 
              items={mealSummary.LUNCH} onAdd={() => { openMealLogger('LUNCH'); }}
              onDelete={handleDelete} deletingId={deletingId}
            />
            <MealGridSection 
              type="DINNER" title="Dinner" icon={Moon} color={COLORS.evening} 
              items={mealSummary.DINNER} onAdd={() => { openMealLogger('DINNER'); }}
              onDelete={handleDelete} deletingId={deletingId}
            />
            <MealGridSection 
              type="SNACK" title="Snacks" icon={Cookie} color={COLORS.accent} 
              items={mealSummary.SNACK} onAdd={() => { openMealLogger('SNACK'); }}
              onDelete={handleDelete} deletingId={deletingId}
            />

            {/* WATER SECTION */}
            <View style={styles.waterGlassCard}>
               <View style={styles.waterHeader}>
                  <View style={styles.waterIconCircle}>
                     <Droplets size={24} color={COLORS.water} />
                  </View>
                  <View>
                     <Text style={styles.waterSectionTitle}>Hydration Tracking</Text>
                     <Text style={styles.waterSectionSub}>{waterIntake} of {todayGoals.water} glasses</Text>
                  </View>
               </View>
               <View style={styles.waterDropletsRow}>
                  {[...Array(todayGoals.water)].map((_, i) => (
                    <TouchableOpacity key={i} onPress={() => handleUpdateWater(i + 1)} style={styles.waterBtn}>
                       <Droplets size={26} color={i < waterIntake ? COLORS.water : '#E2E8F0'} fill={i < waterIntake ? COLORS.water : 'transparent'} />
                    </TouchableOpacity>
                  ))}
               </View>
            </View>
          </View>
        ) : activeTab === 'RUNNING' ? (
          <View style={styles.mainPadding}>
            <View style={styles.sectionWrapper}>
               {/* Running Stats Grid */}

              <View style={styles.runStatsGrid}>
                 <View style={styles.runStatBox}>
                    <Text style={styles.runStatLabel}>TOTAL RUNS</Text>
                    <Text style={styles.runStatValue}>{runStats.totalRuns}</Text>
                 </View>
                 <View style={styles.runStatBox}>
                    <Text style={styles.runStatLabel}>TOTAL KM</Text>
                    <Text style={styles.runStatValue}>{runStats.totalKm.toFixed(1)}</Text>
                 </View>
                 <View style={styles.runStatBox}>
                    <Text style={styles.runStatLabel}>THIS WEEK</Text>
                    <Text style={styles.runStatValue}>{runStats.weekRuns} runs</Text>
                    <Text style={styles.runStatSub}>{runStats.weekKm.toFixed(1)} km</Text>
                 </View>
                 <View style={styles.runStatBox}>
                    <Text style={styles.runStatLabel}>DURATION</Text>
                    <Text style={styles.runStatValue}>{runStats.totalDurationMin} min</Text>
                 </View>
                 <View style={styles.runStatBox}>
                    <Text style={styles.runStatLabel}>AVG PACE</Text>
                    <Text style={styles.runStatValue}>
                      {runStats.avgPaceSecPerKm
                        ? `${Math.floor(runStats.avgPaceSecPerKm / 60)}:${String(runStats.avgPaceSecPerKm % 60).padStart(2, '0')} /km`
                        : '--'}
                    </Text>
                 </View>
                  <View style={styles.runStatBox}>
                    <Text style={styles.runStatLabel}>LONGEST RUN</Text>
                    <Text style={styles.runStatValue}>{runStats.longestRunKm.toFixed(2)} km</Text>
                 </View>
                 <View style={styles.runStatBox}>
                    <Text style={styles.runStatLabel}>CALORIES</Text>
                    <Text style={styles.runStatValue}>{runStats.totalCalories}</Text>
                 </View>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.mainPadding}>
            {/* WEIGHT CARD */}
            <TouchableOpacity style={styles.weightSplashCard} onPress={() => { setWeightInput(currentWeight?.toString() || ''); setWeightModalOpen(true); }}>
               <Text style={styles.weightSplashLabel}>CURRENT BODY WEIGHT</Text>
               <Text style={styles.weightSplashValue}>{currentWeight?.toFixed(1) || '--'} <Text style={{ fontSize: 24, color: COLORS.textSub }}>kg</Text></Text>
               <View style={[styles.weightBadge, { backgroundColor: COLORS.successFade }]}>
                  <Text style={[styles.weightBadgeText, { color: COLORS.success }]}>Track Progress</Text>
                  <ChevronRight size={14} color={COLORS.success} />
               </View>
            </TouchableOpacity>

            <WeightHistoryGraph history={weightHistory} />

            <View style={styles.runStatsGrid}>
               <View style={styles.runStatBox}>
                  <Text style={styles.runStatLabel}>DAILY STEPS</Text>
                  <Text style={styles.runStatValue}>{todayGoals.steps.toLocaleString()}</Text>
               </View>
               <View style={styles.runStatBox}>
                  <Text style={styles.runStatLabel}>WATER GOAL</Text>
                  <Text style={styles.runStatValue}>{todayGoals.water}</Text>
               </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* --- MEAL LOG MODAL --- */}
      <Modal visible={mealModalOpen} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.popUpBackdrop}>
            <View style={styles.popUpCard}>
              <View style={styles.modalDragHandle} />
              <View style={styles.popUpHeader}>
                <View>
                  <Text style={styles.popUpPreTitle}>LOG {activeMealType}</Text>
                  <Text style={styles.popUpTitle}>{scanStep === 'results' ? 'Check Results' : 'Add Food'}</Text>
                </View>
                <TouchableOpacity style={styles.popUpCloseBtn} onPress={() => { setMealModalOpen(false); setScanStep('camera'); }}>
                  <X size={20} color={COLORS.textMain} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 500 }}>
                 {scanStep === 'camera' && (
                   <View>
                      <View style={styles.cameraBox}>
                         {cameraPermission?.granted ? (
                           <>
                              <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
                              <View style={styles.cameraFrameOverlay}>
                                 <View style={styles.scanTarget} />
                              </View>
                           </>
                         ) : (
                           <View style={styles.cameraFallback}>
                              {!cameraPermission ? (
                                <>
                                  <ActivityIndicator size="large" color="#FFF" />
                                  <Text style={styles.cameraFallbackTitle}>Preparing camera...</Text>
                                </>
                              ) : (
                                <>
                                  <Camera size={36} color="#FFF" />
                                  <Text style={styles.cameraFallbackTitle}>Camera access is required</Text>
                                  <Text style={styles.cameraFallbackText}>
                                    Allow camera permission to scan your meal photo.
                                  </Text>
                                  {cameraPermission.canAskAgain && (
                                    <TouchableOpacity style={styles.cameraPermissionBtn} onPress={ensureCameraAccess}>
                                      <Text style={styles.cameraPermissionBtnText}>Enable Camera</Text>
                                    </TouchableOpacity>
                                  )}
                                </>
                              )}
                           </View>
                         )}
                      </View>
                      <View style={styles.cameraActions}>
                         <TouchableOpacity style={styles.manualSwitchBtn} onPress={() => setScanStep('manual')}>
                            <KeyboardIcon size={20} color={COLORS.textMain} />
                            <Text style={styles.manualSwitchText}>Type manually</Text>
                         </TouchableOpacity>
                         <TouchableOpacity style={styles.mainShutterBtn} onPress={handleCapture} disabled={isCapturing || !cameraPermission?.granted}>
                            {isCapturing ? <ActivityIndicator color="#FFF" /> : <View style={styles.shutterIn} />}
                         </TouchableOpacity>
                      </View>
                   </View>
                 )}

                 {scanStep === 'manual' && (
                   <View style={styles.formContainer}>
                      <Text style={styles.inputLabel}>FOOD NAME</Text>
                      <TextInput style={styles.manualInput} placeholder="e.g. Greek Salad" value={manualName} onChangeText={setManualName} autoFocus />
                      <Text style={styles.inputLabel}>CALORIES (OPTIONAL)</Text>
                      <TextInput style={styles.manualInput} placeholder="Leave empty for AI estimate" value={manualKcal} onChangeText={setManualKcal} keyboardType="numeric" />
                      <TouchableOpacity style={styles.startRunBtn} onPress={handleManualIdentify} disabled={isAnalyzingManual}>
                         {isAnalyzingManual ? <ActivityIndicator color="#FFF" /> : <Text style={styles.startRunBtnText}>IDENTIFY MEAL</Text>}
                      </TouchableOpacity>
                      <TouchableOpacity style={{ alignSelf: 'center', marginTop: 16 }} onPress={() => setScanStep('camera')}>
                         <Text style={{ color: COLORS.accent, fontWeight: '800' }}>Back to Camera</Text>
                      </TouchableOpacity>
                   </View>
                 )}

                 {scanStep === 'analyzing' && (
                    <View style={styles.analyzingBox}>
                       <ActivityIndicator size="large" color={COLORS.accent} />
                       <Text style={styles.analyzingText}>AI is thinking...</Text>
                    </View>
                 )}

                 {scanStep === 'results' && (
                   <View style={styles.resultsContainer}>
                      {analyzedItems.map((item, i) => (
                        <View key={i} style={styles.resultRowItem}>
                           <View style={{ flex: 1 }}>
                              <Text style={styles.resultItemName}>{item.foodName}</Text>
                              <Text style={styles.resultItemSub}>{item.grams || 100}g estimated</Text>
                           </View>
                           <TextInput style={styles.kcalResultInput} value={String(item.calories)} keyboardType="numeric" onChangeText={(v) => {
                             const up = [...analyzedItems];
                             up[i].calories = parseInt(v) || 0;
                             setAnalyzedItems(up);
                           }} />
                           <Text style={styles.kcalUnitTag}>KCAL</Text>
                        </View>
                      ))}
                      <TouchableOpacity style={styles.startRunBtn} onPress={handleSaveMeal} disabled={isSaving}>
                         {isSaving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.startRunBtnText}>SAVE LOG</Text>}
                      </TouchableOpacity>
                   </View>
                 )}
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* --- WEIGHT MODAL --- */}
      <Modal visible={weightModalOpen} animationType="fade" transparent>
         <KeyboardAvoidingView
           behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
           keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
           style={{ flex: 1 }}
         >
           <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.popUpBackdrop}>
                 <View style={styles.popUpCard}>
                    <View style={styles.modalDragHandle} />
                    <View style={styles.popUpHeader}>
                      <View>
                        <Text style={styles.popUpPreTitle}>VITALS</Text>
                        <Text style={styles.popUpTitle}>Update Weight</Text>
                      </View>
                      <TouchableOpacity style={styles.popUpCloseBtn} onPress={() => setWeightModalOpen(false)}>
                        <X size={20} color={COLORS.textMain} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.weightEntryArea}>
                       <TextInput style={styles.bigWeightInput} value={weightInput} onChangeText={setWeightInput} keyboardType="numeric" autoFocus />
                       <Text style={styles.weightUnitLabel}>Kilograms</Text>
                    </View>
                    <TouchableOpacity style={styles.startRunBtn} onPress={handleLogWeight}>
                       <Text style={styles.startRunBtnText}>SAVE WEIGHT</Text>
                    </TouchableOpacity>
                 </View>
              </View>
           </TouchableWithoutFeedback>
         </KeyboardAvoidingView>
      </Modal>

    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  heroWrapper: {
    overflow: 'hidden',
    borderBottomLeftRadius: 44,
    borderBottomRightRadius: 44,
  },
  heroGradient: {
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  topNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  navDate: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.glassWhite,
    letterSpacing: 2,
  },
  navTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.white,
    marginTop: 4,
  },
  profileBtn: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pointsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  pointsTextCombined: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 14,
  },
  heroSummaryBox: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 28,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  summaryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logFoodHeroBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  logFoodHeroText: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.bgPink,
    letterSpacing: 0.5,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.glassWhite,
    letterSpacing: 1.5,
  },
  summaryValRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  summaryValueText: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.white,
  },
  summaryUnitText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.glassWhite,
    marginLeft: 4,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 12,
  },
  summaryBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  miniStatItem: {
    alignItems: 'flex-start',
  },
  miniStatLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.glassWhite,
    letterSpacing: 1,
    marginBottom: 2,
  },
  miniStatVal: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.white,
  },
  tabBarWrapper: {
    paddingHorizontal: 40,
    marginTop: -16,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: 100,
    padding: 4,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 8,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 100,
  },
  activeTabItem: {
    backgroundColor: COLORS.accent,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textSub,
  },
  activeTabText: {
    color: COLORS.white,
  },
  mainPadding: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  premiumGraphContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 22,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#ECEFF3',
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  kcalGraphHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 12,
  },
  kcalGraphEyebrow: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  kcalGraphTitle: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: -0.2,
  },
  kcalGraphMeta: {
    alignItems: 'flex-end',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  kcalGraphMetaLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  kcalGraphMetaValue: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  graphHeaderPremium: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  graphTitleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  graphIconInner: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 107, 107, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  graphTitlePremium: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.textMain,
    letterSpacing: 0.5,
  },
  graphSubPremium: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textSub,
    marginTop: 1,
  },
  targetBadge: {
    backgroundColor: COLORS.successFade,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  targetBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.success,
  },
  graphBody: {
    height: 74,
    justifyContent: 'flex-end',
    position: 'relative',
    width: '100%',
  },
  graphFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: 8,
  },
  graphFooterText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSub,
  },
  barsRowPremium: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 0,
    width: '100%',
  },
  weeklyLineOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 18,
    zIndex: 2,
  },
  barColPremium: {
    alignItems: 'center',
    width: 32,
  },
  barContainerPremium: {
    height: 64,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  targetLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 0,
    borderTopWidth: 1,
    borderColor: 'rgba(0, 184, 148, 0.4)',
    borderStyle: 'dashed',
    zIndex: 1,
  },
  targetLineLabel: {
    position: 'absolute',
    right: 0,
    top: -16,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.14)',
  },
  targetLineText: {
    fontSize: 9,
    fontWeight: '900',
    color: COLORS.success,
    letterSpacing: 0.4,
  },
  barFillPremium: {
    width: 10,
    borderRadius: 999,
  },
  barFillWarning: {
    shadowColor: '#EF4444',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  barDayTextPremium: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.textSub,
    marginTop: 10,
    letterSpacing: 0.3,
  },
  todayDayText: {
    color: COLORS.accent,
    fontWeight: '900',
  },
  sectionWrapper: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionIconBg: {
    width: 38,
    height: 38,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.textMain,
  },
  sectionAddBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  foodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_SPACING,
  },
  foodCard: {
    width: ITEM_WIDTH,
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  foodDeleteBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 1,
  },
  foodName: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textMain,
    marginBottom: 8,
    marginRight: 10,
  },
  foodFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  foodKcal: {
    fontSize: 18,
    fontWeight: '900',
  },
  emptyGridPlaceholder: {
    width: '100%',
    height: 80,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#F1F3F5',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyGridText: {
    color: COLORS.textSub,
    fontWeight: '600',
  },
  waterGlassCard: {
    backgroundColor: COLORS.white,
    borderRadius: 32,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  waterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
  },
  waterIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 20,
    backgroundColor: '#F0F9FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  waterSectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.textMain,
  },
  waterSectionSub: {
    fontSize: 13,
    color: COLORS.textSub,
    fontWeight: '600',
  },
  waterDropletsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  waterBtn: {
    padding: 2,
  },
  weightSplashCard: {
    backgroundColor: COLORS.white,
    borderRadius: 36,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.line,
    marginBottom: 24,
  },
  weightSplashLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textSub,
    letterSpacing: 2,
  },
  weightSplashValue: {
    fontSize: 80,
    fontWeight: '900',
    color: COLORS.textMain,
    marginVertical: 10,
  },
  weightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  weightBadgeText: {
    fontSize: 14,
    fontWeight: '800',
  },
  runStatsGrid: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  runStatBox: {
    width: '47%',
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  runStatLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textSub,
    marginBottom: 4,
  },
  runStatValue: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.textMain,
  },
  runStatSub: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSub,
    marginTop: 4,
  },

  // Modal Specifics
  popUpBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  popUpCard: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: 24,
    paddingBottom: 40,
  },
  modalDragHandle: {
    width: 40, height: 4, backgroundColor: '#E9ECEF', borderRadius: 2, alignSelf: 'center', marginBottom: 20,
  },
  popUpHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  popUpPreTitle: { fontSize: 12, fontWeight: '800', color: COLORS.textSub, letterSpacing: 1.5, marginBottom: 4 },
  popUpTitle: { fontSize: 26, fontWeight: '900', color: COLORS.textMain },
  popUpCloseBtn: { padding: 8, backgroundColor: '#F8F9FA', borderRadius: 20 },
  startRunBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.accent, paddingVertical: 18, borderRadius: 24, gap: 12,
  },
  startRunBtnText: { color: '#FFF', fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  cameraBox: { height: 360, backgroundColor: '#000', borderRadius: 28, overflow: 'hidden', marginBottom: 20 },
  cameraFrameOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  cameraFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 12,
    backgroundColor: '#111',
  },
  cameraFallbackTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.white,
    textAlign: 'center',
  },
  cameraFallbackText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    lineHeight: 20,
  },
  cameraPermissionBtn: {
    marginTop: 4,
    backgroundColor: COLORS.accent,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 16,
  },
  cameraPermissionBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  scanTarget: { width: 220, height: 220, borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)', borderRadius: 24 },
  cameraActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  manualSwitchBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F8F9FA', padding: 12, borderRadius: 16 },
  manualSwitchText: { fontSize: 14, fontWeight: '800', color: COLORS.textMain },
  mainShutterBtn: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#FFF', padding: 6, borderWidth: 3, borderColor: COLORS.accent },
  shutterIn: { flex: 1, borderRadius: 30, backgroundColor: COLORS.accent },
  formContainer: { gap: 12 },
  manualInput: { backgroundColor: '#F8F9FA', borderRadius: 18, padding: 20, fontSize: 16, fontWeight: '700', color: COLORS.textMain, marginBottom: 10 },
  inputLabel: { fontSize: 12, fontWeight: '900', color: COLORS.textSub, marginLeft: 4 },
  analyzingBox: { height: 200, justifyContent: 'center', alignItems: 'center' },
  analyzingText: { marginTop: 16, fontSize: 16, fontWeight: '800', color: COLORS.textSub },
  resultsContainer: { gap: 12 },
  resultRowItem: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#F8F9FA', borderRadius: 20 },
  resultItemName: { fontSize: 16, fontWeight: '800', color: COLORS.textMain },
  resultItemSub: { fontSize: 12, color: COLORS.textSub, fontWeight: '600' },
  kcalResultInput: { fontSize: 18, fontWeight: '900', color: COLORS.accent, textAlign: 'right', minWidth: 50 },
  kcalUnitTag: { fontSize: 10, fontWeight: '800', color: COLORS.textSub, marginLeft: 4 },
  weightEntryArea: { alignItems: 'center', paddingVertical: 40 },
  bigWeightInput: { fontSize: 80, fontWeight: '900', color: COLORS.textMain, textAlign: 'center' },
  weightUnitLabel: { fontSize: 20, fontWeight: '800', color: COLORS.textSub },
  macroTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.white,
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  macroIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  macroTagValue: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textMain,
  },
  macroTagLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.textSub,
  },

  // Graph Filter Toggle
  runGraphFilterToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: 2,
    alignItems: 'center',
  },
  filterToggleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  filterToggleBtnActive: {
    backgroundColor: COLORS.white,
  },
  filterToggleText: {
    fontSize: 9,
    fontWeight: '900',
    color: COLORS.white,
  },
  filterToggleTextActive: {
    color: COLORS.bgPink,
  },
});
