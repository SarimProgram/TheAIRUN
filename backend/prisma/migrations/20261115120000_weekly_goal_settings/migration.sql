CREATE TABLE "HomeGoalLayout" (
  "userId" TEXT NOT NULL PRIMARY KEY,
  "order" TEXT[] NOT NULL,
  CONSTRAINT "HomeGoalLayout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "WeeklyGoalRemoval" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userAId" TEXT NOT NULL,
  "userBId" TEXT NOT NULL,
  "weekStart" TEXT NOT NULL,
  "goal" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WeeklyGoalRemoval_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WeeklyGoalRemoval_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "WeeklyGoalRemoval_userAId_userBId_weekStart_goal_key" ON "WeeklyGoalRemoval"("userAId", "userBId", "weekStart", "goal");
CREATE INDEX "WeeklyGoalRemoval_userBId_weekStart_idx" ON "WeeklyGoalRemoval"("userBId", "weekStart");
