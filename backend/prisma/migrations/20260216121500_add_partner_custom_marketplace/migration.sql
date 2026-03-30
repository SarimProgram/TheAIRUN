-- AlterTable
ALTER TABLE "MarketplaceItem"
ADD COLUMN "createdByUserId" TEXT,
ADD COLUMN "description" TEXT,
ADD COLUMN "isCustom" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "pairKey" TEXT;

-- CreateIndex
CREATE INDEX "MarketplaceItem_pairKey_isActive_idx" ON "MarketplaceItem"("pairKey", "isActive");

-- CreateIndex
CREATE INDEX "MarketplaceItem_createdByUserId_idx" ON "MarketplaceItem"("createdByUserId");

-- AddForeignKey
ALTER TABLE "MarketplaceItem"
ADD CONSTRAINT "MarketplaceItem_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId")
REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
