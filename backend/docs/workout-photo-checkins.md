# Workout photo check-ins

Photo check-ins are separate from workout sessions, planned runs, calories and
rewards. Multiple pairs on a local date count once. Image expiry does not delete
completion records or change streaks.

## Storage and retention

- Photos expire exactly 30 days after capture. Feed queries and downloads reject
  expired photos immediately. Old drafts cannot be newly logged after this limit.
- Full JPEGs fit within 800 x 1067 pixels at quality 70; thumbnails fit within
  240 x 320 pixels at quality 60. Both variants strip original metadata.
- Deployment uses the private Railway `workout-photos` bucket in Singapore.
  Configure `WORKOUT_PHOTO_BUCKET`, `WORKOUT_PHOTO_S3_ENDPOINT`,
  `WORKOUT_PHOTO_S3_REGION`, `WORKOUT_PHOTO_S3_ACCESS_KEY_ID`, and
  `WORKOUT_PHOTO_S3_SECRET_ACCESS_KEY` as backend-only variables.
- Local development without a bucket uses `WORKOUT_PHOTO_STORAGE_DIR` or
  `backend/data/workout-photos`. Never silently fall back to local storage if a
  configured bucket fails.
- A startup/15-minute worker deletes expired full images and thumbnails, then
  clears their references and sets `imagesDeletedAt`. Database records remain.
  Failed deletions are retried. A daily sweep removes unreferenced bucket objects
  older than 24 hours, including abandoned uploads and deleted-account leftovers.
- Legacy volume files are migrated in batches: write all four bucket objects,
  commit the new references, then delete the old files. Migration is rerunnable.

## Delivery and phone cache

`POST /workout-photos` accepts multipart `selfie`, `surroundings`, UUID `clientId`,
ISO `capturedAt` and IANA `timezone`. Both photos are validated before storage;
retries return the same record.

`GET /workout-photos?timezone=...&cursor=...` returns only unexpired photos, each
with `expiresAt`. Progress is derived from all completion records, including those
whose photos expired.

`GET /workout-photos/:id/:kind?size=thumb|full&delivery=url` authorizes the current
user/reciprocal partner and returns a signed bucket URL valid for at most 60 seconds,
and never beyond photo expiry. Bucket credentials are never sent to the app.
An already issued URL can remain usable until its short expiry after unlinking.
Older clients using `delivery=image` (the default) receive a redirect. The local
storage fallback returns image bytes instead.

The home stacks download thumbnails. Only the selected viewer page requests full
photos. The app caches downloaded JPEGs in an account/partner-specific directory,
uses atomic temporary downloads, and avoids a second hidden image-library disk
cache. Account/partner changes and sign-out clear old caches. Expired files are
purged while the app is open and on cache activation after relaunch; an app that
is closed cannot run filesystem cleanup until opened again.

## Rollout and validation

Apply `20261106140000_workout_photo_retention` and deploy the backend first.
The migration backfills capture + 30 days, retaining all completion history.
Remove the old dedicated photo volume only after no database references depend
on it and migration has succeeded. Other service/database storage is unaffected.

On November 6, 2026, deployment `b3551d66-d828-4ba1-bc8c-2703886447ed`
applied this update. Two existing check-ins migrated to eight bucket objects;
the audit confirmed zero remaining local references and zero files on the old
volume. Its deletion was requested and its service mount/configuration removed.
Railway retains deleted volumes temporarily for its restoration window. The
subsequent configuration deployment `0487b1b2-62e6-44dc-9331-bd7a32837423` is healthy.

Backend checks:

```
npm run build
npx tsx --test src/lib/workoutPhotoProgress.test.ts src/routes/workoutPhotos.routes.test.ts src/services/workoutPhotoStorage.test.ts
```

App checks:

```
node --test tests/workoutPhotoCache.test.cjs
npx eslint hooks/useWorkoutPhotos.ts utils/workoutPhotoCache.ts components/home/WorkoutPhotoStack.tsx components/home/WorkoutPhotoCapture.tsx
npx expo export --platform android
```

Tests cover compression dimensions, migration, expiry boundaries, signed URL
lifetimes, deletion retries, preserved history, duplicate uploads, partner access,
cache reuse, full/thumbnail separation, expired cache removal, scope changes and
sign-out during download. The repository-wide app typecheck has unrelated existing
errors. Physical-device camera and motion checks remain unverified because this
Windows environment has no emulator/device bridge available.
