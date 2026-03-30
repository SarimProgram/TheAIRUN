-- CreateEnum
CREATE TYPE "BillingAccessStatus" AS ENUM ('NONE', 'TRIAL_ACTIVE', 'TRIAL_EXPIRED', 'PREMIUM_ACTIVE', 'PREMIUM_GRACE', 'MANUAL_OVERRIDE');

-- CreateEnum
CREATE TYPE "BillingPlatform" AS ENUM ('IOS', 'ANDROID', 'UNKNOWN');

-- CreateTable
CREATE TABLE "BillingProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "revenueCatAppUserId" TEXT NOT NULL,
    "trialStartedAt" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "trialConsumed" BOOLEAN NOT NULL DEFAULT false,
    "premiumEntitlementActive" BOOLEAN NOT NULL DEFAULT false,
    "premiumAccessStatus" "BillingAccessStatus" NOT NULL DEFAULT 'NONE',
    "premiumProductId" TEXT,
    "premiumPlatform" "BillingPlatform",
    "premiumPurchasedAt" TIMESTAMP(3),
    "premiumExpiresAt" TIMESTAMP(3),
    "premiumWillRenew" BOOLEAN,
    "premiumIsLifetime" BOOLEAN NOT NULL DEFAULT false,
    "gracePeriodEndsAt" TIMESTAMP(3),
    "lastRevenueCatEventId" TEXT,
    "lastRevenueCatEventAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "manualAccessOverride" BOOLEAN NOT NULL DEFAULT false,
    "manualOverrideEndsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingWebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "appUserId" TEXT,
    "userId" TEXT,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "processingError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillingProfile_userId_key" ON "BillingProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingProfile_revenueCatAppUserId_key" ON "BillingProfile"("revenueCatAppUserId");

-- CreateIndex
CREATE INDEX "BillingProfile_premiumAccessStatus_idx" ON "BillingProfile"("premiumAccessStatus");

-- CreateIndex
CREATE INDEX "BillingProfile_trialEndsAt_idx" ON "BillingProfile"("trialEndsAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillingWebhookEvent_externalEventId_key" ON "BillingWebhookEvent"("externalEventId");

-- CreateIndex
CREATE INDEX "BillingWebhookEvent_provider_createdAt_idx" ON "BillingWebhookEvent"("provider", "createdAt");

-- CreateIndex
CREATE INDEX "BillingWebhookEvent_userId_idx" ON "BillingWebhookEvent"("userId");

-- CreateIndex
CREATE INDEX "BillingWebhookEvent_appUserId_idx" ON "BillingWebhookEvent"("appUserId");

-- AddForeignKey
ALTER TABLE "BillingProfile" ADD CONSTRAINT "BillingProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingWebhookEvent" ADD CONSTRAINT "BillingWebhookEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
