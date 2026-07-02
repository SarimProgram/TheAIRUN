// Generator configuration - data-driven, not hardcoded

import { RoundingRules } from "./types";

/**
 * Run type multipliers for weighted km allocation
 * Higher multiplier = more km allocated proportionally
 */
export const RUN_TYPE_MULTIPLIERS: Record<string, number> = {
    "Long Run": 1.5,
    "Tempo Run": 1.2,
    "Progression Run": 1.2,
    "Steady Run": 1.1,
    "Interval Run": 1.1,
    "Fartlek Run": 1.1,
    "Hill Run": 1.1,
    "Time Trial": 1.3,
    "Easy Run": 1.0,
    "Recovery Run": 0.7,
    "Run–Walk": 0.8,
    "Power Walk": 0.6,
    "Interval Walk": 0.7,
    "Long Walk": 0.8,
    "Incline Walk": 0.6,
    "Recovery Walk": 0.5,
    "Goal Practice Run": 1.4,
};

/**
 * Rounding and validation rules
 */
export const ROUNDING_RULES: RoundingRules = {
    precision: 0.1, // Round to 0.1 km
    remainderRule: "largest", // Add remainder to largest session
    minDistanceKm: 1.0,
    maxDistanceKm: 25.0,
};

/**
 * Warmup/cooldown defaults by run type
 */
export const WARMUP_COOLDOWN_DEFAULTS: Record<
    string,
    { warmupKm: number; cooldownKm: number }
> = {
    "Long Run": { warmupKm: 0.8, cooldownKm: 0.5 },
    "Tempo Run": { warmupKm: 0.8, cooldownKm: 0.5 },
    "Interval Run": { warmupKm: 0.6, cooldownKm: 0.6 },
    "Easy Run": { warmupKm: 0.5, cooldownKm: 0.3 },
    "Recovery Run": { warmupKm: 0.3, cooldownKm: 0.2 },
    default: { warmupKm: 0.5, cooldownKm: 0.3 },
};

/**
 * Effort pace multipliers relative to baseline
 */
export const PACE_MULTIPLIERS: Record<string, number> = {
    Easy: 1.15, // 15% slower than baseline
    Steady: 1.0, // Baseline pace
    Hard: 0.9, // 10% faster than baseline
};

/**
 * Interval run progression thresholds for beginners
 * Based on percentage of total plan weeks
 */
export const BEGINNER_INTERVAL_PROGRESSION = {
    timeBasedEnd: 0.33, // Weeks 1-33% stay distance-based for absolute beginners
};
