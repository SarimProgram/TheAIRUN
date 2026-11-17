import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, InteractionManager, Linking, Pressable, ScrollView, StatusBar, StyleSheet, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, FadeIn, cancelAnimation, interpolate, interpolateColor, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Dumbbell, Gift, Trophy, Users, X } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import { PRIVACY_POLICY_URL, TERMS_URL } from '@/config/legal';
import { APP_NAME } from '@/constants/branding';
import { useAuth } from '@/src/auth/authContext';
import { useEntitlement } from '@/src/billing';
import { trackCustomPaywallImpression } from '@/src/billing/trackCustomPaywallImpression';
import { C, EASE_OUT, PrimaryButton, pop } from '../onboarding/OnboardingKit';
import { getPackageTitle, getPackagePrice, packageHasFreeTrial, getZeroTodayLabel, getTrialLengthLabel, getPackagePeriodLabel, getAllPackages, getSavingsLabel, formatWeeklyEquivalentLabel } from './paywallPricing';

const FEATURES = [
  { icon: Users, label: 'Two accounts, one subscription' },
  { icon: Dumbbell, label: 'Plans tailored to both your goals' },
  { icon: Trophy, label: 'Step battles & head-to-head races' },
  { icon: Gift, label: 'Win real rewards as a team' },
];

const IDLE_EASE = Easing.inOut(Easing.sin);
const SHORT_PERIOD: Record<string, string> = { week: 'wk', month: 'mo', year: 'yr' };

export default function CustomPaywallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const compact = height < 740;
  const contentWidth = Math.min(width, 480);
  const actionLock = useRef(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const params = useLocalSearchParams<{ mode?: string | string[] }>();
  const { isAuthenticated } = useAuth();
  const {
    access,
    hasAccess,
    offerings,
    purchase,
    restorePurchases,
    refreshAccess,
    loading,
    error: billingError,
  } = useEntitlement();

  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const hasTrackedImpressionRef = useRef(false);

  const packages = useMemo(() => getAllPackages(offerings).sort((a, b) => {
    const order: Record<string, number> = { week: 0, year: 1, month: 2 };
    return (order[getPackagePeriodLabel(a)] ?? 3) - (order[getPackagePeriodLabel(b)] ?? 3);
  }), [offerings]);
  const weeklyPackage = useMemo(
    () => packages.find((pkg) => getPackagePeriodLabel(pkg) === 'week'),
    [packages]
  );
  const currentOfferingId = useMemo(
    () => offerings?.current?.identifier || offerings?.all?.default?.identifier || null,
    [offerings]
  );

  useEffect(() => {
    if (packages.length > 0 && !packages.some(pkg => pkg.identifier === selectedPlan)) {
      const annual = packages.find((pkg) => getPackagePeriodLabel(pkg) === 'year');
      const weekly = packages.find((pkg) => getPackagePeriodLabel(pkg) === 'week');
      setSelectedPlan((weekly || annual || packages[0]).identifier);
    }
  }, [packages, selectedPlan]);

  const backendRequiresPaywall = !!access?.paywallReason;
  const isManageMode = (Array.isArray(params.mode) ? params.mode[0] : params.mode) === 'manage';
  const isPartnerIncludedAccess = access?.accessSource === 'partner' && hasAccess;

  useEffect(() => {
    if (isPartnerIncludedAccess) {
      router.replace(isManageMode ? '/(tabs)' : '/customize-plan?entry=1' as any);
      return;
    }
    if (hasAccess && !backendRequiresPaywall && !isManageMode) {
      router.replace('/customize-plan?entry=1' as any);
    }
  }, [backendRequiresPaywall, hasAccess, isManageMode, isPartnerIncludedAccess, router]);

  useEffect(() => {
    if (!isAuthenticated || hasAccess) return;
    refreshAccess({ syncRevenueCat: true }).catch(() => {});
  }, [hasAccess, isAuthenticated, refreshAccess]);

  useEffect(() => {
    if (hasTrackedImpressionRef.current) return;
    const task = InteractionManager.runAfterInteractions(() => {
      hasTrackedImpressionRef.current = true;
      trackCustomPaywallImpression({
        paywallId: 'main-custom-paywall',
        offeringId: currentOfferingId,
        source: 'paywall_route',
        paywallReason: access?.paywallReason ?? null,
        packageCount: packages.length,
      }).catch(() => {});
    });
    return () => task.cancel();
  }, [access?.paywallReason, currentOfferingId, packages.length]);

  const handleAction = async (key: string, fn: () => Promise<void>) => {
    if (actionLock.current) return;
    actionLock.current = true;
    setActionError(null);
    setBusyAction(key);
    try {
      await fn();
      await refreshAccess({ syncRevenueCat: true });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not complete this action. Please try again.');
    } finally {
      actionLock.current = false;
      setBusyAction(null);
    }
  };

  const handleClose = () => {
    if (actionLock.current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)' as any);
  };

  const activePackage = packages.find((pkg) => pkg.identifier === selectedPlan);
  const activePeriod = getPackagePeriodLabel(activePackage);
  const activePrice = getPackagePrice(activePackage);
  const ctaDisabled = !!busyAction || !activePackage;
  const trialLength = getTrialLengthLabel(activePackage);
  const hasTrial = packageHasFreeTrial(activePackage);
  const disclosureText = activePackage
    ? hasTrial
      ? `Nothing due today. ${activePrice}/${activePeriod} after your ${trialLength} trial. Cancel anytime.`
      : `${activePrice}/${activePeriod} covers both of you. Cancel anytime.`
    : 'Choose a plan to continue.';
  const ctaLabel = hasTrial ? `Try ${trialLength} free` : activePackage ? 'Unlock Premium for two' : 'Choose a plan';

  const openLegalUrl = (url: string) => {
    Linking.openURL(url).catch(() => {
      Alert.alert('Unable to Open', 'Could not open this link right now.');
    });
  };

  return <View style={styles.container}>
    <StatusBar barStyle="dark-content" />
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.topBlush} />
      <Svg width="100%" height={120} viewBox="0 0 400 120" preserveAspectRatio="none" style={styles.bottomWave}>
        <Path d="M 220 120 C 290 80 325 115 400 30 L 400 120 Z" fill="#E9F8F3" />
      </Svg>
    </View>
    <ScrollView style={styles.fill} contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 16) }]} contentInsetAdjustmentBehavior="never" showsVerticalScrollIndicator={false} bounces={false}>
      <View style={[styles.page, { maxWidth: contentWidth }]}>
        <View style={styles.header}>
          <Pressable disabled={!!busyAction} accessibilityRole="button" accessibilityLabel="Restore purchases" accessibilityState={{ disabled: !!busyAction, busy: busyAction === 'restore' }} onPress={() => { void handleAction('restore', restorePurchases); }} style={({ pressed }) => [styles.restore, pressed && styles.pressed]}>
            {busyAction === 'restore' ? <ActivityIndicator color={C.coral} /> : <Text style={styles.restoreText}>Restore</Text>}
          </Pressable>
          <View style={styles.brand}>
            <Image source={require('../../assets/logo.png')} tintColor={C.coral} contentFit="contain" style={styles.brandMark} accessible={false} />
            <Text style={[styles.brandName, width < 360 && styles.brandNameSmall]}>{APP_NAME}</Text>
          </View>
          <Pressable disabled={!!busyAction} onPress={handleClose} accessibilityRole="button" accessibilityLabel="Close paywall" accessibilityState={{ disabled: !!busyAction }} style={({ pressed }) => [styles.close, pressed && styles.pressed]}><X color="#606A7D" size={24} strokeWidth={2.2} /></Pressable>
        </View>
        <Reveal delay={0} style={[styles.heading, { marginTop: compact ? 12 : 16 }]}>
          <Text accessibilityRole="header" style={[styles.title, { fontSize: Math.min(compact ? 29 : 32, (contentWidth - 48) / 10.5), lineHeight: compact ? 33 : 36 }]}>
            {'Unlock Premium\nfor '}<Text style={styles.accent}>both of you</Text>
          </Text>
        </Reveal>
        <Reveal delay={80} style={[styles.artwork, { height: Math.min((contentWidth - 48) * 0.49, Math.max(112, Math.min(174, (height - 720) * 0.18 + 100))) }]}>
          <HeroArt />
        </Reveal>
        <Reveal delay={160} style={styles.features}>
          {FEATURES.map(({ icon: Icon, label }, index) => <View key={label} style={styles.featureRow}>
            <View style={styles.featureIcon}><Icon color={C.coral} size={22} strokeWidth={2} /></View>
            <View style={[styles.featureCopy, index < FEATURES.length - 1 && styles.featureDivider]}>
              <Text style={styles.featureText}>{label}</Text>
              <Animated.View entering={pop(360 + index * 90)} style={styles.checkCircle}><Check color="#10B96E" size={19} strokeWidth={3} /></Animated.View>
            </View>
          </View>)}
        </Reveal>
        <Reveal delay={240} style={styles.plansSection}>
          {packages.length ? <View style={styles.plansRow} accessibilityRole="radiogroup" accessibilityLabel="Subscription plans">
            {packages.map(pkg => {
              const trial = packageHasFreeTrial(pkg);
              const period = getPackagePeriodLabel(pkg);
              const savings = getSavingsLabel(pkg, weeklyPackage);
              const price = getPackagePrice(pkg);
              const pkgTrialLength = getTrialLengthLabel(pkg);
              return <PlanCard
                key={pkg.identifier}
                title={getPackageTitle(pkg)}
                tag={savings ?? (trial ? 'Free trial' : null)}
                tagFilled={!!savings}
                subtitle={trial ? `Free for ${pkgTrialLength}, then ${price}/${SHORT_PERIOD[period] ?? period}` : formatWeeklyEquivalentLabel(pkg) || `Billed every ${period}`}
                price={trial ? getZeroTodayLabel(pkg) : price}
                priceCaption={trial ? 'today' : `per ${period}`}
                selected={pkg.identifier === selectedPlan}
                disabled={!!busyAction}
                compact={width < 360}
                accessibilityLabel={`${getPackageTitle(pkg)}. ${trial ? `${getZeroTodayLabel(pkg)} today, free for ${pkgTrialLength}, then ` : ''}${price} per ${period}${savings ? `. ${savings}` : ''}`}
                onPress={() => { Haptics.selectionAsync().catch(() => {}); setSelectedPlan(pkg.identifier); setActionError(null); }}
              />;
            })}
          </View> : <View style={styles.emptyPlans}>
            {loading ? <><ActivityIndicator color={C.coral} /><Text style={styles.emptyText}>Loading your plans...</Text></> : <>
              <Text style={styles.emptyText}>{billingError || 'Plans are unavailable right now.'}</Text>
              <Pressable disabled={!!busyAction} accessibilityRole="button" onPress={() => { void handleAction('retry', () => refreshAccess({ syncRevenueCat: true })); }} style={styles.retry}><Text style={styles.retryText}>{busyAction === 'retry' ? 'Trying again...' : 'Try again'}</Text></Pressable>
            </>}
          </View>}
        </Reveal>
        <View style={styles.spacer} />
        <Reveal delay={320} style={styles.footer}>
          {actionError && <Text accessibilityRole="alert" style={styles.actionError}>{actionError}</Text>}
          <View>
            <PrimaryButton label={ctaLabel} onPress={() => { void handleAction('purchase', () => purchase(activePackage)); }} disabled={ctaDisabled} loading={busyAction === 'purchase'} style={styles.cta} />
            {!ctaDisabled && <CtaShimmer />}
          </View>
          <Animated.Text key={`${selectedPlan}-${hasTrial}`} entering={FadeIn.duration(220)} style={styles.disclosure}>{disclosureText}</Animated.Text>
          {activePackage && <Text style={styles.renewal}>Auto-renews unless cancelled at least 24 hours before renewal.</Text>}
          <View style={styles.legalLinks}>
            <Pressable accessibilityRole="link" onPress={() => openLegalUrl(TERMS_URL)} style={styles.legalTarget}><Text style={styles.legalText}>Terms</Text></Pressable>
            <Text style={styles.legalText}>{'\u00b7'}</Text>
            <Pressable accessibilityRole="link" onPress={() => openLegalUrl(PRIVACY_POLICY_URL)} style={styles.legalTarget}><Text style={styles.legalText}>Privacy</Text></Pressable>
          </View>
        </Reveal>
      </View>
    </ScrollView>
  </View>;
}

function Reveal({ delay, style, children }: { delay: number; style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(withDelay(reduced ? 0 : delay, withTiming(1, { duration: 280, easing: EASE_OUT })));
    return () => cancelAnimation(progress);
  }, [delay, progress, reduced]);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: progress.get(), transform: [{ translateY: reduced ? 0 : (1 - progress.get()) * 14 }] }));
  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

function HeroArt() {
  const reduced = useReducedMotion();
  const float = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    float.set(withDelay(600, withRepeat(withTiming(1, { duration: 2600, easing: IDLE_EASE }), -1, true)));
    return () => cancelAnimation(float);
  }, [float, reduced]);
  const coupleStyle = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(float.get(), [0, 1], [0, -3]) }, { scale: interpolate(float.get(), [0, 1], [1, 1.012]) }] }));
  const trophyStyle = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(float.get(), [0, 1], [0, -6]) }, { rotate: `${interpolate(float.get(), [0, 1], [-4, 4])}deg` }] }));
  const raysStyle = useAnimatedStyle(() => ({ opacity: interpolate(float.get(), [0, 0.5, 1], [0.55, 1, 0.55]) }));

  return <>
    <View style={styles.artBlush} />
    <Animated.View style={[StyleSheet.absoluteFill, coupleStyle]}>
      <Image source={require('../../assets/paywall/couple-premium-rear-view.png')} style={StyleSheet.absoluteFill} contentFit="contain" accessibilityLabel="Fitness partners celebrating viewed from behind, woman on the left and man on the right" />
    </Animated.View>
    <LinearGradient pointerEvents="none" colors={['rgba(255,252,252,0)', C.bg]} style={styles.artFade} />
    <Animated.View entering={pop(320)} pointerEvents="none" style={styles.trophyAnchor}>
      <Animated.View style={trophyStyle}>
        <Animated.View style={[StyleSheet.absoluteFill, raysStyle]}>
          <Svg width={64} height={64} viewBox="0 0 64 64" style={styles.trophyRays}>
            <Path d="M 32 2 L 32 8 M 9 12 L 13 16 M 55 12 L 51 16 M 2 30 L 8 30 M 62 30 L 56 30" stroke={C.coral} strokeWidth={3} strokeLinecap="round" fill="none" />
          </Svg>
        </Animated.View>
        <View style={styles.trophyBadge}><Trophy color={C.coral} size={20} strokeWidth={2.4} /></View>
      </Animated.View>
    </Animated.View>
  </>;
}

function PlanCard({ title, tag, tagFilled, subtitle, price, priceCaption, selected, disabled, compact, accessibilityLabel, onPress }: {
  title: string;
  tag: string | null;
  tagFilled: boolean;
  subtitle: string;
  price: string;
  priceCaption: string;
  selected: boolean;
  disabled: boolean;
  compact: boolean;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const active = useSharedValue(selected ? 1 : 0);
  const pressed = useSharedValue(0);
  useEffect(() => {
    active.set(withTiming(selected ? 1 : 0, { duration: 220, easing: EASE_OUT }));
  }, [active, selected]);

  const cardStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(active.get(), [0, 1], ['#EDEEF1', C.coral]),
    backgroundColor: interpolateColor(active.get(), [0, 1], ['rgba(255,255,255,0.8)', '#FFF3F3']),
    transform: [{ scale: interpolate(pressed.get(), [0, 1], [1, 0.98]) }],
  }));
  const radioStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(active.get(), [0, 1], ['#DFE2E9', C.coral]),
    backgroundColor: interpolateColor(active.get(), [0, 1], ['rgba(255,255,255,0)', C.coral]),
  }));
  const checkStyle = useAnimatedStyle(() => ({ opacity: active.get(), transform: [{ scale: interpolate(active.get(), [0, 1], [0.4, 1]) }] }));

  return <Pressable
    accessibilityRole="radio"
    accessibilityState={{ checked: selected, disabled }}
    accessibilityLabel={accessibilityLabel}
    disabled={disabled}
    onPress={onPress}
    onPressIn={() => pressed.set(withTiming(1, { duration: 110, easing: EASE_OUT }))}
    onPressOut={() => pressed.set(withTiming(0, { duration: 180, easing: EASE_OUT }))}
  >
    <Animated.View style={[styles.planCard, cardStyle]}>
      <Animated.View style={[styles.radio, radioStyle]}>
        <Animated.View style={checkStyle}><Check color={C.white} size={15} strokeWidth={3.2} /></Animated.View>
      </Animated.View>
      <View style={styles.planInfo}>
        <View style={styles.planTitleRow}>
          <Text numberOfLines={1} style={styles.planTitle}>{title}</Text>
          {tag && <View style={[styles.planTag, tagFilled && styles.planTagFilled]}><Text numberOfLines={1} style={[styles.planTagText, tagFilled && styles.planTagTextFilled]}>{tag}</Text></View>}
        </View>
        <Text style={styles.planSubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.planPriceBox}>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[styles.planPrice, compact && styles.planPriceCompact]}>{price}</Text>
        <Text numberOfLines={1} style={styles.planPriceCaption}>{priceCaption}</Text>
      </View>
    </Animated.View>
  </Pressable>;
}

function CtaShimmer() {
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const sweep = useSharedValue(0);
  useEffect(() => {
    if (reduced || !width) return;
    sweep.set(0);
    sweep.set(withDelay(900, withRepeat(withDelay(2400, withTiming(1, { duration: 950, easing: EASE_OUT })), -1, false)));
    return () => cancelAnimation(sweep);
  }, [reduced, sweep, width]);
  const bandStyle = useAnimatedStyle(() => ({ transform: [{ translateX: interpolate(sweep.get(), [0, 1], [-90, width + 20]) }, { skewX: '-20deg' }] }));

  if (reduced) return null;
  return <View pointerEvents="none" style={styles.shimmerClip} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
    <Animated.View style={[styles.shimmerBand, bandStyle]}>
      <LinearGradient start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.34)', 'rgba(255,255,255,0)']} style={StyleSheet.absoluteFill} />
    </Animated.View>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, overflow: 'hidden' },
  fill: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  page: { width: '100%', alignSelf: 'center', flexGrow: 1, paddingHorizontal: 24 },
  topBlush: { position: 'absolute', top: -210, left: -115, width: 320, height: 280, borderRadius: 999, backgroundColor: '#FFF0F0', transform: [{ rotate: '-25deg' }] },
  bottomWave: { position: 'absolute', bottom: 0 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  restore: { minHeight: 44, minWidth: 56, alignItems: 'flex-start', justifyContent: 'center' },
  restoreText: { color: '#7C8598', fontSize: 14, fontWeight: '600' },
  brand: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, flex: 1 },
  brandMark: { width: 27, height: 27 },
  brandName: { color: C.ink, fontSize: 18, fontWeight: '900', fontStyle: 'italic', letterSpacing: -0.7 },
  brandNameSmall: { fontSize: 16 },
  close: { width: 44, height: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F3F5' },
  pressed: { opacity: 0.55 },
  heading: { alignItems: 'center' },
  title: { color: C.ink, fontWeight: '900', letterSpacing: -1.3, textAlign: 'center' },
  accent: { color: C.coral },
  artwork: { marginTop: 8, alignItems: 'center' },
  artBlush: { position: 'absolute', left: 28, right: 28, bottom: 0, height: '80%', borderRadius: 999, backgroundColor: '#FFEEEE' },
  artFade: { position: 'absolute', left: 0, right: 0, bottom: -1, height: 28 },
  trophyAnchor: { position: 'absolute', top: 0, alignSelf: 'center', width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  trophyRays: { position: 'absolute', top: -14, left: -14 },
  trophyBadge: { width: 36, height: 36, borderRadius: 999, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(255, 69, 72, 0.22)' },
  features: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderCurve: 'continuous', borderWidth: 1, borderColor: '#EEEFF2', backgroundColor: 'rgba(255,255,255,0.92)' },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureIcon: { width: 38, height: 34, borderRadius: 10, borderCurve: 'continuous', backgroundColor: '#FFF0F1', alignItems: 'center', justifyContent: 'center' },
  featureCopy: { flex: 1, minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  featureDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F0F0F3' },
  featureText: { flex: 1, color: C.ink, fontSize: 14, lineHeight: 19, fontWeight: '600', letterSpacing: -0.3 },
  checkCircle: { width: 27, height: 27, borderRadius: 999, backgroundColor: '#E9FBF2', alignItems: 'center', justifyContent: 'center' },
  plansSection: { marginTop: 16 },
  plansRow: { gap: 10 },
  planCard: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 68, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16, borderCurve: 'continuous', borderWidth: 2 },
  radio: { width: 24, height: 24, borderRadius: 999, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  planInfo: { flex: 1, gap: 2 },
  planTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 8, rowGap: 4 },
  planTitle: { color: C.ink, fontSize: 17, lineHeight: 22, fontWeight: '800', letterSpacing: -0.4 },
  planTag: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: '#FFE4E4' },
  planTagFilled: { backgroundColor: C.coral },
  planTagText: { color: C.coral, fontSize: 11, lineHeight: 14, fontWeight: '800', letterSpacing: 0.2 },
  planTagTextFilled: { color: C.white },
  planSubtitle: { color: '#7C8598', fontSize: 13, lineHeight: 18, fontWeight: '600', fontVariant: ['tabular-nums'] },
  planPriceBox: { alignItems: 'flex-end', maxWidth: '40%' },
  planPrice: { color: C.ink, fontSize: 22, lineHeight: 26, fontWeight: '900', letterSpacing: -0.7, fontVariant: ['tabular-nums'] },
  planPriceCompact: { fontSize: 19, lineHeight: 23 },
  planPriceCaption: { color: '#7C8598', fontSize: 12, lineHeight: 16, fontWeight: '600' },
  emptyPlans: { minHeight: 116, borderRadius: 16, borderCurve: 'continuous', padding: 16, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyText: { color: '#7C8598', textAlign: 'center', fontSize: 14 },
  retry: { minHeight: 44, paddingHorizontal: 20, justifyContent: 'center' },
  retryText: { color: C.coral, fontWeight: '700', fontSize: 15 },
  spacer: { flexGrow: 1, minHeight: 16, maxHeight: 24 },
  footer: { alignSelf: 'stretch' },
  cta: { marginBottom: 0, height: 54 },
  shimmerClip: { position: 'absolute', top: 2, bottom: 2, left: 3, right: 3, borderRadius: 999, borderCurve: 'continuous', overflow: 'hidden' },
  shimmerBand: { position: 'absolute', top: 0, bottom: 0, width: 70 },
  disclosure: { textAlign: 'center', color: '#7C8598', marginTop: 10, fontSize: 13, lineHeight: 18, fontVariant: ['tabular-nums'] },
  renewal: { marginTop: 4, color: '#7C8598', textAlign: 'center', fontSize: 10, lineHeight: 14 },
  legalLinks: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 },
  legalTarget: { minHeight: 44, paddingHorizontal: 10, justifyContent: 'center' },
  legalText: { color: '#7C8598', fontSize: 13, fontWeight: '500' },
  actionError: { color: C.coral, fontSize: 13, lineHeight: 18, textAlign: 'center', marginBottom: 12 },
});
