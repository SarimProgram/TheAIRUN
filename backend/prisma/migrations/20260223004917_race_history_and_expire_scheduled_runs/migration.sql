-- AlterEnum
ALTER TYPE "RunTogetherStatus" ADD VALUE 'EXPIRED';

-- CreateTable
CREATE TABLE "RaceResult" (
    "id" TEXT NOT NULL,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "winnerUserId" TEXT NOT NULL,
    "winnerName" TEXT NOT NULL,
    "distanceKm" DOUBLE PRECISION NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "finishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RaceResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RaceResult_userAId_finishedAt_idx" ON "RaceResult"("userAId", "finishedAt");

-- CreateIndex
CREATE INDEX "RaceResult_userBId_finishedAt_idx" ON "RaceResult"("userBId", "finishedAt");

-- CreateIndex
CREATE INDEX "RaceResult_winnerUserId_finishedAt_idx" ON "RaceResult"("winnerUserId", "finishedAt");

-- AddForeignKey
ALTER TABLE "RaceResult" ADD CONSTRAINT "RaceResult_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaceResult" ADD CONSTRAINT "RaceResult_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaceResult" ADD CONSTRAINT "RaceResult_winnerUserId_fkey" FOREIGN KEY ("winnerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
