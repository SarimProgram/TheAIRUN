import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, AppStateStatus, Linking, NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useAuth } from '@/src/auth/authContext';
import { API_BASE_URL } from '@/config/api';
import type { BillingAccessSnapshot, EntitlementContextValue } from './types';

const BILLING_ACCESS_CACHE_KEY = 'billing_access_snapshot_v1';

const EntitlementContext = createContext<EntitlementContextValue | undefined>(undefined);

type PurchasesModule = any;
let purchasesModuleCache: PurchasesModule | null | undefined;
type PurchasesUIModule = any;
let purchasesUiModuleCache: PurchasesUIModule | null | undefined;
let warnedMissingNativePurchases = false;

function hasNativeRevenueCatModule() {
  return !!(NativeModules as any)?.RNPurchases;
}

function isExpoGoRuntime() {
  const appOwnership = (Constants as any)?.appOwnership;
  return appOwnership === 'expo';
}

function getPurchasesModule(): PurchasesModule | null {
  if (purchasesModuleCache !== undefined) return purchasesModuleCache;
  if (Platform.OS === 'web') {
    purchasesModuleCache = null;
    return purchasesModuleCache;
  }

  // Prevent importing the SDK in Expo Go / runtimes without the native module,
  // because the package instantiates NativeEventEmitter at import time.
  if (isExpoGoRuntime() || !hasNativeRevenueCatModule()) {
    if (!warnedMissingNativePurchases) {
      console.log('[Entitlement] RevenueCat native module unavailable; purchases disabled in this runtime.');
      warnedMissingNativePurchases = true;
    }
    purchasesModuleCache = null;
    return purchasesModuleCache;
  }

  try {
    const mod = require('react-native-purchases');
    purchasesModuleCache = mod?.default ?? mod;
  } catch {
    purchasesModuleCache = null;
  }
  return purchasesModuleCache;
}

function configureRevenueCatLogHandler(purchases: PurchasesModule) {
  if (typeof purchases?.setLogHandler !== 'function') return;

  purchases.setLogHandler((level: any, message: string) => {
    const normalizedMessage = String(message || '');
    const isPurchaseCancelled = /purchase was cancelled/i.test(normalizedMessage);

    if (isPurchaseCancelled) {
      console.debug(`[RevenueCat] ${normalizedMessage}`);
      return;
    }

    if (level === purchases?.LOG_LEVEL?.ERROR) {
      console.error(`[RevenueCat] ${normalizedMessage}`);
    } else if (level === purchases?.LOG_LEVEL?.WARN) {
      console.warn(`[RevenueCat] ${normalizedMessage}`);
    } else if (level === purchases?.LOG_LEVEL?.INFO) {
      console.info(`[RevenueCat] ${normalizedMessage}`);
    } else {
      console.debug(`[RevenueCat] ${normalizedMessage}`);
    }
  });
}

function getRevenueCatApiKey() {
  const extra: any = Constants.expoConfig?.extra ?? (Constants as any).manifest2?.extra ?? {};
  const rc = extra.revenueCat ?? {};
  if (Platform.OS === 'ios') return rc.iosApiKey || extra.revenueCatIosApiKey || null;
  if (Platform.OS === 'android') return rc.androidApiKey || extra.revenueCatAndroidApiKey || null;
  return null;
}

function getRevenueCatConfig() {
  const extra: any = Constants.expoConfig?.extra ?? (Constants as any).manifest2?.extra ?? {};
  const rc = extra.revenueCat ?? {};
  return {
    entitlementId: rc.entitlementId || 'RunTogether Pro',
    packageIds: {
      weekly: rc.packageIds?.weekly || rc.packageIds?.monthly || 'weekly',
      yearly: rc.packageIds?.yearly || 'yearly',
    },
    productIds: {
      weekly: rc.productIds?.weekly || '',
      yearly: rc.productIds?.yearly || '',
    },
  };
}

function summarizeError(error: any): string {
  if (!error) return 'unknown error';
  const message = error?.message ? String(error.message) : String(error);
  const code = error?.code !== undefined && error?.code !== null ? String(error.code) : '';
  const userInfo = error?.userInfo && typeof error.userInfo === 'object'
    ? JSON.stringify(error.userInfo)
    : '';
  return [message, code ? `code=${code}` : '', userInfo].filter(Boolean).join(' | ');
}

function getPurchasesUiModule(): PurchasesUIModule | null {
  if (purchasesUiModuleCache !== undefined) return purchasesUiModuleCache;
  if (Platform.OS === 'web' || isExpoGoRuntime() || !hasNativeRevenueCatModule()) {
    purchasesUiModuleCache = null;
    return purchasesUiModuleCache;
  }

  try {
    const mod = require('react-native-purchases-ui');
    purchasesUiModuleCache = mod?.default ?? mod;
  } catch {
    purchasesUiModuleCache = null;
  }
  return purchasesUiModuleCache;
}

function getCurrentRevenueCatOffering(offerings: any) {
  return offerings?.current || offerings?.all?.default || null;
}

function getAllRevenueCatPackages(offerings: any): any[] {
  const seen = new Set<string>();
  const result: any[] = [];

  const addPackages = (packages: any[] | undefined | null) => {
    if (!Array.isArray(packages)) return;
    for (const pkg of packages) {
      if (!pkg) continue;
      const key = String(
        pkg?.identifier ||
        pkg?.product?.identifier ||
        pkg?.product?.productIdentifier ||
        pkg?.storeProduct?.identifier ||
        pkg?.storeProduct?.productIdentifier ||
        `${result.length}`
      );
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(pkg);
    }
  };

  addPackages(offerings?.current?.availablePackages);
  addPackages(offerings?.all?.default?.availablePackages);

  if (offerings?.all && typeof offerings.all === 'object') {
    for (const offering of Object.values(offerings.all)) {
      addPackages((offering as any)?.availablePackages);
    }
  }

  return result;
}

function getPackageStringCandidates(pkg: any): string[] {
  const rawValues = [
    pkg?.identifier,
    pkg?.packageType,
    pkg?.product?.identifier,
    pkg?.product?.productIdentifier,
    pkg?.product?.id,
    pkg?.storeProduct?.identifier,
    pkg?.storeProduct?.productIdentifier,
    pkg?.storeProduct?.id,
  ];

  return rawValues
    .map((v) => String(v ?? '').trim().toLowerCase())
    .filter(Boolean);
}

function packageMatchesAliases(pkg: any, aliases: string[]) {
  const normalizedAliases = aliases.map((a) => a.toLowerCase());
  const candidates = getPackageStringCandidates(pkg);
  return candidates.some((candidate) =>
    normalizedAliases.some((alias) => candidate === alias || candidate.includes(alias))
  );
}

function packageMatchesSubscriptionPeriod(pkg: any, packageId: 'weekly' | 'yearly') {
  const period =
    pkg?.product?.subscriptionPeriod ||
    pkg?.storeProduct?.subscriptionPeriod ||
    null;

  if (!period) return false;

  const isoCandidate = String(period?.iso8601 ?? period ?? '').toLowerCase();
  const unitCandidate = String(period?.unit ?? '').toLowerCase();

  if (packageId === 'weekly') {
    return isoCandidate.includes('p1w') || unitCandidate.includes('week');
  }
  return isoCandidate.includes('p1y') || unitCandidate.includes('year');
}

function summarizeRevenueCatOfferings(offerings: any) {
  const allKeys = offerings?.all && typeof offerings.all === 'object'
    ? Object.keys(offerings.all)
    : [];
  const currentIdentifier = String(
    offerings?.current?.identifier ??
    offerings?.current?.serverDescription ??
    ''
  );
  const pkgs = getAllRevenueCatPackages(offerings);
  const packageSummaries = pkgs.map((p: any) => ({
    identifier: p?.identifier ?? null,
    packageType: p?.packageType ?? null,
    productId:
      p?.product?.identifier ??
      p?.product?.productIdentifier ??
      p?.storeProduct?.identifier ??
      p?.storeProduct?.productIdentifier ??
      null,
    price:
      p?.product?.priceString ??
      p?.storeProduct?.priceString ??
      null,
    period:
      p?.product?.subscriptionPeriod?.iso8601 ??
      p?.storeProduct?.subscriptionPeriod?.iso8601 ??
      p?.product?.subscriptionPeriod?.unit ??
      p?.storeProduct?.subscriptionPeriod?.unit ??
      null,
  }));

  return {
    hasOfferingsObject: !!offerings,
    currentOfferingIdentifier: currentIdentifier || null,
    offeringKeys: allKeys,
    packageCount: pkgs.length,
    packages: packageSummaries,
  };
}

function summarizePurchaseTarget(pkgOrProduct: any) {
  if (!pkgOrProduct) return null;

  return {
    packageIdentifier: pkgOrProduct?.identifier ?? null,
    packageType: pkgOrProduct?.packageType ?? null,
    productIdentifier:
      pkgOrProduct?.product?.identifier ??
      pkgOrProduct?.product?.productIdentifier ??
      pkgOrProduct?.storeProduct?.identifier ??
      pkgOrProduct?.storeProduct?.productIdentifier ??
      pkgOrProduct?.identifier ??
      null,
    title:
      pkgOrProduct?.product?.title ??
      pkgOrProduct?.storeProduct?.title ??
      null,
    price:
      pkgOrProduct?.product?.priceString ??
      pkgOrProduct?.storeProduct?.priceString ??
      null,
    subscriptionPeriod:
      pkgOrProduct?.product?.subscriptionPeriod ??
      pkgOrProduct?.storeProduct?.subscriptionPeriod ??
      null,
    introPrice:
      pkgOrProduct?.product?.introPrice ??
      pkgOrProduct?.storeProduct?.introPrice ??
      pkgOrProduct?.product?.introductoryPrice ??
      pkgOrProduct?.storeProduct?.introductoryPrice ??
      null,
  };
}

function summarizePurchaseError(error: any) {
  return {
    name: error?.name ?? null,
    code: error?.code ?? null,
    message: error?.message ?? null,
    readableErrorCode: error?.readableErrorCode ?? error?.userInfo?.readableErrorCode ?? null,
    underlyingErrorMessage: error?.underlyingErrorMessage ?? error?.userInfo?.underlyingErrorMessage ?? null,
    userCancelled: error?.userCancelled ?? error?.userInfo?.userCancelled ?? null,
    userInfo: error?.userInfo ?? null,
  };
}

function getActiveRunTogetherProEntitlement(customerInfo: any, entitlementId: string) {
  const active = customerInfo?.entitlements?.active ?? {};
  return active?.[entitlementId] || active?.['RunTogether Pro'] || active?.runtogether_pro || active?.premium || null;
}

async function cacheAccessSnapshot(snapshot: BillingAccessSnapshot | null) {
  if (!snapshot) {
    await AsyncStorage.removeItem(BILLING_ACCESS_CACHE_KEY);
    return;
  }
  await AsyncStorage.setItem(BILLING_ACCESS_CACHE_KEY, JSON.stringify(snapshot));
}

export async function clearEntitlementCache() {
  await AsyncStorage.removeItem(BILLING_ACCESS_CACHE_KEY);
}

async function loadCachedAccessSnapshot(): Promise<BillingAccessSnapshot | null> {
  const raw = await AsyncStorage.getItem(BILLING_ACCESS_CACHE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BillingAccessSnapshot;
  } catch {
    return null;
  }
}

async function safeParseJson<T = any>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function EntitlementProvider({ children }: { children: React.ReactNode }) {
  const { authFetch, isAuthenticated, loading: authLoading, user } = useAuth();
  const [access, setAccess] = useState<BillingAccessSnapshot | null>(null);
  const [offerings, setOfferings] = useState<any | null>(null);
  const [customerInfo, setCustomerInfo] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const configuredForUserRef = useRef<string | null>(null);
  const customerInfoListenerRef = useRef<((info: any) => void) | null>(null);
  const rcConfig = getRevenueCatConfig();

  const runTogetherProEntitlement = getActiveRunTogetherProEntitlement(customerInfo, rcConfig.entitlementId);
  const hasRunTogetherPro = !!runTogetherProEntitlement;
  const hasBackendAccess = !!access?.hasAccess;
  const hasAccess = hasBackendAccess || hasRunTogetherPro;
  const isRevenueCatAvailable = !!getPurchasesModule();

  const ensureRevenueCatConfigured = useCallback(async () => {
    const purchases = getPurchasesModule();
    const userId = user?.id as string | undefined;
    const apiKey = getRevenueCatApiKey();
    if (Platform.OS === 'web') return false;
    if (!purchases) {
      console.warn('[Entitlement] RevenueCat configure skipped: purchases module unavailable');
      return false;
    }
    if (!userId) {
      console.warn('[Entitlement] RevenueCat configure skipped: no authenticated user');
      return false;
    }
    if (!apiKey) {
      console.warn('[Entitlement] RevenueCat configure skipped: missing RevenueCat API key');
      return false;
    }
    configureRevenueCatLogHandler(purchases);
    if (configuredForUserRef.current === userId) return true;

    try {
      if (typeof purchases.setLogLevel === 'function' && purchases.LOG_LEVEL) {
        purchases.setLogLevel(__DEV__ ? purchases.LOG_LEVEL.DEBUG : purchases.LOG_LEVEL.WARN);
      }

      if (typeof purchases.configure === 'function') {
        await Promise.resolve(purchases.configure({ apiKey, appUserID: `user_${userId}` }));
        configureRevenueCatLogHandler(purchases);
      } else {
        console.warn('[Entitlement] RevenueCat configure skipped: configure() unavailable on SDK module');
        return false;
      }

      if (!customerInfoListenerRef.current && typeof purchases.addCustomerInfoUpdateListener === 'function') {
        const listener = (info: any) => setCustomerInfo(info);
        purchases.addCustomerInfoUpdateListener(listener);
        customerInfoListenerRef.current = listener;
      }
      configuredForUserRef.current = userId;
      return true;
    } catch (e) {
      console.warn('[Entitlement] RevenueCat configure failed', e);
      return false;
    }
  }, [user?.id]);

  const fetchOfferings = useCallback(async () => {
    const purchases = getPurchasesModule();
    if (!purchases || Platform.OS === 'web') {
      setOfferings(null);
      return;
    }
    try {
      const configured = await ensureRevenueCatConfigured();
      if (!configured) {
        setOfferings(null);
        return;
      }
      if (typeof purchases.getOfferings === 'function') {
        const nextOfferings = await purchases.getOfferings();
        setOfferings(nextOfferings ?? null);
      }
    } catch (e) {
      console.warn('[Entitlement] Failed to fetch offerings', e);
    }
  }, [ensureRevenueCatConfigured]);

  const refreshCustomerInfo = useCallback(async () => {
    const purchases = getPurchasesModule();
    if (!purchases || Platform.OS === 'web') {
      setCustomerInfo(null);
      return;
    }

    try {
      const configured = await ensureRevenueCatConfigured();
      if (!configured) {
        setCustomerInfo(null);
        return;
      }
      if (typeof purchases.getCustomerInfo === 'function') {
        const info = await purchases.getCustomerInfo();
        setCustomerInfo(info ?? null);
      }
    } catch (e) {
      console.warn('[Entitlement] Failed to fetch customer info', e);
    }
  }, [ensureRevenueCatConfigured]);

  const refreshAccess = useCallback(async (_opts?: { syncRevenueCat?: boolean }) => {
    if (!isAuthenticated) {
      setAccess(null);
      setLoading(false);
      setError(null);
      await clearEntitlementCache();
      return;
    }

    if (!user?.id) {
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const endpoint = _opts?.syncRevenueCat ? `${API_BASE_URL}/billing/refresh` : `${API_BASE_URL}/billing/access`;
      const res = await authFetch(endpoint, _opts?.syncRevenueCat ? { method: 'POST' } : undefined);
      const data = await safeParseJson<{ billing?: BillingAccessSnapshot }>(res);

      if (!res.ok) {
        throw new Error(data && (data as any).message ? (data as any).message : 'Failed to fetch billing access');
      }

      const snapshot = data?.billing ?? null;
      setAccess(snapshot);
      await cacheAccessSnapshot(snapshot);
    } catch (e) {
      const cached = await loadCachedAccessSnapshot();
      if (cached) setAccess(cached);
      setError(e instanceof Error ? e.message : 'Failed to refresh access');
    }

    try {
      await ensureRevenueCatConfigured();
      await Promise.all([fetchOfferings(), refreshCustomerInfo()]);
    } catch (e) {
      console.warn('[Entitlement] Failed to refresh RevenueCat client state', e);
    } finally {
      setLoading(false);
    }
  }, [authFetch, ensureRevenueCatConfigured, fetchOfferings, isAuthenticated, refreshCustomerInfo, user?.id]);

  const syncRevenueCatAndRefresh = useCallback(async () => {
    if (!isAuthenticated) return;
    const res = await authFetch(`${API_BASE_URL}/billing/refresh`, { method: 'POST' });
    const data = await safeParseJson<{ billing?: BillingAccessSnapshot; message?: string }>(res);
    if (!res.ok) {
      throw new Error(data?.message || 'Failed to sync purchases');
    }
    if (data?.billing) {
      setAccess(data.billing);
      await cacheAccessSnapshot(data.billing);
    } else {
      await refreshAccess();
    }
  }, [authFetch, isAuthenticated, refreshAccess]);

  const startTrial = useCallback(async () => {
    const res = await authFetch(`${API_BASE_URL}/billing/trial/start`, { method: 'POST' });
    const data = await safeParseJson<{ billing?: BillingAccessSnapshot; message?: string }>(res);
    if (!res.ok) throw new Error(data?.message || 'Failed to start trial');
    if (data?.billing) {
      setAccess(data.billing);
      await cacheAccessSnapshot(data.billing);
    } else {
      await refreshAccess();
    }
  }, [authFetch, refreshAccess]);

  const purchase = useCallback(async (pkg: any) => {
    const purchases = getPurchasesModule();
    if (!purchases) throw new Error('RevenueCat SDK is not installed');
    const configured = await ensureRevenueCatConfigured();
    if (!configured) {
      throw new Error('RevenueCat is not configured yet. Sign in first and use a native dev build (not Expo Go).');
    }
    if (!pkg) throw new Error('No package selected');

    if (typeof purchases.purchasePackage !== 'function') {
      throw new Error('RevenueCat purchasePackage is unavailable');
    }
    try {
      console.log('[Entitlement] Starting RevenueCat purchase', summarizePurchaseTarget(pkg));
      const result = await purchases.purchasePackage(pkg);
      if (result?.customerInfo) {
        setCustomerInfo(result.customerInfo);
        const activeEntitlement = getActiveRunTogetherProEntitlement(result.customerInfo, rcConfig.entitlementId);
        if (activeEntitlement) {
          syncRevenueCatAndRefresh().catch((e) => {
            console.warn('[Entitlement] Purchased entitlement is active, but backend RevenueCat sync failed', e);
          });
          return;
        }
      }
    } catch (e: any) {
      const cancelled =
        e?.userCancelled === true ||
        e?.code === purchases?.PURCHASES_ERROR_CODE?.PURCHASE_CANCELLED_ERROR ||
        e?.code === '1';
      if (cancelled) {
        console.warn('[Entitlement] RevenueCat purchase cancelled', {
          target: summarizePurchaseTarget(pkg),
          error: summarizePurchaseError(e),
        });
        return;
      }
      console.warn('[Entitlement] RevenueCat purchase failed', {
        target: summarizePurchaseTarget(pkg),
        error: summarizePurchaseError(e),
      });
      throw e;
    }
    await syncRevenueCatAndRefresh();
  }, [ensureRevenueCatConfigured, rcConfig.entitlementId, syncRevenueCatAndRefresh]);

  const purchaseByProductId = useCallback(async (productId: string) => {
    const purchases = getPurchasesModule();
    if (!purchases) throw new Error('RevenueCat SDK is not installed');
    const configured = await ensureRevenueCatConfigured();
    if (!configured) {
      throw new Error('RevenueCat is not configured yet. Sign in first and use a native dev build (not Expo Go).');
    }

    const normalized = String(productId || '').trim();
    if (!normalized) throw new Error('No productId configured for direct purchase');

    try {
      if (typeof purchases.purchaseProduct === 'function') {
        console.log('[Entitlement] Starting RevenueCat product purchase', { productId: normalized });
        const result = await purchases.purchaseProduct(normalized);
        if (result?.customerInfo) {
          setCustomerInfo(result.customerInfo);
          const activeEntitlement = getActiveRunTogetherProEntitlement(result.customerInfo, rcConfig.entitlementId);
          if (activeEntitlement) {
            syncRevenueCatAndRefresh().catch((e) => {
              console.warn('[Entitlement] Purchased entitlement is active, but backend RevenueCat sync failed', e);
            });
            return;
          }
        }
      } else if (typeof purchases.purchaseStoreProduct === 'function') {
        console.log('[Entitlement] Starting RevenueCat store product purchase', { productId: normalized });
        const result = await purchases.purchaseStoreProduct(normalized);
        if (result?.customerInfo) {
          setCustomerInfo(result.customerInfo);
          const activeEntitlement = getActiveRunTogetherProEntitlement(result.customerInfo, rcConfig.entitlementId);
          if (activeEntitlement) {
            syncRevenueCatAndRefresh().catch((e) => {
              console.warn('[Entitlement] Purchased entitlement is active, but backend RevenueCat sync failed', e);
            });
            return;
          }
        }
      } else {
        throw new Error('RevenueCat purchaseProduct API is unavailable');
      }
    } catch (e: any) {
      const cancelled =
        e?.userCancelled === true ||
        e?.code === purchases?.PURCHASES_ERROR_CODE?.PURCHASE_CANCELLED_ERROR ||
        e?.code === '1';
      if (cancelled) {
        console.warn('[Entitlement] RevenueCat product purchase cancelled', {
          productId: normalized,
          error: summarizePurchaseError(e),
        });
        return;
      }
      console.warn('[Entitlement] RevenueCat product purchase failed', {
        productId: normalized,
        error: summarizePurchaseError(e),
      });
      throw e;
    }

    await syncRevenueCatAndRefresh();
  }, [ensureRevenueCatConfigured, rcConfig.entitlementId, syncRevenueCatAndRefresh]);

  const runRevenueCatDiagnostics = useCallback(async () => {
    const purchases = getPurchasesModule();
    if (!purchases) return 'Diagnostics: RevenueCat SDK not available in this runtime.';
    const configured = await ensureRevenueCatConfigured();
    if (!configured) return 'Diagnostics: RevenueCat SDK not configured. Check auth state and SDK key.';

    const lines: string[] = [];
    lines.push(`platform=${Platform.OS}`);
    lines.push(`appUserId=${configuredForUserRef.current || 'unknown'}`);
    lines.push(`package.weekly=${rcConfig.packageIds.weekly}`);
    lines.push(`package.yearly=${rcConfig.packageIds.yearly}`);
    lines.push(`product.weekly=${rcConfig.productIds.weekly || '(not set)'}`);
    lines.push(`product.yearly=${rcConfig.productIds.yearly || '(not set)'}`);

    if (typeof purchases.getOfferings === 'function') {
      try {
        const latestOfferings = await purchases.getOfferings();
        setOfferings(latestOfferings ?? null);
        const summary = summarizeRevenueCatOfferings(latestOfferings);
        lines.push(`offerings.current=${summary.currentOfferingIdentifier || 'none'}`);
        lines.push(`offerings.keys=${summary.offeringKeys.join('|') || 'none'}`);
        lines.push(`offerings.packageCount=${String(summary.packageCount)}`);
      } catch (e: any) {
        lines.push(`offerings.error=${summarizeError(e)}`);
      }
    } else {
      lines.push('offerings.error=getOfferings API unavailable');
    }

    const directIds = [rcConfig.productIds.weekly, rcConfig.productIds.yearly]
      .map((id) => String(id || '').trim())
      .filter(Boolean);

    if (directIds.length > 0 && typeof purchases.getProducts === 'function') {
      try {
        const category =
          purchases.PRODUCT_CATEGORY?.SUBSCRIPTION ||
          purchases.PURCHASE_TYPE?.SUBS ||
          'SUBSCRIPTION';
        const products = await purchases.getProducts(directIds, category);
        const fetchedIds = Array.isArray(products)
          ? products.map((p: any) => p?.identifier || p?.productIdentifier || '').filter(Boolean)
          : [];
        lines.push(`storeProducts.requested=${directIds.join('|')}`);
        lines.push(`storeProducts.fetched=${fetchedIds.join('|') || 'none'}`);
      } catch (e: any) {
        lines.push(`storeProducts.error=${summarizeError(e)}`);
      }
    } else if (directIds.length === 0) {
      lines.push('storeProducts.skipped=no productIds configured in app config');
    } else {
      lines.push('storeProducts.skipped=getProducts API unavailable');
    }

    return lines.join('\n');
  }, [ensureRevenueCatConfigured, rcConfig.packageIds.weekly, rcConfig.packageIds.yearly, rcConfig.productIds.weekly, rcConfig.productIds.yearly]);

  const purchaseByPackageId = useCallback(async (packageId: 'weekly' | 'yearly') => {
    const purchases = getPurchasesModule();
    if (!purchases) throw new Error('RevenueCat SDK is not installed');
    const configured = await ensureRevenueCatConfigured();
    if (!configured) {
      throw new Error('RevenueCat is not configured yet. Sign in first and use a native dev build (not Expo Go).');
    }

    let latestOfferings = offerings;
    let pkgs: any[] = getAllRevenueCatPackages(latestOfferings);

    // Refresh offerings on demand so button taps do not depend on stale initial state.
    if (pkgs.length === 0 && typeof purchases.getOfferings === 'function') {
      try {
        const fetched = await purchases.getOfferings();
        if (fetched) {
          latestOfferings = fetched;
          setOfferings(fetched);
          pkgs = getAllRevenueCatPackages(fetched);
        }
      } catch (err: any) {
        const reason = summarizeError(err);
        const fallbackProductId = String(rcConfig.productIds[packageId] || '').trim();
        if (fallbackProductId) {
          await purchaseByProductId(fallbackProductId);
          return;
        }
        throw new Error(`Failed to load RevenueCat offerings before purchase (${reason}). Check internet connection and SDK config.`);
      }
    }

    const targetId = String(rcConfig.packageIds[packageId] || '').toLowerCase();
    const builtInId =
      packageId === 'weekly' ? '$rc_weekly' :
      '$rc_annual';

    const packageTypeAliases =
      packageId === 'weekly'
        ? ['weekly']
        : ['annual', 'yearly'];

    const pkg =
      pkgs.find((p: any) => String(p?.identifier || '').toLowerCase() === targetId) ||
      pkgs.find((p: any) => String(p?.identifier || '').toLowerCase() === builtInId) ||
      pkgs.find((p: any) => packageMatchesAliases(p, [targetId, builtInId, ...packageTypeAliases])) ||
      pkgs.find((p: any) => packageMatchesSubscriptionPeriod(p, packageId));

    if (!pkg) {
      const fallbackProductId = String(rcConfig.productIds[packageId] || '').trim();
      if (fallbackProductId) {
        await purchaseByProductId(fallbackProductId);
        return;
      }
      const summary = summarizeRevenueCatOfferings(latestOfferings);
      const available = summary.packages
        .map((p) => [p.identifier, p.productId, p.packageType, p.period].filter(Boolean).join('|'))
        .filter(Boolean)
        .join(', ');
      const guidance =
        summary.packageCount === 0
          ? 'No packages loaded. Possible causes: no internet, SDK not initialized in this native build, or no active/default offering in RevenueCat.'
          : `Packages loaded but none matched "${packageId}". Check app.json packageIds vs RevenueCat package identifiers.`;
      throw new Error(
        `${packageId} package not found. ${guidance} targetId=${targetId || '(empty)'} builtIn=${builtInId} currentOffering=${summary.currentOfferingIdentifier || 'none'} offerings=${summary.offeringKeys.join('|') || 'none'} packageCount=${summary.packageCount}${available ? ` available=${available}` : ''}`
      );
    }
    await purchase(pkg);
  }, [ensureRevenueCatConfigured, offerings, purchase, purchaseByProductId, rcConfig.packageIds, rcConfig.productIds]);

  const restorePurchases = useCallback(async () => {
    const purchases = getPurchasesModule();
    if (!purchases) throw new Error('RevenueCat SDK is not installed');
    const configured = await ensureRevenueCatConfigured();
    if (!configured) {
      throw new Error('RevenueCat is not configured yet. Sign in first and use a native dev build (not Expo Go).');
    }
    if (typeof purchases.restorePurchases === 'function') {
      const info = await purchases.restorePurchases();
      setCustomerInfo(info ?? null);
    }
    await syncRevenueCatAndRefresh();
  }, [ensureRevenueCatConfigured, syncRevenueCatAndRefresh]);

  const presentRevenueCatPaywall = useCallback(async () => {
    const PurchasesUI = getPurchasesUiModule();
    const purchases = getPurchasesModule();
    if (!PurchasesUI) throw new Error('RevenueCat Paywalls UI is unavailable in this build');
    const configured = await ensureRevenueCatConfigured();
    if (!configured) throw new Error('RevenueCat is not configured yet. Sign in first and use a native dev build (not Expo Go).');
    let offeringToPresent = getCurrentRevenueCatOffering(offerings);
    if (!offeringToPresent && purchases && typeof purchases.getOfferings === 'function') {
      const latestOfferings = await purchases.getOfferings();
      setOfferings(latestOfferings ?? null);
      offeringToPresent = getCurrentRevenueCatOffering(latestOfferings);
    }
    if (!offeringToPresent) {
      throw new Error('No RevenueCat paywall offering found. Configure a default offering in RevenueCat.');
    }

    const uiObject =
      (typeof PurchasesUI.presentPaywall === 'function' && PurchasesUI) ||
      (typeof PurchasesUI.PurchasesUI?.presentPaywall === 'function' && PurchasesUI.PurchasesUI) ||
      (typeof PurchasesUI.default?.presentPaywall === 'function' && PurchasesUI.default);
    if (!uiObject || typeof uiObject.presentPaywall !== 'function') {
      throw new Error('RevenueCat presentPaywall API not available');
    }

    const result = await uiObject.presentPaywall({ offering: offeringToPresent });
    await Promise.all([refreshCustomerInfo(), syncRevenueCatAndRefresh().catch(() => {})]);
    return result;
  }, [ensureRevenueCatConfigured, offerings, refreshCustomerInfo, syncRevenueCatAndRefresh]);

  const presentRevenueCatPaywallIfNeeded = useCallback(async () => {
    const PurchasesUI = getPurchasesUiModule();
    const purchases = getPurchasesModule();
    if (!PurchasesUI) throw new Error('RevenueCat Paywalls UI is unavailable in this build');
    const configured = await ensureRevenueCatConfigured();
    if (!configured) throw new Error('RevenueCat is not configured yet. Sign in first and use a native dev build (not Expo Go).');
    let offeringToPresent = getCurrentRevenueCatOffering(offerings);
    if (!offeringToPresent && purchases && typeof purchases.getOfferings === 'function') {
      const latestOfferings = await purchases.getOfferings();
      setOfferings(latestOfferings ?? null);
      offeringToPresent = getCurrentRevenueCatOffering(latestOfferings);
    }

    const uiObject =
      (typeof PurchasesUI.presentPaywallIfNeeded === 'function' && PurchasesUI) ||
      (typeof PurchasesUI.PurchasesUI?.presentPaywallIfNeeded === 'function' && PurchasesUI.PurchasesUI) ||
      (typeof PurchasesUI.default?.presentPaywallIfNeeded === 'function' && PurchasesUI.default);
    if (!uiObject || typeof uiObject.presentPaywallIfNeeded !== 'function') {
      throw new Error('RevenueCat presentPaywallIfNeeded API not available');
    }

    const result = await uiObject.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: rcConfig.entitlementId,
      offering: offeringToPresent ?? undefined,
    });
    await Promise.all([refreshCustomerInfo(), syncRevenueCatAndRefresh().catch(() => {})]);
    return result;
  }, [ensureRevenueCatConfigured, offerings, rcConfig.entitlementId, refreshCustomerInfo, syncRevenueCatAndRefresh]);

  const openCustomerCenter = useCallback(async () => {
    const PurchasesUI = getPurchasesUiModule();
    if (!PurchasesUI) throw new Error('RevenueCat Customer Center UI is unavailable in this build');
    const configured = await ensureRevenueCatConfigured();
    if (!configured) throw new Error('RevenueCat is not configured yet. Sign in first and use a native dev build (not Expo Go).');

    const presentCustomerCenter =
      PurchasesUI.presentCustomerCenter ||
      PurchasesUI.PurchasesUI?.presentCustomerCenter ||
      PurchasesUI.default?.presentCustomerCenter;
    if (typeof presentCustomerCenter !== 'function') {
      throw new Error('RevenueCat presentCustomerCenter API not available');
    }

    await presentCustomerCenter();
    await Promise.all([refreshCustomerInfo(), syncRevenueCatAndRefresh().catch(() => {})]);
  }, [ensureRevenueCatConfigured, refreshCustomerInfo, syncRevenueCatAndRefresh]);

  const openManageSubscriptions = useCallback(async () => {
    const purchases = getPurchasesModule();
    if (purchases && typeof purchases.showManageSubscriptions === 'function') {
      try {
        await ensureRevenueCatConfigured();
        await purchases.showManageSubscriptions();
        return;
      } catch (e) {
        console.warn('[Entitlement] RevenueCat showManageSubscriptions failed, falling back', e);
      }
    }

    const url =
      Platform.OS === 'ios'
        ? 'https://apps.apple.com/account/subscriptions'
        : 'https://play.google.com/store/account/subscriptions';
    await Linking.openURL(url);
  }, [ensureRevenueCatConfigured]);

  useEffect(() => {
    let active = true;
    loadCachedAccessSnapshot()
      .then((cached) => {
        if (active && cached) setAccess(cached);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (authLoading) return;
    refreshAccess({ syncRevenueCat: true }).catch((e) => setError(e instanceof Error ? e.message : 'Failed to refresh access'));
  }, [authLoading, refreshAccess]);

  useEffect(() => {
    if (!isAuthenticated) {
      configuredForUserRef.current = null;
      setOfferings(null);
      setCustomerInfo(null);
      setAccess(null);
      setError(null);
      setLoading(false);
      clearEntitlementCache().catch(() => {});
      return;
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    if (!hasRunTogetherPro || hasBackendAccess) return;

    syncRevenueCatAndRefresh().catch((e) => {
      console.warn('[Entitlement] Failed to backfill billing snapshot from active RevenueCat entitlement', e);
    });
  }, [hasBackendAccess, hasRunTogetherPro, isAuthenticated, syncRevenueCatAndRefresh, user?.id]);

  useEffect(() => {
    return () => {
      const purchases = getPurchasesModule();
      const listener = customerInfoListenerRef.current;
      if (purchases && listener && typeof purchases.removeCustomerInfoUpdateListener === 'function') {
        try {
          purchases.removeCustomerInfoUpdateListener(listener);
        } catch {}
      }
      customerInfoListenerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onStateChange = (state: AppStateStatus) => {
      if (state === 'active' && isAuthenticated && user?.id) {
        refreshAccess({ syncRevenueCat: true }).catch(() => {});
      }
    };
    const sub = AppState.addEventListener('change', onStateChange);
    return () => sub.remove();
  }, [isAuthenticated, refreshAccess, user?.id]);

  const value = useMemo<EntitlementContextValue>(() => ({
    access,
    loading,
    hasAccess,
    isRevenueCatAvailable,
    offerings,
    customerInfo,
    hasRunTogetherPro,
    runTogetherProEntitlement,
    error,
    startTrial,
    purchase,
    purchaseByPackageId,
    purchaseByProductId,
    runRevenueCatDiagnostics,
    restorePurchases,
    refreshAccess,
    refreshCustomerInfo,
    presentRevenueCatPaywall,
    presentRevenueCatPaywallIfNeeded,
    openCustomerCenter,
    openManageSubscriptions,
  }), [
    access,
    loading,
    hasAccess,
    isRevenueCatAvailable,
    offerings,
    customerInfo,
    hasRunTogetherPro,
    runTogetherProEntitlement,
    error,
    startTrial,
    purchase,
    purchaseByPackageId,
    purchaseByProductId,
    runRevenueCatDiagnostics,
    restorePurchases,
    refreshAccess,
    refreshCustomerInfo,
    presentRevenueCatPaywall,
    presentRevenueCatPaywallIfNeeded,
    openCustomerCenter,
    openManageSubscriptions,
  ]);

  return <EntitlementContext.Provider value={value}>{children}</EntitlementContext.Provider>;
}

export function useEntitlement() {
  const ctx = useContext(EntitlementContext);
  if (!ctx) {
    throw new Error('useEntitlement must be used within EntitlementProvider');
  }
  return ctx;
}
