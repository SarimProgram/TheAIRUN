# Goal icons v1

## Workout onboarding icons

`workout-icons-v1.png` is a transparent 3-column, 2-row sheet generated with the built-in image generation tool. Top row: calendars for 2, 3, and 4 training days. Bottom row: strength dumbbells, gym bench, and home exercise mat. The six `workout-*.png` crops are 288px square and preserve the original alpha. `Weight_Branch.tsx` uses the workout preference icons; frequency is selected with a native slider from 1 to 7 days, defaulting to 3.

Generation prompt: Create a production fitness onboarding icon sprite sheet, transparent PNG, exactly 3 columns by 2 rows, six equally sized square cells. Match warm polished stylized 3D fitness icons: rounded sculpted forms, tactile cream, coral #FF6B6B and dark teal #148C91 materials, upper-left soft light, restrained highlights. Each object centered with generous transparent margins, equal optical weight, fully isolated in its cell. Top row: left a coral desk calendar with TWO teal check marks; center a coral desk calendar with THREE teal check marks; right a coral desk calendar with FOUR teal check marks. Bottom row: left STRENGTH represented by a pair of teal dumbbells with coral grips; center GYM represented by a compact teal weight bench and coral barbell; right HOME represented by a cream house with coral roof and rolled teal exercise mat. No text, letters, numerals, labels, grid lines, background tiles, people, or extra objects. Crisp legibility at 56px.

Asset: `goal-icons-v1.png`. Generated with the built-in image generation tool, with transparency preserved. The sheet has two columns and two rows: calorie meal, steps shoe, workout dumbbells, water bottle. `CollapsibleGoal.tsx` displays one cell per goal.

Style references: `assets/menu/activity.png`, `assets/menu/exercises.png`, `assets/rewards/massage.png`.

## Onboarding primary goal icons

Assets: `goal-lose-weight.png` (coral scale with yellow tape), `goal-stronger-runner.png` (teal sneaker with speed lines), `goal-weight-and-run.png` (teal dumbbell). Used by `components/onboarding/5_PrimaryGoal.tsx`.

`Weight_Branch.tsx` reuses those and adds `goal-walking.png` (coral walking sneaker with footprints), `goal-walk-run.png` (coral walking and teal running sneakers) and `goal-race-medal.png` (gold medal on a coral ribbon), generated the same way with the existing icons as style references and exported with `python scripts/export-goal-icons.py <generated-dir> goal-walking goal-walk-run goal-race-medal`. Generated on white, with `goal-icons-v1.png` as the style reference, then cut out and resized to 288px with `python scripts/export-goal-icons.py <generated-dir>`.

## Goal icons v1 generation prompt

Create a production UI icon SPRITE SHEET for RunTogether fitness app. The provided local images are STYLE REFERENCES ONLY, do not reproduce their characters. One square transparent PNG, exactly 2 columns by 2 rows of equally sized cells. Four separate centered icons, each fully contained in its cell with generous transparent margins, equal optical size, no touching neighboring cells. Order top-left Calorie Goal: a warm coral ceramic plate holding a simple balanced meal with green vegetables, golden protein and rice; top-right Steps Goal: a coral and cream athletic sneaker with subtle dark teal accents, three-quarter side view; bottom-left Workout Goal: a pair of dark teal dumbbells with coral grip accents; bottom-right Water Goal: a translucent teal reusable water bottle with a coral cap, no lettering. Match the app's warm polished stylized 3D illustration: softly rounded sculpted forms, believable materials, restrained glossy highlights, warm upper-left lighting, gentle contact shadows, coral #FF6B6B and dark teal #148C91 with cream neutrals. Rich and tactile but legible at 48px. NOT emoji, NOT flat outline icons, NOT purple, NOT the blue sneaker and purple dumbbell seen in generic fitness UI. No people, no text, no labels, no badges, no backgrounds, no tiles, no grid lines. Genuine alpha transparency. All four icons same camera angle, lighting and visual weight.
