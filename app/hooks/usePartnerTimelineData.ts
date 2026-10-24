import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { API_BASE_URL } from '@/config/api';
import { usePartnerMemories } from '@/hooks/usePartnerMemories';
import { getMappedDays, type DaySchedule } from '@/utils/planProjection';
import type {
    PartnerDaySummary,
    ScheduledPartnerRun,
    TimelineWeightHistoryEntry,
    PartnerMarketplaceHistoryEntry,
} from '@/utils/partnerTimeline';

const POINTS_CATEGORY_LABELS: Record<string, string> = {
    WALK_RUN: 'Walk / Run',
    STEPS: 'Steps',
    CALORIES: 'Nutrition',
    MOBILITY: 'Mobility',
    HYDRATION: 'Hydration',
};

export type PartnerPointsHistoryEntry = {
    dayKey: string;
    awardedAt: string;
    category: string;
    categoryLabel: string;
    earnedPoints: number;
    maxPoints: number;
    progress: number;
};

type TodaySummary = {
    steps: number;
    stepsTarget?: number;
    distanceKm: number;
    runKmTarget: number;
    exerciseMinutes: number;
};

type WagerOverview = {
    currentWager?: {
        title?: string;
        status?: string;
        weekStart?: string;
        weekEnd?: string;
    } | null;
};

function mergeWeightHistory(
    ...sources: TimelineWeightHistoryEntry[][]
): TimelineWeightHistoryEntry[] {
    const byId = new Map<string, TimelineWeightHistoryEntry>();
    for (const source of sources) {
        for (const entry of source) {
            byId.set(entry.id, entry);
        }
    }
    return [...byId.values()].sort(
        (a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime(),
    );
}

export function usePartnerTimelineData(
    authFetch: (url: string, options?: RequestInit) => Promise<Response>,
    accessToken: string | null,
    enabled: boolean,
) {
    const [loading, setLoading] = useState(false);
    const [partnerWeekDays, setPartnerWeekDays] = useState<PartnerDaySummary[]>([]);
    const [partnerWeekStart, setPartnerWeekStart] = useState<string | undefined>();
    const [partnerPlannedDays, setPartnerPlannedDays] = useState<DaySchedule[]>([]);
    const [pointsHistory, setPointsHistory] = useState<PartnerPointsHistoryEntry[]>([]);
    const [myPointsHistory, setMyPointsHistory] = useState<PartnerPointsHistoryEntry[]>([]);
    const [partnerWeightHistory, setPartnerWeightHistory] = useState<TimelineWeightHistoryEntry[]>([]);
    const [myWeightHistory, setMyWeightHistory] = useState<TimelineWeightHistoryEntry[]>([]);
    const [partnerMarketplaceHistory, setPartnerMarketplaceHistory] = useState<PartnerMarketplaceHistoryEntry[]>([]);
    const [scheduledRuns, setScheduledRuns] = useState<ScheduledPartnerRun[]>([]);
    const [myTodaySummary, setMyTodaySummary] = useState<TodaySummary | null>(null);
    const [wagerOverview, setWagerOverview] = useState<WagerOverview | null>(null);

    const {
        memories: partnerMemories,
        uploading: memoryUploading,
        syncMemories,
        uploadMemory,
    } = usePartnerMemories(authFetch, accessToken, enabled);

    const fetchTimelineData = useCallback(async () => {
        if (!enabled) return;
        setLoading(true);
        try {
            const [
                mySummaryRes,
                partnerWeekRes,
                wagerOverviewRes,
                activeWagerRes,
                pointsHistoryRes,
                partnerWeightHistoryRes,
                myWeightRes,
                scheduledRunsRes,
                partnerPlanRes,
                marketplaceHistoryRes,
                partnerRes,
            ] = await Promise.all([
                authFetch(`${API_BASE_URL}/summary/today`),
                authFetch(`${API_BASE_URL}/summary/partner/week`),
                authFetch(`${API_BASE_URL}/wager/overview`),
                authFetch(`${API_BASE_URL}/wager/active`),
                authFetch(`${API_BASE_URL}/partner/points-history`),
                authFetch(`${API_BASE_URL}/partner/weight-history`),
                authFetch(`${API_BASE_URL}/weight`),
                authFetch(`${API_BASE_URL}/runtogether/active`),
                authFetch(`${API_BASE_URL}/plan/partner/weekly`),
                authFetch(`${API_BASE_URL}/marketplace/history`),
                authFetch(`${API_BASE_URL}/partner`),
            ]);

            const [
                mySummaryData,
                partnerWeekData,
                wagerOverviewData,
                activeWagerData,
                pointsHistoryData,
                partnerWeightHistoryData,
                myWeightData,
                scheduledRunsData,
                partnerPlanData,
                marketplaceHistoryData,
                partnerData,
            ] = await Promise.all([
                mySummaryRes.json(),
                partnerWeekRes.json(),
                wagerOverviewRes.json(),
                activeWagerRes.json(),
                pointsHistoryRes.json().catch(() => ({ entries: [] })),
                partnerWeightHistoryRes.json().catch(() => ({ entries: [] })),
                myWeightRes.json().catch(() => ({ history: [] })),
                scheduledRunsRes.json().catch(() => ({ sent: [], received: [] })),
                partnerPlanRes.json().catch(() => null),
                marketplaceHistoryRes.json().catch(() => ({ history: [] })),
                partnerRes.json(),
            ]);

            const resolvedCurrentWager = wagerOverviewData?.currentWager ?? activeWagerData?.wager ?? null;

            setMyTodaySummary(mySummaryData ?? null);
            setPartnerWeekDays(Array.isArray(partnerWeekData?.days) ? partnerWeekData.days : []);
            setPartnerWeekStart(partnerWeekData?.weekStart);
            setPointsHistory(Array.isArray(pointsHistoryData?.entries) ? pointsHistoryData.entries : []);
            setPartnerWeightHistory((previous) =>
                mergeWeightHistory(
                    previous,
                    Array.isArray(partnerData?.partnerWeightHistory) ? partnerData.partnerWeightHistory : [],
                    Array.isArray(partnerWeightHistoryData?.entries) ? partnerWeightHistoryData.entries : [],
                ),
            );
            setMyWeightHistory(
                Array.isArray(myWeightData?.history)
                    ? myWeightData.history.map((entry: TimelineWeightHistoryEntry) => ({
                          id: entry.id,
                          weightKg: entry.weightKg,
                          loggedAt: entry.loggedAt,
                      }))
                    : [],
            );
            setPartnerMarketplaceHistory(
                Array.isArray(marketplaceHistoryData?.history)
                    ? marketplaceHistoryData.history.map((entry: PartnerMarketplaceHistoryEntry) => ({
                          id: entry.id,
                          title: entry.title,
                          icon: entry.icon,
                          status: entry.status,
                          boughtByUserId: entry.boughtByUserId ?? null,
                          owedByUserId: entry.owedByUserId,
                          boughtAt: entry.boughtAt,
                          fulfilledAt: entry.fulfilledAt ?? null,
                      }))
                    : [],
            );

            const weekDays = Array.isArray(partnerWeekData?.days) ? partnerWeekData.days : [];
            const timelineDayKeys = [
                ...new Set([
                    ...weekDays.map((day: PartnerDaySummary) => day.dayKey),
                    ...(Array.isArray(pointsHistoryData?.entries)
                        ? pointsHistoryData.entries.map((entry: PartnerPointsHistoryEntry) => entry.dayKey)
                        : []),
                ]),
            ];
            const myPointsResults = await Promise.all(
                timelineDayKeys.map((dayKey) =>
                    authFetch(`${API_BASE_URL}/points/daily/${dayKey}`)
                        .then((res) => res.json())
                        .catch(() => ({ entries: [] })),
                ),
            );
            const resolvedMyPointsHistory: PartnerPointsHistoryEntry[] = [];
            timelineDayKeys.forEach((dayKey, index) => {
                const data = myPointsResults[index];
                for (const entry of data?.entries ?? []) {
                    if (!entry?.earnedPoints) continue;
                    resolvedMyPointsHistory.push({
                        dayKey,
                        awardedAt: entry.awardedAt,
                        category: entry.category,
                        categoryLabel: POINTS_CATEGORY_LABELS[entry.category] ?? entry.category,
                        earnedPoints: entry.earnedPoints,
                        maxPoints: entry.maxPoints ?? 0,
                        progress: entry.progress ?? 0,
                    });
                }
            });
            setMyPointsHistory(resolvedMyPointsHistory);

            const weeklyPlanTable = Array.isArray(partnerPlanData?.['Weekly Plan Table'])
                ? partnerPlanData['Weekly Plan Table']
                : [];
            const currentPlanWeek = partnerPlanData?.plan?.currentWeek ?? weeklyPlanTable[0]?.Week ?? 1;
            const currentWeekPlan =
                weeklyPlanTable.find((week: { Week?: number }) => week.Week === currentPlanWeek) ??
                weeklyPlanTable[weeklyPlanTable.length - 1];
            const availableDays = partnerPlanData?.plan?.availableDays;
            setPartnerPlannedDays(currentWeekPlan ? getMappedDays(currentWeekPlan, availableDays) : []);

            const activeRuns = [
                ...(Array.isArray(scheduledRunsData?.sent) ? scheduledRunsData.sent : []),
                ...(Array.isArray(scheduledRunsData?.received) ? scheduledRunsData.received : []),
            ].map((run: ScheduledPartnerRun) => ({
                id: run.id,
                scheduledTime: run.scheduledTime,
                distanceKm: run.distanceKm,
                status: run.status,
                isSender: run.isSender,
                partnerName: run.partnerName,
            }));
            setScheduledRuns(activeRuns);

            setWagerOverview(
                wagerOverviewData
                    ? { ...wagerOverviewData, currentWager: resolvedCurrentWager }
                    : { currentWager: resolvedCurrentWager },
            );
        } catch (error) {
            console.log('[usePartnerTimelineData] fetch error:', error);
        } finally {
            setLoading(false);
            void syncMemories();
        }
    }, [authFetch, enabled, syncMemories]);

    useFocusEffect(
        useCallback(() => {
            void fetchTimelineData();
        }, [fetchTimelineData]),
    );

    return {
        loading,
        partnerWeekDays,
        partnerWeekStart,
        partnerPlannedDays,
        pointsHistory,
        myPointsHistory,
        partnerWeightHistory,
        myWeightHistory,
        partnerMarketplaceHistory,
        partnerMemories,
        memoryUploading,
        uploadMemory,
        scheduledRuns,
        myTodaySummary,
        wagerOverview,
        refetch: fetchTimelineData,
    };
}
