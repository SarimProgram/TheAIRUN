import React, { useId, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Crown } from 'lucide-react-native';
import Svg, { ClipPath, Defs, G, Path, Pattern, Rect } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { CORAL, TEAL } from './weeklyRewardTheme';

const BAR_HEIGHT = 26;

type Props = {
  /** Your fraction of the combined score; ignored when `empty`. */
  share: number;
  /** Shows only the track, so a 0–0 or loading score does not look like a 50/50 split. */
  empty?: boolean;
  crown: 'you' | 'partner' | null;
  track: string;
  left?: string;
  right?: string;
  compact?: boolean;
};

export default function WeeklyScoreBar({ share, empty = false, crown, track, left = TEAL, right = CORAL, compact = false }: Props) {
  const [width, setWidth] = useState(0);
  const id = useId().replace(/:/g, '');
  const split = Math.min(width - 8, Math.max(8, width * share));
  const barHeight = compact ? 10 : BAR_HEIGHT;

  return (
    <View style={[styles.barWrap, compact && { height: barHeight, marginTop: 6 }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <Svg width={width} height={barHeight} accessible={false}>
          <Defs>
            <ClipPath id={`bar-${id}`}>
              <Rect width={width} height={barHeight} rx={barHeight / 2} />
            </ClipPath>
            <Pattern id={`facets-${id}`} patternUnits="userSpaceOnUse" width={16} height={26}>
              <Path d="M-8 26L14 0H22L0 26ZM8 26L30 0H38L16 26Z" fill="#FFFFFF" opacity={0.15} />
            </Pattern>
          </Defs>
          <G clipPath={`url(#bar-${id})`}>
            <Rect width={width} height={barHeight} fill={track} />
            {!empty && <>
              <Path d={`M0 0 H${split + 6} L${split - 6} ${barHeight} H0Z`} fill={left} />
              <Path d={`M${split + 6} 0 H${width} V${barHeight} H${split - 6}Z`} fill={right} />
            </>}
            <Rect width={width} height={barHeight} fill={`url(#facets-${id})`} />
            {!empty && <Path d={`M${split + 6} 0 L${split - 6} ${barHeight}`} stroke="#FFFFFF" strokeWidth={2} />}
          </G>
        </Svg>
      )}
      {crown && !empty && (
        <LinearGradient
          colors={crown === 'partner' ? ['#FFA9AE', '#FF7680', '#E9404F'] : ['#8FE6E9', '#3CC7CC', '#109BA2']}
          style={[
            styles.crown,
            crown === 'partner' ? styles.crownRight : styles.crownLeft,
            compact && { width: 18, height: 18, borderRadius: 9, borderWidth: 1 },
            { boxShadow: crown === 'partner' ? '0 0 14px rgba(244,101,111,0.55)' : '0 0 14px rgba(43,191,196,0.55)' },
          ]}
        >
          <Crown size={compact ? 10 : 17} color="#FFFFFF" fill="#FFFFFF" strokeWidth={1.5} />
        </LinearGradient>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  barWrap: { alignSelf: 'stretch', height: BAR_HEIGHT, justifyContent: 'center', marginTop: 20 },
  crown: { position: 'absolute', width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  crownRight: { right: -8 },
  crownLeft: { left: -8 },
});
