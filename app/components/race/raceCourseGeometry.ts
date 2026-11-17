export const METRES_PER_MARKER = 200;
export const POINTS_PER_METRE = 0.7;
export const FINISH_ROAD_FRACTION = 0.32;
export const START_BOTTOM_SPACE = 56;

export function getFinishY(width: number) {
  const archWidth = (width * FINISH_ROAD_FRACTION + 8) / 0.89;
  return archWidth * 0.66 + 36;
}

export function getCourseLayout(width: number, metres: number) {
  const distance = Number.isFinite(metres) && metres > 0 ? metres : 1000;
  const finishY = getFinishY(width);
  const travel = distance * POINTS_PER_METRE;
  return { distance, finishY, travel, height: finishY + travel + START_BOTTOM_SPACE, startY: finishY + travel };
}
