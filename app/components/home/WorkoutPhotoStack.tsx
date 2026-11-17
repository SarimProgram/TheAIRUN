import { useColorScheme } from '@/hooks/use-color-scheme';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { Camera, X } from 'lucide-react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, useReducedMotion } from 'react-native-reanimated';
import type { WorkoutPhoto, WorkoutPhotosController } from '@/hooks/useWorkoutPhotos';
import { useHomeAvatar } from '../../lib/home-avatar';
import HomeAvatarPose from './HomeAvatarPose';

function Pair({ photo, controller, contain = false, full = false }: { photo: WorkoutPhoto; controller: WorkoutPhotosController; contain?: boolean; full?: boolean }) {
  const key = `${controller.scope}:${photo.id}:${full}`;
  const [loaded, setLoaded] = useState<{ key: string; selfie?: string; surroundings?: string; failed?: boolean }>();
  const getImageUri = controller.getImageUri;
  useEffect(() => {
    let cancelled = false;
    void Promise.all([getImageUri(photo, 'selfie', full), getImageUri(photo, 'surroundings', full)])
      .then(([selfie, surroundings]) => { if (!cancelled) setLoaded({ key, selfie, surroundings }); })
      .catch(() => { if (!cancelled) setLoaded({ key, failed: true }); });
    return () => { cancelled = true; };
  }, [key, photo, full, getImageUri]);
  const current = loaded?.key === key ? loaded : undefined;
  return <View style={styles.pair}>
    {current?.surroundings && <Image source={{ uri: current.surroundings }} cachePolicy="none" contentFit={contain ? 'contain' : 'cover'} style={StyleSheet.absoluteFill} onError={() => setLoaded({ key, failed: true })} />}
    {current?.selfie && <Image source={{ uri: current.selfie }} cachePolicy="none" contentFit="cover" style={styles.selfie} onError={() => setLoaded({ key, failed: true })} />}
    {!current && <ActivityIndicator style={StyleSheet.absoluteFill} color="white" />}
    {current?.failed && <View style={styles.unavailable}><Text style={styles.unavailableText}>Photo unavailable</Text></View>}
  </View>;
}

export default function WorkoutPhotoStack({ controller, photos, own, name, comparison = false }: {
  controller: WorkoutPhotosController; photos: WorkoutPhoto[]; own?: boolean; name: string; comparison?: boolean;
}) {
  const avatar = useHomeAvatar(own ? 'you' : 'partner');
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const { width, height } = useWindowDimensions();
  const dark = useColorScheme() === 'dark';
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(0.95);
  const opacity = useSharedValue(0);
  const animation = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));
  const cardWidth = Math.min(width * 0.88, 480);
  useEffect(() => {
    opacity.value = withTiming(open ? 1 : 0, { duration: 180 });
    scale.value = reduceMotion ? 1 : withSpring(open ? 1 : 0.95, { duration: 300, dampingRatio: 1 });
  }, [open, opacity, reduceMotion, scale]);
  useEffect(() => { setOpen(false); setIndex(0); }, [controller.scope]);
  useEffect(() => {
    if (!photos.length) setOpen(false);
    setIndex(previous => Math.min(previous, Math.max(0, photos.length - 1)));
  }, [photos.length]);
  const foreground = dark ? '#F8FAFC' : '#111827';
  return <View style={[styles.tile, comparison && { width: '100%', minHeight: 132, paddingTop: 0 }]}>
    {photos.length ? <Pressable accessibilityRole="button" accessibilityLabel={`View ${name}'s workout photos`} onPress={() => { setIndex(0); setOpen(true); }} style={[styles.stack, comparison && { height: 132 }]}>
      {photos.slice(0, 3).reverse().map((photo, reverseIndex, visible) => {
        const depth = visible.length - reverseIndex - 1;
        return <View key={photo.id} style={[styles.card, { transform: [{ rotate: `${depth * 4}deg` }, { translateX: depth * 3 }, { translateY: -depth * 4 }] }]}>
          <Pair photo={photo} controller={controller} />
        </View>;
      })}
    </Pressable> : <View style={[styles.empty, { backgroundColor: dark ? '#1E293B' : '#F1F5F9' }]}>
      {controller.loading ? <ActivityIndicator color="#0D9488" /> : avatar?.kind === 'home-sheet' ? <View style={styles.avatarPose}><HomeAvatarPose uri={avatar.uri} pose="workout" /></View> : <Camera size={24} color="#94A3B8" />}
      <Text style={[styles.caption, { color: foreground }]}>{controller.loading ? 'Loading photos' : own ? 'Your workout photos' : 'No photos yet'}</Text>
    </View>}
    {!comparison && own && controller.mine.todayCompleted && <Text accessibilityLiveRegion="polite" style={styles.completed}>Today completed</Text>}
    {!comparison && !own && controller.partner.todayCompleted && <Text style={styles.completed}>Today completed</Text>}
    <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)}>
      <View style={styles.overlay}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close photo viewer" onPress={() => setOpen(false)} style={StyleSheet.absoluteFill} />
        <Animated.View style={[styles.viewer, { width: cardWidth, maxHeight: height * 0.7, backgroundColor: dark ? '#1E293B' : '#FFF' }, animation]}>
          <View style={styles.viewerHeader}>
            <Text numberOfLines={2} style={[styles.viewerTitle, { color: foreground }]}>{`${name}'s workouts`}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close photo viewer" onPress={() => setOpen(false)} style={styles.close}><X size={22} color={foreground} /></Pressable>
          </View>
          <FlatList horizontal pagingEnabled data={photos} keyExtractor={photo => photo.id} showsHorizontalScrollIndicator={false}
            initialNumToRender={1} maxToRenderPerBatch={2} windowSize={3} extraData={`${index}:${open}`}
            getItemLayout={(_, itemIndex) => ({ length: cardWidth, offset: cardWidth * itemIndex, index: itemIndex })}
            onMomentumScrollEnd={event => setIndex(Math.round(event.nativeEvent.contentOffset.x / cardWidth))}
            onEndReached={() => { if (controller.nextCursor && !controller.loading) void controller.refresh(controller.nextCursor); }} onEndReachedThreshold={0.5}
            renderItem={({ item, index: itemIndex }) => <View style={{ width: cardWidth, height: height * 0.42, paddingHorizontal: 12 }}><Pair photo={item} controller={controller} contain full={open && index === itemIndex} /></View>} />
          <Text style={[styles.caption, { color: foreground }]}>{photos[index]?.dayKey} · {index + 1} / {photos.length}</Text>
          <Text style={[styles.caption, { color: foreground }]}>Photos kept for 30 days · Workout history stays</Text>
          {controller.loading && <ActivityIndicator color="#0D9488" />}
          {!!controller.error && <Text style={styles.caption}>{controller.error}</Text>}
          {controller.nextCursor && <Pressable accessibilityRole="button" disabled={controller.loading} onPress={() => { void controller.refresh(controller.nextCursor!); }} style={styles.close}><Text style={styles.logText}>Load older photos</Text></Pressable>}
        </Animated.View>
      </View>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  tile: { width: '86%', minHeight: 140, alignItems: 'center', gap: 4, paddingTop: 12 },
  stack: { width: '100%', height: 104 },
  card: { ...StyleSheet.absoluteFillObject, padding: 3, backgroundColor: '#FFF', borderRadius: 12, borderCurve: 'continuous', borderWidth: 1, borderColor: '#CBD5E1' },
  pair: { flex: 1, overflow: 'hidden', borderRadius: 10, borderCurve: 'continuous', backgroundColor: '#0F172A' },
  selfie: { position: 'absolute', left: 6, top: 6, width: '30%', height: '40%', borderRadius: 6, borderWidth: 1, borderColor: 'white' },
  empty: { width: '100%', height: 104, borderRadius: 12, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 8 },
  avatarPose: { width: 64, height: 56, marginBottom: -8 },
  caption: { fontSize: 12, textAlign: 'center', paddingVertical: 8 },
  logText: { color: '#0D9488', fontSize: 14, fontWeight: '700' },
  completed: { color: '#0D9488', fontSize: 11, fontWeight: '600', textAlign: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  viewer: { overflow: 'hidden', borderRadius: 20, borderCurve: 'continuous', paddingBottom: 12 },
  viewerHeader: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16 },
  viewerTitle: { flex: 1, fontSize: 17, fontWeight: '700' },
  close: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', padding: 8 },
  unavailable: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: '#334155' },
  unavailableText: { color: 'white', fontSize: 12 },
});
