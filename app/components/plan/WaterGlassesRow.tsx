import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

type WaterGlassIconProps = {
  filled: boolean;
  color: string;
  size?: number;
};

export function WaterGlassIcon({ filled, color, size = 26 }: WaterGlassIconProps) {
  const stroke = filled ? color : '#D1D5DB';

  return (
    <Svg width={size} height={size * 1.15} viewBox="0 0 24 28">
      <Path
        d="M7.5 3.5h9l-1.4 19.2a2.2 2.2 0 0 1-2.15 1.8h-4.9a2.2 2.2 0 0 1-2.15-1.8L7.5 3.5z"
        stroke={stroke}
        strokeWidth={1.7}
        fill={filled ? color : 'transparent'}
        fillOpacity={filled ? 0.28 : 0}
        strokeLinejoin="round"
      />
      <Path
        d="M6.5 3.5h11"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
      />
      {filled ? (
        <Path
          d="M9 16h6"
          stroke={color}
          strokeWidth={1.2}
          strokeOpacity={0.45}
          strokeLinecap="round"
        />
      ) : null}
    </Svg>
  );
}

type WaterGlassesRowProps = {
  filledCount: number;
  totalGlasses: number;
  color: string;
  onPressGlass?: (glassIndex: number) => void;
};

export function WaterGlassesRow({
  filledCount,
  totalGlasses,
  color,
  onPressGlass,
}: WaterGlassesRowProps) {
  return (
    <View style={styles.row}>
      {Array.from({ length: totalGlasses }, (_, index) => {
        const glassNumber = index + 1;
        const filled = index < filledCount;
        const icon = (
          <WaterGlassIcon filled={filled} color={color} />
        );

        if (!onPressGlass) {
          return (
            <View key={glassNumber} style={styles.glassSlot}>
              {icon}
            </View>
          );
        }

        return (
          <TouchableOpacity
            key={glassNumber}
            style={styles.glassSlot}
            onPress={() => onPressGlass(glassNumber)}
            activeOpacity={0.75}
          >
            {icon}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 4,
  },
  glassSlot: {
    width: 34,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export const DAILY_WATER_GLASS_TARGET = 8;

export function splitWaterGlassesAcrossPeriods(
  totalGlasses: number,
): Record<'morning' | 'afternoon' | 'evening', number> {
  const periods = ['morning', 'afternoon', 'evening'] as const;
  const base = Math.floor(totalGlasses / periods.length);
  const remainder = totalGlasses % periods.length;

  return {
    morning: base + (remainder > 0 ? 1 : 0),
    afternoon: base + (remainder > 1 ? 1 : 0),
    evening: base,
  };
}

export function getWaterProgressForPeriod(
  totalGlasses: number,
  period: 'morning' | 'afternoon' | 'evening',
  targets: Record<'morning' | 'afternoon' | 'evening', number>,
): { value: number; target: number; startGlass: number } {
  const order = ['morning', 'afternoon', 'evening'] as const;
  const startGlass = order
    .slice(0, order.indexOf(period))
    .reduce((sum, key) => sum + targets[key], 0);
  const target = targets[period];
  const value = Math.max(0, Math.min(totalGlasses - startGlass, target));

  return { value, target, startGlass };
}
