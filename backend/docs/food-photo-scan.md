# Food photo scan

The Activity food logger (also opened by the home Calorie Goal) expands a captured
photo into `FoodScanTransition`, runs two authenticated multipart requests in
parallel, then animates the photo into its measured position in the results sheet.
Nutrition remains a review step; the user confirms Save Log before a meal is saved.

`FoodLogSheet` owns the camera/manual/review presentation, safe-area footer,
gesture-driven dismissal and sheet entrance/exit. Draft content stays visible
until its dismissal finishes. `FoodLogCoach` uses the matching profile gender
and twelve aligned poses per character in both the sheet and scanner. Sprite
source, generation prompt and the repeatable export process are recorded in
`app/assets/avatars/food-coach-poses-v1.md`. The avatar beneath the scanner pauses
while covered; Reduce Motion and backgrounded apps use a still pose.

- `POST /nutrition/meals/analyze`: existing nutrition analysis.
- `POST /nutrition/meals/isolate`: transparent PNG data URL, `Cache-Control: no-store`.
  Images are resized to a maximum of 768px, processed in memory, and never stored.
  This endpoint uses local ONNX inference; no image is sent to an additional service.

Nutrition analysis uses OpenAI `gpt-6.1-terra` with Chat Completions
`reasoning_effort: "low"`, high-detail image input, and a strict internal JSON
schema. The developer prompt is in `src/services/mealAnalysis.ts`; user meal
descriptions are sent separately as JSON meal data. Saved logs default to the same
model identifier. Refused or incomplete model answers return 502 for retry.

The model returns portion bounds, a central gram estimate, per-100-g nutrition,
separate food/portion confidence levels, and uncertainty notes. The compatibility
adapter validates the result and computes each item's nutrition from
`nutritionPer100g * grams / 100`, using the central weight exactly once. Calories
round to integers, macros to one decimal; totals sum those displayed item values.
Unknown macros remain null. Invalid bounds, values, or meal types return 502.

The frontend and public response format are preserved: `mealType`, `items`,
`totals`, and `confidence`. Item fields remain `foodName`, `servingQty`,
`servingUnit`, `grams`, `calories`, `proteinG`, `carbsG`, `fatG`, and `confidence`.
Portion ranges, notes, and clarification questions stay internal; no new UI flow
or database migration is required. Compatibility confidence scores map low/medium/
high to 0.3/0.6/0.9, taking the lower identification/portion level per item and
the lowest item score for the meal. These scores are not calibrated probabilities.

Portion guidance prioritises supplied weights, counts, labels, and consumed
fractions; otherwise it uses visible scale, food depth, and edible cooked/as-served
weight. `grams`, calories, and macros cover the entire item, while `servingQty`
and `servingUnit` describe its count or household measure. Mixed dishes include
their cooking fats without duplicate ingredient rows. Estimates use a central
value, with lower confidence for uncertain portions, rather than systematically
underestimating calories. These remain model estimates: this endpoint does not
query a nutrient database or measure weight from a photograph.

Sources consulted for this prompt revision:
- [OpenAI Terra model and supported capabilities](https://developers.openai.com/api/docs/models/gpt-6.1-terra)
- [OpenAI migration parameter guidance](https://developers.openai.com/api/docs/guides/latest-model)
- [Bites: portions, visible reference objects, nutrient lookup, and corrections](https://bitesapp.fit/calorie-estimates/)
- [Foodvisor: photo estimates and quantity review](https://foodvisor.zendesk.com/hc/en-us/articles/30631165940508-How-do-I-log-a-meal-eaten-out-restaurant-at-a-friend-s)
- [Nutrition Agent: portion-range recognition prompt](https://github.com/fomin-n/nutrition-agent/blob/main/app/prompts/image_recognizer.md)
- [Nutrition Tracker: structured gram ranges](https://github.com/DimaPhil/nutrition-tracker/blob/main/src/nutrition_tracker/services/vision.py)
- [Nutrition Agent: deterministic nutrient calculation](https://github.com/fomin-n/nutrition-agent/blob/main/app/graph/nodes/calculator.py)

The commercial sources document product workflows, not their private prompts;
the GitHub sources publish example implementations. The prompt here is specific
to this app. Mocked route tests check request configuration,
photo/text inputs, serving schema compatibility, and failed-answer handling;
adapter tests check arithmetic, rounding, unknown macros, and the unchanged public
response fields. They do not measure real-world portion accuracy. Evaluate against weighed meals
before claiming an accuracy improvement.

Isolation uses IMG.LY's medium model, with bundled model assets resolved relative
to the installed package. It needs no additional API key. Deploy the updated backend
dependencies and keep package assets/native ONNX binaries in the deployment bundle.
The model occupies about 80 MB on disk; allow extra memory for inference. A warm
worker reuses the model, allows one inference at a time, and is terminated after
15 seconds if a job hangs. Busy/failing isolation returns 503 and the app keeps the
original photo. Nutrition failure returns to the camera for another attempt.
Closing the sheet cancels client requests and invalidates late results.

`@imgly/background-removal-node` is AGPL-3.0 licensed, with commercial licensing
available from IMG.LY. Review that dependency's licence for the app's distribution:
https://github.com/imgly/background-removal-js/blob/main/packages/node/README.md#license
Scoped npm and pnpm overrides reuse the backend's current Sharp and Zod versions
and a patched Lodash, avoiding the package's old native Sharp build.

Verification artifacts are in `.codex-water-preview/food-scan-preview/`, including
browser motion recordings, light/dark/small-screen screenshots, and fallback and
cancellation coverage. `food-cutout-smoke.ts` runs real segmentation on a meal photo
and checks that the output has transparent background and visible foreground.
Native iOS/Android device motion and performance still require verification.
