# Race artwork

Generated for the tree-lined race scene, using the StepTracer tug-of-war characters as the identity reference. Both PNGs have transparent backgrounds and are bundled locally; no image service is used at runtime.

- `runners-v1.png`: 1536 × 1024, six columns and two rows. Each cell is 256 × 512. Row 0 is the teal male runner; row 1 is the coral female runner, viewed from behind. Six running poses play at 120 ms per frame. Rows retain the same canvas origin; never trim individual cells.
- `scenery-v1.png`: 1536 × 1024, three columns and two rows of 512 × 512 cells. Reading order: deciduous tree, pine, flowering bush, finish arch, shoe, flag.

The app bundles `runners-v1.webp` and `scenery-v1.webp` (same dimensions, lossy WebP with alpha, about 200 KB each); the PNGs are the lossless masters and are not required at runtime. Re-export the WebP files at the same size whenever a PNG changes.

`components/race/RaceScene.tsx` clips the atlases directly through `expo-image`, so every sprite shares one decoded bitmap; `components/race/raceAssets.ts` prefetches both from the home screen. Runner phase and course position run through Reanimated transforms. Animation stops when the screen loses focus, the app backgrounds, the race stops, or Reduce Motion is enabled. The hub intentionally animates a labeled course preview; live distances come from the existing race tracker/socket.

The road, lane lines, distance labels and colored trails are rendered in code so they remain sharp and reflect the selected distance. The goal and start use the same vertical coordinates as runner movement.
