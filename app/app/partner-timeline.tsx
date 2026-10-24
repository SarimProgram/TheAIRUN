import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/auth/authContext';
import { useChat } from '@/contexts/ChatContext';
import { ConnectedPartners } from '@/components/partner/ConnectedPartners';
import { usePartnerTimelineData } from '@/hooks/usePartnerTimelineData';
import { API_BASE_URL } from '@/config/api';
import { journeyStartWeightToKg } from '@/utils/partnerTimeline';

type Partner = {
    id: string;
    displayName: string;
    weightUnit?: string | null;
    weightLost?: number | null;
    startWeight?: number | null;
    currentWeight?: number | null;
};

type CurrentUser = {
    id: string;
    displayName: string;
    units?: string | null;
};

export default function PartnerTimelineScreen() {
    const router = useRouter();
    const { authFetch, accessToken, isAuthenticated } = useAuth();
    const { connected: isPartnerConnected, sendMessage: sendChatMessage } = useChat();

    const [partner, setPartner] = useState<Partner | null>(null);
    const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
    const [partnerLinkedAt, setPartnerLinkedAt] = useState<string | null>(null);
    const [hasPartner, setHasPartner] = useState(false);
    const [waterNudgeSentAt, setWaterNudgeSentAt] = useState<number | null>(null);

    const timeline = usePartnerTimelineData(authFetch, accessToken, hasPartner);

    const fetchProfile = useCallback(async () => {
        if (!isAuthenticated) return;
        try {
            const [profileRes, partnerRes] = await Promise.all([
                authFetch(`${API_BASE_URL}/profile`),
                authFetch(`${API_BASE_URL}/partner`),
            ]);
            const profileData = await profileRes.json();
            const partnerData = await partnerRes.json();

            if (profileData.user) {
                setCurrentUser({
                    id: profileData.user.id,
                    displayName: profileData.user.displayName,
                    units: profileData.user.units,
                });
            }

            setHasPartner(!!partnerData.hasPartner);
            setPartner(partnerData.partner ?? null);
            setPartnerLinkedAt(partnerData.partnerLinkedAt ?? null);

            if (!partnerData.hasPartner) {
                router.replace('/Partner');
            }
        } catch (error) {
            console.log('[PartnerTimeline] profile fetch error:', error);
        }
    }, [authFetch, isAuthenticated, router]);

    useEffect(() => {
        void fetchProfile();
    }, [fetchProfile]);

    useEffect(() => {
        if (!waterNudgeSentAt) return;
        const remaining = 60 * 60 * 1000 - (Date.now() - waterNudgeSentAt);
        if (remaining <= 0) {
            setWaterNudgeSentAt(null);
            return;
        }
        const timer = setTimeout(() => setWaterNudgeSentAt(null), remaining);
        return () => clearTimeout(timer);
    }, [waterNudgeSentAt]);

    const daysTogether = useMemo(() => {
        if (!partnerLinkedAt) return 1;
        const start = new Date(partnerLinkedAt);
        if (Number.isNaN(start.getTime())) return 1;
        start.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diffMs = today.getTime() - start.getTime();
        return Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1);
    }, [partnerLinkedAt]);

    const partnerUsesImperial = partner?.weightUnit === 'lbs';
    const myUsesImperial = currentUser?.units === 'imperial';
    const partnerBaselineWeightKg = useMemo(
        () => journeyStartWeightToKg(partner?.startWeight, partnerUsesImperial),
        [partner?.startWeight, partnerUsesImperial],
    );

    const sendMessage = useCallback(
        (message: string) => {
            if (!isPartnerConnected) {
                Alert.alert('Chat unavailable', 'Live partner chat is not available right now.');
                return;
            }
            sendChatMessage(message);
        },
        [isPartnerConnected, sendChatMessage],
    );

    const sendWaterNudge = useCallback(() => {
        if (!partner) return;
        sendMessage(`HEY ${partner.displayName.toUpperCase()}! Drink some water right now.`);
        setWaterNudgeSentAt(Date.now());
    }, [partner, sendMessage]);

    const sendCaloriesNudge = useCallback(() => {
        if (!partner) return;
        Alert.alert('Nudge Partner', `Send ${partner.displayName} a calorie nudge?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Gentle',
                onPress: () => sendMessage("You've got this. Small reset and finish strong on calories today."),
            },
            {
                text: 'Coach',
                onPress: () =>
                    sendMessage('Quick calorie nudge: keep the next meal lighter and you can still recover today.'),
            },
        ]);
    }, [partner, sendMessage]);

    const handleBack = useCallback(() => {
        if (router.canGoBack()) {
            router.back();
            return;
        }
        router.push('/Partner');
    }, [router]);

    if (!isAuthenticated || !hasPartner || !partner) {
        return null;
    }

    return (
        <ConnectedPartners
            userName={currentUser?.displayName ?? 'You'}
            partnerName={partner.displayName}
            daysTogether={daysTogether}
            weekStart={timeline.partnerWeekStart}
            days={timeline.partnerWeekDays}
            plannedDays={timeline.partnerPlannedDays}
            pointsHistory={timeline.pointsHistory}
            myPointsHistory={timeline.myPointsHistory}
            partnerWeightHistory={timeline.partnerWeightHistory}
            myWeightHistory={timeline.myWeightHistory}
            partnerUsesImperial={partnerUsesImperial}
            myUsesImperial={myUsesImperial}
            partnerBaselineWeightKg={partnerBaselineWeightKg}
            partnerJourneyWeightLost={partner.weightLost}
            partnerJourneyCurrentWeight={partner.currentWeight}
            partnerMemories={timeline.partnerMemories}
            partnerMarketplaceHistory={timeline.partnerMarketplaceHistory}
            currentUserId={currentUser?.id}
            memoryUploading={timeline.memoryUploading}
            scheduledRuns={timeline.scheduledRuns}
            myTodaySummary={timeline.myTodaySummary}
            wagerOverview={timeline.wagerOverview}
            waterNudgeSent={!!waterNudgeSentAt}
            loading={timeline.loading}
            onBack={handleBack}
            onSharePhoto={timeline.uploadMemory}
            onCaloriesNudge={sendCaloriesNudge}
            onWaterNudge={sendWaterNudge}
        />
    );
}
