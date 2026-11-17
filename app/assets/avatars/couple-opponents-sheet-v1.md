# Opposing couple artwork

Generated with the built-in image generation tool using `couple-breathing-sheet-v1.png` as the pose reference and `../competitions/couple-tug-v2.webp` (the Run tab cover) as the character reference.

Prompt: Replace the male sprite row with the Black man in royal blue, and the female row with the Black woman with short natural curls in yellow from the cover. Preserve the six-column, two-row layout, positions, scale, fist locations, feet, and right-facing poses. Use the same stylized 3D art and a transparent background. Exclude rope, text, ground and shadows.

Cleanup prompt: Preserve all characters and their exact positions; remove translucent haze and background artifacts, keeping crisp edges and transparent empty space.

The app uses only the first pose of each row, baked into small WebP layers by `node app/scripts/export-couple-rig.cjs --opponents`. The original couple assets remain separate. The right-hand couple and opponent portraits use these variants; shared grip geometry keeps their rope and motion synchronized.
