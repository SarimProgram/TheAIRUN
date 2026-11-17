# Static personalized Home pose sheet

Upload yours opens a local photo preview. Make my character explicitly sends the face photo to OpenAI. The result is a single static sheet containing all Home poses in the app's original athletic avatar style. Use across Home saves the selection for the weekly portrait and all four goal cards. Choosing a photo alone does not send it. Provider failures and cancellation keep the previous avatar.

## Layout and artwork

The API returns `{ uri, layout: "home-v1", columns: 3, rows: 4 }`. The URI is a transparent indexed PNG, 512 x 768. There are three columns and four rows; each cell is 512/3 x 192. This is a pose collection, not an animation timeline.

| Index | Pose | Consumer |
| --- | --- | --- |
| 0 | Existing weekly portrait | WeeklyRewardHome / EditableAvatar |
| 1 | Arms down | Calories: idle |
| 2 | Hand on hip | Calories: progress |
| 3 | Both arms raised | Calories: winning |
| 4 | Bowed head, hands on thighs | Calories: over target |
| 5 | Resting with water bottle | Water before intake |
| 6 | Drinking | Water with intake |
| 7-10 | Neutral, trailing, pulling, strongly braced | TugOfWar in StepTracer |
| 11 | Existing full-body workout/running pose | WorkoutPhotoStack empty artwork |

`backend/scripts/build-avatar-pose-references.cjs` builds the male/female reference sheets directly from the current app assets, preserving original poses, framing and grip geometry. It packs the existing portrait, four calorie reactions, water rest/sip, four tug stances and full-body weekly character into the documented order. Generated faces follow the uploaded identity; rendering, proportions, materials and clothing follow these app references. No generic cute/chibi character sheet is used as the style target.

The provider receives a face photo and the corresponding original pose sheet. The prompt requires the same cell positions, body poses, foot baselines and hand positions, with recognizable facial features instead of the app's placeholder white eyes. A flat magenta backdrop is removed by `encodeHomePoseSheet`; white eyes, shoes and skin are preserved. Output is quantized to 192 colors with alpha. Two live examples were about 81 KB; one likeness-reference example took 10.9 seconds. Timing and output details vary with the photo and provider load.

## Client behavior

`lib/home-avatar.tsx` keeps one reactive selection per account and per participant, backed by AsyncStorage. All cards update together after save or restore. The Home scope supplies the current partner key; the authenticated own-account key also works when StepTracer's child renderer appears outside the Home route. Choices remain on the current device and do not sync to the partner's phone.

`HomeAvatarPose` draws one named cell with the original source viewport. Calorie reactions and step score changes select poses directly. Water logging still works; the static cell follows intake state. Generated figures have no loop, blinking sequence, bobbing or tap bounce. Existing workout photos remain the workout content; the avatar is the artwork for an empty photo card.

Legacy 2x2 generated avatars display only their first pose. Add Home poses prepares that face as a new reference, then asks for the normal OpenAI confirmation before generating a new Home sheet. Original photos can still be used directly.

## Backend and deployment

`POST /avatars/generate` requires the app access token. JSON: `{ photo: "data:image/jpeg;base64,...", accent: "teal" | "coral" }` (PNG/WebP input also accepted), up to 1 MB. Images are validated, metadata stripped, and processing stays in memory. No image is saved to the backend database/filesystem. Configure the server-only `OPENAI_API_KEY`; `OPENAI_AVATAR_MODEL` defaults to `gpt-image-2.6-flare`. Low quality and low complexity retain the fast configuration while rendering the larger pose collection.

Deploy the avatar route, generation service and both `backend/assets/avatar-home-poses-*.png` files. Asset paths work from both `src/services` and compiled `dist/services`. No database migration is needed. Generation has no automatic provider retries, a 150-second provider timeout, one in-flight request per user and three successful generations per hour. Limits are process-local; a shared quota store is needed before multiple backend replicas.

Implementation follows the official [OpenAI image-edit documentation](https://developers.openai.com/api/docs/guides/image-generation).

Backend tests cover authentication, validation, quotas, concurrency, sanitized provider errors, exact reference/prompt fields, layout metadata, compression and alpha preservation. Browser checks exercise live shared selection across all four goal cards, participant isolation, state pose changes, static rendering, water actions, persistence, restore and legacy upgrade at 393px light and 320px dark. Workspace-wide app TypeScript errors remain in unrelated pre-existing code; avatar components introduced no reported errors. Native simulator verification is unavailable in this Windows environment.
## Hosted verification

Railway deployment `c0863be5-a2ad-46fe-90b3-d0a62e5ef51a` succeeded on 10 November 2026 (Australia/Sydney), on `efficient-creation / backend / staging`, the API service configured by the app. It preserved the existing deployed backend and database migrations, updating only the avatar route/service and adding the two app pose-reference assets. An authenticated hosted generation returned `home-v1`, 12 poses, a transparent 512 x 768 PNG of 81,618 bytes, in 10 seconds. Public health returned 200 and unauthenticated avatar generation returned 401. The check used existing app artwork as a synthetic identity reference; no real user's account or photograph was changed.