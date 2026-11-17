export type PartnerSquatMode = 'warmup' | 'squat' | 'cooldown';

export const PARTNER_SQUAT_FRAME_LABELS = [
  'March with the left knee lifted', 'March with the right knee lifted',
  'Open arms to shoulder height', 'Reach arms overhead',
  'Stand ready and hold hands', 'Begin lowering together',
  'Lower halfway', 'Reach a comfortable squat',
  'Hold briefly at the bottom', 'Rise halfway together',
  'Keep rising with control', 'Stand tall together',
  'Walk slowly, left foot forward', 'Walk slowly, right foot forward',
  'Gently stretch across the chest', 'Relax and breathe slowly',
] as const;

/** A four-second demonstration rep matches 15 reps in each one-minute set. */
export function getPartnerSquatMotion(mode: PartnerSquatMode, elapsedMs: number, reducedMotion = false) {
  const elapsed = Math.max(0, elapsedMs);
  if (mode === 'warmup') {
    const reaching = elapsed >= 60_000;
    return { frame: reducedMotion ? (reaching ? 2 : 0) : reaching ? 2 + Math.floor((elapsed - 60_000) / 1200) % 2 : Math.floor(elapsed / 600) % 2,
      cue: reaching ? 'Open your arms, then reach overhead' : 'March gently in place', rep: null };
  }
  if (mode === 'cooldown') {
    const frame = elapsed < 30_000 ? (reducedMotion ? 12 : 12 + Math.floor(elapsed / 800) % 2) : elapsed < 45_000 ? 14 : 15;
    return { frame, cue: elapsed < 30_000 ? 'Walk slowly and relax your arms' : elapsed < 45_000 ? 'Stretch gently; switch arms halfway' : 'Rest your hands on your ribs and breathe slowly', rep: null };
  }
  const stage = Math.floor((elapsed % 4000) / 500);
  return { frame: reducedMotion ? 7 : 4 + stage,
    cue: stage === 0 || stage === 7 ? 'Stand tall' : stage < 4 ? 'Lower together' : stage === 4 ? 'Hold with control' : 'Rise together',
    rep: Math.min(15, Math.floor(elapsed / 4000) + 1) };
}
