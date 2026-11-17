-- Code invites can be created before a recipient email is provided.
ALTER TABLE "PartnerInvite" ALTER COLUMN "toEmail" DROP NOT NULL;
