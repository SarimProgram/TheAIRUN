# Plans artwork checklist

The Plans dashboard now uses the approved faceless male/female character family from StepTracer and CaloriesHome. A six-cell reference-guided sheet supplies standing, dumbbell, and walking poses for both genders. Source and runtime crops are in `assets/plan/coaches/`; the SVG brush stroke is drawn in code. Other workout surfaces still use `ArtPlaceholder` in `PlanVisuals.tsx`.

Use one consistent 3D character family: teal solo/male outfit, coral partner/female outfit, soft light, transparent backgrounds. Keep text, icons, hearts, timer rings, and background shapes in code.

## Shared artwork

| Asset | Used in | Suggested export |
| --- | --- | --- |
| Standing coach, arms folded | Weekly calendar | Transparent portrait, 768 × 1024 |
| Solo strength / mobility hero | Weekly workout, solo detail | Transparent landscape, 1536 × 1024 |
| Walking / running coach | Scheduled walk or run thumbnail | Transparent square, 768 × 768 |
| Partners greeting / fist bump | Workout library header | Transparent square, 1024 × 1024 |
| Partners doing plank high-five | Featured card, couple detail, exercise player | Transparent landscape, 1536 × 1024 |

## Couple exercise artwork

Generate one landscape illustration per movement. Reuse the source for thumbnails and the active exercise rather than generating separate crops.

1. Partner Sit-Up Pass, passing a light ball while seated facing each other.
2. Plank High-Five, facing each other in a stable high plank.
3. Partner Squat High-Five, facing each other, standing from a squat.
4. Back-to-Back Twist, seated back-to-back passing a light ball.
5. Partner Alternating Leg Raise, lying side by side with room to move.

The plank asset above is shared: **nine unique new illustrations** cover the shared artwork and all couple exercises.

## Solo exercise artwork

Existing files already cover Lunges, Step-ups, Deadlifts, Squats, Push-ups, Rows or Pull-ups, Glute Bridges, Plank, and Dead Bug. They remain on disk; the new flow deliberately shows placeholders. Reuse these after approval, or generate nine matching replacements if the character family changes.

Warm-up and cool-down can reuse the walking coach. No new tab icons are required.

## Data and behavior

- Existing training plan, run launch routes/session IDs, daily summaries, health steps, food logging, water sync, and point claims stay connected.
- Steps and water complete at their targets. Nutrition uses the app's existing inclusive 70–100% target rule.
- Sleep displays unavailable and never checks itself without a connected source.
- Solo routines keep the existing weekly exercise prescriptions, warm-up, sets, and cool-down.
- Couple routines are additional local content. Their duration comes from their actual timed steps; calorie burn is not invented.
- Favorites persist locally per account. Workout completion uses the pre-existing mobility completion callback; it does not introduce a new server history API.
- A session completes only after all steps have run. Skipping a step requires returning to it before completion.
