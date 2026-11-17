import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import * as ImageManipulator from 'expo-image-manipulator';
import { useAuth } from '@/src/auth/authContext';
import { API_BASE_URL } from '@/config/api';
import { activateWorkoutPhotoCache, cachedWorkoutPhoto, clearWorkoutPhotoCache, purgeExpiredWorkoutPhotoCache } from '@/utils/workoutPhotoCache';
import { getAccessToken } from '@/utils/authstorage';
import { notifyWorkoutOverview } from '@/lib/workout-events';

export type WorkoutPhoto = { id: string; authorUserId: string; dayKey: string; capturedAt: string; expiresAt: string };
export type PhotoDraft = { clientId: string; capturedAt: string; timezone: string; selfie: string; surroundings: string };
type Progress = { weeklyCount: number; streak: number; todayCompleted: boolean; completedDays?: string[] };
const empty: Progress = { weeklyCount: 0, streak: 0, todayCompleted: false };
type Feed = { photos: WorkoutPhoto[]; nextCursor: string | null; partnerId: string | null; mine: Progress; partner: Progress };

export function useWorkoutPhotos(partnerIdentity: string | null) {
  const { user, authFetch } = useAuth();
  const scope = `${user?.id ?? 'none'}:${partnerIdentity ?? 'solo'}`;
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const [feed, setFeed] = useState<Feed>({ photos: [], nextCursor: null, partnerId: null, mine: empty, partner: empty });
  const [draft, setDraft] = useState<PhotoDraft | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const busy = useRef(false);
  const request = useRef(0);
  const [loadedScope, setLoadedScope] = useState(scope);
  const [dayTick, setDayTick] = useState(0);
  const [cacheScope, setCacheScope] = useState('');
  const [expiryTick, setExpiryTick] = useState(0);
  const directory = `${FileSystem.documentDirectory}workout-drafts/${encodeURIComponent(scope)}/`;
  const refresh = useCallback(async (cursor?: string) => {
    if (!user?.id) return;
    const serial = ++request.current;
    setLoading(true);
    try {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const response = await authFetch(`${API_BASE_URL}/workout-photos?timezone=${encodeURIComponent(zone)}${cursor ? `&cursor=${cursor}` : ''}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.message || 'Could not load workout photos.');
      if (currentScope.current !== scope || serial !== request.current) return;
      const authorizedScope = `${user.id}:${data.partnerId ?? 'solo'}`;
      await activateWorkoutPhotoCache(authorizedScope);
      if (currentScope.current !== scope || serial !== request.current) return;
      setCacheScope(authorizedScope);
      setLoadedScope(scope);
      setFeed(previous => ({ ...data, photos: cursor
        ? [...previous.photos, ...data.photos.filter((photo: WorkoutPhoto) => !previous.photos.some(old => old.id === photo.id))]
        : data.photos }));
      setError('');
    } catch (e) { if (currentScope.current === scope && serial === request.current) setError(e instanceof Error ? e.message : 'Could not load photos.'); }
    finally { if (currentScope.current === scope && serial === request.current) setLoading(false); }
  }, [authFetch, scope, user?.id]);

  useEffect(() => {
    setCacheScope('');
    void (user?.id ? activateWorkoutPhotoCache(scope) : clearWorkoutPhotoCache()).catch(() => {});
    setFeed({ photos: [], nextCursor: null, partnerId: null, mine: empty, partner: empty });
    setDraft(null);
    setError('');
    setLoading(false);
    setUploading(false);
    setLoadedScope(scope);
    void FileSystem.readAsStringAsync(`${directory}draft.json`).then(text => {
      const saved = JSON.parse(text) as PhotoDraft;
      if (new Date(saved.capturedAt).getTime() + 30 * 86400000 <= Date.now()) {
        void FileSystem.deleteAsync(directory, { idempotent: true }).catch(() => {});
      } else if (currentScope.current === scope) setDraft(saved);
    }).catch(() => {});
  }, [directory, scope, user?.id]);
  useEffect(() => {
    const timer = setInterval(() => {
      setExpiryTick(value => value + 1);
      void purgeExpiredWorkoutPhotoCache().catch(() => {});
    }, 60000);
    return () => clearInterval(timer);
  }, []);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timer = setTimeout(() => { void refresh(); setDayTick(value => value + 1); }, midnight.getTime() - now.getTime() + 100);
    return () => { listener.remove(); clearTimeout(timer); };
  }, [refresh, dayTick]);

  const saveDraft = async (selfie: string, surroundings: string, capturedAt: string) => {
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    const clientId = Crypto.randomUUID();
    const saved: PhotoDraft = { clientId, capturedAt, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      selfie: `${directory}${clientId}-selfie.jpg`, surroundings: `${directory}${clientId}-surroundings.jpg` };
    try {
      for (const [source, destination] of [[selfie, saved.selfie], [surroundings, saved.surroundings]]) {
        const image = await ImageManipulator.manipulateAsync(source, [{ resize: { width: 800 } }], { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG });
        await FileSystem.copyAsync({ from: image.uri, to: destination });
        await FileSystem.deleteAsync(image.uri, { idempotent: true }).catch(() => {});
      }
      await FileSystem.writeAsStringAsync(`${directory}draft.json`, JSON.stringify(saved));
    } catch (error) {
      await Promise.all([saved.selfie, saved.surroundings].map(uri => FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {})));
      throw error;
    }
    if (currentScope.current === scope) setDraft(saved);
    return saved;
  };
  const discardDraft = async () => {
    await FileSystem.deleteAsync(directory, { idempotent: true });
    if (currentScope.current === scope) setDraft(null);
  };
  const upload = async (value: PhotoDraft) => {
    if (busy.current) return false;
    busy.current = true;
    setUploading(true);
    setError('');
    try {
      const form = new FormData();
      for (const kind of ['selfie', 'surroundings'] as const) {
        form.append(kind, { uri: value[kind], name: `${kind}.jpg`, type: 'image/jpeg' } as unknown as Blob);
      }
      form.append('clientId', value.clientId);
      form.append('capturedAt', value.capturedAt);
      form.append('timezone', value.timezone);
      const response = await authFetch(`${API_BASE_URL}/workout-photos`, { method: 'POST', body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.message || 'Could not save photos. Your draft is ready to retry.');
      // Only a successful server response completes the day.
      if (currentScope.current === scope) {
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        setFeed(previous => ({ ...previous, photos: [data.photo, ...previous.photos.filter(photo => photo.id !== data.photo.id)],
          mine: data.photo.dayKey === today && !previous.mine.todayCompleted
            ? { todayCompleted: true, weeklyCount: previous.mine.weeklyCount + 1, streak: previous.mine.streak + 1,
                completedDays: [...new Set([...(previous.mine.completedDays ?? []), today])].sort() }
            : previous.mine }));
        // A cleanup failure must not turn a confirmed upload into a failed check-in.
        notifyWorkoutOverview();
        await discardDraft().catch(() => { setDraft(null); });
        await refresh();
      }
      return true;
    } catch (e) { if (currentScope.current === scope) setError(e instanceof Error ? e.message : 'Upload failed. Retry your saved draft.'); return false; }
    finally { busy.current = false; if (currentScope.current === scope) setUploading(false); }
  };
  const getImageUri = useCallback((photo: WorkoutPhoto, kind: 'selfie' | 'surroundings', full = false) => {
    const endpoint = `${API_BASE_URL}/workout-photos/${photo.id}/${kind}?size=${full ? 'full' : 'thumb'}`;
    return cachedWorkoutPhoto(cacheScope, photo.id, `${kind}-${full ? 'full' : 'thumb'}`, photo.expiresAt, async () => {
      const response = await authFetch(`${endpoint}&delivery=url`);
      const data = await response.json();
      if (!response.ok) throw new Error('Photo expired or unavailable');
      // Credentials are never sent to the bucket. Only the signed URL grants access.
      if (data.url) return { url: data.url as string };
      const token = await getAccessToken();
      return { url: endpoint, headers: { Authorization: `Bearer ${token}` } };
    });
  }, [authFetch, cacheScope]);
  const visibleFeed = loadedScope === scope ? feed : { photos: [], nextCursor: null, partnerId: null, mine: empty, partner: empty };
  // The tick removes expired cards even if the screen stays open overnight.
  void expiryTick;
  const visiblePhotos = visibleFeed.photos.filter(photo => new Date(photo.expiresAt).getTime() > Date.now());
  return { ...visibleFeed, photos: visiblePhotos, draft: loadedScope === scope ? draft : null, error, loading, uploading, refresh, saveDraft, discardDraft, upload, getImageUri, scope: `${scope}:${cacheScope}` };
}
export type WorkoutPhotosController = ReturnType<typeof useWorkoutPhotos>;
