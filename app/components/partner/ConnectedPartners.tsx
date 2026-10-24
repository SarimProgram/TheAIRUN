import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    Platform,
    ActivityIndicator,
    Modal,
    TextInput,
    Alert,
    KeyboardAvoidingView,
    Keyboard,
    Pressable,
    Switch,
    Animated,
    Easing,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    AlertTriangle,
    ArrowLeft,
    Bell,
    Calendar,
    CheckCircle2,
    Footprints,
    Gift,
    Heart,
    MessageCircle,
    MessageCircleMore,
    MoreHorizontal,
    NotebookPen,
    Plus,
    Sparkles,
    TrendingDown,
    TrendingUp,
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
    type PartnerMemoryEntry,
    type PartnerMarketplaceHistoryEntry,
    type PartnerTimelineEvent,
    type ScheduledPartnerRun,
    type TimelineWeightHistoryEntry,
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

type TimelineDateGroup = {
    dayKey: string;
    dateLabel: string;
    dayLabel: string;
    monthLabel: string;
    dateNum: string;
    isToday: boolean;
    events: PartnerTimelineEvent[];
};

type TimelineEventFilter = {
    memories: boolean;
    weightChange: boolean;
    runCompletions: boolean;
    points: boolean;
};

const DEFAULT_TIMELINE_FILTER: TimelineEventFilter = {
    memories: true,
    weightChange: true,
    runCompletions: true,
    points: false,
};

const TIMELINE_FILTER_OPTIONS: Array<{
    key: keyof TimelineEventFilter;
    label: string;
}> = [
    { key: 'memories', label: 'Memories' },
    { key: 'weightChange', label: 'Weight change' },
    { key: 'runCompletions', label: 'Run completions' },
    { key: 'points', label: 'Points' },
];

type ConnectedPartnersProps = {
    weeklyProgressSection?: React.ReactNode;
    userName?: string;
    partnerName?: string;
    daysTogether?: number;
    weekStart?: string;
    days?: PartnerDaySummary[];
    plannedDays?: DaySchedule[];
    pointsHistory?: PartnerPointsHistoryEntry[];
    myPointsHistory?: PartnerPointsHistoryEntry[];
    partnerWeightHistory?: TimelineWeightHistoryEntry[];
    myWeightHistory?: TimelineWeightHistoryEntry[];
    partnerUsesImperial?: boolean;
    myUsesImperial?: boolean;
    partnerBaselineWeightKg?: number | null;
    myBaselineWeightKg?: number | null;
    partnerJourneyWeightLost?: number | null;
    partnerJourneyCurrentWeight?: number | null;
    partnerJourneyUpdatedAt?: string | null;
    partnerMemories?: PartnerMemoryEntry[];
    partnerMarketplaceHistory?: PartnerMarketplaceHistoryEntry[];
    currentUserId?: string | null;
    memoryUploading?: boolean;
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
    onSharePhoto?: (imageUri: string, caption?: string) => Promise<void>;
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
        case 'weight':
            return event.weightChange === 'gain' ? TrendingUp : TrendingDown;
        case 'memory':
            return Heart;
        case 'marketplace':
            return Gift;
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
    if (event.kind === 'weight') {
        return event.weightChange === 'gain' ? '#D97706' : COLORS.secondaryDeep;
    }
    if (event.actor === 'you') return COLORS.primary;
    if (event.tone === 'success') return COLORS.secondaryDeep;
    if (event.tone === 'warning') return '#D97706';
    if (event.tone === 'info') return '#2563EB';
    return COLORS.secondary;
}

function isRunCompletionEvent(event: PartnerTimelineEvent) {
    if (event.kind !== 'activity') return false;
    if (event.tone === 'success') return true;
    return (event.subtitle?.includes(' km') ?? false);
}

function shouldShowOnConnectedTimeline(
    event: PartnerTimelineEvent,
    filter: TimelineEventFilter,
) {
    if (event.kind === 'wager') return true;
    if (filter.memories && event.kind === 'memory') return true;
    if (filter.weightChange && event.kind === 'weight') return true;
    if (filter.runCompletions && isRunCompletionEvent(event)) return true;
    if (filter.points && event.kind === 'points') return true;
    return false;
}

function groupTimelineByDay(
    resolvedDays: PartnerDaySummary[],
    eventsByDay: Map<string, PartnerTimelineEvent[]>,
    filter: TimelineEventFilter,
): TimelineDateGroup[] {
    const groups: TimelineDateGroup[] = [];

    for (const day of resolvedDays) {
        const events = (eventsByDay.get(day.dayKey) ?? []).filter((event) =>
            shouldShowOnConnectedTimeline(event, filter),
        );
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
        <View
            style={[
                styles.eventCard,
                isYou ? styles.eventCardYou : styles.eventCardPartner,
            ]}
        >
            <View style={[styles.iconTile, isYou ? styles.iconTileYou : styles.iconTilePartner]}>
                {event.kind === 'marketplace' && event.marketplaceEmoji ? (
                    <Text style={styles.marketplaceEmoji}>{event.marketplaceEmoji}</Text>
                ) : (
                    <Icon size={18} color={iconColor} strokeWidth={2} />
                )}
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
                {event.kind === 'memory' && event.imageUri ? (
                    <Image source={{ uri: event.imageUri }} style={styles.memoryImage} resizeMode="cover" />
                ) : event.kind === 'memory' && event.imageAvailable === false ? (
                    <Text style={styles.memoryUnavailable}>Photo no longer available</Text>
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
    );
}

function TimelineEventRow({
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

    return (
        <View style={styles.eventRow}>
            <View style={[styles.eventSide, styles.eventSideLeft]}>
                {isYou ? (
                    <TimelineCard
                        event={event}
                        showCaloriesWarning={showCaloriesWarning}
                        partnerNeedsWaterNudge={partnerNeedsWaterNudge}
                        waterNudgeSent={waterNudgeSent}
                        onCaloriesNudge={onCaloriesNudge}
                        onWaterNudge={onWaterNudge}
                    />
                ) : null}
            </View>

            <View style={styles.spineColumn}>
                <View
                    style={[
                        styles.spineDot,
                        isYou ? styles.spineDotYou : styles.spineDotPartner,
                    ]}
                />
            </View>

            <View style={[styles.eventSide, styles.eventSideRight]}>
                {!isYou ? (
                    <TimelineCard
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
}

function TimelineLoadingSkeleton() {
    const pulse = useRef(new Animated.Value(0.45)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, {
                    toValue: 1,
                    duration: 900,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(pulse, {
                    toValue: 0.45,
                    duration: 900,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
            ]),
        );
        animation.start();
        return () => animation.stop();
    }, [pulse]);

    const rows = [
        { side: 'right' as const, width: '78%' },
        { side: 'left' as const, width: '64%' },
        { side: 'right' as const, width: '70%' },
    ];

    return (
        <View style={styles.timelineSkeleton}>
            <Animated.View style={[styles.timelineSkeletonDate, { opacity: pulse }]} />
            {rows.map((row, index) => (
                <View key={index} style={styles.timelineSkeletonRow}>
                    <View style={styles.eventSide}>
                        {row.side === 'left' ? (
                            <Animated.View
                                style={[
                                    styles.timelineSkeletonCard,
                                    styles.timelineSkeletonCardYou,
                                    { width: row.width, opacity: pulse },
                                ]}
                            />
                        ) : null}
                    </View>
                    <View style={styles.spineColumn}>
                        <View style={styles.spineDot} />
                    </View>
                    <View style={styles.eventSide}>
                        {row.side === 'right' ? (
                            <Animated.View
                                style={[
                                    styles.timelineSkeletonCard,
                                    styles.timelineSkeletonCardPartner,
                                    { width: row.width, opacity: pulse },
                                ]}
                            />
                        ) : null}
                    </View>
                </View>
            ))}
        </View>
    );
}

function BottomControlPanel({
    partnerName,
    bottomInset,
    onSharePhoto,
    memoryUploading = false,
    isPickingPhoto = false,
}: {
    partnerName: string;
    bottomInset: number;
    onSharePhoto?: () => void;
    memoryUploading?: boolean;
    isPickingPhoto?: boolean;
}) {
    const partnerFirstName = partnerName.trim().split(/\s+/)[0] || partnerName;
    const isBusy = memoryUploading || isPickingPhoto;
    const actionLabel = memoryUploading
        ? 'Saving entry…'
        : isPickingPhoto
          ? 'Opening photos…'
          : `Log a moment with ${partnerFirstName}`;

    return (
        <TouchableOpacity
            style={[
                styles.journalCta,
                { paddingBottom: Math.max(bottomInset, 12) },
                isBusy && styles.journalCtaBusy,
            ]}
            activeOpacity={0.92}
            onPress={onSharePhoto}
            disabled={isBusy}
        >
            <View style={styles.journalCtaIcon}>
                {isBusy ? (
                    <ActivityIndicator size="small" color={COLORS.primaryDeep} />
                ) : (
                    <NotebookPen size={19} color={COLORS.primaryDeep} strokeWidth={2.1} />
                )}
            </View>

            <View style={styles.journalCtaCopy}>
                <Text style={styles.journalCtaEyebrow}>Fitness journal</Text>
                <Text style={styles.journalCtaTitle} numberOfLines={1}>
                    {actionLabel}
                </Text>
            </View>

            <View style={styles.journalCtaAction}>
                <Plus size={16} color={COLORS.primaryDeep} strokeWidth={2.4} />
            </View>
        </TouchableOpacity>
    );
}

export function ConnectedPartners({
    weeklyProgressSection,
    userName = 'You',
    partnerName = 'Partner',
    daysTogether = 1,
    weekStart,
    days = [],
    plannedDays = [],
    pointsHistory = [],
    myPointsHistory = [],
    partnerWeightHistory = [],
    myWeightHistory = [],
    partnerUsesImperial = false,
    myUsesImperial = false,
    partnerBaselineWeightKg = null,
    myBaselineWeightKg = null,
    partnerJourneyWeightLost = null,
    partnerJourneyCurrentWeight = null,
    partnerJourneyUpdatedAt = null,
    partnerMemories = [],
    partnerMarketplaceHistory = [],
    currentUserId = null,
    memoryUploading = false,
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
    onSharePhoto,
    onCaloriesNudge,
    onWaterNudge,
    onAddMoment,
}: ConnectedPartnersProps) {
    const insets = useSafeAreaInsets();
    const [memoryModalOpen, setMemoryModalOpen] = useState(false);
    const [filterModalOpen, setFilterModalOpen] = useState(false);
    const [timelineFilter, setTimelineFilter] = useState<TimelineEventFilter>(DEFAULT_TIMELINE_FILTER);
    const [pendingImageUri, setPendingImageUri] = useState<string | null>(null);
    const [memoryCaption, setMemoryCaption] = useState('');
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const [isPickingPhoto, setIsPickingPhoto] = useState(false);
    const isPickingPhotoRef = useRef(false);

    useFocusEffect(
        useCallback(() => {
            void ImagePicker.getMediaLibraryPermissionsAsync();
        }, []),
    );

    useEffect(() => {
        const showSub = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
            () => setKeyboardVisible(true),
        );
        const hideSub = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            () => setKeyboardVisible(false),
        );
        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);
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
                    partnerWeightHistory,
                    myWeightHistory,
                    partnerJourneyWeightLost,
                    partnerJourneyUpdatedAt,
                    partnerMemories,
                    partnerMarketplaceHistory,
                    activeWagerWeekStart: wagerOverview?.currentWager?.weekStart ?? null,
                }),
                baseDays,
            ),
        [baseDays, pointsHistory, myPointsHistory, partnerWeightHistory, myWeightHistory, partnerJourneyWeightLost, partnerJourneyUpdatedAt, partnerMemories, partnerMarketplaceHistory, wagerOverview?.currentWager?.weekStart],
    );
    const groupedEvents = useMemo(() => {
        const eventsByDay = buildPartnerTimelineEvents({
            partnerName,
            days: resolvedDays,
            plannedDays: [],
            pointsHistory,
            myPointsHistory,
            partnerWeightHistory,
            myWeightHistory,
            partnerUsesImperial,
            myUsesImperial,
            partnerBaselineWeightKg,
            myBaselineWeightKg,
            partnerJourneyWeightLost,
            partnerJourneyCurrentWeight,
            partnerJourneyUpdatedAt,
            partnerMemories,
            partnerMarketplaceHistory,
            currentUserId,
            scheduledRuns: [],
            activeWager: wagerOverview?.currentWager ?? null,
            wagerLeader: wagerOverview?.currentLeader ?? null,
        });
        return groupTimelineByDay(resolvedDays, eventsByDay, timelineFilter);
    }, [
        partnerName,
        resolvedDays,
        pointsHistory,
        myPointsHistory,
        partnerWeightHistory,
        myWeightHistory,
        partnerUsesImperial,
        myUsesImperial,
        partnerBaselineWeightKg,
        myBaselineWeightKg,
        partnerJourneyWeightLost,
        partnerJourneyCurrentWeight,
        partnerJourneyUpdatedAt,
        partnerMemories,
        partnerMarketplaceHistory,
        currentUserId,
        wagerOverview?.currentWager,
        wagerOverview?.currentLeader,
        timelineFilter,
    ]);
    const bottomInset = Math.max(insets.bottom, 12);
    const scrollBottomPadding = 88 + bottomInset;
    const hasActiveTimelineFilters = useMemo(
        () =>
            TIMELINE_FILTER_OPTIONS.some(
                ({ key }) => timelineFilter[key] !== DEFAULT_TIMELINE_FILTER[key],
            ),
        [timelineFilter],
    );
    const handleOpenMore = () => {
        if (onMore) {
            onMore();
            return;
        }
        setFilterModalOpen(true);
    };

    const toggleTimelineFilter = (key: keyof TimelineEventFilter) => {
        setTimelineFilter((current) => ({
            ...current,
            [key]: !current[key],
        }));
    };

    const resetMemoryComposer = () => {
        setMemoryModalOpen(false);
        setPendingImageUri(null);
        setMemoryCaption('');
    };

    const handlePickMemoryPhoto = useCallback(async () => {
        if (!onSharePhoto) {
            (onAddMemory ?? onAddMoment)?.();
            return;
        }
        if (isPickingPhotoRef.current) return;

        isPickingPhotoRef.current = true;
        setIsPickingPhoto(true);

        try {
            let permission = await ImagePicker.getMediaLibraryPermissionsAsync();
            if (!permission.granted) {
                permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
            }
            if (!permission.granted) {
                Alert.alert('Permission needed', 'Allow photo access to add a journal entry.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: false,
                quality: 0.85,
            });

            if (result.canceled || !result.assets[0]?.uri) {
                return;
            }

            setPendingImageUri(result.assets[0].uri);
            setMemoryCaption('');
            setMemoryModalOpen(true);
        } finally {
            isPickingPhotoRef.current = false;
            setIsPickingPhoto(false);
        }
    }, [onAddMemory, onAddMoment, onSharePhoto]);

    const handleSubmitMemoryPhoto = async () => {
        if (!pendingImageUri || !onSharePhoto) {
            resetMemoryComposer();
            return;
        }

        try {
            await onSharePhoto(pendingImageUri, memoryCaption.trim() || undefined);
            resetMemoryComposer();
        } catch (error: any) {
            Alert.alert('Could not share memory', error?.message || 'Please try again.');
        }
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
                    onPress={handleOpenMore}
                    style={[styles.navButton, hasActiveTimelineFilters && styles.navButtonActive]}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    activeOpacity={0.7}
                >
                    <MoreHorizontal size={20} color={COLORS.text} strokeWidth={2} />
                    {hasActiveTimelineFilters ? <View style={styles.navButtonDot} /> : null}
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

                {weeklyProgressSection ? (
                    <View style={styles.weeklyProgressSection}>{weeklyProgressSection}</View>
                ) : null}

                <View style={styles.timeline}>
                    <View style={styles.spine} pointerEvents="none" />

                    {loading ? (
                        <TimelineLoadingSkeleton />
                    ) : groupedEvents.length === 0 ? (
                        <View style={styles.timelineEmpty}>
                            <Text style={styles.timelineEmptyTitle}>No goals achieved yet</Text>
                            <Text style={styles.timelineEmptyBody}>
                                When you or {partnerName} share memories, complete runs, or log weight
                                changes, they&apos;ll show up here. Tap the menu to adjust filters.
                            </Text>
                        </View>
                    ) : (
                        groupedEvents.map((group) => (
                            <View key={group.dayKey} style={styles.dateGroup}>
                                <View style={styles.dateMarkerRow}>
                                    <View style={styles.eventSide} />
                                    <View style={styles.spineColumn}>
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
                                    <View style={styles.eventSide} />
                                </View>

                                {group.events.map((event) => (
                                    <TimelineEventRow
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
                onSharePhoto={handlePickMemoryPhoto}
                memoryUploading={memoryUploading}
                isPickingPhoto={isPickingPhoto}
            />

            <Modal
                visible={filterModalOpen}
                transparent
                animationType="slide"
                onRequestClose={() => setFilterModalOpen(false)}
            >
                <View style={styles.filterModalBackdrop}>
                    <Pressable style={styles.filterModalDismissArea} onPress={() => setFilterModalOpen(false)} />
                    <View
                        style={[
                            styles.filterModalCard,
                            { paddingBottom: Math.max(insets.bottom, 16) },
                        ]}
                    >
                        <View style={styles.filterModalHandle} />
                        <View style={styles.filterModalHeader}>
                            <Text style={styles.filterModalTitle}>Show on timeline</Text>
                            <TouchableOpacity
                                onPress={() => setTimelineFilter(DEFAULT_TIMELINE_FILTER)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <Text style={styles.filterResetText}>Reset</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.filterOptionsGroup}>
                            {TIMELINE_FILTER_OPTIONS.map(({ key, label }, index) => {
                                const isSelected = timelineFilter[key];
                                return (
                                    <View
                                        key={key}
                                        style={[
                                            styles.filterOptionRow,
                                            index === TIMELINE_FILTER_OPTIONS.length - 1 &&
                                                styles.filterOptionRowLast,
                                        ]}
                                    >
                                        <Text style={styles.filterOptionLabel}>{label}</Text>
                                        <Switch
                                            value={isSelected}
                                            onValueChange={() => toggleTimelineFilter(key)}
                                            trackColor={{
                                                false: COLORS.borderStrong,
                                                true: COLORS.primaryFade,
                                            }}
                                            thumbColor={isSelected ? COLORS.primary : '#FFFFFF'}
                                            ios_backgroundColor={COLORS.borderStrong}
                                        />
                                    </View>
                                );
                            })}
                        </View>

                        <TouchableOpacity
                            style={styles.filterDoneButton}
                            activeOpacity={0.85}
                            onPress={() => setFilterModalOpen(false)}
                        >
                            <Text style={styles.filterDoneButtonText}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal visible={memoryModalOpen} transparent animationType="slide" onRequestClose={resetMemoryComposer}>
                <KeyboardAvoidingView
                    style={styles.memoryModalBackdrop}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    <Pressable style={styles.memoryModalDismissArea} onPress={resetMemoryComposer} />
                    <View
                        style={[
                            styles.memoryModalCard,
                            { paddingBottom: Math.max(insets.bottom, 16) },
                        ]}
                    >
                        <ScrollView
                            keyboardShouldPersistTaps="handled"
                            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                            showsVerticalScrollIndicator={false}
                            bounces={false}
                        >
                            <Text style={styles.memoryModalTitle}>Add to fitness journal</Text>
                            {pendingImageUri ? (
                                <Image
                                    source={{ uri: pendingImageUri }}
                                    style={[
                                        styles.memoryModalPreview,
                                        keyboardVisible && styles.memoryModalPreviewCompact,
                                    ]}
                                    resizeMode="cover"
                                />
                            ) : null}
                            <TextInput
                                value={memoryCaption}
                                onChangeText={setMemoryCaption}
                                placeholder={`What do you want to remember with ${partnerName}?`}
                                placeholderTextColor={COLORS.muted}
                                style={styles.memoryModalInput}
                                multiline
                                maxLength={500}
                            />
                            <View style={styles.memoryModalActions}>
                                <TouchableOpacity style={styles.memoryModalCancel} onPress={resetMemoryComposer}>
                                    <Text style={styles.memoryModalCancelText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.memoryModalSubmit}
                                    onPress={handleSubmitMemoryPhoto}
                                    disabled={memoryUploading}
                                >
                                    {memoryUploading ? (
                                        <ActivityIndicator size="small" color="#FFFFFF" />
                                    ) : (
                                        <Text style={styles.memoryModalSubmitText}>Save entry</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}

const SPINE_COLUMN_WIDTH = 28;

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
    navButtonActive: {
        borderColor: COLORS.primaryFade,
        backgroundColor: COLORS.primaryFadeSoft,
    },
    navButtonDot: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: COLORS.primary,
        borderWidth: 1.5,
        borderColor: COLORS.card,
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
    weeklyProgressSection: {
        marginBottom: 20,
    },
    journalCta: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingTop: 12,
        paddingHorizontal: 20,
        backgroundColor: COLORS.bg,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: COLORS.borderStrong,
    },
    journalCtaBusy: {
        opacity: 0.88,
    },
    journalCtaIcon: {
        width: 42,
        height: 42,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.primaryFadeSoft,
        borderWidth: 1,
        borderColor: COLORS.primaryFade,
        borderCurve: 'continuous',
    },
    journalCtaCopy: {
        flex: 1,
        minWidth: 0,
    },
    journalCtaEyebrow: {
        fontSize: 11,
        fontWeight: '700',
        color: COLORS.primaryDeep,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },
    journalCtaTitle: {
        marginTop: 2,
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.textStrong,
        letterSpacing: -0.2,
    },
    journalCtaAction: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.primaryFadeSoft,
        borderWidth: 1,
        borderColor: COLORS.primaryFade,
        borderCurve: 'continuous',
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
        top: 0,
        bottom: 0,
        left: '50%',
        width: 2,
        marginLeft: -1,
        backgroundColor: COLORS.spine,
        borderRadius: 1,
    },
    dateGroup: {
        marginBottom: 8,
    },
    dateMarkerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
        zIndex: 2,
    },
    eventRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
        zIndex: 1,
    },
    eventSide: {
        flex: 1,
        minWidth: 0,
    },
    eventSideLeft: {
        alignItems: 'flex-end',
        paddingRight: 8,
    },
    eventSideRight: {
        alignItems: 'flex-start',
        paddingLeft: 8,
    },
    spineColumn: {
        width: SPINE_COLUMN_WIDTH,
        alignItems: 'center',
        justifyContent: 'center',
    },
    spineDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        borderWidth: 2,
        borderColor: COLORS.card,
        zIndex: 2,
    },
    spineDotYou: {
        backgroundColor: COLORS.primary,
    },
    spineDotPartner: {
        backgroundColor: COLORS.secondary,
    },
    dateMarker: {
        width: 52,
        paddingVertical: 8,
        paddingHorizontal: 4,
        borderRadius: 26,
        backgroundColor: COLORS.card,
        borderWidth: 1.5,
        borderColor: COLORS.borderStrong,
        alignItems: 'center',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.06,
                shadowRadius: 6,
            },
            android: {
                elevation: 2,
            },
        }),
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
    timelineSkeleton: {
        paddingTop: 8,
        paddingBottom: 16,
    },
    timelineSkeletonDate: {
        alignSelf: 'center',
        width: 52,
        height: 72,
        borderRadius: 26,
        backgroundColor: COLORS.surface,
        marginBottom: 18,
    },
    timelineSkeletonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
    },
    timelineSkeletonCard: {
        height: 88,
        borderRadius: 16,
        borderWidth: 1,
    },
    timelineSkeletonCardYou: {
        alignSelf: 'flex-end',
        backgroundColor: COLORS.primaryFadeSoft,
        borderColor: COLORS.primaryFade,
    },
    timelineSkeletonCardPartner: {
        alignSelf: 'flex-start',
        backgroundColor: COLORS.secondaryFadeSoft,
        borderColor: COLORS.secondaryFade,
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


    eventCard: {
        width: '100%',
        maxWidth: 168,
        borderRadius: 16,
        padding: 10,
        borderWidth: 1,
        ...Platform.select({
            ios: {
                shadowColor: '#0F172A',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
            },
            android: {
                elevation: 1,
            },
        }),
    },
    eventCardYou: {
        backgroundColor: COLORS.primaryFadeSoft,
        borderColor: COLORS.primaryFade,
    },
    eventCardPartner: {
        backgroundColor: COLORS.secondaryFadeSoft,
        borderColor: COLORS.secondaryFade,
    },
    iconTile: {
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    iconTileYou: {
        backgroundColor: '#FFFFFF',
    },
    iconTilePartner: {
        backgroundColor: '#FFFFFF',
    },
    eventContent: {
        flex: 1,
        minWidth: 0,
    },
    eventTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: COLORS.textStrong,
        letterSpacing: -0.2,
    },
    eventDescription: {
        marginTop: 2,
        fontSize: 11.5,
        lineHeight: 16,
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
    memoryImage: {
        marginTop: 8,
        width: '100%',
        height: 140,
        borderRadius: 12,
        backgroundColor: COLORS.surface,
    },
    memoryUnavailable: {
        marginTop: 8,
        fontSize: 11,
        color: COLORS.muted,
        fontStyle: 'italic',
    },
    marketplaceEmoji: {
        fontSize: 18,
        lineHeight: 22,
    },
    filterModalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        justifyContent: 'flex-end',
    },
    filterModalDismissArea: {
        flex: 1,
    },
    filterModalCard: {
        backgroundColor: COLORS.card,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    filterModalHandle: {
        alignSelf: 'center',
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: COLORS.borderStrong,
        marginBottom: 14,
    },
    filterModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
    },
    filterModalTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: COLORS.textStrong,
        letterSpacing: -0.3,
    },
    filterResetText: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.primaryDeep,
    },
    filterOptionsGroup: {
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.surface,
        overflow: 'hidden',
        marginBottom: 16,
    },
    filterOptionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.divider,
    },
    filterOptionRowLast: {
        borderBottomWidth: 0,
    },
    filterOptionLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.text,
        letterSpacing: -0.1,
    },
    filterDoneButton: {
        alignItems: 'center',
        justifyContent: 'center',
        height: 48,
        borderRadius: 24,
        backgroundColor: COLORS.primary,
    },
    filterDoneButtonText: {
        fontSize: 15,
        fontWeight: '800',
        color: '#FFFFFF',
        letterSpacing: -0.1,
    },
    memoryModalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        justifyContent: 'flex-end',
    },
    memoryModalDismissArea: {
        flex: 1,
    },
    memoryModalCard: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingTop: 20,
        maxHeight: '88%',
    },
    memoryModalTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: COLORS.textStrong,
        marginBottom: 12,
    },
    memoryModalPreview: {
        width: '100%',
        height: 200,
        borderRadius: 16,
        backgroundColor: COLORS.surface,
        marginBottom: 12,
    },
    memoryModalPreviewCompact: {
        height: 120,
    },
    memoryModalInput: {
        minHeight: 88,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        color: COLORS.text,
        textAlignVertical: 'top',
        marginBottom: 12,
    },
    memoryModalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
        marginTop: 4,
    },
    memoryModalCancel: {
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    memoryModalCancelText: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.muted,
    },
    memoryModalSubmit: {
        minWidth: 96,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 18,
        paddingVertical: 12,
        borderRadius: 999,
        backgroundColor: COLORS.primary,
    },
    memoryModalSubmitText: {
        fontSize: 15,
        fontWeight: '800',
        color: '#FFFFFF',
    },

});

export default ConnectedPartners;
