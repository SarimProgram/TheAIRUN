import Constants from 'expo-constants';
import { Platform } from 'react-native';

type ExpoExtra = {
  apiBaseUrl?: string;
  apiPort?: number;
  apiUrls?: {
    production?: string;
    staging?: string;
  };
};

const expoExtra = (Constants.expoConfig?.extra ?? {}) as ExpoExtra;
const DEFAULT_API_PORT = expoExtra.apiPort ?? 4000;
const configuredApiUrls = expoExtra.apiUrls ?? {};

type ApiTarget = 'local' | 'staging' | 'production';

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

function isConfiguredRemoteUrl(url?: string | null): boolean {
  return !!url?.trim();
}

function extractHost(value?: string | null): string | null {
  if (!value) return null;

  const normalized = value.includes('://') ? value : `http://${value}`;

  try {
    return new URL(normalized).hostname;
  } catch {
    return null;
  }
}

function getDevHost(): string | null {
  return (
    extractHost(Constants.expoConfig?.hostUri) ??
    extractHost(Constants.expoGoConfig?.debuggerHost) ??
    extractHost(Constants.manifest2?.extra?.expoGo?.debuggerHost)
  );
}

function getDefaultDevelopmentBaseUrl(): string {
  const devHost = getDevHost();

  if (Platform.OS === 'android') {
    const host = devHost && devHost !== 'localhost' ? devHost : '10.0.2.2';
    return `http://${host}:${DEFAULT_API_PORT}`;
  }

  if (Platform.OS === 'ios') {
    return `http://${devHost ?? '127.0.0.1'}:${DEFAULT_API_PORT}`;
  }

  return `http://${devHost ?? 'localhost'}:${DEFAULT_API_PORT}`;
}

function getApiTarget(): ApiTarget {
  const rawTarget = process.env.EXPO_PUBLIC_API_TARGET?.trim().toLowerCase();

  if (rawTarget === 'local' || rawTarget === 'staging' || rawTarget === 'production') {
    return rawTarget;
  }

  // In Expo dev builds on a physical device, "local" often points to a host
  // the device cannot reach. Prefer a configured remote backend when present.
  if (isConfiguredRemoteUrl(configuredApiUrls.staging)) {
    return 'staging';
  }

  if (isConfiguredRemoteUrl(configuredApiUrls.production ?? expoExtra.apiBaseUrl)) {
    return 'production';
  }

  return __DEV__ ? 'local' : 'production';
}

function getConfiguredBaseUrl(): string | null {
  const explicitUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (explicitUrl) {
    return normalizeUrl(explicitUrl);
  }

  const target = getApiTarget();

  if (target === 'local') {
    return getDefaultDevelopmentBaseUrl();
  }

  if (target === 'staging') {
    const stagingUrl = configuredApiUrls.staging;
    return stagingUrl ? normalizeUrl(stagingUrl) : null;
  }

  const productionUrl = configuredApiUrls.production ?? expoExtra.apiBaseUrl;
  return productionUrl ? normalizeUrl(productionUrl) : null;
}

export const API_BASE_URL = normalizeUrl(
  getConfiguredBaseUrl() ?? (__DEV__ ? getDefaultDevelopmentBaseUrl() : `http://localhost:${DEFAULT_API_PORT}`)
);

export const API_TARGET = getApiTarget();

export function getDefaultHeaders(url?: string): Record<string, string> {
  if (!url || !/ngrok/i.test(url)) {
    return {};
  }

  return {
    'ngrok-skip-browser-warning': 'true',
  };
}

export async function fetchBackendHealth() {
  const res = await fetch(`${API_BASE_URL}/health`, {
    headers: getDefaultHeaders(API_BASE_URL),
  });

  if (!res.ok) {
    throw new Error(`Backend error: ${res.status}`);
  }

  return res.json() as Promise<{
    ok: boolean;
    message: string;
    time: string;
  }>;
}
