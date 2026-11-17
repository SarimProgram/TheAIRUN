import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireOptionalNativeModule } from 'expo';
import { Directory, File, Paths } from 'expo-file-system';
import { API_BASE_URL } from '@/config/api';
import * as ImageManipulator from 'expo-image-manipulator';
import { recipientPortion } from './meal-pass';
import { sharedMealImage, type SharedMeal } from './meal-pass-api';
import { getPartnerWidgetArtwork } from './partner-surface';
import { normalizeWidgetGender } from './partner-widget-portraits';
import type { PartnerFoodWidgetProps } from '@/widgets/PlaceholderWidgets';

type AuthFetch = (input: string, init?: RequestInit) => Promise<Response>;
type Entry = { date: Date; props: PartnerFoodWidgetProps };
type PartnerFoodWidgetController = { updateTimeline: (entries: Entry[]) => void };
type Art = Pick<PartnerFoodWidgetProps, 'imageUri' | 'imageIsCutout' | 'portraitUri'>;

type WidgetPushNative = {
  getWidgetPushToken?: () => string | null;
  setWidgetRemoteFeed?: (name: string, url: string, token: string, pushTokenUrl: string | null) => void;
  clearWidgetRemoteFeed?: (name: string) => void;
};

const SHARED_GROUP = 'group.au.com.msarim.theaicoach.widgets';
const WIDGET_NAME = 'PlaceholderOneWidget';
const REGISTERED_KEY = 'partner-food-widget-push:v1';
const IMAGE_PREFIX = 'partner-food-';
// Widget extensions get roughly 30 MB; a 320 px plate stays far below that.
const IMAGE_WIDTH = 320;

export const EMPTY_PARTNER_FOOD: PartnerFoodWidgetProps = {
  mealId: '', senderName: '', mealType: '', foods: '', kcal: 0, status: '', sentAt: '', expiresAt: '',
  imageUri: '', imageIsCutout: false, portraitUri: '',
};

let controller: PartnerFoodWidgetController | null | undefined;
/** The plate on the widget right now; a waiting plate outranks an answered one, then newest wins. */
let shown: { id: string; status: SharedMeal['status']; createdAt: string } | null = null;
let version = 0;

function getController(): PartnerFoodWidgetController | null {
  if (controller !== undefined) return controller;
  if (Platform.OS !== 'ios') return (controller = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    controller = (require('@/widgets/PlaceholderWidgets') as { PartnerFoodWidget?: PartnerFoodWidgetController }).PartnerFoodWidget ?? null;
  } catch {
    controller = null;
  }
  return controller;
}

function nextLocalMidnight(from: Date) {
  const d = new Date(from);
  d.setHours(24, 0, 0, 0);
  return d;
}

export function shouldReplaceShown(current: typeof shown, meal: Pick<SharedMeal, 'id' | 'status' | 'createdAt'>) {
  if (!current || current.id === meal.id) return true;
  const waiting = meal.status === 'PENDING';
  const currentWaiting = current.status === 'PENDING';
  if (waiting !== currentWaiting) return waiting;
  return Date.parse(meal.createdAt) >= Date.parse(current.createdAt);
}

/** A waiting plate stays up until it expires, a logged one until midnight; a declined one clears at once. */
export function partnerFoodEntries(meal: SharedMeal, now = new Date(), art: Partial<Art> = {}): Entry[] {
  if (meal.status === 'DECLINED') return [{ date: now, props: EMPTY_PARTNER_FOOD }];
  const portion = recipientPortion(meal.items, meal.itemShares);
  const names = (portion.length ? portion : meal.items).map((item) => item.foodName.trim()).filter(Boolean);
  const props: PartnerFoodWidgetProps = {
    mealId: meal.id,
    senderName: meal.senderName || 'Your partner',
    mealType: meal.mealType,
    foods: names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', '),
    kcal: Math.round(portion.reduce((sum, item) => sum + item.calories, 0)),
    status: meal.status,
    sentAt: meal.createdAt,
    expiresAt: meal.expiresAt,
    imageUri: art.imageUri ?? '',
    imageIsCutout: !!art.imageUri && !!art.imageIsCutout,
    portraitUri: art.portraitUri ?? '',
  };
  const clearAt = meal.status === 'PENDING' ? new Date(meal.expiresAt) : nextLocalMidnight(now);
  if (Number.isNaN(clearAt.getTime()) || clearAt <= now) return [{ date: now, props: EMPTY_PARTNER_FOOD }];
  return [{ date: now, props }, { date: clearAt, props: EMPTY_PARTNER_FOOD }];
}

function sharedContainer(): Directory | null {
  try {
    return Paths.appleSharedContainers[SHARED_GROUP] ?? null;
  } catch {
    return null;
  }
}

function plateImageFile(meal: SharedMeal) {
  const kind = meal.hasCutout ? 'cutout' : meal.hasPhoto ? 'photo' : null;
  const shared = kind ? sharedContainer() : null;
  if (!kind || !shared) return null;
  return { kind, file: new File(shared, `${IMAGE_PREFIX}${meal.id}.${kind === 'cutout' ? 'png' : 'jpg'}`) } as const;
}

/** The extension can't read the app sandbox, so a small copy of the plate goes into the shared group. */
async function copyPlateImage(authFetch: AuthFetch, meal: SharedMeal, target: NonNullable<ReturnType<typeof plateImageFile>>) {
  const source = await sharedMealImage(authFetch, meal, target.kind);
  const resized = await ImageManipulator.manipulateAsync(source, [{ resize: { width: IMAGE_WIDTH } }], {
    compress: 0.8,
    format: target.kind === 'cutout' ? ImageManipulator.SaveFormat.PNG : ImageManipulator.SaveFormat.JPEG,
  });
  if (!target.file.exists) new File(resized.uri).move(target.file);
  const shared = sharedContainer();
  for (const entry of shared?.list() ?? []) {
    if (entry instanceof File && entry.name.startsWith(IMAGE_PREFIX) && entry.uri !== target.file.uri) entry.delete();
  }
  return target.file.uri;
}

/** Puts food the partner passed on the home screen widget: their portrait, the plate itself and your portion. */
export async function syncPartnerFoodWidget(meal: SharedMeal, authFetch?: AuthFetch) {
  const widget = getController();
  if (!widget || meal.id.startsWith('dev-')) return;
  if (meal.status === 'DECLINED' ? shown?.id !== meal.id : !shouldReplaceShown(shown, meal)) return;
  shown = meal.status === 'DECLINED' ? null : { id: meal.id, status: meal.status, createdAt: meal.createdAt };
  const mine = ++version;
  const push = (art: Partial<Art>) => {
    try {
      widget.updateTimeline(partnerFoodEntries(meal, new Date(), art));
    } catch (error) {
      console.warn('[PartnerFoodWidget] Update failed:', error);
    }
  };
  if (meal.status === 'DECLINED') { push({}); return; }

  const gender = normalizeWidgetGender(meal.senderGender);
  const portraits = await getPartnerWidgetArtwork().catch(() => ({} as { male?: string; female?: string }));
  const portraitUri = (gender && portraits[gender]) || '';
  const image = plateImageFile(meal);
  const cached = image?.file.exists ? image.file.uri : '';
  if (mine !== version) return;
  push({ portraitUri, imageUri: cached, imageIsCutout: image?.kind === 'cutout' });

  if (!image || cached || !authFetch) return;
  const imageUri = await copyPlateImage(authFetch, meal, image).catch(() => '');
  if (imageUri && mine === version) push({ portraitUri, imageUri, imageIsCutout: image.kind === 'cutout' });
}

function widgetPushNative(): WidgetPushNative | null {
  if (Platform.OS !== 'ios') return null;
  try {
    return requireOptionalNativeModule<WidgetPushNative>('ExpoWidgets');
  } catch {
    return null;
  }
}

/**
 * Lets the server wake the widget directly (iOS 26 WidgetKit push), so new plates show up while the app is closed.
 * The token only exists once the extension has run, so this is retried whenever the app comes forward.
 */
export async function registerPartnerFoodWidgetPush(authFetch: AuthFetch, userId: string) {
  const native = widgetPushNative();
  const pushToken = native?.getWidgetPushToken?.();
  if (!native?.setWidgetRemoteFeed || !pushToken) return;
  const key = `${userId}:${pushToken}`;
  if ((await AsyncStorage.getItem(REGISTERED_KEY).catch(() => null)) === key) return;

  // The extension resolves the feed's portrait names against these shared copies.
  await getPartnerWidgetArtwork().catch(() => {});
  const res = await authFetch(`${API_BASE_URL}/profile/widget-push-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: 'partner_food', pushToken }),
  });
  if (!res.ok) throw new Error(`Widget push registration failed (${res.status})`);
  const { feedToken, feedPath, pushTokenPath } = await res.json() as { feedToken: string; feedPath: string; pushTokenPath: string };
  native.setWidgetRemoteFeed(WIDGET_NAME, `${API_BASE_URL}${feedPath}`, feedToken, `${API_BASE_URL}${pushTokenPath}`);
  await AsyncStorage.setItem(REGISTERED_KEY, key).catch(() => {});
}

/** On sign-out the widget must stop fetching (and showing) this account's food. */
export async function clearPartnerFoodWidgetPush() {
  shown = null;
  version++;
  try {
    widgetPushNative()?.clearWidgetRemoteFeed?.(WIDGET_NAME);
  } catch {}
  await AsyncStorage.removeItem(REGISTERED_KEY).catch(() => {});
}
