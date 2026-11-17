import type { BottleCardTap } from './bottle-live-activity';

type ActionEffects = {
  logDrink: (tap: BottleCardTap) => Promise<void>;
  queueReply: (tap: BottleCardTap) => Promise<void>;
  markHandled: (tap: BottleCardTap) => Promise<void>;
  acknowledge: (tap: BottleCardTap) => void;
};

/** Keep the native action available for retry until all durable effects succeed. */
export async function applyBottleCardTap(tap: BottleCardTap, effects: ActionEffects): Promise<void> {
  if (tap.action === 'drink') await effects.logDrink(tap);
  await effects.queueReply(tap);
  await effects.markHandled(tap);
  effects.acknowledge(tap);
}
