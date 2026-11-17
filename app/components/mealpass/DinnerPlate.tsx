import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import DrawnPlate from './DrawnPlate';
import { DiscSurface } from './ThrowDisc';
import type { PassColors } from './passTheme';

type Props = {
  size: number; imageUri: string | null; isCutout: boolean; colors: PassColors; title?: string;
  /** Keeps the plate but hides the food, while the scanned photo is still flying onto it. */
  foodHidden?: boolean;
  /** Measures where the food sits, so a flying photo can land exactly on it. */
  foodRef?: React.RefObject<View | null>;
  onFoodLayout?: () => void;
};

/** The same bevelled plate used for passing meals, with scanned food centred in its recessed well. */
export default function DinnerPlate({ size, imageUri, isCutout, colors, title, foodHidden, foodRef, onFoodLayout }: Props) {
  const well = size * 0.8;
  return (
    <DiscSurface size={size} colors={colors}>
      <View ref={foodRef} collapsable={false} onLayout={onFoodLayout}
        style={{ width: well, height: well, borderRadius: well / 2, overflow: isCutout ? 'visible' : 'hidden', alignItems: 'center', justifyContent: 'center', opacity: foodHidden ? 0 : 1 }}>
        {!imageUri ? <DrawnPlate size={well} colors={colors} title={title} />
          : <Image source={{ uri: imageUri }} style={isCutout ? styles.cutout : styles.photo} resizeMode={isCutout ? 'contain' : 'cover'} />}
      </View>
    </DiscSurface>
  );
}

const styles = StyleSheet.create({
  cutout: { width: '112%', height: '112%' },
  photo: { width: '100%', height: '100%' },
});
