// Generator types for training plan generation

export type EffortLevel = "Easy" | "Steady" | "Hard";
export type StepType = "run" | "recover" | "walk" | "warmup" | "cooldown";
export type IntervalMode = "DISTANCE_BASED_BEGINNER" | "PACE_BASED";

/**
 * UI Step - renderable step for the run screen
 */
export interface UIStep {
  type: StepType;
  label: string;
  distanceKm: number;
  durationSec?: number; // Optional timer target for time-advanced blocks
  target: {
    effort: EffortLevel;
    paceSecPerKm?: number; // Optional pace target
  };
}

/**
 * User context for generating steps
 */
export interface UserContext {
  baselinePaceSecPerKm?: number;
  ageYears?: number;
  heightCm?: number;
  weightKg?: number;
  runExperience: "beginner" | "intermediate" | "advanced";
  goal: string; // "5k", "10k", "halfMarathon", "weightLoss"
  isAbsoluteBeginner: boolean;
}

/**
 * Plan scope inputs
 */
export interface PlanScope {
  totalWeeks: number;
  weeklyTargetKm: (week: number) => number; // Function to get target km for a week
}

/**
 * Weekly schedule from OpenAI
 */
export interface WeeklySchedule {
  week: number;
  runs: Array<{ runType: string; sessions: number }>;
  stepDays: number;
  runDays: number;
  recoveryDays: number;
}

/**
 * Allocated session before step generation
 */
export interface AllocatedSession {
  runType: string;
  targetKm: number;
  sessionIndex: number;
}

/**
 * Persisted plan week structure
 */
export interface PlanWeek {
  week: number;
  targetKm: number;
  sessions: Array<{
    sessionId: string;
    runType: string;
    targetKm: number;
  }>;
}

/**
 * Generator function signature
 */
export type RunGenerator = (
  targetKm: number,
  week: number,
  totalWeeks: number,
  context: UserContext
) => UIStep[];

/**
 * Rounding configuration
 */
export interface RoundingRules {
  precision: number; // 0.1 for 0.1km rounding
  remainderRule: "largest" | "last" | "first";
  minDistanceKm: number;
  maxDistanceKm: number;
}
