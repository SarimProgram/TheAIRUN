import { PrismaClient, QuestType, QuestDifficulty } from '@prisma/client';

const prisma = new PrismaClient();

const quests = [
    // Distance Quests
    {
        title: 'Morning Glory',
        description: 'Complete a 5km run before 9 AM',
        type: QuestType.DISTANCE,
        difficulty: QuestDifficulty.MEDIUM,
        targetValue: 5, // 5 km
        timeConstraint: 'before_9am',
        xpReward: 100,
        pointsReward: 50,
        durationHours: 24,
        sortOrder: 1,
    },
    {
        title: 'Quick Sprint',
        description: 'Run 1km as fast as you can',
        type: QuestType.DISTANCE,
        difficulty: QuestDifficulty.EASY,
        targetValue: 1, // 1 km
        timeConstraint: null,
        xpReward: 30,
        pointsReward: 15,
        durationHours: 24,
        sortOrder: 2,
    },
    {
        title: 'The Long Haul',
        description: 'Complete a 10km run',
        type: QuestType.DISTANCE,
        difficulty: QuestDifficulty.HARD,
        targetValue: 10, // 10 km
        timeConstraint: null,
        xpReward: 200,
        pointsReward: 100,
        durationHours: 48,
        sortOrder: 3,
    },
    // Calorie Quests
    {
        title: 'Burner',
        description: 'Burn 300 calories in one run',
        type: QuestType.CALORIES,
        difficulty: QuestDifficulty.MEDIUM,
        targetValue: 300, // 300 calories
        timeConstraint: null,
        xpReward: 75,
        pointsReward: 40,
        durationHours: 24,
        sortOrder: 4,
    },
    {
        title: 'Inferno',
        description: 'Burn 500 calories in one session',
        type: QuestType.CALORIES,
        difficulty: QuestDifficulty.HARD,
        targetValue: 500, // 500 calories
        timeConstraint: null,
        xpReward: 150,
        pointsReward: 75,
        durationHours: 24,
        sortOrder: 5,
    },
    // Time-based Quests
    {
        title: 'Early Bird',
        description: 'Complete any run before 7 AM',
        type: QuestType.TIME,
        difficulty: QuestDifficulty.MEDIUM,
        targetValue: 7, // 7 AM
        timeConstraint: 'before_7am',
        xpReward: 80,
        pointsReward: 40,
        durationHours: 24,
        sortOrder: 6,
    },
    {
        title: 'Night Owl',
        description: 'Complete a run after 8 PM',
        type: QuestType.TIME,
        difficulty: QuestDifficulty.EASY,
        targetValue: 20, // 8 PM (20:00)
        timeConstraint: 'after_8pm',
        xpReward: 50,
        pointsReward: 25,
        durationHours: 24,
        sortOrder: 7,
    },
    // Pace Quests
    {
        title: 'Speed Demon',
        description: 'Achieve an average pace under 5 min/km',
        type: QuestType.PACE,
        difficulty: QuestDifficulty.HARD,
        targetValue: 300, // 5 min = 300 seconds per km
        timeConstraint: null,
        xpReward: 120,
        pointsReward: 60,
        durationHours: 48,
        sortOrder: 8,
    },
    {
        title: 'Steady Pacer',
        description: 'Complete 3km at a steady 6 min/km pace',
        type: QuestType.PACE,
        difficulty: QuestDifficulty.MEDIUM,
        targetValue: 360, // 6 min = 360 seconds per km
        timeConstraint: null,
        xpReward: 70,
        pointsReward: 35,
        durationHours: 24,
        sortOrder: 9,
    },
    // Streak Quests
    {
        title: 'Consistency King',
        description: 'Run 3 days in a row',
        type: QuestType.STREAK,
        difficulty: QuestDifficulty.MEDIUM,
        targetValue: 3, // 3 days
        timeConstraint: null,
        xpReward: 150,
        pointsReward: 75,
        durationHours: 96, // 4 days to complete
        sortOrder: 10,
    },
];

async function seedQuests() {
    console.log('🌱 Seeding quests...');

    for (const quest of quests) {
        const existing = await prisma.quest.findFirst({
            where: { title: quest.title },
        });

        if (!existing) {
            await prisma.quest.create({ data: quest });
            console.log(`  ✅ Created quest: ${quest.title}`);
        } else {
            console.log(`  ⏭️  Quest already exists: ${quest.title}`);
        }
    }

    console.log('✨ Quest seeding complete!');
}

// Run if executed directly
seedQuests()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

export { seedQuests };
