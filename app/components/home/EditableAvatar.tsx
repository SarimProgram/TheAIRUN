import { useColorScheme } from '@/hooks/use-color-scheme';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, type ImageStyle, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Camera, ImagePlus, RotateCcw, WandSparkles, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from 'react-native-reanimated';
import { getImageChatAvatarSource } from '../../utils/genderMascot';
import CuteAvatar from './CuteAvatar';
import { useAuth } from '../../src/auth/authContext';
import { API_BASE_URL } from '../../config/api';
import { saveHomeAvatar, useHomeAvatarByKey, type HomeAvatarChoice as Choice } from '../../lib/home-avatar';
import HomeAvatarPose, { HOME_POSES } from './HomeAvatarPose';

type Props = { storageKey: string; name: string; gender?: string | null; active: boolean; imageStyle: ImageStyle; dimmed?: boolean; editable?: boolean };

export default function EditableAvatar({ storageKey, name, gender, active, imageStyle, dimmed, editable = true }: Props) {
  const { choice, ready, error: loadError } = useHomeAvatarByKey(storageKey);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<string | null>(null);
  const [generated, setGenerated] = useState<string | null>(null);
  const { authFetch } = useAuth();
  const operation = useRef(false);
  const currentKey = useRef(storageKey);
  currentKey.current = storageKey;
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const cuteCharacter = gender?.toLowerCase() === 'female' ? 'female' : 'male';
  const dark = useColorScheme() === 'dark';
  const colors = dark
    ? { surface: '#1F2937', card: '#293548', ink: '#F8FAFC', muted: '#CBD5E1', border: '#475569', soft: '#492D35' }
    : { surface: '#FFFFFF', card: '#F8FAFC', ink: '#20212B', muted: '#6B7280', border: '#E2E8F0', soft: '#FFF1F2' };

  useEffect(() => {
    setVisible(false); setError(''); setDraft(null); setGenerated(null);
  }, [storageKey, gender]);

  const persist = async (next: Choice, key: string) => {
    if (currentKey.current !== key) return;
    await saveHomeAvatar(key, next);
    if (currentKey.current === key) { setVisible(false); setDraft(null); setGenerated(null); }
  };
  const change = async (next: Choice) => {
    if (operation.current) return;
    operation.current = true; setBusy(true); setError('');
    try { await persist(next, storageKey); }
    catch { setError('Could not save your avatar. Please try again.'); }
    finally { operation.current = false; setBusy(false); }
  };
  const upload = async (source: 'library' | 'camera' = 'library') => {
    if (operation.current) return;
    operation.current = true; setBusy(true); setError('');
    const key = storageKey;
    try {
      // Load native photo tools only when requested; keep home startup light.
      const picker = await import('expo-image-picker');
      if (source === 'camera') {
        const permission = await picker.requestCameraPermissionsAsync();
        if (currentKey.current !== key) return;
        if (!permission.granted) {
          setError('Allow camera access to take an avatar photo. You can also choose one from your library.');
          if (!permission.canAskAgain) Alert.alert('Camera access needed', 'Allow camera access in Settings to take an avatar photo.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open settings', onPress: () => { void Linking.openSettings(); } },
          ]);
          return;
        }
      }
      const options = { mediaTypes: ['images'] as ['images'], allowsEditing: true, aspect: [1, 1] as [number, number], quality: 0.8 };
      const result = source === 'camera'
        ? await picker.launchCameraAsync({ ...options, cameraType: picker.CameraType.front })
        : await picker.launchImageLibraryAsync(options);
      if (result.canceled || currentKey.current !== key) return;
      const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator');
      const asset = result.assets[0];
      const edge = Math.min(asset.width, asset.height);
      const photo = await manipulateAsync(asset.uri, [
        { crop: { originX: Math.floor((asset.width - edge) / 2), originY: Math.floor((asset.height - edge) / 2), width: edge, height: edge } },
        { resize: { width: 512, height: 512 } },
      ], { compress: 0.7, format: SaveFormat.JPEG, base64: true });
      if (!photo.base64) throw new Error('No photo data');
      if (currentKey.current === key) { setDraft(`data:image/jpeg;base64,${photo.base64}`); setGenerated(null); }
    } catch { if (currentKey.current === key) setError(source === 'camera' ? 'Could not take that photo. Please try again or choose one from your library.' : 'Could not open or save that photo. Please try another image.'); }
    finally { operation.current = false; setBusy(false); }
  };
  const savePhoto = async () => {
    if (!draft || operation.current) return;
    operation.current = true; setBusy(true); setError('');
    const key = storageKey;
    try {
      const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator');
      const photo = await manipulateAsync(draft, [{ resize: { width: 256, height: 256 } }], { compress: 0.7, format: SaveFormat.JPEG, base64: true });
      if (!photo.base64) throw new Error('No photo');
      await persist({ kind: 'photo', uri: `data:image/jpeg;base64,${photo.base64}` }, key);
    } catch { setError('Could not save your photo. Please try again.'); }
    finally { operation.current = false; setBusy(false); }
  };
  const makeCharacter = async () => {
    if (!draft || operation.current) return;
    operation.current = true; setBusy(true); setError('');
    const key = storageKey;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 165_000);
    try {
      const response = await authFetch(`${API_BASE_URL}/avatars/generate`, {
        method: 'POST', signal: controller.signal,
        body: JSON.stringify({ photo: draft, accent: cuteCharacter === 'female' ? 'coral' : 'teal' }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Could not make your character. Please try again.');
      if (result.layout !== 'home-v1' || typeof result.uri !== 'string' || !result.uri.startsWith('data:image/png;base64,') || result.uri.length > 2_000_000) throw new Error('Could not load your Home poses. Please try again.');
      if (currentKey.current === key) setGenerated(result.uri);
    } catch (cause) {
      if (currentKey.current === key) setError(cause instanceof Error && cause.name !== 'AbortError' ? cause.message : 'Character creation took too long. Please try again or use your photo.');
    } finally { clearTimeout(timeout); operation.current = false; setBusy(false); }
  };
  const preparePreviousCharacter = async () => {
    if (choice?.kind !== 'generated' || operation.current) return;
    operation.current = true; setBusy(true); setError('');
    const key = storageKey;
    try {
      const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator');
      const photo = await manipulateAsync(choice.uri, [{ crop: { originX: 0, originY: 0, width: 128, height: 128 } }, { resize: { width: 512, height: 512 } }], { compress: 0.8, format: SaveFormat.JPEG, base64: true });
      if (!photo.base64) throw new Error('No character image');
      if (currentKey.current === key) { setDraft(`data:image/jpeg;base64,${photo.base64}`); setGenerated(null); }
    } catch { setError('Could not prepare this character. Please upload your photo again.'); }
    finally { operation.current = false; setBusy(false); }
  };
  const close = () => { if (!operation.current) { setVisible(false); setDraft(null); setGenerated(null); setError(''); } };
  return <>
    <Pressable testID={`edit-avatar-${name}`} accessible={editable} accessibilityRole={editable ? 'button' : undefined}
      accessibilityLabel={editable ? `Change ${name} avatar` : undefined}
      accessibilityHint={editable ? 'Take or upload a photo, or choose a cute animated character' : undefined} disabled={!ready || !editable}
      onPress={() => setVisible(true)} style={({ pressed }) => [styles.trigger, pressed && styles.pressed, dimmed && styles.dimmed]}>
      {choice?.kind === 'cute' ? <CuteAvatar character={choice.character} active={active && !visible} />
        : choice?.kind === 'home-sheet' ? <HomeAvatarPose uri={choice.uri} pose="portrait" />
        : choice?.kind === 'generated' ? <CuteAvatar character={cuteCharacter} sheetUri={choice.uri} active={active && !visible} />
        : choice?.kind === 'photo' ? <Image source={{ uri: choice.uri }} style={styles.photo} />
          : <Image source={getImageChatAvatarSource(gender)} style={imageStyle} resizeMode="cover" />}
      {editable && <View style={[styles.editBadge, { backgroundColor: colors.surface }]}><Camera size={12} color={colors.ink} /></View>}
    </Pressable>
    {visible && <Modal visible transparent animationType={reducedMotion ? 'fade' : 'slide'} onRequestClose={close} statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Close avatar picker" onPress={close} />
        <View accessibilityViewIsModal style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: Math.max(20, insets.bottom), maxHeight: '90%' }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.header}>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.ink }]}>{draft ? generated ? 'Your character' : 'Make it yours' : name === 'your' ? 'Your avatar' : `${name}'s avatar`}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close avatar picker" disabled={busy} onPress={close} style={styles.close}><X size={22} color={colors.ink} /></Pressable>
          </View>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
            {draft ? <>
              <View style={[styles.photoPreview, { backgroundColor: colors.soft }]}>
                {generated ? <HomeAvatarPose uri={generated} pose="portrait" /> : <Image source={{ uri: draft }} style={styles.photo} />}
              </View>
              <Text style={[styles.description, { color: colors.muted }]}>{generated
                ? 'Your face, in the app’s avatar style. These static poses are shared across Home.'
                : 'Keep your photo, or let OpenAI turn it into a character that looks like you. Your photo is sent to OpenAI only when you choose Make my character.'}</Text>
              {!generated && <Pressable accessibilityRole="button" accessibilityLabel="Make my character" disabled={busy} onPress={() => void makeCharacter()} style={({ pressed }) => [styles.primary, pressed && styles.pressed, busy && styles.dimmed]}>
                <WandSparkles size={20} color="#FFFFFF" /><Text style={styles.primaryLabel}>{busy ? 'Making your character…' : 'Make my character'}</Text>
              </Pressable>}
              {generated && <View style={styles.posePreviews}>{HOME_POSES.filter(pose => ['nutrition-idle', 'water-idle', 'steps-0', 'workout'].includes(pose)).map(pose => <View key={pose} style={styles.posePreview}><HomeAvatarPose uri={generated} pose={pose} /><Text style={[styles.poseLabel, { color: colors.muted }]}>{pose === 'workout' ? 'Workout' : pose.startsWith('nutrition') ? 'Calories' : pose.startsWith('water') ? 'Water' : 'Steps'}</Text></View>)}</View>}
              {generated && <Pressable accessibilityRole="button" disabled={busy} onPress={() => void change({ kind: 'home-sheet', uri: generated })} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}><Text style={styles.primaryLabel}>Use across Home</Text></Pressable>}
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => void savePhoto()} style={[styles.option, { backgroundColor: colors.card, borderColor: colors.border }]}><Camera size={20} color={colors.ink} /><Text style={[styles.label, { color: colors.ink }]}>{generated ? 'Use original photo' : 'Use photo'}</Text></Pressable>
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => { setDraft(null); setGenerated(null); setError(''); }} style={styles.reset}><Text style={{ color: colors.muted }}>Choose another avatar</Text></Pressable>
            </> : <>
            <Text style={[styles.description, { color: colors.muted }]}>A little more you. Saved on this device.</Text>
            {choice?.kind === 'generated' && <Pressable accessibilityRole="button" accessibilityLabel="Add Home poses" disabled={busy} onPress={() => void preparePreviousCharacter()} style={[styles.option, { backgroundColor: colors.soft, borderColor: colors.border }]}><WandSparkles size={24} color="#F4656F" /><View style={styles.copy}><Text style={[styles.label, { color: colors.ink }]}>Add Home poses</Text><Text style={[styles.detail, { color: colors.muted }]}>Use your existing character across all four goals</Text></View></Pressable>}
            <Pressable accessibilityRole="button" accessibilityLabel="Take an avatar photo" disabled={busy} onPress={() => void upload('camera')}
              style={({ pressed }) => [styles.option, { backgroundColor: colors.card, borderColor: colors.border }, pressed && styles.pressed]}>
              <Camera size={24} color={colors.ink} /><View style={styles.copy}><Text style={[styles.label, { color: colors.ink }]}>Take photo</Text><Text style={[styles.detail, { color: colors.muted }]}>Use your camera for a new avatar</Text></View>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => void upload()}
              style={({ pressed }) => [styles.option, { backgroundColor: colors.card, borderColor: colors.border }, pressed && styles.pressed]}>
              <ImagePlus size={24} color={colors.ink} /><View style={styles.copy}><Text style={[styles.label, { color: colors.ink }]}>Upload yours</Text><Text style={[styles.detail, { color: colors.muted }]}>Choose a photo from your library</Text></View>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Make it cute" disabled={busy} onPress={() => { if (choice?.kind === 'photo') { setDraft(choice.uri); setGenerated(null); } else void change({ kind: 'cute', character: cuteCharacter }); }}
              style={({ pressed }) => [styles.option, { backgroundColor: colors.soft, borderColor: colors.border }, pressed && styles.pressed]}>
              <WandSparkles size={24} color="#F4656F" /><View style={styles.copy}><Text style={[styles.label, { color: colors.ink }]}>Make it cute</Text><Text style={[styles.detail, { color: colors.muted }]}>Your character, a little cuter</Text></View>
              <View style={styles.preview}><CuteAvatar character={cuteCharacter} active={active} /></View>
            </Pressable>
            {choice && <Pressable accessibilityRole="button" disabled={busy} onPress={() => void change(null)} style={styles.reset}><RotateCcw size={16} color={colors.muted} /><Text style={{ color: colors.muted }}>Restore original</Text></Pressable>}
            </>}
            {busy && <View style={styles.progress}><ActivityIndicator accessibilityLabel={draft ? 'Preparing your character' : 'Saving avatar'} color="#F4656F" />{draft && <Text accessibilityLiveRegion="polite" style={[styles.detail, { color: colors.muted }]}>Creating your avatar. Keep this screen open.</Text>}</View>}
            {!!(error || loadError) && <Text accessibilityRole="alert" style={styles.error}>{error || loadError}</Text>}
          </ScrollView>
        </View>
      </View>
    </Modal>}
  </>;
}

const styles = StyleSheet.create({
  trigger: { width: '100%', height: '100%' },
  photo: { width: '100%', height: '100%', resizeMode: 'cover' },
  pressed: { opacity: 0.65 }, dimmed: { opacity: 0.5 },
  editBadge: { position: 'absolute', bottom: 3, right: 7, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderCurve: 'continuous', paddingHorizontal: 20, paddingTop: 8 },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { flex: 1, fontSize: 24, fontWeight: '800' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: { gap: 16, paddingBottom: 12 },
  scroll: { flexGrow: 0, flexShrink: 1 },
  description: { fontSize: 15, lineHeight: 22 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, borderWidth: 1, borderRadius: 16, borderCurve: 'continuous' },
  copy: { flex: 1, gap: 4 }, label: { fontSize: 16, fontWeight: '700' }, detail: { fontSize: 13, lineHeight: 18 },
  preview: { width: 64, height: 64 },
  photoPreview: { width: 160, height: 160, alignSelf: 'center', borderRadius: 24, borderCurve: 'continuous', overflow: 'hidden' },
  posePreviews: { flexDirection: 'row', gap: 8, height: 116 },
  posePreview: { flex: 1, paddingBottom: 20 }, poseLabel: { position: 'absolute', bottom: 0, alignSelf: 'center', fontSize: 11, fontWeight: '600' },
  primary: { minHeight: 52, padding: 16, borderRadius: 16, borderCurve: 'continuous', backgroundColor: '#F4656F', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12 },
  primaryLabel: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', flexShrink: 1 },
  progress: { alignItems: 'center', gap: 8 },
  reset: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  error: { color: '#F4656F', fontSize: 14, lineHeight: 20 },
});
