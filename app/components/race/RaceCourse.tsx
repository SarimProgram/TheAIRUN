import React from 'react';
import Animated, { scrollTo, useAnimatedRef, useDerivedValue, type SharedValue } from 'react-native-reanimated';
import RaceScene from './RaceScene';
import { getCourseLayout } from './raceCourseGeometry';

type Props = {
  width: number; viewportHeight: number; bottomInset: number; raceDistance: number;
  myProgress: SharedValue<number>; theirProgress: SharedValue<number>;
  myDistance: number; partnerDistance: number; gender?: string | null;
  running: boolean; following: boolean; onBrowse: () => void;
};

export default function RaceCourse({ width, viewportHeight, bottomInset, raceDistance, following, onBrowse, ...runners }: Props) {
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  // Course geometry is independent of the sheet and camera viewport.
  const { distance, travel, height: sceneHeight, startY } = getCourseLayout(width, raceDistance);
  const contentHeight = sceneHeight + bottomInset;
  const offset = useDerivedValue(() => {
    const runnerY = startY - Math.max(0, Math.min(1, runners.myProgress.get())) * travel;
    const target = Math.max(140, viewportHeight - bottomInset - 100);
    return Math.max(0, Math.min(contentHeight - viewportHeight, runnerY - target));
  });
  useDerivedValue(() => {
    if (following) scrollTo(scrollRef, 0, offset.get(), false);
  });

  return <Animated.ScrollView ref={scrollRef} style={{ flex: 1, backgroundColor: '#D6E9BD' }}
    contentContainerStyle={{ paddingBottom: bottomInset }}
    contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false} showsVerticalScrollIndicator
    onScrollBeginDrag={onBrowse} bounces={false}
    onContentSizeChange={() => {
      if (following) scrollRef.current?.scrollTo({ y: offset.get(), animated: false });
    }}>
    <RaceScene width={width} height={sceneHeight} raceDistance={distance} {...runners} />
  </Animated.ScrollView>;
}
