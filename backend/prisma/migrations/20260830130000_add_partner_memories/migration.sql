-- CreateTable
CREATE TABLE "PartnerMemory" (
    "id" TEXT NOT NULL,
    "pairKey" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "caption" TEXT,
    "imageMime" TEXT NOT NULL,
    "imagePath" TEXT,
    "imageSizeBytes" INTEGER NOT NULL,
    "imageExpiresAt" TIMESTAMP(3),
    "imageDeletedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerMemorySync" (
    "id" TEXT NOT NULL,
    "memoryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "downloadedAt" TIMESTAMP(3),
    "ackedAt" TIMESTAMP(3),

    CONSTRAINT "PartnerMemorySync_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartnerMemory_pairKey_createdAt_idx" ON "PartnerMemory"("pairKey", "createdAt");

-- CreateIndex
CREATE INDEX "PartnerMemory_authorUserId_idx" ON "PartnerMemory"("authorUserId");

-- CreateIndex
CREATE INDEX "PartnerMemory_recipientUserId_idx" ON "PartnerMemory"("recipientUserId");

-- CreateIndex
CREATE INDEX "PartnerMemorySync_userId_idx" ON "PartnerMemorySync"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerMemorySync_memoryId_userId_key" ON "PartnerMemorySync"("memoryId", "userId");

-- AddForeignKey
ALTER TABLE "PartnerMemory" ADD CONSTRAINT "PartnerMemory_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerMemory" ADD CONSTRAINT "PartnerMemory_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerMemorySync" ADD CONSTRAINT "PartnerMemorySync_memoryId_fkey" FOREIGN KEY ("memoryId") REFERENCES "PartnerMemory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerMemorySync" ADD CONSTRAINT "PartnerMemorySync_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
