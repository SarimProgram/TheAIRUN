import React, { useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    AlertTriangle,
    ArrowLeft,
    Bell,
    Calendar,
    CheckCircle2,
    Footprints,
    Heart,
    MessageCircle,
    MessageCircleMore,
    MoreHorizontal,
    Sparkles,
    Trophy,
    Users,
} from 'lucide-react-native';
import type { DaySchedule } from '@/utils/planProjection';
import {
    buildPartnerTimelineEvents,
    buildTimelineDaysFromKeys,
    buildWeekDayShell,
    collectTimelineDayKeys,
    type PartnerDaySummary,
    type PartnerPointsHistoryEntry,
    type PartnerTimelineEvent,
    type ScheduledPartnerRun,
} from '@/utils/partnerTimeline';

const COLORS = {
    primary: '#FF6B6B',
    primaryFade: '#FDECEC',
    primaryFadeSoft: '#FFF5F5',
    primaryDeep: '#E24C5B',
    secondary: '#2EC4B6',
    secondaryFade: '#E8F6F4',
    secondaryFadeSoft: '#F1FAF8',
    secondaryDeep: '#0F9E92',
    bg: '#FFFFFF',
    surface: '#F8FAFC',
    card: '#FFFFFF',
    text: '#1F2937',
    textStrong: '#0F172A',
    muted: '#64748B',
    subtle: '#94A3B8',
    border: '#F1F5F9',
    borderStrong: '#E2E8F0',
    divider: '#EEF2F6',
    spine: '#F3D5D8',
};

type WagerOverview = {
    currentWager?: {
        title?: string;
        status?: string;
        weekStart?: string;
        weekEnd?: string;
    } | null;
};

type MyTodaySummary = {
    steps: number;
    stepsTarget?: number;
    distanceKm: number;
    runKmTarget: number;
    exerciseMinutes: number;
};

type TimelineDateGroup = {
    dayKey: string;
    dateLabel: string;
    dayLabel: string;
    monthLabel: string;
    dateNum: string;
    isToday: boolean;
    events: PartnerTimelineEvent[];
};

type ConnectedPartnersProps = {
    userName?: string;
    partnerName?: string;
    daysTogether?: number;
    weekStart?: string;
    days?: PartnerDaySummary[];
    plannedDays?: DaySchedule[];
    pointsHistory?: PartnerPointsHistoryEntry[];
    myPointsHistory?: PartnerPointsHistoryEntry[];
    scheduledRuns?: ScheduledPartnerRun[];
    myTodaySummary?: MyTodaySummary | null;
    wagerOverview?: WagerOverview | null;
    showCaloriesWarning?: boolean;
    partnerCaloriesOverTarget?: number;
    partnerNeedsWaterNudge?: boolean;
    waterNudgeSent?: boolean;
    loading?: boolean;
    onBack?: () => void;
    onMore?: () => void;
    onAddMemory?: () => void;
    onAddReminder?: () => void;
    onCaloriesNudge?: () => void;
    onWaterNudge?: () => void;
    /** @deprecated use onAddMemory */
    onAddMoment?: () => void;
};

function dayKeyToDateParts(dayKey: string) {
    const [year, month, day] = dayKey.split('-').map(Number);
    if (!year || !month || !day) {
        return {
            monthLabel: dayKey.slice(5, 7),
            dateNum: dayKey.slice(8, 10),
            dayLabel: dayKey,
            dateLabel: dayKey,
        };
    }

    const date = new Date(year, month - 1, day);
    return {
        monthLabel: date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
        dateNum: String(day),
        dayLabel: date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
        dateLabel: date
            .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            .toUpperCase(),
    };
}

function formatEventTime(event: PartnerTimelineEvent) {
    if (event.timeLabel) return event.timeLabel;
    const date = new Date(event.sortAt);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function getEventIcon(event: PartnerTimelineEvent) {
    switch (event.kind) {
        case 'planned_run':
            return Footprints;
        case 'milestone':
            return Sparkles;
        case 'activity':
            return CheckCircle2;
        case 'points':
            return Trophy;
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

function getEventIconColor(event: PartnerTimelineEvent) {
    if (event.actor === 'you') return COLORS.primary;
    if (event.tone === 'success') return COLORS.secondaryDeep;
    if (event.tone === 'warning') return '#D97706';
    if (event.tone === 'info') return '#2563EB';
    return COLORS.secondary;
}

function groupTimelineByDay(
    resolvedDays: PartnerDaySummary[],
    eventsByDay: Map<string, PartnerTimelineEvent[]>,
): TimelineDateGroup[] {
    const groups: TimelineDateGroup[] = [];

    for (const day of resolvedDays) {
        const events = eventsByDay.get(day.dayKey) ?? [];
        if (events.length === 0) continue;

        const parts = dayKeyToDateParts(day.dayKey);
        groups.push({
            dayKey: day.dayKey,
            ...parts,
            isToday: day.isToday,
            events: [...events].sort(
                (a, b) => new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime(),
            ),
        });
    }

    return groups.sort((a, b) => b.dayKey.localeCompare(a.dayKey));
}

function TimelineCard({
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
    onCaloriesNudge?: () => void;
    onWaterNudge?: () => void;
}) {
    const isYou = event.actor === 'you';
    const Icon = getEventIcon(event);
    const iconColor = getEventIconColor(event);
    const timeLabel = formatEventTime(event);
    const showCaloriesAction = event.id.endsWith('-calories-alert') && showCaloriesWarning;
    const showWaterAction =
        event.id.endsWith('-water-alert') && partnerNeedsWaterNudge && !waterNudgeSent;

    return (
        <View style={[styles.cardRow, isYou ? styles.cardRowLeft : styles.cardRowRight]}>
            <View
                style={[
                    styles.eventCard,
                    isYou ? styles.eventCardYou : styles.eventCardPartner,
                ]}
            >
                <View style={styles.iconTile}>
                    <Icon size={22} color={iconColor} strokeWidth={2} />
                </View>
                <View style={styles.eventContent}>
                    <Text style={styles.eventTitle} numberOfLines={2}>
                        {event.title}
                    </Text>
                    {event.subtitle ? (
                        <Text style={styles.eventDescription} numberOfLines={3}>
                            {event.subtitle}
                        </Text>
                    ) : null}
                    {timeLabel ? (
                        <Text
                            style={[
                                styles.eventTime,
                                isYou ? styles.eventTimeYou : styles.eventTimePartner,
                            ]}
                        >
                            {timeLabel}
                        </Text>
                    ) : null}
                    {showCaloriesAction || showWaterAction ? (
                        <View style={styles.eventActions}>
                            {showCaloriesAction ? (
                                <TouchableOpacity
                                    style={styles.eventActionButton}
                                    onPress={onCaloriesNudge}
                                    activeOpacity={0.85}
                                >
                                    <MessageCircleMore size={14} color="#D97706" />
                                    <Text style={styles.eventActionText}>Nudge</Text>
                                </TouchableOpacity>
                            ) : null}
                            {showWaterAction ? (
                                <TouchableOpacity
                                    style={styles.eventActionButton}
                                    onPress={onWaterNudge}
                                    activeOpacity={0.85}
                                >
                                    <Bell size={14} color="#2563EB" />
                                    <Text style={styles.eventActionText}>Remind</Text>
                                </TouchableOpacity>
                            ) : null}
                        </View>
                    ) : null}
                </View>
            </View>
        </View>
    );
}

function BottomControlPanel({
    partnerName,
    bottomInset,
    onAddMemory,
    onAddReminder,
}: {
    partnerName: string;
    bottomInset: number;
    onAddMemory?: () => void;
    onAddReminder?: () => void;
}) {
    return (
        <View style={[styles.bottomPanel, { paddingBottom: Math.max(bottomInset, 12) }]}>
            <View style={styles.bottomPanelRow}>
                <TouchableOpacity
                    style={styles.composeField}
                    activeOpacity={0.85}
                    onPress={onAddMemory}
                >
                    <MessageCircle size={18} color={COLORS.muted} strokeWidth={2} />
                    <Text style={styles.composePlaceholder} numberOfLines={1}>
                        Share with {partnerName}…
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.actionChip, styles.actionChipMemory]}
                    activeOpacity={0.85}
                    onPress={onAddMemory}
                >
                    <Heart size={15} color={COLORS.primaryDeep} strokeWidth={2} />
                    <Text style={styles.actionChipTextMemory}>Memory</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.actionChip, styles.actionChipReminder]}
                    activeOpacity={0.85}
                    onPress={onAddReminder}
                >
                    <Bell size={15} color={COLORS.secondaryDeep} strokeWidth={2} />
                    <Text style={styles.actionChipTextReminder}>Reminder</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

export function ConnectedPartners({
    userName = 'You',
    partnerName = 'Partner',
    daysTogether = 1,
    weekStart,
    days = [],
    plannedDays = [],
    pointsHistory = [],
    myPointsHistory = [],
    scheduledRuns = [],
    myTodaySummary,
    wagerOverview,
    showCaloriesWarning = false,
    partnerCaloriesOverTarget = 0,
    partnerNeedsWaterNudge = false,
    waterNudgeSent = false,
    loading = false,
    onBack,
    onMore,
    onAddMemory,
    onAddReminder,
    onCaloriesNudge,
    onWaterNudge,
    onAddMoment,
}: ConnectedPartnersProps) {
    const insets = useSafeAreaInsets();
    const baseDays = useMemo(
        () => (days.length > 0 ? days : buildWeekDayShell(weekStart)),
        [days, weekStart],
    );
    const resolvedDays = useMemo(
        () =>
            buildTimelineDaysFromKeys(
                collectTimelineDayKeys({
                    baseDays,
                    pointsHistory,
                    myPointsHistory,
                    scheduledRuns,
                }),
                baseDays,
            ),
        [baseDays, pointsHistory, myPointsHistory, scheduledRuns],
    );
    const groupedEvents = useMemo(() => {
        const eventsByDay = buildPartnerTimelineEvents({
            partnerName,
            days: resolvedDays,
            plannedDays,
            pointsHistory,
            myPointsHistory,
            scheduledRuns,
            myTodaySummary,
            activeWager: wagerOverview?.currentWager ?? null,
            showCaloriesWarning,
            partnerCaloriesOverTarget,
            partnerNeedsWaterNudge,
            waterNudgeSent,
        });
        return groupTimelineByDay(resolvedDays, eventsByDay);
    }, [
        partnerName,
        resolvedDays,
        plannedDays,
        pointsHistory,
        myPointsHistory,
        scheduledRuns,
        myTodaySummary,
        wagerOverview,
        showCaloriesWarning,
        partnerCaloriesOverTarget,
        partnerNeedsWaterNudge,
        waterNudgeSent,
    ]);
    const bottomInset = Math.max(insets.bottom, 12);
    const scrollBottomPadding = 72 + bottomInset;
    const handleAddMemory = () => {
        (onAddMemory ?? onAddMoment)?.();
    };

    return (
        <View style={styles.container}>
            <View style={[styles.topNav, { paddingTop: Math.max(insets.top + 6, 20) }]}>
                <TouchableOpacity
                    onPress={onBack}
                    style={styles.navButton}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    activeOpacity={0.7}
                >
                    <ArrowLeft size={20} color={COLORS.text} strokeWidth={2} />
                </TouchableOpacity>

                <View style={styles.navCenter}>
                    <View style={styles.sparkleRow}>
                        <View style={[styles.sparkle, styles.sparkleSmall]} />
                        <View style={styles.sparkleHeart}>
                            <Heart
                                size={16}
                                color={COLORS.primary}
                                fill={COLORS.primary}
                                strokeWidth={0}
                            />
                        </View>
                        <View style={styles.sparkle} />
                    </View>
                </View>

                <TouchableOpacity
                    onPress={onMore}
                    style={styles.navButton}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    activeOpacity={0.7}
                >
                    <MoreHorizontal size={20} color={COLORS.text} strokeWidth={2} />
                </TouchableOpacity>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingBottom: scrollBottomPadding },
                ]}
                contentInsetAdjustmentBehavior="automatic"
            >
                <View style={styles.header}>
                    <Text style={styles.title}>Our Timeline</Text>
                    <Text style={styles.subtitle}>
                        Our moments, our plans, our story.
                    </Text>
                </View>

                <View style={styles.heroRow}>
                    <View style={styles.heroPerson}>
                        <View style={[styles.portraitRing, styles.portraitRingYou]}>
                            <View style={styles.portraitClip}>
                                <Image
                                    source={require('../../assets/pink.png')}
                                    style={styles.portraitImage}
                                    resizeMode="contain"
                                />
                            </View>
                        </View>
                        <View style={styles.heroLabelRow}>
                            <Text style={styles.heroLabel}>{userName}</Text>
                            <Heart
                                size={11}
                                color={COLORS.primary}
                                fill={COLORS.primary}
                                strokeWidth={0}
                            />
                        </View>
                    </View>

                    <View style={styles.daysBox}>
                        <Calendar size={20} color={COLORS.textStrong} strokeWidth={2} />
                        <Text style={styles.daysValue}>{daysTogether}</Text>
                        <Text style={styles.daysLabel}>Days Together</Text>
                    </View>

                    <View style={styles.heroPerson}>
                        <View style={[styles.portraitRing, styles.portraitRingPartner]}>
                            <View style={styles.portraitClip}>
                                <Image
                                    source={require('../../assets/Gree.png')}
                                    style={styles.portraitImage}
                                    resizeMode="contain"
                                />
                            </View>
                        </View>
                        <View style={styles.heroLabelRow}>
                            <Text style={styles.heroLabel}>{partnerName}</Text>
                            <Heart
                                size={11}
                                color={COLORS.secondary}
                                fill={COLORS.secondary}
                                strokeWidth={0}
                            />
                        </View>
                    </View>
                </View>

                <View style={styles.timeline}>
                    <View style={styles.spine} />

                    {loading ? (
                        <View style={styles.timelineLoading}>
                            <ActivityIndicator size="small" color={COLORS.primary} />
                        </View>
                    ) : groupedEvents.length === 0 ? (
                        <View style={styles.timelineEmpty}>
                            <Text style={styles.timelineEmptyTitle}>No activity yet this week</Text>
                            <Text style={styles.timelineEmptyBody}>
                                Steps, runs, notes, and reminders will show up here as you and{' '}
                                {partnerName} stay active together.
                            </Text>
                        </View>
                    ) : (
                        groupedEvents.map((group) => (
                            <View key={group.dayKey} style={styles.dateGroup}>
                                <View style={styles.dateMarkerWrap}>
                                    <View
                                        style={[
                                            styles.dateMarker,
                                            group.isToday && styles.dateMarkerToday,
                                        ]}
                                    >
                                        <Text style={styles.dateMarkerMonth}>
                                            {group.monthLabel}
                                        </Text>
                                        <Text style={styles.dateMarkerNum}>{group.dateNum}</Text>
                                        <Text style={styles.dateMarkerDay}>
                                            {group.isToday ? 'TODAY' : group.dayLabel}
                                        </Text>
                                    </View>
                                </View>

                                {group.events.map((event) => (
                                    <TimelineCard
                                        key={event.id}
                                        event={event}
                                        showCaloriesWarning={showCaloriesWarning}
                                        partnerNeedsWaterNudge={partnerNeedsWaterNudge}
                                        waterNudgeSent={waterNudgeSent}
                                        onCaloriesNudge={onCaloriesNudge}
                                        onWaterNudge={onWaterNudge}
                                    />
                                ))}
                            </View>
                        ))
                    )}
                </View>
            </ScrollView>

            <BottomControlPanel
                partnerName={partnerName}
                bottomInset={bottomInset}
                onAddMemory={handleAddMemory}
                onAddReminder={onAddReminder}
            />
        </View>
    );
}

const CARD_INSET_PCT = '42%';

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bg,
    },
    topNav: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 4,
    },
    navButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.surface,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    navCenter: {
        flex: 1,
        alignItems: 'center',
    },
    sparkleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    sparkle: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: COLORS.primary,
        opacity: 0.7,
    },
    sparkleSmall: {
        width: 2,
        height: 2,
        borderRadius: 1,
        opacity: 0.5,
    },
    sparkleHeart: {
        width: 22,
        height: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scrollContent: {
        paddingHorizontal: 20,
    },
    bottomPanel: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingTop: 10,
        paddingHorizontal: 16,
        backgroundColor: COLORS.card,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.06,
                shadowRadius: 12,
            },
            android: {
                elevation: 12,
            },
        }),
    },
    bottomPanelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    composeField: {
        flex: 1,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        height: 44,
        paddingHorizontal: 12,
        borderRadius: 22,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    composePlaceholder: {
        flex: 1,
        fontSize: 14,
        color: COLORS.subtle,
        letterSpacing: -0.1,
    },
    actionChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        height: 44,
        paddingHorizontal: 12,
        borderRadius: 22,
        borderWidth: 1,
    },
    actionChipMemory: {
        backgroundColor: COLORS.primaryFadeSoft,
        borderColor: COLORS.primaryFade,
    },
    actionChipReminder: {
        backgroundColor: COLORS.secondaryFadeSoft,
        borderColor: COLORS.secondaryFade,
    },
    actionChipTextMemory: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.primaryDeep,
        letterSpacing: -0.1,
    },
    actionChipTextReminder: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.secondaryDeep,
        letterSpacing: -0.1,
    },
    header: {
        alignItems: 'center',
        marginTop: 2,
        marginBottom: 18,
    },
    title: {
        fontSize: 30,
        fontWeight: '800',
        color: COLORS.textStrong,
        letterSpacing: -0.7,
        textAlign: 'center',
    },
    subtitle: {
        marginTop: 4,
        fontSize: 14,
        lineHeight: 20,
        color: COLORS.muted,
        textAlign: 'center',
    },

    heroRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 22,
        paddingHorizontal: 4,
    },
    heroPerson: {
        alignItems: 'center',
        width: 96,
    },
    portraitRing: {
        width: 96,
        height: 96,
        borderRadius: 48,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    portraitClip: {
        width: 84,
        height: 84,
        borderRadius: 42,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
    },
    portraitRingYou: {
        backgroundColor: COLORS.primaryFade,
    },
    portraitRingPartner: {
        backgroundColor: COLORS.secondaryFade,
    },
    portraitImage: {
        width: 84,
        height: 84,
    },
    heroLabelRow: {
        marginTop: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    heroLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.text,
        letterSpacing: -0.1,
    },
    daysBox: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.card,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingHorizontal: 16,
        paddingVertical: 14,
        minWidth: 118,
    },
    daysValue: {
        marginTop: 2,
        fontSize: 28,
        fontWeight: '800',
        color: COLORS.textStrong,
        letterSpacing: -0.8,
        fontVariant: ['tabular-nums'],
    },
    daysLabel: {
        marginTop: 2,
        fontSize: 11,
        fontWeight: '600',
        color: COLORS.muted,
        letterSpacing: 0.2,
    },

    timeline: {
        position: 'relative',
        paddingBottom: 8,
        marginBottom: 24,
    },
    spine: {
        position: 'absolute',
        top: 4,
        bottom: 4,
        left: '50%',
        width: 0,
        borderLeftWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: COLORS.spine,
    },
    dateGroup: {
        marginBottom: 4,
    },
    dateMarkerWrap: {
        alignItems: 'center',
        marginTop: 6,
        marginBottom: 12,
        zIndex: 2,
    },
    dateMarker: {
        width: 44,
        paddingVertical: 8,
        paddingHorizontal: 4,
        borderRadius: 22,
        backgroundColor: COLORS.card,
        borderWidth: 1,
        borderColor: COLORS.borderStrong,
        alignItems: 'center',
    },
    dateMarkerMonth: {
        fontSize: 9,
        fontWeight: '700',
        color: COLORS.primary,
        letterSpacing: 0.6,
    },
    dateMarkerNum: {
        marginTop: 1,
        fontSize: 18,
        fontWeight: '800',
        color: COLORS.textStrong,
        letterSpacing: -0.5,
        fontVariant: ['tabular-nums'],
    },
    dateMarkerDay: {
        marginTop: 1,
        fontSize: 9,
        fontWeight: '700',
        color: COLORS.subtle,
        letterSpacing: 0.6,
    },
    dateMarkerToday: {
        borderColor: COLORS.primary,
        backgroundColor: COLORS.primaryFadeSoft,
    },
    timelineLoading: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 32,
    },
    timelineEmpty: {
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 28,
    },
    timelineEmptyTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.textStrong,
        textAlign: 'center',
    },
    timelineEmptyBody: {
        marginTop: 6,
        fontSize: 13,
        lineHeight: 19,
        color: COLORS.muted,
        textAlign: 'center',
    },

    cardRow: {
        width: '100%',
        marginBottom: 12,
    },
    cardRowLeft: {
        alignItems: 'flex-start',
        paddingRight: CARD_INSET_PCT,
    },
    cardRowRight: {
        alignItems: 'flex-end',
        paddingLeft: CARD_INSET_PCT,
    },
    eventCard: {
        width: '100%',
        maxWidth: 240,
        borderRadius: 20,
        padding: 12,
        flexDirection: 'row',
        gap: 10,
    },
    eventCardYou: {
        backgroundColor: COLORS.primaryFade,
    },
    eventCardPartner: {
        backgroundColor: COLORS.secondaryFade,
    },
    iconTile: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    eventContent: {
        flex: 1,
        minWidth: 0,
    },
    eventTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    eventTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: COLORS.textStrong,
        letterSpacing: -0.2,
    },
    eventTitleEmoji: {
        fontSize: 13,
    },
    eventDescription: {
        marginTop: 3,
        fontSize: 12.5,
        lineHeight: 17,
        color: COLORS.muted,
    },
    eventTime: {
        marginTop: 6,
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.2,
        fontVariant: ['tabular-nums'],
    },
    eventTimeYou: {
        color: COLORS.primaryDeep,
    },
    eventTimePartner: {
        color: COLORS.secondaryDeep,
    },
    eventActions: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 8,
    },
    eventActionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: COLORS.borderStrong,
    },
    eventActionText: {
        fontSize: 11,
        fontWeight: '700',
        color: COLORS.text,
    },

});

export default ConnectedPartners;
