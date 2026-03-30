-- CreateTable
CREATE TABLE "GeneratedWeekPlan" (
    "id" TEXT NOT NULL,
    "userPlanId" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "caloriesPerDay" INTEGER NOT NULL,
    "proteinPerDay" INTEGER NOT NULL,
    "stepsPerDay" INTEGER NOT NULL,
    "runKmPerWeek" DOUBLE PRECISION NOT NULL,
    "expectedWeight" DOUBLE PRECISION NOT NULL,
    "weekName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratedWeekPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GeneratedWeekPlan_userPlanId_idx" ON "GeneratedWeekPlan"("userPlanId");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedWeekPlan_userPlanId_week_key" ON "GeneratedWeekPlan"("userPlanId", "week");

-- AddForeignKey
ALTER TABLE "GeneratedWeekPlan" ADD CONSTRAINT "GeneratedWeekPlan_userPlanId_fkey" FOREIGN KEY ("userPlanId") REFERENCES "UserPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
