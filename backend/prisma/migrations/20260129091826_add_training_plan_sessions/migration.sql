-- AlterTable
ALTER TABLE "User" ADD COLUMN     "baselinePaceSecPerKm" INTEGER;

-- AlterTable
ALTER TABLE "UserPlan" ADD COLUMN     "bodyType" TEXT,
ADD COLUMN     "hasRaceGoal" BOOLEAN DEFAULT false,
ADD COLUMN     "runDietFocus" TEXT,
ADD COLUMN     "runExperience" TEXT,
ADD COLUMN     "runGoal" TEXT,
ADD COLUMN     "runPriority" TEXT,
ADD COLUMN     "runRaceDate" TIMESTAMP(3),
ADD COLUMN     "trainingStyle" TEXT;

-- CreateTable
CREATE TABLE "TrainingPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "totalWeeks" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "planJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunSession" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "dayOfWeek" INTEGER,
    "runType" TEXT NOT NULL,
    "targetKm" DOUBLE PRECISION NOT NULL,
    "stepsJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RunSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrainingPlan_userId_idx" ON "TrainingPlan"("userId");

-- CreateIndex
CREATE INDEX "RunSession_planId_week_idx" ON "RunSession"("planId", "week");

-- AddForeignKey
ALTER TABLE "TrainingPlan" ADD CONSTRAINT "TrainingPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunSession" ADD CONSTRAINT "RunSession_planId_fkey" FOREIGN KEY ("planId") REFERENCES "TrainingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
