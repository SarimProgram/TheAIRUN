import { useEffect, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PassMode } from './meal-pass';
import type { PassStatus } from './meal-pass-api';

const STORAGE_KEY = 'meal-pass.sent.v1';
const KEEP_MS = 3 * 24 * 60 * 60 * 1000;

/** A plate this user passed, keyed by the clientMealId of their own logged portion. */
export type SentPlate = {
  sharedMealId: string; clientMealId: string; userKey: string; mode: PassMode; status: PassStatus;
  /** SPLIT: the partner's calorie-weighted fraction. COPY: their serving size. */
  partnerShare: number; partnerName: string; partnerGender: string | null; sentAt: string;
};

let plates: SentPlate[] = [];
let loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

function load() {
  loaded ??= AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
    const stored: SentPlate[] = raw ? JSON.parse(raw) : [];
    const known = new Set(plates.map((plate) => plate.sharedMealId));
    plates = [...plates, ...stored.filter((plate) => !known.has(plate.sharedMealId) && Date.now() - Date.parse(plate.sentAt) < KEEP_MS)];
    emit();
  }).catch(() => {});
  return loaded;
}

function commit(next: SentPlate[]) {
  plates = next;
  emit();
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
}

export async function recordSentPlate(plate: SentPlate) {
  await load();
  commit([...plates.filter((entry) => entry.sharedMealId !== plate.sharedMealId), plate]);
}

export async function updateSentPlate(sharedMealId: string, patch: Partial<Pick<SentPlate, 'status' | 'partnerShare'>>) {
  await load();
  const current = plates.find((plate) => plate.sharedMealId === sharedMealId);
  if (!current) return null;
  const next = { ...current, ...patch };
  commit(plates.map((plate) => (plate.sharedMealId === sharedMealId ? next : plate)));
  return next;
}

export async function pendingSentPlates(userKey: string) {
  await load();
  return plates.filter((plate) => plate.userKey === userKey && plate.status === 'PENDING');
}

export async function findSentPlate(sharedMealId: string) {
  await load();
  return plates.find((plate) => plate.sharedMealId === sharedMealId) ?? null;
}

const ARRIVED_KEY = 'meal-pass.arrived.v1';
const ARRIVED_LIMIT = 100;
let arrivedLoad: Promise<string[]> | null = null;

/** Ids of received plates that have already flown in on this phone, so a relaunch shows them docked instead of replaying. */
export function loadArrivedPlates() {
  arrivedLoad ??= AsyncStorage.getItem(ARRIVED_KEY).then((raw) => (raw ? JSON.parse(raw) as string[] : [])).catch(() => []);
  return arrivedLoad;
}

export async function markPlateArrived(sharedMealId: string) {
  const ids = await loadArrivedPlates();
  if (ids.includes(sharedMealId)) return;
  const next = [...ids, sharedMealId].slice(-ARRIVED_LIMIT);
  arrivedLoad = Promise.resolve(next);
  AsyncStorage.setItem(ARRIVED_KEY, JSON.stringify(next)).catch(() => {});
}

const getSnapshot = () => plates;
export function useSentPlates(userKey: string) {
  const all = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => { void load(); }, []);
  return all.filter((plate) => plate.userKey === userKey);
}
