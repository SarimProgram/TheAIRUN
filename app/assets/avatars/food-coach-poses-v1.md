# Food logging coach animation

Generated with the built-in image generation tool using
`nutrition-reactions-v3.png` as the character identity/style reference.
Original source: `food-coach-poses-v1.png`, 1536×1024 RGBA. The source atlas is
retained; no existing nutrition artwork was overwritten.

Six columns, four rows. The top two rows contain twelve male poses; the bottom
two rows contain twelve corresponding female poses. The faces, white eyes,
teal/coral outfits, watches and shoes match the nutrition characters.

| Frames per character | Purpose |
| --- | --- |
| 0–2 | Attentive stance into a palm-up welcome |
| 3–8 | Small changes in head, shoulder and hand position while examining food |
| 9–11 | Head lifts into a thumbs-up for review |

Run `node app/scripts/export-food-coach.cjs` to reproduce the runtime strips in
`food-coach/`. The exporter retains each pose's alpha, applies the same scale to
all poses, and aligns the center and baseline of the shoes. Its measured row
boundaries account for the generated source's spacing. It does not stretch each
pose to its own bounds, remove backgrounds, or recolor the characters.

Each gender's runtime PNG is 3072×384 with twelve 256×384 cells. Both are below
the usual 4096px texture limit. Runtime views use a clipped SVG, two adjacent
frames and Reanimated props on the UI thread. The inspection sequence returns to
its first pose before repeating. Reduced Motion uses a single appropriate pose.
Playback stops when the app backgrounds or the sheet unmounts.

## Background correction

The exporter now consumes `food-coach-poses-v2.png`, a background-extraction
edit made with the built-in imagegen tool. The original atlas is retained.
Both runtime strips in `food-coach/` were rebuilt from this source.

The generated alpha still contains faint haze. `FoodLogCoach` uses an SVG alpha
matrix (`clamp(1.25 * alpha - 0.25)`) before each frame's opacity is applied.
This clears the remaining background tint during static poses and dissolves,
without changing RGB colors. The filter region is limited to the visible cell.

Final selected edit prompt:

Use case: background-extraction. Edit target: attached 1536x1024 animation sprite
atlas, 6 columns and 4 rows, 24 characters. Remove ONLY the gray/tan/teal/coral
background haze completely. All empty space between and around the figures MUST
have alpha=0, with crisp antialiased boundaries immediately along character
silhouettes. No ground shadows, no glow, no halo, no semi-transparent rectangular
areas. Character interiors should be fully opaque. Preserve EXACT original canvas
dimensions, each figure's exact position, scale, pose, proportions, face, outfit,
colors and lighting. Do not redraw or reposition any characters. Top two rows male
teal outfit, bottom two female coral. Keep all 24 poses and every detail. Output a
genuinely transparent PNG sprite atlas usable against both black and white UI
backgrounds.

## Final generation prompt (built-in imagegen)

Create a clean production ANIMATION SPRITE SHEET with EXACTLY 6 equal columns and
4 equal rows. 24 cells total. Canvas landscape 3:2 aspect ratio. Each cell SAME
SIZE. TOP TWO ROWS: 12 frames of same athletic adult MAN. BOTTOM TWO ROWS: 12
matching frames of same athletic adult WOMAN. No extra figures. No missing cells.
Reference image is only for exact character identity and polished 3D style: swept
brown-haired man, teal sports shirt and shorts; auburn ponytail woman, coral
sports shirt and shorts; white sneakers with outfit-colored panels, black watches,
smooth featureless faces ONLY two solid white almond eyes, no mouth/nose/brows/pupils.
All FULL BODIES, heads through soles, same SCALE, same PLANTED FEET at same cell
baseline. Three-quarter front view facing RIGHT. Equal transparent padding around
every character. No feet or hands crossing cell edges.
For each gender, twelve frames in reading order across its two rows:
0 neutral attentive standing. 1 starting to open near hand, palm up. 2 near hand
open in welcoming gesture. 3 tiny forward lean, head looking down at food.
4 same as 3, head a little lower. 5 same as 4, hand slightly higher. 6 same as 5,
head slightly turns right. 7 same as 6, hand slightly lower. 8 same as 3, completing
inspection loop. 9 head lifts back up, hand rotates toward a thumbs-up.
10 thumbs-up. 11 thumbs-up settling.
Only small pose changes from frame to frame. The feet must stay planted. Keep
character anatomy, costume, head and shoes consistent across all cells.
CRITICAL TRANSPARENCY: characters are isolated on COMPLETELY EMPTY TRANSPARENT
BACKGROUND. Do not reproduce the reference's colored backdrop. No background
material of any kind. NO shadows, clouds, haze, glows, colored pixels around
figures, white halos, noise, checkerboard, labels, text, grid lines, or other
objects. Crisp opaque character edges, clean alpha elsewhere. The output will be
cut into frames for a mobile UI animation. Highest quality clean detailed 3D render.
