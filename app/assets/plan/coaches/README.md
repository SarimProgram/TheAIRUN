# Plans coaches

Selected source: `coach-sheet-v2.png`. Runtime uses only the six `*-v2.png` pose crops. The v1 files are unused drafts with an incorrect facial style and must not be imported.

Generated with the built-in image generation tool, using `avatars/weekly-male.png`, `avatars/weekly-female.png`, and `avatars/nutrition-reactions-v3.png` as direct identity references. These are the same character family used by StepTracer's TugOfWar and CaloriesHome's NutritionCharacter.

Identity: featureless faces with white almond eyes only; no mouth, nose, eyebrows, or pupils. Swept brown male hair and teal panelled shirt/shorts; auburn female ponytail and coral panelled shirt/shorts. Both have black watches and matching trainers.

The sheet has three columns (arms folded, dumbbell curl, walking) and two rows (male, female). Original alpha is preserved. Reproduce crops with `python app/scripts/export-plan-coaches.py`. Calendar crops stop near the thighs to give the coach the reference layout's prominence. Workout thumbnails use their respective full pose.

The organic turquoise backdrop is an SVG path in `PlanCoachArt.tsx`, with a light/dark gradient. It requires no new dependency and is not baked into the PNGs.

## Selected generation prompt

Use case: identity-preserve. Asset type: production transparent six-cell coach sprite sheet for the SAME fitness app as the supplied references. References 1 and 2 are the exact existing male and female characters. Reference 3 is the current nutrition reaction atlas and confirms the SAME exact faceless character identity and athletic proportions. Preserve the characters exactly: smooth blank skin-colored faces, ONLY solid white almond eyes, NO mouth, NO nose, NO eyebrows, NO pupils; swept brown male hair, auburn female high ponytail. Muscular adult male in teal panelled short-sleeved athletic shirt and matching teal shorts, teal-white trainers, black wristwatch. Athletic adult female in coral panelled short-sleeved athletic shirt and matching coral shorts, coral-white trainers, black wristwatch. Match original realistic stylized polished 3D anatomy, proportions, clothing panels, skin tone and rendering, not cute cartoon faces. Exactly THREE columns and TWO rows on a square transparent PNG sheet, six evenly sized cells with large clear gutters and generous margins. Male across top row, female across bottom row. COLUMN ONE: standing arms folded confidently, front three-quarter view, entire body visible. COLUMN TWO: holding two black dumbbells at the top of a controlled curl, front three-quarter view, head to upper thighs framing. COLUMN THREE: brisk walking/running full-body pose facing right three-quarter view. Each figure completely contained in its own cell, no intercell overlap. Same identities in every pose. TRUE transparent alpha zero outside figures, no floor, no halo, no background, no decorative stroke, no text, no grid lines or labels. Soft consistent studio light, crisp clean cutout contours. Do not add any facial feature beyond the exact white eyes.

