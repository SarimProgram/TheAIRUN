import { Alert, Linking, Platform, Share } from 'react-native';

import { APP_NAME } from '@/constants/branding';

export type PartnerInviteShareDetails = {
    inviterName: string;
    inviteCode: string;
    toEmail?: string;
};

export function buildPartnerInviteShareMessage({
    inviterName,
    inviteCode,
    toEmail,
}: PartnerInviteShareDetails): string {
    const recipientLine = toEmail
        ? `3. Enter the code and accept the invite sent to ${toEmail}`
        : '3. Enter the code to accept the invite';

    return `${inviterName} invited you to join them on ${APP_NAME}.\n\nInvite code: ${inviteCode}\n\n1. Open the app\n2. Tap "I have a code"\n${recipientLine}`;
}

async function openExternalUrl(primaryUrl: string, fallbackUrl?: string) {
    try {
        await Linking.openURL(primaryUrl);
        return;
    } catch {
        // Try fallback below.
    }

    if (fallbackUrl) {
        try {
            await Linking.openURL(fallbackUrl);
            return;
        } catch {
            // Fall through to alert.
        }
    }

    Alert.alert('Unable to share', 'This app is not available on your device.');
}

export async function sharePartnerInviteNative(message: string) {
    await Share.share({ message });
}

export async function sharePartnerInviteWhatsApp(message: string) {
    const encoded = encodeURIComponent(message);
    const appUrl = `whatsapp://send?text=${encoded}`;
    const webUrl = `https://wa.me/?text=${encoded}`;

    try {
        if (await Linking.canOpenURL(appUrl)) {
            await Linking.openURL(appUrl);
            return;
        }
    } catch {
        // Fall back to web/deep link below.
    }

    await openExternalUrl(appUrl, webUrl);
}

export async function sharePartnerInviteSms(message: string) {
    const encoded = encodeURIComponent(message);
    const url = Platform.select({
        ios: `sms:&body=${encoded}`,
        android: `sms:?body=${encoded}`,
        default: `sms:?body=${encoded}`,
    });

    if (!url) {
        Alert.alert('Unable to share', 'SMS is not available on this device.');
        return;
    }

    await openExternalUrl(url);
}

export async function sharePartnerInviteTelegram(message: string) {
    const encoded = encodeURIComponent(message);
    const appUrl = `tg://msg?text=${encoded}`;
    const webUrl = `https://t.me/share/url?url=&text=${encoded}`;

    try {
        if (await Linking.canOpenURL(appUrl)) {
            await Linking.openURL(appUrl);
            return;
        }
    } catch {
        // Fall back to web/deep link below.
    }

    await openExternalUrl(appUrl, webUrl);
}

export type PartnerInviteShareChannel = 'whatsapp' | 'sms' | 'telegram' | 'native';

export async function sharePartnerInviteVia(channel: PartnerInviteShareChannel, message: string) {
    switch (channel) {
        case 'whatsapp':
            await sharePartnerInviteWhatsApp(message);
            break;
        case 'sms':
            await sharePartnerInviteSms(message);
            break;
        case 'telegram':
            await sharePartnerInviteTelegram(message);
            break;
        case 'native':
        default:
            await sharePartnerInviteNative(message);
            break;
    }
}
