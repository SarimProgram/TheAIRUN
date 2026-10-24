-- AlterTable
ALTER TABLE "User" ADD COLUMN "partnerLinkedAt" TIMESTAMP(3);

-- Backfill existing partner links from accepted invites where possible.
UPDATE "User" AS u
SET "partnerLinkedAt" = invite_data."linkedAt"
FROM (
    SELECT DISTINCT ON (u2.id)
        u2.id AS "userId",
        pi."updatedAt" AS "linkedAt"
    FROM "User" u2
    INNER JOIN "PartnerInvite" pi ON pi.status = 'ACCEPTED'
        AND (
            (pi."fromUserId" = u2.id AND pi."toUserId" = u2."partnerId")
            OR (pi."toUserId" = u2.id AND pi."fromUserId" = u2."partnerId")
        )
    WHERE u2."partnerId" IS NOT NULL
    ORDER BY u2.id, pi."updatedAt" DESC
) AS invite_data
WHERE u.id = invite_data."userId"
  AND u."partnerLinkedAt" IS NULL;
