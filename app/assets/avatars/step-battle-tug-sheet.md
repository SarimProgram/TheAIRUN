# Step battle tug atlas

`step-battle-tug-sheet.png` is a 1774 × 887 RGBA PNG, six columns by two rows.
Cells are 295⅔ × 443½ source pixels; retain fractional coordinates when clipping.
Clip the empty rightmost 14 pixels of each cell at render time to prevent a
neighboring ponytail fragment from appearing at the frame edge.
Male is row 0; female is row 1. All source poses face right. Mirror the complete
frame viewport for a participant on the right. Both characters use the same
six-frame, 1080 ms sequence (brace → pull → strain → recover). Play once when the page opens or either step count changes, then hold frame 0. Unchanged refreshes do not restart the sequence. Taps play a brief cheer bounce with the SVG rope following the hands.

Frame dimensions, foot baselines, and both hand anchors are recorded in
`components/battle/tugSprite.ts`. Coordinates are local to each cell before
mirroring. The rope is drawn behind the characters, from the rear fist through
the front fist, then across to the other participant. No rope is baked into the
artwork. The original weekly avatar assets remain available for other screens.

Generated using the built-in image generation tool, with `weekly-male.png` and
`weekly-female.png` as identity/style references. Selected first sheet plus its
background-extraction edit; the other generated candidates are not used.

## Optimized runtime sheet

`TugOfWar.tsx` (used by `StepTracer.js` and the full battle) now loads
`step-battle-tug-sheet-1536.png`: 1536 x 768 RGBA PNG, still six columns and two rows.
Each physical frame is 256 x 384. The original PNG remains the source artwork.

Generate it with `python app/scripts/optimize-step-sprite.py` (Pillow required).
The script resizes with Lanczos in premultiplied alpha to avoid dark cutout fringes,
then writes an optimized PNG with maximum lossless compression. No palette reduction,
frame removal, new decoder, or timing change is involved.

The generated file is 1,008,594 bytes versus 1,367,278 bytes originally (26.2% smaller).
Decoded RGBA storage drops from 6,294,152 to 4,718,592 bytes (25.0% less).
This is a conservative near-3x phone asset; enlarged views can be slightly softer.

All grip coordinates, frame translations, clipping gutters, and foot baselines stay
in the original 1774 x 887 logical coordinate space. The existing Animated.Image
`resizeMode="stretch"` maps the same-aspect optimized PNG to that space, keeping
animation and SVG rope alignment identical.

The homepage warms this asset through the React Native image cache after navigation
interactions settle. A failed prefetch may retry. The collapsed goal retains its last
nonzero arena width and its mounted image after first opening. Expansion visibility
is passed to the battle; pose playback waits for both character images to finish
loading, resets while hidden, and replays on every reveal, including unchanged steps.
Reduce Motion holds the appropriate resting pose instead.

## Generation prompt

Create a production animation sprite sheet using these two reference characters.
Preserve their stylized polished 3D anatomy, faceless faces with white eyes, brown
male hair, auburn female ponytail, teal male athletic outfit and coral female
athletic outfit. Transparent background actual alpha. EXACT grid: 6 columns and
2 rows, 12 full body figures total, equal rectangular cells, preferably 3072x1536
canvas (512x768 each cell). Top row male, bottom row female. ALL characters face
RIGHT in three-quarter side profile. Every cell same scale, camera, feet baseline,
generous clear margins. Tug of war poses: knees bent, feet braced wide, body
leaning LEFT away from imagined pull, both forearms extend right, BOTH HANDS
tightly curled gripping an INVISIBLE horizontal rope at waist height. Two fists
aligned on same horizontal axis, hands in front of torso to right. Six sequential
subtle poses: brace, start pulling, pull, maximum backward strain, easing,
recovery leading seamlessly to brace. Feet planted consistently, small
shoulder/elbow/head/hair motion. Crucial: DO NOT DRAW ANY ROPE, cord, stick, bar,
connecting line or object whatsoever, including between fingers. Only characters.
Empty transparent space around gripping fists. No shadows, ground, scenery,
labels, text, grid lines. Each figure isolated fully within its cell.

## Background extraction prompt

Background extraction only. Preserve all twelve character poses and exact
positions of this 6-column 2-row animation sprite sheet. Remove ALL white/gray
background, floor, shadows and haze. Background must be fully transparent alpha
ZERO everywhere outside characters, not translucent white. Clean cutout edges.
Preserve white eyes and shoes within figures. Do not add anything. NO rope. Keep
dimensions and character positions unchanged.
