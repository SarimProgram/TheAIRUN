import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { API_BASE_URL } from '@/config/api';
import { getAccessToken } from '@/utils/authstorage';
import { normalizePlateItems, type PassMode, type PlateItem } from './meal-pass';

type AuthFetch = (input: string, init?: RequestInit) => Promise<Response>;
export type PassStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED';
export type PassPartner = { id: string; name: string; gender: string | null };
export type SharedMeal = {
  id: string; mode: PassMode; mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
  items: PlateItem[]; itemShares: number[]; status: PassStatus;
  createdAt: string; respondedAt: string | null; expiresAt: string;
  senderUserId: string; recipientUserId: string;
  senderName: string; senderGender: string | null; recipientName: string; recipientGender: string | null;
  hasPhoto: boolean; hasCutout: boolean; senderClientMealId: string | null;
};

const base = `${API_BASE_URL}/shared-meals`;

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : fallback);
  return data as T;
}

function parseMeal(raw: any): SharedMeal {
  const items = normalizePlateItems(Array.isArray(raw?.items) ? raw.items : []);
  const shares = Array.isArray(raw?.itemShares) ? raw.itemShares.map(Number) : [];
  return { ...raw, items, itemShares: items.map((_, index) => (Number.isFinite(shares[index]) ? shares[index] : 0)) };
}

export async function fetchPassPartner(authFetch: AuthFetch): Promise<PassPartner | null> {
  const response = await authFetch(`${base}/partner`);
  if (response.status !== 404) {
    return (await readJson<{ partner: PassPartner | null }>(response, 'Could not load your partner')).partner;
  }
  // Servers without plate passing yet still know the partner; sending reports the gap instead of hiding the choice.
  const data = await readJson<{ partner: { id: string; displayName?: string | null; gender?: string | null } | null }>(
    await authFetch(`${API_BASE_URL}/partner`), 'Could not load your partner');
  return data.partner ? { id: data.partner.id, name: data.partner.displayName || 'Your partner', gender: data.partner.gender ?? null } : null;
}

export async function fetchPendingSharedMeals(authFetch: AuthFetch): Promise<SharedMeal[]> {
  const data = await readJson<{ meals: unknown[] }>(await authFetch(`${base}/pending`), 'Could not load passed plates');
  return (data.meals ?? []).map(parseMeal);
}

export async function fetchSharedMeal(authFetch: AuthFetch, id: string): Promise<SharedMeal> {
  const data = await readJson<{ meal: unknown }>(await authFetch(`${base}/${id}`), 'This plate is no longer available');
  return parseMeal(data.meal);
}

export async function respondToSharedMeal(authFetch: AuthFetch, id: string, action: 'accept' | 'decline', itemShares?: number[]) {
  const data = await readJson<{ meal: unknown }>(await authFetch(`${base}/${id}/respond`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, itemShares }),
  }), action === 'accept' ? 'Could not log this plate. Try again.' : 'Could not decline this plate. Try again.');
  return parseMeal(data.meal);
}

export async function createSharedMeal(authFetch: AuthFetch, params: {
  clientId: string; mode: PassMode; mealType: SharedMeal['mealType']; items: PlateItem[]; itemShares: number[];
  senderClientMealId?: string; xPct: number; photoUri?: string | null; cutoutUri?: string | null;
}): Promise<SharedMeal> {
  const form = new FormData();
  const { photoUri, cutoutUri, ...payload } = params;
  form.append('payload', JSON.stringify(payload));
  if (photoUri) {
    const photo = await ImageManipulator.manipulateAsync(photoUri, [{ resize: { width: 900 } }], { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG });
    form.append('photo', { uri: photo.uri, type: 'image/jpeg', name: 'meal.jpg' } as any);
  }
  let cutoutFile: string | null = null;
  if (cutoutUri?.startsWith('data:image/png;base64,')) {
    cutoutFile = `${FileSystem.cacheDirectory}meal-pass-${params.clientId}.png`;
    await FileSystem.writeAsStringAsync(cutoutFile, cutoutUri.slice('data:image/png;base64,'.length), { encoding: FileSystem.EncodingType.Base64 });
    form.append('cutout', { uri: cutoutFile, type: 'image/png', name: 'cutout.png' } as any);
  }
  try {
    const response = await authFetch(base, { method: 'POST', body: form });
    if (response.status === 404) throw new Error('Plate passing isn\u2019t live on the server yet.');
    const data = await readJson<{ meal: unknown }>(response, 'Could not pass the plate. Try again.');
    return parseMeal(data.meal);
  } finally {
    if (cutoutFile) FileSystem.deleteAsync(cutoutFile, { idempotent: true }).catch(() => {});
  }
}

const imageRequests = new Map<string, Promise<string>>();

/** Downloads a plate photo once into the cache; credentials never go to the storage bucket. */
export function sharedMealImage(authFetch: AuthFetch, meal: SharedMeal, kind: 'photo' | 'cutout'): Promise<string> {
  const key = `${meal.id}:${kind}`;
  const existing = imageRequests.get(key);
  if (existing) return existing;
  const request = (async () => {
    const file = `${FileSystem.cacheDirectory}meal-pass-${meal.id}-${kind}.${kind === 'cutout' ? 'png' : 'jpg'}`;
    if ((await FileSystem.getInfoAsync(file)).exists) return file;
    const endpoint = `${base}/${meal.id}/image/${kind}`;
    const data = await readJson<{ url: string | null }>(await authFetch(`${endpoint}?delivery=url`), 'Photo unavailable');
    const source = data.url ? { url: data.url } : { url: endpoint, headers: { Authorization: `Bearer ${await getAccessToken()}` } };
    const partial = `${file}.part`;
    const result = await FileSystem.downloadAsync(source.url, partial, { headers: source.headers });
    if (result.status !== 200) {
      await FileSystem.deleteAsync(partial, { idempotent: true });
      throw new Error('Photo unavailable');
    }
    await FileSystem.moveAsync({ from: partial, to: file });
    return file;
  })();
  imageRequests.set(key, request);
  request.catch(() => imageRequests.delete(key));
  return request;
}
