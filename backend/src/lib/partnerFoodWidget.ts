import { createHash, randomBytes } from 'node:crypto';

import { prisma } from '../db/prisma';
import { photoDownloadUrl } from '../services/workoutPhotoStorage';
import { sendWidgetReloadPush } from './apns';
import { recipientPortion, type PlateItem } from './mealSplit';
import { dayKeyInTimezone } from './weekBounds';

export const PARTNER_FOOD_WIDGET_KIND = 'partner_food';
/** Keep in sync with app/lib/partner-food-widget.ts and the portrait files the app copies into the app group. */
const IMAGE_PREFIX = 'partner-food-';
const PORTRAITS: Record<string, string> = { male: 'partner-kcals-man-v2.png', female: 'partner-kcals-woman-v2.png' };
const SHARED = 'shared-container:';

export type PartnerFoodProps = {
    mealId: string; senderName: string; mealType: string; foods: string; kcal: number;
    status: string; sentAt: string; expiresAt: string; imageUri: string; imageIsCutout: boolean; portraitUri: string;
};
export type PartnerFoodFeed = {
    entries: { timestamp: number; props: PartnerFoodProps }[];
    files: { name: string; url: string; auth: boolean }[];
    prunePrefix: string;
};

export const EMPTY_PARTNER_FOOD: PartnerFoodProps = {
    mealId: '', senderName: '', mealType: '', foods: '', kcal: 0, status: '', sentAt: '', expiresAt: '',
    imageUri: '', imageIsCutout: false, portraitUri: '',
};

export function createFeedToken() {
    return randomBytes(32).toString('base64url');
}

export function hashFeedToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
}

/** The first instant after `now` that falls on a later calendar day in `timezone`. */
export function nextMidnightInTimezone(now: Date, timezone: string) {
    const today = dayKeyInTimezone(now, timezone);
    let probe = now.getTime();
    while (dayKeyInTimezone(new Date(probe), timezone) === today) probe += 60 * 60 * 1000;
    let low = probe - 60 * 60 * 1000;
    while (probe - low > 1) {
        const mid = Math.floor((low + probe) / 2);
        if (dayKeyInTimezone(new Date(mid), timezone) === today) low = mid; else probe = mid;
    }
    return new Date(probe);
}

type PlateRow = {
    id: string; mealType: string; items: unknown; itemShares: unknown; status: string;
    createdAt: Date; respondedAt: Date | null; expiresAt: Date; photoPath: string | null; cutoutPath: string | null;
    sender: { displayName: string; gender: string | null };
};

function safeTimezone(timezone: string | null | undefined) {
    try {
        if (timezone) new Intl.DateTimeFormat('en-US', { timeZone: timezone });
        return timezone || 'UTC';
    } catch {
        return 'UTC';
    }
}

/** A waiting plate outranks a logged one; among each, newest wins. Logged plates only count today. */
export function choosePlate<T extends Pick<PlateRow, 'status' | 'createdAt' | 'respondedAt' | 'expiresAt'>>(rows: T[], now: Date, timezone: string) {
    const live = rows.filter((row) => row.expiresAt.getTime() > now.getTime());
    const newest = (list: T[]) => [...list].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null;
    const today = dayKeyInTimezone(now, timezone);
    return newest(live.filter((row) => row.status === 'PENDING'))
        ?? newest(live.filter((row) => row.status === 'ACCEPTED' && dayKeyInTimezone(row.respondedAt ?? row.createdAt, timezone) === today));
}

/** Builds the widget timeline: the plate now, then empty at expiry (waiting) or local midnight (logged). */
export async function buildPartnerFoodFeed(userId: string, now = new Date()): Promise<PartnerFoodFeed> {
    const empty: PartnerFoodFeed = { entries: [{ timestamp: now.getTime(), props: EMPTY_PARTNER_FOOD }], files: [], prunePrefix: IMAGE_PREFIX };
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { partnerId: true, timezone: true } });
    if (!user?.partnerId) return empty;
    const partner = await prisma.user.findFirst({ where: { id: user.partnerId, partnerId: userId }, select: { id: true } });
    if (!partner) return empty;

    const timezone = safeTimezone(user.timezone);
    const rows: PlateRow[] = await prisma.sharedMeal.findMany({
        where: { recipientUserId: userId, senderUserId: partner.id, status: { in: ['PENDING', 'ACCEPTED'] }, expiresAt: { gt: now } },
        orderBy: { createdAt: 'desc' }, take: 10,
        select: {
            id: true, mealType: true, items: true, itemShares: true, status: true, createdAt: true, respondedAt: true,
            expiresAt: true, photoPath: true, cutoutPath: true, sender: { select: { displayName: true, gender: true } },
        },
    });
    const plate = choosePlate(rows, now, timezone);
    if (!plate) return empty;

    const items = (Array.isArray(plate.items) ? plate.items : []) as PlateItem[];
    const shares = (Array.isArray(plate.itemShares) ? plate.itemShares : []).map(Number);
    const portion = recipientPortion(items, shares);
    const names = (portion.length ? portion : items).map((item) => String(item.foodName ?? '').trim()).filter(Boolean);

    const files: PartnerFoodFeed['files'] = [];
    const kind = plate.cutoutPath ? 'cutout' : plate.photoPath ? 'photo' : null;
    let imageUri = '';
    if (kind) {
        const name = `${IMAGE_PREFIX}${plate.id}.${kind === 'cutout' ? 'png' : 'jpg'}`;
        const signed = await photoDownloadUrl((kind === 'cutout' ? plate.cutoutPath : plate.photoPath)!, plate.expiresAt, now).catch(() => null);
        files.push(signed
            ? { name, url: signed, auth: false }
            : { name, url: `/widgets/partner-food/image/${plate.id}/${kind}`, auth: true });
        imageUri = `${SHARED}${name}`;
    }
    const portrait = PORTRAITS[String(plate.sender.gender ?? '').trim().toLowerCase()];

    const props: PartnerFoodProps = {
        mealId: plate.id,
        senderName: plate.sender.displayName || 'Your partner',
        mealType: plate.mealType,
        foods: names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', '),
        kcal: Math.round(portion.reduce((sum, item) => sum + (Number(item.calories) || 0), 0)),
        status: plate.status,
        sentAt: plate.createdAt.toISOString(),
        expiresAt: plate.expiresAt.toISOString(),
        imageUri,
        imageIsCutout: kind === 'cutout',
        portraitUri: portrait ? `${SHARED}${portrait}` : '',
    };
    const clearAt = plate.status === 'PENDING' ? plate.expiresAt : nextMidnightInTimezone(now, timezone);
    return {
        entries: [{ timestamp: now.getTime(), props }, { timestamp: clearAt.getTime(), props: EMPTY_PARTNER_FOOD }],
        files,
        prunePrefix: IMAGE_PREFIX,
    };
}

function isDeadToken(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return /\b410\b|BadDeviceToken|Unregistered|DeviceTokenNotForTopic/.test(message);
}

/** Asks every partner-food widget of this user to reload. Never throws; dead tokens are removed. */
export async function notifyPartnerFoodWidgets(userId: string) {
    try {
        const devices = await prisma.widgetPushDevice.findMany({ where: { userId, kind: PARTNER_FOOD_WIDGET_KIND } });
        await Promise.all(devices.map(async (device) => {
            try {
                const result = await sendWidgetReloadPush({ pushToken: device.pushToken });
                if (!result.skipped) {
                    await prisma.widgetPushDevice.update({ where: { id: device.id }, data: { lastPushedAt: new Date() } });
                }
            } catch (error) {
                if (isDeadToken(error)) {
                    await prisma.widgetPushDevice.delete({ where: { id: device.id } }).catch(() => {});
                } else {
                    console.error('[PartnerFoodWidget] Push failed:', error);
                }
            }
        }));
    } catch (error) {
        console.error('[PartnerFoodWidget] Notify failed:', error);
    }
}
