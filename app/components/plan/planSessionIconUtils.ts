export type SessionActivityKind = 'run' | 'walk' | 'recovery';

export function getSessionActivityKind(
  runType: string | null | undefined,
  sessionType?: 'RUN' | 'RECOVERY' | 'STEP',
): SessionActivityKind {
  if (sessionType === 'RECOVERY') return 'recovery';
  const normalized = (runType ?? '').toLowerCase();
  if (normalized.includes('walk')) return 'walk';
  return 'run';
}
