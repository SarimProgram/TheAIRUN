export function stepLabelLayout(arenaWidth: number, avatarWidth: number, leftX: number, rightX: number, shift: number, labelWidth: number, edgeTravel: number) {
  'worklet';
  const switchDistance = Math.max(12, edgeTravel * 0.4);
  const leftFlipped = shift > switchDistance;
  const rightFlipped = shift < -switchDistance;
  const left = leftX + shift + (leftFlipped ? avatarWidth * 0.12 - labelWidth - 6 : avatarWidth * 0.72);
  const right = rightX + shift + (rightFlipped ? avatarWidth * 0.88 + 6 : avatarWidth * 0.28 - labelWidth);
  // Each label stays inside its own half, including while the rope is moving.
  const middle = arenaWidth / 2;
  const leftMax = middle - 12 - labelWidth;
  const rightMin = middle + 12;
  return {
    left: Math.max(6, Math.min(leftMax, left)),
    right: Math.max(rightMin, Math.min(arenaWidth - labelWidth - 6, right)),
    leftFlipped,
    rightFlipped,
  };
}
