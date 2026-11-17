import { findPartnerWorkout } from './partnerWorkoutDefinitions';
import { getPartnerSquatMotion, type PartnerSquatMode } from './partnerSquatMotion';

export function getPartnerWorkoutMotion(id: string, mode: PartnerSquatMode, elapsedMs: number, reducedMotion = false) {
  if (mode !== 'squat') return { ...getPartnerSquatMotion(mode, elapsedMs, reducedMotion), sourceId: 'partner-squats', total: null, unit: null };
  const definition = findPartnerWorkout(id);
  if (!definition || id === 'partner-squats') return { ...getPartnerSquatMotion('squat', elapsedMs, reducedMotion), sourceId: 'partner-squats', total: 15, unit: 'Rep' };
  const elapsed = Math.max(0, elapsedMs);
  const holding = id === 'wall-sit-challenge';
  const frame = reducedMotion ? (holding ? 4 : 3) : holding
    ? elapsed < 3000 ? Math.floor(elapsed / 750) : 4 + Math.floor((elapsed - 3000) / 2000) % 4
    : Math.floor((elapsed % definition.cycleMs) / (definition.cycleMs / 8));
  const rep = definition.count == null ? null : Math.min(definition.count, Math.floor(elapsed / (definition.seconds * 1000 / definition.count)) + 1);
  const cue = id === 'synchronized-lunges' && rep != null
    ? `${rep % 2 === 1 ? 'Left' : 'Right'} leg · ${Math.ceil(rep / 2)} of 10 · ${definition.poses[frame]}`
    : definition.poses[frame];
  return { frame, sourceId: id, cue, rep, total: definition.count, unit: definition.countUnit };
}
