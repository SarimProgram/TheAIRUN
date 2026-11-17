import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const email = process.argv[2];

async function main() {
    if (!email) throw new Error('Usage: npx tsx scripts/find-user.ts <email>');
    const user = await prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: {
            id: true, email: true, displayName: true, createdAt: true,
            plan: { select: {
                goalType: true, trainingStyle: true, workoutDaysPerWeek: true, workoutPreference: true,
                availableDays: true, hasRaceGoal: true, runGoal: true, currentWeek: true,
                _count: { select: { weeklyPlans: true } },
                ...(process.argv.includes('--schedule') ? { weeklyPlans: {
                    orderBy: { week: 'asc' as const }, take: 1,
                    select: { week: true, proteinPerDay: true, weekDailys: true,
                        dailyTargets: { orderBy: { dayOfWeek: 'asc' as const }, select: {
                            dayOfWeek: true, dayType: true, calorieTarget: true, proteinTarget: true,
                            stepsTarget: true, runType: true, runKm: true,
                        } },
                    },
                } } : {}),
            } },
        },
    });
    console.log(JSON.stringify(user ? { found: true, user } : { found: false, email }, null, 2));
}

main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
