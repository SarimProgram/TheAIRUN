import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, AppState, FlatList, Modal, Pressable, ScrollView, Share, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Clock3, Dumbbell, Flame, Grid2X2, Heart, Maximize, Pause, Play, Search, Share2, SlidersHorizontal, Trophy, Users, X, Zap } from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';
import { useAuth } from '../../src/auth/authContext';
import { formatClock, type MobilityExercise } from './GuidedMobility';
import { getRecommendedWorkout, getWorkoutPlan, makeWorkoutCatalog, matchesWorkoutSearch, type Workout } from './workoutCatalog';
import { ArtPlaceholder, IconButton, ui, usePlanColors } from './PlanVisuals';
import { PartnerSquatArt, PartnerSquatSequence } from './PartnerSquatArt';
import { type PartnerSquatMode } from './partnerSquatMotion';
import { getPartnerWorkoutMotion } from './partnerWorkoutMotion';
import { findPartnerWorkout } from './partnerWorkoutDefinitions';
import WorkoutPhotoCapture from '../home/WorkoutPhotoCapture';
import type { WorkoutPhotosController } from '../../hooks/useWorkoutPhotos';

type Props = { visible: boolean; onClose: () => void; currentWeek: number; onComplete?: () => void; initialDetail?: boolean; workoutPreference?: 'home' | 'strength'; workoutId?: string; dayIndex?: number; proofController?: WorkoutPhotosController; saveCompletion?: (workout: Workout, startedAt: Date) => Promise<void> };
const categories = [{ name: 'All', Icon: Grid2X2 }, { name: 'Strength', Icon: Dumbbell }, { name: 'Cardio', Icon: Flame }, { name: 'HIIT', Icon: Zap }, { name: 'Fun', Icon: Trophy }];

export function WorkoutFlow({ visible, onClose, currentWeek, onComplete, initialDetail = false, workoutPreference, workoutId, dayIndex = 0, proofController, saveCompletion }: Props) {
  const c = usePlanColors();
  const { user } = useAuth();
  const weeklyWorkout = useMemo(() => getRecommendedWorkout(workoutPreference, currentWeek, workoutId, dayIndex), [workoutPreference, currentWeek, workoutId, dayIndex]);
  const catalog = useMemo(() => makeWorkoutCatalog(), []);
  const [selected, setSelected] = useState<Workout | null>(null);
  const [playing, setPlaying] = useState(false);
  const [proofOpen, setProofOpen] = useState(false);
  const [finished, setFinished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const sessionStart = useRef(new Date());
  const saveSession = useRef(saveCompletion);
  const wasPlaying = useRef(false);
  useEffect(() => {
    if (playing && !wasPlaying.current) { sessionStart.current = new Date(); saveSession.current = saveCompletion; }
    wasPlaying.current = playing;
  }, [playing, saveCompletion]);
  const finishSession = async () => {
    if (!selected || saving) return;
    setPlaying(false); setFinished(true); setSaving(true); setSaveError('');
    try { await saveSession.current?.(selected, sessionStart.current); onComplete?.(); }
    catch (error) { setSaveError(error instanceof Error ? error.message : 'Could not save workout. Try again.'); }
    finally { setSaving(false); }
  };
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [category, setCategory] = useState('All');
  const [audience, setAudience] = useState('All');
  const [homeOnly, setHomeOnly] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  const [filters, setFilters] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoritesReady, setFavoritesReady] = useState(false);
  const [tab, setTab] = useState('Exercises');
  const [exercisePreview, setExercisePreview] = useState<MobilityExercise | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduceMotion(value); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { active = false; subscription.remove(); };
  }, []);
  const libraryRef = useRef<FlatList<Workout>>(null);
  const searchRef = useRef<TextInput>(null);
  const favoriteKey = `plan_workout_favorites_v1:${user?.id || 'guest'}`;
  useEffect(() => {
    let active = true; setFavoritesReady(false); setFavorites([]);
    AsyncStorage.getItem(favoriteKey).then(value => { if (active) { const parsed = value ? JSON.parse(value) : []; setFavorites(Array.isArray(parsed) ? parsed.filter(v => typeof v === 'string') : []); } }).catch(() => {}).finally(() => { if (active) setFavoritesReady(true); });
    return () => { active = false; };
  }, [favoriteKey]);
  const wasVisible = useRef(false);
  useEffect(() => {
    if (visible && !wasVisible.current) { setSelected(initialDetail ? weeklyWorkout : null); setPlaying(false); setFinished(false); setSaveError(''); setTab('Exercises'); }
    wasVisible.current = visible;
  }, [visible, initialDetail, weeklyWorkout]);
  const toggleFavorite = (id: string) => {
    if (!favoritesReady) return;
    const next = favorites.includes(id) ? favorites.filter(key => key !== id) : [...favorites, id];
    setFavorites(next);
    AsyncStorage.setItem(favoriteKey, JSON.stringify(next)).catch(() => Alert.alert('Couldn’t save favorites', 'Your selection may not be kept after closing the app.'));
  };
  const leave = () => {
    if (saving) return;
    if (saveError) { Alert.alert('Workout not saved', 'Try saving again before leaving, or leave without recording this session.', [{ text: 'Stay', style: 'cancel' }, { text: 'Leave', style: 'destructive', onPress: onClose }]); return; }
    if (playing) { Alert.alert('Leave workout?', 'Your current timer will stop. This session will not be marked complete.', [{ text: 'Keep going', style: 'cancel' }, { text: 'Leave workout', style: 'destructive', onPress: () => setPlaying(false) }]); return; }
    if (filters) { setFilters(false); return; }
    if (finished) { setFinished(false); setSelected(null); return; }
    if (selected && !initialDetail) { setSelected(null); return; }
    onClose();
  };
  const browsing = !query.trim() && category === 'All' && audience === 'All' && !homeOnly && !savedOnly;
  const clearSearch = () => setQuery('');
  const filtered = catalog.filter(workout => (category === 'All' || workout.category === category) && (audience === 'All' || workout.people === (audience === 'Solo' ? 1 : 2)) && (!homeOnly || workout.exercises.every(exercise => exercise.homeBased)) && (!savedOnly || favorites.includes(workout.id)) && matchesWorkoutSearch(workout, query));
  const openWorkout = (workout: Workout) => { setSelected(workout); setTab('Exercises'); };
  const favoriteButton = (workout: Workout) => <Pressable disabled={!favoritesReady} accessibilityRole="button" accessibilityLabel={`${favorites.includes(workout.id) ? 'Unsave' : 'Save'} ${workout.title}`} accessibilityState={{ selected: favorites.includes(workout.id) }} onPress={() => toggleFavorite(workout.id)} style={ui.iconButton}><Heart size={23} color={favorites.includes(workout.id) ? c.accent : c.sub} fill={favorites.includes(workout.id) ? c.accent : 'transparent'} /></Pressable>;
  const plan = selected ? getWorkoutPlan(selected, currentWeek) : null;
  return <Modal visible={visible} animationType={reduceMotion ? 'none' : 'slide'} presentationStyle="fullScreen" onRequestClose={leave}>
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      {playing && selected ? <WorkoutPlayer workout={selected} week={currentWeek} onBack={leave} onComplete={() => { void finishSession(); }} /> : finished ? <View style={s.finish}>
        <View style={[s.finishIcon, { backgroundColor: c.soft }]}><Check size={48} color={c.accent} /></View><Text style={[ui.title, { color: c.text }]}>Workout complete</Text><Text accessibilityLiveRegion="polite" style={[ui.body, { color: c.sub, textAlign: 'center' }]}>{saving ? 'Saving your workout…' : saveError || 'You showed up. Keep that momentum going.'}</Text><Pressable disabled={saving} accessibilityRole="button" onPress={saveError ? () => { void finishSession(); } : onClose} style={[ui.primary, { backgroundColor: c.accent, alignSelf: 'stretch', opacity: saving ? 0.5 : 1 }]}><Text style={ui.primaryText}>{saveError ? 'Try saving again' : 'Done'}</Text></Pressable>
      </View> : selected && plan ? <ScrollView key={selected.id} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.nav}><IconButton icon={ArrowLeft} label="Back" onPress={leave} /><View style={{ flex: 1 }} />{favoriteButton(selected)}<IconButton icon={Share2} label="Share workout" onPress={() => { Share.share({ message: `${selected.title} · ${plan.totalMinutes} min\n${selected.subtitle}` }).catch(() => {}); }} /></View>
        <WorkoutArt partner={!!selected.couple} exerciseId={selected.id} animate={!exercisePreview} label={`${selected.people === 2 ? 'Partner' : 'Solo'} workout hero`} style={{ height: 200 }} />
        <View style={{ gap: 8 }}><View style={[ui.row, { alignSelf: 'flex-start', backgroundColor: c.soft, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }]}><Users size={16} color={c.accent} /><Text style={{ color: c.accent, fontWeight: '700' }}>{selected.people === 2 ? 'Couple Workout' : 'Solo Workout'}</Text></View><Text style={[ui.title, { color: c.text }]}>{selected.title}</Text><Text style={[ui.body, { color: c.sub }]}>{selected.subtitle}</Text></View>
        {selected.couple && <View style={{ gap: 6 }}><Text style={[ui.heading, { color: c.text }]}>{findPartnerWorkout(selected.id)?.prescription}</Text><Text style={[ui.body, { color: c.sub }]}>Targets: {findPartnerWorkout(selected.id)?.targets.join(', ')}</Text></View>}
        <WorkoutStats minutes={plan.totalMinutes} people={selected.people} />
        {selected.id === 'couple-dance-cardio' && <View accessibilityRole="tablist" style={[s.segment, { backgroundColor: c.line }]}>{([5, 10] as const).map(minutes => <Pressable key={minutes} accessibilityRole="tab" accessibilityState={{ selected: (selected.durationMinutes ?? 5) === minutes }} onPress={() => setSelected({ ...selected, durationMinutes: minutes })} style={[s.segmentItem, { backgroundColor: (selected.durationMinutes ?? 5) === minutes ? c.card : 'transparent' }]}><Text style={{ color: (selected.durationMinutes ?? 5) === minutes ? c.accent : c.sub, fontWeight: '700' }}>{minutes} minutes</Text></Pressable>)}</View>}
        <Pressable accessibilityRole="button" onPress={() => setPlaying(true)} style={[ui.primary, { backgroundColor: c.accent }]}><Play color="#FFF" fill="#FFF" size={21} /><Text style={ui.primaryText}>Start Workout</Text></Pressable>
        {workoutPreference && <>
          <Text style={[ui.body, { color: c.sub }]}>This is a recommendation. You can change your workout or do your own.</Text>
          <Pressable accessibilityRole="button" onPress={() => setSelected(null)} style={[ui.primary, { backgroundColor: c.card }]}><Text style={{ color: c.accent, fontSize: 17, fontWeight: '600' }}>Choose another workout</Text></Pressable>
          {proofController && <Pressable accessibilityRole="button" onPress={() => setProofOpen(true)} style={[ui.primary, { backgroundColor: c.card }]}><Text style={{ color: c.accent, fontSize: 17, fontWeight: '600' }}>Did your own? Add photo proof</Text></Pressable>}
        </>}
        <View accessibilityRole="tablist" style={[s.segment, { backgroundColor: c.line }]}>{['Exercises', 'Overview', 'Tips'].map(label => <Pressable key={label} accessibilityRole="tab" accessibilityState={{ selected: tab === label }} onPress={() => setTab(label)} style={[s.segmentItem, { backgroundColor: tab === label ? c.card : 'transparent' }]}><Text style={{ color: tab === label ? c.accent : c.sub, fontWeight: '700' }}>{label}</Text></Pressable>)}</View>
        {tab === 'Exercises' ? <View style={{ gap: 10 }}><Text style={[ui.heading, { color: c.text }]}>Workout Plan <Text style={{ color: c.sub, fontWeight: '500', fontSize: 15 }}>({plan.workoutExercises.length} exercises)</Text></Text><Text style={[ui.meta, { color: c.sub }]}>{plan.warmupMinutes} min warm-up · {plan.cooldownMinutes} min cool-down included</Text>{plan.workoutExercises.map(block => <Pressable key={block.exercise.id} accessibilityRole="button" accessibilityLabel={`View ${block.exercise.name} instructions`} onPress={() => setExercisePreview(block.exercise)} style={[s.exercise, { backgroundColor: c.card }]}><WorkoutArt partner={!!findPartnerWorkout(block.exercise.imagePlaceholder)} exerciseId={block.exercise.imagePlaceholder} compact label={block.exercise.name} style={{ width: 92, height: 64, borderRadius: 20 }} /><View style={{ flex: 1, gap: 6 }}><Text style={{ color: c.text, fontWeight: '800', fontSize: 15 }}>{block.exercise.name}</Text><View style={ui.row}><Clock3 size={14} color={c.sub} /><Text style={[ui.meta, { color: c.sub, flex: 1 }]}>{block.targetLabel}</Text></View></View><View style={{ padding: 8 }}><Play size={18} color={c.accent} fill={c.accent} /></View></Pressable>)}</View> : <View style={[ui.card, { backgroundColor: c.card, gap: 12 }]}><Text style={[ui.heading, { color: c.text }]}>{tab === 'Overview' ? 'Your session, at a glance' : 'Make every movement count'}</Text>{(tab === 'Overview' ? [`${plan.totalMinutes} minutes, including warm-up and cool-down.`, selected.people === 2 ? 'Train side by side. Each partner works at their own pace.' : `Week ${currentWeek}: your existing exercise progression is included.`, selected.couple ? 'Follow the targets above. The demonstration is a pacing guide; pause for extra time or rest.' : 'Follow the guided timer through every set.'] : ['Start gently and keep movements controlled.', 'Pause whenever you need a break.', 'Stop if a movement causes pain.', ...(selected.people === 2 ? ['Make space for both partners and agree on the pace.'] : [])]).map(text => <Text key={text} style={[ui.body, { color: c.sub }]}>{text}</Text>)}</View>}
      </ScrollView> : <FlatList ref={libraryRef} data={filtered} keyExtractor={item => item.id} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
        ListHeaderComponent={<View style={{ gap: 20 }}>
          <View style={s.nav}><IconButton icon={ArrowLeft} label="Back to Plans" onPress={leave} /></View>
          <Text style={[ui.title, { color: c.text }]}>Your Workouts</Text>
          <View style={ui.row}><View style={[s.search, { backgroundColor: c.card, borderColor: searchFocused ? c.accent : c.line }]}><Search size={20} color={searchFocused ? c.accent : c.sub} /><TextInput ref={searchRef} accessibilityLabel="Search workouts by name, muscle or category" placeholder={query.length === 0 ? 'Search workouts' : ''} placeholderTextColor={c.sub} onChangeText={setQuery} value={query} multiline={false} onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)} autoCorrect={false} autoCapitalize="none" returnKeyType="search" onSubmitEditing={() => searchRef.current?.blur()} style={[s.searchInput, { color: c.text }]} /><View style={s.searchClear}>{!!query && <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => { clearSearch(); searchRef.current?.focus(); }} style={ui.iconButton}><X size={20} color={c.sub} /></Pressable>}</View></View><IconButton icon={SlidersHorizontal} label="Filter workouts" onPress={() => { searchRef.current?.blur(); setFilters(true); }} /></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>{categories.map(({ name, Icon }) => <Pressable key={name} accessibilityRole="button" accessibilityState={{ selected: category === name }} onPress={() => setCategory(name)} style={[s.category, { backgroundColor: category === name ? c.accent : c.card }]}><Icon size={24} color={category === name ? '#FFF' : c.accent} /><Text style={{ color: category === name ? '#FFF' : c.text, fontSize: 13, fontWeight: '600' }}>{name}</Text></Pressable>)}</ScrollView>
          {browsing && <><View style={[ui.row, { justifyContent: 'space-between' }]}><Text style={[ui.heading, { color: c.text }]}>Featured</Text><Pressable accessibilityRole="button" onPress={() => libraryRef.current?.scrollToOffset({ offset: 480, animated: true })} style={s.linkButton}><Text style={{ color: c.accent, fontWeight: '700' }}>See all</Text></Pressable></View>
          <Pressable accessibilityRole="button" accessibilityLabel="View Partner Squats" onPress={() => openWorkout(catalog[0])} style={[s.feature, { backgroundColor: c.soft }]}><View style={{ flex: 1, gap: 12 }}><Text style={{ color: c.accent, fontWeight: '700', fontSize: 11 }}>MOVE TOGETHER</Text><Text style={[ui.title, { color: c.text, fontSize: 25 }]}>Partner Squats</Text><Text style={[ui.body, { color: c.text }]}>3 sets × 15 reps</Text><Text style={[ui.meta, { color: c.sub }]}>Legs, glutes, core</Text></View><PartnerSquatArt style={{ width: '42%', height: 140 }} /><View style={[s.featurePlay, { backgroundColor: c.accent }]}><Play color="#FFF" fill="#FFF" size={20} /></View></Pressable>
          </>}
          <View style={[ui.row, { justifyContent: 'space-between', marginTop: 8, marginBottom: 12 }]}><Text style={[ui.heading, { color: c.text }]}>{query.trim() ? 'Search results' : 'Workout Library'}</Text><Text accessibilityLiveRegion="polite" style={[ui.meta, { color: c.sub }]}>{filtered.length} {filtered.length === 1 ? 'workout' : 'workouts'}</Text></View>
        </View>}
        renderItem={({ item }) => <View style={[s.libraryRow, { backgroundColor: c.card }]}><Pressable accessibilityRole="button" onPress={() => openWorkout(item)} style={[ui.row, { flex: 1 }]}><WorkoutArt partner={!!item.couple} exerciseId={item.id} compact label={item.title} style={{ width: 104, height: 80, borderRadius: 20 }} /><View style={{ flex: 1, gap: 10 }}><Text style={{ color: c.text, fontSize: 16, fontWeight: '800' }}>{item.title}</Text><Text style={[ui.meta, { color: c.sub }]}>{findPartnerWorkout(item.id)?.prescription}</Text></View></Pressable>{favoriteButton(item)}</View>}
        ListEmptyComponent={<View style={[ui.card, { backgroundColor: c.card, gap: 12 }]}><Text style={[ui.heading, { color: c.text }]}>No workouts found</Text><Text style={[ui.body, { color: c.sub }]}>Try another search or change your filters. Walking and running sessions are in your training plan.</Text><Pressable accessibilityRole="button" style={s.linkButton} onPress={() => { setCategory('All'); setAudience('All'); setHomeOnly(false); setSavedOnly(false); clearSearch(); }}><Text style={{ color: c.accent }}>Clear filters</Text></Pressable></View>}
      />}
      {filters && <View accessibilityViewIsModal style={[s.filterOverlay, { backgroundColor: c.bg }]}><View style={s.nav}><Text style={[ui.heading, { color: c.text, flex: 1 }]}>Workout filters</Text><IconButton icon={X} label="Close filters" onPress={() => setFilters(false)} /></View><Text style={[ui.body, { color: c.sub }]}>Train solo or together</Text><View style={[s.segment, { backgroundColor: c.line }]}>{['All', 'Solo', 'Couple'].map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: audience === value }} onPress={() => setAudience(value)} style={[s.segmentItem, { backgroundColor: audience === value ? c.card : 'transparent' }]}><Text style={{ color: audience === value ? c.accent : c.sub }}>{value}</Text></Pressable>)}</View><View style={s.nav}><Text style={{ flex: 1, color: c.text }}>Home exercises only</Text><Switch accessibilityLabel="Home exercises only" value={homeOnly} onValueChange={setHomeOnly} trackColor={{ true: c.accent }} /></View><View style={s.nav}><Text style={{ flex: 1, color: c.text }}>Saved workouts only</Text><Switch accessibilityLabel="Saved workouts only" value={savedOnly} onValueChange={setSavedOnly} trackColor={{ true: c.accent }} /></View><Pressable accessibilityRole="button" onPress={() => setFilters(false)} style={[ui.primary, { backgroundColor: c.accent }]}><Text style={ui.primaryText}>Show workouts</Text></Pressable></View>}
      <Modal visible={!!exercisePreview} animationType={reduceMotion ? 'none' : 'slide'} presentationStyle="fullScreen" onRequestClose={() => setExercisePreview(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}><ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={s.scroll}>
          <View style={s.nav}><IconButton icon={ArrowLeft} label="Back to workout" onPress={() => setExercisePreview(null)} /><Text style={[ui.heading, { color: c.text, flex: 1 }]}>{exercisePreview?.name}</Text></View>
          <WorkoutArt partner={!!findPartnerWorkout(exercisePreview?.imagePlaceholder)} exerciseId={exercisePreview?.imagePlaceholder} animate label={exercisePreview?.name || 'Exercise'} style={{ height: 240 }} />
          <Text style={[ui.body, { color: c.sub }]}>{exercisePreview?.description}</Text>
          {findPartnerWorkout(exercisePreview?.imagePlaceholder) && <><Text style={[ui.heading, { color: c.text }]}>{exercisePreview?.duration}</Text><Text style={[ui.body, { color: c.sub }]}>Targets: {exercisePreview?.benefits.join(', ')}</Text><PartnerSquatSequence exerciseId={exercisePreview?.imagePlaceholder} /></>}
          <Text style={[ui.heading, { color: c.text }]}>How to do it</Text>
          {exercisePreview?.instructions.map((instruction, i) => <Text key={instruction} style={[ui.body, { color: c.text }]}>{i + 1}. {instruction}</Text>)}
          <Pressable accessibilityRole="button" onPress={() => { setExercisePreview(null); setPlaying(true); }} style={[ui.primary, { backgroundColor: c.accent }]}><Play size={20} color="#FFF" fill="#FFF" /><Text style={ui.primaryText}>Start Workout</Text></Pressable>
        </ScrollView></SafeAreaView>
      </Modal>
      {proofOpen && proofController && <WorkoutPhotoCapture controller={proofController} onClose={() => setProofOpen(false)} />}
    </SafeAreaView>
  </Modal>;
}

function WorkoutArt({ partner, exerciseId, animate, mode, elapsedMs, ...props }: { partner?: boolean; exerciseId?: string; animate?: boolean; mode?: PartnerSquatMode; elapsedMs?: number; label: string; compact?: boolean; style?: import('react-native').ViewStyle }) {
  return partner ? <PartnerSquatArt exerciseId={exerciseId} style={props.style} animate={animate} mode={mode} elapsedMs={elapsedMs} /> : <ArtPlaceholder {...props} />;
}

function WorkoutStats({ minutes, people, seconds }: { minutes: number; people: number; seconds?: number }) {
  const c = usePlanColors();
  return <View style={[s.stats, { backgroundColor: c.card, borderColor: c.line }]}><View style={ui.row}><Clock3 size={21} color={c.accent} /><Text style={{ color: c.text, fontWeight: '600' }}>{seconds != null && seconds < 60 ? `${seconds} sec` : `${minutes} min`}</Text></View><View style={ui.row}><Users size={21} color={c.sub} /><Text style={{ color: c.text, fontWeight: '600' }}>{people} {people === 1 ? 'person' : 'people'}</Text></View><Text style={[ui.meta, { color: c.sub }]}>Guided</Text></View>;
}

export function WorkoutPlayer({ workout, week, onBack, onComplete }: { workout: Workout; week: number; onBack: () => void; onComplete: () => void }) {
  const c = usePlanColors();
  const plan = useMemo(() => getWorkoutPlan(workout, week), [workout, week]);
  const [index, setIndex] = useState(0);
  const [running, setRunning] = useState(true);
  const [seconds, setSeconds] = useState(plan.phases[0].durationSeconds);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const phase = plan.phases[index];
  const next = plan.phases[index + 1];
  const deadline = useRef(Date.now() + seconds * 1000);
  const remainingMs = useRef(seconds * 1000);
  const partnerSession = !!findPartnerWorkout(workout.id);
  const motionMode: PartnerSquatMode = phase.type === 'warmup' ? 'warmup' : phase.type === 'cooldown' ? 'cooldown' : 'squat';
  const movement = getPartnerWorkoutMotion(workout.id, motionMode, elapsedMs);
  const completion = useRef(false);
  const completedPhases = useRef(new Set<number>());
  const completeRef = useRef(onComplete); completeRef.current = onComplete;
  const [needsReview, setNeedsReview] = useState(false);
  const changePhase = useCallback((target: number) => {
    setNeedsReview(false); setIndex(target); setSeconds(plan.phases[target].durationSeconds); setElapsedMs(0);
    remainingMs.current = plan.phases[target].durationSeconds * 1000; deadline.current = Date.now() + remainingMs.current;
  }, [plan]);
  const advance = useCallback((earned: boolean) => {
    if (completion.current) return;
    if (earned) completedPhases.current.add(index);
    if (index < plan.phases.length - 1) { changePhase(index + 1); return; }
    if (completedPhases.current.size !== plan.phases.length) { setRunning(false); setNeedsReview(true); return; }
    completion.current = true; completeRef.current();
  }, [index, plan, changePhase]);
  const advanceRef = useRef(advance); advanceRef.current = advance;
  useEffect(() => {
    if (!running) return;
    const tick = () => {
      remainingMs.current = Math.max(0, deadline.current - Date.now());
      setSeconds(Math.ceil(remainingMs.current / 1000));
      setElapsedMs(plan.phases[index].durationSeconds * 1000 - remainingMs.current);
    };
    tick();
    const timer = setInterval(tick, 200);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') tick(); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [running, index, plan]);
  useEffect(() => { if (running && seconds === 0) advanceRef.current(true); }, [seconds, running]);
  const pause = () => {
    remainingMs.current = Math.max(0, deadline.current - Date.now());
    setSeconds(Math.ceil(remainingMs.current / 1000));
    setElapsedMs(phase.durationSeconds * 1000 - remainingMs.current);
    setRunning(false);
  };
  const toggle = () => { if (running) pause(); else { deadline.current = Date.now() + remainingMs.current; setRunning(true); } };
  const radius = 88; const circumference = 2 * Math.PI * radius;
  return <>
    <View style={[s.nav, { paddingHorizontal: 20 }]}><IconButton icon={ArrowLeft} label="Leave workout" onPress={onBack} /><View style={{ flex: 1, alignItems: 'center', gap: 4 }}><Text style={{ fontSize: 18, fontWeight: '800', color: c.text, textAlign: 'center' }}>{workout.title}</Text><Text style={[ui.meta, { color: c.sub }]}>{index + 1} of {plan.phases.length} steps</Text></View><View style={{ width: 44 }} /></View>
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
      <View accessibilityLabel={`Step ${index + 1} of ${plan.phases.length}`} style={[ui.row, { gap: 4 }]}>{plan.phases.map((item, i) => <View key={item.key} style={{ flex: 1, height: 6, borderRadius: 4, backgroundColor: i <= index ? c.accent : c.line }} />)}</View>
      <View><WorkoutArt partner={partnerSession} exerciseId={workout.id} animate mode={motionMode} elapsedMs={elapsedMs} label={phase.title} style={{ height: 228, borderRadius: 28 }} /><View style={{ position: 'absolute', bottom: 8, right: 8 }}><IconButton icon={Maximize} label="Expand exercise instructions" onPress={() => { if (running) pause(); setExpanded(true); }} /></View></View>
      <View style={{ gap: 8 }}><Text style={[ui.title, { color: c.text }]}>{phase.title}</Text><Text style={[ui.body, { color: c.sub }]}>{phase.subtitle}</Text><Text style={[ui.body, { color: c.sub }]}>{phase.exercise?.description || phase.instruction}</Text></View>
      <WorkoutStats minutes={Math.ceil(phase.durationSeconds / 60)} seconds={phase.durationSeconds} people={workout.people} />
      {partnerSession && <View style={{ gap: 6, alignItems: 'center' }}><Text style={[ui.heading, { color: c.text }]}>{movement.rep != null ? `${movement.unit} ${movement.rep} of ${movement.total}` : phase.type === 'warmup' ? 'Warm-up movement' : phase.type === 'cooldown' ? 'Cool-down movement' : 'Keep moving together'}</Text><Text style={[ui.body, { color: c.sub }]}>{movement.cue}</Text><Text style={[ui.meta, { color: c.sub, textAlign: 'center' }]}>Follow the demonstration at your own pace. Pause whenever you need.</Text></View>}
      <View style={[s.timerCard, { backgroundColor: c.soft }]}><View style={s.timerSide}><IconButton icon={ChevronLeft} label="Previous step" disabled={index === 0} onPress={() => changePhase(index - 1)} /><Text style={[ui.meta, { color: c.sub }]}>Previous</Text></View><View style={{ width: 196, height: 196, alignItems: 'center', justifyContent: 'center' }}><Svg width={196} height={196} style={{ position: 'absolute' }}><Circle cx={98} cy={98} r={radius} stroke={c.line} strokeWidth={10} fill="transparent" /><Circle cx={98} cy={98} r={radius} stroke={c.accent} strokeWidth={10} fill="transparent" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - seconds / phase.durationSeconds)} rotation={-90} origin="98,98" /></Svg><Text accessibilityLiveRegion="none" style={{ color: c.text, fontSize: 40, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -1 }}>{formatClock(seconds)}</Text><IconButton icon={running ? Pause : Play} label={running ? 'Pause timer' : 'Resume timer'} onPress={toggle} /><Text style={{ color: c.sub, fontSize: 11 }}>{running ? 'In progress' : 'Paused'}</Text></View><View style={s.timerSide}><IconButton icon={ChevronRight} label={next ? 'Skip to next step' : 'Finish workout'} onPress={() => advance(seconds === 0)} /><Text style={[ui.meta, { color: c.sub }]}>{next ? 'Next' : 'Finish'}</Text></View></View>
      {needsReview && <View style={[ui.card, { backgroundColor: c.card, gap: 12 }]}><Text style={[ui.body, { color: c.text }]}>Some steps were skipped. Complete them to mark this workout done.</Text><Pressable accessibilityRole="button" style={s.linkButton} onPress={() => { const missing = plan.phases.findIndex((_, i) => !completedPhases.current.has(i)); changePhase(Math.max(0, missing)); setRunning(true); }}><Text style={{ color: c.accent, fontWeight: '700' }}>Return to unfinished steps</Text></Pressable></View>}
      {next && <View style={[s.exercise, { backgroundColor: c.card }]}><WorkoutArt partner={partnerSession} exerciseId={workout.id} mode={next.type === 'warmup' ? 'warmup' : next.type === 'cooldown' ? 'cooldown' : 'squat'} compact label={next.title} style={{ width: 112, height: 72 }} /><View style={{ flex: 1, gap: 6 }}><Text style={{ color: c.sub, fontSize: 12 }}>Up Next</Text><Text style={{ color: c.text, fontSize: 16, fontWeight: '800' }}>{next.title}</Text><Text style={[ui.meta, { color: c.sub }]}>{formatClock(next.durationSeconds)}</Text></View></View>}
      <View style={[ui.card, { backgroundColor: c.card, gap: 10 }]}><Text style={[ui.heading, { color: c.text }]}>How to do it</Text>{(phase.exercise?.instructions || [phase.instruction]).map((text, i) => <Text key={text} style={[ui.body, { color: c.sub }]}>{i + 1}. {text}</Text>)}</View>
    </ScrollView>
    <Modal visible={expanded} presentationStyle="fullScreen" onRequestClose={() => setExpanded(false)}><SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}><View style={{ flex: 1, padding: 24, gap: 24 }}><View style={s.nav}><Text style={[ui.heading, { color: c.text, flex: 1 }]}>{phase.title}</Text><IconButton icon={X} label="Close expanded instructions" onPress={() => setExpanded(false)} /></View><WorkoutArt partner={partnerSession} exerciseId={workout.id} mode={motionMode} elapsedMs={elapsedMs} animate label={phase.title} style={{ height: 260 }} /><ScrollView contentContainerStyle={{ gap: 16 }}>{(phase.exercise?.instructions || [phase.instruction]).map(text => <Text key={text} style={[ui.body, { color: c.text }]}>{text}</Text>)}</ScrollView><Text style={{ color: c.sub }}>Timer paused. Resume when you’re ready.</Text></View></SafeAreaView></Modal>
  </>;
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32, gap: 20 },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 52 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, paddingLeft: 12, paddingRight: 4, borderWidth: 1, borderRadius: 22, borderCurve: 'continuous' },
  searchInput: { flex: 1, minWidth: 0, height: 44, fontSize: 15, lineHeight: 20, padding: 0, textAlignVertical: 'center', includeFontPadding: false },
  searchClear: { width: 44, height: 44 },
  category: { minWidth: 76, minHeight: 84, borderRadius: 24, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 12 },
  feature: { borderRadius: 28, borderCurve: 'continuous', padding: 20, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 184 },
  featurePlay: { position: 'absolute', bottom: 12, right: 12, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#FFF' },
  libraryRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 24, borderCurve: 'continuous', gap: 4, padding: 8, marginBottom: 12 },
  linkButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', alignItems: 'center', borderWidth: 1, borderRadius: 24, padding: 14, gap: 12 },
  segment: { flexDirection: 'row', borderRadius: 28, padding: 4 }, segmentItem: { flex: 1, minHeight: 44, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  exercise: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, borderRadius: 24, borderCurve: 'continuous' },
  filterOverlay: { ...StyleSheet.absoluteFillObject, padding: 24, gap: 24 },
  timerCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 28, paddingVertical: 20, paddingHorizontal: 8 },
  timerSide: { alignItems: 'center', gap: 8, flex: 1 },
  finish: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 24 },
  finishIcon: { width: 104, height: 104, borderRadius: 52, alignItems: 'center', justifyContent: 'center' },
});
