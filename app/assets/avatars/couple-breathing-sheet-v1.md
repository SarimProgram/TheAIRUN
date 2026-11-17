# Couple Clash breathing atlas

Generated with the built-in image generation tool, using
`step-battle-tug-sheet-1536.png` as the edit reference. Original retained.

Output: `couple-breathing-sheet-v1.png`, 1774 × 887 RGBA, six columns and two rows.
Top row: male, teal. Bottom row: female, coral. Both face right.

## Final generation prompt

Edit this game sprite atlas into a subtle idle BREATHING animation sheet.
Preserve the EXACT two characters, illustration style, teal male top row,
coral female bottom row, both facing right, 6 equal columns by 2 equal rows.
All 12 full body figures same scale and baseline and identical shoe locations
in each row; keep both fists at their initial fixed coordinates across every
frame. No rope. Only tiny chest expansion, shoulder rise, head tilt and
exertion changes: columns are rest, slight inhale, full inhale, slight
exhale, rest, tiny effort. Smooth seamless looping motion, not six different
leaning poses. Preserve shoes and lower legs exactly in place. Canvas wide
2:1, precisely regular 6x2 grid, isolated actual transparent background, no
floor shadows, no labels, no grid lines, no extra objects. Full bodies with
generous transparent margins within every cell, no clipping or adjacent-cell
contamination. Production sprite sheet.

## Runtime

`CoupleCharacterRig.tsx` uses only the first pose in each row. Static SVG masks
divide that sharp rest pose into head, torso, arms, and fixed legs. Native
animated views move these layers with degree-valued rotations and an anchored
chest stretch. No animated SVG matrices, sprite switching, or frame blending
are used. A small underlap at joints prevents seams. `coupleRigGeometry.ts`
shares the same transforms with the rope's hand attachment calculations.

The loop uses a sine wave with matching position and velocity at its wrap.
Teams and partners breathe at different phases. Motion stops offscreen, in
the background, and with Reduce Motion enabled.

The breathing clock starts independently of image-load events and resets its
phase before restarting, including after Fast Refresh or interrupted animation.

On opening or returning to the arena, a short shared pull sequence leans the
upper bodies back, eases forward, and settles before the idle breathing begins.
The opening pull participates in the same hand attachment geometry as the
body layers, so the rope follows it. It is canceled on blur/background and
skipped with Reduce Motion enabled.

The original atlas supplies profile head crops and other battle screens;
the breathing atlas is used only by Couple Clash.
