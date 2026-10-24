import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  InteractionManager,
  Linking,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  Dimensions,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Star, X } from 'lucide-react-native';

import { PRIVACY_POLICY_URL, TERMS_URL } from '@/config/legal';
import { useAuth } from '@/src/auth/authContext';
import { useEntitlement } from '@/src/billing';
import { trackCustomPaywallImpression } from '@/src/billing/trackCustomPaywallImpression';

const { height } = Dimensions.get('window');

const COLORS = {
  primary: '#FF3B3B',
  primaryDark: '#D62F2F',
  primarySoft: '#FFF0F0',
  primaryText: '#FFFFFF',
  background: '#FFFFFF',
  surface: '#F8FAFC',
  text: '#121212',
  muted: '#64748B',
  border: '#E8ECF0',
  success: '#10B981',
  successSoft: '#ECFDF5',
};

const TYPE = {
  display: Platform.select({
    ios: 'System',
    android: 'sans-serif-medium',
    default: 'System',
  }),
  body: Platform.select({
    ios: 'System',
    android: 'sans-serif',
    default: 'System',
  }),
};

const FEATURES = [
  'Unlocks Premium for you and your partner',
  'Train with your partner',
  'Your personalised plan unlocked',
  'Live races for Long Distance Partners',
  'Couple rewards marketplace',
  'Smart reminders that keep you on track',
];

function getPackageTitle(pkg: any) {
  const period = getPackagePeriodLabel(pkg);
  if (period === 'year') return 'Yearly';
  if (period === 'month') return 'Monthly';
  if (period === 'week') return 'Weekly';
  return pkg?.product?.title || pkg?.storeProduct?.title || 'Premium';
}

function getPackagePrice(pkg: any) {
  return pkg?.product?.priceString || pkg?.storeProduct?.priceString || '';
}

function getIntroPrice(pkg: any) {
  return (
    pkg?.product?.introPrice ??
    pkg?.storeProduct?.introPrice ??
    pkg?.product?.introductoryPrice ??
    pkg?.storeProduct?.introductoryPrice ??
    null
  );
}

function packageHasFreeTrial(pkg: any): boolean {
  if (!pkg || getPackagePeriodLabel(pkg) !== 'week') return false;
  return !!getTrialLengthLabel(pkg);
}

function getZeroTodayLabel(pkg: any): string {
  const intro = getIntroPrice(pkg);
  if (intro?.priceString) return intro.priceString.replace(/\.00$/, '');
  const priceString = getPackagePrice(pkg);
  const currencyPrefix = priceString.match(/^[^\d]+/)?.[0]?.trim();
  return currencyPrefix ? `${currencyPrefix}0` : '$0';
}

function getTrialLengthLabel(pkg: any): string | null {
  const intro = getIntroPrice(pkg);

  const rawPeriod = String(
    intro?.period ??
      intro?.subscriptionPeriod ??
      intro?.periodUnit ??
      pkg?.product?.introPrice?.periodUnit ??
      pkg?.storeProduct?.introPrice?.periodUnit ??
      ''
  ).toLowerCase();

  const rawCycles = Number(
    intro?.cycles ??
      intro?.periodNumberOfUnits ??
      intro?.numberOfPeriods ??
      1
  );

  if (rawPeriod.includes('p1w') || rawPeriod.includes('week')) {
    return rawCycles > 1 ? `${rawCycles} weeks` : '7 days';
  }
  if (rawPeriod.includes('p1m') || rawPeriod.includes('month')) {
    return rawCycles > 1 ? `${rawCycles} months` : '1 month';
  }
  if (rawPeriod.includes('p1y') || rawPeriod.includes('year')) {
    return rawCycles > 1 ? `${rawCycles} years` : '1 year';
  }

  return getPackagePeriodLabel(pkg) === 'week' ? '7 days' : null;
}

function getPackagePeriodLabel(pkg: any): string {
  const rawType = String(pkg?.packageType ?? '').toUpperCase();
  if (rawType.includes('WEEK')) return 'week';
  if (rawType.includes('MONTH')) return 'month';
  if (rawType.includes('ANNUAL') || rawType.includes('YEAR')) return 'year';

  const rawPeriod = String(
    pkg?.product?.subscriptionPeriod?.iso8601 ??
      pkg?.storeProduct?.subscriptionPeriod?.iso8601 ??
      pkg?.product?.subscriptionPeriod?.unit ??
      pkg?.storeProduct?.subscriptionPeriod?.unit ??
      ''
  ).toLowerCase();

  if (rawPeriod.includes('p1w') || rawPeriod.includes('week')) return 'week';
  if (rawPeriod.includes('p1m') || rawPeriod.includes('month')) return 'month';
  if (rawPeriod.includes('p1y') || rawPeriod.includes('year')) return 'year';
  return 'billing period';
}

function getAllPackages(offerings: any): any[] {
  const seen = new Set<string>();
  const result: any[] = [];

  const addPackages = (list?: any[]) => {
    if (!Array.isArray(list)) return;
    for (const pkg of list) {
      if (!pkg) continue;
      const key = String(pkg?.identifier || pkg?.product?.identifier || result.length);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(pkg);
    }
  };

  addPackages(offerings?.current?.availablePackages);
  addPackages(offerings?.all?.default?.availablePackages);
  return result;
}

function getWeeklyEquivalent(pkg: any): number | null {
  const price = pkg?.product?.price ?? pkg?.storeProduct?.price;
  if (typeof price !== 'number' || !Number.isFinite(price)) return null;
  const period = getPackagePeriodLabel(pkg);
  if (period === 'week') return price;
  if (period === 'month') return price / 4.33;
  if (period === 'year') return price / 52;
  return null;
}

function getSavingsLabel(pkg: any, weeklyPkg: any | undefined): string | null {
  if (!weeklyPkg || getPackagePeriodLabel(pkg) !== 'year') return null;
  const weeklyEq = getWeeklyEquivalent(pkg);
  const weeklyPrice = getWeeklyEquivalent(weeklyPkg);
  if (!weeklyEq || !weeklyPrice || weeklyPrice <= weeklyEq) return null;
  const pct = Math.round(((weeklyPrice - weeklyEq) / weeklyPrice) * 100);
  return pct > 0 ? `Save ${pct}%` : null;
}

function parsePriceParts(priceString: string): { prefix: string; amount: string } {
  const trimmed = priceString.trim();
  const match = trimmed.match(/^([^\d]*?)([\d][\d,.]*)/);
  if (!match) return { prefix: '', amount: trimmed };
  return { prefix: match[1], amount: match[2] };
}

function formatWeeklyEquivalentLabel(pkg: any): string | null {
  const weeklyEq = getWeeklyEquivalent(pkg);
  if (weeklyEq == null) return null;
  const { prefix } = parsePriceParts(getPackagePrice(pkg));
  const formatted = weeklyEq.toFixed(2).replace(/\.00$/, '');
  return `≈ ${prefix}${formatted}/wk`;
}

type PlanPriceDisplayProps = {
  price: string;
  periodLabel: string;
  renewalLabel?: string | null;
  weeklyEquivalent?: string | null;
  isSelected: boolean;
  isTrial: boolean;
};

function PlanPriceDisplay({
  price,
  periodLabel,
  renewalLabel,
  weeklyEquivalent,
  isSelected,
  isTrial,
}: PlanPriceDisplayProps) {
  const { prefix, amount } = parsePriceParts(price);

  return (
    <View style={styles.priceBlock}>
      <View style={styles.priceRow}>
        {prefix ? (
          <Text
            style={[
              styles.planCurrency,
              isTrial && styles.planCurrencyTrial,
              isSelected && styles.planCurrencySelected,
            ]}
          >
            {prefix}
          </Text>
        ) : null}
        <Text
          style={[
            styles.planAmount,
            isTrial && styles.planAmountTrial,
            isSelected && styles.planAmountSelected,
          ]}
        >
          {amount}
        </Text>
      </View>

      <Text
        style={[
          styles.planPeriodText,
          isTrial && styles.planPeriodTextTrial,
          isSelected && !isTrial && styles.planPeriodTextSelected,
        ]}
      >
        {periodLabel}
      </Text>

      {renewalLabel ? (
        <Text
          style={[styles.planRenewalText, isSelected && styles.planRenewalTextSelected]}
        >
          {renewalLabel}
        </Text>
      ) : weeklyEquivalent ? (
        <Text style={[styles.planWeeklyEq, isSelected && styles.planWeeklyEqSelected]}>
          {weeklyEquivalent}
        </Text>
      ) : null}
    </View>
  );
}

export default function CustomPaywallScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string | string[] }>();
  const { isAuthenticated } = useAuth();
  const {
    access,
    hasAccess,
    offerings,
    startTrial,
    purchase,
    restorePurchases,
    refreshAccess,
  } = useEntitlement();

  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const hasTrackedImpressionRef = useRef(false);

  const packages = useMemo(() => getAllPackages(offerings), [offerings]);
  const weeklyPackage = useMemo(
    () => packages.find((pkg) => getPackagePeriodLabel(pkg) === 'week'),
    [packages]
  );
  const currentOfferingId = useMemo(
    () => offerings?.current?.identifier || offerings?.all?.default?.identifier || null,
    [offerings]
  );

  useEffect(() => {
    if (packages.length > 0 && !selectedPlan) {
      const annual = packages.find((pkg) => getPackagePeriodLabel(pkg) === 'year');
      const weekly = packages.find((pkg) => getPackagePeriodLabel(pkg) === 'week');
      setSelectedPlan((annual || weekly || packages[0]).identifier);
    }
  }, [packages, selectedPlan]);

  const backendRequiresPaywall = !!access?.paywallReason;
  const isManageMode = (Array.isArray(params.mode) ? params.mode[0] : params.mode) === 'manage';
  const isPartnerIncludedAccess = access?.accessSource === 'partner' && hasAccess;

  useEffect(() => {
    if (isPartnerIncludedAccess) {
      router.replace('/(tabs)' as any);
      return;
    }
    if (hasAccess && !backendRequiresPaywall && !isManageMode) {
      router.replace('/(tabs)' as any);
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
    if (busyAction) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBusyAction(key);
    try {
      await fn();
      await refreshAccess({ syncRevenueCat: true });
    } catch (e) {
      Alert.alert('Billing Error', e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusyAction(null);
    }
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)' as any);
  };

  const activePackage = packages.find((pkg) => pkg.identifier === selectedPlan);
  const activePeriod = getPackagePeriodLabel(activePackage);
  const activePrice = getPackagePrice(activePackage);
  const useBackendTrialCta = __DEV__ && !activePackage;
  const ctaDisabled = !!busyAction || (!useBackendTrialCta && !activePackage);
  const trialLength = getTrialLengthLabel(activePackage);
  const hasTrial = packageHasFreeTrial(activePackage);
  const zeroTodayPackage = packageHasFreeTrial(activePackage) ? activePackage : weeklyPackage;
  const zeroTodayLabel = getZeroTodayLabel(zeroTodayPackage);
  const disclosurePrice = activePrice || 'the selected plan price';
  const disclosurePeriod = activePeriod === 'billing period' ? 'billing period' : activePeriod;
  const disclosureText = hasTrial
    ? `${trialLength} free, then ${disclosurePrice} per ${disclosurePeriod}. Auto-renews unless cancelled 24h before period ends.`
    : `${disclosurePrice} per ${disclosurePeriod}. Auto-renews unless cancelled 24h before period ends.`;

  const ctaLabel = hasTrial
    ? `Start for ${zeroTodayLabel} today`
    : activePeriod === 'year'
      ? 'Start My Plan'
      : 'Continue';

  const openLegalUrl = (url: string) => {
    Linking.openURL(url).catch(() => {
      Alert.alert('Unable to Open', 'Could not open this link right now.');
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <View style={styles.imageContainer}>
        <Image
          source={require('../../assets/widee.png')}
          style={styles.headerImage}
          resizeMode="cover"
        />
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.6)', '#FFFFFF']}
          locations={[0, 0.35, 0.75]}
          style={styles.gradientOverlay}
        />
      </View>

      <SafeAreaView style={styles.safe} pointerEvents="box-none">
        <View style={styles.header} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => handleAction('restore', restorePurchases)}
          >
            {busyAction === 'restore' ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.restoreText}>Restore</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
            <View style={styles.closeBtnInner}>
              <X color="#FFF" size={18} strokeWidth={2.5} />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.content} pointerEvents="box-none">
          <View style={styles.testimonialCard}>
            <LinearGradient
              colors={['rgba(255, 59, 59, 0.07)', 'rgba(255, 59, 59, 0.02)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.testimonialGradient}
            >
              <View style={styles.testimonialHeader}>
                <View style={styles.testimonialStars}>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star key={i} size={12} color="#F59E0B" fill="#F59E0B" strokeWidth={0} />
                  ))}
                </View>
                <Text style={styles.testimonialAuthor}>Jamie & Alex</Text>
              </View>

              <Text style={styles.testimonialQuote}>
                &ldquo;Doing it with my partner is the only reason I stuck with it. We push each other every week.&rdquo;
              </Text>
            </LinearGradient>
          </View>

          <View style={styles.featuresList}>
            {FEATURES.map((label) => (
              <View key={label} style={styles.featureItem}>
                <Text style={styles.featureText}>{label}</Text>
                <Check size={14} color={COLORS.success} strokeWidth={3} />
              </View>
            ))}
          </View>

          <View style={styles.plansWrapper}>
            {packages.length === 0 ? (
              <View style={styles.emptyPlans}>
                <ActivityIndicator color={COLORS.primary} />
              </View>
            ) : (
              <View style={styles.plansRow}>
                {packages.slice(0, 3).map((pkg) => {
                  const period = getPackagePeriodLabel(pkg);
                  const isAnnual = period === 'year';
                  const isWeekly = period === 'week';
                  const isSelected = selectedPlan === pkg.identifier;
                  const savings = getSavingsLabel(pkg, weeklyPackage);
                  const showTrialPricing = packageHasFreeTrial(pkg);
                  const renewalPrice = getPackagePrice(pkg);

                  return (
                    <TouchableOpacity
                      key={pkg.identifier}
                      activeOpacity={0.92}
                      style={styles.planCardTouchable}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedPlan(pkg.identifier);
                      }}
                    >
                      <View
                        style={[
                          styles.planCard,
                          isSelected && styles.planCardSelected,
                        ]}
                      >
                        {(isAnnual || isWeekly) ? (
                          <LinearGradient
                            colors={
                              isSelected
                                ? [COLORS.primary, COLORS.primaryDark]
                                : ['#1E293B', '#475569']
                            }
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.badge}
                          >
                            <Text style={styles.badgeText}>
                              {isAnnual ? (savings || 'BEST VALUE') : 'FREE TRIAL'}
                            </Text>
                          </LinearGradient>
                        ) : (
                          <View style={styles.badgeSpacer} />
                        )}

                        <Text
                          style={[
                            styles.planTitle,
                            isSelected && styles.planTitleSelected,
                          ]}
                        >
                          {getPackageTitle(pkg)}
                        </Text>

                        <PlanPriceDisplay
                          price={showTrialPricing ? getZeroTodayLabel(pkg) : renewalPrice}
                          periodLabel={
                            showTrialPricing
                              ? 'today'
                              : isWeekly
                                ? 'per week'
                                : `per ${period}`
                          }
                          renewalLabel={
                            showTrialPricing && renewalPrice ? `then ${renewalPrice}/wk` : null
                          }
                          weeklyEquivalent={
                            !showTrialPricing && isAnnual
                              ? formatWeeklyEquivalentLabel(pkg)
                              : null
                          }
                          isSelected={isSelected}
                          isTrial={showTrialPricing}
                        />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[styles.ctaButton, ctaDisabled && styles.ctaDisabled]}
            disabled={ctaDisabled}
            activeOpacity={0.9}
            onPress={() =>
              handleAction('purchase', () =>
                useBackendTrialCta ? startTrial() : purchase(activePackage)
              )
            }
          >
            <LinearGradient
              colors={[COLORS.primary, COLORS.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaGradient}
            >
              {busyAction === 'purchase' ? (
                <ActivityIndicator color={COLORS.primaryText} />
              ) : (
                <Text style={styles.ctaText}>{ctaLabel}</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {hasTrial && (
            <Text style={styles.ctaReassurance}>
              {zeroTodayLabel} today · No payment due now · Cancel anytime
            </Text>
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>{disclosureText}</Text>
            <View style={styles.legalLinks}>
              <TouchableOpacity onPress={() => openLegalUrl(TERMS_URL)}>
                <Text style={styles.footerLink}>Terms</Text>
              </TouchableOpacity>
              <Text style={styles.legalSeparator}>·</Text>
              <TouchableOpacity onPress={() => openLegalUrl(PRIVACY_POLICY_URL)}>
                <Text style={styles.footerLink}>Privacy</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  imageContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.44,
  },
  headerImage: {
    width: '100%',
    height: '100%',
  },
  gradientOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -1,
    height: '100%',
  },
  safe: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 12,
    zIndex: 10,
  },
  headerBtn: {
    height: 36,
    justifyContent: 'center',
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,59,59,0.85)',
    borderRadius: 18,
  },
  restoreText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnInner: {
    width: 36,
    height: 36,
    backgroundColor: 'rgba(255,59,59,0.85)',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 22,
    paddingBottom: 20,
    flex: 1,
    justifyContent: 'flex-end',
  },
  testimonialCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 59, 0.14)',
  },
  testimonialGradient: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  testimonialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  testimonialStars: {
    flexDirection: 'row',
    gap: 3,
  },
  testimonialAuthor: {
    fontFamily: TYPE.display,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.muted,
    letterSpacing: -0.2,
  },
  testimonialQuote: {
    fontFamily: TYPE.body,
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
    lineHeight: 21,
    letterSpacing: -0.3,
  },
  featuresList: {
    gap: 8,
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 2,
  },
  featureText: {
    flex: 1,
    fontFamily: TYPE.body,
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '500',
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  plansWrapper: {
    marginBottom: 16,
  },
  emptyPlans: {
    height: 88,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plansRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'stretch',
  },
  planCardTouchable: {
    flex: 1,
  },
  planCard: {
    borderRadius: 14,
    borderCurve: 'continuous',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.1)',
    paddingTop: 10,
    paddingBottom: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)',
  },
  planCardSelected: {
    borderColor: COLORS.primary,
    borderWidth: 2,
    backgroundColor: '#FFFAFA',
    boxShadow: '0 6px 20px rgba(255, 59, 59, 0.14)',
  },
  badge: {
    alignSelf: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderCurve: 'continuous',
    marginBottom: 2,
  },
  badgeSpacer: {
    height: 17,
    marginBottom: 2,
  },
  badgeText: {
    color: COLORS.primaryText,
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 0.45,
    textAlign: 'center',
  },
  planTitle: {
    fontFamily: TYPE.display,
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.muted,
    letterSpacing: 0.25,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  planTitleSelected: {
    color: '#0F172A',
  },
  priceBlock: {
    alignItems: 'center',
    gap: 1,
    marginTop: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  planCurrency: {
    fontFamily: TYPE.display,
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 3,
    marginRight: 1,
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  planCurrencyTrial: {
    fontSize: 14,
    marginTop: 4,
  },
  planCurrencySelected: {
    color: COLORS.primaryDark,
  },
  planAmount: {
    fontFamily: TYPE.display,
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.8,
    lineHeight: 26,
    fontVariant: ['tabular-nums'],
  },
  planAmountTrial: {
    fontSize: 24,
    lineHeight: 28,
  },
  planAmountSelected: {
    color: COLORS.primaryDark,
  },
  planPeriodText: {
    fontFamily: TYPE.body,
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.muted,
    letterSpacing: 0.1,
  },
  planPeriodTextTrial: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.success,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  planPeriodTextSelected: {
    color: COLORS.primaryDark,
  },
  planRenewalText: {
    fontFamily: TYPE.body,
    fontSize: 9,
    fontWeight: '600',
    color: COLORS.muted,
    marginTop: 2,
    textAlign: 'center',
    letterSpacing: -0.1,
  },
  planRenewalTextSelected: {
    color: COLORS.primaryDark,
  },
  planWeeklyEq: {
    fontFamily: TYPE.body,
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.success,
    marginTop: 2,
    textAlign: 'center',
    letterSpacing: -0.1,
  },
  planWeeklyEqSelected: {
    color: COLORS.primaryDark,
  },
  textSelected: {
    color: COLORS.primaryDark,
  },
  ctaButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 6,
  },
  ctaDisabled: {
    opacity: 0.6,
  },
  ctaGradient: {
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  ctaText: {
    color: COLORS.primaryText,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  ctaReassurance: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.success,
    marginBottom: 12,
  },
  footer: {
    alignItems: 'center',
    gap: 6,
  },
  footerText: {
    color: COLORS.muted,
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 14,
    textAlign: 'center',
  },
  legalLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  footerLink: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  legalSeparator: {
    color: COLORS.muted,
    fontSize: 11,
  },
});
