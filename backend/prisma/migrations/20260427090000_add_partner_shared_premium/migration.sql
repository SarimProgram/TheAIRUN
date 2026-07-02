ALTER TYPE "BillingAccessStatus" ADD VALUE IF NOT EXISTS 'PARTNER_INCLUDED_ACTIVE';
ALTER TYPE "BillingAccessStatus" ADD VALUE IF NOT EXISTS 'PARTNER_INCLUDED_GRACE';

ALTER TABLE "BillingProfile"
ADD COLUMN "sharedAccessSourceUserId" TEXT,
ADD COLUMN "sharedAccessStartedAt" TIMESTAMP(3),
ADD COLUMN "sharedAccessEndsAt" TIMESTAMP(3),
ADD COLUMN "sharedAccessRevokedAt" TIMESTAMP(3);

CREATE INDEX "BillingProfile_sharedAccessSourceUserId_idx" ON "BillingProfile"("sharedAccessSourceUserId");
CREATE INDEX "BillingProfile_sharedAccessEndsAt_idx" ON "BillingProfile"("sharedAccessEndsAt");
