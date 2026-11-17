import { useColorScheme } from '@/hooks/use-color-scheme';
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  useWindowDimensions,
  Modal,
  TouchableWithoutFeedback,
  Image,
  ScrollView,
  RefreshControl,
  Alert,
  LayoutChangeEvent,
  InteractionManager,
} from 'react-native';
import {
  Heart,
  Flame,
  Utensils,
  ScanLine,
  Swords,
  RefreshCw,
  Users,
  X,
  ChevronRight,
  AlertTriangle,
  UserCheck,
  UserX,
  Settings,
} from 'lucide-react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const MENU_ICONS = {
  partner: require('../../assets/menu/partner.png'),
  activity: require('../../assets/menu/activity.png'),
  exercises: require('../../assets/menu/exercises.png'),
  water: require('../../assets/menu/water.png'),
  goals: require('../../assets/menu/goals.png'),
  quest: require('../../assets/menu/quest.png'),
  settings: require('../../assets/menu/settings.png'),
} as const;
import Animated, {
  useSharedValue,
  withTiming,
  interpolate,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { hasStepPermissionConsent } from '../../config/healthPermissions';

// Hooks & Auth (Presumed imports)
import { usePoints } from '../../hooks/usePoints';
import { usePartnerSummary } from '../../hooks/usePartnerSummary';
import { useDailySummary, getDashboardData } from '../../hooks/useDailySummary';
import { useAuth } from '@/src/auth/authContext';
import { API_BASE_URL } from '../../config/api';
import { applyPartnerSurfacePayload, buildPartnerLivePayload } from '../../lib/partner-surface';
import { useStepSync } from '../../hooks/UseStepSync';
import { useRealtimePartner } from '../../hooks/useRealtimePartner';

// Components
import WeeklyRewardHome, { REWARD_RESIZE_EASING, REWARD_RESIZE_MS, rewardExpandedHeight } from '../../components/home/WeeklyRewardHome';
import HomeInvitations, { useHomeInvitations } from '../../components/home/HomeInvitations';
import { HomeAvatarScope } from '../../lib/home-avatar';
import CaloriesHome, { type PendingInvite } from '../../components/home/CaloriesHome';
import { preloadNutritionArtwork } from '../../components/home/nutritionAssets';
import { preloadTugArtwork } from '../../components/battle/tugAssets';
import { preloadRaceArtwork } from '../../components/race/raceAssets';
import CalorieWeek from '../../components/home/CalorieWeek';
import CalorieStatus from '../../components/home/CalorieStatus';
import StepSyncSection from '../../components/home/StepTracer';
import GoalProgress from '../../components/home/GoalProgress';
import { goalProgressState } from '../../components/home/goalProgressState';
import { notifyGoalComplete } from '../../lib/goal-celebration-events';
import StepWeek from '../../components/home/StepWeek';
import WorkoutHome from '../../components/home/WorkoutHome';
import WorkoutWeek from '../../components/home/WorkoutWeek';
import WaterHome from '../../components/home/WaterHome';
import WaterWeek from '../../components/home/WaterWeek';
import { useWorkoutPhotos } from '@/hooks/useWorkoutPhotos';
import { useWorkoutOverview } from '@/hooks/useWorkoutOverview';
import CollapsibleGoal from '../../components/home/CollapsibleGoal';
import GoalStreakBadge from '../../components/home/GoalStreakBadge';
import GoalSettingsSheet from '../../components/home/GoalSettingsSheet';
import { useHomeGoals, type HomeGoal } from '../../hooks/useHomeGoals';
import WeightHero from '../../components/home/WeightHero';
import PremiumNotification from '../../components/home/PremiumNotification';
import PremiumFullscreen from '../../components/home/PremiumFullscreen';
import InterveneBottomSheet, { INTERVENE_ANIMATION_COST, formatPointsAlert } from '../../components/home/InterveneBottomSheet';
import WaterReminderBottomSheet from '../../components/home/WaterReminderBottomSheet';
import type { PartnerReminderOption } from '../../components/partner/reminderAssets';
import { useChat, ChatMessage } from '../../contexts/ChatContext';
import { useInterventionCelebration, InterventionCelebrationRequest } from '../../hooks/useInterventionCelebration';

const HERO_RESIZE = { duration: REWARD_RESIZE_MS, easing: REWARD_RESIZE_EASING };

const HERO_PAGE = {
  NOTIFICATION: 0,
  REWARD: 1,
  CHAT: 2,
} as const;
const HERO_PAGES: number[] = [HERO_PAGE.NOTIFICATION, HERO_PAGE.REWARD, HERO_PAGE.CHAT];

const COLORS = {
  primary: '#FF6B6B', // This is the Coral color
  primarySoft: '#FFF1F2',
  textMain: '#1F2937',
  textMuted: '#6B7280',
  border: '#F3F4F6',
  white: '#FFFFFF',
  bg: '#F8FAFC',
  coral: '#FF6B6B',
};

export default function App() {
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const dark = useColorScheme() === 'dark';
  const router = useRouter();
  const isFocused = useIsFocused();
  const { openChat, chatJump } = useLocalSearchParams<{ openChat?: string; chatJump?: string }>();
  const mainScrollRef = useRef<Animated.ScrollView>(null);
  const activitySectionYRef = useRef(0);
  const heroPagerRef = useRef<Animated.ScrollView>(null);
  const activeHeroPageRef = useRef<number>(HERO_PAGE.REWARD);
  const lastChatJumpRef = useRef<string | null>(null);
  const lastRoutedCelebrationRef = useRef<string | null>(null);
  const [fullscreenCelebration, setFullscreenCelebration] =
    useState<InterventionCelebrationRequest | null>(null);
  const [cardCelebration, setCardCelebration] =
    useState<InterventionCelebrationRequest | null>(null);
  const lastMainScrollYRef = useRef(0);
  const heroLayoutRef = useRef({ y: 0, height: 0 });
  const [showInterveneSheet, setShowInterveneSheet] = useState(false);
  const [showWaterReminderSheet, setShowWaterReminderSheet] = useState(false);
  const [partner, setPartner] = useState<any>(null);
  const workoutPhotos = useWorkoutPhotos(partner?.id ?? null);
  const workoutOverview = useWorkoutOverview();
  const [waterGoalMetrics, setWaterGoalMetrics] = useState<{ current: number; target: number } | null>(null);
  const [nudgeSent, setNudgeSent] = useState(false);
  const [stepGoalStreak, setStepGoalStreak] = useState<{ count: number; name: string } | null>(null);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const { invitation, prize: homePrize } = useHomeInvitations();
  const heroPages = HERO_PAGES;
  const [stepRouteMetrics, setStepRouteMetrics] = useState<{ current: number; target: number } | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showPointsInfo, setShowPointsInfo] = useState(false);
  const [showGoalSettings, setShowGoalSettings] = useState(false);
  const homeGoals = useHomeGoals(partner?.id ?? null, isFocused);
  // Track active page for dots and title (default: weekly reward)
  const [activeHeroPage, setActiveHeroPage] = useState<number>(HERO_PAGE.REWARD);
  const [chatModerationBusy, setChatModerationBusy] = useState(false);

  useEffect(() => {
    activeHeroPageRef.current = activeHeroPage;
  }, [activeHeroPage]);
  const [isHeroVisibleOnScreen, setIsHeroVisibleOnScreen] = useState(true);
  const [stepPermissionEnabled, setStepPermissionEnabled] = useState<boolean | null>(null);

  const { 
    connected: chatConnected, 
    messages: chatMessages, 
    sendMessage,
    chatError,
    setIsViewingChat,
    currentUserId
  } = useChat() as {
    connected: boolean;
    messages: ChatMessage[];
    sendMessage: (content: string) => void;
    chatError: string | null;
    latestMessage: ChatMessage | null;
    isViewingChat: boolean;
    setIsViewingChat: (viewing: boolean) => void;
    clearUnread: () => void;
    currentUserId: string | null;
  };

  const heroScrollX = useSharedValue(0);
  const heroPageWidth = viewportWidth;
  const rewardHeroHeight = rewardExpandedHeight(viewportWidth, viewportHeight);
  const rewardHeightValue = useSharedValue(rewardHeroHeight);
  const rewardMix = useSharedValue(1);
  const otherHeroHeight = useSharedValue(235);
  const otherHeroMargin = useSharedValue(0);
  const isHomeChatVisible = isFocused && activeHeroPage === HERO_PAGE.CHAT && isHeroVisibleOnScreen;

  const closeMenuAndNavigate = useCallback((path: Parameters<typeof router.push>[0]) => {
    setIsMenuOpen(false);
    requestAnimationFrame(() => {
      router.push(path);
    });
  }, [router]);

  const { accessToken, authFetch, isAuthenticated, user } = useAuth();
  const { balance: points, refetch: refetchPoints, spend: spendPoints } = usePoints({ accessToken });
  const { summary, recalculate } = useDailySummary({ accessToken });
  const { partnerData: partnerSummary, hasPartner, refetch: refetchPartnerSummary } = usePartnerSummary({ accessToken });
  const { steps: liveSteps } = useStepSync({
    accessToken,
    permissionEnabledOverride: stepPermissionEnabled ?? undefined,
  });
  const {
    partnerSteps: partnerLiveSteps,
    partnerName: livePartnerName,
    isConnected: isPartnerLiveConnected,
  } = useRealtimePartner({ accessToken });

  const fetchPartner = useCallback(() => {
    if (!isAuthenticated) return;
    authFetch(`${API_BASE_URL}/partner`)
      .then(res => res.json())
      .then(data => {
        if (data.hasPartner) {
          setPartner(data.partner);
          return;
        }
        setPartner(null);
      })
      .catch(err => console.log(err));
  }, [isAuthenticated, authFetch]);

  const fetchPendingInvites = useCallback(() => {
    if (!isAuthenticated) return;
    authFetch(`${API_BASE_URL}/partner/invites/pending`)
      .then(res => res.json())
      .then(data => { setPendingInvites(data.invites || []); })
      .catch(err => console.log(err));
  }, [isAuthenticated, authFetch]);

  const resetHeroToReward = useCallback(() => {
    const page = HERO_PAGE.REWARD;
    heroPagerRef.current?.scrollTo({
      x: heroPageWidth * heroPages.indexOf(page),
      animated: false,
    });
    activeHeroPageRef.current = page;
    setActiveHeroPage(page);
  }, [heroPageWidth, heroPages]);

  // Defer refresh + hero reset until tab transition finishes.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const task = InteractionManager.runAfterInteractions(() => {
        if (!active) return;

        if (activeHeroPageRef.current !== HERO_PAGE.REWARD) {
          resetHeroToReward();
        }

        if (!isAuthenticated) return;

        void preloadTugArtwork();
        void preloadRaceArtwork();

        hasStepPermissionConsent()
          .then((granted) => {
            if (active) {
              setStepPermissionEnabled(granted);
            }
          })
          .catch(() => {
            if (active) {
              setStepPermissionEnabled(false);
            }
          });

        recalculate();
        refetchPoints();
        refetchPartnerSummary();
        fetchPartner();
        fetchPendingInvites();
      });

      return () => {
        active = false;
        task.cancel?.();
      };
    }, [
      isAuthenticated,
      recalculate,
      refetchPoints,
      refetchPartnerSummary,
      fetchPartner,
      fetchPendingInvites,
      resetHeroToReward,
    ])
  );

  const myData = useMemo(() => getDashboardData(summary), [summary]);
  const partnerIsNegative = useMemo(() => {
    if (!hasPartner || !partnerSummary) return false;
    return partnerSummary.goal - (partnerSummary.food - partnerSummary.exercise) < 0;
  }, [hasPartner, partnerSummary]);

  useFocusEffect(useCallback(() => {
    if (!isAuthenticated || !hasPartner || !partnerSummary || !summary) return;
    const task = InteractionManager.runAfterInteractions(() => {
      void preloadNutritionArtwork({ mine: myData, partner: partnerSummary, gender: user?.gender, partnerGender: partner?.gender });
    });
    return () => task.cancel();
  }, [isAuthenticated, hasPartner, partnerSummary, summary, myData, user?.gender, partner?.gender]));

  const latestPartnerMessage = useMemo(() => {
    return [...chatMessages]
      .filter((message) => message.fromUserId !== currentUserId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null;
  }, [chatMessages, currentUserId]);

  useEffect(() => {
    const widgetUserSteps = Math.max(0, Math.round(Math.max(liveSteps || 0, myData.steps || 0)));
    const widgetPartnerSteps = hasPartner
      ? Math.max(0, Math.round(Math.max(partnerLiveSteps || 0, partnerSummary?.steps || 0)))
      : 0;
    const payload = buildPartnerLivePayload({
      userName: 'You',
      userGender: user?.gender,
      partnerGender: hasPartner ? partner?.gender : null,
      userKcal: Math.max(0, Math.round(myData.food || 0)),
      userGoal: Math.max(0, Math.round(myData.goal || 0)),
      userSteps: widgetUserSteps,
      partnerName: hasPartner ? (partner?.displayName || partnerSummary?.name || livePartnerName || 'Partner') : 'Partner',
      partnerKcal: hasPartner ? Math.max(0, Math.round(partnerSummary?.food || 0)) : 0,
      partnerGoal: hasPartner ? Math.max(0, Math.round(partnerSummary?.goal || 0)) : 0,
      partnerSteps: widgetPartnerSteps,
      updatedAt: new Date().toISOString(),
      status: hasPartner ? 'connected' : 'no_partner',
      staleReason: hasPartner ? null : 'no_partner',
    });

    applyPartnerSurfacePayload(payload, { accessToken }).catch(() => {});
  }, [accessToken, hasPartner, livePartnerName, liveSteps, myData.food, myData.goal, myData.steps, partner?.displayName, partner?.gender, user?.gender, partnerLiveSteps, partnerSummary?.food, partnerSummary?.goal, partnerSummary?.name, partnerSummary?.steps]);

  useEffect(() => {
    fetchPartner();
  }, [fetchPartner]);

  const acceptInvite = useCallback(async (inviteId: string) => {
    try {
      const res = await authFetch(`${API_BASE_URL}/partner/invites/${inviteId}/accept`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to accept invite');
      Alert.alert('Partner connected', `You are now connected with ${data.partnerName}.`);
      recalculate();
      refetchPartnerSummary();
      fetchPartner();
      fetchPendingInvites();
    } catch (err: any) { Alert.alert('Error', err.message); }
  }, [authFetch, recalculate, refetchPartnerSummary, fetchPartner, fetchPendingInvites]);

  const declineInvite = useCallback(async (inviteId: string) => {
    try {
      const res = await authFetch(`${API_BASE_URL}/partner/invites/${inviteId}/decline`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to decline invite');
      fetchPendingInvites();
    } catch (err: any) { Alert.alert('Error', err.message); }
  }, [authFetch, fetchPendingInvites]);

  const updateHeroVisibility = useCallback((scrollY: number, nextHeroLayout = heroLayoutRef.current) => {
    if (nextHeroLayout.height <= 0) {
      setIsHeroVisibleOnScreen(true);
      return;
    }

    const viewportTop = scrollY;
    const viewportBottom = scrollY + Dimensions.get('window').height;
    const heroTop = nextHeroLayout.y;
    const heroBottom = nextHeroLayout.y + nextHeroLayout.height;
    const visible = heroBottom > viewportTop && heroTop < viewportBottom;

    setIsHeroVisibleOnScreen((prev) => (prev === visible ? prev : visible));
  }, []);

  const handleHeroLayout = useCallback((event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    const nextHeroLayout = { y, height };
    heroLayoutRef.current = nextHeroLayout;
    updateHeroVisibility(lastMainScrollYRef.current, nextHeroLayout);
  }, [updateHeroVisibility]);

  // Sync with global chat viewer state
  useEffect(() => {
    setIsViewingChat(isHomeChatVisible);
  }, [isHomeChatVisible, setIsViewingChat]);

  useEffect(() => {
    return () => setIsViewingChat(false);
  }, [setIsViewingChat]);

  const scrollToHeroPage = useCallback((pageIndex: number) => {
    const page = heroPages.includes(pageIndex) ? pageIndex : HERO_PAGE.NOTIFICATION;
    mainScrollRef.current?.scrollTo({ y: 0, animated: true });
    heroPagerRef.current?.scrollTo({ x: heroPageWidth * heroPages.indexOf(page), animated: true });
    activeHeroPageRef.current = page;
    setActiveHeroPage(page);
  }, [heroPageWidth, heroPages]);

  useEffect(() => {
    const current = activeHeroPageRef.current;
    const page = heroPages.includes(current) ? current : HERO_PAGE.NOTIFICATION;
    activeHeroPageRef.current = page;
    setActiveHeroPage(page);
    heroPagerRef.current?.scrollTo({ x: heroPageWidth * heroPages.indexOf(page), animated: false });
  }, [heroPages, heroPageWidth]);

  const scrollToChat = useCallback(() => {
    scrollToHeroPage(HERO_PAGE.CHAT);
  }, [scrollToHeroPage]);

  const interventionCelebration = useInterventionCelebration({
    messages: chatMessages,
    currentUserId,
  });

  useEffect(() => {
    if (!interventionCelebration?.key) return;
    if (lastRoutedCelebrationRef.current === interventionCelebration.key) return;
    lastRoutedCelebrationRef.current = interventionCelebration.key;

    if (interventionCelebration.copy.fromPartner) {
      setFullscreenCelebration(interventionCelebration);
      setCardCelebration(interventionCelebration);
      requestAnimationFrame(() => {
        scrollToHeroPage(HERO_PAGE.NOTIFICATION);
      });
      return;
    }

    setCardCelebration(null);
  }, [interventionCelebration, scrollToHeroPage]);

  const handleFullscreenFinish = useCallback(() => {
    setFullscreenCelebration(null);
  }, []);

  const refreshPartnerState = useCallback(() => {
    recalculate();
    refetchPartnerSummary();
    fetchPartner();
    fetchPendingInvites();
  }, [recalculate, refetchPartnerSummary, fetchPartner, fetchPendingInvites]);

  const handleStepPermissionGranted = useCallback(() => {
    setStepPermissionEnabled(true);
    refreshPartnerState();
  }, [refreshPartnerState]);

  useEffect(() => {
    if (openChat !== '1' || !chatJump || lastChatJumpRef.current === chatJump) return;
    lastChatJumpRef.current = chatJump;
    requestAnimationFrame(() => {
      scrollToChat();
    });
  }, [chatJump, openChat, scrollToChat]);

  const handleMotivatePartnerCalories = useCallback(() => {
    if (!hasPartner || !partner) return;
    setShowInterveneSheet(true);
  }, [hasPartner, partner]);

  const handleInterveneMessage = useCallback((text: string, _label: string) => {
    sendMessage(`[KCAL] ${text}`);
    setNudgeSent(true);
    setTimeout(() => setNudgeSent(false), 2500);
  }, [sendMessage]);

  const handleWaterReminderSend = useCallback(
    (option: PartnerReminderOption, message: string) => {
      sendMessage(message);
    },
    [sendMessage],
  );

  const handleInterveneAnimation = useCallback(async (option: { mode: string; text: string }) => {
    if (points < INTERVENE_ANIMATION_COST) {
      Alert.alert('Not enough points', formatPointsAlert(INTERVENE_ANIMATION_COST));
      return false;
    }

    const spent = await spendPoints(INTERVENE_ANIMATION_COST, 'calorie_intervention_animation');
    if (!spent) {
      Alert.alert('Not enough points', formatPointsAlert(INTERVENE_ANIMATION_COST));
      return false;
    }

    sendMessage(`[KCAL:${option.mode}] ${option.text}`);
    setNudgeSent(true);
    setTimeout(() => setNudgeSent(false), 2500);
    refetchPoints();
    return true;
  }, [points, spendPoints, sendMessage, refetchPoints]);

  const submitChatReport = useCallback(async () => {
    try {
      setChatModerationBusy(true);
      const res = await authFetch(`${API_BASE_URL}/partner/chat/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: latestPartnerMessage?.id,
          reason: 'partner_chat_header_report',
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit report');
      }

      Alert.alert('Report sent', 'Your report has been saved for review.');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setChatModerationBusy(false);
    }
  }, [authFetch, latestPartnerMessage?.id]);

  const handleReportPartnerChat = useCallback(() => {
    Alert.alert(
      'Report chat',
      'This flags the current partner conversation for review.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Report', style: 'destructive', onPress: () => { void submitChatReport(); } },
      ]
    );
  }, [submitChatReport]);

  const submitPartnerBlock = useCallback(async () => {
    try {
      setChatModerationBusy(true);
      const res = await authFetch(`${API_BASE_URL}/partner/chat/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: 'blocked_from_partner_chat',
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to block partner');
      }

      refreshPartnerState();
      scrollToHeroPage(HERO_PAGE.REWARD);
      Alert.alert('Partner blocked', 'Chat has been closed and the partner connection has been removed.');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setChatModerationBusy(false);
    }
  }, [authFetch, refreshPartnerState, scrollToHeroPage]);

  const handleBlockPartner = useCallback(() => {
    Alert.alert(
      'Block partner',
      'This will block this person, disconnect your partner link, and stop future chat until you reconnect manually.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Block', style: 'destructive', onPress: () => { void submitPartnerBlock(); } },
      ]
    );
  }, [submitPartnerBlock]);

  // --- ANIMATED STYLES (Moved to top level to fix hook rules) ---
  const headerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: withTiming(activeHeroPage === HERO_PAGE.REWARD ? 1 : 0),
    transform: [{ translateY: withTiming(activeHeroPage === HERO_PAGE.REWARD ? 0 : -20) }]
  }));

  const prevHeroPageRef = useRef<number>(HERO_PAGE.REWARD);
  useEffect(() => {
    const onReward = activeHeroPage === HERO_PAGE.REWARD;
    rewardMix.value = withTiming(onReward ? 1 : 0, HERO_RESIZE);
    if (!onReward) {
      const height = activeHeroPage === HERO_PAGE.CHAT ? 430 : 235;
      const margin = activeHeroPage === HERO_PAGE.CHAT ? -50 : 0;
      const fromReward = prevHeroPageRef.current === HERO_PAGE.REWARD;
      otherHeroHeight.value = fromReward ? height : withTiming(height, HERO_RESIZE);
      otherHeroMargin.value = fromReward ? margin : withTiming(margin, HERO_RESIZE);
    }
    prevHeroPageRef.current = activeHeroPage;
  }, [activeHeroPage, rewardMix, otherHeroHeight, otherHeroMargin]);

  const pagerAnimatedStyle = useAnimatedStyle(() => ({
    height: interpolate(rewardMix.value, [0, 1], [otherHeroHeight.value, rewardHeightValue.value]),
    marginTop: interpolate(rewardMix.value, [0, 1], [otherHeroMargin.value, 8]),
  }));



  const caloriesComplete = goalProgressState(summary?.consumedCalories, summary?.calorieTarget, true).complete;
  const stepsComplete = goalProgressState(stepRouteMetrics?.current ?? Math.max(liveSteps || 0, myData.steps || 0), stepRouteMetrics?.target ?? myData.stepsTarget ?? 10000).complete;
  const workoutComplete = goalProgressState(workoutOverview.data?.mine.weeklyCount, workoutOverview.data?.mine.weeklyTarget).complete;
  const waterComplete = goalProgressState(waterGoalMetrics?.current ?? summary?.waterMl, waterGoalMetrics?.target ?? summary?.waterTarget).complete;
  const celebrationDay = summary?.dayKey;
  const celebrationWeek = workoutOverview.data?.mine.weekStart;
  const visibleGoalKey = homeGoals.visible.join(',');
  useEffect(() => {
    if (!isFocused || !user?.id || !homeGoals.ready || !celebrationDay) return;
    const completed: Record<HomeGoal, boolean> = { calories: caloriesComplete, steps: stepsComplete, workout: workoutComplete, water: waterComplete };
    for (const goal of visibleGoalKey.split(',').filter(Boolean) as HomeGoal[]) {
      const period = goal === 'workout' ? celebrationWeek : celebrationDay;
      if (completed[goal] && period) notifyGoalComplete({ goal, period });
    }
  }, [isFocused, user?.id, homeGoals.ready, celebrationDay, celebrationWeek, visibleGoalKey, caloriesComplete, stepsComplete, workoutComplete, waterComplete]);

  const goalCards: Record<HomeGoal, React.ReactNode> = {
    calories: (
      <CalorieWeek summary={summary} compact>
      {({ calendar, streakBadge }) => <CollapsibleGoal connect={homeGoals.visible[homeGoals.visible.length - 1] !== 'calories'} number={1} title="Calorie Goal" titleAccessory={streakBadge}
        complete={caloriesComplete}
        overTarget={goalProgressState(summary?.consumedCalories, summary?.calorieTarget, true).overTarget}
        onIconPress={() => router.push('/activity')}
        defaultExpanded={false}
        status={<CalorieStatus showProgress calories={summary?.consumedCalories} target={summary?.calorieTarget} />}
        expandedStatus={calendar}>
        <CaloriesHome
          myData={myData}
          partnerSummary={partnerSummary}
          hasPartner={hasPartner}
          partnerName={livePartnerName}
          partnerGender={partner?.gender}
          partnerIsNegative={partnerIsNegative}
          onMotivate={handleMotivatePartnerCalories}
          nudgeSent={nudgeSent}
          pendingInvites={pendingInvites}
          acceptInvite={acceptInvite}
          declineInvite={declineInvite}
        />
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.85}
          style={[styles.logFoodButton, styles.nutritionLogFoodButton]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push({ pathname: '/activity', params: { action: 'logFood', t: Date.now() } });
          }}
        >
          <ScanLine size={20} color="#FFF" strokeWidth={2} />
          <Text style={styles.logFoodText}>Log Food</Text>
        </TouchableOpacity>
      </CollapsibleGoal>}
      </CalorieWeek>
    ),
    steps: (
      <StepWeek compact summary={summary} steps={stepRouteMetrics?.current ?? Math.max(liveSteps || 0, myData.steps || 0)} target={stepRouteMetrics?.target ?? myData.stepsTarget ?? 10000} streak={stepGoalStreak}>
      {({ calendar, streakBadge }) => <CollapsibleGoal connect={homeGoals.visible[homeGoals.visible.length - 1] !== 'steps'} number={2} title="Steps Goal" titleAccessory={streakBadge} onTitlePress={() => router.push('/StepbattleFull')}
        complete={stepsComplete}
        onIconPress={() => router.push('/StepbattleFull')}
        iconAccessibilityHint="Opens the full steps battle screen"
        defaultExpanded={false}
        contentStyle={{ paddingTop: 0 }}
        status={<GoalProgress current={stepRouteMetrics?.current ?? Math.max(liveSteps || 0, myData.steps || 0)} target={stepRouteMetrics?.target ?? myData.stepsTarget ?? 10000} unit="steps" />}
        expandedStatus={calendar}>
        {/* @ts-ignore */}
        <StepSyncSection
          hideHeader
          onNudge={() => {
            setNudgeSent(true);
            setTimeout(() => setNudgeSent(false), 2500);
          }}
          permissionEnabled={stepPermissionEnabled}
          onPermissionChange={setStepPermissionEnabled}
          onPermissionGranted={handleStepPermissionGranted}
          myFallbackLiveSteps={liveSteps}
          partnerFallbackLiveSteps={partnerLiveSteps}
          fallbackPartnerName={livePartnerName}
          isConnected={isPartnerLiveConnected}
          onStepMetricsChange={setStepRouteMetrics}
          onStreakLabelChange={setStepGoalStreak}
        />
      </CollapsibleGoal>}
      </StepWeek>
    ),
    workout: (
      <CollapsibleGoal connect={homeGoals.visible[homeGoals.visible.length - 1] !== 'workout'} number={3} title="Workout Goal" status={<GoalProgress current={workoutOverview.data?.mine.weeklyCount} target={workoutOverview.data?.mine.weeklyTarget} unit="workouts" />}
        complete={workoutComplete}
        onIconPress={() => router.push('/workout')}
        defaultExpanded={false}
        contentStyle={{ paddingTop: 0 }}
        titleAccessory={<GoalStreakBadge compact count={workoutPhotos.mine.streak} name="YOU" />}
        expandedStatus={<WorkoutWeek photos={workoutPhotos} dayKey={summary?.dayKey} participant={workoutOverview.data?.mine} unavailable={workoutOverview.loading || !!workoutOverview.error} />}
        onTitlePress={() => router.push('/workout')}>
      <WorkoutHome
        hideHeader
        photos={workoutPhotos}
        overview={workoutOverview.data}
        hasPartner={hasPartner}
        partnerName={livePartnerName}
        onMotivate={handleMotivatePartnerCalories}
      />
      </CollapsibleGoal>
    ),
    water: (
      <CollapsibleGoal connect={homeGoals.visible[homeGoals.visible.length - 1] !== 'water'} number={4} title="Water Goal" status={<GoalProgress current={waterGoalMetrics?.current ?? summary?.waterMl} target={waterGoalMetrics?.target ?? summary?.waterTarget} unit="ml" />} expandedStatus={<WaterWeek dayKey={summary?.dayKey} current={waterGoalMetrics?.current ?? summary?.waterMl} target={waterGoalMetrics?.target ?? summary?.waterTarget} />} onOpen={() => router.push({ pathname: '/activity', params: { action: 'water' } })}
        complete={waterComplete}
        onIconPress={() => router.push('/activity')}
        defaultExpanded={false}
        >
      <WaterHome
        hideHeader
        onProgressChange={setWaterGoalMetrics}
        hasPartner={hasPartner}
        partnerName={livePartnerName}
        partnerGender={partner?.gender}
        partnerSummary={partnerSummary}
        onRemind={() => setShowWaterReminderSheet(true)}
      />
      </CollapsibleGoal>
    ),
  };


  return (
    <View style={[styles.mainContainer, { backgroundColor: dark ? '#0F172A' : '#FFFFFF' }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* DROPDOWN MENU */}
      <Modal
        visible={isMenuOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsMenuOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsMenuOpen(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.menuDropdown, { top: insets.top + 50 }]}>
              <View style={styles.menuHeader}>
                <Text style={styles.menuTitle}>Menu</Text>
                <TouchableOpacity onPress={() => setIsMenuOpen(false)}>
                  <X size={18} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => closeMenuAndNavigate('/activity')}
              >
                <View style={styles.menuIconBox}>
                  <Image source={MENU_ICONS.activity} style={styles.menuIconImage} resizeMode="contain" />
                </View>
                <Text style={styles.menuItemText}>Activity</Text>
                <ChevronRight size={14} color={COLORS.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => closeMenuAndNavigate('/quest')}
              >
                <View style={styles.menuIconBox}>
                  <Image source={MENU_ICONS.quest} style={styles.menuIconImage} resizeMode="contain" />
                </View>
                <Text style={styles.menuItemText}>Quest</Text>
                <ChevronRight size={14} color={COLORS.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => closeMenuAndNavigate('/Plans?action=exercises')}
              >
                <View style={styles.menuIconBox}>
                  <Image source={MENU_ICONS.exercises} style={styles.menuIconImage} resizeMode="contain" />
                </View>
                <Text style={styles.menuItemText}>Exercises</Text>
                <ChevronRight size={14} color={COLORS.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => closeMenuAndNavigate('/activity?action=water')}
              >
                <View style={styles.menuIconBox}>
                  <Image source={MENU_ICONS.water} style={styles.menuIconImage} resizeMode="contain" />
                </View>
                <Text style={styles.menuItemText}>Water Tracking</Text>
                <ChevronRight size={14} color={COLORS.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => closeMenuAndNavigate('/(tabs)/marketplace')}
              >
                <View style={styles.menuIconBox}>
                  <Image source={MENU_ICONS.quest} style={styles.menuIconImage} resizeMode="contain" />
                </View>
                <Text style={styles.menuItemText}>Marketplace</Text>
                <ChevronRight size={14} color={COLORS.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => closeMenuAndNavigate('/explore')}
              >
                <View style={styles.menuIconBox}>
                  <Image source={MENU_ICONS.goals} style={styles.menuIconImage} resizeMode="contain" />
                </View>
                <Text style={styles.menuItemText}>Goals</Text>
                <ChevronRight size={14} color={COLORS.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => closeMenuAndNavigate({
                  pathname: '/remaining-steps',
                  params: {
                    current: stepRouteMetrics?.current ?? Math.max(liveSteps || 0, myData.steps || 0),
                    target: stepRouteMetrics?.target ?? myData.stepsTarget ?? 10000,
                  },
                })}
              >
                <View style={styles.menuIconBox}>
                  <Image source={MENU_ICONS.quest} style={styles.menuIconImage} resizeMode="contain" />
                </View>
                <Text style={styles.menuItemText}>Steps</Text>
                <ChevronRight size={14} color={COLORS.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => closeMenuAndNavigate('/Login')}
              >
                <View style={styles.menuIconBox}>
                  <Image source={MENU_ICONS.settings} style={styles.menuIconImage} resizeMode="contain" />
                </View>
                <Text style={styles.menuItemText}>Settings</Text>
                <ChevronRight size={14} color={COLORS.textMuted} />
              </TouchableOpacity>

            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <HomeAvatarScope userId={user?.id} partnerId={partner?.id}>
      <Animated.ScrollView
        refreshControl={<RefreshControl refreshing={workoutPhotos.loading} onRefresh={() => { void workoutPhotos.refresh(); void homeGoals.refresh(); }} />}
        ref={mainScrollRef}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        onScroll={(event) => {
          const scrollY = event.nativeEvent.contentOffset.y;
          lastMainScrollYRef.current = scrollY;
          updateHeroVisibility(scrollY);
        }}
        style={[styles.scrollContainer, { backgroundColor: dark ? '#0F172A' : '#FFFFFF' }]}
        contentContainerStyle={{ backgroundColor: COLORS.primary }}
        bounces={false}
        overScrollMode="never"
      >
        {/* HEADER */}
        <Animated.View style={[styles.header, { paddingTop: insets.top }, headerAnimatedStyle]}>

          <View style={styles.headerSide}>
            <TouchableOpacity
              style={styles.profileBtn}
              hitSlop={4}
              onPress={() => setIsMenuOpen(true)}
            >
              <MaterialCommunityIcons name="sort-variant" size={20} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          <Text numberOfLines={1} adjustsFontSizeToFit style={styles.brandTitle}>RunTogether</Text>

          <View style={[styles.headerSide, styles.headerSideRight]}>
            <TouchableOpacity 
              activeOpacity={0.8}
              onPress={() => setShowPointsInfo(!showPointsInfo)}
              style={styles.headerRightRow}
              hitSlop={7}
            >
              <View style={styles.pointsSection}>
                <Heart size={10} color="#EF4444" fill="#EF4444" />
                <Text numberOfLines={1} style={styles.pointsTextCombined}>{new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(points)}</Text>
              </View>
            </TouchableOpacity>

            {showPointsInfo && (
              <Animated.View 
                entering={FadeInDown.duration(400)} 
                exiting={FadeOut.duration(200)}
                style={styles.pointsPopup}
              >
                <View style={styles.pointsPopupArrow} />
                <View style={styles.pointsPopupContent}>
                  <View style={styles.pointsPopupSummaryRow}>
                    <View style={styles.pointsPopupUser}>
                      <Text style={styles.pointsPopupUserLabel}>You</Text>
                      <View style={styles.pointsPopupUserPointsRow}>
                        <Heart size={14} color="#EF4444" fill="#EF4444" />
                        <Text style={styles.pointsPopupUserValue}>{points.toLocaleString()}</Text>
                      </View>
                    </View>

                    <View style={styles.pointsPopupDividerVertical} />

                    <View style={styles.pointsPopupUser}>
                      <Text style={styles.pointsPopupUserLabel} numberOfLines={1}>{partner?.displayName || 'Partner'}</Text>
                      <View style={styles.pointsPopupUserPointsRow}>
                        <Heart size={14} color="#EF4444" fill="#EF4444" />
                        <Text style={styles.pointsPopupUserValue}>{partner?.points || 0}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.pointsPopupDivider} />
                  <Text style={styles.pointsPopupDesc}>
                    In the <Text style={{ fontWeight: '800', color: COLORS.primary }}>Plan</Text> tab, complete your daily activities to collect points and redeem them in the store setup by your partner.
                  </Text>
                  
                  <TouchableOpacity 
                    style={styles.pointsPopupCloseBtn}
                    onPress={() => setShowPointsInfo(false)}
                  >
                    <X size={14} color={COLORS.textMuted} />
                  </TouchableOpacity>
                </View>
              </Animated.View>
            )}
          </View>
        </Animated.View>


        {/* HERO CONTENT */}
        <View style={[styles.heroWrapper, { zIndex: 20 }]} onLayout={handleHeroLayout}>
          
              <Animated.ScrollView
                ref={heroPagerRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                contentOffset={{ x: heroPageWidth * Math.max(0, heroPages.indexOf(activeHeroPage)), y: 0 }}
                onScroll={(e) => {
                  heroScrollX.value = e.nativeEvent.contentOffset.x;
                }}
                onMomentumScrollEnd={(e) => {
                  const x = e.nativeEvent.contentOffset.x;
                  const page = heroPages[Math.round(x / heroPageWidth)] ?? HERO_PAGE.NOTIFICATION;
                  activeHeroPageRef.current = page;
                  setActiveHeroPage(page);
                }}
                scrollEventThrottle={16}
                style={[styles.heroPager, { width: heroPageWidth }, pagerAnimatedStyle]}
              >

                {/* PAGE 0: PARTNER NOTIFICATIONS */}
                <View style={[styles.waterHeroPage, { width: heroPageWidth, height: 235 }]}>
                  <PremiumNotification
                    celebrationRequest={cardCelebration}
                    onDismiss={() => {
                      setCardCelebration(null);
                      scrollToHeroPage(HERO_PAGE.REWARD);
                    }}
                  />
                </View>

                {/* PAGE 1: WEEKLY REWARD (default) */}
                <View style={[styles.weeklyRewardPage, { width: heroPageWidth, alignSelf: 'flex-start', height: rewardHeroHeight }]}>
                  <WeeklyRewardHome
                    skipIntro
                    initialPrize={homePrize}
                    heightValue={rewardHeightValue}
                    showDevPreview={false}
                    isActive={isFocused && activeHeroPage === HERO_PAGE.REWARD && isHeroVisibleOnScreen}
                    partnerName={partner?.displayName || 'Partner'}
                    partnerGender={partner?.gender}
                    partnerId={partner?.id}
                    hasPartner={hasPartner}
                    onPress={() => {
                      if (!hasPartner) {
                        router.push('/Partner');
                        return;
                      }
                      mainScrollRef.current?.scrollTo({
                        y: Math.max(0, activitySectionYRef.current - 12),
                        animated: true,
                      });
                    }}
                  />
                </View>

                <View style={[styles.weightHeroPage, { width: heroPageWidth, height: 430 }]}>
                    {/* @ts-ignore */}
                  <WeightHero
                    partnerName={partner?.displayName || "Partner"}
                    messages={chatMessages as ChatMessage[]}
                    sendMessage={sendMessage}
                    connected={chatConnected}
                    chatError={chatError as any}
                    currentUserId={currentUserId}
                    onReport={hasPartner ? handleReportPartnerChat : undefined}
                    onBlock={hasPartner ? handleBlockPartner : undefined}
                    moderationBusy={chatModerationBusy}
                    hasPartner={hasPartner}
                    showStatusText={false}
                    compactModeration
                    onExpand={() =>
                      router.push({
                        pathname: '/chat-fullscreen',
                        params: { partnerName: partner?.displayName || 'Partner' },
                      })
                    }
                  />
                </View>

              </Animated.ScrollView>

        </View>

        <View style={[styles.whiteSheet, { backgroundColor: dark ? '#0F172A' : '#FFFFFF', paddingBottom: 96 + Math.max(insets.bottom, 12) }]} onLayout={(event) => { activitySectionYRef.current = event.nativeEvent.layout.y; }}>
          <View style={styles.dailyGoalsGroup}>
          <View style={styles.goalsHeading}>
            <Text accessibilityRole="header" style={[styles.goalsHeadingText, { color: dark ? '#F1F5F9' : '#182033' }]}>This week’s challenge</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open goal settings" onPress={() => { setShowGoalSettings(true); void homeGoals.refresh(); }} style={styles.goalSettingsButton}>
              <Settings size={22} color={dark ? '#CBD5E1' : '#64748B'} />
              {homeGoals.removals.some(row => !row.accepted && !row.requestedByYou) && <View style={styles.goalSettingsBadge} />}
            </TouchableOpacity>
          </View>
          {homeGoals.visible.map(goal => <React.Fragment key={goal}>{goalCards[goal]}</React.Fragment>)}
          {homeGoals.visible.length === 0 && <Text style={{ color: dark ? '#CBD5E1' : '#64748B', paddingVertical: 16 }}>You both agreed to pause all goals this week. They return next week.</Text>}
          </View>
        </View>

      </Animated.ScrollView>
      </HomeAvatarScope>

      <GoalSettingsSheet visible={showGoalSettings} onClose={() => setShowGoalSettings(false)} goals={homeGoals} partnerName={partner?.displayName || livePartnerName || 'Your partner'} />

      <PremiumFullscreen
        visible={!!fullscreenCelebration}
        request={fullscreenCelebration}
        onFinish={handleFullscreenFinish}
      />

      <InterveneBottomSheet
        visible={showInterveneSheet}
        onClose={() => setShowInterveneSheet(false)}
        bottomInset={insets.bottom}
        pointsBalance={points}
        onSendMessage={handleInterveneMessage}
        onSendAnimation={handleInterveneAnimation}
      />

      <WaterReminderBottomSheet
        visible={showWaterReminderSheet}
        onClose={() => setShowWaterReminderSheet(false)}
        partnerName={livePartnerName}
        chatConnected={chatConnected}
        onSend={handleWaterReminderSend}
      />

      <HomeInvitations invitation={invitation} active={isFocused} />
    </View>
  );
}

const styles = StyleSheet.create({
  goalsHeading: { paddingTop: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  goalSettingsButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  goalSettingsBadge: { position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  goalsHeadingText: { flex: 1, fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.4 },
  mainContainer: {
    flex: 1,
    backgroundColor: COLORS.bg
  },
  scrollContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    alignItems: 'center',
    zIndex: 1000,
  },
  headerSide: { flex: 1, minWidth: 0, justifyContent: 'center' },
  headerSideRight: { alignItems: 'flex-end' },
  brandTitle: { width: 132, textAlign: 'center', color: '#FFFFFF', fontSize: 20, fontWeight: '800', fontStyle: 'italic', letterSpacing: -0.6 },
  headerRightRow: {
    maxWidth: '100%',
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 4,
    paddingVertical: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  pointsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 3,
    gap: 3,
  },
  pointsTextCombined: {
    color: '#1F2937',
    fontWeight: '800',
    fontSize: 10,
    fontVariant: ['tabular-nums'],
  },
  profileBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4ADE80' },

  pointsPopup: {
    position: 'absolute',
    top: 45,
    right: 0,
    width: 280,
    zIndex: 2000,
  },
  pointsPopupArrow: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#FFFFFF',
    alignSelf: 'flex-end',
    marginRight: 35,
    zIndex: 2001,
  },
  pointsPopupContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  pointsPopupSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  pointsPopupUser: {
    flex: 1,
    alignItems: 'center',
  },
  pointsPopupUserLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  pointsPopupUserPointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pointsPopupUserValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1E293B',
  },
  pointsPopupDividerVertical: {
    width: 1,
    height: 30,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 12,
  },
  pointsPopupCloseBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
  },
  partnerPointsSide: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
  },
  pointsTextSmall: {
    color: '#64748B',
    fontWeight: '700',
    fontSize: 10,
  },
  pointsPopupDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginBottom: 16,
  },
  pointsPopupDesc: {
    fontSize: 12,
    lineHeight: 18,
    color: '#64748B',
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 5,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  menuDropdown: {
    position: 'absolute',
    left: 20,
    width: 200,
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 10,
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textMain,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  menuIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  menuIconImage: {
    width: 40,
    height: 40,
  },
  menuItemText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMain,
  },

  heroWrapper: { marginTop: 4, marginBottom: 20 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  refreshBtn: { padding: 4, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)' },
  weeklyRewardPage: { justifyContent: 'flex-start', paddingTop: 0, paddingBottom: 0 },
  logFoodButton: {
    flex: 1, minHeight: 50, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8, borderRadius: 20, borderCurve: 'continuous', backgroundColor: COLORS.primary,
  },
  logFoodText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  nutritionLogFoodButton: { flex: 0, marginTop: 0, minHeight: 48 },
  heroPager: {
    zIndex: 5,
  },
  weightHeroPage: { paddingHorizontal: 8 },
  waterHeroPage: { paddingHorizontal: 8 },


  whiteSheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 80,
    marginTop: 0,
    zIndex: 10,
  },
  dailyGoalsGroup: {
    marginHorizontal: -20, marginBottom: 10, paddingHorizontal: 20,
  },
  widgetTestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F0FDFA',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#99F6E4',
    padding: 14,
    marginBottom: 18,
  },
  widgetTestIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFE4E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  widgetTestCopy: {
    flex: 1,
  },
  widgetTestTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#111827',
    textTransform: 'uppercase',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  widgetTestBody: {
    fontSize: 12,
    lineHeight: 18,
    color: '#475569',
    fontWeight: '600',
  },
  invitePromptCard: {
    backgroundColor: '#FFF5F5',
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    borderColor: '#FED7D7',
    marginBottom: 20,
  },
  invitePromptTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  invitePromptIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFE4E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  invitePromptCopy: {
    flex: 1,
  },
  invitePromptTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  invitePromptText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#6B7280',
  },
  invitePromptActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  inviteAcceptBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  inviteAcceptText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  inviteDeclineBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#FECACA',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  inviteDeclineText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '800',
  },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 26 },

  // --- NOTIFICATION STYLES ---
  notificationPopup: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
  },
  notificationInner: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  notifIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.coral,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notifContent: {
    flex: 1,
  },
  notifName: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.coral,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  notifText: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: '500',
  },
});
