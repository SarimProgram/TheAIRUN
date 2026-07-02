export type HeroPeriod = 'morning' | 'afternoon' | 'evening' | 'day';
export type HeroDayType = 'RUN' | 'STEP' | 'RECOVERY';
export type HeroRunStatus = 'NOT_SCHEDULED' | 'PENDING' | 'ATTEMPTED' | 'COMPLETED' | 'MISSED' | string;

export type PlanHeroCopyContext = {
  currentWeek: number;
  dayNumber: number;
  period: HeroPeriod;
  isToday: boolean;
  dayType: HeroDayType;
  isRunDay: boolean;
  runStatus?: HeroRunStatus;
  runKm?: number;
  showStepRecoveryPrompt: boolean;
  nightWalkRecoverySteps?: number;
  nightWalkRecoveryKm?: number;
  weightDeltaKg?: number | null;
};

export type PlanHeroCopy = {
  dayTag: string;
  mainMessage: string;
  messageQueue: string[];
  mainCtaLabel: string;
  recoveryLabel: string;
  recoveryMessage: string;
  recoveryButtonLabel: string;
  missedRunModalTitle: string;
  missedRunModalSubtitle: string;
  missedRunPrimaryTitle: string;
  missedRunPrimarySubtitle: string;
  missedRunSecondaryTitle: string;
  missedRunSecondarySubtitle: string;
  missedRunSkipLabel: string;
};

const PERIOD_LABEL: Record<HeroPeriod, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  day: 'Today',
};

const RUN_LINES: Record<HeroPeriod, string> = {
  morning: 'Run day is live.\nSet the pace early and own the day.',
  afternoon: 'Run day check-in.\nA steady effort now keeps momentum high.',
  evening: 'Run day finish.\nLock in the distance before the day closes.',
  day: 'Run day is on.\nShow up and keep the streak moving.',
};

const EXERCISE_LINES: Record<HeroPeriod, string> = {
  morning: 'Performance day starts now.\nBuild control and strength this morning.',
  afternoon: 'Performance day is active.\nKeep form clean through this block.',
  evening: 'Performance day closeout.\nFinish with quality movement and recovery.',
  day: 'Performance day.\nKeep your muscles sharp and consistent.',
};

const GENERAL_MOTIVATION = [
  'One focused session today beats a perfect plan tomorrow.',
  'Discipline today compounds into easier weeks ahead.',
  'Small wins today become visible results this week.',
];

function getWeightLine(weightDeltaKg?: number | null): string {
  if (typeof weightDeltaKg !== 'number') return '';
  if (weightDeltaKg > 0.2) return `Weight trend is up ${weightDeltaKg.toFixed(1)} kg, tighten execution today.`;
  if (weightDeltaKg < -0.2) return `Weight trend is down ${Math.abs(weightDeltaKg).toFixed(1)} kg, stay consistent.`;
  return 'Weight trend is stable, keep stacking clean days.';
}

export function getPlanHeroCopy(ctx: PlanHeroCopyContext): PlanHeroCopy {
  const dayTag = `DAY ${ctx.dayNumber}`;
  const runKm = ctx.runKm ?? 0;
  const stepRecoverySteps = ctx.nightWalkRecoverySteps ?? 0;
  const stepRecoveryKm = ctx.nightWalkRecoveryKm ?? 0;

  const weekLine = `Week ${ctx.currentWeek} focus.`;
  const motivation = GENERAL_MOTIVATION[(ctx.currentWeek - 1) % GENERAL_MOTIVATION.length];
  const weightLine = getWeightLine(ctx.weightDeltaKg);

  let mainMessage: string;

  if (ctx.showStepRecoveryPrompt) {
    mainMessage = `Evening recovery mode.\nMissed earlier step targets: ${stepRecoverySteps.toLocaleString()} steps remaining.`;
  } else if (ctx.runStatus === 'MISSED') {
    mainMessage = `${PERIOD_LABEL[ctx.period]} reset.\nYou missed a ${runKm.toFixed(1)} km run, recover it today.`;
  } else if (ctx.isRunDay) {
    mainMessage = RUN_LINES[ctx.period];
  } else if (ctx.dayType === 'RECOVERY' || ctx.dayType === 'STEP') {
    mainMessage = EXERCISE_LINES[ctx.period];
  } else {
    mainMessage = 'Stay on schedule.\nHit the core targets for this day.';
  }

  const contextLine = [weekLine, weightLine].filter(Boolean).join(' ');
  const messageQueue = [mainMessage, contextLine, motivation].filter(Boolean);

  return {
    dayTag,
    mainMessage,
    messageQueue,
    mainCtaLabel: ctx.isRunDay ? `Start ${runKm > 0 ? `${runKm.toFixed(1)}km ` : ''}Run` : 'Start Session',
    recoveryLabel: 'STEP RECOVERY',
    recoveryMessage: `Morning or afternoon targets were missed. Convert ${stepRecoverySteps.toLocaleString()} steps into ${stepRecoveryKm.toFixed(1)} km and finish on plan.`,
    recoveryButtonLabel: 'Convert Steps',
    missedRunModalTitle: 'Missed Run',
    missedRunModalSubtitle: `You missed a ${runKm.toFixed(1)} km run on this day.\nWhat would you like to do?`,
    missedRunPrimaryTitle: 'Run It Now',
    missedRunPrimarySubtitle: `Complete the ${runKm.toFixed(1)} km run today`,
    missedRunSecondaryTitle: 'Move to Free Day',
    missedRunSecondarySubtitle: 'Reschedule to the next available rest day',
    missedRunSkipLabel: 'Skip for now',
  };
}
