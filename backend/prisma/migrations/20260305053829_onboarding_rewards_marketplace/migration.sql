-- CreateEnum
CREATE TYPE "MarketplaceItemSource" AS ENUM ('DEFAULT', 'USER_CUSTOM', 'ONBOARDING');

-- AlterTable
ALTER TABLE "MarketplaceItem" ADD COLUMN     "source" "MarketplaceItemSource" NOT NULL DEFAULT 'DEFAULT';

-- CreateTable
CREATE TABLE "OnboardingRewardPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "week1RewardId" TEXT,
    "week2RewardId" TEXT,
    "week3RewardId" TEXT,
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingRewardPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingRewardPreference_userId_key" ON "OnboardingRewardPreference"("userId");

-- CreateIndex
CREATE INDEX "MarketplaceItem_source_pairKey_isActive_idx" ON "MarketplaceItem"("source", "pairKey", "isActive");

-- AddForeignKey
ALTER TABLE "OnboardingRewardPreference" ADD CONSTRAINT "OnboardingRewardPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
