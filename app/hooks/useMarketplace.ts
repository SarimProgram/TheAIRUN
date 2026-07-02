// app/hooks/useMarketplace.ts
// Hook to fetch marketplace items and manage user wallet

import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../config/api';

export interface MarketplaceItem {
    id: string;
    title: string;
    description?: string | null;
    cost: number;
    category: string;
    emoji: string;
    color: string[];
    isCustom?: boolean;
    createdByUserId?: string | null;
    canManage?: boolean;
}

export interface WalletItem {
    id: string;
    title: string;
    by: string;
    status: string;
    icon: string;
    canUndo?: boolean;
    undoExpiresAt?: string;
    canComplete?: boolean;
    canDelete?: boolean;
}

export interface MarketplaceHistoryItem {
    id: string;
    title: string;
    icon: string;
    status: string;
    boughtByName: string;
    owedByName: string;
    boughtAt: string;
    fulfilledAt: string | null;
}

interface UseMarketplaceOptions {
    accessToken: string | null;
}

interface UseMarketplaceReturn {
    items: MarketplaceItem[];
    wallet: WalletItem[];
    history: MarketplaceHistoryItem[];
    loading: boolean;
    error: string | null;
    refetchItems: () => Promise<void>;
    refetchWallet: () => Promise<void>;
    refetchHistory: () => Promise<void>;
    redeem: (itemId: string) => Promise<{ success: boolean; balance?: number; error?: string }>;
    createItem: (payload: {
        title: string;
        description?: string | null;
        cost: number;
        category: 'Romantic' | 'Fun' | 'Chore' | 'Spicy';
        emoji: string;
    }) => Promise<{ success: boolean; error?: string }>;
    updateItem: (
        itemId: string,
        payload: Partial<{
            title: string;
            description: string | null;
            cost: number;
            category: 'Romantic' | 'Fun' | 'Chore' | 'Spicy';
            emoji: string;
            isActive: boolean;
        }>
    ) => Promise<{ success: boolean; error?: string }>;
    deleteItem: (itemId: string) => Promise<{ success: boolean; error?: string }>;
    completeWalletItem: (walletItemId: string) => Promise<boolean>;
    undoWalletItem: (walletItemId: string) => Promise<{ success: boolean; refundedPoints?: number; error?: string }>;
    deleteWalletItem: (walletItemId: string) => Promise<boolean>;
}

export function useMarketplace({ accessToken }: UseMarketplaceOptions): UseMarketplaceReturn {
    const [items, setItems] = useState<MarketplaceItem[]>([]);
    const [wallet, setWallet] = useState<WalletItem[]>([]);
    const [history, setHistory] = useState<MarketplaceHistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const parseResponseBody = async (response: Response) => {
        const text = await response.text();
        if (!text) return {};
        try {
            return JSON.parse(text);
        } catch {
            return { message: text.substring(0, 200) };
        }
    };

    const getApiErrorMessage = (data: any, fallback: string) => {
        if (data?.code === 'PREMIUM_REQUIRED') return 'Premium required';
        return data?.error || data?.message || fallback;
    };

    const fetchItems = useCallback(async () => {
        if (!accessToken) {
            setItems([]);
            return;
        }
        try {
            const response = await fetch(`${API_BASE_URL}/marketplace/items`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true',
                },
            });
            const data = await parseResponseBody(response);
            if (!response.ok) throw new Error(getApiErrorMessage(data, 'Failed to fetch items'));
            setItems(data);
        } catch (err) {
            console.error('[useMarketplace] Error fetching items:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
        }
    }, [accessToken]);

    const fetchWallet = useCallback(async () => {
        if (!accessToken) return;

        try {
            const response = await fetch(`${API_BASE_URL}/marketplace/wallet`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true',
                },
            });
            const data = await parseResponseBody(response);
            if (!response.ok) throw new Error(getApiErrorMessage(data, 'Failed to fetch wallet'));
            setWallet(data);
        } catch (err) {
            console.error('[useMarketplace] Error fetching wallet:', err);
        }
    }, [accessToken]);

    const fetchHistory = useCallback(async () => {
        if (!accessToken) {
            setHistory([]);
            return;
        }
        try {
            const response = await fetch(`${API_BASE_URL}/marketplace/history`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true',
                },
            });
            const data = await parseResponseBody(response);
            if (!response.ok) throw new Error(getApiErrorMessage(data, 'Failed to fetch history'));
            setHistory(Array.isArray(data.history) ? data.history : []);
        } catch (err) {
            console.error('[useMarketplace] Error fetching history:', err);
        }
    }, [accessToken]);

    const redeem = useCallback(async (itemId: string) => {
        if (!accessToken) return { success: false, error: 'Not authenticated' };

        try {
            const response = await fetch(`${API_BASE_URL}/marketplace/redeem`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true',
                },
                body: JSON.stringify({ itemId }),
            });

            const data = await parseResponseBody(response);

            if (!response.ok) {
                return { success: false, error: getApiErrorMessage(data, 'Failed to redeem') };
            }

            // Refresh wallet after successful redemption
            await Promise.all([fetchWallet(), fetchHistory()]);
            return { success: true, balance: data.balance };
        } catch (err) {
            console.error('[useMarketplace] Error redeeming:', err);
            return { success: false, error: 'Failed to redeem item' };
        }
    }, [accessToken, fetchWallet, fetchHistory]);

    const createItem = useCallback(async (payload: {
        title: string;
        description?: string | null;
        cost: number;
        category: 'Romantic' | 'Fun' | 'Chore' | 'Spicy';
        emoji: string;
    }) => {
        if (!accessToken) return { success: false, error: 'Not authenticated' };
        try {
            const response = await fetch(`${API_BASE_URL}/marketplace/items`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true',
                },
                body: JSON.stringify(payload),
            });
            const data = await parseResponseBody(response);
            if (!response.ok) return { success: false, error: getApiErrorMessage(data, 'Failed to create item') };
            await fetchItems();
            return { success: true };
        } catch (err) {
            console.error('[useMarketplace] Error creating item:', err);
            return { success: false, error: 'Failed to create item' };
        }
    }, [accessToken, fetchItems]);

    const updateItem = useCallback(async (
        itemId: string,
        payload: Partial<{
            title: string;
            description: string | null;
            cost: number;
            category: 'Romantic' | 'Fun' | 'Chore' | 'Spicy';
            emoji: string;
            isActive: boolean;
        }>
    ) => {
        if (!accessToken) return { success: false, error: 'Not authenticated' };
        try {
            const response = await fetch(`${API_BASE_URL}/marketplace/items/${itemId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true',
                },
                body: JSON.stringify(payload),
            });
            const data = await parseResponseBody(response);
            if (!response.ok) return { success: false, error: getApiErrorMessage(data, 'Failed to update item') };
            await fetchItems();
            return { success: true };
        } catch (err) {
            console.error('[useMarketplace] Error updating item:', err);
            return { success: false, error: 'Failed to update item' };
        }
    }, [accessToken, fetchItems]);

    const deleteItem = useCallback(async (itemId: string) => {
        if (!accessToken) return { success: false, error: 'Not authenticated' };
        try {
            const response = await fetch(`${API_BASE_URL}/marketplace/items/${itemId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true',
                },
            });
            const data = await parseResponseBody(response);
            if (!response.ok) return { success: false, error: getApiErrorMessage(data, 'Failed to delete item') };
            await fetchItems();
            return { success: true };
        } catch (err) {
            console.error('[useMarketplace] Error deleting item:', err);
            return { success: false, error: 'Failed to delete item' };
        }
    }, [accessToken, fetchItems]);

    const completeWalletItem = useCallback(async (walletItemId: string) => {
        if (!accessToken) return false;

        try {
            const response = await fetch(`${API_BASE_URL}/marketplace/wallet/${walletItemId}/complete`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true',
                },
            });

            if (!response.ok) return false;

            // Remove completed item from wallet and refresh history
            setWallet(prev => prev.filter(w => w.id !== walletItemId));
            fetchHistory().catch(() => {});
            return true;
        } catch (err) {
            console.error('[useMarketplace] Error completing wallet item:', err);
            return false;
        }
    }, [accessToken, fetchHistory]);

    const undoWalletItem = useCallback(async (walletItemId: string) => {
        if (!accessToken) return { success: false, error: 'Not authenticated' };

        try {
            const response = await fetch(`${API_BASE_URL}/marketplace/wallet/${walletItemId}/undo`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true',
                },
            });

            const data = await parseResponseBody(response);
            if (!response.ok) return { success: false, error: getApiErrorMessage(data, 'Failed to undo reward') };

            await Promise.all([fetchWallet(), fetchHistory()]);
            return { success: true, refundedPoints: data.refundedPoints };
        } catch (err) {
            console.error('[useMarketplace] Error undoing wallet item:', err);
            return { success: false, error: 'Failed to undo reward' };
        }
    }, [accessToken, fetchWallet, fetchHistory]);

    const deleteWalletItem = useCallback(async (walletItemId: string) => {
        if (!accessToken) return false;

        try {
            const response = await fetch(`${API_BASE_URL}/marketplace/wallet/${walletItemId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true',
                },
            });

            if (!response.ok) return false;

            // Remove deleted item from wallet
            setWallet(prev => prev.filter(w => w.id !== walletItemId));
            fetchHistory().catch(() => {});
            return true;
        } catch (err) {
            console.error('[useMarketplace] Error deleting wallet item:', err);
            return false;
        }
    }, [accessToken, fetchHistory]);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            await Promise.all([fetchItems(), fetchWallet(), fetchHistory()]);
            setLoading(false);
        };
        loadData();
    }, [fetchItems, fetchWallet, fetchHistory]);

    return {
        items,
        wallet,
        history,
        loading,
        error,
        refetchItems: fetchItems,
        refetchWallet: fetchWallet,
        refetchHistory: fetchHistory,
        redeem,
        createItem,
        updateItem,
        deleteItem,
        completeWalletItem,
        undoWalletItem,
        deleteWalletItem,
    };
}
