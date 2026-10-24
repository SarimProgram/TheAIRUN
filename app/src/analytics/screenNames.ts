const SCREEN_NAME_OVERRIDES: Record<string, string> = {
  '/': 'Home',
  '/(tabs)': 'Home',
  '/(tabs)/index': 'Home',
  '/(tabs)/Partner': 'Partner',
  '/Partner': 'Partner',
  '/(tabs)/Plans': 'Plans',
  '/(tabs)/Run': 'Run',
  '/(tabs)/Race': 'Race',
  '/(tabs)/Login': 'Login',
  '/(tabs)/Onboarding': 'Onboarding',
  '/Onboarding': 'Onboarding',
  '/(tabs)/activity': 'Activity',
  '/(tabs)/explore': 'Explore',
  '/(tabs)/marketplace': 'Marketplace',
  '/(tabs)/quest': 'Quests',
  '/(tabs)/PlanMaker': 'Plan Maker',
  '/paywall': 'Paywall',
  '/welcome': 'Welcome',
  '/chat-fullscreen': 'Chat',
  '/kcal-detail': 'Kcal Detail',
  '/partner-settings': 'Partner Settings',
  '/partner-timeline': 'Partner Timeline',
  '/partner-reminder': 'Partner Reminder',
  '/partner-wrap': 'Partner Wrap',
  '/pace-personalisation': 'Pace Personalisation',
  '/remaining-steps': 'Remaining Steps',
  '/runs/allruns': 'All Runs',
  '/runs/easyrun': 'Easy Run',
  '/runs/history': 'Run History',
  '/runs/interval-run': 'Interval Run',
  '/runs/interval-walk': 'Interval Walk',
  '/runs/run-details': 'Run Details',
  '/runs/runscreen': 'Active Run',
  '/race/history': 'Race History',
  '/modal': 'Modal',
};

function titleCaseSegment(segment: string): string {
  return segment
    .replace(/-/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function resolveAnalyticsScreenName(pathname: string): string {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';
  const override = SCREEN_NAME_OVERRIDES[normalizedPath];
  if (override) return override;

  const stripped = normalizedPath
    .replace(/^\/?\(tabs\)\/?/, '')
    .replace(/^\//, '');

  if (!stripped || stripped === 'index') return 'Home';

  return stripped
    .split('/')
    .filter(Boolean)
    .map(titleCaseSegment)
    .join(' - ');
}
