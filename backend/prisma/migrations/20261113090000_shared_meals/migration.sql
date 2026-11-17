CREATE TYPE "SharedMealMode" AS ENUM ('SPLIT', 'COPY');
CREATE TYPE "SharedMealStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

CREATE TABLE "SharedMeal" (
    "id" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "senderClientMealId" TEXT,
    "mode" "SharedMealMode" NOT NULL,
    "mealType" "MealType" NOT NULL,
    "items" JSONB NOT NULL,
    "itemShares" JSONB NOT NULL,
    "photoPath" TEXT,
    "cutoutPath" TEXT,
    "status" "SharedMealStatus" NOT NULL DEFAULT 'PENDING',
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SharedMeal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SharedMeal_senderUserId_clientId_key" ON "SharedMeal"("senderUserId", "clientId");
CREATE INDEX "SharedMeal_recipientUserId_status_createdAt_idx" ON "SharedMeal"("recipientUserId", "status", "createdAt");

ALTER TABLE "SharedMeal" ADD CONSTRAINT "SharedMeal_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SharedMeal" ADD CONSTRAINT "SharedMeal_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
