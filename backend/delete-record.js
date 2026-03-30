const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const userId = '5cba9d0a-9861-45e3-99b2-4dac288eecef';

    // 1. Delete the bad DailySummary record
    await prisma.dailySummary.delete({
        where: { id: '44dd64c6-2836-409e-9f55-bc09b386f967' }
    });
    console.log('Deleted bad DailySummary record');

    // 2. Update user timezone to Australia/Sydney
    await prisma.user.update({
        where: { id: userId },
        data: { timezone: 'Australia/Sydney' }
    });
    console.log('Updated user timezone to Australia/Sydney');

    console.log('\nDone! Now refresh the app to create a new summary with proper targets.');
}

main().catch(e => console.error('Error:', e)).finally(() => prisma.$disconnect());
