import type { ImageSourcePropType } from 'react-native';
import { INTERVENE_ANIMATION_COST } from '@/components/home/InterveneBottomSheet';
import type { ReminderPhotoAnimation } from '@/components/partner/reminderPhotoAnimations';
import { encodeCustomReminderMessage } from '@/utils/customReminderMessage';
import type { UserCustomReminder } from '@/utils/customReminderStorage';

export type ReminderDelivery = 'fullscreen' | 'notification-card' | 'chat';

export type PartnerReminderOption = {
    id: string;
    label: string;
    previewEyebrow: string;
    previewTitle: string;
    delivery: ReminderDelivery;
    mode?: 'hearts' | 'angry' | 'cat' | 'photo';
    previewImage?: ImageSourcePropType;
    photoAnimation?: ReminderPhotoAnimation;
    assetId?: string;
    isUserCustom?: boolean;
    pointsCost: number;
    chatTag?: 'steps' | 'kcal';
    buildMessage: (partnerName: string) => string;
    encodeMessage?: () => Promise<string>;
};

export type ReminderCategoryId = 'steps' | 'calories' | 'hydration' | 'custom';

export type ReminderAssetDefinition = {
    id: string;
    category: ReminderCategoryId;
    folder: string;
    fileName: string;
    label: string;
    previewEyebrow: string;
    previewTitle: string;
    message: string;
    image: number;
    photoAnimation: ReminderPhotoAnimation;
};

type FolderAssetConfig = {
    fileName: string;
    id: string;
    label: string;
    previewTitle: string;
    message: string;
    photoAnimation: ReminderPhotoAnimation;
    useCatMode?: boolean;
};

type FolderConfig = {
    category: ReminderCategoryId;
    previewEyebrow: string;
    assets: FolderAssetConfig[];
};

/** One entry per folder under app/assets/Reminder — add new photos here. */
const REMINDER_FOLDER_CONFIG: Record<string, FolderConfig> = {
    Steps: {
        category: 'steps',
        previewEyebrow: 'STEP BATTLE',
        assets: [
            {
                fileName: '4.png',
                id: 'steps-4',
                label: 'Walk time',
                previewTitle: 'Time for a walk',
                message: 'Time for a walk.',
                photoAnimation: 'wiggle',
            },
            {
                fileName: '5.png',
                id: 'steps-5',
                label: 'Get moving',
                previewTitle: 'Let us take a walk',
                message: 'Get up and go for a little walk.',
                photoAnimation: 'bounce',
            },
        ],
    },
    Calories: {
        category: 'calories',
        previewEyebrow: 'CALORIE CHECK',
        assets: [
            {
                fileName: '3.png',
                id: 'calories-3',
                label: 'Light day',
                previewTitle: 'Keep it light today',
                message: 'Keep lunch simple today.',
                photoAnimation: 'float',
            },
            {
                fileName: '7.png',
                id: 'calories-7',
                label: 'Easy now',
                previewTitle: 'Slow down a little',
                message: 'Pause before the next bite.',
                photoAnimation: 'pulse',
            },
        ],
    },
    Water: {
        category: 'hydration',
        previewEyebrow: 'HYDRATION',
        assets: [
            {
                fileName: '1.png',
                id: 'water-1',
                label: 'Water break',
                previewTitle: 'Drink some water',
                message: 'Drink some water.',
                photoAnimation: 'float',
            },
            {
                fileName: '2.png',
                id: 'water-2',
                label: 'Hydrate',
                previewTitle: 'Have some water',
                message: 'Have a glass of water.',
                photoAnimation: 'sideToSide',
            },
            {
                fileName: 'Cat.png',
                id: 'water-cat',
                label: 'Pretty please',
                previewTitle: 'Drink some water',
                message: 'Drink some water. Pretty please.',
                photoAnimation: 'beg',
                useCatMode: true,
            },
        ],
    },
    Workout: {
        category: 'hydration',
        previewEyebrow: 'HYDRATION',
        assets: [
            {
                fileName: 'drink-water.png',
                id: 'workout-water',
                label: 'After workout',
                previewTitle: 'Hydrate after training',
                message: 'Great workout. Now drink some water.',
                photoAnimation: 'pop',
            },
        ],
    },
};

const REMINDER_IMAGE_REQUIRES: Record<string, number> = {
    'Steps/4.png': require('../../assets/Reminder/Steps/4.png'),
    'Steps/5.png': require('../../assets/Reminder/Steps/5.png'),
    'Calories/3.png': require('../../assets/Reminder/Calories/3.png'),
    'Calories/7.png': require('../../assets/Reminder/Calories/7.png'),
    'Water/1.png': require('../../assets/Reminder/Water/1.png'),
    'Water/2.png': require('../../assets/Reminder/Water/2.png'),
    'Water/Cat.png': require('../../assets/Reminder/Water/Cat.png'),
    'Workout/drink-water.png': require('../../assets/Reminder/Workout/drink-water.png'),
};

function buildAssetsFromFolders(): ReminderAssetDefinition[] {
    const assets: ReminderAssetDefinition[] = [];

    for (const [folder, config] of Object.entries(REMINDER_FOLDER_CONFIG)) {
        for (const asset of config.assets) {
            const imageKey = `${folder}/${asset.fileName}`;
            const image = REMINDER_IMAGE_REQUIRES[imageKey];
            if (!image) {
                continue;
            }

            assets.push({
                id: asset.id,
                category: config.category,
                folder,
                fileName: asset.fileName,
                label: asset.label,
                previewEyebrow: config.previewEyebrow,
                previewTitle: asset.previewTitle,
                message: asset.message,
                image,
                photoAnimation: asset.photoAnimation,
            });
        }
    }

    return assets;
}

export const REMINDER_ASSETS = buildAssetsFromFolders();

export const REMINDER_ASSET_BY_ID = Object.fromEntries(
    REMINDER_ASSETS.map((asset) => [asset.id, asset]),
) as Record<string, ReminderAssetDefinition>;

export const REMINDER_CAT_IMAGE = REMINDER_ASSET_BY_ID['water-cat']?.image;

const TAG_BY_CATEGORY: Record<ReminderCategoryId, 'STEPS' | 'KCAL' | 'WATER' | 'CUSTOM'> = {
    steps: 'STEPS',
    calories: 'KCAL',
    hydration: 'WATER',
    custom: 'CUSTOM',
};

const FOLDER_ASSET_BY_ID = Object.fromEntries(
    Object.entries(REMINDER_FOLDER_CONFIG).flatMap(([folder, config]) =>
        config.assets.map((asset) => [
            asset.id,
            { folder, useCatMode: asset.useCatMode, photoAnimation: asset.photoAnimation },
        ]),
    ),
) as Record<string, { folder: string; useCatMode?: boolean; photoAnimation: ReminderPhotoAnimation }>;

export function buildPhotoReminderMessage(assetId: string) {
    const asset = REMINDER_ASSET_BY_ID[assetId];
    if (!asset) {
        return '';
    }

    const tag = TAG_BY_CATEGORY[asset.category];
    const folderAsset = FOLDER_ASSET_BY_ID[assetId];

    if (folderAsset?.useCatMode) {
        return `[WATER:cat] ${asset.message}`;
    }

    return `[${tag}:photo:${assetId}] ${asset.message}`;
}

export function photoReminderOption(asset: ReminderAssetDefinition): PartnerReminderOption {
    const folderAsset = FOLDER_ASSET_BY_ID[asset.id];

    return {
        id: asset.id,
        label: asset.label,
        previewEyebrow: asset.previewEyebrow,
        previewTitle: asset.previewTitle,
        delivery: 'fullscreen',
        mode: folderAsset?.useCatMode ? 'cat' : 'photo',
        previewImage: asset.image,
        photoAnimation: asset.photoAnimation,
        assetId: asset.id,
        pointsCost: 0,
        buildMessage: () => buildPhotoReminderMessage(asset.id),
    };
}

export function buildCustomReminderOptions(
    reminders: UserCustomReminder[],
): PartnerReminderOption[] {
    return reminders.map((reminder) => ({
        id: reminder.id,
        label: reminder.label,
        previewEyebrow: 'YOUR REMINDER',
        previewTitle: reminder.previewTitle,
        delivery: 'fullscreen',
        mode: 'photo',
        previewImage: { uri: reminder.localImageUri },
        photoAnimation: reminder.photoAnimation,
        isUserCustom: true,
        pointsCost: 0,
        buildMessage: () => reminder.message,
        encodeMessage: () => encodeCustomReminderMessage(reminder),
    }));
}

export function getReminderAssetsForCategory(category: ReminderCategoryId) {
    return REMINDER_ASSETS.filter((asset) => asset.category === category);
}

const SUPPLEMENTAL_REMINDER_OPTIONS: Record<
    ReminderCategoryId,
    PartnerReminderOption[]
> = {
    steps: [
        {
            id: 'steps-encourage',
            label: 'Encourage',
            previewEyebrow: 'CHEER THEM ON',
            previewTitle: 'You are doing great',
            delivery: 'fullscreen',
            mode: 'hearts',
            pointsCost: 0,
            buildMessage: () => `[STEPS:hearts] You are doing great. Keep going.`,
        },
        {
            id: 'steps-compete',
            label: 'Compete',
            previewEyebrow: 'STEP BATTLE',
            previewTitle: 'Catch up on steps',
            delivery: 'fullscreen',
            mode: 'angry',
            pointsCost: 0,
            buildMessage: () => `[STEPS:angry] I am ahead on steps. Catch up.`,
        },
        {
            id: 'steps-walk',
            label: "Let's go",
            previewEyebrow: 'STEP NUDGE',
            previewTitle: 'Ready for a quick walk?',
            delivery: 'chat',
            pointsCost: 0,
            chatTag: 'steps',
            buildMessage: () => '[STEPS] Ready for a quick walk?',
        },
        {
            id: 'steps-keep-going',
            label: 'Keep going',
            previewEyebrow: 'STEP NUDGE',
            previewTitle: 'Keep going',
            delivery: 'chat',
            pointsCost: 0,
            chatTag: 'steps',
            buildMessage: () => '[STEPS] Keep going. You have got this.',
        },
        {
            id: 'steps-catch-up',
            label: 'Catch up',
            previewEyebrow: 'STEP NUDGE',
            previewTitle: 'Catch me on steps',
            delivery: 'chat',
            pointsCost: 0,
            chatTag: 'steps',
            buildMessage: () => '[STEPS] Catch me on steps.',
        },
    ],
    calories: [
        {
            id: 'calorie-check',
            label: 'Calorie check',
            previewEyebrow: 'CALORIE CHECK',
            previewTitle: 'Ease up today',
            delivery: 'fullscreen',
            mode: 'angry',
            pointsCost: INTERVENE_ANIMATION_COST,
            buildMessage: () => '[KCAL:angry] Ease up on calories today.',
        },
        {
            id: 'calorie-gentle',
            label: 'Gentle',
            previewEyebrow: 'CALORIE NUDGE',
            previewTitle: 'Small reset today',
            delivery: 'chat',
            pointsCost: 0,
            chatTag: 'kcal',
            buildMessage: () => '[KCAL] Small reset. You can still win today.',
        },
        {
            id: 'calorie-coach',
            label: 'Coach',
            previewEyebrow: 'CALORIE NUDGE',
            previewTitle: 'Keep the next meal lighter',
            delivery: 'chat',
            pointsCost: 0,
            chatTag: 'kcal',
            buildMessage: () => '[KCAL] Keep the next meal lighter.',
        },
        {
            id: 'calorie-funny',
            label: 'Funny',
            previewEyebrow: 'CALORIE NUDGE',
            previewTitle: 'Calories are adding up',
            delivery: 'chat',
            pointsCost: 0,
            chatTag: 'kcal',
            buildMessage: () => '[KCAL] Calories are adding up. One smart choice helps.',
        },
    ],
    hydration: [
        {
            id: 'water-note',
            label: 'Water note',
            previewEyebrow: 'HYDRATION',
            previewTitle: 'Drink some water',
            delivery: 'chat',
            pointsCost: 0,
            buildMessage: (partnerName) =>
                `${partnerName}, drink some water when you can.`,
        },
    ],
    custom: [],
};

const CATEGORY_META: Record<
    ReminderCategoryId,
    { id: ReminderCategoryId; title: string; icon: ReminderCategoryId }
> = {
    steps: { id: 'steps', title: 'Steps', icon: 'steps' },
    calories: { id: 'calories', title: 'Calories', icon: 'calories' },
    hydration: { id: 'hydration', title: 'Hydration', icon: 'hydration' },
    custom: { id: 'custom', title: 'Yours', icon: 'custom' },
};

export type PartnerReminderCategory = {
    id: ReminderCategoryId;
    title: string;
    icon: ReminderCategoryId;
    options: PartnerReminderOption[];
};

export function buildPartnerReminderCategories(): PartnerReminderCategory[] {
    return (['steps', 'calories', 'hydration', 'custom'] as ReminderCategoryId[]).map((categoryId) => ({
        ...CATEGORY_META[categoryId],
        options: [
            ...getReminderAssetsForCategory(categoryId).map(photoReminderOption),
            ...SUPPLEMENTAL_REMINDER_OPTIONS[categoryId],
        ],
    }));
}

export function mergePartnerReminderCategories(
    customReminders: UserCustomReminder[] = [],
): PartnerReminderCategory[] {
    const customOptions = buildCustomReminderOptions(customReminders);

    return buildPartnerReminderCategories().map((category) =>
        category.id === 'custom'
            ? { ...category, options: customOptions }
            : category,
    );
}

export const PARTNER_REMINDER_CATEGORIES = buildPartnerReminderCategories();

export async function resolveReminderSendMessage(
    option: PartnerReminderOption,
    partnerName: string,
): Promise<string> {
    if (option.encodeMessage) {
        return option.encodeMessage();
    }

    return option.buildMessage(partnerName);
}
