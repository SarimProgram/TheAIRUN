import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: npx tsx scripts/set-manual-override.ts <email>');
    process.exit(1);
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, email: true },
  });
  if (!user) {
    console.log(JSON.stringify({ error: 'USER_NOT_FOUND', email }, null, 2));
    return;
  }

  const now = new Date();
  const manualOverrideEndsAt = new Date(now);
  manualOverrideEndsAt.setUTCFullYear(manualOverrideEndsAt.getUTCFullYear() + 1);

  const profile = await prisma.billingProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      revenueCatAppUserId: `user_${user.id}`,
      manualAccessOverride: true,
      manualOverrideEndsAt,
      lastSyncedAt: now,
    },
    update: {
      manualAccessOverride: true,
      manualOverrideEndsAt,
    },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        user,
        billing: {
          manualAccessOverride: profile.manualAccessOverride,
          manualOverrideEndsAt: profile.manualOverrideEndsAt,
          premiumAccessStatus: profile.premiumAccessStatus,
        },
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
