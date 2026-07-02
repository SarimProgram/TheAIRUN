import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveTokens, clearTokens as clearStorageTokens, getAccessToken, getRefreshToken } from '@/utils/authstorage';
import { API_BASE_URL, getDefaultHeaders } from '@/config/api';
import { setAnalyticsUserId, setAnalyticsUserProperties, trackEvent } from '@/src/analytics/analytics';

interface AuthContextType {
    user: any;
    loading: boolean;
    isAuthenticated: boolean;
    accessToken: string | null;
    login: (email: string, password: string) => Promise<void>;
    register: (name: string, email: string, password: string) => Promise<void>;
    socialLogin: (provider: 'google' | 'apple', idToken: string, name?: string) => Promise<void>;
    logout: () => Promise<void>;
    deleteAccount: () => Promise<void>;
    authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [accessToken, setAccessToken] = useState<string | null>(null);

    const isAuthenticated = !!user;

    const applyAuthResponse = useCallback(async (data: any, fallbackUser?: any) => {
        if (data?.accessToken) {
            await saveTokens(data.accessToken, data.refreshToken);
            setAccessToken(data.accessToken);
            const resolvedUser = data.user || fallbackUser || null;
            setUser(resolvedUser);

            await setAnalyticsUserId(
                resolvedUser?.id ? String(resolvedUser.id) : resolvedUser?.email ?? null
            );
            await setAnalyticsUserProperties({
                auth_provider: resolvedUser?.provider ?? null,
                has_partner: resolvedUser?.partnerId ? 'true' : 'false',
            });
        }
    }, []);

    const clearBillingArtifacts = useCallback(async () => {
        try {
            await AsyncStorage.removeItem('billing_access_snapshot_v1');
        } catch {}

        try {
            const mod = require('react-native-purchases');
            const purchases = mod?.default ?? mod;
            if (typeof purchases?.logOut === 'function') {
                await purchases.logOut();
            }
        } catch {
            // RevenueCat may not be installed in local dev yet.
        }
    }, []);

    const clearSession = useCallback(async () => {
        await clearStorageTokens();
        await clearBillingArtifacts();
        setAccessToken(null);
        setUser(null);
        await setAnalyticsUserId(null);
    }, [clearBillingArtifacts]);

    const refreshSession = useCallback(async (): Promise<boolean> => {
        try {
            const refreshToken = await getRefreshToken();
            if (!refreshToken) return false;

            const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getDefaultHeaders(API_BASE_URL),
                },
                body: JSON.stringify({ refreshToken }),
            });

            const text = await res.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch {
                console.error('Failed to parse refresh response:', text.substring(0, 200));
                return false;
            }

            if (!res.ok) {
                if (res.status === 401) {
                    await clearSession();
                }
                return false;
            }

        if (data.accessToken) {
            await applyAuthResponse(data);
            return true;
        }

            return false;
        } catch (err) {
            console.log('Failed to refresh session', err);
            return false;
        }
    }, [applyAuthResponse, clearSession]);

    const loadUser = async () => {
        try {
            const token = await getAccessToken();
            if (token) {
                // Optionally fetch user profile if you have an endpoint
                // const res = await fetch(`${API_BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
                // const data = await res.json();
                // setUser(data.user);
                setAccessToken(token);
                setUser({ token }); // simplified for now
            }

            await refreshSession();
        } catch (e) {
            console.log('Error loading user', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadUser();
    }, [refreshSession]);

    useEffect(() => {
        const intervalId = setInterval(() => {
            refreshSession().catch(() => {});
        }, 10 * 60 * 1000);

        const sub = AppState.addEventListener('change', (state) => {
            if (state === 'active') {
                refreshSession().catch(() => {});
            }
        });

        return () => {
            clearInterval(intervalId);
            sub.remove();
        };
    }, [refreshSession]);

    // Authenticated fetch wrapper with Bearer token and optional tunnel-specific headers
    const authFetch = useCallback(async (url: string, options: RequestInit = {}): Promise<Response> => {
        let token = await getAccessToken();

        const headers: Record<string, string> = {
            ...getDefaultHeaders(url),
            ...(options.headers as Record<string, string> || {}),
        };

        // Auto-set Content-Type for JSON string bodies if not already set
        if (options.body && typeof options.body === 'string' && !headers['Content-Type'] && !headers['content-type']) {
            headers['Content-Type'] = 'application/json';
        }

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        let res = await fetch(url, {
            ...options,
            headers,
        });

        if (res.status === 401) {
            const refreshed = await refreshSession();
            if (refreshed) {
                token = await getAccessToken();
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                } else {
                    delete headers['Authorization'];
                }

                res = await fetch(url, {
                    ...options,
                    headers,
                });
            }
        }

        return res;
    }, [refreshSession]);

    const login = async (email: string, password: string) => {
        const res = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getDefaultHeaders(API_BASE_URL),
            },
            body: JSON.stringify({ email, password }),
        });

        const text = await res.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch {
            console.error('Failed to parse response:', text.substring(0, 200));
            throw new Error('Server returned invalid response. Check if backend is running.');
        }

        if (!res.ok) {
            throw new Error(data.message || 'Login failed');
        }

        await applyAuthResponse(data, { email });
        await trackEvent('login_success', { method: 'email' });
    };

    const register = async (name: string, email: string, password: string) => {
        const res = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getDefaultHeaders(API_BASE_URL),
            },
            body: JSON.stringify({ name, email, password }),
        });

        const text = await res.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch {
            console.error('Failed to parse response:', text.substring(0, 200));
            throw new Error('Server returned invalid response. Check if backend is running.');
        }

        if (!res.ok) {
            throw new Error(data.message || 'Registration failed');
        }

        await applyAuthResponse(data, { name, email });
        await trackEvent('register_success', { method: 'email' });
    };

    const socialLogin = async (provider: 'google' | 'apple', idToken: string, name?: string) => {
        const res = await fetch(`${API_BASE_URL}/auth/social`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getDefaultHeaders(API_BASE_URL),
            },
            body: JSON.stringify({ provider, idToken, name }),
        });

        const text = await res.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch {
            console.error('Failed to parse response:', text.substring(0, 200));
            throw new Error('Server returned invalid response. Check if backend is running.');
        }

        if (!res.ok) {
            throw new Error(data.message || `${provider} login failed`);
        }

        await applyAuthResponse(data);
        await trackEvent('login_success', { method: provider });
    };

    const logout = async () => {
        try {
            await authFetch(`${API_BASE_URL}/profile/push-token`, {
                method: 'DELETE',
            });
            await authFetch(`${API_BASE_URL}/profile/device-push-token`, {
                method: 'DELETE',
            });
            await authFetch(`${API_BASE_URL}/profile/live-activity-token`, {
                method: 'DELETE',
            });
        } catch {}

        await clearSession();
        await trackEvent('logout');
    };

    const deleteAccount = async () => {
        const res = await authFetch(`${API_BASE_URL}/profile`, {
            method: 'DELETE',
        });

        const text = await res.text();
        let data: any = {};
        if (text) {
            try {
                data = JSON.parse(text);
            } catch {
                data = {};
            }
        }

        if (!res.ok) {
            throw new Error(data?.message || 'Failed to delete account');
        }

        await clearSession();
        await trackEvent('account_deleted');
    };

    return (
        <AuthContext.Provider value={{ user, loading, isAuthenticated, accessToken, login, register, socialLogin, logout, deleteAccount, authFetch }}>
            {children}
        </AuthContext.Provider>
    );
};
