import type { Grip, TugFrame, TugIdentity } from './tugSprite';

export const RIG_WIDTH = 1774 / 6;
export const RIG_HEIGHT = 887 / 2;
export const RIG_BASELINE = 414;
export const RIG_WAIST = 270;
export const RIG_PIVOT = { x: 140, y: RIG_WAIST };
export const HEAD_PIVOT = { x: 135, y: 112 };
export const REAR_ARM_PIVOT = { x: 100, y: 138 };
export const FRONT_ARM_PIVOT = { x: 160, y: 135 };
export const TORSO_SWAY = 0.35;
export const CHEST_STRETCH = 0.045;
export const HEAD_TILT = -0.45;
export const REAR_ARM_SWING = -0.9;
export const FRONT_ARM_SWING = 0.75;
export const OPENING_LEAN = -1.4;
export const OPENING_STRETCH = 0.015;
export const OPENING_HEAD_TILT = 0.6;
export const OPENING_REAR_SWING = -0.65;
export const OPENING_FRONT_SWING = 0.65;

// Part masks all sample the same opaque rest pose. No frame switching or blending.
export const HEAD_MASK = 'M0 0 H296 V112 H172 L153 123 L102 116 L76 176 H0 Z';
export const REAR_ARM_MASK = 'M84 126 Q98 119 113 132 L150 159 L187 171 L211 178 L215 203 L176 202 L117 183 Q90 171 84 151 Z';
export const FRONT_ARM_MASK = 'M149 122 L168 123 L203 153 L236 165 L267 171 L275 192 L248 203 L220 192 L191 181 L165 161 Z';

export function rigMatrix(breath: number, openingPull = 0) {
  'worklet';
  const angle = (breath * TORSO_SWAY + openingPull * OPENING_LEAN) * Math.PI / 180;
  const sy = 1 + breath * CHEST_STRETCH + openingPull * OPENING_STRETCH;
  const a = Math.cos(angle);
  const b = Math.sin(angle);
  const c = -b * sy;
  const d = a * sy;
  return { a, b, c, d,
    tx: RIG_PIVOT.x - a * RIG_PIVOT.x - c * RIG_PIVOT.y,
    ty: RIG_PIVOT.y - b * RIG_PIVOT.x - d * RIG_PIVOT.y };
}

export function rotateRigPoint(point: Grip, pivot: Grip, degrees: number): Grip {
  'worklet';
  const radians = degrees * Math.PI / 180;
  const x = point.x - pivot.x;
  const y = point.y - pivot.y;
  return { x: pivot.x + x * Math.cos(radians) - y * Math.sin(radians),
    y: pivot.y + x * Math.sin(radians) + y * Math.cos(radians) };
}

export function rigGrip(identity: TugIdentity, breath: number, openingPull = 0): TugFrame {
  'worklet';
  const rear = rotateRigPoint({ x: 198, y: identity === 'male' ? 190 : 193 }, REAR_ARM_PIVOT, breath * REAR_ARM_SWING + openingPull * OPENING_REAR_SWING);
  const front = rotateRigPoint({ x: 255, y: identity === 'male' ? 183 : 187 }, FRONT_ARM_PIVOT, breath * FRONT_ARM_SWING + openingPull * OPENING_FRONT_SWING);
  const m = rigMatrix(breath, openingPull);
  return {
    rear: { x: m.a * rear.x + m.c * rear.y + m.tx, y: m.b * rear.x + m.d * rear.y + m.ty },
    front: { x: m.a * front.x + m.c * front.y + m.tx, y: m.b * front.x + m.d * front.y + m.ty },
  };
}

export function rigBreath(cycle: number, member: number) {
  'worklet';
  // Small offsets avoid four characters moving in lockstep. Zero is the rest pose.
  const offset = member % 2 === 0 ? 0 : 0.6;
  return (Math.sin(cycle * Math.PI * 2 + offset) - Math.sin(offset)) * 0.8;
}
