import React, { useEffect, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarDays, Camera, Check, ChevronRight, Dumbbell, Footprints, Heart, Gauge, History, House, Link2, Moon, Play, Route, Timer, UserPlus, type LucideIcon } from 'lucide-react-native';
import { useAuth } from '@/src/auth/authContext';
import { usePoints } from '@/hooks/usePoints';
import { useWorkoutOverview, type OverviewSession, type WorkoutParticipant } from '@/hooks/useWorkoutOverview';
import { useWorkoutPhotos, type WorkoutPhoto, type WorkoutPhotosController } from '@/hooks/useWorkoutPhotos';
import WorkoutPhotoCapture from '@/components/home/WorkoutPhotoCapture';
import WorkoutPhotoStack from '@/components/home/WorkoutPhotoStack';
import { WorkoutFlow } from '@/components/plan/WorkoutFlow';
import { findPartnerWorkout } from '@/components/plan/partnerWorkoutDefinitions';
import { usePlanColors } from '@/components/plan/PlanVisuals';
import { getRunMeta } from '@/constants/runDetails';
import { getIntervalWorkoutRouteFromTemplateId } from '@/lib/interval-workout';
import { getOppositeGender, normalizeGender } from '@/utils/genderMascot';

const COACHES = {
  male: { strength: require('../assets/plan/coaches/male-strength-v2.png'), walk: require('../assets/plan/coaches/male-walk-v2.png') },
  female: { strength: require('../assets/plan/coaches/female-strength-v2.png'), walk: require('../assets/plan/coaches/female-walk-v2.png') },
};
const SUCCESS = '#34C759';

function sessionName(session: OverviewSession) {
  if (session.activity === 'WORKOUT') return session.workoutPreference === 'gym' ? 'Gym Workout'
    : findPartnerWorkout(session.workoutId)?.name ?? (session.workoutPreference === 'home' ? 'Home Workout' : 'Strength Workout');
  return session.runType || (session.activity === 'WALK' ? 'Walk' : 'Run');
}

const sessionIcon = (session?: OverviewSession | null): LucideIcon => !session ? Moon
  : session.activity === 'WALK' ? Footprints : session.activity === 'RUN' ? Route : session.workoutPreference === 'gym' ? Dumbbell : House;

const addDays = (dayKey: string, days: number) => {
  const date = new Date(`${dayKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
const weekday = (dayKey: string) => new Date(`${dayKey}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' });
function PhotoThumb({ photo, controller }: { photo: WorkoutPhoto; controller: WorkoutPhotosController }) {
  const [uri, setUri] = useState<string | null>(null);
  const getImageUri = controller.getImageUri;
  useEffect(() => {
    let cancelled = false;
    setUri(null);
    void getImageUri(photo, 'selfie').then(value => { if (!cancelled) setUri(value); }).catch(() => {});
    return () => { cancelled = true; };
  }, [photo, getImageUri]);
  return uri ? <ExpoImage source={{ uri }} cachePolicy="none" contentFit="cover" style={StyleSheet.absoluteFill} />
    : <Camera size={18} color="#FF6069" strokeWidth={1.8} />;
}

const ratio = (person?: WorkoutParticipant | null) => person?.weeklyTarget ? Math.min(1, person.weeklyCount / person.weeklyTarget) : 0;

export default function WorkoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ participant?: string }>();
  const { user, accessToken } = useAuth();
  const c = usePlanColors();
  const insets = useSafeAreaInsets();
  const overview = useWorkoutOverview();
  const points = usePoints({ accessToken });
  const photos = useWorkoutPhotos(overview.data?.partnerId ?? user?.partnerId ?? null);
  const [capture, setCapture] = useState(false);
  const [lesson, setLesson] = useState<{ session: OverviewSession; saveCompletion: typeof overview.saveCompletion } | null>(null);
  useEffect(() => { setLesson(null); setCapture(false); }, [user?.id]);
  const partnerView = params.participant === 'partner';
  const data = overview.data;
  const participant = partnerView ? data?.partner : data?.mine;
  const session = participant?.todaySession;
  const guided = session?.activity === 'WORKOUT' && session.workoutPreference !== 'gym';
  const gym = session?.workoutPreference === 'gym';
  const walking = session?.activity === 'WALK';
  const gender = normalizeGender(partnerView ? getOppositeGender(user?.gender) : user?.gender) || 'male';
  const refresh = () => { void overview.refresh(); void photos.refresh(); void points.refetch(); };
  const openSchedule = (who: 'you' | 'partner' = partnerView ? 'partner' : 'you', dayKey?: string, week?: number) => {
    const person = who === 'partner' ? data?.partner : data?.mine;
    router.push({ pathname: '/workout-schedule', params: { participant: who, dayKey: dayKey ?? person?.today, weekNumber: week ? String(week) : undefined } });
  };
  const startRun = () => {
    if (!session || session.activity === 'WORKOUT' || partnerView || participant?.todayCompleted) return;
    const meta = getRunMeta(session.runType || (walking ? 'Walk' : 'Easy Run'));
    router.push({ pathname: meta.launchMode === 'interval' ? getIntervalWorkoutRouteFromTemplateId(meta.templateId) : '/runs/runscreen',
      params: { source: 'plan', sessionId: session.sessionId || '', templateId: meta.templateId, runType: session.runType || (walking ? 'Walk' : 'Easy Run'),
        distanceKm: String(session.distanceKm), weekContext: `Week ${session.week}` } });
  };

  const player = (person: WorkoutParticipant | null | undefined, own: boolean) => {
    const name = own ? 'You' : 'Partner';
    const images = photos.photos.filter(photo => photo.authorUserId === (own ? user?.id : data?.partnerId));
    const hasTarget = !!person?.hasPlan && person.weeklyTarget > 0;
    return <View style={s.player}>
      <View style={{ width: '100%', alignItems: 'center' }}>
        {images.length ? <WorkoutPhotoStack controller={photos} photos={images} own={own} name={name} comparison />
          : <Pressable accessibilityRole={own ? 'button' : undefined} accessibilityLabel={own ? 'Add your workout photo' : 'Partner has not added a photo'}
            disabled={!own} onPress={() => setCapture(true)} style={({ pressed }) => [s.photo, { backgroundColor: c.soft, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
            <Camera size={30} color={c.accent} strokeWidth={1.8} /><Text style={[s.photoLabel, { color: c.sub }]}>{own ? 'Add your photo' : 'No photo yet'}</Text>
          </Pressable>}
        <View style={[s.namePill, { backgroundColor: c.accent, borderColor: c.card }]}><Text style={s.nameText}>{name}</Text></View>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`${name}: ${person?.weeklyCount ?? 0} of ${person?.weeklyTarget ?? 0} workouts this week`}
        onPress={() => openSchedule(own ? 'you' : 'partner')} style={s.stat}>
        <Text style={[s.count, { color: c.text }]}>{hasTarget ? person!.weeklyCount : '—'}<Text style={[s.countGoal, { color: c.sub }]}>{hasTarget ? ` / ${person!.weeklyTarget}` : ''}</Text></Text>
        <Text style={[s.caption, { color: c.sub }]}>{person?.hasPlan ? 'workouts this week' : 'No plan yet'}</Text>
        <View style={[s.track, { backgroundColor: c.soft }]}><View style={[s.fill, { backgroundColor: c.accent, width: `${ratio(person) * 100}%` }]} /></View>
      </Pressable>
    </View>;
  };

  const hero = () => {
    const done = !!participant?.todayCompleted;
    const log = () => setCapture(true);
    if (!participant?.hasPlan || participant.ended || !session) {
      const title = !participant?.hasPlan ? 'No plan yet' : participant.ended ? 'Plan complete' : 'Recovery day';
      const body = !participant?.hasPlan ? (partnerView ? 'Their sessions appear when their plan is ready.' : 'Set up a plan to get daily workouts.')
        : participant.ended ? 'There are no more scheduled sessions.' : 'Rest up and recover. Check your plan for what’s next.';
      return { title, meta: [] as { icon: LucideIcon; label: string }[], body, image: null, Icon: !participant?.hasPlan ? CalendarDays : participant.ended ? Check : Moon,
        primary: partnerView ? null : !participant?.hasPlan || participant.ended ? { label: 'View Plans', icon: CalendarDays, onPress: () => router.push('/Plans') } : { label: 'Log Workout', icon: Camera, onPress: log },
        secondary: null, done: false };
    }
    const definition = guided ? findPartnerWorkout(session.workoutId) : undefined;
    const runMeta = !guided && !gym ? getRunMeta(session.runType || (walking ? 'Walk' : 'Easy Run')) : null;
    const meta = guided ? [{ icon: Timer, label: definition?.prescription ?? 'Guided' }, { icon: Dumbbell, label: definition?.category ?? (session.workoutPreference === 'home' ? 'Home' : 'Strength') }]
      : gym ? [{ icon: Dumbbell, label: 'Gym' }, { icon: Camera, label: 'Photo log' }]
      : [...(session.distanceKm > 0 ? [{ icon: Route, label: `${session.distanceKm.toLocaleString()} km` }] : []), ...(runMeta ? [{ icon: Gauge, label: runMeta.details.intensity }] : [])];
    const primary = partnerView ? null
      : guided ? { label: 'Start Workout', icon: Play, onPress: () => setLesson({ session, saveCompletion: overview.saveCompletion }) }
      : gym || done ? { label: 'Log Workout', icon: Camera, onPress: log }
      : { label: walking ? 'Start Walk' : 'Start Run', icon: Play, onPress: startRun };
    const secondary = partnerView || gym ? null
      : done && !guided ? { label: 'View sessions', onPress: () => router.push({ pathname: '/activity', params: { tab: 'RUNNING' } }) }
      : { label: 'Log a photo instead', onPress: log };
    return { title: sessionName(session), meta, body: null, image: COACHES[gender][guided || gym ? 'strength' : 'walk'], Icon: Moon, primary, secondary, done };
  };

  const days = participant?.hasPlan ? Array.from({ length: 7 }, (_, index) => {
    const dayKey = addDays(participant.weekStart, index);
    return { dayKey, session: participant.scheduled.find(item => item.dayKey === dayKey) ?? null,
      done: participant.completedDays.includes(dayKey), today: dayKey === participant.today, past: dayKey < participant.today };
  }) : [];

  const previousWeek = () => {
    if (!participant) return null;
    const start = addDays(participant.weekStart, -7);
    const author = partnerView ? data?.partnerId : user?.id;
    const byDay = new Map<string, WorkoutPhoto>();
    for (const photo of photos.photos) {
      if (photo.authorUserId !== author || photo.dayKey < start || photo.dayKey >= participant.weekStart) continue;
      const kept = byDay.get(photo.dayKey);
      if (!kept || photo.capturedAt > kept.capturedAt) byDay.set(photo.dayKey, photo);
    }
    const format = (dayKey: string, options: Intl.DateTimeFormatOptions) => new Date(`${dayKey}T12:00:00Z`).toLocaleDateString(undefined, { ...options, timeZone: 'UTC' });
    const end = addDays(start, 6);
    const range = start.slice(5, 7) === end.slice(5, 7)
      ? `${format(start, { month: 'short', day: 'numeric' })} – ${format(end, { day: 'numeric' })}`
      : `${format(start, { month: 'short', day: 'numeric' })} – ${format(end, { month: 'short', day: 'numeric' })}`;
    return { range, photos: [...byDay.values()].sort((a, b) => a.dayKey.localeCompare(b.dayKey)) };
  };

  const h = data ? hero() : null;
  const prev = data ? previousWeek() : null;
  return <>
    <Stack.Screen options={{ title: 'Workout', headerShown: true, headerLargeTitle: false, headerTitleAlign: 'center', headerShadowVisible: false,
      headerStyle: { backgroundColor: c.bg }, headerTintColor: c.text,
      headerTitleStyle: { fontSize: 20, fontWeight: '800', color: c.text }, headerBackButtonDisplayMode: 'minimal',
      headerRight: () => <View accessibilityLabel={`${points.balance} points`} style={[s.points, { backgroundColor: c.soft }]}>
        <Heart size={15} color={c.accent} fill={c.accent} />
        <Text style={[s.pointsText, { color: c.accent }]}>
          {new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(points.balance)} <Text style={s.pointsUnit}>pts</Text>
        </Text>
      </View> }} />
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 28 }]}
      refreshControl={<RefreshControl refreshing={overview.loading && !!data} onRefresh={refresh} tintColor={c.accent} />}>
      {!data && overview.loading ? <View accessibilityLabel="Loading your workout plan" style={{ gap: 16 }}>{[250, 240, 150, 76].map((height, index) => <View key={index} style={[s.card, { height, backgroundColor: c.card }]}><View style={{ height: 22, width: '55%', backgroundColor: c.soft, borderRadius: 11 }} /></View>)}</View> : <>
        {!!overview.error && <View style={[s.card, { backgroundColor: c.card, gap: 12 }]}><Text style={[s.body, { color: c.text }]}>{overview.error}</Text>
          <Pressable accessibilityRole="button" onPress={refresh}><Text style={[s.link, { color: c.accent }]}>Try again</Text></Pressable></View>}
        {!!data && h && <>
          <View style={[s.card, s.comparison, { backgroundColor: c.card }]}>
            {player(data.mine, true)}
            <View style={s.linkColumn}>
              <View style={[s.dash, { borderColor: c.line }]} />
              <View style={[s.linkBadge, { backgroundColor: c.soft }]}><Link2 size={18} color={c.accent} strokeWidth={2.2} /></View>
              <View style={[s.dash, { borderColor: c.line }]} />
            </View>
            {data.partnerId ? player(data.partner, false) : <View style={s.player}>
              <Pressable accessibilityRole="button" onPress={() => router.push('/Partner')} style={({ pressed }) => [s.photo, s.invite, { borderColor: c.accent, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
                <UserPlus size={28} color={c.accent} strokeWidth={1.8} /><Text style={[s.photoLabel, { color: c.text }]}>Add a partner</Text>
              </Pressable>
              <Text style={[s.caption, { color: c.sub, marginTop: 8 }]}>Compare weekly workouts together</Text>
            </View>}
          </View>

          <View style={[s.card, s.heroCard, { backgroundColor: c.card }]}>
            <View pointerEvents="none" style={[s.blob, { backgroundColor: c.soft }]} />
            {h.image ? <Image source={h.image} resizeMode="contain" accessibilityIgnoresInvertColors style={s.coach} />
              : <View pointerEvents="none" style={s.heroIcon}><h.Icon size={64} color={c.accent} strokeWidth={1.4} /></View>}
            <View style={s.heroCopy}>
              <View style={s.row}>
                <CalendarDays size={18} color={c.accent} strokeWidth={2.2} />
                <Text accessibilityRole="header" style={[s.eyebrow, { color: c.text }]}>{partnerView ? 'Partner’s Workout' : 'Today’s Workout'}</Text>
              </View>
              {h.done && <View accessibilityLiveRegion="polite" style={[s.doneChip, { backgroundColor: c.soft }]}><Check size={13} color={SUCCESS} strokeWidth={3} /><Text style={[s.doneText, { color: c.text }]}>Completed</Text></View>}
              <Text numberOfLines={3} style={[s.heroTitle, { color: c.text }]}>{h.title}</Text>
              {h.meta.length > 0 && <View style={s.metaRow}>{h.meta.map(({ icon: Icon, label }) => <View key={label} style={s.metaItem}>
                <Icon size={15} color={c.accent} strokeWidth={2.2} /><Text numberOfLines={1} style={[s.meta, { color: c.sub }]}>{label}</Text>
              </View>)}</View>}
              {!!h.body && <Text style={[s.meta, { color: c.sub }]}>{h.body}</Text>}
            </View>
            {h.primary && <Pressable accessibilityRole="button" onPress={h.primary.onPress}
              style={({ pressed }) => [s.primary, { backgroundColor: c.accent, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
              <h.primary.icon size={20} color="#FFFFFF" strokeWidth={2.2} /><Text style={s.primaryText}>{h.primary.label}</Text>
            </Pressable>}
            {h.secondary && <Pressable accessibilityRole="button" onPress={h.secondary.onPress} hitSlop={8} style={s.secondary}>
              <Text style={[s.link, { color: c.sub }]}>{h.secondary.label}</Text>
            </Pressable>}
          </View>

          {days.length > 0 && <View style={[s.card, { backgroundColor: c.card, paddingHorizontal: 0 }]}>
            <View style={[s.row, { paddingHorizontal: 20 }]}>
              <Text accessibilityRole="header" style={[s.heading, { color: c.text, flex: 1 }]}>{partnerView ? 'Partner’s Plan' : 'Your Plan'}</Text>
              <Pressable accessibilityRole="button" onPress={() => openSchedule()} hitSlop={8} style={s.row}>
                <Text style={[s.link, { color: c.accent }]}>{session || participant?.nextSession ? `Week ${(session ?? participant!.nextSession!).week}` : 'Schedule'}</Text>
                <ChevronRight size={18} color={c.accent} strokeWidth={2.4} />
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.days}>
              {days.map(day => {
                const Icon = sessionIcon(day.session);
                const color = day.today ? '#FFFFFF' : day.session ? c.text : c.sub;
                return <Pressable key={day.dayKey} accessibilityRole="button"
                  accessibilityLabel={`${weekday(day.dayKey)}${day.today ? ', today' : ''}: ${day.session ? sessionName(day.session) : 'Rest'}${day.done ? ', completed' : ''}`}
                  onPress={() => openSchedule(partnerView ? 'partner' : 'you', day.dayKey, day.session?.week)}
                  style={({ pressed }) => [s.day, { backgroundColor: day.today ? c.accent : c.bg, opacity: pressed ? 0.7 : day.past && !day.done && !day.today ? 0.5 : 1 }]}>
                  <Text style={[s.dayLabel, { color: day.today ? '#FFFFFF' : c.sub }]}>{weekday(day.dayKey)}</Text>
                  <Text style={[s.dayNumber, { color }]}>{Number(day.dayKey.slice(8))}</Text>
                  {day.done ? <View style={[s.check, { backgroundColor: day.today ? '#FFFFFF' : SUCCESS }]}><Check size={12} color={day.today ? c.accent : '#FFFFFF'} strokeWidth={3.4} /></View>
                    : <Icon size={18} color={color} strokeWidth={day.session ? 2 : 1.6} />}
                </Pressable>;
              })}
            </ScrollView>
          </View>}

          {prev && <View style={[s.card, { backgroundColor: c.card, gap: 14 }]}>
            <View style={s.banner}>
              <View style={[s.bannerIcon, { backgroundColor: c.soft }]}><History size={20} color={c.accent} strokeWidth={2.2} /></View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text accessibilityRole="header" style={[s.bannerTitle, { color: c.text }]}>Previous week</Text>
                <Text style={[s.caption, { color: c.sub, textAlign: 'left' }]}>
                  {prev.range} • {prev.photos.length ? `${prev.photos.length} workout${prev.photos.length === 1 ? '' : 's'} logged` : 'No workout photos'}
                </Text>
              </View>
            </View>
            {prev.photos.length > 0 && <View style={s.thumbs}>
              {prev.photos.slice(0, 5).map((photo, index) => {
                const extra = index === 4 ? prev.photos.length - 5 : 0;
                return <Pressable key={photo.id} accessibilityRole="button" accessibilityLabel={`${weekday(photo.dayKey)} workout photo`}
                  onPress={() => openSchedule(partnerView ? 'partner' : 'you', photo.dayKey)} style={({ pressed }) => [s.thumbItem, { opacity: pressed ? 0.7 : 1 }]}>
                  <View style={[s.thumb, { backgroundColor: c.soft }]}>
                    <PhotoThumb photo={photo} controller={photos} />
                    {extra > 0 && <View style={s.thumbMore}><Text style={s.thumbMoreText}>+{extra}</Text></View>}
                  </View>
                  <Text style={[s.dayLabel, { color: c.sub }]}>{weekday(photo.dayKey)}</Text>
                </Pressable>;
              })}
            </View>}
          </View>}
        </>}
      </>}
    </ScrollView>
    {capture && <WorkoutPhotoCapture key={photos.scope} controller={photos} onClose={() => setCapture(false)} />}
    {lesson && !partnerView && <WorkoutFlow visible onClose={() => setLesson(null)} currentWeek={lesson.session.week} initialDetail workoutPreference={lesson.session.workoutPreference === 'home' ? 'home' : 'strength'} workoutId={lesson.session.workoutId} dayIndex={lesson.session.dayOfWeek} proofController={photos} saveCompletion={lesson.saveCompletion} />}
  </>;
}

const s = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 4, gap: 16 },
  card: { padding: 20, gap: 16, borderRadius: 28, borderCurve: 'continuous', boxShadow: '0 6px 24px rgba(80, 30, 40, 0.06)' },
  comparison: { flexDirection: 'row', alignItems: 'stretch', padding: 14, gap: 8 },
  player: { flex: 1, minWidth: 0, alignItems: 'center' },
  photo: { width: '100%', height: 118, borderRadius: 20, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', padding: 12, gap: 8 },
  invite: { borderWidth: 1.5, borderStyle: 'dashed' },
  photoLabel: { fontSize: 13, lineHeight: 18, textAlign: 'center', fontWeight: '500' },
  namePill: { marginTop: -15, borderWidth: 3, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 22 },
  nameText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  stat: { width: '100%', alignItems: 'center', gap: 2, paddingTop: 10, paddingHorizontal: 4 },
  count: { fontSize: 28, lineHeight: 34, fontWeight: '800', letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
  countGoal: { fontSize: 18, fontWeight: '700' },
  caption: { fontSize: 12, lineHeight: 16, textAlign: 'center' },
  track: { height: 6, width: '100%', overflow: 'hidden', borderRadius: 999, marginTop: 8 },
  fill: { height: '100%', borderRadius: 999 },
  linkColumn: { width: 40, alignItems: 'center', paddingVertical: 6 },
  dash: { flex: 1, width: 0, borderLeftWidth: 1, borderStyle: 'dashed' },
  linkBadge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginVertical: 6 },
  heroCard: { overflow: 'hidden', paddingTop: 22, gap: 18 },
  blob: { position: 'absolute', width: 230, height: 230, borderRadius: 115, right: -70, top: 40 },
  coach: { position: 'absolute', right: 0, top: 18, width: 150, height: 200 },
  heroIcon: { position: 'absolute', right: 34, top: 82 },
  heroCopy: { width: '62%', gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyebrow: { fontSize: 15, fontWeight: '700' },
  heroTitle: { fontSize: 30, lineHeight: 35, fontWeight: '800', letterSpacing: -0.8 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 6 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '100%' },
  meta: { fontSize: 14, lineHeight: 20, fontWeight: '500', flexShrink: 1 },
  doneChip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  doneText: { fontSize: 12, fontWeight: '700' },
  primary: { alignSelf: 'flex-start', minWidth: '62%', minHeight: 54, paddingHorizontal: 24, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    boxShadow: '0 8px 18px rgba(255, 96, 105, 0.3)' },
  primaryText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  secondary: { alignSelf: 'flex-start', marginTop: -6, paddingHorizontal: 4, minHeight: 32, justifyContent: 'center' },
  link: { fontSize: 15, fontWeight: '700' },
  heading: { fontSize: 22, lineHeight: 28, fontWeight: '800', letterSpacing: -0.5 },
  body: { fontSize: 15, lineHeight: 22 },
  days: { paddingHorizontal: 20, gap: 10 },
  day: { width: 62, height: 92, borderRadius: 20, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', gap: 4 },
  dayLabel: { fontSize: 12, fontWeight: '600' },
  dayNumber: { fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'], marginBottom: 2 },
  check: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  thumbs: { flexDirection: 'row', gap: 10 },
  thumbItem: { alignItems: 'center', gap: 6 },
  thumb: { width: 54, height: 54, borderRadius: 14, borderCurve: 'continuous', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  thumbMore: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.45)', alignItems: 'center', justifyContent: 'center' },
  thumbMoreText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  bannerIcon: { width: 44, height: 44, borderRadius: 14, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  bannerTitle: { fontSize: 16, fontWeight: '700' },
  points: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 16, borderCurve: 'continuous' },
  pointsText: { fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
  pointsUnit: { fontSize: 10, fontWeight: '600' },
});
