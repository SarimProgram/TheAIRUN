import React, { useState } from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { COLORS, StrokePoint, parseDrawMessage } from './partnerNoteShared';

function pointsToPath(points: StrokePoint[]): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  return `M ${first.x} ${first.y} ${rest.map((p) => `L ${p.x} ${p.y}`).join(' ')}`;
}

type Props = {
  content: string;
  height?: number;
  compact?: boolean;
};

export default function NoteDrawingPreview({ content, height = 72, compact }: Props) {
  const [layoutWidth, setLayoutWidth] = useState(280);
  const strokes = parseDrawMessage(content, layoutWidth, height) ?? [];

  if (!strokes.length) return null;

  const onLayout = (e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    if (width > 0) setLayoutWidth(width);
  };

  return (
    <View style={[styles.wrap, { height }, compact && styles.wrapCompact]} onLayout={onLayout}>
      <Svg width="100%" height="100%">
        {strokes.map((stroke, index) => (
          <Path
            key={`preview-${index}`}
            d={pointsToPath(stroke)}
            stroke={COLORS.inkDark}
            strokeWidth={compact ? 2 : 2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.4)',
    overflow: 'hidden',
    marginTop: 4,
  },
  wrapCompact: { marginTop: 2 },
});
