export type OnboardingAnalyticsStep = {
  screenName: string;
  stepKey: string;
  stepOrder: number;
};

const ONBOARDING_PHASE_ANALYTICS: Record<number, OnboardingAnalyticsStep> = {
  0: { screenName: 'Onboarding - Welcome', stepKey: 'welcome', stepOrder: 1 },
  25: { screenName: 'Onboarding - Proof Chart', stepKey: 'proof_chart', stepOrder: 2 },
  3: { screenName: 'Onboarding - Goals', stepKey: 'goals', stepOrder: 3 },
  4: { screenName: 'Onboarding - Profile', stepKey: 'profile', stepOrder: 4 },
  23: { screenName: 'Onboarding - Partner Code', stepKey: 'partner_code', stepOrder: 5 },
  5: { screenName: 'Onboarding - Primary Goal', stepKey: 'primary_goal', stepOrder: 6 },
  6: { screenName: 'Onboarding - Age', stepKey: 'age', stepOrder: 7 },
  7: { screenName: 'Onboarding - Weight & Height', stepKey: 'weight_height', stepOrder: 8 },
  8: { screenName: 'Onboarding - Target Weight', stepKey: 'target_weight', stepOrder: 9 },
  26: { screenName: 'Onboarding - Weight Habit Plan', stepKey: 'weight_habit_plan', stepOrder: 10 },
  2: { screenName: 'Onboarding - Health Consent', stepKey: 'health_consent', stepOrder: 11 },
  19: { screenName: 'Onboarding - Weight Branch', stepKey: 'weight_branch', stepOrder: 12 },
  20: { screenName: 'Onboarding - Running Branch', stepKey: 'running_branch', stepOrder: 13 },
  21: { screenName: 'Onboarding - Running Habits', stepKey: 'running_habits', stepOrder: 14 },
  9: { screenName: 'Onboarding - Starting Point', stepKey: 'starting_point', stepOrder: 15 },
  12: { screenName: 'Onboarding - Available Days', stepKey: 'available_days', stepOrder: 16 },
  14: { screenName: 'Onboarding - Preferred Time', stepKey: 'preferred_time', stepOrder: 17 },
  15: { screenName: 'Onboarding - Marketplace', stepKey: 'marketplace', stepOrder: 18 },
  17: { screenName: 'Onboarding - Rewards', stepKey: 'rewards', stepOrder: 19 },
  18: { screenName: 'Onboarding - Penalty', stepKey: 'penalty', stepOrder: 20 },
  11: { screenName: 'Onboarding - Plan Setup', stepKey: 'plan_setup', stepOrder: 21 },
  10: { screenName: 'Onboarding - Plan Timeline', stepKey: 'plan_timeline', stepOrder: 22 },
  1: { screenName: 'Onboarding - Auth', stepKey: 'auth', stepOrder: 90 },
  22: { screenName: 'Onboarding - Manual Sign Up', stepKey: 'manual_signup', stepOrder: 91 },
  24: { screenName: 'Onboarding - Manual Login', stepKey: 'manual_login', stepOrder: 92 },
};

export function resolveOnboardingAnalytics(
  phase: number,
  planDevView?: 'setup' | 'summary' | null,
): OnboardingAnalyticsStep {
  if (phase === 11 && planDevView === 'summary') {
    return {
      screenName: 'Onboarding - Plan Summary',
      stepKey: 'plan_summary',
      stepOrder: 21,
    };
  }

  const mapped = ONBOARDING_PHASE_ANALYTICS[phase];
  if (mapped) return mapped;

  return {
    screenName: `Onboarding - Step ${phase}`,
    stepKey: `step_${phase}`,
    stepOrder: phase,
  };
}
