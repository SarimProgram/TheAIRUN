import { prisma } from '../src/db/prisma';
import { saveRecipientMeal } from '../src/services/sharedMealLogs';

/** Defaults to a read-only audit. --apply restores only missing recipient logs. */
async function main() {
    const apply = process.argv.includes('--apply');
    const plates = await prisma.sharedMeal.findMany({ where: { status: 'ACCEPTED' } });
    let missing = 0;
    for (const plate of plates) {
        const existing = await prisma.mealLog.findUnique({
            where: { userId_clientMealId: { userId: plate.recipientUserId, clientMealId: `pass-${plate.id}` } },
            select: { id: true },
        });
        if (existing) continue;
        missing++;
        if (apply) {
            await prisma.$transaction(async tx => {
                const current = await tx.sharedMeal.findFirst({ where: { id: plate.id, status: 'ACCEPTED' } });
                if (current) await saveRecipientMeal(tx, current, current.itemShares as number[]);
            });
        }
        console.log(`${apply ? 'Restored' : 'Missing'} recipient log for plate ${plate.id.slice(0, 8)} (${plate.createdAt.toISOString()})`);
    }
    console.log(`${apply ? 'Repair' : 'Audit'} complete: ${missing} missing of ${plates.length} accepted plates.`);
}

main().catch(error => {
    console.error('Accepted meal repair failed:', error instanceof Error ? error.name : 'Unknown error');
    process.exitCode = 1;
}).finally(() => prisma.$disconnect());
