# Water standing idle sheet

`water-standing-idle-v1.png`: 1536 x 1024 RGBA, four columns and two rows.
Each frame is 384 x 512. Male: row 0. Female: row 1.
Frames: relaxed, inhale, peak inhale, return. Play left to right every 3200 ms.
All source figures face right; mirror for the partner on the right.
The bottle is rendered separately. Reduce Motion holds the first pose;
backgrounding the app stops the loop.

Created with the built-in image generation tool using weekly-male.png and
weekly-female.png as identity and style references. Alpha transparency was
verified from the saved PNG. Consumed by WaterCharacter.tsx in WaterHome.tsx.

## Generation prompt

Use case: stylized-concept
Asset type: production transparent animation sprite sheet for a React Native hydration screen.
Reference images: first image is male identity/style reference, second female identity/style reference.
Primary request: the SAME two polished stylized 3D athletic people now STANDING STILL beside a separately rendered water bottle, in a seamless quiet idle animation loop. Preserve faceless faces with white eyes, male brown quiff and teal athletic shirt/shorts/shoes, female auburn ponytail and coral athletic shirt/shorts/shoes. No running poses.
Layout: EXACT 4 columns x 2 rows, eight isolated full body figures total, equal cells on a landscape canvas ideally 1536x1024, each cell 384x512. Male top row, female bottom row. Each person centered in own cell, same scale, same feet baseline, full head and shoes visible, generous transparent margin. All figures face slightly RIGHT, three-quarter front view, friendly relaxed standing posture, both feet planted, arms resting relaxed at sides with small natural bend. Bottle will be added separately to their right: do NOT draw any bottle or other object.
Frames left to right: 1 neutral relaxed stance, 2 gentle inhale shoulders lift slightly, 3 peak gentle inhale with tiny head tilt and subtle forearm movement, 4 shoulders return toward neutral. Tiny motion only; same body proportions and outfit in all four frames, feet exactly fixed. Last frame must lead naturally to first. Female ponytail shifts only slightly. No walking, stepping, waving or drinking.
Style: match references' clean smooth high quality 3D fitness illustration. Consistent soft lighting, crisp silhouettes readable at 150px tall.
Background: actual transparent alpha, clean cutouts, no floor shadows.
Constraints: no bottle, no props, no text, no labels, no borders, no grid lines, no watermark. Do not crop feet or hair. Do not connect neighboring figures.

## Background extraction prompt

Background extraction only. Preserve all eight characters, exact positions and 4-column 2-row sprite sheet layout, poses, scale, colors and dimensions. Remove ALL colored haze, glow, floor and background between and around the characters. Output actual transparent alpha ZERO outside character silhouettes, clean cutout edges, no shadow or halo. Preserve the opaque white eyes and shoes inside the characters. Do not move, redraw or add anything.
