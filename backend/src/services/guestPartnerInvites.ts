import { createHash } from 'node:crypto';
import { prisma } from '../db/prisma';
import { toInviteCode } from './partnerInvites';

export class GuestInviteError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export async function createGuestPartnerInvite(ownerToken: string, displayName: string) {
  const ownerTokenHash = hashToken(ownerToken);
  // A device retries with the same secret, so network retries never change its code.
  const guest = await prisma.guestPartnerInvite.upsert({
    where: { ownerTokenHash }, update: {},
    create: { ownerTokenHash, displayName, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
  });
  if (guest.claimedByUserId) throw new GuestInviteError(409, 'This invite is already linked to an account.');
  if (guest.expiresAt.getTime() <= Date.now()) throw new GuestInviteError(410, 'This invite expired. Please create another.');
  return { id: guest.id, code: toInviteCode(guest.id), toEmail: null, status: 'PENDING', createdAt: guest.createdAt, expiresAt: guest.expiresAt };
}

export async function claimGuestPartnerInvite(ownerToken: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    // The row lock prevents the same guest secret being claimed by two accounts.
    const ownerTokenHash = hashToken(ownerToken);
    await tx.$queryRaw`SELECT id FROM "GuestPartnerInvite" WHERE "ownerTokenHash" = ${ownerTokenHash} FOR UPDATE`;
    const guest = await tx.guestPartnerInvite.findUnique({ where: { ownerTokenHash } });
    if (!guest) throw new GuestInviteError(404, 'Guest invite not found.');
    if (guest.claimedByUserId && guest.claimedByUserId !== userId) throw new GuestInviteError(403, 'This invite belongs to another account.');
    if (guest.claimedByUserId === userId) return { id: guest.id, code: toInviteCode(guest.id) };
    if (guest.expiresAt.getTime() <= Date.now()) throw new GuestInviteError(410, 'This guest invite expired.');
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    const user = await tx.user.findUnique({ where: { id: userId }, select: { partnerId: true } });
    if (!user) throw new GuestInviteError(404, 'User not found.');
    if (user.partnerId) throw new GuestInviteError(409, 'You already have a partner.');
    await tx.partnerInvite.create({
      data: { id: guest.id, fromUserId: userId, toEmail: null, status: 'PENDING' },
    });
    await tx.guestPartnerInvite.update({ where: { id: guest.id }, data: { claimedByUserId: userId } });
    return { id: guest.id, code: toInviteCode(guest.id) };
  });
}
