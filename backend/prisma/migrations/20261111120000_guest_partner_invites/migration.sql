CREATE TABLE "GuestPartnerInvite" (
    "id" TEXT NOT NULL,
    "ownerTokenHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedByUserId" TEXT,
    CONSTRAINT "GuestPartnerInvite_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GuestPartnerInvite_ownerTokenHash_key" ON "GuestPartnerInvite"("ownerTokenHash");
CREATE INDEX "GuestPartnerInvite_expiresAt_idx" ON "GuestPartnerInvite"("expiresAt");
ALTER TABLE "GuestPartnerInvite" ADD CONSTRAINT "GuestPartnerInvite_claimedByUserId_fkey"
    FOREIGN KEY ("claimedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
