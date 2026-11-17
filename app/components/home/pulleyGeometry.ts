// All coordinates are in the scene's 400 x 250 viewBox. Mirror the right rig.
export const PULLEY = { x: 138, y: 31, radius: 15, basketX: 153 } as const;
// Pose atlas cells are 512 px square; the character is placed with this transform.
export const POSE = { x: -8, y: 92, scale: 130 / 512 } as const;
// Basket hook height with plenty of kcal left vs. the goal reached.
const BASKET_TOP = 58;
const BASKET_TRAVEL = 82;

function tangent(handX: number, handY: number) {
  'worklet';
  const dx = handX - PULLEY.x;
  const dy = handY - PULLEY.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) + Math.acos(PULLEY.radius / distance);
  return {
    x: PULLEY.x + Math.cos(angle) * PULLEY.radius,
    y: PULLEY.y + Math.sin(angle) * PULLEY.radius,
    length: Math.sqrt(distance * distance - PULLEY.radius * PULLEY.radius)
      + (2 * Math.PI - angle) * PULLEY.radius,
  };
}

/** 0 until 80% of the goal is used, rising to 1 at the goal. */
export function pulleyStrain(load: number) {
  'worklet';
  return Math.max(0, Math.min(1, (load - 0.8) / 0.2));
}

export function pulleyGeometry(phase: number, load: number, female: boolean) {
  'worklet';
  const shift = Math.sin(phase) * (load >= 0.8 ? 2.2 : 0.9);
  const handX = POSE.x + 384 * POSE.scale;
  const rearX = POSE.x + 320 * POSE.scale;
  const handY = POSE.y + (female ? 183 : 184) * POSE.scale;
  const rearY = POSE.y + (female ? 215 : 217) * POSE.scale;
  const rest = tangent(handX, handY);
  const contact = tangent(handX + shift, handY);
  const travel = contact.length - rest.length;
  const drop = Math.min(load, 1.1) * BASKET_TRAVEL;
  const basketY = BASKET_TOP + drop - travel;
  const strain = pulleyStrain(load);
  return {
    shift, basketY,
    wheelDegrees: (travel - drop) / PULLEY.radius * 180 / Math.PI,
    shakeDegrees: Math.sin(phase * 14) * 1.4 * strain,
    // Continuous path: both grips → tangent → wheel groove → suspension eye.
    rope: `M${rearX + shift} ${rearY} L${handX + shift} ${handY} L${contact.x} ${contact.y} A${PULLEY.radius} ${PULLEY.radius} 0 0 1 ${PULLEY.basketX} ${PULLEY.y} V${basketY}`,
  };
}
