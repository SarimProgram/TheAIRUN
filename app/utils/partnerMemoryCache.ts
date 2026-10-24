import {
    copyAsync,
    documentDirectory,
    downloadAsync,
    getInfoAsync,
    makeDirectoryAsync,
} from 'expo-file-system/legacy';
import { API_BASE_URL } from '../config/api';

const MEMORY_DIR = `${documentDirectory}partner-memories/`;

async function ensureMemoryDir() {
    const info = await getInfoAsync(MEMORY_DIR);
    if (!info.exists) {
        await makeDirectoryAsync(MEMORY_DIR, { intermediates: true });
    }
}

export function getPartnerMemoryCachePath(memoryId: string) {
    return `${MEMORY_DIR}${memoryId}.jpg`;
}

export async function getCachedPartnerMemoryUri(memoryId: string) {
    if (!documentDirectory) return null;
    await ensureMemoryDir();
    const fileUri = getPartnerMemoryCachePath(memoryId);
    const info = await getInfoAsync(fileUri);
    return info.exists ? fileUri : null;
}

export async function cachePartnerMemoryFromUri(memoryId: string, sourceUri: string) {
    if (!documentDirectory) {
        throw new Error('Local storage is unavailable');
    }

    await ensureMemoryDir();
    const destUri = getPartnerMemoryCachePath(memoryId);
    await copyAsync({ from: sourceUri, to: destUri });
    return destUri;
}

export async function downloadPartnerMemoryImage(
    memoryId: string,
    accessToken: string | null,
    authFetch: (url: string, options?: RequestInit) => Promise<Response>,
) {
    if (!documentDirectory) {
        throw new Error('Local storage is unavailable');
    }

    const existing = await getCachedPartnerMemoryUri(memoryId);
    if (existing) {
        return existing;
    }

    await ensureMemoryDir();
    const destUri = getPartnerMemoryCachePath(memoryId);

    const headers: Record<string, string> = {};
    if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
    }

    const download = await downloadAsync(
        `${API_BASE_URL}/partner/memories/${memoryId}/image`,
        destUri,
        { headers },
    );

    if (download.status !== 200) {
        throw new Error(`Failed to download memory image (${download.status})`);
    }

    await authFetch(`${API_BASE_URL}/partner/memories/${memoryId}/ack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ downloaded: true }),
    });

    return destUri;
}
