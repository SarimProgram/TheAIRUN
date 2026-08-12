import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_CHECKPOINT_KEY = 'onboarding_checkpoint_v1';

export type OnboardingCheckpoint = {
  version: 1;
  completed: boolean;
  currentPhase: number;
  userName: string;
  userGender: string;
  availableDays: number[];
  userGoal: string | null;
  userAge: number | string;
  userWeight: number | string;
  userWeightUnit: string;
  userHeight: number | string;
  userHeightUnit: string;
  userTargetWeight: number | string;
  planData: Record<string, any>;
  generatedWeeklyPlan: any[];
  joinedWithCode: boolean;
  updatedAt: string;
};

type CheckpointListener = (checkpoint: OnboardingCheckpoint | null) => void;

const listeners = new Set<CheckpointListener>();
let writeQueue: Promise<void> = Promise.resolve();

function isCheckpoint(value: unknown): value is OnboardingCheckpoint {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<OnboardingCheckpoint>;
  return (
    candidate.version === 1 &&
    typeof candidate.completed === 'boolean' &&
    Number.isInteger(candidate.currentPhase) &&
    Number(candidate.currentPhase) >= 0
  );
}

function notify(checkpoint: OnboardingCheckpoint | null) {
  listeners.forEach((listener) => listener(checkpoint));
}

function enqueueWrite(operation: () => Promise<void>) {
  writeQueue = writeQueue.then(operation, operation);
  return writeQueue;
}

export function subscribeToOnboardingCheckpoint(listener: CheckpointListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function loadOnboardingCheckpoint(): Promise<OnboardingCheckpoint | null> {
  try {
    const raw = await AsyncStorage.getItem(ONBOARDING_CHECKPOINT_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return isCheckpoint(parsed) ? parsed : null;
  } catch (error) {
    console.warn('[Onboarding] Failed to load checkpoint:', error);
    return null;
  }
}

export function saveOnboardingProgress(
  checkpoint: Omit<OnboardingCheckpoint, 'version' | 'completed' | 'updatedAt'>
) {
  const next: OnboardingCheckpoint = {
    ...checkpoint,
    version: 1,
    completed: false,
    updatedAt: new Date().toISOString(),
  };

  notify(next);
  return enqueueWrite(async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_CHECKPOINT_KEY, JSON.stringify(next));
    } catch (error) {
      console.warn('[Onboarding] Failed to save checkpoint:', error);
    }
  });
}

export async function markOnboardingComplete() {
  await writeQueue;
  const existing = await loadOnboardingCheckpoint();
  const completed: OnboardingCheckpoint = {
    version: 1,
    completed: true,
    currentPhase: existing?.currentPhase ?? 0,
    userName: existing?.userName ?? '',
    userGender: existing?.userGender ?? '',
    availableDays: existing?.availableDays ?? [0, 2, 4],
    userGoal: existing?.userGoal ?? null,
    userAge: existing?.userAge ?? '',
    userWeight: existing?.userWeight ?? '',
    userWeightUnit: existing?.userWeightUnit ?? 'kg',
    userHeight: existing?.userHeight ?? '',
    userHeightUnit: existing?.userHeightUnit ?? 'cm',
    userTargetWeight: existing?.userTargetWeight ?? '',
    planData: existing?.planData ?? {},
    generatedWeeklyPlan: existing?.generatedWeeklyPlan ?? [],
    joinedWithCode: existing?.joinedWithCode ?? false,
    updatedAt: new Date().toISOString(),
  };

  notify(completed);
  await enqueueWrite(async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_CHECKPOINT_KEY, JSON.stringify(completed));
    } catch (error) {
      console.warn('[Onboarding] Failed to mark checkpoint complete:', error);
    }
  });
}

export function clearOnboardingCheckpoint() {
  notify(null);
  return enqueueWrite(async () => {
    try {
      await AsyncStorage.removeItem(ONBOARDING_CHECKPOINT_KEY);
    } catch (error) {
      console.warn('[Onboarding] Failed to clear checkpoint:', error);
    }
  });
}
