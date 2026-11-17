import React, { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StatusBar, StyleSheet, Switch, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import { ChevronLeft } from 'lucide-react-native';
import { useAuth } from '@/src/auth/authContext';
import { useEntitlement } from '@/src/billing';
import { API_BASE_URL } from '../../config/api';
import { getPartnerPlanStatusMessage, type PartnerPlanSummary } from '@/utils/partnerPlanStatus';
import { C, EASE_OUT, PrimaryButton } from './OnboardingKit';
import { ensureNotificationPermissionAsync } from '@/utils/pushNotifications';
import { loadNotificationSettings } from '@/utils/notificationRegistration';
import { cacheNotificationPreferences, loadCachedNotificationPreferences } from '@/utils/notificationPreferences';

type Props = {
  userName?: string;
  userGender?: string | null;
  partnerName?: string;
  joinedWithCode?: boolean;
  weeklyPlan?: any[];
  currentWeight?: string | number;
  weightUnit?: string;
  mainGoal?: 'weightloss' | 'running' | 'both' | string | null;
  onBack: () => void;
  onContinue: (opts?: { skipPaywall?: boolean; deferPaywall?: boolean }) => void | Promise<void>;
};

export default function Phase19PlanTimeline({ partnerName, onBack, onContinue }: Props) {
  const { authFetch, isAuthenticated } = useAuth();
  const { access, refreshAccess } = useEntitlement();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const compact = height < 740;
  const pageWidth = Math.min(width, 480);
  const [partnerContext, setPartnerContext] = useState<{
    name: string | null;
    plan: PartnerPlanSummary | null;
    linked: boolean;
  }>({ name: null, plan: null, linked: false });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderBusy, setReminderBusy] = useState(true);
  const [notificationDenied, setNotificationDenied] = useState(false);

  useEffect(() => {
    let active = true;
    loadNotificationSettings(authFetch, isAuthenticated)
      .then(({ permissionStatus, preferences }) => {
        if (active) setReminderEnabled(permissionStatus === 'granted' && preferences.billingReminder);
      })
      .catch(() => {})
      .finally(() => { if (active) setReminderBusy(false); });
    return () => { active = false; };
  }, [authFetch, isAuthenticated]);

  const toggleReminder = async (enabled: boolean) => {
    if (reminderBusy) return;
    setReminderBusy(true);
    setError(null);
    setNotificationDenied(false);
    try {
      if (enabled && await ensureNotificationPermissionAsync() !== 'granted') {
        setNotificationDenied(true);
        return;
      }
      if (isAuthenticated) {
        const response = await authFetch(`${API_BASE_URL}/profile/notification-preferences`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ preferences: { billingReminder: enabled } }),
        });
        if (!response.ok) throw new Error('Could not save your reminder. Please try again.');
      }
      const preferences = await loadCachedNotificationPreferences();
      await cacheNotificationPreferences({ ...preferences, billingReminder: enabled });
      setReminderEnabled(enabled);
    } catch {
      setError('Could not save your reminder. Please try again.');
    } finally {
      setReminderBusy(false);
    }
  };

  useEffect(() => {
    let active = true;
    refreshAccess().catch(() => {});
    const load = async () => {
      try {
        const [partnerRes, pendingRes] = await Promise.all([
          authFetch(`${API_BASE_URL}/partner`),
          authFetch(`${API_BASE_URL}/partner/invites/pending`),
        ]);
        const partnerData = partnerRes.ok ? await partnerRes.json() : null;
        const pendingData = pendingRes.ok ? await pendingRes.json() : null;
        const linked = !!(partnerData?.hasPartner && partnerData?.partner);
        const person = linked ? partnerData.partner : pendingData?.invites?.[0]?.fromUser;
        if (active) setPartnerContext({
          name: person?.displayName || null,
          plan: person?.planSummary ?? null,
          linked,
        });
      } catch {
        // Existing entitlement access still applies when partner details are unavailable.
      }
    };
    void load();
    return () => { active = false; };
  }, [authFetch, refreshAccess]);

  const coverage = getPartnerPlanStatusMessage({
    partnerName: partnerName || partnerContext.name,
    selfAccess: access,
    partnerPlan: partnerContext.plan,
    hasLinkedPartner: partnerContext.linked,
  });
  const covered = !!coverage?.skipPaywall;


  const continueToApp = useCallback(async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await onContinue({ skipPaywall: covered });
    } catch {
      setError('Could not continue. Please try again.');
      setPending(false);
    }
  }, [covered, onContinue, pending]);

  return <View style={styles.root}>
    <StatusBar barStyle="dark-content" />
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.topBlush} />
      <Svg width="100%" height={140} viewBox="0 0 400 140" preserveAspectRatio="none" style={styles.bottomWaves}>
        <Path d="M 120 140 C 190 70 260 135 400 30 L 400 140 Z" fill="#FFF0F2" />
        <Path d="M 210 140 C 290 110 340 120 400 64 L 400 140 Z" fill="#FFE6EC" />
      </Svg>
    </View>
    <ScrollView
      style={styles.fill}
      contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 16) + (__DEV__ ? 76 : 0) }]}
      contentInsetAdjustmentBehavior="never"
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      <View style={[styles.page, { maxWidth: pageWidth }]}>
        <View style={styles.header}>
          <Pressable onPress={onBack} disabled={pending} style={({ pressed }) => [styles.back, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8}>
            <ChevronLeft color={C.ink} size={30} strokeWidth={2.5} />
          </Pressable>
        </View>
        <View style={styles.topSpace} />
        <View style={styles.hero}>
          <Reveal delay={0} style={[styles.crownTile, compact && styles.crownTileCompact]}>
            <CrownArtwork />
          </Reveal>
          <Reveal delay={80} style={styles.titleWrap}>
            <AccentRays mirrored />
            <Text accessibilityRole="header" style={[styles.title, { fontSize: Math.min(compact ? 35 : 38, (pageWidth - 48) / 8.5) }]}>
              {covered ? 'You\u2019re ' : 'It\u2019s Free '}<Text style={styles.accent}>{covered ? 'Covered!' : 'Today!'}</Text>
            </Text>
            <AccentRays />
          </Reveal>
          <Reveal delay={160}><Text style={[styles.subtitle, compact && styles.subtitleCompact]}>
            {covered ? coverage?.subtitle : 'Get full access to all features and\nstart your journey with your partner.'}
          </Text></Reveal>
          <Reveal delay={240} style={[styles.artwork, { height: (pageWidth - 24) * 0.64, marginTop: compact ? 24 : 36 }]}>
            <View style={styles.mintSplash} />
            <View style={styles.pinkSplash} />
            <Image source={require('../../assets/onboarding/together-fist-bump.png')} style={StyleSheet.absoluteFill} contentFit="contain" accessibilityLabel="Two fitness partners fist bumping" />
            <Svg pointerEvents="none" width={46} height={34} viewBox="0 0 46 34" style={styles.fistRays}>
              <Path d="M 12 27 L 5 16 M 23 19 L 23 4 M 34 27 L 42 16" stroke="#FFCD50" strokeWidth={5} strokeLinecap="round" fill="none" />
            </Svg>
            <LinearGradient pointerEvents="none" colors={['rgba(255,252,252,0)', C.bg]} locations={[0, 0.9]} style={styles.artFade} />
          </Reveal>
        </View>
        <View style={styles.bottomSpace} />
        <Reveal delay={360} style={styles.footer}>
          {!covered && <View style={styles.reminderRow}>
            <Text style={styles.reminderLabel}>Remind me one day before my trial ends</Text>
            <Switch value={reminderEnabled} onValueChange={value => { void toggleReminder(value); }} disabled={reminderBusy || pending} accessibilityLabel="Remind me one day before my trial ends" trackColor={{ true: C.coral }} />
          </View>}
          {notificationDenied && <Pressable onPress={() => { void Linking.openSettings(); }} accessibilityRole="button" style={styles.settingsLink}><Text style={styles.error}>Enable notifications in Settings to receive your reminder.</Text></Pressable>}
          {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          <PrimaryButton label={covered ? 'Continue with full access' : 'Get Full Access for $0.00'} onPress={() => { void continueToApp(); }} loading={pending} disabled={reminderBusy} style={styles.cta} />
        </Reveal>
      </View>
    </ScrollView>
  </View>;
}

function Reveal({ delay, style, children }: { delay: number; style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(withDelay(reduceMotion ? 0 : delay, withTiming(1, { duration: 280, easing: EASE_OUT })));
    return () => cancelAnimation(progress);
  }, [delay, progress, reduceMotion]);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateY: reduceMotion ? 0 : 16 * (1 - progress.get()) }],
  }));
  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

function AccentRays({ mirrored = false }: { mirrored?: boolean }) {
  return <Svg pointerEvents="none" width={28} height={36} viewBox="0 0 28 36" style={[styles.titleRays, mirrored ? styles.leftRays : styles.rightRays]}>
    <Path d="M 5 15 L 11 3 M 13 24 L 25 15 M 17 33 L 27 32" stroke={C.coral} strokeWidth={4} strokeLinecap="round" fill="none" />
  </Svg>;
}

function CrownArtwork() {
  return <Svg width={56} height={48} viewBox="0 0 64 56" accessible={false}>
    <Defs>
      <SvgGradient id="crownGold" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#FFE57B" /><Stop offset="0.5" stopColor="#FFC52E" /><Stop offset="1" stopColor="#FF9D00" />
      </SvgGradient>
    </Defs>
    <Path d="M 7 17 L 13 43 Q 32 47 51 43 L 57 17 L 44 27 L 32 6 L 20 27 Z" fill="url(#crownGold)" stroke="#FFBF22" strokeWidth={1.5} strokeLinejoin="round" />
    <Path d="M 32 12 L 31 37" stroke="#FFE989" strokeWidth={3} strokeLinecap="round" />
    <Path d="M 15 49 Q 32 47 49 49" stroke="#FFAE00" strokeWidth={6} strokeLinecap="round" />
    <Path d="M 6 17 h 0 M 32 6 h 0 M 58 17 h 0" stroke="#FFD756" strokeWidth={8} strokeLinecap="round" />
  </Svg>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, overflow: 'hidden' },
  fill: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  page: { width: '100%', flexGrow: 1, alignSelf: 'center', paddingHorizontal: 24 },
  topBlush: { position: 'absolute', width: 300, height: 240, top: -188, left: -100, borderRadius: 999, backgroundColor: '#FFEAF0', transform: [{ rotate: '-25deg' }] },
  bottomWaves: { position: 'absolute', bottom: 0 },
  header: { height: 44, alignItems: 'center', justifyContent: 'center' },
  back: { position: 'absolute', left: -8, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.5 },
  reminderRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20, minHeight: 44 },
  reminderLabel: { flex: 1, color: C.ink, fontSize: 15, lineHeight: 21, fontWeight: '600' },
  settingsLink: { minHeight: 44, justifyContent: 'center' },
  topSpace: { flexGrow: 1, minHeight: 36, maxHeight: 92 },
  hero: { alignItems: 'center' },
  crownTile: { width: 68, height: 64, borderRadius: 20, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFECF0' },
  crownTileCompact: { width: 60, height: 56, borderRadius: 16 },
  titleWrap: { alignSelf: 'stretch', marginTop: 16 },
  title: { color: C.ink, fontWeight: '900', letterSpacing: -1.6, textAlign: 'center' },
  accent: { color: C.coral },
  titleRays: { position: 'absolute', top: -21 },
  leftRays: { left: -8, transform: [{ scaleX: -1 }] },
  rightRays: { right: -8 },
  subtitle: { marginTop: 16, color: '#788395', fontSize: 17, lineHeight: 23, fontWeight: '600', textAlign: 'center' },
  subtitleCompact: { fontSize: 16, lineHeight: 22 },
  artwork: { alignSelf: 'stretch', marginHorizontal: -12 },
  mintSplash: { position: 'absolute', left: 8, top: 48, width: 64, height: 120, borderRadius: 999, backgroundColor: '#C8F0EE', transform: [{ rotate: '-32deg' }] },
  pinkSplash: { position: 'absolute', right: 8, top: 44, width: 64, height: 120, borderRadius: 999, backgroundColor: '#FFC9D6', transform: [{ rotate: '32deg' }] },
  fistRays: { position: 'absolute', top: '32%', left: '50%', marginLeft: -23 },
  artFade: { position: 'absolute', bottom: -1, left: 0, right: 0, height: 48 },
  bottomSpace: { flexGrow: 1.2, minHeight: 32, maxHeight: 100 },
  footer: { paddingBottom: 24 },
  cta: { height: 54, marginBottom: 0 },
  error: { color: C.coral, fontSize: 14, textAlign: 'center', marginBottom: 12 },
});
