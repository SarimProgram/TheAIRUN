import React, { useMemo, useRef, useState } from 'react';
import { View, StyleSheet, PanResponder, TouchableOpacity, Text, Platform } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Eraser } from 'lucide-react-native';
import { COLORS, Stroke, StrokePoint, mono } from './partnerNoteShared';

function pointsToPath(points: StrokePoint[]): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  return `M ${first.x} ${first.y} ${rest.map((p) => `L ${p.x} ${p.y}`).join(' ')}`;
}

type Props = {
  strokes: Stroke[];
  onChange: (strokes: Stroke[]) => void;
  onCanvasSize?: (width: number, height: number) => void;
  compact?: boolean;
  disabled?: boolean;
};

export default function NoteAnnotationCanvas({ strokes, onChange, onCanvasSize, compact, disabled }: Props) {
  const [activeStroke, setActiveStroke] = useState<StrokePoint[]>([]);
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponder: () => !disabled,
        onPanResponderGrant: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          setActiveStroke([{ x: locationX, y: locationY }]);
        },
        onPanResponderMove: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          setActiveStroke((prev) => [...prev, { x: locationX, y: locationY }]);
        },
        onPanResponderRelease: () => {
          setActiveStroke((prev) => {
            if (prev.length > 1) {
              onChange([...strokesRef.current, prev]);
            }
            return [];
          });
        },
        onPanResponderTerminate: () => setActiveStroke([]),
      }),
    [disabled, onChange]
  );

  const allStrokes = activeStroke.length > 1 ? [...strokes, activeStroke] : strokes;

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <View
        style={[styles.canvas, compact && styles.canvasCompact]}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          onCanvasSize?.(width, height);
        }}
        {...panResponder.panHandlers}
      >
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          {allStrokes.map((stroke, index) => (
            <Path
              key={`stroke-${index}`}
              d={pointsToPath(stroke)}
              stroke={COLORS.inkDark}
              strokeWidth={compact ? 2.4 : 3}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}
        </Svg>
        {strokes.length === 0 && activeStroke.length === 0 && (
          <Text style={[styles.hint, compact && styles.hintCompact]}>Draw on the note</Text>
        )}
      </View>
      {strokes.length > 0 && (
        <TouchableOpacity
          style={styles.clearBtn}
          onPress={() => onChange([])}
          disabled={disabled}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Eraser size={13} color={COLORS.inkFaded} />
          <Text style={styles.clearText}>Clear</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, minHeight: 72 },
  wrapCompact: { minHeight: 56 },
  canvas: {
    flex: 1,
    minHeight: 72,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  canvasCompact: { minHeight: 56 },
  hint: {
    position: 'absolute',
    alignSelf: 'center',
    top: '38%',
    fontFamily: mono,
    fontSize: 12,
    color: 'rgba(92, 64, 51, 0.45)',
    fontWeight: '600',
  },
  hintCompact: { fontSize: 11, top: '34%' },
  clearBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(92, 64, 51, 0.12)',
  },
  clearText: {
    fontFamily: mono,
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.inkFaded,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});
