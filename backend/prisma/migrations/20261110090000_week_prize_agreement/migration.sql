ALTER TABLE "WeekPrize"
    ADD COLUMN "proposedById" TEXT,
    ADD COLUMN "acceptedAt" TIMESTAMP(3),
    ADD COLUMN "signatureA" JSONB,
    ADD COLUMN "signatureB" JSONB;
