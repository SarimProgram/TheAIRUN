import React, { useId } from 'react';
import { Image, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { usePlanColors } from './PlanVisuals';
import { normalizeGender } from '../../utils/genderMascot';

const COACHES = {
  male: {
    calendar: require('../../assets/plan/coaches/male-calendar-v2.png'),
    strength: require('../../assets/plan/coaches/male-strength-v2.png'),
    walk: require('../../assets/plan/coaches/male-walk-v2.png'),
  },
  female: {
    calendar: require('../../assets/plan/coaches/female-calendar-v2.png'),
    strength: require('../../assets/plan/coaches/female-strength-v2.png'),
    walk: require('../../assets/plan/coaches/female-walk-v2.png'),
  },
};

/** Organic paint swipe stays sharp at every size; no additional library. */
export function CoachBrushStroke({ gender }: { gender?: string | null }) {
  const c = usePlanColors(gender);
  const isFemale = c.isFemale;
  const gradientId = `coach-stroke-${useId().replace(/:/g, '')}`;
  return <Svg pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" viewBox="0 0 120 190" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
    <Defs><LinearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0">
      <Stop offset="0" stopColor={isFemale ? c.soft : c.dark ? '#264948' : '#E4FAF9'} />
      <Stop offset="1" stopColor={isFemale ? c.accent : c.dark ? '#347371' : '#AFE9E8'} stopOpacity={isFemale ? 0.5 : 1} />
    </LinearGradient></Defs>
    <Path d="M8 147 C-5 130 4 111 24 93 L74 40 C91 20 112 24 117 42 C124 63 110 82 94 101 L42 159 C26 177 8 169 8 147Z" fill={`url(#${gradientId})`} />
  </Svg>;
}

export function PlanCoachArt({ gender, pose, style }: { gender?: string | null; pose: 'calendar' | 'strength' | 'walk'; style?: ViewStyle }) {
  const identity = normalizeGender(gender) || 'male';
  const c = usePlanColors(gender);
  return <View style={[s.art, pose !== 'calendar' && { backgroundColor: c.secondarySoft }, style]}>
    <CoachBrushStroke gender={gender} />
    <Image source={COACHES[identity][pose]} accessibilityLabel={`${identity === 'female' ? 'Female' : 'Male'} coach ${pose === 'calendar' ? 'standing with arms folded' : pose === 'strength' ? 'lifting dumbbells' : 'walking'}`} resizeMode="contain" style={[s.image, pose === 'calendar' && s.calendarImage]} />
  </View>;
}

const s = StyleSheet.create({
  art: { overflow: 'hidden', borderRadius: 16, borderCurve: 'continuous' },
  image: { width: '100%', height: '100%' },
  calendarImage: { position: 'absolute', bottom: -4, width: '100%', height: '100%' },
});
