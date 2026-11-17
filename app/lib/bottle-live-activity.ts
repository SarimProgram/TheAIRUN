import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

import type { BottleLiveActivityProps } from '@/widgets/BottleLiveActivity';

export type BottleCardAction = 'drink' | 'throwback';

/** A tap on a bottle card button; targets are `end:<action>:<messageId>` (see `BottleLiveActivity`). */
export type BottleCardTap = { action: BottleCardAction; messageId: string; at: number; source: string; target: string };

type PendingInteraction = { source?: unknown; target?: unknown; timestamp?: unknown };
type ExpoWidgetsNative = {
  getPendingLiveActivityInteractions?: () => PendingInteraction[];
  acknowledgeLiveActivityInteraction?: (source: string, target: string, timestamp: number) => void;
};

/** Read pending taps without deleting them. Acknowledge only after the action is saved. */
export function getPendingBottleCardTaps(): BottleCardTap[] {
  if (Platform.OS !== 'ios') return [];
  let items: PendingInteraction[] = [];
  try {
    items = requireOptionalNativeModule<ExpoWidgetsNative>('ExpoWidgets')?.getPendingLiveActivityInteractions?.() ?? [];
  } catch {
    return [];
  }

  const taps: BottleCardTap[] = [];
  for (const item of items) {
    const match = typeof item.target === 'string' ? /^end:(drink|throwback):(.+)$/.exec(item.target) : null;
    if (!match || typeof item.source !== 'string' || typeof item.timestamp !== 'number') continue;
    taps.push({
      action: match[1] as BottleCardAction,
      messageId: match[2],
      at: item.timestamp,
      source: item.source,
      target: item.target as string,
    });
  }
  return taps;
}

export function acknowledgeBottleCardTap(tap: BottleCardTap): void {
  const native = requireOptionalNativeModule<ExpoWidgetsNative>('ExpoWidgets');
  if (!native?.acknowledgeLiveActivityInteraction) throw new Error('Live Activity acknowledgement requires a new native build');
  native.acknowledgeLiveActivityInteraction(tap.source, tap.target, tap.at);
}

/** Fires whenever a Live Activity button is tapped while JS is running. */
export function subscribeToLiveActivityTaps(onTap: () => void): () => void {
  if (Platform.OS !== 'ios') return () => {};
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { addUserInteractionListener } = require('expo-widgets') as ExpoWidgetsModule;
    const subscription = addUserInteractionListener(() => onTap());
    return () => subscription.remove();
  } catch {
    return () => {};
  }
}

type BottleLiveActivityModule = typeof import('@/widgets/BottleLiveActivity');
type ExpoWidgetsModule = typeof import('expo-widgets');

export type BottleCardEntry = {
  id: string;
  fromName: string;
  sentAt: string;
};

let cachedModule: BottleLiveActivityModule | null | undefined;

function getBottleLiveActivity() {
  if (cachedModule !== undefined) return cachedModule?.BottleLiveActivity ?? null;
  if (Platform.OS !== 'ios') {
    cachedModule = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedModule = require('@/widgets/BottleLiveActivity') as BottleLiveActivityModule;
  } catch {
    cachedModule = null;
  }
  return cachedModule?.BottleLiveActivity ?? null;
}

/**
 * Keeps the lock-screen bottle card in step with the in-app queue. The card is only ever started by the
 * server (push-to-start); here we collapse duplicates, refresh the count, and end it once every bottle is caught.
 */
export async function syncBottleLiveActivity(queue: BottleCardEntry[], options?: { endWhenEmpty?: boolean }) {
  const factory = getBottleLiveActivity();
  if (!factory) return;

  let instances: ReturnType<typeof factory.getInstances>;
  try {
    instances = factory.getInstances();
  } catch {
    return;
  }
  if (instances.length === 0) return;

  if (queue.length === 0) {
    // An empty local queue at launch does not mean a remote bottle was handled.
    if (options?.endWhenEmpty) await Promise.allSettled(instances.map((instance) => instance.end('immediate')));
    return;
  }

  const latest = queue[queue.length - 1];
  const props: BottleLiveActivityProps = {
    fromName: latest.fromName,
    count: queue.length,
    messageId: latest.id,
    sentAt: latest.sentAt,
  };
  const [keep, ...extras] = instances;
  await Promise.allSettled([
    keep.update(props),
    ...extras.map((instance) => instance.end('immediate')),
  ]);
}

/** Subscribes to the ActivityKit push-to-start token (iOS 17.2+), which lets the server put a bottle on the lock screen. */
export function subscribeToBottleStartToken(onToken: (token: string) => void): () => void {
  if (Platform.OS !== 'ios') return () => {};
  // The widget extension can only render a push-started card if this layout has been registered.
  getBottleLiveActivity();
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { addPushToStartTokenListener } = require('expo-widgets') as ExpoWidgetsModule;
    const subscription = addPushToStartTokenListener((event) => {
      if (event?.activityPushToStartToken) onToken(event.activityPushToStartToken);
    });
    return () => subscription.remove();
  } catch {
    return () => {};
  }
}
