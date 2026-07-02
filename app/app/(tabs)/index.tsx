import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  Modal,
  TouchableWithoutFeedback,
  Image,
  ScrollView,
  Alert,
  LayoutChangeEvent,
} from 'react-native';
import {
  Heart,
  Flame,
  Utensils,
  Dumbbell,
  Plus,
  Swords,
  RefreshCw,
  Zap,
  Users,
  Activity,
  LogIn,
  X,
  ChevronRight,
  MessageCircle,
  AlertTriangle,
  Target,
  UserCheck,
  UserX,
} from 'lucide-react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  withTiming,
  withRepeat,
  withSequence,
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
import { hasRemoteNotificationsEnabled } from '@/utils/notificationPreferences';
import {
  loadNotificationSettings,
  syncRemotePushTokenForPreferences,
} from '@/utils/notificationRegistration';
import { API_BASE_URL } from '../../config/api';
import { applyPartnerSurfacePayload, buildPartnerLivePayload } from '../../lib/partner-surface';
import { useStepSync } from '../../hooks/UseStepSync';
import { useRealtimePartner } from '../../hooks/useRealtimePartner';

// Components
import GoalMascot from '../../components/home/GoalMascot';
import WeeklyProgress from '../../components/home/WeeklyProgress';
import DailyTasks from '../../components/home/DailyTasks';
import StepSyncSection from '../../components/home/StepTracer';
import WeightHero from '../../components/home/WeightHero';
import { useChat, ChatMessage } from '../../contexts/ChatContext';

const { width } = Dimensions.get('window');

const COLORS = {
  primary: '#FF6B6B', // This is the Coral color
  waveAccent: '#FF8E8E',
  textMain: '#1F2937',
  textMuted: '#6B7280',
  border: '#F3F4F6',
  white: '#FFFFFF',
  bg: '#F8FAFC',
  coral: '#FF6B6B',
};

type PendingInvite = {
  id: string;
  code?: string;
  fromUser?: {
    id: string;
    displayName: string;
    email: string;
  };
  toEmail: string;
  status: string;
};

const AnimatedCounter = ({ value, style }: { value: number; style?: any }) => {
  const [displayValue, setDisplayValue] = React.useState(0);
  useEffect(() => {
    let start = displayValue;
    const end = value;
    if (start === end) return;
    let totalDuration = 1000;
    let startTime = Date.now();
    const timer = setInterval(() => {
      let timePassed = Date.now() - startTime;
      let progress = Math.min(timePassed / totalDuration, 1);
      let current = Math.floor(start + (end - start) * progress);
      setDisplayValue(current);
      if (progress === 1) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [value]);
  return <Text style={style}>{displayValue}</Text>;
};

const UserCard = ({
  title,
  data,
  accent,
  isMain,
  onLog,
  onPress,
  showMotivate,
  onMotivate,
  motivateLabel,
}: {
  title: string;
  data: any;
  accent: string;
  isMain: boolean;
  onLog: () => void;
  onPress?: () => void;
  showMotivate?: boolean;
  onMotivate?: () => void;
  motivateLabel?: string;
}) => {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(withTiming(1.2, { duration: 800 }), withTiming(1, { duration: 800 })),
      -1, true
    );
  }, []);

  const animatedFlameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: pulse.value - 0.1,
  }));

  const remaining = data.goal - (data.food - data.exercise);
  const isNegative = remaining < 0;
  const statusColor = isNegative ? '#EF4444' : accent;

  return (
    <View style={[styles.cardOuter, isMain && { shadowColor: statusColor }]}>
      <TouchableOpacity 
        style={styles.cardInner} 
        activeOpacity={0.9} 
        onPress={onPress}
      >
        <Text style={[styles.microTag, { color: statusColor }]}>{title}</Text>
        <View style={styles.mainStatRow}>
          <AnimatedCounter value={remaining} style={[styles.bigNum, isNegative && { color: '#EF4444' }]} />
          <Animated.View style={animatedFlameStyle}>
            {isNegative ? (
              <AlertTriangle size={18} color="#EF4444" fill="#FEE2E2" />
            ) : (
              <Flame size={18} color={accent} fill={accent} />
            )}
          </Animated.View>
        </View>
        <Text style={styles.subLabel}>{isNegative ? 'KCAL OVER' : 'KCAL LEFT'}</Text>
        <View style={styles.statsContainer}>
          <View style={styles.consistentRow}>
            <View style={[styles.iconBox, { backgroundColor: '#FEE2E2' }]}><Utensils size={14} color="#EF4444" /></View>
            <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 9, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 0.5 }}>INTAKE</Text>
              <Text style={[styles.statValue, { color: '#EF4444' }]}>-{data.food}</Text>
            </View>
          </View>
          <View style={styles.consistentRow}>
            <View style={[styles.iconBox, { backgroundColor: '#ECFDF5' }]}><Dumbbell size={14} color="#10B981" /></View>
            <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 9, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 0.5 }}>BURNED</Text>
              <Text style={[styles.statValue, { color: '#10B981' }]}>+{data.exercise}</Text>
            </View>
          </View>
        </View>
        {isMain && (
          <TouchableOpacity
            style={[styles.logFoodButton, { backgroundColor: accent }]}
            onPress={(e) => {
              e.stopPropagation();
              onLog();
            }}
          >
            <Plus size={14} color="#FFF" strokeWidth={3} />
            <Text style={styles.logFoodText}>LOG FOOD</Text>
          </TouchableOpacity>
        )}
        {!isMain && showMotivate && onMotivate && (
          <TouchableOpacity
            style={styles.motivateButton}
            onPress={(e) => {
              e.stopPropagation();
              onMotivate();
            }}
          >
            <MessageCircle size={12} color={COLORS.primary} />
            <Text style={styles.motivateButtonText}>{motivateLabel || 'Motivate'}</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </View>
  );
};

const PartnerPlaceholderCard = ({ 
  onPress, 
  pendingInvite,
  onAccept,
  onDecline
}: { 
  onPress: () => void;
  pendingInvite?: PendingInvite;
  onAccept?: (id: string) => void;
  onDecline?: (id: string) => void;
}) => {
  if (pendingInvite && onAccept && onDecline) {
    return (
      <View style={styles.cardOuter}>
        <LinearGradient
          colors={['#FFFFFF', '#FFF5F5']}
          style={[styles.cardInner, styles.placeholderCardInner]}
        >
          <View style={styles.placeholderGlassOverlay} />
          <Text style={[styles.microTag, { color: COLORS.primary, opacity: 0.8, marginBottom: 6 }]}>INVITATION</Text>
          
          <View style={styles.partnerImageWrapper}>
            <Users size={28} color={COLORS.primary} strokeWidth={2.5} />
          </View>

          <Text style={styles.placeholderTitle} numberOfLines={1}>
            {pendingInvite.fromUser?.displayName || 'Partner'}
          </Text>
          <Text style={styles.placeholderBody} numberOfLines={1}>Sent you an invite</Text>
          
          <View style={styles.cardInviteActions}>
            <TouchableOpacity 
              style={styles.cardInviteDecline} 
              onPress={() => onDecline(pendingInvite.id)}
            >
              <UserX size={16} color="#EF4444" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.cardInviteAccept} 
              onPress={() => onAccept(pendingInvite.id)}
            >
              <UserCheck size={16} color="#FFF" />
              <Text style={styles.cardInviteAcceptText}>ACCEPT</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <TouchableOpacity 
      style={styles.cardOuter} 
      activeOpacity={0.9} 
      onPress={onPress}
    >
      <LinearGradient
        colors={['#FFFFFF', '#F4FBFB']}
        style={[styles.cardInner, styles.placeholderCardInner]}
      >
        <View style={styles.placeholderGlassOverlay} />
        <Text style={[styles.microTag, { color: '#1F938A', opacity: 0.8, marginBottom: 6 }]}>TEAM UP</Text>
        
        <View style={styles.partnerImageWrapper}>
          <Image 
            source={require('../../assets/connection.png')} 
            style={styles.partnerPlaceholderImg}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.placeholderTitle}>Link Partner</Text>
        <Text style={styles.placeholderBody} numberOfLines={2}>Sync progress and keep each other motivated.</Text>
        
        <View style={[styles.placeholderCta, { backgroundColor: '#1F938A' }]}>
          <Text style={styles.placeholderCtaText}>INVITE</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
};
export default function App() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isFocused = useIsFocused();
  const { openChat, chatJump } = useLocalSearchParams<{ openChat?: string; chatJump?: string }>();
  const mainScrollRef = useRef<Animated.ScrollView>(null);
  const heroPagerRef = useRef<Animated.ScrollView>(null);
  const lastChatJumpRef = useRef<string | null>(null);
  const lastMainScrollYRef = useRef(0);
  const heroLayoutRef = useRef({ y: 0, height: 0 });
  const notificationBootstrapAttemptedRef = useRef(false);
  const [isRunning, setIsRunning] = useState(false);
  const [nudgeSent, setNudgeSent] = useState(false);
  const [partner, setPartner] = useState<any>(null);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showPointsInfo, setShowPointsInfo] = useState(false);
  // Track active page for dots and title
  const [activeHeroPage, setActiveHeroPage] = useState(0);
  const [chatModerationBusy, setChatModerationBusy] = useState(false);
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
  const heroPageWidth = width - 32;
  const isHomeChatVisible = isFocused && activeHeroPage === 1 && isHeroVisibleOnScreen;

  const closeMenuAndNavigate = useCallback((path: string) => {
    setIsMenuOpen(false);
    requestAnimationFrame(() => {
      router.push(path as any);
    });
  }, [router]);

  const { accessToken, authFetch, isAuthenticated } = useAuth();
  const { balance: points, refetch: refetchPoints } = usePoints({ accessToken });
  const { summary, loading, recalculate } = useDailySummary({ accessToken });
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

  useEffect(() => {
    if (!isAuthenticated) {
      notificationBootstrapAttemptedRef.current = false;
    }
  }, [isAuthenticated]);

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
      .then(data => {
        setPendingInvites(data.invites || []);
      })
      .catch(err => console.log(err));
  }, [isAuthenticated, authFetch]);

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      let active = true;

      if (isAuthenticated) {
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

        const shouldPromptForPermission = !notificationBootstrapAttemptedRef.current;
        notificationBootstrapAttemptedRef.current = true;

        loadNotificationSettings(authFetch, true)
          .then(async ({ permissionStatus, preferences }) => {
            if (!active || !hasRemoteNotificationsEnabled(preferences)) {
              return;
            }

            if (permissionStatus !== 'undetermined' || !shouldPromptForPermission) {
              return;
            }

            await syncRemotePushTokenForPreferences(authFetch, preferences, {
              promptForPermission: true,
            });
          })
          .catch((err) => {
            console.log('[Home] notification bootstrap failed', err);
          });
      }

      return () => {
        active = false;
      };
    }, [authFetch, isAuthenticated, recalculate, refetchPoints, refetchPartnerSummary, fetchPartner, fetchPendingInvites])
  );

  const myData = useMemo(() => getDashboardData(summary), [summary]);
  const partnerIsNegative = useMemo(() => {
    if (!hasPartner || !partnerSummary) return false;
    const remaining = partnerSummary.goal - (partnerSummary.food - partnerSummary.exercise);
    return remaining < 0;
  }, [hasPartner, partnerSummary]);

  const latestPartnerMessage = useMemo(() => {
    return [...chatMessages]
      .filter((message) => message.fromUserId !== currentUserId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null;
  }, [chatMessages, currentUserId]);

  const teamProgress = useMemo(() => {
    const myRem = myData.goal - (myData.food - myData.exercise);
    const partRem = hasPartner && partnerSummary ? partnerSummary.goal - (partnerSummary.food - partnerSummary.exercise) : 0;
    const totalGoal = myData.goal + (partnerSummary?.goal || 0);
    return totalGoal === 0 ? 0 : ((totalGoal - myRem - partRem) / totalGoal) * 100;
  }, [myData, partnerSummary, hasPartner]);

  useEffect(() => {
    const widgetUserSteps = Math.max(0, Math.round(Math.max(liveSteps || 0, myData.steps || 0)));
    const widgetPartnerSteps = hasPartner
      ? Math.max(0, Math.round(Math.max(partnerLiveSteps || 0, partnerSummary?.steps || 0)))
      : 0;
    const payload = buildPartnerLivePayload({
      userName: 'You',
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
  }, [accessToken, hasPartner, livePartnerName, liveSteps, myData.food, myData.goal, myData.steps, partner?.displayName, partnerLiveSteps, partnerSummary?.food, partnerSummary?.goal, partnerSummary?.name, partnerSummary?.steps]);

  useEffect(() => {
    fetchPartner();
  }, [fetchPartner]);

  const acceptInvite = useCallback(async (inviteId: string) => {
    try {
      const res = await authFetch(`${API_BASE_URL}/partner/invites/${inviteId}/accept`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to accept invite');
      }

      Alert.alert('Partner connected', `You are now connected with ${data.partnerName}.`);
      recalculate();
      refetchPartnerSummary();
      fetchPartner();
      fetchPendingInvites();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  }, [authFetch, recalculate, refetchPartnerSummary, fetchPartner, fetchPendingInvites]);

  const declineInvite = useCallback(async (inviteId: string) => {
    try {
      const res = await authFetch(`${API_BASE_URL}/partner/invites/${inviteId}/decline`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to decline invite');
      }

      fetchPendingInvites();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
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
    mainScrollRef.current?.scrollTo({ y: 0, animated: true });
    heroPagerRef.current?.scrollTo({ x: heroPageWidth * pageIndex, animated: true });
    setActiveHeroPage(pageIndex);
  }, [heroPageWidth]);

  const scrollToChat = useCallback(() => {
    // Scroll the main vertical container to top to reveal the hero section
    scrollToHeroPage(1);
  }, [scrollToHeroPage]);

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
    Alert.alert(
      'Motivate Partner',
      `Send ${partner.displayName || 'your partner'} a calorie nudge?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Gentle',
          onPress: () => {
            sendMessage("You’ve got this. Small reset and finish strong on calories today ❤️");
            setNudgeSent(true);
            setTimeout(() => setNudgeSent(false), 2500);
          }
        },
        {
          text: 'Coach',
          onPress: () => {
            sendMessage("Quick calorie nudge: keep the next meal lighter and you can still recover today 💪");
            setNudgeSent(true);
            setTimeout(() => setNudgeSent(false), 2500);
          }
        },
        {
          text: 'Funny',
          onPress: () => {
            sendMessage("Calories are getting spicy 😅 One smart choice and you're back in the game.");
            setNudgeSent(true);
            setTimeout(() => setNudgeSent(false), 2500);
          }
        },
      ]
    );
  }, [hasPartner, partner, sendMessage]);

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
      scrollToHeroPage(0);
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
    opacity: withTiming(activeHeroPage === 0 ? 1 : 0),
    transform: [{ translateY: withTiming(activeHeroPage === 0 ? 0 : -20) }]
  }));

  const heroHeaderAnimatedStyle = useAnimatedStyle(() => ({
    opacity: withTiming(activeHeroPage === 0 ? 1 : 0),
    height: withTiming(activeHeroPage === 0 ? 50 : 0),
    marginBottom: withTiming(activeHeroPage === 0 ? 8 : 0),
  }));

  const mascotAnimatedStyle = useAnimatedStyle(() => ({
    opacity: withTiming(activeHeroPage === 0 ? 1 : 0),
    transform: [{ scale: withTiming(activeHeroPage === 0 ? 1 : 0.8) }]
  }));

  const pagerAnimatedStyle = useAnimatedStyle(() => ({
    height: withTiming(activeHeroPage === 0 ? 235 : 430),
    marginTop: withTiming(activeHeroPage === 0 ? 0 : -50)
  }));



  return (
    <View style={styles.mainContainer}>
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
                onPress={() => closeMenuAndNavigate('/Partner')}
              >
                <View style={[styles.menuIconBox, { backgroundColor: '#FFF1F2' }]}>
                  <Users size={18} color={COLORS.primary} />
                </View>
                <Text style={styles.menuItemText}>Partner</Text>
                <ChevronRight size={14} color={COLORS.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => closeMenuAndNavigate('/activity')}
              >
                <View style={[styles.menuIconBox, { backgroundColor: '#FFF1F2' }]}>
                  <Activity size={18} color={COLORS.primary} />
                </View>
                <Text style={styles.menuItemText}>Activity</Text>
                <ChevronRight size={14} color={COLORS.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => closeMenuAndNavigate('/explore')}
              >
                <View style={[styles.menuIconBox, { backgroundColor: '#FFF1F2' }]}>
                  <Target size={18} color={COLORS.primary} />
                </View>
                <Text style={styles.menuItemText}>Goals</Text>
                <ChevronRight size={14} color={COLORS.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => closeMenuAndNavigate('/quest')}
              >
                <View style={[styles.menuIconBox, { backgroundColor: '#FFF1F2' }]}>
                  <Zap size={18} color={COLORS.primary} />
                </View>
                <Text style={styles.menuItemText}>Quest</Text>
                <ChevronRight size={14} color={COLORS.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => closeMenuAndNavigate('/Login')}
              >
                <View style={[styles.menuIconBox, { backgroundColor: '#FFF1F2' }]}>
                  <LogIn size={18} color={COLORS.primary} />
                </View>
                <Text style={styles.menuItemText}>Settings</Text>
                <ChevronRight size={14} color={COLORS.textMuted} />
              </TouchableOpacity>

            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Animated.ScrollView
        ref={mainScrollRef}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        onScroll={(event) => {
          const scrollY = event.nativeEvent.contentOffset.y;
          lastMainScrollYRef.current = scrollY;
          updateHeroVisibility(scrollY);
        }}
        style={[styles.scrollContainer, { backgroundColor: COLORS.primary }]}
        contentContainerStyle={{ backgroundColor: COLORS.bg }}
        bounces={false}
        overScrollMode="never"
      >
        {/* WAVE BACKGROUND */}
        <View style={styles.waveBackgroundContainer}>
          <Svg height="500" width={width} viewBox={`0 0 ${width} 500`} preserveAspectRatio="none">
            <Path fill={COLORS.primary} d={`M0,0 L${width},0 L${width},250 Q${width / 2},300 0,250 Z`} />
            <Path fill={COLORS.waveAccent} opacity="0.4" d={`M0,0 L${width},0 L${width},280 Q${width / 2},330 0,280 Z`} />
          </Svg>
        </View>

        {/* HEADER */}
        <Animated.View style={[styles.header, { paddingTop: insets.top + 6 }, headerAnimatedStyle]}>

          <TouchableOpacity
            style={styles.profileBtn}
            onPress={() => setIsMenuOpen(true)}
          >
            <MaterialCommunityIcons name="sort-variant" size={20} color={COLORS.primary} />
          </TouchableOpacity>

          <View>
            <TouchableOpacity 
              activeOpacity={0.8}
              onPress={() => setShowPointsInfo(!showPointsInfo)}
              style={styles.headerRightRow}
            >
              <View style={styles.partnerPillCombined}>
                <Users size={14} color={COLORS.primary} />
                <Text style={styles.partnerNameCombined}>{partner ? partner.displayName : 'Solo'}</Text>
              </View>
              <View style={styles.pillDivider} />
              <View style={styles.pointsSection}>
                <Heart size={12} color="#EF4444" fill="#EF4444" />
                <Text style={styles.pointsTextCombined}>{points.toLocaleString()}</Text>
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
          
          <Animated.View style={[styles.mascotWrapper, mascotAnimatedStyle]}>
            {/* @ts-ignore */}
            <GoalMascot progress={teamProgress} />
          </Animated.View>

          <Animated.View style={[styles.heroHeader, heroHeaderAnimatedStyle]}>

            <Text style={styles.heroTitle}>Today&apos;s Detail</Text>

           
          </Animated.View>


          {loading && !summary ? (
            <ActivityIndicator size="large" color="#FFF" style={{ marginVertical: 40 }} />
          ) : (
            <>
              <Animated.ScrollView
                ref={heroPagerRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={(e) => {
                  heroScrollX.value = e.nativeEvent.contentOffset.x;
                }}
                onMomentumScrollEnd={(e) => {
                  const x = e.nativeEvent.contentOffset.x;
                  setActiveHeroPage(Math.round(x / heroPageWidth));
                }}
                scrollEventThrottle={16}
                style={[styles.heroPager, pagerAnimatedStyle]}
              >


                {/* PAGE 1: VS GRID */}
                <View style={[styles.grid, { width: heroPageWidth, height: 235 }]}>

                  <Animated.View style={{ flex: 1 }} entering={FadeInDown.delay(200)}>
                        <UserCard 
                          isMain={true}
                          onLog={() => router.push({ pathname: '/activity', params: { action: 'logFood', t: Date.now() } })}
                          onPress={() => router.push({
                            pathname: '/kcal-detail',
                            params: {
                              myData: JSON.stringify(myData),
                              partnerData: JSON.stringify(partnerSummary),
                              partnerName: partner?.displayName || 'Partner'
                            }
                          })}
                          title="YOU" 
                          data={myData} 
                          accent={COLORS.primary} 
                        />
                  </Animated.View>

                  <>
                    <View style={styles.vsFloating}>
                      <View style={styles.vsInner}><Swords size={12} color={COLORS.textMuted} /></View>
                    </View>
                    <Animated.View style={{ flex: 1 }} entering={FadeInDown.delay(400)}>
                      {hasPartner && partnerSummary ? (
                        <UserCard 
                          isMain={false}
                          onLog={() => {}}
                          onPress={() => router.push({
                            pathname: '/kcal-detail',
                            params: {
                              myData: JSON.stringify(myData),
                              partnerData: JSON.stringify(partnerSummary),
                              partnerName: partner?.displayName || 'Partner'
                            }
                          })}
                          title={partner?.displayName || "PARTNER"} 
                          data={partnerSummary} 
                          accent="#1F938A" 
                          showMotivate={partnerIsNegative}
                          onMotivate={handleMotivatePartnerCalories}
                          motivateLabel={nudgeSent ? 'Sent' : 'Motivate'}
                        />
                      ) : (
                        <PartnerPlaceholderCard 
                          onPress={() => router.push('/Partner')} 
                          pendingInvite={pendingInvites[0]}
                          onAccept={acceptInvite}
                          onDecline={declineInvite}
                        />
                      )}
                    </Animated.View>
                  </>
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

              {/* PAGINATION DOTS */}
              <View style={[styles.paginationContainer, {
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 20,
                alignSelf: 'center',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.2)',
                marginTop: activeHeroPage === 0 ? 5 : -20, // Move dots up when full screen
              }]}>

                {[0, 1].map((i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => scrollToHeroPage(i)}
                    activeOpacity={0.8}
                    style={styles.dotTapTarget}
                  >
                    <View
                      style={[
                        styles.dot,
                        activeHeroPage === i ? styles.activeDot : styles.inactiveDot
                      ]}
                    />
                  </TouchableOpacity>
                ))}
              </View>

            </>
          )}
        </View>

        <View style={styles.whiteSheet}>
          {/* Invitation prompt moved to PartnerPlaceholderCard */}
          {/* @ts-ignore */}
          <StepSyncSection
            onNudge={() => { setNudgeSent(true); scrollToChat(); }}
            permissionEnabled={stepPermissionEnabled}
            onPermissionChange={setStepPermissionEnabled}
            onPermissionGranted={handleStepPermissionGranted}
            myFallbackLiveSteps={liveSteps}
            partnerFallbackLiveSteps={partnerLiveSteps}
            fallbackPartnerName={livePartnerName}
            isConnected={isPartnerLiveConnected}
          />
          <View style={styles.divider} />
          <WeeklyProgress />
          <View style={styles.divider} />
          {/* @ts-ignore - DailyTasks expects onLogFood here, not isRunning but we are passing it for future use */}
          <DailyTasks isRunning={isRunning} setIsRunning={setIsRunning} />
        </View>

      </Animated.ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: COLORS.bg
  },
  waveBackgroundContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 500,
    zIndex: -1,
  },
  scrollContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    alignItems: 'center',
    zIndex: 1000,
  },
  headerRightRow: {
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
  partnerPillCombined: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  partnerNameCombined: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1F2937',
    textTransform: 'uppercase',
  },
  pillDivider: {
    width: 1,
    height: 14,
    backgroundColor: '#F3F4F6',
  },
  pointsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
  },
  pointsTextCombined: {
    color: '#1F2937',
    fontWeight: '800',
    fontSize: 12,
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
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMain,
  },

  heroWrapper: { paddingHorizontal: 16, marginTop: 5 },

  heroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },

  heroTitle: { fontSize: 28, fontWeight: '900', color: '#FFF', letterSpacing: -0.5 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  refreshBtn: { padding: 4, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)' },
  mascotWrapper: { 
    position: 'absolute',
    right: 8,
    top: -5,
    width: 110,
    height: 110,
    zIndex: 0,
  },

  grid: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardOuter: { backgroundColor: '#FFF', padding: 4, borderRadius: 24, elevation: 8, shadowOpacity: 0.1, shadowRadius: 15, position: 'relative' },
  cardInner: { padding: 12, borderRadius: 20, alignItems: 'center', height: 195 },
  microTag: { fontSize: 9, fontWeight: '900', letterSpacing: 1.2, marginBottom: 8 },
  mainStatRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bigNum: { fontSize: 32, fontWeight: '900', color: COLORS.textMain },
  subLabel: { fontSize: 8, color: COLORS.textMuted, fontWeight: '700', marginBottom: 12 },
  statsContainer: { width: '100%', gap: 6 },
  consistentRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F9FAFB', padding: 6, borderRadius: 10 },
  iconBox: { width: 24, height: 24, borderRadius: 6, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 12, fontWeight: '800', color: COLORS.textMain },
  logFoodButton: {
    position: 'absolute',
    bottom: -10,
    right: -5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    gap: 4,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    zIndex: 20,
  },
  logFoodText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  motivateButton: {
    position: 'absolute',
    bottom: -8,
    right: -4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 14,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  motivateButtonText: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  placeholderCardInner: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  placeholderGlassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  partnerImageWrapper: {
    width: 70,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  cardInviteActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    width: '100%',
  },
  cardInviteDecline: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInviteAccept: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    elevation: 3,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  cardInviteAcceptText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  partnerPlaceholderImg: {
    width: 60,
    height: 60,
  },
  placeholderTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 0,
    letterSpacing: -0.3,
  },
  placeholderBody: {
    fontSize: 10,
    lineHeight: 13,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 10,
    marginBottom: 2,
  },
  placeholderCta: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 18,
    shadowColor: '#1F938A',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  placeholderCtaText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    color: '#FFF',
  },

  vsFloating: { position: 'absolute', left: '50%', top: '35%', marginLeft: -14, zIndex: 10, padding: 3, backgroundColor: '#FFF', borderRadius: 20 },
  vsInner: { width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },

  heroPager: { 
    width: width - 32,
    zIndex: 5,
  },
  weightHeroPage: {},


  // --- UPDATED PAGINATION STYLES ---
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    marginBottom: 0,
  },
  dot: {
    height: 4,
    borderRadius: 2,
  },
  dotTapTarget: {
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  activeDot: {
    width: 18,
    backgroundColor: COLORS.primary,
    opacity: 1,
  },
  inactiveDot: {
    width: 6,
    backgroundColor: '#1F938A',
  },

  whiteSheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 80,
    marginTop: 5,
    minHeight: 800,
    zIndex: 10,
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
