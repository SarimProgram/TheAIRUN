import React from 'react';
import PremiumFullscreen from '@/components/home/PremiumFullscreen';
import type { InterventionCelebrationRequest } from '@/hooks/useInterventionCelebration';

type PartnerReminderPartnerViewPreviewProps = {
    request: InterventionCelebrationRequest | null;
    onFinish: () => void;
};

export function PartnerReminderPartnerViewPreview({
    request,
    onFinish,
}: PartnerReminderPartnerViewPreviewProps) {
    return (
        <PremiumFullscreen
            visible={!!request}
            request={request}
            onFinish={onFinish}
            suppressHaptics
        />
    );
}
