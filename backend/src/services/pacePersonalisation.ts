export type PaceMode = 'RUNNING' | 'WALKING';
export type PaceStatus = 'STARTING' | 'LEARNING' | 'PERSONALISED';
export type PerceivedEffort = 'TOO_EASY' | 'ABOUT_RIGHT' | 'TOO_HARD';
export type PaceWorkoutKind =
  | 'EASY_RUN'
  | 'LONG_RUN'
  | 'GOAL_PRACTICE'
  | 'BRISK_WALK'
  | 'POWER_WALK'
  | 'LONG_WALK';

type WorkoutLike = {
  id?: string;
  type: string;
  title?: string | null;
  source?: string | null;
  distanceKm: number;
  durationMinutes: number;
  avgPaceSecPerKm?: number | null;
  endedAt?: Date | string | null;
  perceivedEffort?: PerceivedEffort | null;
};

const DEFAULT_RUNNING_PACE = 540;
export const DEFAULT_WALKING_PACE = 810;
const MIN_SAMPLES = 3;
const OUTLIER_LIMIT = 0.2;

const RANGE_FACTORS: Record<PaceWorkoutKind, [number, number]> = {
  EASY_RUN: [0.97, 1.05],
  LONG_RUN: [1, 1.1],
  GOAL_PRACTICE: [0.95, 1.02],
  BRISK_WALK: [1.08, 1.18],
  POWER_WALK: [0.96, 1.04],
  LONG_WALK: [1.04, 1.12],
};

const BASELINE_FACTORS: Record<PaceWorkoutKind, number> = {
  EASY_RUN: 1,
  LONG_RUN: 1.05,
  GOAL_PRACTICE: 1,
  BRISK_WALK: 1.12,
  POWER_WALK: 1,
  LONG_WALK: 1.08,
};

export function getWorkoutKind(workout: Pick<WorkoutLike, 'type' | 'title'>): PaceWorkoutKind | null {
  const title = (workout.title ?? '').trim().toLowerCase();
  if (workout.type === 'RUN' && title.includes('easy run')) return 'EASY_RUN';
  if (workout.type === 'RUN' && title.includes('long run')) return 'LONG_RUN';
  if (workout.type === 'RUN' && title.includes('goal practice')) return 'GOAL_PRACTICE';
  if (workout.type === 'WALK' && title.includes('interval walk')) return null;
  if (workout.type === 'WALK' && title.includes('easy run')) return null;
  if (workout.type === 'WALK' && title.includes('long walk')) return 'LONG_WALK';
  if (workout.type === 'WALK' && title.includes('power walk')) return 'POWER_WALK';
  if (workout.type === 'WALK') return 'BRISK_WALK';
  return null;
}

export function getModeForKind(kind: PaceWorkoutKind): PaceMode {
  return kind === 'EASY_RUN' || kind === 'LONG_RUN' || kind === 'GOAL_PRACTICE'
    ? 'RUNNING'
    : 'WALKING';
}

export function calculateTargetRanges(runningBaseline: number, walkingBaseline: number) {
  const range = (baseline: number, kind: PaceWorkoutKind) => ({
    minPaceSecPerKm: Math.round(baseline * RANGE_FACTORS[kind][0]),
    maxPaceSecPerKm: Math.round(baseline * RANGE_FACTORS[kind][1]),
  });
  return {
    EASY_RUN: range(runningBaseline, 'EASY_RUN'),
    LONG_RUN: range(runningBaseline, 'LONG_RUN'),
    GOAL_PRACTICE: range(runningBaseline, 'GOAL_PRACTICE'),
    BRISK_WALK: range(walkingBaseline, 'BRISK_WALK'),
    POWER_WALK: range(walkingBaseline, 'POWER_WALK'),
    LONG_WALK: range(walkingBaseline, 'LONG_WALK'),
  };
}

export function assessPaceWorkout(workout: WorkoutLike, baseline: number, isPersonalised = false) {
  const kind = getWorkoutKind(workout);
  if (!kind || !workout.endedAt) return { accepted: false as const };
  if (!['APP_TRACKED', 'APPLE_HEALTH', 'GOOGLE_FIT'].includes(workout.source ?? '')) {
    return { accepted: false as const };
  }
  const pace = workout.avgPaceSecPerKm;
  if (!pace || workout.distanceKm < 1 || workout.distanceKm > 100 || workout.durationMinutes < 10 || workout.durationMinutes > 360) {
    return { accepted: false as const };
  }
  const mode = getModeForKind(kind);
  if ((mode === 'RUNNING' && (pace < 180 || pace > 900)) || (mode === 'WALKING' && (pace < 420 || pace > 1500))) {
    return { accepted: false as const };
  }
  const measuredPace = workout.durationMinutes * 60 / workout.distanceKm;
  if (Math.abs(measuredPace - pace) / pace > 0.25) return { accepted: false as const };

  const effortFactor = workout.perceivedEffort === 'TOO_EASY'
    ? 0.98
    : workout.perceivedEffort === 'TOO_HARD'
      ? 1.02
      : 1;
  const observedBaseline = Math.round((pace / BASELINE_FACTORS[kind]) * effortFactor);
  const outlierLimit = isPersonalised ? OUTLIER_LIMIT : 0.6;
  if (Math.abs(observedBaseline - baseline) / baseline > outlierLimit) return { accepted: false as const };
  return { accepted: true as const, kind, mode, observedBaseline };
}

export function statusForSamples(sampleCount: number): PaceStatus {
  if (sampleCount <= 0) return 'STARTING';
  return sampleCount < MIN_SAMPLES ? 'LEARNING' : 'PERSONALISED';
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
    : sorted[middle];
}

export function nextPersonalisedBaseline(
  current: number,
  observed: number[],
  wasPersonalised: boolean,
): number {
  if (observed.length === 0) return current;
  const target = median(observed);
  const blended = wasPersonalised ? Math.round(current * 0.8 + target * 0.2) : target;
  const cap = 0.03;
  return Math.round(Math.max(current * (1 - cap), Math.min(current * (1 + cap), blended)));
}

export function buildPaceUpdate(
  mode: PaceMode,
  previousBaseline: number,
  baseline: number,
  status: PaceStatus,
  sampleCount: number,
) {
  const changed = baseline !== previousBaseline;
  return {
    mode,
    ...(changed ? { previousBaselinePaceSecPerKm: previousBaseline } : {}),
    baselinePaceSecPerKm: baseline,
    status,
    sampleCount,
    changed,
  };
}

function modeFields(mode: PaceMode) {
  return mode === 'RUNNING'
    ? {
        baseline: 'runningBaselinePaceSecPerKm', starting: 'runningStartingPaceSecPerKm',
        previous: 'runningPreviousBaselinePaceSecPerKm', samples: 'runningSampleCount',
        status: 'runningStatus', updated: 'runningUpdatedAt',
      }
    : {
        baseline: 'walkingBaselinePaceSecPerKm', starting: 'walkingStartingPaceSecPerKm',
        previous: 'walkingPreviousBaselinePaceSecPerKm', samples: 'walkingSampleCount',
        status: 'walkingStatus', updated: 'walkingUpdatedAt',
      };
}

export async function ensurePaceProfile(db: any, userId: string) {
  const existing = await db.paceProfile.findUnique({ where: { userId } });
  if (existing) return existing;
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { baselinePaceSecPerKm: true },
  });
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  const running = user.baselinePaceSecPerKm ?? DEFAULT_RUNNING_PACE;
  const walking = DEFAULT_WALKING_PACE;
  return db.paceProfile.create({
    data: {
      userId,
      runningBaselinePaceSecPerKm: running,
      runningStartingPaceSecPerKm: running,
      walkingBaselinePaceSecPerKm: walking,
      walkingStartingPaceSecPerKm: walking,
    },
  });
}

export function presentPaceProfile(profile: any) {
  const targetRanges = calculateTargetRanges(
    profile.runningBaselinePaceSecPerKm,
    profile.walkingBaselinePaceSecPerKm,
  );
  const mode = (prefix: 'running' | 'walking') => ({
    baselinePaceSecPerKm: profile[`${prefix}BaselinePaceSecPerKm`],
    status: profile[`${prefix}Status`],
    sampleCount: profile[`${prefix}SampleCount`],
    updatedAt: profile[`${prefix}UpdatedAt`],
    previousBaselinePaceSecPerKm: profile[`${prefix}PreviousBaselinePaceSecPerKm`],
    targetRanges,
  });
  return { running: mode('running'), walking: mode('walking'), autoAdjust: profile.autoAdjust };
}

export async function applyWorkoutPaceSample(db: any, userId: string, workout: WorkoutLike & { id: string }) {
  const profile = await ensurePaceProfile(db, userId);
  const kind = getWorkoutKind(workout);
  const tentativeMode = kind ? getModeForKind(kind) : null;
  const baseline = tentativeMode === 'WALKING'
    ? profile.walkingBaselinePaceSecPerKm
    : profile.runningBaselinePaceSecPerKm;
  const assessment = assessPaceWorkout(workout, baseline, profile[modeFields(tentativeMode ?? 'RUNNING').status] === 'PERSONALISED');
  if (!assessment.accepted) return undefined;

  await db.workoutSession.update({
    where: { id: workout.id },
    data: { paceSampleAccepted: true, paceSampleMode: assessment.mode },
  });
  const fields = modeFields(assessment.mode);
  const nextCount = profile[fields.samples] + 1;
  const nextStatus = statusForSamples(nextCount);
  let nextBaseline = baseline;
  if (nextCount >= MIN_SAMPLES && profile.autoAdjust) {
    const recent = await db.workoutSession.findMany({
      where: { userId, paceSampleMode: assessment.mode, paceSampleAccepted: true },
      orderBy: { startedAt: 'desc' },
      take: profile[fields.status] === 'PERSONALISED' ? 5 : 3,
    });
    const observed = recent
      .map((item: WorkoutLike) => assessPaceWorkout(item, baseline, profile[fields.status] === 'PERSONALISED'))
      .filter((item: any) => item.accepted)
      .map((item: any) => item.observedBaseline);
    nextBaseline = nextPersonalisedBaseline(baseline, observed, profile[fields.status] === 'PERSONALISED');
  }

  const changed = nextBaseline !== baseline;
  const data: Record<string, unknown> = {
    [fields.samples]: nextCount,
    [fields.status]: nextStatus,
    [fields.updated]: new Date(),
  };
  if (changed) {
    data[fields.previous] = baseline;
    data[fields.baseline] = nextBaseline;
    data.lastAdjustedMode = assessment.mode;
  }
  await db.paceProfile.update({ where: { userId }, data });
  if (changed && assessment.mode === 'RUNNING') {
    await db.user.update({ where: { id: userId }, data: { baselinePaceSecPerKm: nextBaseline } });
  }
  return buildPaceUpdate(assessment.mode, baseline, nextBaseline, nextStatus, nextCount);
}

export async function recalculatePaces(db: any, userId: string) {
  const profile = await ensurePaceProfile(db, userId);
  const workouts = await db.workoutSession.findMany({
    where: { userId },
    orderBy: { startedAt: 'desc' },
    take: 50,
  });
  const data: Record<string, unknown> = {};
  let lastAdjustedMode: PaceMode | null = null;
  for (const mode of ['RUNNING', 'WALKING'] as const) {
    const fields = modeFields(mode);
    const baseline = profile[fields.baseline];
    const accepted = workouts
      .map((workout: WorkoutLike) => ({
        workout,
        assessment: assessPaceWorkout(workout, baseline, profile[fields.status] === 'PERSONALISED'),
      }))
      .filter((entry: any) => entry.assessment.accepted && entry.assessment.mode === mode)
      .slice(0, 8);
    const count = accepted.length;
    const nextStatus = statusForSamples(count);
    const nextBaseline = count >= MIN_SAMPLES
      ? nextPersonalisedBaseline(baseline, accepted.map((entry: any) => entry.assessment.observedBaseline), false)
      : baseline;
    data[fields.samples] = count;
    data[fields.status] = nextStatus;
    data[fields.updated] = new Date();
    if (nextBaseline !== baseline) {
      data[fields.previous] = baseline;
      data[fields.baseline] = nextBaseline;
      lastAdjustedMode = mode;
    }
    if (accepted.length) {
      await db.workoutSession.updateMany({
        where: { id: { in: accepted.map((entry: any) => entry.workout.id) }, userId },
        data: { paceSampleAccepted: true, paceSampleMode: mode },
      });
    }
  }
  if (lastAdjustedMode) data.lastAdjustedMode = lastAdjustedMode;
  const updated = await db.paceProfile.update({ where: { userId }, data });
  await db.user.update({ where: { id: userId }, data: { baselinePaceSecPerKm: updated.runningBaselinePaceSecPerKm } });
  return updated;
}

export async function resetPaces(db: any, userId: string) {
  const profile = await ensurePaceProfile(db, userId);
  const updated = await db.paceProfile.update({
    where: { userId },
    data: {
      runningBaselinePaceSecPerKm: profile.runningStartingPaceSecPerKm,
      runningPreviousBaselinePaceSecPerKm: profile.runningBaselinePaceSecPerKm,
      runningSampleCount: 0,
      runningStatus: 'STARTING',
      runningUpdatedAt: new Date(),
      walkingBaselinePaceSecPerKm: profile.walkingStartingPaceSecPerKm,
      walkingPreviousBaselinePaceSecPerKm: profile.walkingBaselinePaceSecPerKm,
      walkingSampleCount: 0,
      walkingStatus: 'STARTING',
      walkingUpdatedAt: new Date(),
      lastAdjustedMode: null,
    },
  });
  await db.workoutSession.updateMany({
    where: { userId, paceSampleAccepted: true },
    data: { paceSampleAccepted: false, paceSampleMode: null },
  });
  await db.user.update({
    where: { id: userId },
    data: { baselinePaceSecPerKm: updated.runningBaselinePaceSecPerKm },
  });
  return updated;
}

export async function undoLastPaceChange(db: any, userId: string, requestedMode?: PaceMode) {
  const profile = await ensurePaceProfile(db, userId);
  const mode = requestedMode ?? profile.lastAdjustedMode;
  if (!mode) return profile;
  const fields = modeFields(mode);
  const previous = profile[fields.previous];
  if (!previous) return profile;
  const updated = await db.paceProfile.update({
    where: { userId },
    data: {
      [fields.baseline]: previous,
      [fields.previous]: null,
      [fields.updated]: new Date(),
      lastAdjustedMode: null,
    },
  });
  if (mode === 'RUNNING') {
    await db.user.update({ where: { id: userId }, data: { baselinePaceSecPerKm: previous } });
  }
  return updated;
}
