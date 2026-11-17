import { useColorScheme } from 'react-native';
import { Easing } from 'react-native-reanimated';

/** Activity's cool slate neutrals, coral accent, and the "you teal / partner coral" pairing. */
const LIGHT = {
  surface: '#F8FAFC', card: '#FFFFFF', ink: '#1F2937', muted: '#6B7280', faint: '#9CA3AF', line: '#E5E7EB', soft: '#F1F5F9',
  accent: '#FF6B6B', accentSoft: '#FFF1F2', accentBorder: '#FFE4E6', onAccent: '#FFFFFF',
  you: '#1F938A', youSoft: '#E6F4F2', partner: '#FF6B6B', partnerSoft: '#FFF1F2',
  protein: '#14B8A6', carbs: '#F59E0B', fat: '#F97316', success: '#10B981', scrim: 'rgba(2,6,23,0.45)',
  stage: '#0B1120', handle: '#CBD5E1',
  cardShadow: '0 4px 14px rgba(15, 23, 42, 0.06)', liftShadow: '0 12px 28px rgba(15, 23, 42, 0.14)',
  accentShadow: '0 8px 20px rgba(255, 107, 107, 0.35)',
  bevelLight: 'rgba(255, 255, 255, 0.95)', bevelShade: 'rgba(15, 23, 42, 0.08)',
};
const DARK: typeof LIGHT = {
  surface: '#0F172A', card: '#1E293B', ink: '#F1F5F9', muted: '#94A3B8', faint: '#64748B', line: '#334155', soft: '#273449',
  accent: '#FF6B6B', accentSoft: '#3B1F27', accentBorder: '#5B2A33', onAccent: '#FFFFFF',
  you: '#3FB8AD', youSoft: '#173A3A', partner: '#FF8585', partnerSoft: '#3B1F27',
  protein: '#2DD4BF', carbs: '#FBBF24', fat: '#FB923C', success: '#34D399', scrim: 'rgba(0,0,0,0.6)',
  stage: '#020617', handle: '#475569',
  cardShadow: '0 4px 14px rgba(0, 0, 0, 0.28)', liftShadow: '0 12px 28px rgba(0, 0, 0, 0.4)',
  accentShadow: '0 8px 20px rgba(255, 107, 107, 0.28)',
  bevelLight: 'rgba(255, 255, 255, 0.1)', bevelShade: 'rgba(0, 0, 0, 0.35)',
};
export type PassColors = typeof LIGHT;

export function usePassColors(): PassColors {
  return useColorScheme() === 'dark' ? DARK : LIGHT;
}

/** Settles with no overshoot; finger-driven releases pass their velocity in. */
export const SNAP = { duration: 400, dampingRatio: 1 };
/** One soft overshoot, kept for arrivals and the catch. */
export const POP = { duration: 520, dampingRatio: 0.62 };
export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
