import { parseInterventionMessage, getInterventionDisplayTitle } from '@/components/chat/partnerNoteShared';
import { CUSTOM_REMINDER_PREFIX } from '@/utils/customReminderMessage';
import type { InterventionCelebrationRequest } from '@/hooks/useInterventionCelebration';
import type { PartnerReminderOption } from '@/components/partner/ReminderPartner';

export function buildPartnerCelebrationRequest(
    option: PartnerReminderOption,
    partnerName: string,
    devKey?: string,
): InterventionCelebrationRequest | null {
    if (option.delivery !== 'fullscreen' || !option.mode) {
        return null;
    }

    if (option.isUserCustom) {
        const fromName = partnerName.split(/\s+/)[0]?.toUpperCase() || 'PARTNER';
        const message = option.buildMessage(partnerName).trim();
        return {
            key: devKey ?? `preview-${option.id}`,
            mode: 'photo',
            previewImage: option.previewImage,
            photoAnimation: option.photoAnimation,
            copy: {
                eyebrow: option.previewTitle.trim()
                    ? `${fromName} · ${option.previewTitle.trim().toUpperCase()}`
                    : `${fromName} · YOUR REMINDER`,
                title: message || option.previewTitle,
                fromPartner: true,
            },
        };
    }

    const message = option.buildMessage(partnerName);
    const parsed = parseInterventionMessage(message);
    if (!parsed || parsed.mode === 'plain') {
        return null;
    }

    const fromName = partnerName.split(/\s+/)[0]?.toUpperCase() || 'PARTNER';
    const isWater = /^\[WATER/i.test(message);
    const isKcal = /^\[KCAL/i.test(message);
    const isCustom = message.startsWith(CUSTOM_REMINDER_PREFIX);

    return {
        key: devKey ?? `preview-${option.id}`,
        mode: parsed.mode,
        previewImage: option.previewImage ?? parsed.previewImage,
        photoAnimation: option.photoAnimation ?? parsed.photoAnimation,
        copy: {
            eyebrow: isCustom
                ? `${fromName} · YOUR REMINDER`
                : isWater
                ? `${fromName} · HYDRATION`
                : isKcal
                  ? `${fromName} · CALORIE CHECK`
                  : `${fromName} · STEP BATTLE`,
            title: getInterventionDisplayTitle(message),
            fromPartner: true,
        },
    };
}
