import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ReminderPhotoAnimation } from '@/components/partner/reminderPhotoAnimations';

export type UserCustomReminder = {
    id: string;
    label: string;
    previewTitle: string;
    message: string;
    localImageUri: string;
    photoAnimation: ReminderPhotoAnimation;
    createdAt: string;
    updatedAt: string;
};

export const MAX_CUSTOM_REMINDERS = 12;

const STORAGE_PREFIX = 'partner_custom_reminders_v1';

function storageKey(userId: string) {
    return `${STORAGE_PREFIX}:${userId}`;
}

export async function loadCustomReminders(userId: string): Promise<UserCustomReminder[]> {
    if (!userId) {
        return [];
    }

    try {
        const raw = await AsyncStorage.getItem(storageKey(userId));
        if (!raw) {
            return [];
        }

        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed.filter(
            (item): item is UserCustomReminder =>
                !!item
                && typeof item.id === 'string'
                && typeof item.label === 'string'
                && typeof item.previewTitle === 'string'
                && typeof item.message === 'string'
                && typeof item.localImageUri === 'string'
                && typeof item.photoAnimation === 'string',
        );
    } catch {
        return [];
    }
}

export async function saveCustomReminders(
    userId: string,
    reminders: UserCustomReminder[],
): Promise<void> {
    if (!userId) {
        return;
    }

    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(reminders));
}

export function createCustomReminderId() {
    return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
