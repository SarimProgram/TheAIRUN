import React, { createContext, useContext, useEffect, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../src/auth/authContext';

export type HomeAvatarChoice = { kind: 'cute'; character: 'male' | 'female' }
  | { kind: 'photo' | 'generated' | 'home-sheet'; uri: string } | null;
type Entry = { choice: HomeAvatarChoice; ready: boolean; error: string };
const empty: Entry = { choice: null, ready: false, error: '' };
const entries = new Map<string, Entry>();
const pending = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());
const subscribe = (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); };

export function homeAvatarKey(userId: string | undefined, role: 'you' | 'partner', partnerId?: string | null) {
  return `home-avatar:v1:${userId ?? 'guest'}:${role === 'you' ? 'you' : `partner:${partnerId ?? 'unlinked'}`}`;
}
function parse(raw: string | null): HomeAvatarChoice {
  const value = raw ? JSON.parse(raw) : null;
  if (value?.kind === 'cute' && ['male', 'female'].includes(value.character)) return value;
  if (['photo', 'generated', 'home-sheet'].includes(value?.kind) && typeof value.uri === 'string' && /^data:image\/(jpeg|png);base64,/.test(value.uri)) return value;
  return null;
}
async function load(key: string) {
  if (entries.get(key)?.ready) return;
  if (!pending.has(key)) pending.set(key, AsyncStorage.getItem(key).then(raw => {
    entries.set(key, { choice: parse(raw), ready: true, error: '' });
  }).catch(() => { entries.set(key, { choice: null, ready: true, error: 'Could not load your saved avatar.' }); })
    .finally(() => { pending.delete(key); emit(); }));
  await pending.get(key);
}
export async function saveHomeAvatar(key: string, choice: HomeAvatarChoice) {
  // Finish any initial read before publishing a new selection to all cards.
  await load(key);
  if (choice) await AsyncStorage.setItem(key, JSON.stringify(choice));
  else await AsyncStorage.removeItem(key);
  entries.set(key, { choice, ready: true, error: '' });
  emit();
}
export function useHomeAvatarByKey(key?: string) {
  const state = useSyncExternalStore(subscribe, () => key ? entries.get(key) ?? empty : empty, () => empty);
  useEffect(() => { if (key) void load(key); }, [key]);
  return state;
}
const Scope = createContext<{ you?: string; partner?: string }>({});
export function HomeAvatarScope({ userId, partnerId, children }: { userId?: string; partnerId?: string | null; children: React.ReactNode }) {
  return <Scope.Provider value={{ you: homeAvatarKey(userId, 'you'), partner: homeAvatarKey(userId, 'partner', partnerId) }}>{children}</Scope.Provider>;
}
export function useHomeAvatar(role: 'you' | 'partner') {
  const scopedKey = useContext(Scope)[role];
  const { user } = useAuth();
  const fallbackKey = user?.id && (role === 'you' || user.partnerId)
    ? homeAvatarKey(user.id, role, user.partnerId) : undefined;
  return useHomeAvatarByKey(scopedKey ?? fallbackKey).choice;
}
