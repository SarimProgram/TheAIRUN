ALTER TABLE "ChatMessage" ADD COLUMN "viewedAt" TIMESTAMP(3);

CREATE INDEX "ChatMessage_viewedAt_idx" ON "ChatMessage"("viewedAt");
