# Exercise Session Algorithm

This feature now works in 2 layers:

1. a simple exercise guide
2. a generated mixed workout session

## 1. Simple exercise guide

- When the user taps one exercise card, the app does **not** start the full workout immediately.
- It opens a simple guide screen for that exercise.
- That screen shows:
  - a short description
  - a simple reps target
  - basic instructions
  - a small timer for quick solo use

Example:

- `Push-ups`
- `3 x 10 reps`
- short form instructions
- quick timer

## 2. Generated mixed workout session

- When the user presses `Play Weekly Mixed Session`, the app creates one workout from a mix of exercises.
- It does **not** repeat only the tapped exercise.
- It selects multiple exercises and combines them into one session.

Example workout:

- `Squats -> 3 x 12 reps`
- `Push-ups -> 3 x 10 reps`
- `Lunges -> 3 x 10 reps each leg`
- `Plank -> 3 x 30 sec`

## How the mixed workout is built

- The session has 3 parts:
  - `warmup`
  - `exercise blocks`
  - `cooldown`
- The app builds the workout using `4` roles:
  - `1 lower-body exercise`
  - `1 upper-body exercise`
  - `1 posterior / secondary strength exercise`
  - `1 core finisher`
- The exercises are selected by role, not just by list order.
- Inside each role, the app rotates choices by week so the mix changes over time.

## Current selection basis

- `Lower` bucket:
  - examples: `Lunges`, `Step-ups`, `Squats`
- `Upper` bucket:
  - examples: `Push-ups`, `Rows or Pull-ups`
- `Posterior / secondary` bucket:
  - examples: `Deadlifts`, `Glute Bridges`
- `Core` bucket:
  - examples: `Plank`, `Dead Bug`

This means the workout is now balanced on purpose:

- legs / main lower-body work
- upper-body work
- posterior-chain support
- core finish

## Home-based only toggle

- The library screen also has a `home-based only` toggle.
- When this is turned on, the workout is generated only from exercises marked as home-based.
- The same role-based structure is still used:
  - `1 lower`
  - `1 upper`
  - `1 posterior`
  - `1 core`
- The only difference is that each role is picked from the home-based subset instead of the full list.

## Progression by week

- The week number changes the prescription.
- Repetition-based exercises:
  - start with a base rep target
  - reps increase slowly as weeks progress
- Timed exercises:
  - start with a base number of seconds
  - hold time increases slowly as weeks progress
- Sets:
  - start at `3` sets
  - increase gradually
  - capped at `5` sets

## Timers during the mixed session

- The workout player shows:
  - one `total session timer`
  - one `current phase timer`
- The session moves through:
  - warmup
  - set blocks for each selected exercise
  - cooldown

## Current behavior summary

- Tap exercise card:
  - open simple guide
- Press `Play` on the library session card:
  - start generated mixed weekly workout

Implementation lives in:

- [MobilityExercises.tsx](/c:/Users/MSari6/TheAICoach/app/components/plan/MobilityExercises.tsx)
- [GuidedMobility.tsx](/c:/Users/MSari6/TheAICoach/app/components/plan/GuidedMobility.tsx)
