import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, useWindowDimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, TrendingUp, Clock3 } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import Animated, { FadeInUp, ZoomIn } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../src/auth/authContext';
import { useStepSync } from '../hooks/UseStepSync';
import { useDailySummary } from '../hooks/useDailySummary';
import { API_BASE_URL } from '../config/api';

const COLORS = {
  primary: '#FF6B6B',
  background: '#F6F7F9',
  surface: '#FFFFFF',
  surfaceMuted: '#F1F4F7',
  text: '#172033',
  muted: '#64748B',
  border: '#E3E8EF',
};

type StepHistoryPoint = {
  dayKey: string;
  steps: number;
};

function toDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildRecentDays(): string[] {
  const today = new Date();
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    return toDayKey(date);
  });
}

function formatWeekday(dayKey: string): string {
  return new Date(`${dayKey}T12:00:00`).toLocaleDateString('en-AU', { weekday: 'short' });
}

function formatSelectedDate(dayKey: string, todayKey: string): string {
  if (dayKey === todayKey) return 'Today';
  return new Date(`${dayKey}T12:00:00`).toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });
}

function parseNumericParam(value: string | string[] | undefined, fallback: number): number {
  const raw = typeof value === 'string' ? value : value?.[0];
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatElapsedClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatDurationLabel(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (ms <= 0) {
    return '0m';
  }

  if (hours <= 0) {
    return `${Math.max(1, totalMinutes)} min`;
  }

  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

export default function RemainingStepsScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { accessToken, authFetch } = useAuth();
  const { steps: liveSteps } = useStepSync({ accessToken });
  const { summary } = useDailySummary({ accessToken });
  const { current = '0', target = '10000' } = useLocalSearchParams();
  const openedAtRef = useRef(Date.now());
  const [elapsedMs, setElapsedMs] = useState(0);
  const [stepHistory, setStepHistory] = useState<StepHistoryPoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const recentDays = useMemo(buildRecentDays, []);
  const [selectedDayKey, setSelectedDayKey] = useState(recentDays[recentDays.length - 1]);

  const fallbackCurrent = parseNumericParam(current, 0);
  const fallbackTarget = parseNumericParam(target, 10000);
  const cur = Math.max(fallbackCurrent, summary?.steps ?? 0, liveSteps ?? 0);
  const tgt = Math.max(summary?.stepsTarget ?? 0, fallbackTarget, 1);
  const remaining = Math.max(0, tgt - cur);
  const progress = tgt > 0 ? Math.min(1, cur / tgt) : 0;
  const sessionSteps = Math.max(0, cur - fallbackCurrent);
  const ringSize = Math.min(width - 64, height * 0.31, 272);
  const ringStrokeWidth = 12;
  const ringCenter = ringSize / 2;
  const ringRadius = (ringSize - ringStrokeWidth) / 2;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringDashOffset = ringCircumference * (1 - progress);
  const bigNumberSize = Math.min(ringSize * 0.29, 80);

  const chartData = useMemo(() => {
    const historyByDay = new Map(stepHistory.map((point) => [point.dayKey, point.steps]));
    const todayKey = recentDays[recentDays.length - 1];

    return recentDays.map((dayKey) => ({
      dayKey,
      steps: dayKey === todayKey
        ? Math.max(historyByDay.get(dayKey) ?? 0, cur)
        : historyByDay.get(dayKey) ?? 0,
    }));
  }, [cur, recentDays, stepHistory]);

  const chartMax = Math.max(tgt, ...chartData.map((point) => point.steps), 1);
  const weeklySteps = chartData.reduce((sum, point) => sum + point.steps, 0);
  const todayKey = recentDays[recentDays.length - 1];
  const selectedPoint = chartData.find((point) => point.dayKey === selectedDayKey)
    ?? chartData[chartData.length - 1];
  const selectedDateLabel = formatSelectedDate(selectedPoint.dayKey, todayKey);

  useEffect(() => {
    const id = setInterval(() => {
      setElapsedMs(Date.now() - openedAtRef.current);
    }, 1000);

    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadStepHistory = async () => {
      if (!accessToken) {
        setHistoryLoading(false);
        return;
      }

      try {
        const from = recentDays[0];
        const to = recentDays[recentDays.length - 1];
        const response = await authFetch(`${API_BASE_URL}/activity/steps/history?from=${from}&to=${to}`);
        if (!response.ok) return;

        const data = await response.json();
        if (!cancelled && Array.isArray(data?.history)) {
          setStepHistory(data.history);
        }
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    };

    loadStepHistory();
    return () => {
      cancelled = true;
    };
  }, [accessToken, authFetch, recentDays]);

  const paceMsPer1000 = useMemo(() => {
    if (sessionSteps <= 0 || elapsedMs <= 0) {
      return null;
    }

    return (elapsedMs / sessionSteps) * 1000;
  }, [elapsedMs, sessionSteps]);

  const etaMs = useMemo(() => {
    if (remaining === 0) {
      return 0;
    }

    if (!paceMsPer1000) {
      return null;
    }

    return (paceMsPer1000 * remaining) / 1000;
  }, [paceMsPer1000, remaining]);
  
  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <TouchableOpacity
        style={[styles.closeBtn, { top: insets.top + 8 }]}
        onPress={() => router.back()}
        activeOpacity={0.7}
      >
        <View style={styles.blurBtn}>
          <ChevronLeft size={22} color={COLORS.text} />
        </View>
      </TouchableOpacity>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingTop: insets.top + 68, paddingBottom: Math.max(insets.bottom + 24, 40) },
        ]}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
      >

        <View style={styles.mainContent}>
          <View style={styles.centerGroup}>
            <View style={[styles.completionRing, { width: ringSize, height: ringSize }]}>
              <Svg width={ringSize} height={ringSize} style={styles.ringSvg}>
                <Circle
                  cx={ringCenter}
                  cy={ringCenter}
                  r={ringRadius}
                  fill='none'
                  stroke={COLORS.border}
                  strokeWidth={ringStrokeWidth}
                />
                <Circle
                  cx={ringCenter}
                  cy={ringCenter}
                  r={ringRadius}
                  fill='none'
                  stroke={COLORS.primary}
                  strokeWidth={ringStrokeWidth}
                  strokeLinecap='round'
                  strokeDasharray={`${ringCircumference} ${ringCircumference}`}
                  strokeDashoffset={ringDashOffset}
                  transform={`rotate(-90 ${ringCenter} ${ringCenter})`}
                  opacity={progress > 0 ? 1 : 0}
                />
              </Svg>
              <View style={styles.ringContent}>
                <Animated.Text
                  entering={ZoomIn.delay(300)}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={[styles.bigNumber, { fontSize: bigNumberSize, lineHeight: bigNumberSize }]}
                >
                  {remaining.toLocaleString()}
                </Animated.Text>
                <Animated.Text entering={FadeInUp.delay(400)} style={styles.subLabel}>
                  Steps remaining
                </Animated.Text>
                <Text style={styles.liveCounter}>Live counter</Text>
              </View>
            </View>
          </View>

          <Animated.View entering={FadeInUp.delay(500)} style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <View>
                <Text style={styles.chartEyebrow}>7-day steps</Text>
                <View style={styles.chartValueRow}>
                  <Text style={styles.chartTotal}>{selectedPoint.steps.toLocaleString()}</Text>
                  <Text style={styles.chartUnit}>steps</Text>
                </View>
              </View>
              <Text style={styles.chartStatus}>
                {historyLoading ? 'Loading history…' : selectedDateLabel}
              </Text>
            </View>

            <View style={styles.chartPlot}>
              {chartData.map((point, index) => {
                const isToday = index === chartData.length - 1;
                const isSelected = point.dayKey === selectedDayKey;
                const barPercent = Math.max(point.steps > 0 ? 4 : 2, (point.steps / chartMax) * 100);

                return (
                  <TouchableOpacity
                    key={point.dayKey}
                    style={styles.chartColumn}
                    activeOpacity={0.82}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                    accessibilityRole='button'
                    accessibilityLabel={`${formatSelectedDate(point.dayKey, todayKey)}, ${point.steps.toLocaleString()} steps`}
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => {
                      setSelectedDayKey(point.dayKey);
                      Haptics.selectionAsync().catch(() => {});
                    }}
                  >
                    <View style={styles.chartBarTrack}>
                      <View
                        style={[
                          styles.chartBar,
                          isSelected
                            ? styles.chartBarSelected
                            : isToday
                              ? styles.chartBarToday
                              : styles.chartBarPrevious,
                          { height: `${barPercent}%` },
                        ]}
                      />
                    </View>
                    <Text style={[styles.chartDay, isSelected && styles.chartDaySelected]}>
                      {formatWeekday(point.dayKey)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.chartFooter}>
              <Text style={styles.chartFooterText}>Week total {weeklySteps.toLocaleString()}</Text>
              <Text style={styles.chartFooterText}>Daily goal {tgt.toLocaleString()}</Text>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(600)} style={styles.dashboard}>
            <View style={styles.dashboardHeader}>
              <Clock3 size={14} color={COLORS.primary} />
              <Text style={styles.dashboardTitle}>Session insights</Text>
              <View style={styles.timerPill}>
                <Text style={styles.timerText}>{formatElapsedClock(elapsedMs)}</Text>
              </View>
            </View>

            <View style={styles.metricsGrid}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabelSmall}>Pace per 1,000 steps</Text>
                <Text style={styles.metricValueLarge}>
                  {paceMsPer1000 ? formatDurationLabel(paceMsPer1000) : '--'}
                </Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.metricItem}>
                <Text style={styles.metricLabelSmall}>Estimated time left</Text>
                <Text style={styles.metricValueLarge}>
                  {etaMs === null ? '--' : formatDurationLabel(etaMs)}
                </Text>
              </View>
            </View>

            <View style={styles.sessionStatus}>
              <TrendingUp size={12} color={COLORS.muted} style={styles.sessionStatusIcon} />
              <Text style={styles.sessionStatusText}>
                {sessionSteps > 0
                  ? `${sessionSteps.toLocaleString()} steps this session`
                  : 'Waiting for new steps'}
              </Text>
            </View>
          </Animated.View>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: { 
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  closeBtn: {
    position: 'absolute',
    left: 24,
    zIndex: 10,
  },
  blurBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  mainContent: {
    width: '100%',
  },
  centerGroup: {
    alignItems: 'center',
    marginBottom: 24,
  },
  completionRing: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringSvg: {
    position: 'absolute',
  },
  ringContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  bigNumber: {
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: -8,
    fontVariant: ['tabular-nums'],
  },
  subLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 8,
    textAlign: 'center',
  },
  liveCounter: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.muted,
  },
  chartCard: {
    minHeight: 236,
    marginBottom: 24,
    padding: 20,
    borderRadius: 24,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  chartEyebrow: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  chartTotal: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.text,
    fontVariant: ['tabular-nums'],
  },
  chartValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  chartUnit: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.muted,
  },
  chartStatus: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  chartPlot: {
    height: 112,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  chartColumn: {
    flex: 1,
    alignItems: 'center',
  },
  chartBarTrack: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    borderRadius: 6,
    backgroundColor: COLORS.surfaceMuted,
  },
  chartBar: {
    width: '100%',
    borderRadius: 6,
  },
  chartBarPrevious: {
    backgroundColor: 'rgba(255,107,107,0.38)',
  },
  chartBarToday: {
    backgroundColor: 'rgba(255,107,107,0.62)',
  },
  chartBarSelected: {
    backgroundColor: COLORS.primary,
  },
  chartDay: {
    marginTop: 8,
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.muted,
  },
  chartDaySelected: {
    color: COLORS.primary,
    fontWeight: '900',
  },
  chartFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  chartFooterText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.muted,
  },
  dashboard: {
    backgroundColor: COLORS.surface,
    borderRadius: 32,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dashboardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dashboardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginLeft: 10,
  },
  timerPill: {
    marginLeft: 'auto',
    backgroundColor: COLORS.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  timerText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.muted,
    fontVariant: ['tabular-nums'],
  },
  metricsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  metricItem: {
    flex: 1,
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.border,
    marginHorizontal: 20,
  },
  metricLabelSmall: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.muted,
    marginBottom: 8,
  },
  metricValueLarge: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.text,
    marginBottom: 4,
  },
  sessionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceMuted,
    padding: 12,
    borderRadius: 16,
  },
  sessionStatusIcon: {
    marginRight: 8,
  },
  sessionStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.muted,
  },
});
