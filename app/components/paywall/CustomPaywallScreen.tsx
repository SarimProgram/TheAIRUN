import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  InteractionManager,
  Linking,
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
import { X } from 'lucide-react-native';

import { PRIVACY_POLICY_URL, TERMS_URL } from '@/config/legal';
import { useAuth } from '@/src/auth/authContext';
import { useEntitlement } from '@/src/billing';
import { trackCustomPaywallImpression } from '@/src/billing/trackCustomPaywallImpression';

const { height } = Dimensions.get('window');

const COLORS = {
  primary: '#FF6B6B',
  primaryDark: '#EE5253',
  primaryText: '#FFFFFF',
  background: '#FFFFFF',
  surface: '#F9FAFB',
  surfaceHighlight: '#FFF0F0',
  text: '#1F2937',
  muted: '#6B7280',
  border: '#FFE0E0',
  neutralBorder: '#E5E7EB',
};

const FEATURES = [
  'Share goals with your partner',
  'Real-time pacing guidance',
  'Partner rewards marketplace',
  'Smart notifications and points',
  'Live races together in real time',
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

function getTrialLengthLabel(pkg: any): string | null {
  const intro =
    pkg?.product?.introPrice ??
    pkg?.storeProduct?.introPrice ??
    pkg?.product?.introductoryPrice ??
    pkg?.storeProduct?.introductoryPrice ??
    null;

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

export default function CustomPaywallScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string | string[] }>();
  const { isAuthenticated } = useAuth();
  const {
    access,
    hasAccess,
    offerings,
    purchase,
    restorePurchases,
    refreshAccess,
  } = useEntitlement();

  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const hasTrackedImpressionRef = useRef(false);

  const packages = useMemo(() => getAllPackages(offerings), [offerings]);
  const currentOfferingId = useMemo(
    () => offerings?.current?.identifier || offerings?.all?.default?.identifier || null,
    [offerings]
  );

  useEffect(() => {
    if (packages.length > 0 && !selectedPlan) {
      const best = packages.find(p => getPackagePeriodLabel(p) === 'week') || packages[0];
      setSelectedPlan(best.identifier);
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

  const activePackage = packages.find(p => p.identifier === selectedPlan);
  const activePeriod = getPackagePeriodLabel(activePackage);
  const activePrice = getPackagePrice(activePackage);
  const trialLength = getTrialLengthLabel(activePackage);
  const hasTrial = !!trialLength && activePeriod === 'week';
  const disclosurePrice = activePrice || 'the selected plan price';
  const disclosurePeriod = activePeriod === 'billing period' ? 'billing period' : activePeriod;
  const disclosureText = hasTrial
    ? `${trialLength} free, then ${disclosurePrice} per ${disclosurePeriod}. Subscription auto-renews unless canceled at least 24 hours before the end of the current period. You can manage or cancel anytime in your App Store account settings.`
    : `${disclosurePrice} per ${disclosurePeriod}. Subscription auto-renews unless canceled at least 24 hours before the end of the current period. You can manage or cancel anytime in your App Store account settings.`;

  const openLegalUrl = (url: string) => {
    Linking.openURL(url).catch(() => {
      Alert.alert('Unable to Open', 'Could not open this link right now.');
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      
      {/* Background Image Setup - Top Half Only */}
      <View style={styles.imageContainer}>
        <Image 
          source={require('../../assets/widee.png')} 
          style={styles.headerImage}
          resizeMode="cover"
        />
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.9)', '#FFFFFF']}
          locations={[0, 0.7, 1]}
          style={styles.gradientOverlay}
        />
      </View>

      <SafeAreaView style={styles.safe} pointerEvents="box-none">
        {/* Header Controls */}
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
              <X color="#FFF" size={20} strokeWidth={2.5} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Main Content - Pushed to Bottom */}
        <View style={styles.content} pointerEvents="box-none">
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Unlock your</Text>
            <Text style={styles.titleHighlight}>full potential.</Text>
          </View>

          {/* Minimal Feature List */}
          <View style={styles.featuresList}>
            {FEATURES.map((feature, index) => (
              <View key={index} style={styles.featureItem}>
                <View style={styles.dot} />
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>

          {/* Compact Plans (Side by Side) */}
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
                  const isSelected = selectedPlan === pkg.identifier;

                  return (
                    <TouchableOpacity
                      key={pkg.identifier}
                      activeOpacity={0.9}
                      style={[styles.planCard, isSelected && styles.planCardSelected]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedPlan(pkg.identifier);
                      }}
                    >
                      {isAnnual && (
                        <View style={[styles.badge, isSelected && styles.badgeSelected]}>
                          <Text style={[styles.badgeText, isSelected && styles.badgeTextSelected]}>BEST VALUE</Text>
                        </View>
                      )}
                      
                      <Text style={[styles.planTitle, isSelected && styles.textSelected]}>
                        {getPackageTitle(pkg)}
                      </Text>
                      <Text style={[styles.planPrice, isSelected && styles.textSelected]}>
                        {getPackagePrice(pkg)}
                      </Text>
                      <Text style={[styles.planPeriodText, isSelected && styles.textSelected]}>
                        per {period}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* Massive CTA */}
          <TouchableOpacity
            style={[styles.ctaButton, (!!busyAction || !activePackage) && styles.ctaDisabled]}
            disabled={!!busyAction || !activePackage}
            activeOpacity={0.9}
            onPress={() => handleAction('purchase', () => purchase(activePackage))}
          >
            {busyAction === 'purchase' ? (
              <ActivityIndicator color={COLORS.primaryText} />
            ) : (
              <Text style={styles.ctaText}>
                {activePeriod === 'week' ? 'Start 7-Day Free Trial' : 'Continue'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Subscription disclosure */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>{disclosureText}</Text>
            <View style={styles.legalLinks}>
              <TouchableOpacity onPress={() => openLegalUrl(TERMS_URL)}>
                <Text style={styles.footerLink}>Terms of Use</Text>
              </TouchableOpacity>
              <Text style={styles.legalSeparator}>|</Text>
              <TouchableOpacity onPress={() => openLegalUrl(PRIVACY_POLICY_URL)}>
                <Text style={styles.footerLink}>Privacy Policy</Text>
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
    height: height * 0.42, // Shorter image so text sits on white background
  },
  headerImage: {
    width: '100%',
    height: '100%',
  },
  gradientOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -1, // Prevent visual bleeding line
    height: '80%',
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
    paddingTop: 16,
    zIndex: 10,
  },
  headerBtn: {
    height: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,107,107,0.78)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  restoreText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  closeBtnInner: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255,107,107,0.78)',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    flex: 1,
    justifyContent: 'flex-end',
  },
  titleContainer: {
    marginBottom: 24,
  },
  title: {
    color: COLORS.text,
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 44,
  },
  titleHighlight: {
    color: COLORS.primary,
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 44,
  },
  featuresList: {
    gap: 12,
    marginBottom: 32,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
    marginRight: 14,
    marginLeft: 4,
  },
  featureText: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  plansWrapper: {
    marginBottom: 24,
  },
  emptyPlans: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plansRow: {
    flexDirection: 'row',
    gap: 12,
  },
  planCard: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: COLORS.neutralBorder,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    position: 'relative',
    minHeight: 110,
    justifyContent: 'center',
  },
  planCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surfaceHighlight,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 2,
  },
  badge: {
    position: 'absolute',
    top: -12,
    backgroundColor: COLORS.surfaceHighlight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  badgeSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  badgeText: {
    color: COLORS.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  badgeTextSelected: {
    color: COLORS.primaryText,
  },
  planTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.muted,
    marginBottom: 8,
    marginTop: 4,
  },
  planPrice: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 2,
  },
  planPeriodText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.muted,
  },
  textSelected: {
    color: COLORS.primaryDark,
  },
  ctaButton: {
    backgroundColor: COLORS.primary,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 16,
    elevation: 8,
  },
  ctaDisabled: {
    opacity: 0.6,
  },
  ctaText: {
    color: COLORS.primaryText,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  footer: {
    alignItems: 'center',
    gap: 6,
  },
  footerText: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    textAlign: 'center',
  },
  legalLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  footerLink: {
    color: COLORS.primaryDark,
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
    opacity: 0.8,
  },
  legalSeparator: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '600',
  },
});
