# Onboarding Data Mapping: Frontend to Backend

This document outlines how the user selections in the **Running** and **Weight Loss** branches are mapped to the `UserPlan` model in the database.

---

## 1. Running Branch (`Running_Branch.tsx`)

| Frontend Step ID | Selection Options | Backend Field (`UserPlan`) | Logic / Notes |
| :--- | :--- | :--- | :--- |
| `trainingGoal` | `5k`, `10k`, `halfMarathon`, `speedImprovement` | `runGoal` | Direct string ID |
| `experience` | `beginner`, `intermediate`, `advanced` | `runExperience` | Direct string ID |
| `dietStrategy` | `performance`, `weightloss` | `runDietFocus` | Direct string ID |
| `priority` | `faster`, `longer`, `form` | `runPriority` | Direct string ID |
| `raceDate` | `yes`, `notYet` | `hasRaceGoal` | Boolean: `true` if "yes" |
| `raceDate` (DatePicker) | Calendar Selection | `runRaceDate` | ISO string converted to `DateTime` |

---

## 2. Weight Loss Branch (`Weight_Branch.tsx`)

| Frontend Step ID | Selection Options | Backend Field (`UserPlan`) | Logic / Notes |
| :--- | :--- | :--- | :--- |
| `timeline` | `moderate` | `timeHorizon` / `targetDate` | `timeHorizon`: "STANDARD" <br> `targetDate`: Current + calculated weeks |
| `timeline` | `aggressive` | `timeHorizon` / `targetDate` | `timeHorizon`: "AGGRESSIVE" <br> `targetDate`: Current + calculated weeks |
| `timeline` | `custom` | `timeHorizon` / `targetDate` | `timeHorizon`: "SPECIFIC_DATE" <br> `targetDate`: Specific user selection |
| `trainingStyle` | `walkOnly`, `runOnly`, `walkAndRun` | `trainingStyle` | Direct string ID |
| `raceTraining` | `yes`, `no` | `hasRaceGoal` | Boolean: `true` if "yes" |
| `bodyType` | `hourglass`, `pear`, `apple`, `athletic` | `bodyType` | Direct string ID |

---

## 3. General User Info (Collected in Previous Steps)
These are synced across both paths during the plan upsert.

| Field | Backend Field | Source |
| :--- | :--- | :--- |
| Current Weight | `weightKg` | Step 6: `6_Weight&Height.tsx` |
| Height | `heightCm` | Step 6: `6_Weight&Height.tsx` |
| Age | `ageYears` | Step 6: `6_Weight&Height.tsx` |
| Target Weight | `targetWeightKg` | Step 7: `7_TargetWeight.tsx` |
| Goal Category | `goalType` | Step 5: `5_PrimaryGoal.tsx` (`WEIGHT_LOSS`, `ENDURANCE`, etc.) |

---

## Backend Route Info
- **Endpoint**: `POST /plan`
- **Controller**: `backend/src/routes/plan.routes.ts`
- **DB Table**: `UserPlan`
