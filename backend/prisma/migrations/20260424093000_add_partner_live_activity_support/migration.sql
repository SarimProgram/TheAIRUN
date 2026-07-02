ALTER TABLE "User"
ADD COLUMN "apnsDeviceToken" TEXT,
ADD COLUMN "apnsDeviceTokenUpdatedAt" TIMESTAMP(3);

CREATE TABLE "LiveActivitySession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "activityType" TEXT NOT NULL,
  "activityInstanceId" TEXT,
  "pushToken" TEXT NOT NULL,
  "partnerId" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LiveActivitySession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LiveActivitySession_pushToken_key" ON "LiveActivitySession"("pushToken");
CREATE INDEX "LiveActivitySession_userId_activityType_endedAt_idx" ON "LiveActivitySession"("userId", "activityType", "endedAt");

ALTER TABLE "LiveActivitySession"
ADD CONSTRAINT "LiveActivitySession_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
