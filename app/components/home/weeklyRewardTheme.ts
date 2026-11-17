export const TEAL = '#2BBFC4';
export const CORAL = '#F4656F';

export function weeklyRewardColors(dark: boolean) {
  return dark
    ? { surface: '#1F2937', ink: '#F8FAFC', muted: '#CBD5E1', coralSoft: '#492D35', tealSoft: '#193E43', teal: '#78D9DC', coral: '#FFA4AA', track: '#374151', border: '#374151', tealRing: 'rgba(120,217,220,0.22)', coralRing: 'rgba(255,164,170,0.22)', wave: ['#45303A', '#4F3440'], hero: ['#3A2A33', '#2E2631', '#242530'] as const }
    : { surface: '#FFFFFF', ink: '#1E1F2A', muted: '#6B7280', coralSoft: '#FFE3E4', tealSoft: '#D3F3F3', teal: '#0E8A90', coral: '#D9434D', track: '#F1F2F5', border: '#E8EBEF', tealRing: 'rgba(43,191,196,0.18)', coralRing: 'rgba(244,101,111,0.16)', wave: ['#FCDCDA', '#F9CBC9'], hero: ['#FFF6F4', '#FFFBFC', '#F8FAFC'] as const };
}

export type WeeklyRewardColors = ReturnType<typeof weeklyRewardColors>;
