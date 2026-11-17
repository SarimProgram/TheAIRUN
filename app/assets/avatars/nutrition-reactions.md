# Nutrition character sheet

Selected asset: `nutrition-reactions-v3.png`, 1536 × 1024 RGBA.
Generated with the built-in image generation tool, using the actual StepTracer
atlas and a prior nutrition sheet as identity references. Male row 0, female
row 1; four columns. All figures face right; mirror the viewport on the right.
Version 3 is the integrated artwork. Earlier versions are unused drafts.

Each cell is 384 × 512. Render the inner 300 × 512 viewport at x = column ×
384 + 44, y = row × 512. This keeps every full body and raised hand visible.
Do not crop each pose to its own bounds: the tired pose must stay lower and
shorter, with the same foot baseline as the upright poses.

| Column | State | Pose |
| --- | --- | --- |
| 0 | idle | Arms relaxed; no food logged or no target |
| 1 | progress | One hand at hip, no held objects |
| 2 | winning | Both arms raised in celebration |
| 3 | over-target | Head bowed, shoulders down, hands on thighs |

`nutritionReaction.ts` chooses each person's state independently. Over-target
takes priority. Otherwise, once both people have logged intake, the person with
the smaller absolute distance to their own target (as a proportion of that
target) celebrates. Equal proportions use progress. Intake minus burned
calories supplies the net value. This visual comparison does not award points
or modify completed-goal rules. Pose changes fade once; unchanged refreshes
keep the pose. Reduced Motion is respected.

`nutrition-food-v1.png` is a separate 1774 × 887 transparent two-cell food atlas
used on the existing scale pans. It is decorative food, not a depiction of
the user's specific logged meal. Empty pans remain empty until food is logged.

## Runtime assets

The calorie view now renders separate, pre-cropped transparent PNGs in `nutrition/`.
The original sheets remain source artwork and are not imported by the calorie renderer.
Run `python app/scripts/export-nutrition-assets.py` to reproduce the ten PNGs (requires Pillow).

- Eight character files: `{male,female}-{idle,progress,winning,over-target}.png`, each 300 x 512.
- Two food files: `food-left.png` and `food-right.png`, each 770 x 540.
- Character crops retain the original padding and foot baseline. They use `contain` with bottom alignment; right-side characters are mirrored in the view.
- Food crops use the original scale-pan viewports: left `(60,300,770,540)` and right `(947,300,770,540)`.
- The homepage prefetches only the current two poses and food for nonempty pans, after interactions settle. Images use the Expo Image memory/disk cache; failed prefetches can retry.
- Pose changes update a cached image source without runtime atlas cropping or remounting the view.

## Character generation prompt

Use case: identity-preserve. Asset type: production nutrition reaction sprite atlas matching existing StepTracer fitness mascots. Reference1 is the EXACT original character identity/style from StepTracer. Reference2 is a previous nutrition sheet whose body poses need changing. Preserve EXACT faces and outfits: smooth featureless faces with ONLY solid white almond eye shapes, no mouth, no nose, no eyebrows, no pupils. Short swept brown hair athletic man in teal panelled shirt/shorts and teal-white sneakers, black wristwatch. Auburn high ponytail athletic woman in coral panelled shirt/shorts and coral-white sneakers, black wristwatch. Same muscular 3D anatomy, proportions, skin tone, lighting and costume as Reference1. Generate EXACT 4 columns by 2 rows on 1536x1024 transparent canvas: male top row, female bottom row. Each of 8 cells is 384x512 with full body including shoes fully visible, equal scale, same baseline with generous padding. All figures in three-quarter RIGHT view, each isolated wholly in its cell. COLUMN1: relaxed upright neutral idle pose, arms naturally down. COLUMN2: calmly progressing, standing upright with one hand at hip and other arm resting naturally down; NO held object. COLUMN3: clear WINNING CELEBRATION, BOTH fists raised overhead in a triumphant V, chest open, energetic happy body language, feet grounded. COLUMN4: clearly TIRED / OVER TARGET, slumped shoulders, head bowed downward, knees slightly bent, both hands resting on thighs just above knees, fatigued body language; preserve normal healthy body and clothes. Absolutely NOTHING held in any pose: no food, bowls, utensils, weights, objects, rope or props. Expressions entirely through BODY language, do not add facial features. True transparent alpha surrounding each figure, no background, no floor, no shadows, no glow, no UI, no text, no cell dividers. Keep all raised arms entirely inside frame with space above fingers; consistent overall scale across cells.

## Food generation prompt

Use case: stylized-concept. Asset type: two-cell food sprite atlas for a premium fitness mobile app. Exactly TWO equal square cells side by side on a 1024 by 512 transparent canvas. LEFT cell: one compact appetizing mound of grilled sliced chicken, rice, leafy salad, sliced avocado and cherry tomatoes. RIGHT cell: one compact appetizing mound of boiled egg halves, blueberries, apple slices, leafy salad. Both are isolated cutout food arrangements, three-quarter front view, same camera and same scale, polished detailed 3D mobile game rendering with warm natural studio lighting, coral and teal fitness app style. No plates or bowls, no background or floor, no text, no decorative elements, no cast shadows or glow. Food sits in lower half of each cell with clearly visible ingredients and ample transparent padding. True transparent alpha between and around food. Entire food arrangement stays inside its own cell and never touches edges. This is production asset artwork, not an app screenshot.
