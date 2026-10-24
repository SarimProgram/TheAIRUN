import { useCallback, useState } from 'react';
import * as ImageManipulator from 'expo-image-manipulator';
import { API_BASE_URL } from '../config/api';
import {
    cachePartnerMemoryFromUri,
    downloadPartnerMemoryImage,
    getCachedPartnerMemoryUri,
} from '../utils/partnerMemoryCache';

export type PartnerMemoryRecord = {
    id: string;
    authorUserId: string;
    recipientUserId: string;
    caption: string | null;
    createdAt: string;
    imageAvailable: boolean;
    myAckedAt: string | null;
    localImageUri?: string | null;
};

type AuthFetch = (url: string, options?: RequestInit) => Promise<Response>;

async function prepareMemoryUploadUri(imageUri: string) {
    const prepared = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 1200 } }],
        { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG },
    );
    return prepared.uri;
}

async function readUploadErrorMessage(res: Response) {
    try {
        const data = await res.json();
        if (typeof data?.error === 'string' && data.error.trim()) {
            return data.error;
        }
        if (typeof data?.message === 'string' && data.message.trim()) {
            return data.message;
        }
    } catch {
        try {
            const text = await res.text();
            if (text.trim()) return text;
        } catch {
            // Ignore secondary parse failures.
        }
    }

    return `Upload failed (${res.status})`;
}

async function attachLocalImageUris(
    memories: PartnerMemoryRecord[],
    authFetch: AuthFetch,
    accessToken: string | null,
) {
    const enriched: PartnerMemoryRecord[] = [];

    for (const memory of memories) {
        let localImageUri = await getCachedPartnerMemoryUri(memory.id);

        if (!localImageUri && memory.imageAvailable) {
            try {
                localImageUri = await downloadPartnerMemoryImage(memory.id, accessToken, authFetch);
            } catch (error) {
                console.log('[partner-memories] download failed:', memory.id, error);
            }
        }

        enriched.push({
            ...memory,
            localImageUri,
        });
    }

    return enriched;
}

export function usePartnerMemories(
    authFetch: AuthFetch,
    accessToken: string | null,
    hasPartner?: boolean,
) {
    const [memories, setMemories] = useState<PartnerMemoryRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);

    const syncMemories = useCallback(async () => {
        if (!hasPartner) {
            setMemories([]);
            return;
        }

        setLoading(true);
        try {
            const res = await authFetch(`${API_BASE_URL}/partner/memories`);
            const data = await res.json().catch(() => ({ memories: [] }));
            if (!res.ok) {
                throw new Error(data?.error || 'Failed to load partner memories');
            }

            const records = Array.isArray(data.memories) ? data.memories : [];
            const enriched = await attachLocalImageUris(records, authFetch, accessToken);
            setMemories(enriched);
        } catch (error) {
            console.log('[partner-memories] sync failed:', error);
        } finally {
            setLoading(false);
        }
    }, [accessToken, authFetch, hasPartner]);

    const uploadMemory = useCallback(
        async (imageUri: string, caption?: string) => {
            if (!hasPartner) {
                throw new Error('You do not have a partner');
            }

            setUploading(true);
            try {
                const uploadUri = await prepareMemoryUploadUri(imageUri);
                const formData = new FormData();
                formData.append('image', {
                    uri: uploadUri,
                    name: 'memory.jpg',
                    type: 'image/jpeg',
                } as unknown as Blob);

                if (caption?.trim()) {
                    formData.append('caption', caption.trim());
                }

                let res: Response;
                try {
                    res = await authFetch(`${API_BASE_URL}/partner/memories`, {
                        method: 'POST',
                        body: formData,
                    });
                } catch (error: any) {
                    const message = String(error?.message ?? error ?? '');
                    if (/network request failed/i.test(message)) {
                        throw new Error(
                            'Could not reach the server. Make sure the latest backend is deployed and the partner memories migration has run.',
                        );
                    }
                    throw error;
                }

                if (!res.ok) {
                    throw new Error(await readUploadErrorMessage(res));
                }

                const data = await res.json().catch(() => ({}));
                const created = data.memory as PartnerMemoryRecord | undefined;
                if (!created?.id) {
                    await syncMemories();
                    return;
                }

                const localImageUri = await cachePartnerMemoryFromUri(created.id, uploadUri);
                setMemories((previous) => [
                    { ...created, localImageUri },
                    ...previous.filter((memory) => memory.id !== created.id),
                ]);
            } finally {
                setUploading(false);
            }
        },
        [authFetch, hasPartner, syncMemories],
    );

    return {
        memories,
        loading,
        uploading,
        syncMemories,
        uploadMemory,
    };
}
