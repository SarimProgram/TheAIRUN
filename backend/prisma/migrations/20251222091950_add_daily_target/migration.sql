-- CreateEnum
CREATE TYPE "DayType" AS ENUM ('STEP', 'RUN', 'RECOVERY');

-- CreateTable
CREATE TABLE "DailyTarget" (
    "id" TEXT NOT NULL,
    "weekPlanId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "dayType" "DayType" NOT NULL,
    "calorieTarget" INTEGER NOT NULL,
    "proteinTarget" INTEGER NOT NULL,
    "stepsTarget" INTEGER NOT NULL,
    "runKm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "runType" TEXT,
    "morningSteps" INTEGER NOT NULL DEFAULT 0,
    "eveningSteps" INTEGER NOT NULL DEFAULT 0,
    "nightSteps" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyTarget_weekPlanId_idx" ON "DailyTarget"("weekPlanId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyTarget_weekPlanId_dayOfWeek_key" ON "DailyTarget"("weekPlanId", "dayOfWeek");

-- AddForeignKey
ALTER TABLE "DailyTarget" ADD CONSTRAINT "DailyTarget_weekPlanId_fkey" FOREIGN KEY ("weekPlanId") REFERENCES "GeneratedWeekPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
