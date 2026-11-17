# Separate training sessions

Every newly generated plan stores a version 1 `trainingSchedule` inside each week's existing `weekDailys` JSON, including regeneration for existing users and full plan resets. No database migration or existing-plan backfill is required. Reading a saved plan or returning it from cache leaves it intact; explicit regeneration replaces a legacy plan using the current preferences and scheduling rules.

`workoutDaysPerWeek` is the total number of training days across every selected activity. A day contains at most one RUN, WALK, or WORKOUT session. The app allocates mixed sessions using the goal, age, BMI and running experience, keeps the activity pattern consistent across weeks, and asks the model for progressively appropriate cardio distances. Server normalization enforces the count and activity types even if the model schedules extra sessions.

WORKOUT sessions have a `workoutPreference` of `gym`, `home`, or `strength`. Gym opens a self-directed session with the existing photo check-in flow. Home and strength recommend only the current animated workout library; strength restricts recommendations to its Strength category. A saved `workoutId` identifies the recommendation for each workout day. The player uses the library's actual prescriptions, illustrations and animations, including its two-person requirement. The old solo exercise list is excluded. Users can choose another library workout or add photo proof of their own routine.

Recovery days retain daily food, protein, steps and hydration goals. Workout-only plans have no scheduled cardio distance.

## Customization

After paywall access is resolved, users with an unreviewed version 1 schedule review their week in `/customize-plan`. Legacy and already-reviewed schedules bypass this page. Pending setup resumes from the home/plan routes after restart. Version 1 schedules can also be edited from the Plans dashboard.

- `GET /plan/training-schedule` returns the current schedule, selected activity types and an explanation. Legacy plans return `schedule: null`.
- `PATCH /plan/training-schedule` accepts `sessions`, requires the original total count, unique weekdays, selected activity types and a preference on workout days. It atomically updates the current and future weekly schedules and daily targets. Earlier weeks and nutrition targets remain intact.
- `/plan/schedule-days` supports one through seven days and preserves the existing number of sessions for version 1 schedules.

## Validation

Backend tests cover every activity combination across one to seven days, workout-only plans, running-only plans, goal/body-based allocation, model over-scheduling, customization validation and legacy preservation. Frontend projection tests cover exact weekdays and distances, separate gym days and legacy behavior. Native camera, purchase navigation, layout and motion still require device verification.
