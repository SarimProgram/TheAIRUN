import type { TugIdentity, TugFrame } from './tugSprite';

export const BREATHING_SHEET = require('../../assets/avatars/couple-breathing-sheet-v1.png');
export const BREATHING_ATLAS = { width: 1774, height: 887 } as const;
export const BREATHING_FRAME_WIDTH = BREATHING_ATLAS.width / 6;
export const BREATHING_FRAME_HEIGHT = BREATHING_ATLAS.height / 2;
// Only the upper body cycles. Frame zero supplies the planted legs throughout.
export const BREATHING_WAIST = 270;
export function breathingFrame(phase: number) {
  'worklet';
  return Math.round(Math.max(0, Math.min(5, phase)));
}
export const BREATHING_SPRITES: Record<TugIdentity, { row: number; baseline: number; frames: TugFrame[] }> = {
  male: { row: 0, baseline: 414, frames: [
    { rear: { x: 198, y: 190 }, front: { x: 255, y: 183 } },
    { rear: { x: 198, y: 188 }, front: { x: 255, y: 182 } },
    { rear: { x: 198, y: 187 }, front: { x: 255, y: 183 } },
    { rear: { x: 198, y: 191 }, front: { x: 255, y: 184 } },
    { rear: { x: 198, y: 191 }, front: { x: 255, y: 184 } },
    { rear: { x: 198, y: 189 }, front: { x: 255, y: 183 } },
  ] },
  female: { row: 1, baseline: 414, frames: [
    { rear: { x: 198, y: 193 }, front: { x: 255, y: 187 } },
    { rear: { x: 198, y: 193 }, front: { x: 255, y: 187 } },
    { rear: { x: 198, y: 192 }, front: { x: 255, y: 185 } },
    { rear: { x: 198, y: 194 }, front: { x: 255, y: 187 } },
    { rear: { x: 198, y: 193 }, front: { x: 255, y: 187 } },
    { rear: { x: 198, y: 192 }, front: { x: 255, y: 186 } },
  ] },
};

export function breathingGrip(identity: TugIdentity, phase: number): TugFrame {
  'worklet';
  const frames = BREATHING_SPRITES[identity].frames;
  const clamped = Math.max(0, Math.min(5, phase));
  const index = Math.floor(clamped);
  const next = Math.min(5, index + 1);
  const mix = clamped - index;
  const a = frames[index];
  const b = frames[next];
  return {
    rear: { x: a.rear.x + (b.rear.x - a.rear.x) * mix, y: a.rear.y + (b.rear.y - a.rear.y) * mix },
    front: { x: a.front.x + (b.front.x - a.front.x) * mix, y: a.front.y + (b.front.y - a.front.y) * mix },
  };
}
