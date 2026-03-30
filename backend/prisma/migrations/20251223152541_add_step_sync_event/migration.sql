-- AlterTable
ALTER TABLE "DailyTarget" ADD COLUMN     "eveningCompleted" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "morningCompleted" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "nightCompleted" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "StepSyncEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StepSyncEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StepSyncEvent_userId_dayKey_idx" ON "StepSyncEvent"("userId", "dayKey");

-- CreateIndex
CREATE UNIQUE INDEX "StepSyncEvent_userId_eventId_key" ON "StepSyncEvent"("userId", "eventId");
