-- CreateEnum
CREATE TYPE "GoalType" AS ENUM ('WEIGHT_LOSS', 'ENDURANCE', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "TimeHorizon" AS ENUM ('RELAXED', 'STANDARD', 'AGGRESSIVE', 'SPECIFIC_DATE');

-- CreateEnum
CREATE TYPE "ActivityPreference" AS ENUM ('MOSTLY_WALKING', 'WALKING_RUNNING', 'MOSTLY_RUNNING');

-- CreateEnum
CREATE TYPE "IntensityLevel" AS ENUM ('STEADY', 'ACTIVE', 'PRO');

-- CreateTable
CREATE TABLE "UserPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "heightCm" INTEGER NOT NULL,
    "ageYears" INTEGER NOT NULL,
    "goalType" "GoalType" NOT NULL,
    "targetWeightKg" DOUBLE PRECISION,
    "weightToLoseKg" DOUBLE PRECISION,
    "timeHorizon" "TimeHorizon",
    "targetDate" TIMESTAMP(3),
    "activityPreference" "ActivityPreference",
    "intensityLevel" "IntensityLevel" NOT NULL DEFAULT 'ACTIVE',
    "dailyCalorieTarget" INTEGER,
    "dailyActivityMins" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserPlan_userId_key" ON "UserPlan"("userId");

-- AddForeignKey
ALTER TABLE "UserPlan" ADD CONSTRAINT "UserPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
