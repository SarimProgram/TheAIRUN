import * as ImageManipulator from 'expo-image-manipulator';
import type { ReminderPhotoAnimation } from '@/components/partner/reminderPhotoAnimations';
import { DEFAULT_REMINDER_PHOTO_ANIMATION } from '@/components/partner/reminderPhotoAnimations';
import type { UserCustomReminder } from '@/utils/customReminderStorage';

export const CUSTOM_REMINDER_PREFIX = '[CUSTOM:v1]';
export const MAX_CUSTOM_REMINDER_PAYLOAD_BYTES = 120_000;

const VALID_ANIMATIONS = new Set<ReminderPhotoAnimation>([
    'beg',
    'bounce',
    'wiggle',
    'pulse',
    'float',
    'sideToSide',
    'pop',
    'tilt',
]);

export type CustomReminderPayload = {
    title: string;
    text: string;
    anim: ReminderPhotoAnimation;
    img: string;
};

export function customReminderTextHasDash(value: string) {
    return /[-\u2013\u2014]/.test(value);
}

export async function compressCustomReminderImage(imageUri: string) {
    const prepared = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 480 } }],
        { compress: 0.72, format: ImageManipulator.SaveFormat.JPEG, base64: true },
    );

    if (!prepared.base64) {
        throw new Error('Could not prepare reminder image.');
    }

    return prepared.base64;
}

export async function encodeCustomReminderMessage(
    reminder: Pick<UserCustomReminder, 'previewTitle' | 'message' | 'photoAnimation' | 'localImageUri'>,
): Promise<string> {
    const img = await compressCustomReminderImage(reminder.localImageUri);
    const payload: CustomReminderPayload = {
        title: reminder.previewTitle.trim(),
        text: reminder.message.trim(),
        anim: reminder.photoAnimation,
        img,
    };

    const encoded = `${CUSTOM_REMINDER_PREFIX}${JSON.stringify(payload)}`;
    if (encoded.length > MAX_CUSTOM_REMINDER_PAYLOAD_BYTES) {
        throw new Error('Reminder image is too large. Try a simpler photo.');
    }

    return encoded;
}

function parseAnimation(value: unknown): ReminderPhotoAnimation {
    if (typeof value === 'string' && VALID_ANIMATIONS.has(value as ReminderPhotoAnimation)) {
        return value as ReminderPhotoAnimation;
    }

    return DEFAULT_REMINDER_PHOTO_ANIMATION;
}

export function parseCustomReminderPayload(content: string): CustomReminderPayload | null {
    if (!content.startsWith(CUSTOM_REMINDER_PREFIX)) {
        return null;
    }

    try {
        const parsed = JSON.parse(content.slice(CUSTOM_REMINDER_PREFIX.length));
        if (!parsed || typeof parsed !== 'object') {
            return null;
        }

        const title = typeof parsed.title === 'string' ? parsed.title.trim() : '';
        const text = typeof parsed.text === 'string' ? parsed.text.trim() : '';
        const img = typeof parsed.img === 'string' ? parsed.img.trim() : '';

        if (!title || !text || !img) {
            return null;
        }

        return {
            title,
            text,
            anim: parseAnimation(parsed.anim),
            img,
        };
    } catch {
        return null;
    }
}

export function customReminderPreviewSource(base64: string) {
    return { uri: `data:image/jpeg;base64,${base64}` };
}
