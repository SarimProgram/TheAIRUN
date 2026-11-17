CREATE TYPE "CoupleChallengeType" AS ENUM ('FIRST_TO_100K', 'MOST_STEPS_WEEK');
CREATE TYPE "CoupleChallengeStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED', 'DECLINED', 'CANCELLED');

CREATE TABLE "Couple" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Couple_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CoupleChallenge" (
    "id" TEXT NOT NULL,
    "challengerCoupleId" TEXT NOT NULL,
    "opponentCoupleId" TEXT NOT NULL,
    "type" "CoupleChallengeType" NOT NULL,
    "prize" TEXT NOT NULL,
    "status" "CoupleChallengeStatus" NOT NULL DEFAULT 'PENDING',
    "createdByUserId" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "startDayKey" TEXT,
    "endDayKey" TEXT,
    "endsAt" TIMESTAMP(3),
    "timezone" TEXT,
    "baselines" JSONB,
    "winnerCoupleId" TEXT,
    "isTie" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CoupleChallenge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Couple_code_key" ON "Couple"("code");
CREATE UNIQUE INDEX "Couple_userAId_userBId_key" ON "Couple"("userAId", "userBId");
CREATE INDEX "Couple_userBId_idx" ON "Couple"("userBId");
CREATE INDEX "CoupleChallenge_challengerCoupleId_status_idx" ON "CoupleChallenge"("challengerCoupleId", "status");
CREATE INDEX "CoupleChallenge_opponentCoupleId_status_idx" ON "CoupleChallenge"("opponentCoupleId", "status");

ALTER TABLE "Couple" ADD CONSTRAINT "Couple_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Couple" ADD CONSTRAINT "Couple_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoupleChallenge" ADD CONSTRAINT "CoupleChallenge_challengerCoupleId_fkey" FOREIGN KEY ("challengerCoupleId") REFERENCES "Couple"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoupleChallenge" ADD CONSTRAINT "CoupleChallenge_opponentCoupleId_fkey" FOREIGN KEY ("opponentCoupleId") REFERENCES "Couple"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoupleChallenge" ADD CONSTRAINT "CoupleChallenge_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
