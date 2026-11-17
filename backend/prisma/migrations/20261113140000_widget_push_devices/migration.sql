-- CreateTable
CREATE TABLE "WidgetPushDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "pushToken" TEXT NOT NULL,
    "feedTokenHash" TEXT NOT NULL,
    "lastPushedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WidgetPushDevice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WidgetPushDevice_pushToken_key" ON "WidgetPushDevice"("pushToken");

-- CreateIndex
CREATE UNIQUE INDEX "WidgetPushDevice_feedTokenHash_key" ON "WidgetPushDevice"("feedTokenHash");

-- CreateIndex
CREATE INDEX "WidgetPushDevice_userId_kind_idx" ON "WidgetPushDevice"("userId", "kind");

-- AddForeignKey
ALTER TABLE "WidgetPushDevice" ADD CONSTRAINT "WidgetPushDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
