import { Crown, Droplet, Dumbbell, Flame, Gem, Trophy, type LucideIcon } from 'lucide-react-native';

export type WinMilestone = { wins: number; name: string; requirement: string; icon: LucideIcon; color: string; tint: string };

export const WIN_MILESTONES: WinMilestone[] = [
  { wins: 1, name: 'First Victory', requirement: 'Win your first challenge', icon: Trophy, color: '#D99A0B', tint: '#FFF3D1' },
  { wins: 5, name: 'Hot Streak', requirement: 'Win 5 challenges', icon: Flame, color: '#F0602B', tint: '#FFE5DA' },
  { wins: 10, name: 'Making Waves', requirement: 'Win 10 challenges', icon: Droplet, color: '#2F7BEA', tint: '#DDEBFF' },
  { wins: 20, name: 'Powerhouse', requirement: 'Win 20 challenges', icon: Dumbbell, color: '#7C4DEB', tint: '#ECE4FF' },
  { wins: 50, name: 'Legends', requirement: 'Win 50 challenges', icon: Crown, color: '#137E76', tint: '#DDF3EF' },
  { wins: 100, name: 'Hall of Fame', requirement: 'Win 100 challenges', icon: Gem, color: '#D74559', tint: '#FFE3E7' },
];

export type MedalId = 'gold' | 'rose' | 'silver' | 'bronze';

export type Medal = {
  id: MedalId;
  name: string;
  title: string;
  prize: string;
  metal: [string, string, string];
  edge: string;
  ribbon: [string, string];
  ink: string;
};

export const MEDALS: Medal[] = [
  {
    id: 'gold',
    name: 'Gold',
    title: 'Step Champions',
    prize: 'the Gold medal',
    metal: ['#FFE9A8', '#F2C14E', '#C98E1C'],
    edge: '#B57E14',
    ribbon: ['#137E76', '#0E5F59'],
    ink: '#7A5408',
  },
  {
    id: 'rose',
    name: 'Rose Gold',
    title: 'Power Couple',
    prize: 'the Rose Gold medal',
    metal: ['#FFE1DA', '#EDA99A', '#C7766A'],
    edge: '#B0645A',
    ribbon: ['#D74559', '#A93244'],
    ink: '#7C3A31',
  },
  {
    id: 'silver',
    name: 'Silver',
    title: 'Pacesetters',
    prize: 'the Silver medal',
    metal: ['#F7F9FA', '#CBD3D8', '#97A2AA'],
    edge: '#86919A',
    ribbon: ['#3E5C76', '#2C455B'],
    ink: '#46525B',
  },
  {
    id: 'bronze',
    name: 'Bronze',
    title: 'Trailblazers',
    prize: 'the Bronze medal',
    metal: ['#F6CFA8', '#D18E55', '#9C5C2A'],
    edge: '#8A4F22',
    ribbon: ['#6B7F3A', '#53652A'],
    ink: '#5E3615',
  },
];

export function medalForPrize(prize: string | null | undefined): Medal | null {
  const value = prize?.trim().toLowerCase();
  return MEDALS.find(medal => medal.prize.toLowerCase() === value) ?? null;
}
