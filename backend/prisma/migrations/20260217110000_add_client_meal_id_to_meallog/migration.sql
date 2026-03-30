-- Add client-generated id for idempotent meal sync (offline queue dedupe)
ALTER TABLE "MealLog"
ADD COLUMN "clientMealId" TEXT;

CREATE UNIQUE INDEX "MealLog_userId_clientMealId_key"
ON "MealLog"("userId", "clientMealId");
