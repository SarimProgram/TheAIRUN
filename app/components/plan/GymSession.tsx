import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Camera } from 'lucide-react-native';
import { useReducedMotion } from 'react-native-reanimated';
import WorkoutPhotoCapture from '../home/WorkoutPhotoCapture';
import { type WorkoutPhotosController } from '../../hooks/useWorkoutPhotos';
import { IconButton, ui, usePlanColors } from './PlanVisuals';

export function GymSession({ visible, onClose, photos, isToday, completed }: {
  visible: boolean; onClose: () => void; photos: WorkoutPhotosController; isToday: boolean; completed: boolean;
}) {
  const c = usePlanColors();
  const reducedMotion = useReducedMotion();
  const [capture, setCapture] = useState(false);
  return <Modal visible={visible} presentationStyle="fullScreen" animationType={reducedMotion ? 'none' : 'slide'} onRequestClose={onClose}>
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 24, gap: 24 }}>
        <IconButton icon={ArrowLeft} label="Back to plan" onPress={onClose} />
        <Text style={[ui.title, { color: c.text }]}>GYM</Text>
        <Text style={[ui.body, { color: c.sub }]}>Follow your own gym routine. This is your training session for the day.</Text>
        <Text style={[ui.body, { color: c.sub }]}>Add photo proof after your workout to record your check-in.</Text>
        {completed && <Text style={[ui.heading, { color: c.accent }]}>Photo proof added</Text>}
        {isToday ? <Pressable accessibilityRole="button" onPress={() => setCapture(true)} style={[ui.primary, { backgroundColor: c.accent }]}>
          <Camera size={22} color="#FFFFFF" /><Text style={ui.primaryText}>{completed ? 'Add another photo' : 'Add photo proof'}</Text>
        </Pressable> : <Text style={[ui.body, { color: c.sub }]}>Photo check-ins are available for today’s session.</Text>}
      </ScrollView>
      {capture && <WorkoutPhotoCapture controller={photos} onClose={() => setCapture(false)} />}
    </SafeAreaView>
  </Modal>;
}
