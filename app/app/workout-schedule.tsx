import { useColorScheme } from '@/hooks/use-color-scheme';
import React from 'react';
import { Pressable, Text } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import WorkoutScheduleSheet from '@/components/home/WorkoutScheduleSheet';

export default function WorkoutSchedule() {
  const router = useRouter();
  const dark = useColorScheme() === 'dark';
  const params = useLocalSearchParams<{ participant?: string; name?: string; dayKey?: string; weekNumber?: string }>();
  const requestedWeek = Number(params.weekNumber);
  return <>
    <Stack.Screen options={{ title: 'Workout days', headerStyle: { backgroundColor: dark ? '#0F172A' : '#FFFFFF' }, headerTintColor: dark ? '#F1F5F9' : '#182033', headerShadowVisible: false, headerRight: () => <Pressable accessibilityRole="button" accessibilityLabel="Close workout days" onPress={() => router.back()} style={{ minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: '#FF6B6B', fontSize: 16, fontWeight: '600' }}>Done</Text></Pressable> }} />
    <WorkoutScheduleSheet participant={params.participant === 'partner' ? 'partner' : 'you'} name={params.name} dayKey={params.dayKey}
      weekNumber={Number.isInteger(requestedWeek) && requestedWeek > 0 && requestedWeek <= 260 ? requestedWeek : undefined} onViewPlan={() => router.dismissTo('/Plans')} />
  </>;
}
