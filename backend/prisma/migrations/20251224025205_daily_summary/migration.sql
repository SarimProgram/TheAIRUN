-- CreateEnum
CREATE TYPE "WorkoutType" AS ENUM ('RUN', 'WALK', 'INTERVAL', 'GYM', 'CYCLING', 'SWIMMING', 'OTHER');

-- CreateEnum
CREATE TYPE "WorkoutSource" AS ENUM ('MANUAL', 'APP_TRACKED', 'APPLE_HEALTH', 'GOOGLE_FIT');

-- CreateTable
CREATE TABLE "DailySummary" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "timezone" TEXT,
    "calorieTarget" INTEGER NOT NULL DEFAULT 0,
    "proteinTarget" INTEGER NOT NULL DEFAULT 0,
    "stepsTarget" INTEGER NOT NULL DEFAULT 0,
    "runKmTarget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "consumedCalories" INTEGER NOT NULL DEFAULT 0,
    "proteinG" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "carbsG" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fatG" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "steps" INTEGER NOT NULL DEFAULT 0,
    "activeCalories" INTEGER NOT NULL DEFAULT 0,
    "exerciseMinutes" INTEGER NOT NULL DEFAULT 0,
    "distanceKm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "restingCalories" INTEGER NOT NULL DEFAULT 0,
    "totalBurnedCalories" INTEGER NOT NULL DEFAULT 0,
    "caloriesRemaining" INTEGER NOT NULL DEFAULT 0,
    "netCalories" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailySummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "type" "WorkoutType" NOT NULL,
    "source" "WorkoutSource" NOT NULL DEFAULT 'MANUAL',
    "title" TEXT,
    "caloriesBurned" INTEGER NOT NULL DEFAULT 0,
    "distanceKm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "durationMinutes" INTEGER NOT NULL DEFAULT 0,
    "avgPaceSecPerKm" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "routeJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailySummary_userId_dayKey_idx" ON "DailySummary"("userId", "dayKey");

-- CreateIndex
CREATE UNIQUE INDEX "DailySummary_userId_dayKey_key" ON "DailySummary"("userId", "dayKey");

-- CreateIndex
CREATE INDEX "WorkoutSession_userId_dayKey_idx" ON "WorkoutSession"("userId", "dayKey");

-- CreateIndex
CREATE INDEX "WorkoutSession_userId_startedAt_idx" ON "WorkoutSession"("userId", "startedAt");

-- AddForeignKey
ALTER TABLE "DailySummary" ADD CONSTRAINT "DailySummary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
