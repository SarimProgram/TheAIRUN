import React, { useId } from 'react';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Stop } from 'react-native-svg';
import type { Medal } from '@/constants/coupleMedals';

const LOCKED = {
  metal: ['#EEF0EE', '#D9DDD9', '#BFC5C0'] as [string, string, string],
  edge: '#AEB5AF',
  ribbon: ['#C9CFCA', '#B5BCB6'] as [string, string],
  ink: '#9AA29C',
};

const STAR = 'M50 66 L52.94 73.95 L61.41 74.29 L54.76 79.55 L57.05 87.71 L50 83 L42.95 87.71 L45.24 79.55 L38.59 74.29 L47.06 73.95 Z';

export default function CoupleMedal({ medal, size = 56, locked = false }: { medal: Medal; size?: number; locked?: boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const look = locked ? LOCKED : medal;
  return (
    <Svg width={size} height={size * 1.16} viewBox="0 0 100 116" accessible={false}>
      <Defs>
        <LinearGradient id={`metal${id}`} x1="0.15" y1="0" x2="0.85" y2="1">
          <Stop offset="0" stopColor={look.metal[0]} />
          <Stop offset="0.5" stopColor={look.metal[1]} />
          <Stop offset="1" stopColor={look.metal[2]} />
        </LinearGradient>
      </Defs>
      <Path d="M22 0 H44 L62 56 H42 Z" fill={look.ribbon[0]} />
      <Path d="M56 0 H78 L58 56 H38 Z" fill={look.ribbon[1]} />
      <Circle cx={50} cy={80} r={34} fill={look.edge} />
      <Circle cx={50} cy={80} r={31} fill={`url(#metal${id})`} />
      <Circle cx={50} cy={80} r={24} fill="none" stroke={look.edge} strokeOpacity={0.45} strokeWidth={2} />
      <Path d={STAR} fill={look.ink} fillOpacity={locked ? 0.55 : 0.8} transform="translate(0 2)" />
      {!locked ? <Ellipse cx={40} cy={64} rx={11} ry={5} fill="#FFFFFF" fillOpacity={0.4} transform="rotate(-30 40 64)" /> : null}
    </Svg>
  );
}
