CREATE TABLE "WeekPrize" (
    "id" TEXT NOT NULL,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "weekStart" TEXT NOT NULL,
    "weekprize" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WeekPrize_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WeekPrize_userAId_userBId_weekStart_key" ON "WeekPrize"("userAId", "userBId", "weekStart");
CREATE INDEX "WeekPrize_userBId_idx" ON "WeekPrize"("userBId");
ALTER TABLE "WeekPrize" ADD CONSTRAINT "WeekPrize_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeekPrize" ADD CONSTRAINT "WeekPrize_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
