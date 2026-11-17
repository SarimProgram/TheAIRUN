ALTER TABLE "WorkoutPhoto"
  ALTER COLUMN "selfiePath" DROP NOT NULL,
  ALTER COLUMN "surroundingsPath" DROP NOT NULL,
  ADD COLUMN "selfieThumbPath" TEXT,
  ADD COLUMN "surroundingsThumbPath" TEXT,
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "imagesDeletedAt" TIMESTAMP(3);
UPDATE "WorkoutPhoto" SET "expiresAt" = "capturedAt" + INTERVAL '30 days';
ALTER TABLE "WorkoutPhoto" ALTER COLUMN "expiresAt" SET NOT NULL;
ALTER TABLE "WorkoutPhoto" ALTER COLUMN "expiresAt" SET DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days');
CREATE INDEX "WorkoutPhoto_imagesDeletedAt_expiresAt_idx" ON "WorkoutPhoto"("imagesDeletedAt", "expiresAt");
