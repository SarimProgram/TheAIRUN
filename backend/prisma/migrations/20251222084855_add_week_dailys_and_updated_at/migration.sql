-- DropIndex
DROP INDEX "GeneratedWeekPlan_userPlanId_idx";

-- AlterTable: First add columns as nullable, then set defaults, then make required
ALTER TABLE "GeneratedWeekPlan" ADD COLUMN "weekDailys" JSONB;

-- Add updatedAt with default value for existing rows
ALTER TABLE "GeneratedWeekPlan" ADD COLUMN "updatedAt" TIMESTAMP(3);
UPDATE "GeneratedWeekPlan" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;
ALTER TABLE "GeneratedWeekPlan" ALTER COLUMN "updatedAt" SET NOT NULL;
