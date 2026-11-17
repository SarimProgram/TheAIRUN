CREATE TABLE "WorkoutPhoto" (
  "id" TEXT NOT NULL,
  "authorUserId" TEXT NOT NULL,
  "recipientUserId" TEXT,
  "clientId" TEXT NOT NULL,
  "dayKey" TEXT NOT NULL,
  "capturedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "selfiePath" TEXT NOT NULL,
  "surroundingsPath" TEXT NOT NULL,
  CONSTRAINT "WorkoutPhoto_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkoutPhoto_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WorkoutPhoto_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "WorkoutPhoto_authorUserId_clientId_key" ON "WorkoutPhoto"("authorUserId", "clientId");
CREATE INDEX "WorkoutPhoto_authorUserId_dayKey_idx" ON "WorkoutPhoto"("authorUserId", "dayKey");
CREATE INDEX "WorkoutPhoto_recipientUserId_createdAt_idx" ON "WorkoutPhoto"("recipientUserId", "createdAt");
