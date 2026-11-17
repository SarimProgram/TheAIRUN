import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  StatusBar, Modal, TextInput, ActivityIndicator,
  Alert, Platform, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, LayoutAnimation, UIManager, Pressable
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCameraPermissions } from 'expo-camera';
import {
  X, TrendingUp, Plus, Flame, Heart,
  ScanLine, Beef, Wheat, Droplet, Route, Timer, Trophy, Footprints,
} from 'lucide-react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle as SvgCircle, Line as SvgLine, Path as SvgPath, Defs, Stop, LinearGradient as SvgGradient } from 'react-native-svg';
import { nutritionCharacterSource } from '@/components/home/nutritionAssets';
import { nutritionReaction } from '@/components/home/nutritionReaction';

import * as ImageManipulator from 'expo-image-manipulator';
import * as Crypto from 'expo-crypto';
import NetInfo from '@react-native-community/netinfo';
import { API_BASE_URL } from '../../config/api';
import { useAuth } from '@/src/auth/authContext';
import { usePoints } from '../../hooks/usePoints';
import { useWeightLog, type WeightHistoryPoint } from '../../hooks/useWeightLog';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { type FoodScan, type PhotoRect } from '@/components/home/FoodScanTransition';
import FoodLogSheet from '@/components/home/FoodLogSheet';
import { normalizeGender } from '@/utils/genderMascot';
import { loadRuns } from '@/lib/run-storage';
import {
  getLocalMealsForDay,
  getPendingLocalMeals,
  markLocalMealSynced,
  replaceSyncedLocalMealsForDay,
  upsertLocalMeal,
  deleteLocalMealItem,
  subscribeToMealChanges,
} from '@/lib/offline-meals';
import { homeAvatarKey } from '@/lib/home-avatar';
import { refreshPendingSentPlates } from '@/lib/meal-pass-sync';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
const MEAL_ICONS = require('../../assets/goals/meal-icons-v1.png');
const MEAL_ICON_SIZE = 56;

const COLORS = {
  accent: '#FF6B6B',
  accentSoft: '#FFF1F2',
  accentBorder: '#FFE4E6',
  danger: '#EF4444',
  white: '#FFFFFF',
  textMain: '#1F2937',
  textSub: '#6B7280',
  textFaint: '#9CA3AF',
  line: '#F3F4F6',
  track: '#E5E7EB',
  success: '#10B981',
  successSoft: '#ECFDF5',
  teal: '#1F938A',
  tealSoft: '#E6F4F2',
  protein: '#14B8A6',
  carbs: '#F59E0B',
  fat: '#F97316',
  bg: '#F8FAFC',
};

const CARD_SHADOW = '0 4px 14px rgba(15, 23, 42, 0.06)';

type MealType = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';

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

const MacroChip = ({ label, grams, color, Icon }: { label: string; grams: number; color: string; Icon: any }) => (
  <View style={[styles.macroChip, { backgroundColor: `${color}12` }]}>
    <Icon size={16} color={color} strokeWidth={2.2} />
    <View style={{ minWidth: 0 }}>
      <Text style={styles.macroChipLabel} numberOfLines={1}>{label}</Text>
      <Text style={styles.macroChipValue} numberOfLines={1}>{Math.round(grams)}g</Text>
    </View>
  </View>
);

const GAUGE_RADIUS = 84;
const GAUGE_STROKE = 16;
const GAUGE_LENGTH = Math.PI * GAUGE_RADIUS;

const KcalGauge = ({ consumed, target }: { consumed: number; target: number }) => {
  const remaining = Math.round(target - consumed);
  const isOver = remaining < 0;
  const fraction = target > 0 ? Math.min(1, Math.max(0, remaining / target)) : 0;
  const cx = GAUGE_RADIUS + GAUGE_STROKE / 2;
  const cy = cx;
  const arc = `M ${GAUGE_STROKE / 2} ${cy} A ${GAUGE_RADIUS} ${GAUGE_RADIUS} 0 0 1 ${cx * 2 - GAUGE_STROKE / 2} ${cy}`;

  return (
    <View style={styles.gauge}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${cx * 2} ${cy + GAUGE_STROKE / 2}`}>
        <SvgPath d={arc} stroke={COLORS.tealSoft} strokeWidth={GAUGE_STROKE} strokeLinecap="round" fill="none" />
        {fraction > 0 ? (
          <SvgPath
            d={arc}
            stroke={COLORS.accent}
            strokeWidth={GAUGE_STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${GAUGE_LENGTH * fraction} ${GAUGE_LENGTH}`}
          />
        ) : null}
      </Svg>
      <View style={styles.gaugeCenter} pointerEvents="none">
        <Flame size={20} color={isOver ? COLORS.danger : COLORS.accent} strokeWidth={2.2} />
        <Text
          style={[styles.gaugeValue, isOver && { color: COLORS.danger }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          selectable
        >
          {Math.abs(remaining).toLocaleString()}
        </Text>
        <Text style={styles.gaugeLabel}>{isOver ? 'KCAL OVER' : 'KCAL LEFT'}</Text>
      </View>
    </View>
  );
};

const MascotCard = ({ source }: { source: number }) => (
  <View style={styles.mascotCard}>
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 180 280" preserveAspectRatio="xMidYMid slice" pointerEvents="none">
      <SvgPath d="M -19 234 C 27 188 76 153 156 112" stroke="#FDE8E8" strokeWidth="71" strokeLinecap="round" fill="none" opacity={0.8} />
      <SvgPath d="M 0 267 C 51 221 100 189 193 139" stroke="#FCE5E6" strokeWidth="38" strokeLinecap="round" fill="none" opacity={0.76} />
      <SvgPath d="M 24 97 C 66 73 113 63 163 50" stroke="#FDE8E8" strokeWidth="23" strokeLinecap="round" fill="none" opacity={0.68} />
      <SvgPath d="M 29 278 C 74 255 117 233 162 206" stroke="#F9DCDD" strokeWidth="8" strokeLinecap="round" fill="none" opacity={0.7} />
    </Svg>
    <Image source={source} style={styles.mascotImage} contentFit="contain" contentPosition="bottom" transition={150} />
  </View>
);

const KCAL_CHART_HEIGHT = 80;
const KCAL_LABEL_ROW_HEIGHT = 24;
const KCAL_EMPTY_BAR_HEIGHT = 28;

const WeeklyBarGraph = ({ data, target, dayKeys }: { data: number[], target: number, dayKeys?: string[] }) => {
  const maxVal = Math.max(...data, target * 1.2, 1);
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
    return (new Date().getDay() + 6) % 7;
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

  const [selectedIdx, setSelectedIdx] = useState(todayIdx);

  useEffect(() => {
    setSelectedIdx(todayIdx);
  }, [todayIdx]);

  const selectedVal = selectedIdx >= 0 && selectedIdx < data.length ? data[selectedIdx] : 0;
  const selectedDelta = selectedVal - target;
  const hasAnyData = data.some((value) => value > 0);
  const targetLineBottom = KCAL_LABEL_ROW_HEIGHT + (target / maxVal) * KCAL_CHART_HEIGHT;

  const handleSelectDay = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    LayoutAnimation.configureNext(LayoutAnimation.create(180, 'easeInEaseOut', 'opacity'));
    setSelectedIdx(index);
  };

  return (
    <View style={styles.premiumGraphContainer}>
      <View style={styles.kcalGraphHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kcalGraphEyebrow}>Weekly kcal</Text>
          <Text style={styles.kcalGraphTitle}>
            {hasAnyData ? 'Tap a day for details' : 'Log food to start tracking'}
          </Text>
        </View>
        <View style={[
          styles.kcalGraphMeta,
          selectedVal > target && styles.kcalGraphMetaOver,
          selectedVal > 0 && selectedVal <= target && styles.kcalGraphMetaUnder,
        ]}>
          <Text style={styles.kcalGraphMetaLabel}>
            {dayLabels[selectedIdx]}{selectedIdx === todayIdx ? ' · Today' : ''}
          </Text>
          <Text style={styles.kcalGraphMetaValue}>{selectedVal.toLocaleString()}</Text>
          {selectedVal > 0 ? (
            <Text style={[
              styles.kcalGraphMetaDelta,
              selectedDelta > 0 ? styles.kcalGraphMetaDeltaOver : styles.kcalGraphMetaDeltaUnder,
            ]}>
              {selectedDelta > 0 ? `+${selectedDelta}` : selectedDelta} vs target
            </Text>
          ) : (
            <Text style={styles.kcalGraphMetaDelta}>No data logged</Text>
          )}
        </View>
      </View>

      <View style={[styles.kcalGraphBody, { height: KCAL_CHART_HEIGHT + KCAL_LABEL_ROW_HEIGHT + 32 }]}>
        <View pointerEvents="none" style={[styles.targetLine, { bottom: targetLineBottom }]}>
          <View style={styles.targetLineLabel}>
            <Text style={styles.targetLineText}>{target.toLocaleString()}</Text>
          </View>
        </View>

        <View style={styles.barsRowPremium}>
          {data.map((val, i) => {
            const isToday = i === todayIdx;
            const isSelected = i === selectedIdx;
            const isOverTarget = val > target;
            const barHeight = Math.max((val / maxVal) * KCAL_CHART_HEIGHT, 10);

            return (
              <Pressable
                key={i}
                style={styles.barColPremium}
                onPress={() => handleSelectDay(i)}
                accessibilityRole="button"
                accessibilityLabel={`${dayLabels[i]}, ${val} calories`}
              >
                <View style={styles.barContainerPremium}>
                  {isSelected && val > 0 ? (
                    <View style={[styles.kcalBarTooltip, { bottom: barHeight + 6 }]}>
                      <Text style={styles.kcalBarTooltipText}>{val.toLocaleString()}</Text>
                    </View>
                  ) : null}
                  {val > 0 ? (
                    <LinearGradient
                      colors={
                        isOverTarget || isSelected
                          ? [COLORS.accent, '#FFC2C2']
                          : ['#FFA3A3', '#FFE1E1']
                      }
                      style={[styles.kcalBar, { height: barHeight }, isSelected && styles.kcalBarSelected]}
                    />
                  ) : (
                    <View style={[
                      styles.kcalBar,
                      styles.kcalBarEmpty,
                      { height: KCAL_EMPTY_BAR_HEIGHT },
                      isSelected && styles.kcalBarEmptySelected,
                    ]} />
                  )}
                </View>
                <Text style={[
                  styles.barDayTextPremium,
                  isToday && styles.todayDayText,
                  isSelected && styles.selectedDayText,
                ]}>
                  {dayLabels[i]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Text style={styles.kcalGraphFooterHint}>Weekly avg {weeklyAverage.toLocaleString()} kcal · target {target.toLocaleString()}</Text>
    </View>
  );
};

const WeightHistoryGraph = ({ history }: { history: WeightHistoryPoint[] }) => {
  const [plotWidth, setPlotWidth] = React.useState(0);
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
          <Text style={{ color: COLORS.textSub, fontWeight: '600', textAlign: 'center' }}>Log your first weight to start the graph</Text>
        </View>
      </View>
    );
  }

  const chartHeight = 120;
  const yAxisWidth = 38;
  
  const range = Math.max(1, maxVal - minVal);
  const pad = range * 0.25;
  const minY = minVal - pad;
  const maxY = maxVal + pad;

  const HORIZ_PAD = 12;
  const toX = (idx: number) => {
    const denom = Math.max(1, sortedPoints.length - 1);
    return HORIZ_PAD + (idx / denom) * (Math.max(plotWidth, 1) - HORIZ_PAD * 2);
  };
  const toY = (val: number) => {
    const ratio = (val - minY) / (maxY - minY);
    return (1 - ratio) * chartHeight;
  };

  const yTicks = Array.from(
    new Set([maxY, (maxY + minY) / 2, minY].map((value) => Number(value.toFixed(1)))),
  ).sort((a, b) => b - a);

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
        <View style={[styles.targetBadge, { backgroundColor: weightChange <= 0 ? COLORS.successSoft : '#FEF2F2' }]}>
           <Text style={[styles.targetBadgeText, { color: weightChange <= 0 ? COLORS.success : COLORS.danger }]}>
              {weightChange > 0 ? '+' : ''}{weightChange.toFixed(1)} kg
           </Text>
        </View>
      </View>

      <View style={styles.weightGraphPlotRow}>
        <View style={[styles.weightGraphYAxis, { width: yAxisWidth, height: chartHeight }]}>
          {yTicks.map((tick) => (
            <Text
              key={tick}
              style={[styles.weightGraphYLabel, { top: toY(tick) - 7 }]}
            >
              {tick}
            </Text>
          ))}
        </View>

        <View
          style={styles.weightGraphPlot}
          onLayout={(event) => {
            const nextWidth = event.nativeEvent.layout.width;
            if (nextWidth && nextWidth !== plotWidth) {
              setPlotWidth(nextWidth);
            }
          }}
        >
          {plotWidth > 0 ? (
            <Svg width={plotWidth} height={chartHeight}>
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
                  x2={plotWidth}
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
          ) : null}

          <View style={styles.graphFooterRow}>
            <Text style={styles.graphFooterText}>{fmtDate(firstPoint?.loggedAt || '')}</Text>
            <Text style={styles.graphFooterText}>{fmtDate(lastPoint?.loggedAt || '')}</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const FoodItemRow = ({ item, onDelete, isDeleting }: any) => (
  <View style={styles.foodRow}>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={styles.foodName} numberOfLines={1}>{item.name}</Text>
      {item.time ? <Text style={styles.foodTime}>{item.time}</Text> : null}
    </View>
    <Text style={styles.foodKcal}>
      {Number(item.calories || 0).toLocaleString()}<Text style={styles.foodKcalUnit}> kcal</Text>
    </Text>
    <TouchableOpacity
      style={styles.foodDeleteBtn}
      onPress={() => onDelete(item.mealId, item.itemId, item.name, item.calories)}
      disabled={isDeleting}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`Remove ${item.name}`}
    >
      {isDeleting ? <ActivityIndicator size="small" color={COLORS.accent} /> : <X size={14} color={COLORS.textSub} strokeWidth={2.5} />}
    </TouchableOpacity>
  </View>
);

type MealItem = {
  mealId: string;
  itemId: string;
  name: string;
  calories: number;
  time?: string;
};

type MealSectionProps = {
  title: string;
  iconIndex: 0 | 1 | 2 | 3;
  items: MealItem[];
  onAdd: () => void;
  onDelete: (mealId: string, itemId: string, name: string, calories: number) => void;
  deletingId: string | null;
};

const MealSection = ({ title, iconIndex, items, onAdd, onDelete, deletingId }: MealSectionProps) => {
  const mealKcal = items.reduce((sum, item) => sum + (Number(item.calories) || 0), 0);
  return (
    <View style={styles.mealCard}>
      <View style={styles.mealHeader}>
        <View style={styles.mealIconWrap} pointerEvents="none">
          <Image
            accessible={false}
            source={MEAL_ICONS}
            style={[styles.mealIconSheet, {
              left: -(iconIndex % 2) * MEAL_ICON_SIZE,
              top: -Math.floor(iconIndex / 2) * MEAL_ICON_SIZE,
            }]}
          />
        </View>
        <View style={styles.mealHeading}>
          <Text style={styles.mealTitle}>{title}</Text>
          <Text style={styles.mealSub}>
            {items.length > 0
              ? `${mealKcal.toLocaleString()} kcal \u00b7 ${items.length} ${items.length === 1 ? 'item' : 'items'}`
              : 'No food logged yet'}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.mealAddBtn, pressed && styles.mealAddBtnPressed]}
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel={`Log ${title.toLowerCase()}`}
        >
          <Plus size={20} color={COLORS.accent} strokeWidth={2} />
        </Pressable>
      </View>

      {items.length > 0 ? (
        <View style={styles.foodList}>
          {items.map((item) => (
            <FoodItemRow
              key={item.itemId}
              item={item}
              onDelete={onDelete}
              isDeleting={deletingId === item.itemId}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
};

export default function TodayActivityPage() {
  const { authFetch, isAuthenticated, accessToken, user } = useAuth();
  const {
    currentWeightKg: currentWeight,
    weightHistory,
    logWeight,
  } = useWeightLog({ authFetch, isAuthenticated });
  const router = useRouter();
  const { balance: points, refetch: refetchPoints } = usePoints({ accessToken });
  const [activeTab, setActiveTab] = useState<'NUTRITION' | 'HISTORY'>('NUTRITION');
  const activityScrollRef = useRef<ScrollView>(null);
  const dataFetchVersion = useRef(0);

  // Data State
  const [mealSummary, setMealSummary] = useState<any>({ BREAKFAST: [], LUNCH: [], DINNER: [], SNACK: [] });
  const [macroTotals, setMacroTotals] = useState({ protein: 0, carbs: 0, fat: 0 });
  const [todayGoals, setTodayGoals] = useState({ calories: 2000, protein: 150, carbs: 250, fat: 70, steps: 10000, water: 8 });
  const [weeklyHistory, setWeeklyHistory] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [weeklyDayKeys, setWeeklyDayKeys] = useState<string[]>([]);
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
  const [foodScan, setFoodScan] = useState<FoodScan | null>(null);
  const [mealPhoto, setMealPhoto] = useState<{ original: string; cutout?: string } | null>(null);
  const cameraFrame = useRef<View>(null);
  const resultPhotoFrame = useRef<View>(null);
  const scanRoot = useRef<View>(null);
  const scanRequest = useRef<AbortController | null>(null);
  const scanGeneration = useRef(0);

  const closeMealLogger = useCallback(() => {
    scanGeneration.current += 1;
    scanRequest.current?.abort();
    scanRequest.current = null;
    setFoodScan(null);
    setMealPhoto(null);
    setMealModalOpen(false);
    setScanStep('camera');
    setIsCapturing(false);
    setIsAnalyzingManual(false);
  }, []);
  const settleFoodScan = useCallback(() => {
    setFoodScan(null);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, []);
  const measurePhoto = useCallback((frame: React.RefObject<View | null>): Promise<PhotoRect | null> => {
    return new Promise((resolve) => {
      if (!scanRoot.current || !frame.current) return resolve(null);
      scanRoot.current.measureInWindow((rootX, rootY) => {
        if (!frame.current) return resolve(null);
        frame.current.measureInWindow((x, y, width, height) => resolve({ x: x - rootX, y: y - rootY, width, height }));
      });
    });
  }, []);
  const measureResultPhoto = useCallback(async () => {
    const target = await measurePhoto(resultPhotoFrame);
    if (target && target.width > 0) setFoodScan((current) => current ? { ...current, target } : current);
  }, [measurePhoto]);
  useEffect(() => () => { scanGeneration.current += 1; scanRequest.current?.abort(); }, []);
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
          clientMealId: meal.clientMealId,
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
    scanGeneration.current += 1;
    scanRequest.current?.abort();
    setFoodScan(null);
    setMealPhoto(null);
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
    if (tab === 'RUNNING' || tab === 'WEIGHT' || tab === 'HISTORY' || tab === 'NUTRITION') {
      setActiveTab(tab === 'NUTRITION' ? 'NUTRITION' : 'HISTORY');
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
    const version = ++dataFetchVersion.current;
    await loadLocalMealsForToday();
    await loadRunStats();
    if (!isAuthenticated) return;
    try {
      const responses = await Promise.allSettled([
        authFetch(`${API_BASE_URL}/nutrition/meals/today`),
        authFetch(`${API_BASE_URL}/summary/nutrition-history`),
        authFetch(`${API_BASE_URL}/summary/week`)
      ]);
      if (version !== dataFetchVersion.current) return;
      // A failed history/plan request must not discard a successfully fetched meal.
      const [mealResp, historyResp, weekResp] = responses.map((result) =>
        result.status === 'fulfilled' ? result.value : null
      );

      if (mealResp?.ok) {
        const json = await mealResp.json();
        if (version !== dataFetchVersion.current) return;
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

      if (historyResp?.ok) {
        const historyJson = await historyResp.json();
        if (Array.isArray(historyJson)) {
          setWeeklyHistory(historyJson.map((h: any) => Number(h?.calories) || 0));
          setWeeklyDayKeys(historyJson.map((h: any) => String(h?.day || '')));
        }
      }

      if (weekResp?.ok) {
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

    } catch (e) {
      console.error('Activity Data Fetch Error:', e);
    }
  }, [authFetch, getDayKeyForTimezone, isAuthenticated, loadLocalMealsForToday, loadRunStats, userKey]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
      refetchPoints();
      if (isAuthenticated) void refreshPendingSentPlates(authFetch, userKey);
    }, [authFetch, fetchData, isAuthenticated, refetchPoints, userKey])
  );

  // A plate accepted or re-portioned elsewhere (overlay, partner's answer) changes today's meals.
  useEffect(() => subscribeToMealChanges(() => {
    // The accepted portion is already cached. Show it before waiting on uploads,
    // and prevent an older response from replacing it with a pre-accept snapshot.
    dataFetchVersion.current += 1;
    void loadLocalMealsForToday().catch((error) => console.warn('Meal cache refresh failed', error));
    void syncPendingMeals().then(fetchData, fetchData);
  }), [fetchData, loadLocalMealsForToday, syncPendingMeals]);

  const todayKey = useCallback(() => getDayKeyForTimezone(new Date()), [getDayKeyForTimezone]);
  const handlePlatePassed = useCallback(async (dayKey: string) => {
    await loadLocalMealsForToday();
    await syncPendingMeals();
    await recalculateTodaySummary(dayKey);
  }, [loadLocalMealsForToday, recalculateTodaySummary, syncPendingMeals]);

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

  const handleLogWeight = async () => {
    const weight = parseFloat(weightInput);
    if (isNaN(weight) || weight <= 0) return;
    try {
      await logWeight(weight);
      setWeightModalOpen(false);
    } catch (e) { Alert.alert('Error', 'Failed to log weight'); }
  };

  // Scanning Handlers
  const handleCapture = async () => {
    if (isCapturing || scanRequest.current) return;
    const hasCameraAccess = await ensureCameraAccess();
    if (!hasCameraAccess) {
      Alert.alert('Camera Access Needed', 'Allow camera access to scan your meal, or use manual entry instead.');
      return;
    }
    if (!cameraRef.current || isCapturing || scanRequest.current) return;
    if (!isOnline) {
      Alert.alert('No Internet', 'Unable to run AI food analysis while offline. Enter calories manually to save offline.');
      return;
    }
    const generation = ++scanGeneration.current;
    const controller = new AbortController();
    scanRequest.current = controller;
    const requestTimeout = setTimeout(() => controller.abort(), 60_000);
    const isCurrent = () => generation === scanGeneration.current;
    try {
      setIsCapturing(true);
      const origin = await measurePhoto(cameraFrame);
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (!isCurrent()) return;
      if (!photo?.uri || !origin) throw new Error('Could not capture your meal. Please try again.');
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setMealPhoto({ original: photo.uri });
      setFoodScan({ photoUri: photo.uri, origin, complete: false });
      setScanStep('analyzing');
      const manip = await ImageManipulator.manipulateAsync(photo.uri, [{ resize: { width: 900 } }], { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG });
      if (!isCurrent()) return;
      const makeForm = () => {
        const form = new FormData();
        form.append('mealType', activeMealType);
        form.append('image', { uri: manip.uri, type: 'image/jpeg', name: 'food.jpg' } as any);
        return form;
      };
      const isolateController = new AbortController();
      const abortIsolation = () => isolateController.abort();
      controller.signal.addEventListener('abort', abortIsolation);
      const isolationTimeout = setTimeout(abortIsolation, 17_000);
      const isolation = (async () => {
        try {
          const response = await authFetch(`${API_BASE_URL}/nutrition/meals/isolate`, { method: 'POST', body: makeForm(), signal: isolateController.signal });
          if (!response.ok) return;
          const data = await response.json();
          if (isCurrent() && typeof data.cutoutUri === 'string' && data.cutoutUri.startsWith('data:image/png;base64,')) {
            setMealPhoto({ original: photo.uri, cutout: data.cutoutUri });
            setFoodScan((current) => current ? { ...current, cutoutUri: data.cutoutUri } : current);
          }
        } catch { /* Keep the original photo if isolation is unavailable. */ }
        finally { clearTimeout(isolationTimeout); controller.signal.removeEventListener('abort', abortIsolation); }
      })();
      const analysis = (async () => {
        const resp = await authFetch(`${API_BASE_URL}/nutrition/meals/analyze`, { method: 'POST', body: makeForm(), signal: controller.signal });
        if (!resp.ok) throw new Error('Could not analyze this photo. Please try again.');
        const result = await resp.json();
        if (!Array.isArray(result.items) || !result.items.length) throw new Error('No food was identified. Try a clearer photo or type your meal.');
        return result;
      })();
      const [result] = await Promise.all([analysis, isolation]);
      if (!isCurrent()) return;
      setAnalyzedItems(result.items);
      setFoodScan((current) => current ? { ...current, complete: true } : current);
      setScanStep('results');
    } catch (e: any) {
      controller.abort();
      if (!isCurrent()) return;
      setFoodScan(null);
      setMealPhoto(null);
      setScanStep('camera');
      Alert.alert('Analysis Failed', e.name === 'AbortError' ? 'This scan took too long. Please try again.' : e.message);
    } finally {
      clearTimeout(requestTimeout);
      if (isCurrent()) { setIsCapturing(false); scanRequest.current = null; }
    }
  };

  const handleManualIdentify = async () => {
    if (!manualName.trim() || isAnalyzingManual || scanRequest.current) return;
    if (manualKcal) {
       const calories = Number(manualKcal);
       if (!Number.isFinite(calories) || calories < 0) return;
       setAnalyzedItems([{ foodName: manualName.trim(), calories: Math.round(calories) }]);
       setScanStep('results');
       return;
    }
    if (!isOnline) {
      Alert.alert('No Internet', 'Unable to pull AI estimate while offline. Enter calories manually to save this food.');
      return;
    }
    setIsAnalyzingManual(true);
    Keyboard.dismiss();
    setScanStep('analyzing');
    const generation = ++scanGeneration.current;
    const controller = new AbortController();
    scanRequest.current = controller;
    const timeout = setTimeout(() => controller.abort(), 60_000);
    try {
      const formData = new FormData();
      formData.append('mealType', activeMealType);
      formData.append('text', manualName.trim());
      const resp = await authFetch(`${API_BASE_URL}/nutrition/meals/analyze`, { method: 'POST', body: formData, signal: controller.signal });
      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(errText || 'Failed to analyze manual input');
      }
      const result = await resp.json();
      if (generation !== scanGeneration.current) return;
      if (!Array.isArray(result.items) || !result.items.length) throw new Error('No food was identified. Add a little more detail and try again.');
      setAnalyzedItems(result.items);
      setScanStep('results');
    } catch (e: any) {
      if (generation !== scanGeneration.current) return;
      setScanStep('manual');
      Alert.alert('Analysis Failed', e?.name === 'AbortError' ? 'This estimate took too long. Please try again.' : e?.message || 'Could not analyze this food. Try again.');
    } finally {
      clearTimeout(timeout);
      if (generation === scanGeneration.current) { setIsAnalyzingManual(false); scanRequest.current = null; }
    }
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
        inputText: mealPhoto ? null : manualName.trim() || null,
        hadImage: !!mealPhoto,
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
      setMealPhoto(null);
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

  const insets = useSafeAreaInsets();
  const mascotSource = nutritionCharacterSource(
    normalizeGender(user?.gender) || 'male',
    nutritionReaction({ goal: todayGoals.calories, food: totalKcal }),
  );
  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();


  const weightDelta = React.useMemo(() => {
    if (!weightHistory || weightHistory.length < 2) return null;
    const sorted = [...weightHistory]
      .sort((a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime())
      .slice(-14);
    return sorted[sorted.length - 1].weightKg - sorted[0].weightKg;
  }, [weightHistory]);

  const selectTab = (tab: typeof activeTab) => {
    if (tab === activeTab) return;
    void Haptics.selectionAsync().catch(() => {});
    LayoutAnimation.configureNext(LayoutAnimation.create(200, 'easeInEaseOut', 'opacity'));
    setActiveTab(tab);
  };

  const openWeightModal = () => {
    setWeightInput(currentWeight?.toString() || '');
    setWeightModalOpen(true);
  };

  const runBars = runGraphFilter === 'WEEK'
    ? weeklyKmHistory.map((km, i) => ({ label: ['M', 'T', 'W', 'T', 'F', 'S', 'S'][i], km, active: i === (new Date().getDay() + 6) % 7 }))
    : monthlyKmHistory.map((m, i) => ({ label: m.label, km: m.km, active: i === monthlyKmHistory.length - 1 }));
  const runBarMax = Math.max(...runBars.map((b) => b.km), 5);

  const runStatTiles = [
    { label: 'Total runs', value: String(runStats.totalRuns), Icon: Footprints },
    { label: 'Total distance', value: `${runStats.totalKm.toFixed(1)} km`, Icon: Route },
    { label: 'This week', value: `${runStats.weekRuns} ${runStats.weekRuns === 1 ? 'run' : 'runs'}`, sub: `${runStats.weekKm.toFixed(1)} km`, Icon: TrendingUp },
    { label: 'Duration', value: `${runStats.totalDurationMin.toLocaleString()} min`, Icon: Timer },
    {
      label: 'Avg pace',
      value: runStats.avgPaceSecPerKm
        ? `${Math.floor(runStats.avgPaceSecPerKm / 60)}:${String(runStats.avgPaceSecPerKm % 60).padStart(2, '0')} /km`
        : '--',
      Icon: Timer,
    },
    { label: 'Longest run', value: `${runStats.longestRunKm.toFixed(2)} km`, Icon: Trophy },
    { label: 'Calories burned', value: runStats.totalCalories.toLocaleString(), Icon: Flame },
  ];

  const tabs: { key: typeof activeTab; label: string }[] = [
    { key: 'NUTRITION', label: 'Nutrition' },
    { key: 'HISTORY', label: 'History' },
  ];

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        ref={activityScrollRef}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 8 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerDate}>{todayLabel}</Text>
            <Text style={styles.headerTitle} accessibilityRole="header">Activity</Text>
          </View>
          <View style={styles.pointsPill} accessibilityLabel={`${points} points`}>
            <Heart size={16} color={COLORS.danger} fill={COLORS.danger} />
            <Text style={styles.pointsText}>{points.toLocaleString()}</Text>
          </View>
        </View>

        <View style={styles.heroRow}>
          <MascotCard source={mascotSource} />

          <View style={styles.heroCard}>
            <KcalGauge consumed={totalKcal} target={todayGoals.calories} />
            <View style={styles.macroRow}>
              <MacroChip label="Protein" grams={macroTotals.protein} color={COLORS.protein} Icon={Beef} />
              <MacroChip label="Carbs" grams={macroTotals.carbs} color={COLORS.carbs} Icon={Wheat} />
              <MacroChip label="Fat" grams={macroTotals.fat} color={COLORS.fat} Icon={Droplet} />
            </View>
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryBtnPressed]}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                openLogFoodWithAutoMealType();
              }}
              accessibilityRole="button"
            >
              <ScanLine size={20} color={COLORS.white} strokeWidth={2} />
              <Text style={styles.primaryBtnText}>Log Food</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.tabBar} accessibilityRole="tablist">
          {tabs.map((tab) => {
            const selected = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                style={[styles.tabItem, selected && styles.tabItemActive]}
                onPress={() => selectTab(tab.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.tabText, selected && styles.tabTextActive]} numberOfLines={1}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {activeTab === 'NUTRITION' ? (
          <View style={styles.section}>
            <MealSection
              title="Breakfast" iconIndex={0}
              items={mealSummary.BREAKFAST} onAdd={() => { openMealLogger('BREAKFAST'); }}
              onDelete={handleDelete} deletingId={deletingId}
            />
            <MealSection
              title="Lunch" iconIndex={1}
              items={mealSummary.LUNCH} onAdd={() => { openMealLogger('LUNCH'); }}
              onDelete={handleDelete} deletingId={deletingId}
            />
            <MealSection
              title="Dinner" iconIndex={2}
              items={mealSummary.DINNER} onAdd={() => { openMealLogger('DINNER'); }}
              onDelete={handleDelete} deletingId={deletingId}
            />
            <MealSection
              title="Snacks" iconIndex={3}
              items={mealSummary.SNACK} onAdd={() => { openMealLogger('SNACK'); }}
              onDelete={handleDelete} deletingId={deletingId}
            />


          </View>
        ) : (
          <View style={styles.section}>
            <WeeklyBarGraph data={weeklyHistory} target={todayGoals.calories} dayKeys={weeklyDayKeys} />

            <View style={styles.card}>
              <View style={styles.historyHeadingRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.historyHeading}>Body weight</Text>
                  <Text style={styles.mealSub}>
                    {currentWeight != null ? `${currentWeight.toFixed(1)} kg` : 'No weight logged yet'}
                    {weightDelta !== null ? ` · ${weightDelta > 0 ? '+' : ''}${weightDelta.toFixed(1)} kg recently` : ''}
                  </Text>
                </View>
                <Pressable onPress={openWeightModal} style={styles.historyAddButton} accessibilityRole="button" accessibilityLabel="Log weight">
                  <Plus size={20} color={COLORS.teal} strokeWidth={2.4} />
                </Pressable>
              </View>
            </View>
            <WeightHistoryGraph history={weightHistory} />

            <View style={styles.card}>
              <View style={[styles.historyHeadingRow, { marginBottom: 12 }]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.historyHeading}>Running</Text>
                  <Text style={styles.mealSub}>{runStats.totalRuns} total runs · {runStats.totalKm.toFixed(1)} km</Text>
                </View>
                <View style={styles.miniSegment}>
                  {(['WEEK', 'MONTH'] as const).map((filter) => (
                    <Pressable
                      key={filter}
                      onPress={() => setRunGraphFilter(filter)}
                      style={[styles.miniSegmentItem, runGraphFilter === filter && styles.miniSegmentItemActive]}
                      hitSlop={6}
                      accessibilityRole="tab"
                      accessibilityLabel={filter === 'WEEK' ? 'Week' : 'Month'}
                      accessibilityState={{ selected: runGraphFilter === filter }}
                    >
                      <Text style={[styles.miniSegmentText, runGraphFilter === filter && styles.miniSegmentTextActive]}>{filter === 'WEEK' ? 'W' : 'M'}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={styles.runBars}>
                {runBars.map((bar, i) => (
                  <View key={`${bar.label}-${i}`} style={styles.runBarCol}>
                    <View style={[
                      styles.runBar,
                      { height: Math.max((bar.km / runBarMax) * 44, 6) },
                      bar.active ? styles.runBarActive : bar.km > 0 && styles.runBarFilled,
                    ]} />
                    <Text style={[styles.runBarLabel, bar.active && styles.runBarLabelActive]}>{bar.label}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={styles.runStatsGrid}>
              {runStatTiles.map(({ label, value, sub, Icon }) => (
                <View key={label} style={styles.runStatTile}>
                  <View style={styles.runStatIcon}>
                    <Icon size={16} color={COLORS.accent} strokeWidth={2.2} />
                  </View>
                  <Text style={styles.runStatLabel}>{label}</Text>
                  <Text style={styles.runStatValue} numberOfLines={1} adjustsFontSizeToFit selectable>{value}</Text>
                  {sub ? <Text style={styles.runStatSub}>{sub}</Text> : null}
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* --- MEAL LOG SHEET --- */}
      <FoodLogSheet
        visible={mealModalOpen} gender={normalizeGender(user?.gender) || 'male'}
        mealType={activeMealType} step={scanStep} permission={cameraPermission}
        cameraRef={cameraRef} rootRef={scanRoot} cameraFrameRef={cameraFrame}
        resultPhotoRef={resultPhotoFrame} onResultLayout={measureResultPhoto}
        scan={foodScan} photo={mealPhoto} items={analyzedItems}
        manualName={manualName} manualKcal={manualKcal}
        capturing={isCapturing} saving={isSaving} analyzingManual={isAnalyzingManual}
        onNameChange={setManualName} onKcalChange={setManualKcal}
        onItemCaloriesChange={(index, value) => setAnalyzedItems(current => current.map((item, i) => i === index ? { ...item, calories: Math.max(0, parseInt(value, 10) || 0) } : item))}
        onModeChange={mode => {
          setScanStep(mode);
          setMealPhoto(null);
          setFoodScan(null);
          setAnalyzedItems([]);
        }}
        onCapture={handleCapture} onIdentify={handleManualIdentify} onSave={handleSaveMeal}
        onPermission={ensureCameraAccess} onClose={closeMealLogger} onSettled={settleFoodScan}
        pass={{
          authFetch, userKey, partnerId: user?.partnerId,
          partnerLinked: !!user?.partnerId && isOnline && isAuthenticated,
          youGender: user?.gender, dayKey: todayKey, onPassed: handlePlatePassed,
          youAvatarKey: user?.id ? homeAvatarKey(user.id, 'you') : undefined,
          partnerAvatarKey: user?.id && user?.partnerId ? homeAvatarKey(user.id, 'partner', user.partnerId) : undefined,
        }}
      />

      {/* --- WEIGHT MODAL --- */}
      <Modal visible={weightModalOpen} animationType="fade" transparent onRequestClose={() => setWeightModalOpen(false)}>
         <KeyboardAvoidingView
           behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
           keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
           style={{ flex: 1 }}
         >
           <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.popUpBackdrop}>
                 <View style={[styles.popUpCard, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
                    <View style={styles.modalDragHandle} />
                    <View style={styles.popUpHeader}>
                      <View>
                        <Text style={styles.cardEyebrow}>Body weight</Text>
                        <Text style={styles.popUpTitle}>Update Weight</Text>
                      </View>
                      <TouchableOpacity style={styles.popUpCloseBtn} onPress={() => setWeightModalOpen(false)} accessibilityLabel="Close">
                        <X size={20} color={COLORS.textMain} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.weightEntryArea}>
                       <TextInput style={styles.bigWeightInput} value={weightInput} onChangeText={setWeightInput} keyboardType="decimal-pad" autoFocus />
                       <Text style={styles.weightUnitLabel}>Kilograms</Text>
                    </View>
                    <Pressable style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryBtnPressed]} onPress={handleLogWeight}>
                       <Text style={styles.primaryBtnText}>Save Weight</Text>
                    </Pressable>
                 </View>
              </View>
           </TouchableWithoutFeedback>
         </KeyboardAvoidingView>
      </Modal>

    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
    gap: 12,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  headerDate: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSub,
    letterSpacing: 1.5,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.textMain,
    letterSpacing: -0.8,
    marginTop: 2,
  },
  pointsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    minHeight: 36,
    borderRadius: 999,
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
  },
  pointsText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.danger,
    fontVariant: ['tabular-nums'],
  },

  // Hero
  heroRow: {
    flexDirection: 'row',
    gap: 10,
  },
  mascotCard: {
    flex: 36,
    minHeight: 270,
    overflow: 'visible',
  },
  mascotImage: {
    position: 'absolute',
    top: 5,
    left: -7,
    right: -7,
    bottom: 0,
  },
  heroCard: {
    flex: 64,
    minHeight: 270,
    backgroundColor: COLORS.white,
    borderRadius: 24,
    borderCurve: 'continuous',
    padding: 12,
    gap: 10,
    justifyContent: 'space-between',
    boxShadow: CARD_SHADOW,
  },
  gauge: {
    width: '100%',
    aspectRatio: 184 / 100,
  },
  gaugeCenter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  gaugeValue: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '800',
    color: COLORS.textMain,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  gaugeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSub,
    letterSpacing: 1.5,
  },
  macroRow: {
    flexDirection: 'row',
    gap: 6,
  },
  macroChip: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 16,
    borderCurve: 'continuous',
  },
  macroChipLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textSub,
    textAlign: 'center',
  },
  macroChipValue: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textMain,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  primaryBtn: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 999,
    backgroundColor: COLORS.accent,
    boxShadow: '0 6px 14px rgba(255, 107, 107, 0.3)',
  },
  primaryBtnPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.92,
  },
  primaryBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '800',
  },
  heroStat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  heroStatIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderCurve: 'continuous',
    backgroundColor: COLORS.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStatValue: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    color: COLORS.textMain,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  heroStatUnit: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textSub,
    letterSpacing: 0,
  },
  heroStatHint: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textFaint,
    textAlign: 'center',
    marginTop: 4,
  },
  deltaPill: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  deltaPillUp: { backgroundColor: '#FEF2F2' },
  deltaPillDown: { backgroundColor: COLORS.successSoft },
  deltaPillText: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  runHeroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  miniSegment: {
    flexDirection: 'row',
    backgroundColor: COLORS.line,
    borderRadius: 999,
    padding: 2,
  },
  miniSegmentItem: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  miniSegmentItemActive: {
    backgroundColor: COLORS.white,
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.12)',
  },
  miniSegmentText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSub,
  },
  miniSegmentTextActive: {
    color: COLORS.accent,
  },
  runBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    minHeight: 62,
    paddingHorizontal: 4,
  },
  runBarCol: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  runBar: {
    width: 10,
    borderRadius: 999,
    backgroundColor: COLORS.track,
  },
  runBarFilled: {
    backgroundColor: '#FFC2C2',
  },
  runBarActive: {
    backgroundColor: COLORS.accent,
  },
  runBarLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.textFaint,
  },
  runBarLabelActive: {
    color: COLORS.accent,
  },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: 999,
    padding: 4,
    boxShadow: CARD_SHADOW,
  },
  tabItem: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: 4,
  },
  tabItemActive: {
    backgroundColor: COLORS.accent,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textSub,
  },
  tabTextActive: {
    color: COLORS.white,
  },

  // Sections
  section: {
    gap: 12,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    borderCurve: 'continuous',
    padding: 16,
    boxShadow: CARD_SHADOW,
  },
  historyHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  historyHeading: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textMain,
  },
  historyAddButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: COLORS.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },

  // Weekly kcal graph
  premiumGraphContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    borderCurve: 'continuous',
    padding: 16,
    boxShadow: CARD_SHADOW,
  },
  kcalGraphHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  kcalGraphEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  kcalGraphTitle: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textMain,
    letterSpacing: -0.2,
  },
  kcalGraphMeta: {
    alignItems: 'flex-end',
    backgroundColor: COLORS.bg,
    borderRadius: 16,
    borderCurve: 'continuous',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  kcalGraphMetaOver: {
    backgroundColor: COLORS.accentSoft,
    borderColor: COLORS.accentBorder,
  },
  kcalGraphMetaUnder: {
    backgroundColor: COLORS.successSoft,
    borderColor: '#D1FAE5',
  },
  kcalGraphMetaLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  kcalGraphMetaValue: {
    marginTop: 2,
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textMain,
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  kcalGraphMetaDelta: {
    marginTop: 1,
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textFaint,
    fontVariant: ['tabular-nums'],
  },
  kcalGraphMetaDeltaOver: {
    color: COLORS.danger,
  },
  kcalGraphMetaDeltaUnder: {
    color: COLORS.success,
  },
  kcalGraphBody: {
    justifyContent: 'flex-end',
    position: 'relative',
    width: '100%',
    marginTop: 4,
  },
  kcalGraphFooterHint: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textFaint,
    fontVariant: ['tabular-nums'],
  },
  targetLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 0,
    borderTopWidth: 1.5,
    borderColor: 'rgba(31, 147, 138, 0.45)',
    borderStyle: 'dashed',
    zIndex: 1,
  },
  targetLineLabel: {
    position: 'absolute',
    right: 0,
    top: -12,
    backgroundColor: COLORS.successSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  targetLineText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.success,
    fontVariant: ['tabular-nums'],
  },
  barsRowPremium: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    width: '100%',
    zIndex: 2,
  },
  barColPremium: {
    alignItems: 'center',
    flex: 1,
    minHeight: 44,
  },
  barContainerPremium: {
    height: KCAL_CHART_HEIGHT,
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: '100%',
  },
  kcalBar: {
    width: 28,
    borderRadius: 8,
    borderCurve: 'continuous',
  },
  kcalBarSelected: {
    boxShadow: '0 4px 10px rgba(255, 107, 107, 0.35)',
  },
  kcalBarEmpty: {
    backgroundColor: '#EEF0F3',
  },
  kcalBarEmptySelected: {
    backgroundColor: COLORS.track,
  },
  kcalBarTooltip: {
    position: 'absolute',
    zIndex: 3,
    backgroundColor: COLORS.textMain,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    alignItems: 'center',
  },
  kcalBarTooltipText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.white,
    fontVariant: ['tabular-nums'],
  },
  barDayTextPremium: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
    color: COLORS.textFaint,
    marginTop: 8,
  },
  todayDayText: {
    color: COLORS.accent,
    fontWeight: '800',
  },
  selectedDayText: {
    color: COLORS.textMain,
    fontWeight: '800',
  },

  // Weight graph
  graphHeaderPremium: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  graphTitleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  graphIconInner: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderCurve: 'continuous',
    backgroundColor: COLORS.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  graphTitlePremium: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textFaint,
    letterSpacing: 1.2,
  },
  graphSubPremium: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textMain,
    marginTop: 2,
  },
  targetBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  targetBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
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
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textFaint,
  },
  weightGraphPlotRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 4,
  },
  weightGraphYAxis: {
    position: 'relative',
    paddingRight: 6,
  },
  weightGraphYLabel: {
    position: 'absolute',
    right: 0,
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textFaint,
    fontVariant: ['tabular-nums'],
  },
  weightGraphPlot: {
    flex: 1,
    minWidth: 0,
  },
  weightLogRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  // Meals
  mealCard: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    borderCurve: 'continuous',
    padding: 16,
    boxShadow: CARD_SHADOW,
  },
  mealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mealIconWrap: {
    width: MEAL_ICON_SIZE,
    height: MEAL_ICON_SIZE,
    overflow: 'hidden',
    flexShrink: 0,
  },
  mealIconSheet: {
    position: 'absolute',
    width: MEAL_ICON_SIZE * 2,
    height: MEAL_ICON_SIZE * 2,
  },
  mealHeading: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  mealTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textMain,
    letterSpacing: -0.3,
  },
  mealSub: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSub,
    fontVariant: ['tabular-nums'],
  },
  mealAddBtn: {
    width: 44,
    height: 44,
    flexShrink: 0,
    borderRadius: 16,
    borderCurve: 'continuous',
    backgroundColor: COLORS.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealAddBtnPressed: {
    backgroundColor: COLORS.accentBorder,
  },
  foodList: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.track,
    gap: 8,
  },
  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.bg,
    borderRadius: 16,
    borderCurve: 'continuous',
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 8,
  },
  foodName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  foodTime: {
    marginTop: 1,
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textFaint,
  },
  foodKcal: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.accent,
    fontVariant: ['tabular-nums'],
  },
  foodKcalUnit: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSub,
  },
  foodDeleteBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Running
  runStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  runStatTile: {
    flexBasis: '46%',
    flexGrow: 1,
    backgroundColor: COLORS.white,
    borderRadius: 24,
    borderCurve: 'continuous',
    padding: 16,
    gap: 4,
    boxShadow: CARD_SHADOW,
  },
  runStatIcon: {
    width: 32,
    height: 32,
    borderRadius: 12,
    borderCurve: 'continuous',
    backgroundColor: COLORS.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  runStatLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSub,
  },
  runStatValue: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textMain,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  runStatSub: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textFaint,
    fontVariant: ['tabular-nums'],
  },

  // Weight modal
  popUpBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  popUpCard: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderCurve: 'continuous',
    padding: 24,
  },
  modalDragHandle: {
    width: 40, height: 4, backgroundColor: COLORS.track, borderRadius: 2, alignSelf: 'center', marginBottom: 20,
  },
  popUpHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  popUpTitle: { fontSize: 24, fontWeight: '800', color: COLORS.textMain, marginTop: 4 },
  popUpCloseBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg, borderRadius: 18 },
  weightEntryArea: { alignItems: 'center', paddingVertical: 32 },
  bigWeightInput: { fontSize: 72, fontWeight: '800', color: COLORS.textMain, textAlign: 'center', minWidth: 160, fontVariant: ['tabular-nums'] },
  weightUnitLabel: { fontSize: 16, fontWeight: '700', color: COLORS.textSub },
});
