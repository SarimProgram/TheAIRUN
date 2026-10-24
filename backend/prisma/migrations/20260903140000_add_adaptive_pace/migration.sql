CREATE TYPE "PaceStatus" AS ENUM ('STARTING', 'LEARNING', 'PERSONALISED');
CREATE TYPE "PaceMode" AS ENUM ('RUNNING', 'WALKING');
CREATE TYPE "PerceivedEffort" AS ENUM ('TOO_EASY', 'ABOUT_RIGHT', 'TOO_HARD');

CREATE TABLE "PaceProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "autoAdjust" BOOLEAN NOT NULL DEFAULT true,
    "lastAdjustedMode" "PaceMode",
    "runningBaselinePaceSecPerKm" INTEGER NOT NULL,
    "runningStartingPaceSecPerKm" INTEGER NOT NULL,
    "runningPreviousBaselinePaceSecPerKm" INTEGER,
    "runningSampleCount" INTEGER NOT NULL DEFAULT 0,
    "runningStatus" "PaceStatus" NOT NULL DEFAULT 'STARTING',
    "runningUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "walkingBaselinePaceSecPerKm" INTEGER NOT NULL,
    "walkingStartingPaceSecPerKm" INTEGER NOT NULL,
    "walkingPreviousBaselinePaceSecPerKm" INTEGER,
    "walkingSampleCount" INTEGER NOT NULL DEFAULT 0,
    "walkingStatus" "PaceStatus" NOT NULL DEFAULT 'STARTING',
    "walkingUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PaceProfile_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "WorkoutSession" ADD COLUMN "clientId" TEXT;
ALTER TABLE "WorkoutSession" ADD COLUMN "perceivedEffort" "PerceivedEffort";
ALTER TABLE "WorkoutSession" ADD COLUMN "paceSampleMode" "PaceMode";
ALTER TABLE "WorkoutSession" ADD COLUMN "paceSampleAccepted" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "PaceProfile_userId_key" ON "PaceProfile"("userId");
CREATE UNIQUE INDEX "WorkoutSession_userId_clientId_key" ON "WorkoutSession"("userId", "clientId");
ALTER TABLE "PaceProfile" ADD CONSTRAINT "PaceProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "PaceProfile" (
    "id", "userId", "runningBaselinePaceSecPerKm", "runningStartingPaceSecPerKm",
    "walkingBaselinePaceSecPerKm", "walkingStartingPaceSecPerKm", "updatedAt"
)
SELECT
    substr(md5(random()::text || clock_timestamp()::text || "id"), 1, 8) || '-' ||
    substr(md5(random()::text || "id"), 1, 4) || '-4' ||
    substr(md5(clock_timestamp()::text || "id"), 1, 3) || '-a' ||
    substr(md5("id" || random()::text), 1, 3) || '-' ||
    substr(md5("id" || clock_timestamp()::text), 1, 12),
    "id",
    COALESCE("baselinePaceSecPerKm", 540),
    COALESCE("baselinePaceSecPerKm", 540),
    810,
    810,
    CURRENT_TIMESTAMP
FROM "User";
