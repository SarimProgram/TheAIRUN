export type PartnerWorkoutAtlasLayout = {
  columns: number;
  rows: number;
  /** Measured row bounds in source pixels when generated rows are uneven. */
  pixelWidth?: number;
  pixelHeight?: number;
  rowBounds?: readonly (readonly [number, number])[];
};

export function getPartnerWorkoutCrop(atlas: PartnerWorkoutAtlasLayout, cell: number, size: number) {
  const width = atlas.pixelWidth ?? atlas.columns;
  const height = atlas.pixelHeight ?? atlas.rows;
  const row = Math.floor(cell / atlas.columns);
  const [top, bottom] = atlas.rowBounds?.[row] ?? [row * height / atlas.rows, (row + 1) * height / atlas.rows];
  const cellWidth = width / atlas.columns;
  const cellHeight = bottom - top;
  const scale = size / Math.max(cellWidth, cellHeight);
  return {
    viewportWidth: cellWidth * scale,
    viewportHeight: cellHeight * scale,
    imageWidth: width * scale,
    imageHeight: height * scale,
    imageLeft: -(cell % atlas.columns) * cellWidth * scale,
    imageTop: -top * scale,
  };
}
