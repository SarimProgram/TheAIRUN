-- CreateTable
CREATE TABLE "DailyPointsLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "earnedPoints" INTEGER NOT NULL,
    "maxPoints" INTEGER NOT NULL,
    "progress" DOUBLE PRECISION NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyPointsLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyPointsLedger_userId_dayKey_idx" ON "DailyPointsLedger"("userId", "dayKey");

-- CreateIndex
CREATE UNIQUE INDEX "DailyPointsLedger_userId_dayKey_category_key" ON "DailyPointsLedger"("userId", "dayKey", "category");

-- AddForeignKey
ALTER TABLE "DailyPointsLedger" ADD CONSTRAINT "DailyPointsLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
