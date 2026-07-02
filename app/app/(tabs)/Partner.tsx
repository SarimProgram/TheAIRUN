// app/app/(tabs)/Partner.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Modal,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    Alert,
    Share,
    Animated,
    Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { 
    Users, 
    Unlink, 
    Mail, 
    MessageCircleMore, 
    Share2, 
    ArrowRight, 
    ArrowLeft,
    CheckCircle2,
    Bell,
    AlertTriangle,
    Droplets,
    Heart,
    Trash2,
    ChevronRight
} from 'lucide-react-native';
import { useAuth } from '@/src/auth/authContext';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from '../../config/api';
import { useChat } from '@/contexts/ChatContext';

const { width } = Dimensions.get('window');

type Invite = {
    id: string;
    code?: string;
    toEmail: string;
    status: string;
    createdAt: string;
    fromUser?: { id: string; displayName: string; email: string };
    toUser?: { id: string; displayName: string; email: string } | null;
};

type Partner = {
    id: string;
    displayName: string;
    email: string;
    currentWeight?: number | null;
    weightUnit?: string | null;
    weightLost?: number | null;
    primaryGoal?: string | null;
    points?: number | null;
    pointsBalance?: number | null;
};

type PartnerPointsHistoryEntry = {
    dayKey: string;
    awardedAt: string;
    category: string;
    categoryLabel: string;
    earnedPoints: number;
    maxPoints: number;
    progress: number;
};

type CurrentUser = {
    id: string;
    displayName: string;
    email: string;
};

type PartnerSummary = {
    id: string;
    name: string;
    goal: number;
    food: number;
    exercise: number;
    exerciseMinutes: number;
    distanceKm: number;
    steps: number;
    stepsTarget: number;
    runKmTarget: number;
    waterMl: number;
    lastWaterUpdate: string | null;
};

type TodaySummary = {
    steps: number;
    activeCalories: number;
    consumedCalories: number;
    calorieTarget: number;
    exerciseMinutes: number;
    distanceKm: number;
    runKmTarget: number;
};

type PartnerWeekProgress = {
    id: string;
    name: string;
    weeklyKm: number;
    weeklyKmTarget: number;
    remaining: number;
    progressPercent: number;
    activeDays: number;
    activeStreak: number;
    missedRunDays: number;
};

type NotificationAction = {
    label: string;
    message?: string;
    onPress?: () => void;
};

type PartnerNotification = {
    id: string;
    tone: 'warning' | 'success' | 'info';
    title: string;
    body: string;
    actions: NotificationAction[];
};

type WagerCard = {
    id: string;
    title: string;
    status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'DECLINED';
    weekStart: string;
    weekEnd: string;
    weekTimezone?: string;
    partnerName: string;
    isSender: boolean;
    createdAt: string;
};

type WagerLeader = {
    winner: 'YOU' | 'PARTNER' | 'TIE';
    loser: 'YOU' | 'PARTNER' | 'BOTH' | 'NONE';
    statusLabel: string;
    partnerName: string;
    yourWeek: {
        totalDistanceKm: number;
        weeklyKmTarget: number;
        remainingKm: number;
        progressPercent: number;
        completed: boolean;
    };
    partnerWeek: {
        totalDistanceKm: number;
        weeklyKmTarget: number;
        remainingKm: number;
        progressPercent: number;
        completed: boolean;
        partnerName: string;
    };
};

type WagerOverview = {
    currentWager: WagerCard | null;
    lastWager: WagerCard | null;
    currentLeader: WagerLeader | null;
    lastOutcome?: WagerLeader | null;
};

function formatWagerPeriod(weekStart?: string, weekEnd?: string) {
    if (!weekStart || !weekEnd) return 'No week recorded';
    const start = new Date(weekStart);
    const end = new Date(weekEnd);
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

function formatPartnerWeight(weight?: number | null, unit?: string | null) {
    if (typeof weight !== 'number' || !Number.isFinite(weight)) {
        return { value: '--', unit: unit === 'lbs' ? 'lbs' : 'kg' };
    }

    return {
        value: weight.toFixed(1),
        unit: unit === 'lbs' ? 'lbs' : 'kg',
    };
}

function formatPartnerGoal(primaryGoal?: string | null) {
    switch (primaryGoal) {
        case 'WEIGHT_LOSS':
        case 'weight_loss':
        case 'weightloss':
            return 'Weight loss';
        case 'ENDURANCE':
        case 'endurance':
        case 'running':
            return 'Running';
        case 'MAINTENANCE':
        case 'maintenance':
        case 'both':
        case 'BOTH':
            return 'Weight loss + running';
        default:
            return 'No goal set';
    }
}

export default function PartnerScreen() {
    const { authFetch, isAuthenticated } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { connected: isPartnerConnected, sendMessage: sendChatMessage } = useChat();

    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);

    const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
    const [partner, setPartner] = useState<Partner | null>(null);
    const [hasPartner, setHasPartner] = useState(false);

    const [pendingReceived, setPendingReceived] = useState<Invite[]>([]);
    const [sentInvites, setSentInvites] = useState<Invite[]>([]);
    const [latestInvite, setLatestInvite] = useState<Invite | null>(null);
    const [dashboardLoading, setDashboardLoading] = useState(false);
    const [myTodaySummary, setMyTodaySummary] = useState<TodaySummary | null>(null);
    const [partnerTodaySummary, setPartnerTodaySummary] = useState<PartnerSummary | null>(null);
    const [partnerWeekProgress, setPartnerWeekProgress] = useState<PartnerWeekProgress | null>(null);
    const [wagerOverview, setWagerOverview] = useState<WagerOverview | null>(null);
    const [waterNudgeSentAt, setWaterNudgeSentAt] = useState<number | null>(null);
    const [isLastWagerSheetOpen, setIsLastWagerSheetOpen] = useState(false);
    const [isPointsHistoryOpen, setIsPointsHistoryOpen] = useState(false);
    const [partnerPointsHistory, setPartnerPointsHistory] = useState<PartnerPointsHistoryEntry[]>([]);
    const [partnerPointsHistoryLoading, setPartnerPointsHistoryLoading] = useState(false);
    const [partnerPointsHistoryError, setPartnerPointsHistoryError] = useState<string | null>(null);
    const [showAllPartnerPointsHistory, setShowAllPartnerPointsHistory] = useState(false);
    const [activeNotificationIndex, setActiveNotificationIndex] = useState(0);
    const [sentToast, setSentToast] = useState<{ id: number; message: string } | null>(null);

    const [currentStep, setCurrentStep] = useState(0); // 0: Start, 1: Invite, 2: Share

    const pulseAnim = useRef(new Animated.Value(1)).current;
    const fadeAnim = useRef(new Animated.Value(1)).current;
    const slideAnim = useRef(new Animated.Value(0)).current;
    const heroNotificationAnim = useRef(new Animated.Value(0)).current;
    const heroNotificationTranslateX = useRef(new Animated.Value(28)).current;
    const sentToastAnim = useRef(new Animated.Value(0)).current;
    const notificationDirectionRef = useRef<1 | -1>(1);
    const sentToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.03,
                    duration: 1200,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1200,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, [pulseAnim]);

    useEffect(() => {
        if (!waterNudgeSentAt) return;
        const remaining = 60 * 60 * 1000 - (Date.now() - waterNudgeSentAt);
        if (remaining <= 0) {
            setWaterNudgeSentAt(null);
            return;
        }
        const timer = setTimeout(() => setWaterNudgeSentAt(null), remaining);
        return () => clearTimeout(timer);
    }, [waterNudgeSentAt]);

    useEffect(() => {
        heroNotificationAnim.setValue(0);
        heroNotificationTranslateX.setValue(notificationDirectionRef.current * 32);
        Animated.parallel([
            Animated.timing(heroNotificationAnim, {
                toValue: 1,
                duration: 420,
                useNativeDriver: true,
            }),
            Animated.timing(heroNotificationTranslateX, {
                toValue: 0,
                duration: 420,
                useNativeDriver: true,
            }),
        ]).start();
    }, [
        heroNotificationAnim,
        heroNotificationTranslateX,
        activeNotificationIndex,
        partner?.displayName,
        partner?.weightLost,
        partnerTodaySummary?.food,
        partnerTodaySummary?.exercise,
        partnerTodaySummary?.exerciseMinutes,
        partnerTodaySummary?.distanceKm,
        partnerTodaySummary?.goal,
        partnerTodaySummary?.steps,
        partnerTodaySummary?.stepsTarget,
        partnerTodaySummary?.waterMl,
        partnerTodaySummary?.lastWaterUpdate,
        partnerWeekProgress?.activeStreak,
        partnerWeekProgress?.missedRunDays,
    ]);

    useEffect(() => {
        return () => {
            if (sentToastTimerRef.current) {
                clearTimeout(sentToastTimerRef.current);
            }
        };
    }, []);

    const transitionToStep = (step: number) => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: step > currentStep ? -20 : 20,
                duration: 200,
                useNativeDriver: true,
            })
        ]).start(() => {
            setCurrentStep(step);
            slideAnim.setValue(step > currentStep ? 20 : -20);
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                })
            ]).start();
        });
    };

    const handleBackPress = useCallback(() => {
        if (currentStep > 0) {
            transitionToStep(currentStep - 1);
            return;
        }

        if (router.canGoBack()) {
            router.back();
            return;
        }

        router.push('/(tabs)');
    }, [currentStep, router]);

    const fetchPartnerData = useCallback(async () => {
        if (!isAuthenticated) return;
        try {
            const profileRes = await authFetch(`${API_BASE_URL}/profile`);
            const profileData = await profileRes.json();
            if (profileData.user) {
                setCurrentUser({
                    id: profileData.user.id,
                    displayName: profileData.user.displayName,
                    email: profileData.user.email,
                });
            }

            const partnerRes = await authFetch(`${API_BASE_URL}/partner`);
            const partnerData = await partnerRes.json();
            setHasPartner(partnerData.hasPartner);
            setPartner(partnerData.partner);

            const pendingRes = await authFetch(`${API_BASE_URL}/partner/invites/pending`);
            const pendingData = await pendingRes.json();
            setPendingReceived(pendingData.invites || []);

            const sentRes = await authFetch(`${API_BASE_URL}/partner/invites/sent`);
            const sentData = await sentRes.json();
            const sent = sentData.invites || [];
            setSentInvites(sent);

            if (partnerData.hasPartner && partnerData.partner) {
                setDashboardLoading(true);
                try {
                    const [mySummaryRes, partnerSummaryRes, partnerWeekRes, wagerOverviewRes, activeWagerRes] = await Promise.all([
                        authFetch(`${API_BASE_URL}/summary/today`),
                        authFetch(`${API_BASE_URL}/summary/partner`),
                        authFetch(`${API_BASE_URL}/summary/partner/week`),
                        authFetch(`${API_BASE_URL}/wager/overview`),
                        authFetch(`${API_BASE_URL}/wager/active`),
                    ]);

                    const [mySummaryData, partnerSummaryData, partnerWeekData, wagerOverviewData, activeWagerData] = await Promise.all([
                        mySummaryRes.json(),
                        partnerSummaryRes.json(),
                        partnerWeekRes.json(),
                        wagerOverviewRes.json(),
                        activeWagerRes.json(),
                    ]);

                    const resolvedCurrentWager = wagerOverviewData?.currentWager ?? activeWagerData?.wager ?? null;

                    setMyTodaySummary(mySummaryData ?? null);
                    setPartnerTodaySummary(partnerSummaryData?.hasPartner ? partnerSummaryData.partner : null);
                    setPartnerWeekProgress(partnerWeekData?.hasPartner ? partnerWeekData.partner : null);
                    setWagerOverview(
                        wagerOverviewData
                            ? {
                                ...wagerOverviewData,
                                currentWager: resolvedCurrentWager,
                            }
                            : {
                                currentWager: resolvedCurrentWager,
                                lastWager: null,
                                currentLeader: null,
                                lastOutcome: null,
                            }
                    );
                } catch (dashboardErr) {
                    console.log('[Partner] Dashboard fetch error:', dashboardErr);
                } finally {
                    setDashboardLoading(false);
                }
            } else {
                setMyTodaySummary(null);
                setPartnerTodaySummary(null);
                setPartnerWeekProgress(null);
                setWagerOverview(null);
                setDashboardLoading(false);
            }

            // If we have no partner but have a pending sent invite, jump to the share screen
            if (currentStep === 0 && !partnerData.hasPartner && sent.length > 0 && sent.some((i: any) => i.status === 'PENDING')) {
                setCurrentStep(2);
            }
        } catch (err: any) {
            console.log('[Partner] Fetch error:', err);
        }
    }, [authFetch, currentStep, isAuthenticated]);

    useEffect(() => {
        fetchPartnerData();
    }, [fetchPartnerData]);

    useFocusEffect(
        useCallback(() => {
            fetchPartnerData();
        }, [fetchPartnerData])
    );

    const sendInvite = async () => {
        if (!email.trim()) return;
        setLoading(true);
        try {
            const res = await authFetch(`${API_BASE_URL}/partner/invite`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim().toLowerCase() }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || data.message || 'Failed to send invite');
            setLatestInvite(data.invite || null);
            transitionToStep(2);
            setEmail('');
            fetchPartnerData();
        } catch (err: any) {
            Alert.alert('Error', err.message);
        } finally {
            setLoading(false);
        }
    };

    const latestPendingInvite = latestInvite?.status === 'PENDING' ? latestInvite : null;
    const pendingSentInvite = sentInvites.find((invite) => invite.status === 'PENDING') || null;
    const inviteToDisplay = latestPendingInvite || pendingSentInvite;
    const inviteCode = inviteToDisplay?.code || '';
    const inviterName = currentUser?.displayName || 'My coach partner';
    const shareMessage = inviteCode
        ? `${inviterName} invited you to join them on The AI Coach.\n\nInvite code: ${inviteCode}\n\n1. Open the app\n2. Tap "I have a code"\n3. Enter the code and accept the invite sent to ${inviteToDisplay?.toEmail || 'your email'}`
        : '';

    const shareInvite = async () => {
        if (!shareMessage) return;
        await Share.share({ message: shareMessage });
    };

    const acceptInvite = async (inviteId: string) => {
        setLoading(true);
        try {
            const res = await authFetch(`${API_BASE_URL}/partner/invites/${inviteId}/accept`, { method: 'POST' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to accept invite');
            Alert.alert('Success', `You are now connected with ${data.partnerName}!`);
            fetchPartnerData();
        } catch (err: any) {
            Alert.alert('Error', err.message);
        } finally {
            setLoading(false);
        }
    };

    const disconnect = async () => {
        Alert.alert('Disconnect', `Disconnect from ${partner?.displayName}?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Disconnect',
                style: 'destructive',
                onPress: async () => {
                    setLoading(true);
                    try {
                        const res = await authFetch(`${API_BASE_URL}/partner/disconnect`, { method: 'POST' });
                        if (!res.ok) throw new Error('Failed to disconnect');
                        fetchPartnerData();
                    } catch (err: any) {
                        Alert.alert('Error', err.message);
                    } finally {
                        setLoading(false);
                    }
                },
            },
        ]);
    };

    const fetchPartnerPointsHistory = useCallback(async () => {
        if (!isAuthenticated || !hasPartner) return;
        setPartnerPointsHistoryLoading(true);
        setPartnerPointsHistoryError(null);
        try {
            const response = await authFetch(`${API_BASE_URL}/partner/points-history`);
            const data = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(data?.error || 'Failed to load partner points history');
            }
            setPartnerPointsHistory(Array.isArray(data?.entries) ? data.entries : []);
        } catch (err: any) {
            setPartnerPointsHistory([]);
            setPartnerPointsHistoryError(err?.message || 'Failed to load partner points history');
        } finally {
            setPartnerPointsHistoryLoading(false);
        }
    }, [authFetch, hasPartner, isAuthenticated]);

    const openPartnerPointsHistory = useCallback(() => {
        setShowAllPartnerPointsHistory(false);
        setIsPointsHistoryOpen(true);
        fetchPartnerPointsHistory();
    }, [fetchPartnerPointsHistory]);

    const visiblePartnerPointsHistory = React.useMemo(
        () => (showAllPartnerPointsHistory ? partnerPointsHistory : partnerPointsHistory.slice(0, 5)),
        [partnerPointsHistory, showAllPartnerPointsHistory]
    );

    const groupedPartnerPointsHistory = React.useMemo(() => {
        return visiblePartnerPointsHistory.reduce<Array<{ dayKey: string; entries: PartnerPointsHistoryEntry[] }>>((groups, entry) => {
            const existing = groups.find((group) => group.dayKey === entry.dayKey);
            if (existing) {
                existing.entries.push(entry);
            } else {
                groups.push({ dayKey: entry.dayKey, entries: [entry] });
            }
            return groups;
        }, []);
    }, [visiblePartnerPointsHistory]);

    const formatPointsHistoryDay = useCallback((dayKey: string) => {
        const [year, month, day] = dayKey.split('-').map(Number);
        if (!year || !month || !day) return dayKey;
        return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
        });
    }, []);

    const formatPointsHistoryTime = useCallback((awardedAt: string) => {
        const date = new Date(awardedAt);
        if (Number.isNaN(date.getTime())) return '';
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
        });
    }, []);

    const cancelInvite = async () => {
        if (!inviteToDisplay) return;
        
        Alert.alert('Cancel Invite', `Cancel invitation to ${inviteToDisplay.toEmail}?`, [
            { text: 'No', style: 'cancel' },
            {
                text: 'Yes, Cancel',
                style: 'destructive',
                onPress: async () => {
                    setLoading(true);
                    try {
                        const res = await authFetch(`${API_BASE_URL}/partner/invites/${inviteToDisplay.id}`, { method: 'DELETE' });
                        const data = await res.json().catch(() => null);
                        if (!res.ok) throw new Error(data?.error || 'Failed to cancel invite');
                        Alert.alert('Success', 'Invitation cancelled.');
                        setLatestInvite(null);
                        setSentInvites((prev) => prev.filter((invite) => invite.id !== inviteToDisplay.id));
                        transitionToStep(0);
                        fetchPartnerData();
                    } catch (err: any) {
                        Alert.alert('Error', err.message);
                    } finally {
                        setLoading(false);
                    }
                },
            },
        ]);
    };

    const currentLeader = wagerOverview?.currentLeader ?? null;
    const activeWager = wagerOverview?.currentWager ?? null;
    const lastWager = wagerOverview?.lastWager ?? null;
    const lastOutcome = wagerOverview?.lastOutcome ?? null;
    const lastWagerSummary =
        lastWager && lastOutcome
            ? lastOutcome.loser === 'YOU'
                ? `Last week: you lost`
                : lastOutcome.loser === 'PARTNER'
                    ? `Last week: ${partner?.displayName || lastOutcome.partnerName} lost`
                    : lastOutcome.loser === 'BOTH'
                        ? 'Last week: both lost'
                        : 'Last week: nobody lost'
            : null;
    const openTopLastWagerBreakdown = useCallback(() => {
        if (!lastWager || !lastOutcome || !partner) return;
        setIsLastWagerSheetOpen(true);
    }, [lastOutcome, lastWager, partner]);
    const partnerGoal = partnerTodaySummary?.goal ?? 0;
    const partnerNetCalories = (partnerTodaySummary?.food ?? 0) - (partnerTodaySummary?.exercise ?? 0);
    const partnerCaloriesOverTarget = Math.max(0, partnerNetCalories - partnerGoal);
    const showPartnerCaloriesWarning = partnerCaloriesOverTarget > 0;
    const partnerNeedsWaterNudge = (() => {
        if (!partnerTodaySummary) return false;
        const now = new Date();
        if ((partnerTodaySummary.waterMl ?? 0) === 0) {
            return now.getHours() >= 10;
        }
        if (!partnerTodaySummary.lastWaterUpdate) return false;
        const diff = Date.now() - new Date(partnerTodaySummary.lastWaterUpdate).getTime();
        return diff > 2 * 60 * 60 * 1000;
    })();
    const partnerWeight = formatPartnerWeight(partner?.currentWeight, partner?.weightUnit);
    const partnerGoalLabel = formatPartnerGoal(partner?.primaryGoal);
    const mySteps = myTodaySummary?.steps ?? 0;
    const partnerSteps = partnerTodaySummary?.steps ?? 0;
    const stepLead = partnerSteps - mySteps;
    const partnerStepsRemaining = Math.max(0, (partnerTodaySummary?.stepsTarget ?? 0) - partnerSteps);
    const partnerRunRemaining = Math.max(0, (partnerTodaySummary?.runKmTarget ?? 0) - (partnerTodaySummary?.distanceKm ?? 0));
    const partnerWorkoutDone = (partnerTodaySummary?.distanceKm ?? 0) >= (partnerTodaySummary?.runKmTarget ?? 0)
        ? (partnerTodaySummary?.runKmTarget ?? 0) > 0
        : (partnerTodaySummary?.exerciseMinutes ?? 0) >= 20 || (partnerTodaySummary?.distanceKm ?? 0) >= 2;
    const partnerRecoveryComeback =
        (partnerWeekProgress?.missedRunDays ?? 0) > 0 &&
        (((partnerTodaySummary?.exerciseMinutes ?? 0) >= 20) ||
            ((partnerTodaySummary?.distanceKm ?? 0) >= 2) ||
            partnerSteps >= Math.round((partnerTodaySummary?.stepsTarget ?? 0) * 0.7));
    const partnerIsQuiet =
        new Date().getHours() >= 12 &&
        partnerSteps < Math.max(1500, Math.round((partnerTodaySummary?.stepsTarget ?? 0) * 0.15)) &&
        (partnerTodaySummary?.exerciseMinutes ?? 0) === 0 &&
        (partnerTodaySummary?.waterMl ?? 0) < 500;
    const hasStepLeadChange = Math.abs(stepLead) >= 500;
    const partnerNotifications: PartnerNotification[] = partner
        ? [
            showPartnerCaloriesWarning
                ? {
                    id: 'calorie-warning',
                    tone: 'warning',
                    title: 'Calorie Warning',
                    body: `${partner.displayName} is overeating today by ${Math.round(partnerCaloriesOverTarget)} calories.`,
                    actions: [
                        { label: 'Rescue', message: "You've got this. Reset the next meal and finish strong." },
                        { label: 'Roast', message: "Calories are getting spicy. Tighten it up ðŸ˜…" },
                    ],
                }
                : null,
            typeof partner.weightLost === 'number' && partner.weightLost >= 0.5
                ? {
                    id: 'weight-win',
                    tone: 'success',
                    title: 'Weight Win',
                    body: `${partner.displayName} has dropped ${partner.weightLost.toFixed(1)} ${partnerWeight.unit}.`,
                    actions: [
                        { label: 'Gas Up', message: `Huge win. ${partner.weightLost.toFixed(1)} ${partnerWeight.unit} down is serious work.` },
                        { label: 'Ask How', message: 'What clicked for you this week? That drop is clean.' },
                    ],
                }
                : null,
            lastWager && lastOutcome
                ? {
                    id: 'last-wager-result',
                    tone:
                        lastOutcome.loser === 'PARTNER'
                            ? 'success'
                            : lastOutcome.loser === 'YOU' || lastOutcome.loser === 'BOTH'
                                ? 'warning'
                                : 'info',
                    title: 'Last Wager Result',
                    body:
                        lastOutcome.loser === 'YOU'
                            ? `You lost the last wager for ${formatWagerPeriod(lastWager.weekStart, lastWager.weekEnd)}.`
                            : lastOutcome.loser === 'PARTNER'
                                ? `${partner.displayName} lost the last wager for ${formatWagerPeriod(lastWager.weekStart, lastWager.weekEnd)}.`
                                : lastOutcome.loser === 'BOTH'
                                    ? `Both of you missed the target in the last wager for ${formatWagerPeriod(lastWager.weekStart, lastWager.weekEnd)}.`
                                    : `Nobody lost the last wager for ${formatWagerPeriod(lastWager.weekStart, lastWager.weekEnd)}.`,
                    actions: [
                        { label: 'View KMs', onPress: openTopLastWagerBreakdown },
                        lastOutcome.loser === 'PARTNER'
                            ? { label: 'Remind', message: "Last week's wager went your way. Ready for the next one?" }
                            : lastOutcome.loser === 'YOU'
                                ? { label: 'Rematch', message: "You got last week's wager. Run it back this week." }
                                : lastOutcome.loser === 'BOTH'
                                    ? { label: 'Reset', message: "We both missed last week's wager. Let's fix that this week." }
                                    : { label: 'Next Week', message: "No loser last week. Let's settle it this week." },
                    ],
                }
                : null,
            partnerNeedsWaterNudge
                ? {
                    id: 'hydration-alert',
                    tone: 'info',
                    title: 'Hydration Alert!',
                    body: `${partner.displayName} has been quiet on water for a while!`,
                    actions: [
                        {
                            label: 'Drink',
                            message: `HEY ${partner.displayName.toUpperCase()}! Drink some water right now.`,
                            onPress: () => setWaterNudgeSentAt(Date.now()),
                        },
                        { label: 'Chug', message: 'Hydration check. Go smash a full bottle.' },
                    ],
                }
                : null,
            hasStepLeadChange
                ? {
                    id: 'step-lead-change',
                    tone: stepLead > 0 ? 'warning' : 'success',
                    title: 'Step Lead Change',
                    body: stepLead > 0
                        ? `${partner.displayName} just moved ahead by ${stepLead.toLocaleString()} steps.`
                        : `You are ahead by ${Math.abs(stepLead).toLocaleString()} steps right now.`,
                    actions: stepLead > 0
                        ? [
                            { label: 'Catch Up', message: `Nice step lead. I'm coming for it today.` },
                            { label: 'Respect', message: `Good move on steps. Not for long.` },
                        ]
                        : [
                            { label: 'Flex', message: `You're behind on steps. Catch me if you can.` },
                            { label: 'Push', message: `You're close. Go finish your steps and make this interesting.` },
                        ],
                }
                : null,
            partnerWorkoutDone
                ? {
                    id: 'workout-complete',
                    tone: 'success',
                    title: 'Workout Complete',
                    body: `${partner.displayName} has already put work in today${(partnerTodaySummary?.distanceKm ?? 0) > 0 ? ` with ${(partnerTodaySummary?.distanceKm ?? 0).toFixed(1)} km done` : ''}.`,
                    actions: [
                        { label: 'Nice Work', message: 'Strong work today. Workout ticked off.' },
                        { label: 'Rematch', message: 'Nice session. Run it back tomorrow.' },
                    ],
                }
                : null,
            (partnerWeekProgress?.activeStreak ?? 0) >= 3
                ? {
                    id: 'streak-hit',
                    tone: 'success',
                    title: 'Streak Hit',
                    body: `${partner.displayName} is on a ${(partnerWeekProgress?.activeStreak ?? 0)}-day streak.`,
                    actions: [
                        { label: 'Respect', message: `That ${(partnerWeekProgress?.activeStreak ?? 0)}-day streak is legit.` },
                        { label: 'End It', message: `Nice streak. I'm ending it with a bigger day.` },
                    ],
                }
                : null,
            (partnerStepsRemaining > 0 && partnerStepsRemaining <= 1000) || (partnerRunRemaining > 0 && partnerRunRemaining <= 1)
                ? {
                    id: 'close-to-goal',
                    tone: 'info',
                    title: 'Close To Goal',
                    body: partnerStepsRemaining > 0 && partnerStepsRemaining <= 1000
                        ? `${partner.displayName} is only ${partnerStepsRemaining.toLocaleString()} steps away from goal.`
                        : `${partner.displayName} is only ${partnerRunRemaining.toFixed(1)} km away from the run target.`,
                    actions: [
                        { label: 'Finish It', message: 'You are too close not to finish this. Go close it out.' },
                        { label: 'No Excuses', message: 'You are basically there. Finish the last bit now.' },
                    ],
                }
                : null,
            partnerRecoveryComeback
                ? {
                    id: 'recovery-comeback',
                    tone: 'success',
                    title: 'Recovery Comeback',
                    body: `${partner.displayName} bounced back today after missing earlier work this week.`,
                    actions: [
                        { label: 'Big Comeback', message: 'That comeback matters. Strong response today.' },
                        { label: 'Keep Going', message: 'Good bounce back. Stack another solid day tomorrow.' },
                    ],
                }
                : null,
            activeWager?.status === 'ACTIVE' && currentLeader?.winner === 'PARTNER'
                ? {
                    id: 'wager-swing',
                    tone: 'warning',
                    title: 'Wager Swing',
                    body: `${partner.displayName} is leading the weekly wager right now.`,
                    actions: [
                        { label: 'Trash Talk', message: 'Enjoy that wager lead while it lasts.' },
                        { label: 'Lock In', message: "You took the lead. I saw it. I'm responding today." },
                    ],
                }
                : null,
            partnerIsQuiet
                ? {
                    id: 'silent-partner',
                    tone: 'info',
                    title: 'Silent Partner',
                    body: `${partner.displayName} has barely moved today. Check in before the day gets away.`,
                    actions: [
                        { label: 'Check In', message: 'You good? You have been quiet today.' },
                        { label: 'Wake Up', message: 'Wake up. We are not wasting today.' },
                    ],
                }
                : null,
        ].filter(Boolean) as PartnerNotification[]
        : [];
    const activeNotification =
        partnerNotifications[activeNotificationIndex] ??
        (partner
            ? {
                id: 'partner-update',
                tone: 'info' as const,
                title: 'Partner Update',
                body: `${partner.displayName} is locked in and moving well today.`,
                actions: [
                    { label: 'Tap In', message: 'Checking in. How are you moving today?' },
                    { label: 'Challenge', message: 'Solid day so far. Letâ€™s see who finishes stronger.' },
                ],
            }
            : null);
    const heroCardTitle = activeNotification?.title ?? `${partner?.displayName || 'Partner'} Update`;
    const heroCardBody = activeNotification?.body
        ?? `${partner?.displayName || 'Your partner'} has ${partnerTodaySummary?.steps?.toLocaleString() ?? '0'} steps today and is ${isPartnerConnected ? 'online' : 'offline'} right now.`;
    const heroNotificationToneStyle =
        activeNotification?.tone === 'warning'
            ? styles.heroNotificationWarning
            : activeNotification?.tone === 'success'
                ? styles.heroNotificationSuccess
                : styles.heroNotificationInfo;
    const heroNotificationIconStyle =
        activeNotification?.tone === 'warning'
            ? styles.heroNotificationIconWarning
            : activeNotification?.tone === 'success'
                ? styles.heroNotificationIconSuccess
                : styles.heroNotificationIconInfo;

    useEffect(() => {
        setActiveNotificationIndex(0);
    }, [partnerNotifications.length, partner?.displayName]);

    const cycleNotification = useCallback((direction: 1 | -1) => {
        if (partnerNotifications.length <= 1) return;
        notificationDirectionRef.current = direction;
        setActiveNotificationIndex((current) => {
            const next = current + direction;
            if (next < 0) return partnerNotifications.length - 1;
            if (next >= partnerNotifications.length) return 0;
            return next;
        });
    }, [partnerNotifications.length]);

    useEffect(() => {
        if (partnerNotifications.length <= 1) return;
        const timer = setInterval(() => {
            notificationDirectionRef.current = 1;
            setActiveNotificationIndex((current) => (current + 1) % partnerNotifications.length);
        }, 15000);
        return () => clearInterval(timer);
    }, [partnerNotifications.length]);

    const showSentToast = useCallback((message: string) => {
        const toastId = Date.now();
        if (sentToastTimerRef.current) {
            clearTimeout(sentToastTimerRef.current);
        }

        setSentToast({ id: toastId, message });
        sentToastAnim.stopAnimation();
        sentToastAnim.setValue(0);

        Animated.spring(sentToastAnim, {
            toValue: 1,
            useNativeDriver: true,
            friction: 8,
            tension: 80,
        }).start();

        sentToastTimerRef.current = setTimeout(() => {
            Animated.timing(sentToastAnim, {
                toValue: 0,
                duration: 220,
                useNativeDriver: true,
            }).start(({ finished }) => {
                if (finished) {
                    setSentToast((current) => (current?.id === toastId ? null : current));
                }
            });
        }, 2800);
    }, [sentToastAnim]);

    const sendMessage = useCallback((message: string) => {
        sendChatMessage(message);
        showSentToast(message);
    }, [sendChatMessage, showSentToast]);

    const sendPartnerMessage = useCallback((message: string, onSent?: () => void) => {
        if (!partner) return false;
        if (!isPartnerConnected) {
            Alert.alert('Chat unavailable', 'Live partner chat is not available right now.');
            return false;
        }

        sendMessage(message);
        onSent?.();
        return true;
    }, [isPartnerConnected, partner, sendMessage]);

    const handleNotificationAction = (action: NotificationAction) => {
        if (action.message?.trim()) {
            sendPartnerMessage(action.message, action.onPress);
            return;
        }

        action.onPress?.();
    };

    const handleViewMessages = useCallback(() => {
        if (sentToastTimerRef.current) {
            clearTimeout(sentToastTimerRef.current);
        }
        setSentToast(null);
        sentToastAnim.setValue(0);
        router.push({
            pathname: '/(tabs)',
            params: {
                openChat: '1',
                chatJump: String(Date.now()),
            },
        } as any);
    }, [router, sentToastAnim]);

    const currentWagerStatusText =
        !activeWager
            ? 'No active wager'
            : currentLeader?.winner === 'YOU'
            ? 'You'
            : currentLeader?.winner === 'PARTNER'
                ? partner?.displayName || currentLeader.partnerName
                : activeWager.status === 'PENDING'
                    ? 'Pending'
                    : 'Tie';
    const currentWagerSubtitle =
        !activeWager
            ? 'Challenge your partner to a run!'
            : activeWager.status === 'ACTIVE'
                ? `In progress - ${currentLeader?.statusLabel || 'Starting soon'}`
                : activeWager.status === 'PENDING'
                    ? `Pending - ${currentLeader?.statusLabel || 'Starting soon'}`
                    : `${currentWagerStatusText} is leading - ${currentLeader?.statusLabel || 'Starting soon'}`;
    const openLastWagerBreakdown = useCallback(() => {
        if (!lastWager || !lastOutcome || !partner) return;

        Alert.alert(
            `Last Wager â€¢ ${formatWagerPeriod(lastWager.weekStart, lastWager.weekEnd)}`,
            [
                `${currentUser?.displayName || 'You'}: ${lastOutcome.yourWeek.totalDistanceKm.toFixed(1)} km / ${lastOutcome.yourWeek.weeklyKmTarget.toFixed(1)} km`,
                `${partner.displayName}: ${lastOutcome.partnerWeek.totalDistanceKm.toFixed(1)} km / ${lastOutcome.partnerWeek.weeklyKmTarget.toFixed(1)} km`,
                '',
                lastOutcome.statusLabel,
            ].join('\n'),
            [{ text: 'OK' }]
        );
    }, [currentUser?.displayName, lastOutcome, lastWager, partner]);

    const sendCaloriesNudge = () => {
        if (!partner) return;
        if (!isPartnerConnected) {
            Alert.alert('Chat unavailable', 'Live partner chat is not available right now.');
            return;
        }

        Alert.alert(
            'Nudge Partner',
            `Send ${partner.displayName} a calorie nudge?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Gentle',
                    onPress: () => sendMessage("You've got this. Small reset and finish strong on calories today â¤ï¸"),
                },
                {
                    text: 'Coach',
                    onPress: () => sendMessage("Quick calorie nudge: keep the next meal lighter and you can still recover today ðŸ’ª"),
                },
                {
                    text: 'Funny',
                    onPress: () => sendMessage("Calories are getting spicy ðŸ˜… One smart choice and you're back in the game."),
                },
            ]
        );
    };

    const sendWaterNudge = () => {
        if (!partner) return;
        if (!isPartnerConnected) {
            Alert.alert('Chat unavailable', 'Live partner chat is not available right now.');
            return;
        }

        Alert.alert(
            'Hydration Nudge',
            `Send ${partner.displayName} a water reminder?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Send',
                    onPress: () => {
                        sendMessage(`HEY ${partner.displayName.toUpperCase()}! Drink some water. Your hydration has been quiet for 2 hours.`);
                        setWaterNudgeSentAt(Date.now());
                    },
                },
            ]
        );
    };

    const COLORS = {
        primary: '#FF6B6B',
        primaryDark: '#EE5253',
        primaryLight: '#FFF5F5',
        bg: '#FFFFFF',
        card: '#FFFFFF',
        border: '#F1F5F9',
        text: '#1F2937',
        muted: '#64748B',
        success: '#10B981',
        warning: '#F59E0B',
    };

    if (!isAuthenticated) return null;

    return (
        <View style={styles.container}>
            <StatusBar style="dark" />
            
            <View
                style={[
                    styles.topNav,
                    {
                        paddingTop: Math.max(insets.top + 8, 24),
                        height: Math.max(insets.top + 64, 88),
                    },
                ]}
            >
                <TouchableOpacity onPress={handleBackPress} style={styles.backCircle} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                    <ArrowLeft size={20} color={COLORS.text} />
                </TouchableOpacity>

                {currentStep !== 0 && (
                    <View style={styles.stepDots}>
                        {[0,1,2].map(s => (
                            <View key={s} style={[styles.dot, currentStep === s && styles.dotActive]} />
                        ))}
                    </View>
                )}

                <View style={{width: 44}} />
            </View>

            <Animated.View style={[styles.main, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                {currentStep === 0 && (
                    <View style={styles.content}>
                        {hasPartner && partner ? (
                            <ScrollView
                                style={styles.connectedScroll}
                                contentContainerStyle={[styles.connectedScrollContent, { paddingBottom: Math.max(insets.bottom + 24, 120) }]}
                                showsVerticalScrollIndicator={false}
                            >
                                <View style={styles.partnerHeaderRow}>
                                    <View style={styles.partnerHeaderIdentity}>
                                        <View style={styles.heroAvatarRow}>
                                            <View style={styles.partnerHeaderAvatar}>
                                                <Text style={styles.heroAvatarLetter}>{currentUser?.displayName?.charAt(0).toUpperCase()}</Text>
                                            </View>
                                            <View style={styles.partnerHeaderAvatarPartner}>
                                                <Text style={styles.heroAvatarLetter}>{partner.displayName.charAt(0).toUpperCase()}</Text>
                                                <View style={[styles.onlineDot, { backgroundColor: isPartnerConnected ? '#10B981' : '#F59E0B' }]} />
                                            </View>
                                        </View>
                                        <View style={styles.partnerHeaderText}>
                                            <Text style={styles.partnerHeaderName}>{partner.displayName}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.partnerHeaderActions}>
                                        <TouchableOpacity style={styles.partnerHeaderAction} onPress={disconnect}>
                                            <Unlink size={14} color="#64748B" />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <Animated.View
                                    style={[
                                        styles.notifCard,
                                        heroNotificationToneStyle,
                                        {
                                            opacity: heroNotificationAnim,
                                            transform: [
                                                {
                                                    translateX: heroNotificationTranslateX,
                                                },
                                                {
                                                    scale: heroNotificationAnim.interpolate({
                                                        inputRange: [0, 1],
                                                        outputRange: [0.98, 1],
                                                    }),
                                                },
                                            ],
                                        },
                                    ]}
                                >
                                    <View style={styles.notifTopRow}>
                                        <View style={[styles.notifIconLg, 
                                            activeNotification?.tone === 'warning' ? styles.heroNotificationIconWarning :
                                            activeNotification?.tone === 'success' ? styles.heroNotificationIconSuccess :
                                            styles.heroNotificationIconInfo
                                        ]}>
                                            {activeNotification?.id === 'hydration-alert' ? <Droplets size={22} color="#FFF" /> :
                                             activeNotification?.tone === 'warning' ? <AlertTriangle size={22} color="#FFF" /> :
                                             activeNotification?.tone === 'success' ? <CheckCircle2 size={22} color="#FFF" /> :
                                             <Bell size={22} color="#FFF" />}
                                        </View>
                                        <View style={styles.notifTitleWrap}>
                                            <Text style={styles.notifTag}>{heroCardTitle}</Text>
                                            {partnerNotifications.length > 1 && (
                                                <View style={styles.notifMetaRow}>
                                                    <View style={styles.notifDots}>
                                                        {partnerNotifications.map((notification, index) => (
                                                            <View
                                                                key={notification.id}
                                                                style={[
                                                                    styles.notifDot,
                                                                    index === activeNotificationIndex && styles.notifDotActive,
                                                                ]}
                                                            />
                                                        ))}
                                                    </View>
                                                    <View style={styles.notifNavRow}>
                                                        <TouchableOpacity
                                                            style={styles.notifNavButton}
                                                            onPress={() => cycleNotification(-1)}
                                                        >
                                                            <ArrowLeft size={12} color="#FFFFFF" />
                                                        </TouchableOpacity>
                                                        <TouchableOpacity
                                                            style={styles.notifNavButton}
                                                            onPress={() => cycleNotification(1)}
                                                        >
                                                            <ArrowRight size={12} color="#FFFFFF" />
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                    <Text style={styles.notifBody}>{heroCardBody}</Text>
                                    {!!activeNotification?.actions?.length && (
                                        <View style={styles.notifActionsRow}>
                                            {activeNotification.actions.slice(0, 2).map((action) => (
                                                <TouchableOpacity
                                                    key={`${activeNotification.id}-${action.label}`}
                                                    style={styles.notifActionButton}
                                                    onPress={() => handleNotificationAction(action)}
                                                >
                                                    <Text style={styles.notifActionText}>{action.label}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    )}

                                </Animated.View>

                                <TouchableOpacity
                                    style={styles.partnerPointsCard}
                                    activeOpacity={0.88}
                                    onPress={openPartnerPointsHistory}
                                >
                                    <Text style={styles.partnerPointsCardLabel}>Partner Points</Text>
                                    <View style={styles.partnerPointsRow}>
                                        <View style={styles.partnerPointsIcon}>
                                            <Heart size={16} color="#FF6B6B" fill="#FF6B6B" />
                                        </View>
                                        <Text style={styles.partnerPointsValue}>{(partner.points ?? partner.pointsBalance ?? 0).toLocaleString()}</Text>
                                        <View style={styles.partnerPointsChevron}>
                                            <ChevronRight size={16} color="#94A3B8" />
                                        </View>
                                    </View>
                                </TouchableOpacity>

                                {/* Dashboard */}
                                {dashboardLoading ? (
                                    <View style={styles.loadingCard}>
                                        <ActivityIndicator color="#FF6B6B" />
                                    </View>
                                ) : (
                                    <>
                                        {/* Wager Card */}
                                        <View style={styles.wagerCard}>
                                            <View style={styles.wagerHeader}>
                                                <Text style={styles.wagerTag}>WEEKLY WAGER</Text>
                                                {activeWager && <View style={styles.liveDot} />}
                                            </View>
                                            <Text style={styles.wagerTitle}>{activeWager ? activeWager.title : 'No active wager'}</Text>
                                            <Text style={styles.wagerSub}>{currentWagerSubtitle}</Text>

                                            {activeWager && currentLeader && (
                                                <View style={styles.wagerStats}>
                                                    <View style={styles.wagerStatBlock}>
                                                        <Text style={styles.wagerStatNum}>{currentLeader.yourWeek.totalDistanceKm.toFixed(1)}</Text>
                                                        <Text style={styles.wagerStatUnit}>km Â· You</Text>
                                                    </View>
                                                    <View style={styles.wagerDivider} />
                                                    <View style={styles.wagerStatBlock}>
                                                        <Text style={styles.wagerStatNum}>{currentLeader.partnerWeek.totalDistanceKm.toFixed(1)}</Text>
                                                        <Text style={styles.wagerStatUnit}>km Â· {partner.displayName}</Text>
                                                    </View>
                                                </View>
                                            )}
                                        </View>

                                        {/* Metric Cards */}
                                        <View style={styles.metricsGrid}>
                                            <View style={[styles.metricCard, showPartnerCaloriesWarning ? styles.metricCardWarning : undefined]}>
                                                {showPartnerCaloriesWarning ? (
                                                    <AlertTriangle size={14} color="#FFF" style={{ marginBottom: 8 }} />
                                                ) : (
                                                    <View style={[styles.metricDot, { backgroundColor: '#FF6B6B' }]} />
                                                )}
                                                <Text style={[styles.metricLabel, showPartnerCaloriesWarning ? styles.metricLabelLight : undefined]}>Calories</Text>
                                                <Text style={[styles.metricVal, showPartnerCaloriesWarning ? styles.metricValLight : undefined]}>
                                                    {showPartnerCaloriesWarning ? `+${Math.round(partnerCaloriesOverTarget)}` : 'On track'}
                                                </Text>
                                                {showPartnerCaloriesWarning && (
                                                    <TouchableOpacity style={styles.metricActionBtn} onPress={sendCaloriesNudge}>
                                                        <MessageCircleMore size={16} color="#EF4444" />
                                                    </TouchableOpacity>
                                                )}
                                            </View>

                                            <View style={[styles.metricCard, (partnerNeedsWaterNudge && !waterNudgeSentAt) ? styles.metricCardWater : waterNudgeSentAt ? styles.metricCardSuccess : undefined]}>
                                                {(partnerNeedsWaterNudge && !waterNudgeSentAt) ? (
                                                    <AlertTriangle size={14} color="#FFF" style={{ marginBottom: 8 }} />
                                                ) : (
                                                    <View style={[styles.metricDot, { backgroundColor: waterNudgeSentAt ? '#FFF' : '#3B82F6' }]} />
                                                )}
                                                <Text style={[styles.metricLabel, (partnerNeedsWaterNudge || waterNudgeSentAt) ? styles.metricLabelLight : undefined]}>Water</Text>
                                                <Text style={[styles.metricVal, (partnerNeedsWaterNudge || waterNudgeSentAt) ? styles.metricValLight : undefined]}>
                                                    {waterNudgeSentAt ? 'Nudged' : partnerNeedsWaterNudge ? 'Low!' : 'Good'}
                                                </Text>
                                                {partnerNeedsWaterNudge && !waterNudgeSentAt && (
                                                    <TouchableOpacity style={styles.metricActionBtn} onPress={sendWaterNudge}>
                                                        <Bell size={16} color="#3B82F6" />
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        </View>

                                        <View style={styles.metricsGrid}>
                                            <View style={styles.metricCard}>
                                                <View style={[styles.metricDot, { backgroundColor: '#8B5CF6' }]} />
                                                <Text style={styles.metricLabel}>Weight</Text>
                                                <Text style={styles.metricVal}>{partnerWeight.value}<Text style={styles.metricUnit}> {partnerWeight.unit}</Text></Text>
                                            </View>

                                            <View style={styles.metricCard}>
                                                <View style={[styles.metricDot, { backgroundColor: '#F59E0B' }]} />
                                                <Text style={styles.metricLabel}>Goal</Text>
                                                <Text style={styles.metricVal}>{partnerGoalLabel}</Text>
                                            </View>
                                        </View>

                                        {/* Activity */}
                                        <TouchableOpacity
                                            style={styles.activityCard}
                                            activeOpacity={lastWagerSummary ? 0.85 : 1}
                                            disabled={!lastWagerSummary}
                                            onPress={openTopLastWagerBreakdown}
                                        >
                                            <Text style={styles.activityLabel}>RECENT ACTIVITY</Text>
                                            <Text style={styles.activityText}>
                                                {lastWagerSummary
                                                    ? lastWagerSummary
                                                    : 'Challenge your partner to get started'}
                                            </Text>
                                        </TouchableOpacity>
                                    </>
                                )}
                            </ScrollView>
                        ) : (
                            <ScrollView 
                                style={styles.connectedScroll}
                                contentContainerStyle={[
                                    styles.unconnectedScrollContent,
                                    { paddingBottom: Math.max(insets.bottom + 24, 40) },
                                ]}
                                showsVerticalScrollIndicator={false}
                            >
                                <View style={styles.welcomeBox}>
                                    <View style={styles.mockupHeader}>
                                        <View style={styles.mockAvatarHero}>
                                            <Users size={40} color="#FFFFFF" />
                                        </View>
                                        <View style={styles.mockAvatarSecondary}>
                                            <Heart size={28} color="#FFFFFF" fill="rgba(255,255,255,0.18)" />
                                        </View>
                                    </View>
                                    <View style={styles.welcomeTextShell}>
                                        <Text style={styles.titleModern}>Connect to Partner</Text>
                                        <Text style={styles.subtitleModern}>Team up with a partner to see each other&apos;s progress, compare stats, and stay on track together.</Text>
                                    </View>
                                    
                                    {pendingReceived.length > 0 ? (
                                        <TouchableOpacity style={styles.incomingBannerModern} onPress={() => acceptInvite(pendingReceived[0].id)}>
                                            <View style={styles.bannerInfo}>
                                                <View style={styles.bannerIconShell}>
                                                    <CheckCircle2 size={24} color="#10B981" />
                                                </View>
                                                <View>
                                                    <Text style={styles.bannerTextModern}>Incoming Invite</Text>
                                                    <Text style={styles.bannerSubModern}>From {pendingReceived[0].fromUser?.displayName}</Text>
                                                </View>
                                            </View>
                                            <View style={styles.bannerActionModern}>
                                                <Text style={styles.bannerActionText}>Accept</Text>
                                            </View>
                                        </TouchableOpacity>
                                    ) : (
                                        <TouchableOpacity style={styles.primaryBtnModern} onPress={() => transitionToStep(1)}>
                                            <Text style={styles.primaryBtnTextModern}>Find Partner</Text>
                                            <ArrowRight size={24} color="#FFF" />
                                        </TouchableOpacity>
                                    )}
                                </View>

                                {!hasPartner && (
                                    <View style={styles.footerProfile}>
                                        <View style={styles.miniavatar}>
                                            <Text style={styles.miniavatarText}>{currentUser?.displayName?.charAt(0)}</Text>
                                        </View>
                                        <Text style={styles.footerName}>{currentUser?.displayName}</Text>
                                    </View>
                                )}
                            </ScrollView>
                        )}
                    </View>
                )}

                {currentStep === 1 && (
                    <ScrollView 
                        style={styles.content}
                        contentContainerStyle={[styles.connectedScrollContent, { paddingBottom: Math.max(insets.bottom + 24, 120), alignItems: 'center' }]}
                        showsVerticalScrollIndicator={false}
                    >
                         <View style={styles.iconRing}>
                            <Mail size={32} color="#EF4444" />
                        </View>
                        <Text style={styles.title}>Invite.</Text>
                        <Text style={styles.subtitle}>Type your partner&apos;s email below.</Text>
                        
                        <View style={styles.inputShell}>
                            <TextInput
                                style={styles.input}
                                placeholder="email@example.com"
                                placeholderTextColor="#9CA3AF"
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoFocus
                                editable={!loading}
                            />
                        </View>

                        <TouchableOpacity 
                            style={[styles.primaryBtn, (loading || !email.trim()) && styles.btnDisabled]} 
                            onPress={sendInvite}
                            disabled={loading || !email.trim()}
                        >
                            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>Send Invite</Text>}
                        </TouchableOpacity>
                        
                        <TouchableOpacity style={styles.ghostBtn} onPress={() => transitionToStep(0)}>
                            <Text style={styles.ghostBtnText}>Cancel</Text>
                        </TouchableOpacity>
                    </ScrollView>
                )}

                {currentStep === 2 && (
                    <ScrollView 
                        style={styles.content}
                        contentContainerStyle={[styles.connectedScrollContent, { paddingBottom: Math.max(insets.bottom + 24, 120), alignItems: 'center' }]}
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={styles.iconRing}>
                            <CheckCircle2 size={32} color="#EF4444" />
                        </View>
                        <Text style={styles.title}>Share.</Text>
                        <Text style={styles.subtitle}>Code sent to {inviteToDisplay?.toEmail}</Text>

                        <View style={styles.codeShell}>
                            <Text style={styles.codeText}>{inviteCode}</Text>
                        </View>

                        <Animated.View style={[styles.pulseBox, { transform: [{ scale: pulseAnim }] }]}>
                            <Text style={styles.pulseText}>Partner needs to enter this code in the app</Text>
                        </Animated.View>

                        <View style={styles.buttonRow}>
                            <TouchableOpacity style={styles.shareOption} onPress={shareInvite}>
                                <Share2 size={24} color="#111827" />
                                <Text style={styles.shareOptionText}>Share Code</Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity style={[styles.shareOption, { marginTop: 12, backgroundColor: '#FEF2F2' }]} onPress={cancelInvite}>
                                <Trash2 size={24} color="#EF4444" />
                                <Text style={[styles.shareOptionText, { color: '#EF4444' }]}>Delete Invitation</Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity style={styles.doneBtn} onPress={() => transitionToStep(0)}>
                            <Text style={styles.doneBtnText}>Done</Text>
                        </TouchableOpacity>
                    </ScrollView>
                )}

            </Animated.View>

            <Modal
                visible={isLastWagerSheetOpen && !!lastWager && !!lastOutcome && !!partner}
                transparent
                animationType="fade"
                onRequestClose={() => setIsLastWagerSheetOpen(false)}
            >
                <View style={styles.lastWagerModalRoot}>
                    <TouchableOpacity
                        activeOpacity={1}
                        style={styles.lastWagerBackdrop}
                        onPress={() => setIsLastWagerSheetOpen(false)}
                    />
                    <View style={styles.lastWagerSheet}>
                        <Text style={styles.lastWagerSheetTag}>Last Wager</Text>
                        <Text style={styles.lastWagerSheetTitle}>
                            {lastWager ? formatWagerPeriod(lastWager.weekStart, lastWager.weekEnd) : 'No week recorded'}
                        </Text>
                        <Text style={styles.lastWagerSheetStatus}>{lastOutcome?.statusLabel ?? 'No result recorded'}</Text>

                        <View style={styles.lastWagerStatsRow}>
                            <View style={styles.lastWagerStatCard}>
                                <Text style={styles.lastWagerStatLabel}>{currentUser?.displayName || 'You'}</Text>
                                <Text style={styles.lastWagerStatValue}>{lastOutcome?.yourWeek.totalDistanceKm.toFixed(1)} km</Text>
                                <Text style={styles.lastWagerStatMeta}>Target {lastOutcome?.yourWeek.weeklyKmTarget.toFixed(1)} km</Text>
                            </View>
                            <View style={styles.lastWagerStatCard}>
                                <Text style={styles.lastWagerStatLabel}>{partner?.displayName}</Text>
                                <Text style={styles.lastWagerStatValue}>{lastOutcome?.partnerWeek.totalDistanceKm.toFixed(1)} km</Text>
                                <Text style={styles.lastWagerStatMeta}>Target {lastOutcome?.partnerWeek.weeklyKmTarget.toFixed(1)} km</Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={styles.lastWagerCloseButton}
                            onPress={() => setIsLastWagerSheetOpen(false)}
                        >
                            <Text style={styles.lastWagerCloseButtonText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal
                visible={isPointsHistoryOpen && !!partner}
                transparent
                animationType="fade"
                onRequestClose={() => setIsPointsHistoryOpen(false)}
            >
                <View style={styles.pointsHistoryModalRoot}>
                    <TouchableOpacity
                        activeOpacity={1}
                        style={styles.pointsHistoryBackdrop}
                        onPress={() => {
                            setIsPointsHistoryOpen(false);
                            setShowAllPartnerPointsHistory(false);
                        }}
                    />
                    <View style={styles.pointsHistorySheet}>
                        <View style={styles.pointsHistoryHeader}>
                            <View style={styles.pointsHistoryHeaderText}>
                                <Text style={styles.pointsHistoryTag}>Partner Points</Text>
                                <Text style={styles.pointsHistoryTitle}>{partner?.displayName || 'Partner'} history</Text>
                            </View>
                            <TouchableOpacity
                                style={styles.pointsHistoryCloseButton}
                                onPress={() => {
                                    setIsPointsHistoryOpen(false);
                                    setShowAllPartnerPointsHistory(false);
                                }}
                            >
                                <Text style={styles.pointsHistoryCloseText}>Close</Text>
                            </TouchableOpacity>
                        </View>

                        {partnerPointsHistoryLoading ? (
                            <View style={styles.pointsHistoryState}>
                                <ActivityIndicator color="#FF6B6B" />
                            </View>
                        ) : partnerPointsHistoryError ? (
                            <View style={styles.pointsHistoryState}>
                                <Text style={styles.pointsHistoryStateTitle}>Could not load history</Text>
                                <Text style={styles.pointsHistoryStateBody}>{partnerPointsHistoryError}</Text>
                            </View>
                        ) : groupedPartnerPointsHistory.length === 0 ? (
                            <View style={styles.pointsHistoryState}>
                                <Text style={styles.pointsHistoryStateTitle}>No point history yet</Text>
                                <Text style={styles.pointsHistoryStateBody}>Your partner has not earned any tracked points yet.</Text>
                            </View>
                        ) : (
                            <ScrollView
                                style={styles.pointsHistoryScroll}
                                contentContainerStyle={styles.pointsHistoryScrollContent}
                                showsVerticalScrollIndicator={false}
                            >
                                {groupedPartnerPointsHistory.map((group) => (
                                    <View key={group.dayKey} style={styles.pointsHistoryGroup}>
                                        <Text style={styles.pointsHistoryDay}>{formatPointsHistoryDay(group.dayKey)}</Text>
                                        {group.entries.map((entry, index) => (
                                            <View key={`${entry.dayKey}-${entry.awardedAt}-${entry.category}-${index}`} style={styles.pointsHistoryRow}>
                                                <View style={styles.pointsHistoryEntryText}>
                                                    <Text style={styles.pointsHistoryCategory}>{entry.categoryLabel}</Text>
                                                    <Text style={styles.pointsHistoryMeta}>{formatPointsHistoryTime(entry.awardedAt)}</Text>
                                                </View>
                                                <Text style={styles.pointsHistoryEarned}>+{entry.earnedPoints}</Text>
                                            </View>
                                        ))}
                                    </View>
                                ))}
                                {partnerPointsHistory.length > 5 && (
                                    <TouchableOpacity
                                        style={styles.pointsHistoryMoreButton}
                                        onPress={() => setShowAllPartnerPointsHistory((prev) => !prev)}
                                    >
                                        <Text style={styles.pointsHistoryMoreButtonText}>
                                            {showAllPartnerPointsHistory ? 'Show recent only' : 'Show more'}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>

            {sentToast && (
                <Animated.View
                    pointerEvents="box-none"
                    style={[
                        styles.sentToast,
                        {
                            bottom: insets.bottom + 18,
                            opacity: sentToastAnim,
                            transform: [{
                                translateY: sentToastAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [18, 0],
                                }),
                            }],
                        },
                    ]}
                >
                    <View style={styles.sentToastCard}>
                        <View style={styles.sentToastHeader}>
                            <Text style={styles.sentToastTag}>Message Sent</Text>
                            <Text style={styles.sentToastPreview} numberOfLines={2}>{sentToast.message}</Text>
                        </View>
                        <TouchableOpacity style={styles.sentToastButton} onPress={handleViewMessages}>
                            <Text style={styles.sentToastButtonText}>View messages</Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    topNav: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        zIndex: 10,
    },
    backCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F8FAFC',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    stepDots: {
        flexDirection: 'row',
        gap: 8,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#F1F5F9',
    },
    dotActive: {
        backgroundColor: '#FF6B6B',
        width: 20,
    },
    main: {
        flex: 1,
        width: '100%',
    },
    content: {
        flex: 1,
        width: '100%',
    },
    connectedScroll: {
        width: '100%',
    },
    connectedScrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 120,
    },
    unconnectedScrollContent: {
        flexGrow: 1,
        paddingHorizontal: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    // ---- Partner Header ----
    partnerHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        paddingVertical: 10,
        paddingHorizontal: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    partnerHeaderIdentity: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
        minWidth: 0,
    },
    heroAvatarRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    partnerHeaderAvatar: {
        width: 34,
        height: 34,
        borderRadius: 12,
        backgroundColor: '#FF6B6B',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#FFFFFF',
        zIndex: 2,
    },
    partnerHeaderAvatarPartner: {
        width: 34,
        height: 34,
        borderRadius: 12,
        backgroundColor: '#1E293B',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: -10,
        borderWidth: 2,
        borderColor: '#FFFFFF',
        zIndex: 1,
    },
    heroAvatarLetter: {
        fontSize: 14,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    onlineDot: {
        position: 'absolute',
        bottom: -1,
        right: -1,
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#FFF5F3',
    },
    partnerHeaderText: {
        flex: 1,
        minWidth: 0,
    },
    partnerHeaderName: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0F172A',
        letterSpacing: -0.3,
    },
    partnerHeaderActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    partnerHeaderAction: {
        padding: 8,
        borderRadius: 10,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    // ---- Notification Hero Card ----
    notifCard: {
        width: '100%',
        borderRadius: 24,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
        elevation: 8,
    },
    heroNotificationWarning: {
        backgroundColor: '#EF4444',
    },
    heroNotificationSuccess: {
        backgroundColor: '#10B981',
    },
    heroNotificationInfo: {
        backgroundColor: '#3B82F6',
    },
    notifTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
    },
    notifTitleWrap: {
        flex: 1,
    },
    notifIconLg: {
        width: 48,
        height: 48,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroNotificationIconWarning: {
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    heroNotificationIconSuccess: {
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    heroNotificationIconInfo: {
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    notifTag: {
        fontSize: 13,
        fontWeight: '800',
        color: 'rgba(255,255,255,0.8)',
        textTransform: 'uppercase',
        letterSpacing: 1.5,
    },
    notifDots: {
        flexDirection: 'row',
        gap: 6,
        marginTop: 8,
    },
    notifMetaRow: {
        marginTop: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    notifDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(255,255,255,0.28)',
    },
    notifDotActive: {
        width: 18,
        backgroundColor: '#FFFFFF',
    },
    notifNavRow: {
        flexDirection: 'row',
        gap: 8,
    },
    notifNavButton: {
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.16)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.22)',
    },
    notifBody: {
        fontSize: 18,
        fontWeight: '900',
        color: '#FFFFFF',
        lineHeight: 24,
        letterSpacing: -0.5,
    },
    notifActionsRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 18,
    },
    partnerPointsCard: {
        marginTop: -8,
        marginBottom: 20,
        padding: 16,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#FEE2E2',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.06,
        shadowRadius: 16,
        elevation: 4,
    },
    partnerPointsCardLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 10,
    },
    partnerPointsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    partnerPointsChevron: {
        marginLeft: 'auto',
    },
    partnerPointsIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#FFF1F2',
        alignItems: 'center',
        justifyContent: 'center',
    },
    partnerPointsValue: {
        fontSize: 24,
        fontWeight: '900',
        color: '#1E293B',
        letterSpacing: -0.5,
    },
    pointsHistoryModalRoot: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    pointsHistoryBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(15, 23, 42, 0.42)',
    },
    pointsHistorySheet: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: 20,
        paddingTop: 18,
        paddingBottom: 24,
        maxHeight: '76%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.14,
        shadowRadius: 22,
        elevation: 18,
    },
    pointsHistoryHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 18,
    },
    pointsHistoryHeaderText: {
        flex: 1,
        minWidth: 0,
        paddingRight: 8,
    },
    pointsHistoryTag: {
        fontSize: 11,
        fontWeight: '900',
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    pointsHistoryTitle: {
        marginTop: 6,
        fontSize: 24,
        fontWeight: '900',
        color: '#0F172A',
        letterSpacing: -0.6,
    },
    pointsHistoryCloseButton: {
        borderRadius: 999,
        backgroundColor: '#F8FAFC',
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        flexShrink: 0,
    },
    pointsHistoryCloseText: {
        fontSize: 11,
        fontWeight: '900',
        color: '#64748B',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    pointsHistoryScroll: {
        flexGrow: 0,
    },
    pointsHistoryScrollContent: {
        paddingBottom: 40,
        gap: 18,
    },
    pointsHistoryGroup: {
        gap: 10,
    },
    pointsHistoryDay: {
        fontSize: 13,
        fontWeight: '900',
        color: '#0F172A',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    pointsHistoryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 14,
        borderRadius: 18,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    pointsHistoryEntryText: {
        flex: 1,
        minWidth: 0,
        marginRight: 12,
    },
    pointsHistoryCategory: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0F172A',
    },
    pointsHistoryMeta: {
        marginTop: 4,
        fontSize: 12,
        fontWeight: '700',
        color: '#94A3B8',
    },
    pointsHistoryEarned: {
        fontSize: 20,
        fontWeight: '900',
        color: '#FF6B6B',
        letterSpacing: -0.5,
    },
    pointsHistoryMoreButton: {
        marginTop: 4,
        alignSelf: 'center',
        borderRadius: 999,
        backgroundColor: '#FFF1F2',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: '#FECDD3',
    },
    pointsHistoryMoreButtonText: {
        fontSize: 12,
        fontWeight: '900',
        color: '#E11D48',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    pointsHistoryState: {
        minHeight: 180,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    pointsHistoryStateTitle: {
        marginTop: 10,
        fontSize: 18,
        fontWeight: '900',
        color: '#0F172A',
        textAlign: 'center',
    },
    pointsHistoryStateBody: {
        marginTop: 8,
        fontSize: 14,
        fontWeight: '600',
        color: '#94A3B8',
        textAlign: 'center',
        lineHeight: 20,
    },
    notifActionButton: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.16)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.28)',
    },
    notifActionText: {
        fontSize: 11,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    lastWagerModalRoot: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    lastWagerBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
    },
    lastWagerSheet: {
        borderRadius: 28,
        backgroundColor: '#FFFFFF',
        padding: 22,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 0.18,
        shadowRadius: 28,
        elevation: 18,
    },
    lastWagerSheetTag: {
        fontSize: 12,
        fontWeight: '900',
        color: '#F97316',
        textTransform: 'uppercase',
        letterSpacing: 1.2,
    },
    lastWagerSheetTitle: {
        marginTop: 8,
        fontSize: 24,
        fontWeight: '900',
        color: '#0F172A',
        letterSpacing: -0.6,
    },
    lastWagerSheetStatus: {
        marginTop: 8,
        fontSize: 15,
        fontWeight: '700',
        color: '#475569',
    },
    lastWagerStatsRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 20,
    },
    lastWagerStatCard: {
        flex: 1,
        borderRadius: 20,
        backgroundColor: '#F8FAFC',
        padding: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    lastWagerStatLabel: {
        fontSize: 13,
        fontWeight: '800',
        color: '#64748B',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    lastWagerStatValue: {
        marginTop: 10,
        fontSize: 28,
        fontWeight: '900',
        color: '#0F172A',
        letterSpacing: -0.8,
    },
    lastWagerStatMeta: {
        marginTop: 6,
        fontSize: 13,
        fontWeight: '700',
        color: '#94A3B8',
    },
    lastWagerCloseButton: {
        marginTop: 20,
        alignSelf: 'flex-end',
        borderRadius: 999,
        backgroundColor: '#0F172A',
        paddingHorizontal: 18,
        paddingVertical: 11,
    },
    lastWagerCloseButtonText: {
        fontSize: 13,
        fontWeight: '900',
        color: '#FFFFFF',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    sentToast: {
        position: 'absolute',
        left: 16,
        right: 16,
        zIndex: 40,
    },
    sentToastCard: {
        backgroundColor: '#0F172A',
        borderRadius: 22,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.22,
        shadowRadius: 22,
        elevation: 12,
    },
    sentToastHeader: {
        flex: 1,
    },
    sentToastTag: {
        fontSize: 11,
        fontWeight: '900',
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: 1.1,
        marginBottom: 4,
    },
    sentToastPreview: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
        lineHeight: 19,
    },
    sentToastButton: {
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 9,
        backgroundColor: '#FF6B6B',
    },
    sentToastButtonText: {
        fontSize: 11,
        fontWeight: '900',
        color: '#FFFFFF',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    // ---- Loading ----
    loadingCard: {
        height: 120,
        backgroundColor: '#F8FAFC',
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    // ---- Wager Card ----
    wagerCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 24,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 16,
        elevation: 3,
    },
    wagerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    wagerTag: {
        fontSize: 11,
        fontWeight: '800',
        color: '#FF6B6B',
        letterSpacing: 1.5,
    },
    liveDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#10B981',
    },
    wagerTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: '#1E293B',
        letterSpacing: -0.5,
        marginBottom: 4,
    },
    wagerSub: {
        fontSize: 14,
        fontWeight: '600',
        color: '#94A3B8',
        marginBottom: 20,
    },
    wagerStats: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
    },
    wagerStatBlock: {
        flex: 1,
    },
    wagerStatNum: {
        fontSize: 28,
        fontWeight: '900',
        color: '#1E293B',
        letterSpacing: -1,
    },
    wagerStatUnit: {
        fontSize: 13,
        fontWeight: '600',
        color: '#94A3B8',
        marginTop: 2,
    },
    wagerDivider: {
        width: 1,
        height: 40,
        backgroundColor: '#F1F5F9',
        marginHorizontal: 20,
    },
    // ---- Metric Cards ----
    metricsGrid: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12,
    },
    metricCard: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 10,
        elevation: 2,
    },
    metricDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginBottom: 12,
    },
    metricLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 6,
    },
    metricVal: {
        fontSize: 20,
        fontWeight: '900',
        color: '#1E293B',
        letterSpacing: -0.5,
    },
    metricUnit: {
        fontSize: 14,
        fontWeight: '600',
        color: '#94A3B8',
    },
    metricCardWarning: {
        backgroundColor: '#EF4444',
    },
    metricCardWater: {
        backgroundColor: '#3B82F6',
    },
    metricCardSuccess: {
        backgroundColor: '#10B981',
    },
    metricLabelLight: {
        color: 'rgba(255,255,255,0.7)',
    },
    metricValLight: {
        color: '#FFFFFF',
    },
    metricActionBtn: {
        position: 'absolute',
        top: 16,
        right: 16,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    // ---- Activity Card ----
    activityCard: {
        backgroundColor: '#F8FAFC',
        borderRadius: 20,
        padding: 20,
    },
    activityLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: '#94A3B8',
        letterSpacing: 1.5,
        marginBottom: 8,
    },
    activityText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#64748B',
    },
    // ---- Loading fallback ----
    infoCardLoading: {
        width: '100%',
        height: 100,
        backgroundColor: '#F8FAFC',
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    welcomeBox: {
        width: width * 0.9,
        alignItems: 'flex-start',
        paddingVertical: 20,
    },
    mockupHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 40,
        marginLeft: 10,
    },
    mockAvatarHero: {
        width: 100,
        height: 100,
        borderRadius: 40,
        backgroundColor: '#FF6B6B',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2,
        shadowColor: '#FF6B6B',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.4,
        shadowRadius: 24,
        elevation: 10,
    },
    mockAvatarSecondary: {
        width: 80,
        height: 80,
        borderRadius: 32,
        backgroundColor: '#111827',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: -30,
        zIndex: 1,
        borderWidth: 4,
        borderColor: '#FFFFFF',
    },
    welcomeTextShell: {
        marginBottom: 48,
        width: '100%',
    },
    titleModern: {
        fontSize: 56,
        fontWeight: '900',
        color: '#111827',
        letterSpacing: -2.5,
        marginBottom: 16,
        lineHeight: 60,
    },
    subtitleModern: {
        fontSize: 18,
        color: '#64748B',
        lineHeight: 28,
        fontWeight: '600',
        paddingRight: 20,
    },
    primaryBtnModern: {
        backgroundColor: '#111827',
        width: '100%',
        height: 72,
        borderRadius: 24,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
        elevation: 8,
    },
    primaryBtnTextModern: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    btnDisabled: {
        backgroundColor: '#E2E8F0',
    },
    incomingBannerModern: {
        width: '100%',
        backgroundColor: '#ECFDF5',
        padding: 24,
        borderRadius: 32,
        flexDirection: 'column',
        gap: 20,
    },
    bannerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    bannerIconShell: {
        width: 48,
        height: 48,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    bannerTextModern: {
        fontSize: 18,
        fontWeight: '900',
        color: '#065F46',
        letterSpacing: -0.5,
    },
    bannerSubModern: {
        fontSize: 14,
        fontWeight: '700',
        color: '#047857',
        opacity: 0.8,
    },
    bannerActionModern: {
        backgroundColor: '#10B981',
        width: '100%',
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    bannerActionText: {
        fontSize: 16,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 0.5,
    },
    primaryBtnText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '900',
    },
    footerProfile: {
        marginTop: 40,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 999,
        alignSelf: 'center',
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    miniavatar: {
        width: 32,
        height: 32,
        borderRadius: 12,
        backgroundColor: '#FF6B6B',
        justifyContent: 'center',
        alignItems: 'center',
    },
    miniavatarText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '900',
    },
    footerName: {
        fontSize: 14,
        fontWeight: '800',
        color: '#1F2937',
    },
    inputShell: {
        width: width * 0.88,
        height: 64,
        backgroundColor: '#F8FAFC',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        paddingHorizontal: 24,
        marginBottom: 20,
        justifyContent: 'center',
    },
    input: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1F2937',
    },
    ghostBtn: {
        marginTop: 16,
        padding: 12,
    },
    ghostBtnText: {
        color: '#94A3B8',
        fontWeight: '800',
        fontSize: 16,
    },
    codeShell: {
        paddingVertical: 24,
        paddingHorizontal: 40,
        backgroundColor: '#FFFFFF',
        borderRadius: 28,
        borderWidth: 2,
        borderColor: '#FF6B6B',
        borderStyle: 'dashed',
        marginBottom: 32,
    },
    codeText: {
        fontSize: 48,
        fontWeight: '900',
        color: '#FF6B6B',
        letterSpacing: 8,
    },
    pulseBox: {
        backgroundColor: '#FFFBEB',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 999,
        marginBottom: 40,
        borderWidth: 1,
        borderColor: '#FEF3C7',
    },
    pulseText: {
        color: '#D97706',
        fontSize: 13,
        fontWeight: '800',
    },
    buttonRow: {
        width: width * 0.88,
        marginBottom: 24,
    },
    shareOption: {
        width: '100%',
        height: 64,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    shareOptionText: {
        fontSize: 17,
        fontWeight: '800',
        color: '#1F2937',
    },
    doneBtn: {
        width: width * 0.88,
        height: 60,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 20,
    },
    doneBtnText: {
        fontSize: 17,
        fontWeight: '900',
        color: '#94A3B8',
    },
    iconRing: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#FEE2E2',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 36,
        fontWeight: '900',
        color: '#111827',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 18,
        color: '#64748B',
        marginBottom: 32,
    },
    primaryBtn: {
        width: '100%',
        backgroundColor: '#FF6B6B',
        paddingVertical: 18,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statusDotFloat: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 3,
        borderColor: '#F8FAFC',
    },
});



