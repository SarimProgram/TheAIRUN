import React, { useId } from 'react';
import { Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

/** Standalone vector prize; render inside an SVG with viewBox="0 0 64 64". */
export default function PulleyTrophy() {
  const id = 'trophy' + useId().replace(/:/g, '');
  return <G>
    <Defs><LinearGradient id={id} x2="1" y2="0">
      <Stop stopColor="#D48B16" /><Stop offset=".45" stopColor="#FFE796" /><Stop offset="1" stopColor="#EEAF32" />
    </LinearGradient></Defs>
    <Path d="M17 12 H8 V23 Q8 33 24 34 M47 12 H56 V23 Q56 33 40 34" fill="none" stroke="#DE9C24" strokeWidth={5} />
    <Path d="M17 8 H47 V27 Q47 39 35 42 V50 H44 V55 H20 V50 H29 V42 Q17 39 17 27Z" fill={`url(#${id})`} stroke="#BE7D1B" strokeWidth={1.2} />
    <Path d="M22 12 V26 Q22 33 26 35" stroke="#FFF0BF" strokeWidth={3} fill="none" strokeLinecap="round" />
    <Path d="M32 16 l3 6 7 1 -5 5 1 7 -6 -3 -6 3 1 -7 -5 -5 7 -1Z" fill="#FFF6D8" />
    <Rect x={17} y={55} width={30} height={7} rx={2} fill="#85503B" />
    <Rect x={25} y={57} width={14} height={3} rx={1} fill="#FFD775" />
  </G>;
}
