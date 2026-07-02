export type BillingAccessSnapshot = {
  accessStatus: string;
  hasAccess: boolean;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  premiumEntitlementActive: boolean;
  premiumIsLifetime: boolean;
  premiumExpiresAt: string | null;
  lastSyncedAt: string | null;
  accessSource: 'self' | 'partner';
  sharedByPartnerId?: string | null;
  sharedByPartnerName?: string | null;
  sharedAccessEndsAt?: string | null;
  paywallReason?: string | null;
  revenueCatAppUserId?: string | null;
};

export type PremiumRequiredError = {
  code: 'PREMIUM_REQUIRED';
  message?: string;
  billing?: BillingAccessSnapshot;
  paywallReason?: string;
};

export type EntitlementContextValue = {
  access: BillingAccessSnapshot | null;
  loading: boolean;
  hasAccess: boolean;
  isRevenueCatAvailable: boolean;
  offerings: any | null;
  customerInfo: any | null;
  hasRunTogetherPro: boolean;
  runTogetherProEntitlement: any | null;
  error: string | null;
  startTrial: () => Promise<void>;
  purchase: (pkg: any) => Promise<void>;
  purchaseByPackageId: (packageId: 'weekly' | 'yearly') => Promise<void>;
  purchaseByProductId: (productId: string) => Promise<void>;
  runRevenueCatDiagnostics: () => Promise<string>;
  restorePurchases: () => Promise<void>;
  refreshAccess: (opts?: { syncRevenueCat?: boolean }) => Promise<void>;
  refreshCustomerInfo: () => Promise<void>;
  presentRevenueCatPaywall: () => Promise<any>;
  presentRevenueCatPaywallIfNeeded: () => Promise<any>;
  openCustomerCenter: () => Promise<void>;
  openManageSubscriptions: () => Promise<void>;
};
