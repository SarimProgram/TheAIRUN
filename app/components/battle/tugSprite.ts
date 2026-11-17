// Reference coordinates from the original 1774 × 887 atlas. Both rows face right.
// The runtime PNG is 1536 × 768 (256 × 384 per frame). Animated.Image stretches
// that same-aspect sheet into this logical space, preserving all grips and crops.
export const TUG_ATLAS = { width: 1774, height: 887, columns: 6, rows: 2 } as const;
export const TUG_FRAME_WIDTH = TUG_ATLAS.width / TUG_ATLAS.columns;
export const TUG_FRAME_HEIGHT = TUG_ATLAS.height / TUG_ATLAS.rows;
// Exclude a neighboring ponytail's few pixels in the otherwise empty right gutter.
export const TUG_CONTENT_WIDTH = TUG_FRAME_WIDTH - 14;
export type TugIdentity = 'male' | 'female';
export type Grip = { x: number; y: number };
export type TugFrame = { rear: Grip; front: Grip };
export const TUG_SPRITES = {
  male: {
    row: 0, baseline: 410,
    frames: [
      { rear: { x: 199, y: 190 }, front: { x: 258, y: 185 } },
      { rear: { x: 204, y: 190 }, front: { x: 258, y: 185 } },
      { rear: { x: 193, y: 194 }, front: { x: 256, y: 185 } },
      { rear: { x: 184, y: 195 }, front: { x: 248, y: 185 } },
      { rear: { x: 183, y: 193 }, front: { x: 244, y: 185 } },
      { rear: { x: 180, y: 190 }, front: { x: 246, y: 185 } },
    ],
  },
  female: {
    row: 1, baseline: 412,
    frames: [
      { rear: { x: 198, y: 192 }, front: { x: 258, y: 187 } },
      { rear: { x: 204, y: 195 }, front: { x: 258, y: 187 } },
      { rear: { x: 198, y: 201 }, front: { x: 256, y: 187 } },
      { rear: { x: 189, y: 205 }, front: { x: 248, y: 191 } },
      { rear: { x: 184, y: 200 }, front: { x: 244, y: 187 } },
      { rear: { x: 185, y: 196 }, front: { x: 246, y: 187 } },
    ],
  },
} satisfies Record<TugIdentity, { row: number; baseline: number; frames: TugFrame[] }>;

export function tugFrameIndex(phase: number) {
  'worklet';
  return Math.max(0, Math.min(5, Math.floor(phase)));
}

export function stageGrip(grip: Grip, side: 'left' | 'right', x: number, top: number, scale: number, bounce: number): Grip {
  'worklet';
  return { x: x + (side === 'right' ? TUG_FRAME_WIDTH - grip.x : grip.x) * scale, y: top + grip.y * scale + bounce };
}
