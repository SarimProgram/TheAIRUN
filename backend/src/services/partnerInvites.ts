import { prisma } from '../db/prisma';

export function normalizeInviteCode(code: string) {
  return code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8);
}

export function toInviteCode(inviteId: string) {
  return inviteId.replace(/-/g, '').slice(0, 8).toUpperCase();
}

export async function linkPendingPartnerInvitesForUser(userId: string, email: string) {
  await prisma.partnerInvite.updateMany({
    where: {
      toEmail: { equals: email.trim(), mode: 'insensitive' },
      status: 'PENDING',
    },
    data: { toUserId: userId },
  });
}
