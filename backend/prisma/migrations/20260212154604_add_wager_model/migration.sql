-- CreateEnum
CREATE TYPE "WagerStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED', 'DECLINED');

-- CreateTable
CREATE TABLE "Wager" (
    "id" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "WagerStatus" NOT NULL DEFAULT 'PENDING',
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wager_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Wager_fromUserId_status_idx" ON "Wager"("fromUserId", "status");

-- CreateIndex
CREATE INDEX "Wager_toUserId_status_idx" ON "Wager"("toUserId", "status");

-- AddForeignKey
ALTER TABLE "Wager" ADD CONSTRAINT "Wager_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wager" ADD CONSTRAINT "Wager_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
