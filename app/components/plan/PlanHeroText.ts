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
  morning: "Start your day with today's run.",
  afternoon: "It's a good time to complete today's run.",
  evening: 'Complete your run before the day ends.',
  day: 'This is your running plan for the day.',
};

const EXERCISE_LINES: Record<HeroPeriod, string> = {
  morning: "Start your day with today's exercise.",
  afternoon: "It's a good time to complete your workout.",
  evening: 'Complete your exercise before the day ends.',
  day: 'This is your exercise plan for the day.',
};

const PARTNER_MOTIVATION = [
  'Complete one goal today and give your partner a reason to be proud.',
  'Your progress might inspire your partner to get moving too.',
  'Every goal you complete helps both of you build a healthier future.',
  'Show your partner what you can achieve when you stay consistent.',
  "Complete today's plan and celebrate another win with your partner.",
  'Your effort today could motivate your partner to take their next step.',
];

function getWeightLine(weightDeltaKg?: number | null): string {
  if (typeof weightDeltaKg !== 'number') return 'Log your weight to see how your progress changes over time.';
  if (weightDeltaKg > 0.2) return 'Your weight moved up a little. Stay focused and complete today’s goals.';
  if (weightDeltaKg < -0.2) return 'Your weight is moving down. Your hard work is starting to show.';
  return 'Your weight is steady. Keep following your plan and building healthy habits.';
}

export function getPlanHeroCopy(ctx: PlanHeroCopyContext): PlanHeroCopy {
  const dayTag = `DAY ${ctx.dayNumber}`;
  const runKm = ctx.runKm ?? 0;
  const stepRecoverySteps = ctx.nightWalkRecoverySteps ?? 0;
  const stepRecoveryKm = ctx.nightWalkRecoveryKm ?? 0;

  const weekLine = `You’re in Week ${ctx.currentWeek} of your plan. Let’s keep moving forward together.`;
  const motivationStart = (ctx.currentWeek + ctx.dayNumber - 2) % PARTNER_MOTIVATION.length;
  const motivationLines = [
    PARTNER_MOTIVATION[motivationStart],
    PARTNER_MOTIVATION[(motivationStart + 1) % PARTNER_MOTIVATION.length],
  ];
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

  const messageQueue = [mainMessage, weekLine, weightLine, ...motivationLines].filter(Boolean);

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
