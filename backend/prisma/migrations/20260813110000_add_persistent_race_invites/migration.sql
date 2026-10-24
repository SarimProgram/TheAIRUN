CREATE TYPE "RaceInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');

CREATE TABLE "RaceInvite" (
    "id" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "distanceM" INTEGER NOT NULL,
    "status" "RaceInviteStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RaceInvite_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RaceInvite_toUserId_status_createdAt_idx" ON "RaceInvite"("toUserId", "status", "createdAt");
CREATE INDEX "RaceInvite_fromUserId_status_idx" ON "RaceInvite"("fromUserId", "status");

ALTER TABLE "RaceInvite" ADD CONSTRAINT "RaceInvite_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RaceInvite" ADD CONSTRAINT "RaceInvite_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
