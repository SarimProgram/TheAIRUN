import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useReducedMotion } from 'react-native-reanimated';
import type { WorkoutPhotosController } from '@/hooks/useWorkoutPhotos';

export default function WorkoutPhotoCapture({ controller, onClose }: { controller: WorkoutPhotosController; onClose: () => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<'front' | 'back' | 'review'>(controller.draft ? 'review' : 'front');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [error, setError] = useState('');
  const camera = useRef<CameraView>(null);
  const selfie = useRef('');
  const capturedAt = useRef('');
  const generation = useRef(0);
  const capturing = useRef(false);
  const backStarted = useRef(false);
  const mounted = useRef(true);
  const persisting = useRef(false);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (controller.draft) {
      setPhase('review'); setBusy(false); setCountdown(null);
      capturing.current = false;
    }
  }, [controller.draft]);

  useEffect(() => {
    mounted.current = true;
    const listener = AppState.addEventListener('change', state => {
      setActive(state === 'active');
      if (state !== 'active') {
        generation.current++;
        capturing.current = false;
        backStarted.current = false;
        setBusy(false);
        setCountdown(null);
        setPhase(previous => previous === 'review' ? previous : 'front');
        setReady(false);
      }
    });
    const captureGeneration = generation;
    return () => { mounted.current = false; captureGeneration.current++; listener.remove(); };
  }, []);
  const fail = (message: string) => {
    if (!mounted.current) return;
    setError(message); setBusy(false); setCountdown(null);
    capturing.current = false; backStarted.current = false; setPhase('front');
  };
  const captureFront = async () => {
    if (!ready || capturing.current) return;
    capturing.current = true; setBusy(true); setError('');
    const token = generation.current;
    try {
      capturedAt.current = new Date().toISOString();
      const photo = await camera.current?.takePictureAsync({ quality: 0.75 });
      if (generation.current !== token) return;
      if (!photo) throw new Error('Camera did not take a photo. Please retry.');
      selfie.current = photo.uri;
      setReady(false); setPhase('back');
    } catch (e) { if (generation.current === token) fail(e instanceof Error ? e.message : 'Could not take selfie.'); }
  };
  const onReady = async () => {
    setReady(true);
    if (phase !== 'back' || backStarted.current) return;
    backStarted.current = true;
    const token = generation.current;
    try {
      for (let value = 3; value > 0; value--) {
        if (generation.current !== token) return;
        setCountdown(value);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      if (generation.current !== token) return;
      setCountdown(null);
      const photo = await camera.current?.takePictureAsync({ quality: 0.75 });
      if (generation.current !== token) return;
      if (!photo) throw new Error('Could not capture surroundings. Please retake.');
      persisting.current = true;
      await controller.saveDraft(selfie.current, photo.uri, capturedAt.current);
      if (generation.current !== token) return;
      setPhase('review'); setBusy(false); capturing.current = false;
    } catch (e) { if (generation.current === token) fail(e instanceof Error ? e.message : 'Could not save photo draft.'); }
    finally { persisting.current = false; }
  };
  useEffect(() => {
    if (phase === 'review' || ready || !permission?.granted || !active) return;
    const timer = setTimeout(() => fail('Camera is taking too long to start. Close and try again.'), 15000);
    return () => clearTimeout(timer);
  }, [phase, ready, permission?.granted, active]);
  const close = () => {
    if (controller.uploading || persisting.current) return;
    const discard = () => { generation.current++; void controller.discardDraft().then(onClose).catch(() => setError('Could not discard draft. Please retry.')); };
    if (controller.draft) Alert.alert('Discard these photos?', 'Your unsaved photo pair will be removed.', [
      { text: 'Keep editing', style: 'cancel' }, { text: 'Discard', style: 'destructive', onPress: discard },
    ]);
    else { generation.current++; onClose(); }
  };

  return <Modal animationType={reducedMotion ? 'none' : 'slide'} onRequestClose={close}>
    <View style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{phase === 'review' ? 'Your workout photos' : phase === 'front' ? 'Start with a selfie' : 'Now your surroundings'}</Text>
        <Pressable accessibilityRole="button" disabled={controller.uploading} onPress={close} style={styles.button}><Text style={styles.text}>Cancel</Text></Pressable>
      </View>
      {phase === 'review' ? <View style={styles.preview}>
        {controller.draft ? <>
          <Image source={controller.draft.surroundings} style={StyleSheet.absoluteFill} contentFit="contain" />
          <Image source={controller.draft.selfie} style={styles.inset} contentFit="cover" />
        </> : <ActivityIndicator color="white" style={{ flex: 1 }} />}
      </View> : permission?.granted ? <View style={styles.preview}>
        {active && <CameraView key={`${phase}-${generation.current}`} ref={camera} facing={phase === 'back' ? 'back' : 'front'} style={StyleSheet.absoluteFill}
          onCameraReady={() => { void onReady(); }} onMountError={() => fail('Camera unavailable. Close and try again.')} />}
        {countdown != null && <View style={styles.countdown}><Text accessibilityLiveRegion="polite" style={styles.number}>{countdown}</Text></View>}
      </View> : <View style={[styles.preview, styles.permission]}>
        <Text style={styles.text}>Allow camera access to take a selfie and a photo of your surroundings.</Text>
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => permission?.canAskAgain === false ? void Linking.openSettings() : void requestPermission()}>
          <Text style={styles.text}>{permission?.canAskAgain === false ? 'Open settings' : 'Allow camera'}</Text>
        </Pressable>
      </View>}
      <Text style={styles.hint}>{phase === 'review' ? 'Your partner can see this pair for 30 days. Your completed workout stays in your history.' : phase === 'back' ? 'Point the rear camera at your workout space.' : 'One tap takes your selfie, then your surroundings after a countdown.'}</Text>
      {!!(error || controller.error) && <Text accessibilityRole="alert" style={styles.error}>{error || controller.error}</Text>}
      {phase === 'review' ? <View style={styles.header}>
        <Pressable accessibilityRole="button" disabled={controller.uploading} style={styles.button} onPress={() => {
          void controller.discardDraft().then(() => { generation.current++; backStarted.current = false; setReady(false); setPhase('front'); setError(''); }).catch(() => setError('Could not reset photos. Please retry.'));
        }}><Text style={styles.text}>Retake</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={controller.uploading} style={[styles.button, styles.primary]} onPress={() => {
          if (controller.draft) void controller.upload(controller.draft).then(saved => { if (saved && mounted.current) { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); onClose(); } });
        }}>{controller.uploading ? <ActivityIndicator color="white" /> : <Text style={styles.text}>{controller.error ? 'Retry log photo' : 'Log photo'}</Text>}</Pressable>
      </View> : <Pressable accessibilityRole="button" accessibilityLabel="Take workout photos" disabled={!ready || busy || !permission?.granted} onPress={() => { void captureFront(); }} style={[styles.shutter, (!ready || busy) && { opacity: 0.4 }]}>
        {busy ? <ActivityIndicator color="#111827" /> : <View style={styles.shutterInner} />}
      </Pressable>}
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#111827', paddingHorizontal: 16, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { color: 'white', fontSize: 20, fontWeight: '700', flex: 1 },
  text: { color: 'white', fontSize: 16, textAlign: 'center', fontWeight: '600' },
  button: { minHeight: 48, padding: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderCurve: 'continuous' },
  primary: { backgroundColor: '#FF6B6B', flex: 1 },
  preview: { flex: 1, overflow: 'hidden', borderRadius: 16, borderCurve: 'continuous', backgroundColor: '#000' },
  inset: { position: 'absolute', top: 12, left: 12, width: '30%', aspectRatio: 0.75, borderRadius: 12, borderWidth: 2, borderColor: 'white' },
  permission: { justifyContent: 'center', padding: 24, gap: 20 },
  countdown: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  number: { color: 'white', fontSize: 72, fontWeight: '800' },
  hint: { color: '#CBD5E1', textAlign: 'center', fontSize: 14 },
  error: { color: '#FDA4AF', textAlign: 'center' },
  shutter: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'white', alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: '#111827' },
});
