import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Alert } from 'react-native';

import { StatusBar } from 'expo-status-bar';

import { useRouter } from 'expo-router';

import { useAuth } from '@/src/auth/authContext';

import { useChat } from '@/contexts/ChatContext';

import { usePoints } from '@/hooks/usePoints';

import { useCustomReminders } from '@/hooks/useCustomReminders';

import { API_BASE_URL } from '@/config/api';

import {

    ReminderPartner,

    mergePartnerReminderCategories,

    type PartnerReminderOption,

} from '@/components/partner/ReminderPartner';

import {

    formatPointsAlert,

    INTERVENE_ANIMATION_COST,

} from '@/components/home/InterveneBottomSheet';



type Partner = {

    id: string;

    displayName: string;

};



export default function PartnerReminderScreen() {

    const router = useRouter();

    const { authFetch, accessToken, isAuthenticated, user } = useAuth();

    const { connected: isPartnerConnected, sendMessage: sendChatMessage } = useChat();

    const { balance: pointsBalance, loading: pointsLoading, spend, refetch: refetchPoints } =

        usePoints({ accessToken });

    const customReminders = useCustomReminders(user?.id);



    const [partner, setPartner] = useState<Partner | null>(null);

    const [hasPartner, setHasPartner] = useState(false);



    const categories = useMemo(

        () => mergePartnerReminderCategories(customReminders.reminders),

        [customReminders.reminders],

    );



    const fetchPartner = useCallback(async () => {

        if (!isAuthenticated) return;

        try {

            const partnerRes = await authFetch(`${API_BASE_URL}/partner`);

            const partnerData = await partnerRes.json();

            setHasPartner(!!partnerData.hasPartner);

            setPartner(partnerData.partner ?? null);



            if (!partnerData.hasPartner) {

                router.replace('/Partner');

            }

        } catch (error) {

            console.log('[PartnerReminder] fetch error:', error);

        }

    }, [authFetch, isAuthenticated, router]);



    useEffect(() => {

        void fetchPartner();

    }, [fetchPartner]);



    const handleBack = useCallback(() => {

        if (router.canGoBack()) {

            router.back();

            return;

        }

        router.push('/Partner');

    }, [router]);



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



    const handleSendReminder = useCallback(

        (message: string, _label: string) => {

            sendMessage(message);

        },

        [sendMessage],

    );



    const handleSendPremiumReminder = useCallback(

        async (option: PartnerReminderOption, message: string) => {

            if (pointsBalance < INTERVENE_ANIMATION_COST) {

                Alert.alert('Not enough points', formatPointsAlert(INTERVENE_ANIMATION_COST));

                return false;

            }



            const spent = await spend(INTERVENE_ANIMATION_COST, 'calorie_intervention_animation');

            if (!spent) {

                Alert.alert('Not enough points', formatPointsAlert(INTERVENE_ANIMATION_COST));

                return false;

            }



            sendMessage(message);

            await refetchPoints();

            return true;

        },

        [pointsBalance, refetchPoints, sendMessage, spend],

    );



    if (!isAuthenticated || !hasPartner || !partner) {

        return null;

    }



    return (

        <>

            <StatusBar style="dark" />

            <ReminderPartner

                partnerName={partner.displayName}

                categories={categories}

                customReminders={customReminders}

                pointsBalance={pointsBalance}

                pointsLoading={pointsLoading}

                chatConnected={isPartnerConnected}

                onBack={handleBack}

                onSendReminder={handleSendReminder}

                onSendPremiumReminder={handleSendPremiumReminder}

            />

        </>

    );

}


