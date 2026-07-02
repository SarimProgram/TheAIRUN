// Generator Registry
// Maps run types to their generator functions

import { RunGenerator } from "./types";

// Import all generators
import { easyRunGenerator } from "./runs/easyRun";
import { longRunGenerator } from "./runs/longRun";
import { tempoRunGenerator } from "./runs/tempoRun";
import { intervalRunGenerator } from "./runs/intervalRun";
import { recoveryRunGenerator } from "./runs/recoveryRun";
import { runWalkGenerator } from "./runs/runWalk";
import { intervalWalkGenerator } from "./runs/intervalWalk";
import { powerWalkGenerator, longWalkGenerator, inclineWalkGenerator, recoveryWalkGenerator } from "./runs/walks";
import { steadyRunGenerator, fartlekRunGenerator, hillRunGenerator, progressionRunGenerator, timeTrialGenerator } from "./runs/additional";
import { goalPracticeRunGenerator } from "./runs/goalPracticeRun";

/**
 * Generator registry - maps run type names to generator functions
 */
export const GENERATOR_REGISTRY: Record<string, RunGenerator> = {
    // Running types
    "Easy Run": easyRunGenerator,
    "Long Run": longRunGenerator,
    "Tempo Run": tempoRunGenerator,
    "Interval Run": intervalRunGenerator,
    "Recovery Run": recoveryRunGenerator,
    "Run–Walk": runWalkGenerator,
    "Run-Walk": runWalkGenerator, // Handle both dash variants
    "Steady Run": steadyRunGenerator,
    "Fartlek Run": fartlekRunGenerator,
    "Hill Run": hillRunGenerator,
    "Progression Run": progressionRunGenerator,
    "Time Trial": timeTrialGenerator,
    "Goal Practice Run": goalPracticeRunGenerator,

    // Walking types
    "Power Walk": powerWalkGenerator,
    "Interval Walk": intervalWalkGenerator,
    "Long Walk": longWalkGenerator,
    "Incline Walk": inclineWalkGenerator,
    "Recovery Walk": recoveryWalkGenerator,
};

/**
 * Get generator for a run type, with fallback to Easy Run
 */
export function getGenerator(runType: string): RunGenerator {
    // Normalize the run type (handle dash variants)
    const normalized = runType.replace(/-/g, "–");
    return GENERATOR_REGISTRY[normalized] || GENERATOR_REGISTRY[runType] || easyRunGenerator;
}
