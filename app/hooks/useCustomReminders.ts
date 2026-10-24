import { useCallback, useEffect, useState } from 'react';
import type { ReminderPhotoAnimation } from '@/components/partner/reminderPhotoAnimations';
import {
    createCustomReminderId,
    loadCustomReminders,
    MAX_CUSTOM_REMINDERS,
    saveCustomReminders,
    type UserCustomReminder,
} from '@/utils/customReminderStorage';

export type CustomReminderDraft = {
    label: string;
    previewTitle: string;
    message: string;
    localImageUri: string;
    photoAnimation: ReminderPhotoAnimation;
};

export function useCustomReminders(userId: string | null | undefined) {
    const [reminders, setReminders] = useState<UserCustomReminder[]>([]);
    const [loading, setLoading] = useState(false);

    const refresh = useCallback(async () => {
        if (!userId) {
            setReminders([]);
            return;
        }

        setLoading(true);
        try {
            const loaded = await loadCustomReminders(userId);
            setReminders(loaded);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const persist = useCallback(
        async (next: UserCustomReminder[]) => {
            if (!userId) {
                return false;
            }

            await saveCustomReminders(userId, next);
            setReminders(next);
            return true;
        },
        [userId],
    );

    const createReminder = useCallback(
        async (draft: CustomReminderDraft) => {
            if (!userId) {
                return { success: false as const, error: 'Sign in to save custom reminders.' };
            }

            if (reminders.length >= MAX_CUSTOM_REMINDERS) {
                return {
                    success: false as const,
                    error: `You can save up to ${MAX_CUSTOM_REMINDERS} custom reminders.`,
                };
            }

            const now = new Date().toISOString();
            const next: UserCustomReminder = {
                id: createCustomReminderId(),
                label: draft.label.trim(),
                previewTitle: draft.previewTitle.trim(),
                message: draft.message.trim(),
                localImageUri: draft.localImageUri,
                photoAnimation: draft.photoAnimation,
                createdAt: now,
                updatedAt: now,
            };

            await persist([next, ...reminders]);
            return { success: true as const, reminder: next };
        },
        [persist, reminders, userId],
    );

    const updateReminder = useCallback(
        async (id: string, draft: CustomReminderDraft) => {
            if (!userId) {
                return { success: false as const, error: 'Sign in to save custom reminders.' };
            }

            const existing = reminders.find((item) => item.id === id);
            if (!existing) {
                return { success: false as const, error: 'Reminder not found.' };
            }

            const nextItem: UserCustomReminder = {
                ...existing,
                label: draft.label.trim(),
                previewTitle: draft.previewTitle.trim(),
                message: draft.message.trim(),
                localImageUri: draft.localImageUri,
                photoAnimation: draft.photoAnimation,
                updatedAt: new Date().toISOString(),
            };

            const next = reminders.map((item) => (item.id === id ? nextItem : item));
            await persist(next);
            return { success: true as const, reminder: nextItem };
        },
        [persist, reminders, userId],
    );

    const deleteReminder = useCallback(
        async (id: string) => {
            if (!userId) {
                return { success: false as const, error: 'Sign in to delete custom reminders.' };
            }

            const next = reminders.filter((item) => item.id !== id);
            await persist(next);
            return { success: true as const };
        },
        [persist, reminders, userId],
    );

    return {
        reminders,
        loading,
        refresh,
        createReminder,
        updateReminder,
        deleteReminder,
    };
}
