import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { API_BASE_URL, getDefaultHeaders } from '@/config/api';

const STORAGE_KEY = 'guest_partner_invite_v1';
export type GuestPartnerInvite = {
  id: string; code: string; toEmail: null; status: 'PENDING'; createdAt: string; expiresAt: string;
};
type SavedGuestInvite = { ownerToken: string; invite?: GuestPartnerInvite };

async function readSaved(): Promise<SavedGuestInvite | null> {
  const value = await AsyncStorage.getItem(STORAGE_KEY);
  if (!value) return null;
  try {
    const saved = JSON.parse(value) as SavedGuestInvite;
    if (!/^[a-f0-9]{64}$/.test(saved.ownerToken)) return null;
    if (saved.invite && (!Number.isFinite(Date.parse(saved.invite.expiresAt)) || Date.parse(saved.invite.expiresAt) <= Date.now())) {
      await AsyncStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return saved;
  } catch { return null; }
}

export async function getStoredGuestPartnerInvite() {
  return (await readSaved())?.invite ?? null;
}

let creation: Promise<GuestPartnerInvite> | null = null;
export function getOrCreateGuestPartnerInvite(displayName: string): Promise<GuestPartnerInvite> {
  if (creation) return creation;
  creation = (async () => {
    const saved = await readSaved();
    if (saved?.invite) return saved.invite;
    const ownerToken = saved?.ownerToken ?? Array.from(await Crypto.getRandomBytesAsync(32), byte => byte.toString(16).padStart(2, '0')).join('');
    // Persist before the request so a lost response can retry the same code.
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ownerToken }));
    const response = await fetch(`${API_BASE_URL}/partner/invites/guest`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...getDefaultHeaders(API_BASE_URL) },
      body: JSON.stringify({ ownerToken, displayName: displayName.trim().slice(0, 120) || 'Your partner' }),
    });
    const data = await response.json();
    if (!response.ok) {
      if ([409, 410].includes(response.status)) await AsyncStorage.removeItem(STORAGE_KEY);
      throw new Error(data.error || 'Could not create your invite. Please try again.');
    }
    if (!data.invite?.code || !data.invite?.id || !data.invite?.expiresAt) throw new Error('Your invite was incomplete. Please try again.');
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ownerToken, invite: data.invite }));
    return data.invite as GuestPartnerInvite;
  })().finally(() => { creation = null; });
  return creation;
}

export async function claimStoredGuestPartnerInvite(accessToken: string) {
  const saved = await readSaved();
  if (!saved) return;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${API_BASE_URL}/partner/invites/guest/claim`, {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`, ...getDefaultHeaders(API_BASE_URL) },
      body: JSON.stringify({ ownerToken: saved.ownerToken }),
    });
    if (response.ok || [403, 404, 409, 410].includes(response.status)) {
      // Do not remove a newer guest invite created while this request was in flight.
      if ((await readSaved())?.ownerToken === saved.ownerToken) await AsyncStorage.removeItem(STORAGE_KEY);
    } else throw new Error('Could not link your guest invite yet.');
  } finally { clearTimeout(timeout); }
}
