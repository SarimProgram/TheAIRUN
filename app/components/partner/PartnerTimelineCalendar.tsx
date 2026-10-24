import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView,
} from 'react-native';
import {
    AlertTriangle,
    Bell,
    Calendar,
    CheckCircle2,
    Footprints,
    Heart,
    MessageCircle,
    MessageCircleMore,
    Sparkles,
    Trophy,
    Users,
} from 'lucide-react-native';
import type { DaySchedule } from '@/utils/planProjection';
import PartnerNoteCompose from '@/components/chat/PartnerNoteCompose';
import {
    buildPartnerTimelineEvents,
    buildWeekDayShell,
    flattenTimelineEvents,
    formatTimelineDayLabel,
    formatWeekRangeLabel,
    type PartnerDaySummary,
    type PartnerPointsHistoryEntry,
    type PartnerTimelineEvent,
    type ScheduledPartnerRun,
    type TimelineChatMessage,
} from '@/utils/partnerTimeline';

const COLORS = {
    primary: '#FF6B6B',
    primaryLight: '#FFF5F5',
    bg: '#FFFFFF',
    border: '#F1F5F9',
    text: '#1F2937',
    muted: '#64748B',
    success: '#10B981',
    successLight: '#ECFDF5',
    warning: '#F59E0B',
    warningLight: '#FFFBEB',
    info: '#3B82F6',
    infoLight: '#EFF6FF',
    spine: '#FECACA',
    noteBg: '#FFF8DC',
    notePartnerBg: '#F0EDE4',
};

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

type WagerOverview = {
    currentWager?: {
        title?: string;
        status?: string;
        weekStart?: string;
        weekEnd?: string;
    } | null;
    currentLeader?: {
        winner?: 'YOU' | 'PARTNER' | 'TIE';
        yourWeek?: { totalDistanceKm?: number };
        partnerWeek?: { totalDistanceKm?: number };
        statusLabel?: string;
    } | null;
};

type MyTodaySummary = {
    steps: number;
    stepsTarget?: number;
    distanceKm: number;
    runKmTarget: number;
    exerciseMinutes: number;
};

type PartnerTimelineCalendarProps = {
    partnerName: string;
    weekStart?: string;
    weekEnd?: string;
    days: PartnerDaySummary[];
    plannedDays: DaySchedule[];
    pointsHistory: PartnerPointsHistoryEntry[];
    scheduledRuns: ScheduledPartnerRun[];
    chatMessages?: TimelineChatMessage[];
    currentUserId?: string | null;
    myTodaySummary?: MyTodaySummary | null;
    wagerOverview: WagerOverview | null;
    partnerWeekProgress?: {
        weeklyKm?: number;
        weeklyKmTarget?: number;
        activeStreak?: number;
    } | null;
    showCaloriesWarning: boolean;
    partnerCaloriesOverTarget: number;
    partnerNeedsWaterNudge: boolean;
    waterNudgeSent: boolean;
    onCaloriesNudge: () => void;
    onWaterNudge: () => void;
    onPostNote?: (content: string) => void;
    chatConnected?: boolean;
    loading?: boolean;
};

function getEventIcon(event: PartnerTimelineEvent) {
    switch (event.kind) {
        case 'planned_run':
            return Footprints;
        case 'milestone':
            return Sparkles;
        case 'activity':
            return CheckCircle2;
        case 'points':
            return Heart;
        case 'run_together':
            return Users;
        case 'wager':
            return Trophy;
        case 'note':
            return MessageCircle;
        case 'alert':
            return AlertTriangle;
        default:
            return Calendar;
    }
}

function getEventToneStyle(tone: PartnerTimelineEvent['tone'], actor: PartnerTimelineEvent['actor']) {
    switch (tone) {
        case 'success':
            return {
                card: styles.eventCardSuccess,
                icon: styles.eventIconSuccess,
                iconColor: COLORS.success,
            };
        case 'warning':
            return {
                card: styles.eventCardWarning,
                icon: styles.eventIconWarning,
                iconColor: COLORS.warning,
            };
        case 'info':
            return {
                card: styles.eventCardInfo,
                icon: styles.eventIconInfo,
                iconColor: COLORS.info,
            };
        default:
            return {
                card: actor === 'you' ? styles.eventCardYou : styles.eventCardDefault,
                icon: styles.eventIconDefault,
                iconColor: COLORS.primary,
            };
    }
}

function TimelineEventCard({
    event,
    showCaloriesWarning,
    partnerNeedsWaterNudge,
    waterNudgeSent,
    onCaloriesNudge,
    onWaterNudge,
}: {
    event: PartnerTimelineEvent;
    showCaloriesWarning: boolean;
    partnerNeedsWaterNudge: boolean;
    waterNudgeSent: boolean;
    onCaloriesNudge: () => void;
    onWaterNudge: () => void;
}) {
    const Icon = getEventIcon(event);
    const tone =
        event.kind === 'note'
            ? {
                card: event.actor === 'you' ? styles.eventCardNoteYou : styles.eventCardNotePartner,
                icon: styles.eventIconDefault,
                iconColor: COLORS.text,
            }
            : getEventToneStyle(event.tone, event.actor);

    const showCaloriesAction = event.id.endsWith('-calories-alert') && showCaloriesWarning;
    const showWaterAction =
        event.id.endsWith('-water-alert') && partnerNeedsWaterNudge && !waterNudgeSent;

    return (
        <View style={[styles.eventCard, tone.card]}>
            <View style={styles.eventTopRow}>
                <View style={[styles.eventIcon, tone.icon]}>
                    <Icon size={16} color={tone.iconColor} />
                </View>
                <View style={styles.eventText}>
                    <Text style={styles.eventTitle}>{event.title}</Text>
                    {event.subtitle ? (
                        <Text
                            style={[
                                styles.eventSubtitle,
                                event.kind === 'note' && styles.eventNoteBody,
                            ]}
                        >
                            {event.subtitle}
                        </Text>
                    ) : null}
                </View>
                {event.timeLabel ? <Text style={styles.eventTime}>{event.timeLabel}</Text> : null}
            </View>

            {showCaloriesAction || showWaterAction ? (
                <View style={styles.eventActions}>
                    {showCaloriesAction ? (
                        <TouchableOpacity style={styles.eventActionButton} onPress={onCaloriesNudge}>
                            <MessageCircleMore size={14} color={COLORS.warning} />
                            <Text style={styles.eventActionText}>Nudge</Text>
                        </TouchableOpacity>
                    ) : null}
                    {showWaterAction ? (
                        <TouchableOpacity style={styles.eventActionButton} onPress={onWaterNudge}>
                            <Bell size={14} color={COLORS.info} />
                            <Text style={styles.eventActionText}>Remind</Text>
                        </TouchableOpacity>
                    ) : null}
                </View>
            ) : null}
        </View>
    );
}

export function PartnerTimelineCalendar({
    partnerName,
    weekStart,
    weekEnd,
    days,
    plannedDays,
    pointsHistory,
    scheduledRuns,
    chatMessages = [],
    currentUserId,
    myTodaySummary,
    wagerOverview,
    partnerWeekProgress,
    showCaloriesWarning,
    partnerCaloriesOverTarget,
    partnerNeedsWaterNudge,
    waterNudgeSent,
    onCaloriesNudge,
    onWaterNudge,
    onPostNote,
    chatConnected = false,
    loading = false,
}: PartnerTimelineCalendarProps) {
    const dateStripRef = useRef<ScrollView>(null);

    const resolvedDays = useMemo(
        () => (days.length > 0 ? days : buildWeekDayShell(weekStart)),
        [days, weekStart]
    );

    const todayDayKey = useMemo(
        () => resolvedDays.find((day) => day.isToday)?.dayKey ?? resolvedDays[0]?.dayKey ?? null,
        [resolvedDays]
    );

    const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
    const activeDayKey = selectedDayKey ?? todayDayKey;

    useEffect(() => {
        if (!selectedDayKey && todayDayKey) {
            setSelectedDayKey(todayDayKey);
        }
    }, [selectedDayKey, todayDayKey]);

    const eventsByDay = useMemo(
        () =>
            buildPartnerTimelineEvents({
                partnerName,
                days: resolvedDays,
                plannedDays,
                pointsHistory,
                scheduledRuns,
                chatMessages,
                currentUserId,
                myTodaySummary,
                activeWager: wagerOverview?.currentWager ?? null,
                showCaloriesWarning,
                partnerCaloriesOverTarget,
                partnerNeedsWaterNudge,
                waterNudgeSent,
            }),
        [
            chatMessages,
            currentUserId,
            myTodaySummary,
            partnerCaloriesOverTarget,
            partnerName,
            partnerNeedsWaterNudge,
            plannedDays,
            pointsHistory,
            resolvedDays,
            scheduledRuns,
            showCaloriesWarning,
            wagerOverview?.currentWager,
            waterNudgeSent,
        ]
    );

    const timelineEvents = useMemo(
        () => flattenTimelineEvents(eventsByDay, resolvedDays, activeDayKey),
        [activeDayKey, eventsByDay, resolvedDays]
    );

    const activeWager = wagerOverview?.currentWager ?? null;
    const currentLeader = wagerOverview?.currentLeader ?? null;

    useEffect(() => {
        if (!todayDayKey || resolvedDays.length === 0) return;
        const todayIndex = resolvedDays.findIndex((day) => day.dayKey === todayDayKey);
        if (todayIndex < 0) return;
        const wagerOffset = activeWager ? 178 : 0;
        const scrollX = Math.max(0, wagerOffset + todayIndex * 68 - 120);
        const timer = setTimeout(() => {
            dateStripRef.current?.scrollTo({ x: scrollX, animated: true });
        }, 120);
        return () => clearTimeout(timer);
    }, [activeWager, resolvedDays, todayDayKey]);

    const handleSelectDay = (dayKey: string) => {
        setSelectedDayKey(dayKey);
    };

    if (loading) {
        return (
            <View style={styles.loadingCard}>
                <ActivityIndicator color={COLORS.primary} />
            </View>
        );
    }

    return (
        <View style={styles.root}>
            <View style={styles.weekHeader}>
                <View>
                    <Text style={styles.weekEyebrow}>Partner timeline</Text>
                    <Text style={styles.weekTitle}>{formatWeekRangeLabel(weekStart, weekEnd)}</Text>
                </View>
                <View style={styles.weekBadge}>
                    <Calendar size={14} color={COLORS.primary} />
                </View>
            </View>

            <ScrollView
                ref={dateStripRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.dateStripContent}
            >
                {activeWager ? (
                    <View style={styles.wagerPill}>
                        <View style={styles.wagerPillTop}>
                            <Trophy size={14} color="#FBBF24" />
                            <Text style={styles.wagerPillTag}>Active wager</Text>
                            {activeWager.status === 'ACTIVE' ? <View style={styles.liveDot} /> : null}
                        </View>
                        <Text style={styles.wagerPillTitle} numberOfLines={2}>
                            {activeWager.title || 'Weekly wager'}
                        </Text>
                        {currentLeader ? (
                            <Text style={styles.wagerPillMeta}>
                                You {(currentLeader.yourWeek?.totalDistanceKm ?? 0).toFixed(1)} km ·{' '}
                                {partnerName} {(currentLeader.partnerWeek?.totalDistanceKm ?? 0).toFixed(1)} km
                            </Text>
                        ) : (
                            <Text style={styles.wagerPillMeta}>
                                {activeWager.status === 'PENDING' ? 'Waiting to start' : 'In progress'}
                            </Text>
                        )}
                    </View>
                ) : null}

                {resolvedDays.map((day) => {
                    const [, , dateNum] = day.dayKey.split('-').map(Number);
                    const isSelected = day.dayKey === activeDayKey;
                    const eventCount = eventsByDay.get(day.dayKey)?.length ?? 0;
                    const hasRun = plannedDays[day.dayIndex]?.type === 'RUN';

                    return (
                        <TouchableOpacity
                            key={day.dayKey}
                            style={[styles.datePill, isSelected && styles.datePillSelected]}
                            onPress={() => handleSelectDay(day.dayKey)}
                            activeOpacity={0.85}
                        >
                            <Text style={[styles.datePillDay, isSelected && styles.datePillDaySelected]}>
                                {DAY_LABELS[day.dayIndex]}
                            </Text>
                            <Text style={[styles.datePillDate, isSelected && styles.datePillDateSelected]}>
                                {dateNum}
                            </Text>
                            <View style={styles.datePillDots}>
                                {hasRun ? (
                                    <View
                                        style={[
                                            styles.datePillDot,
                                            isSelected ? styles.datePillDotSelected : styles.datePillDotRun,
                                        ]}
                                    />
                                ) : null}
                                {eventCount > 0 ? (
                                    <View
                                        style={[
                                            styles.datePillDot,
                                            isSelected ? styles.datePillDotSelected : styles.datePillDotActivity,
                                        ]}
                                    />
                                ) : null}
                            </View>
                            {day.isToday ? <View style={styles.todayMarker} /> : null}
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            <View style={styles.summaryRow}>
                <View style={styles.summaryChip}>
                    <Text style={styles.summaryChipValue}>
                        {(partnerWeekProgress?.weeklyKm ?? 0).toFixed(1)} km
                    </Text>
                    <Text style={styles.summaryChipLabel}>This week</Text>
                </View>
                <View style={styles.summaryChip}>
                    <Text style={styles.summaryChipValue}>{partnerWeekProgress?.activeStreak ?? 0}</Text>
                    <Text style={styles.summaryChipLabel}>Day streak</Text>
                </View>
                <View style={styles.summaryChip}>
                    <Text style={styles.summaryChipValue}>
                        {(partnerWeekProgress?.weeklyKmTarget ?? 0).toFixed(0)} km
                    </Text>
                    <Text style={styles.summaryChipLabel}>Target</Text>
                </View>
            </View>

            <View style={styles.timelineSection}>
                <Text style={styles.timelineSectionTitle}>
                    {activeDayKey
                        ? formatTimelineDayLabel(
                              activeDayKey,
                              resolvedDays.find((day) => day.dayKey === activeDayKey)?.isToday ?? false
                          )
                        : 'This week'}
                </Text>

                <View style={styles.timelineScrollContent}>
                    {timelineEvents.length === 0 ? (
                        <View style={styles.emptyDayCard}>
                            <Text style={styles.emptyDayTitle}>Nothing logged yet</Text>
                            <Text style={styles.emptyDayBody}>
                                Activity, points, wagers, and posts from you and {partnerName} will show up here.
                            </Text>
                        </View>
                    ) : (
                        timelineEvents.map((event, index) => {
                            const isYou = event.actor === 'you';
                            const isLast = index === timelineEvents.length - 1;

                            return (
                                <View key={event.id} style={styles.zigzagRow}>
                                    <View style={[styles.zigzagSide, isYou && styles.zigzagSideRight]}>
                                        {!isYou ? (
                                            <TimelineEventCard
                                                event={event}
                                                showCaloriesWarning={showCaloriesWarning}
                                                partnerNeedsWaterNudge={partnerNeedsWaterNudge}
                                                waterNudgeSent={waterNudgeSent}
                                                onCaloriesNudge={onCaloriesNudge}
                                                onWaterNudge={onWaterNudge}
                                            />
                                        ) : null}
                                    </View>

                                    <View style={styles.zigzagSpine}>
                                        {!isLast ? <View style={styles.zigzagLine} /> : null}
                                        <View
                                            style={[
                                                styles.zigzagDot,
                                                isYou ? styles.zigzagDotYou : styles.zigzagDotPartner,
                                            ]}
                                        />
                                    </View>

                                    <View style={[styles.zigzagSide, !isYou && styles.zigzagSideRight]}>
                                        {isYou ? (
                                            <TimelineEventCard
                                                event={event}
                                                showCaloriesWarning={showCaloriesWarning}
                                                partnerNeedsWaterNudge={partnerNeedsWaterNudge}
                                                waterNudgeSent={waterNudgeSent}
                                                onCaloriesNudge={onCaloriesNudge}
                                                onWaterNudge={onWaterNudge}
                                            />
                                        ) : null}
                                    </View>
                                </View>
                            );
                        })
                    )}
                </View>
            </View>

            {onPostNote ? (
                <View style={styles.composeShell}>
                    <PartnerNoteCompose
                        partnerName={partnerName}
                        compact
                        disabled={!chatConnected}
                        onSend={onPostNote}
                    />
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        gap: 14,
    },
    loadingCard: {
        paddingVertical: 48,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 24,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    weekHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    weekEyebrow: {
        fontSize: 11,
        fontWeight: '800',
        color: COLORS.muted,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 4,
    },
    weekTitle: {
        fontSize: 22,
        fontWeight: '900',
        color: COLORS.text,
        letterSpacing: -0.5,
    },
    weekBadge: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: COLORS.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dateStripContent: {
        gap: 10,
        paddingRight: 4,
    },
    wagerPill: {
        width: 168,
        borderRadius: 18,
        padding: 14,
        backgroundColor: '#111827',
        marginRight: 2,
    },
    wagerPillTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
    },
    wagerPillTag: {
        fontSize: 10,
        fontWeight: '800',
        color: 'rgba(255,255,255,0.65)',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        flex: 1,
    },
    liveDot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: '#34D399',
    },
    wagerPillTitle: {
        fontSize: 15,
        fontWeight: '900',
        color: '#FFFFFF',
        marginBottom: 6,
    },
    wagerPillMeta: {
        fontSize: 12,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.72)',
        lineHeight: 16,
    },
    datePill: {
        width: 58,
        alignItems: 'center',
        paddingVertical: 10,
        borderRadius: 16,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: COLORS.border,
        minHeight: 78,
    },
    datePillSelected: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    datePillDay: {
        fontSize: 11,
        fontWeight: '800',
        color: COLORS.muted,
        marginBottom: 4,
    },
    datePillDaySelected: {
        color: 'rgba(255,255,255,0.82)',
    },
    datePillDate: {
        fontSize: 18,
        fontWeight: '900',
        color: COLORS.text,
    },
    datePillDateSelected: {
        color: '#FFFFFF',
    },
    datePillDots: {
        flexDirection: 'row',
        gap: 4,
        marginTop: 8,
        minHeight: 6,
    },
    datePillDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
    },
    datePillDotRun: {
        backgroundColor: '#8B5CF6',
    },
    datePillDotActivity: {
        backgroundColor: COLORS.success,
    },
    datePillDotSelected: {
        backgroundColor: 'rgba(255,255,255,0.82)',
    },
    todayMarker: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: COLORS.primary,
    },
    summaryRow: {
        flexDirection: 'row',
        gap: 8,
    },
    summaryChip: {
        flex: 1,
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 10,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'center',
    },
    summaryChipValue: {
        fontSize: 16,
        fontWeight: '900',
        color: COLORS.text,
        marginBottom: 2,
    },
    summaryChipLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: COLORS.muted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    timelineSection: {
        borderRadius: 22,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: COLORS.border,
        overflow: 'hidden',
    },
    timelineSectionTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: COLORS.text,
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
    },
    timelineScrollContent: {
        paddingHorizontal: 12,
        paddingBottom: 16,
    },
    zigzagRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        minHeight: 72,
    },
    zigzagSide: {
        flex: 1,
        paddingBottom: 14,
        paddingRight: 6,
    },
    zigzagSideRight: {
        paddingRight: 0,
        paddingLeft: 6,
    },
    zigzagSpine: {
        width: 18,
        alignItems: 'center',
        position: 'relative',
        paddingTop: 8,
    },
    zigzagLine: {
        position: 'absolute',
        top: 18,
        bottom: -8,
        width: 2,
        backgroundColor: COLORS.spine,
        borderRadius: 1,
    },
    zigzagDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 2,
        backgroundColor: '#FFFFFF',
        zIndex: 1,
    },
    zigzagDotPartner: {
        borderColor: COLORS.primary,
    },
    zigzagDotYou: {
        borderColor: COLORS.info,
        backgroundColor: COLORS.infoLight,
    },
    emptyDayCard: {
        borderRadius: 16,
        padding: 14,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: 8,
    },
    emptyDayTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: COLORS.text,
        marginBottom: 4,
    },
    emptyDayBody: {
        fontSize: 13,
        lineHeight: 18,
        color: COLORS.muted,
    },
    eventCard: {
        borderRadius: 16,
        padding: 12,
        borderWidth: 1,
    },
    eventCardDefault: {
        backgroundColor: '#FFFFFF',
        borderColor: COLORS.border,
    },
    eventCardYou: {
        backgroundColor: COLORS.infoLight,
        borderColor: '#BFDBFE',
    },
    eventCardNoteYou: {
        backgroundColor: COLORS.noteBg,
        borderColor: '#F5E6B8',
    },
    eventCardNotePartner: {
        backgroundColor: COLORS.notePartnerBg,
        borderColor: '#DDD8CB',
    },
    eventCardSuccess: {
        backgroundColor: COLORS.successLight,
        borderColor: '#A7F3D0',
    },
    eventCardWarning: {
        backgroundColor: COLORS.warningLight,
        borderColor: '#FDE68A',
    },
    eventCardInfo: {
        backgroundColor: COLORS.infoLight,
        borderColor: '#BFDBFE',
    },
    eventTopRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
    },
    eventIcon: {
        width: 28,
        height: 28,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
    },
    eventIconDefault: {
        backgroundColor: COLORS.primaryLight,
    },
    eventIconSuccess: {
        backgroundColor: '#D1FAE5',
    },
    eventIconWarning: {
        backgroundColor: '#FEF3C7',
    },
    eventIconInfo: {
        backgroundColor: '#DBEAFE',
    },
    eventText: {
        flex: 1,
        minWidth: 0,
    },
    eventTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: COLORS.text,
        marginBottom: 2,
    },
    eventSubtitle: {
        fontSize: 12,
        lineHeight: 17,
        color: COLORS.muted,
    },
    eventNoteBody: {
        color: COLORS.text,
        fontWeight: '600',
    },
    eventTime: {
        fontSize: 10,
        fontWeight: '700',
        color: COLORS.muted,
    },
    eventActions: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 10,
    },
    eventActionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 999,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    eventActionText: {
        fontSize: 12,
        fontWeight: '800',
        color: COLORS.text,
    },
    composeShell: {
        marginTop: 2,
    },
});
