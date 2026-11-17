import { Footprints, MapPin, Route, type LucideIcon } from 'lucide-react-native';

export type Competition = {
  id: 'virtual' | 'steps';
  title: string;
  shortTitle: string;
  tag: string;
  description: string;
  icon: LucideIcon;
  matchup: '1v1' | '2v2';
  range: { icon: LucideIcon; label: string };
  format: string;
  tint: [string, string];
  available: boolean;
  route?: '/race/virtual' | '/race/couple-steps';
};

export const COMPETITIONS: Competition[] = [
  {
    id: 'virtual',
    title: 'Virtual Race',
    shortTitle: 'Virtual Race',
    tag: 'Race',
    description: 'Run from anywhere and race your partner live on your phone.',
    icon: Route,
    matchup: '1v1',
    range: { icon: MapPin, label: '1 – 25 km' },
    format: 'You vs partner',
    tint: ['#DFF6F3', '#C9EEE9'],
    available: true,
    route: '/race/virtual',
  },
  {
    id: 'steps',
    title: 'Couple vs Couple Step Challenge',
    shortTitle: 'Couple Challenge',
    tag: 'Couple vs Couple',
    description: 'Team up with your partner and out-step another couple.',
    icon: Footprints,
    matchup: '2v2',
    range: { icon: Footprints, label: '10k – 100k steps' },
    format: 'Couple vs couple',
    tint: ['#FFF1DC', '#FFE4BD'],
    available: true,
    route: '/race/couple-steps',
  },
];
