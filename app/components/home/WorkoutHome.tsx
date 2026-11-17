import { useColorScheme } from '@/hooks/use-color-scheme';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowUpRight, Camera, Flame, Send, UserPlus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/src/auth/authContext';
import { usePlanColors } from '@/components/plan/PlanVisuals';

import WorkoutPhotoStack from './WorkoutPhotoStack';
import WorkoutPhotoCapture from './WorkoutPhotoCapture';
import type { WorkoutPhotosController } from '@/hooks/useWorkoutPhotos';
import type { WorkoutOverview } from '@/hooks/useWorkoutOverview';

type Props = {
  hideHeader?: boolean;
  photos: WorkoutPhotosController;
  hasPartner?: boolean;
  partnerName?: string;
  onMotivate?: () => void;
  overview?: WorkoutOverview | null;
};

const firstName = (name?: string | null) => name?.trim().split(/\s+/)[0] ?? '';

function progressWidth(count: number, goal: number) {
  if (goal <= 0) return '0%';
  return `${Math.min(100, (count / goal) * 100)}%`;
}

export default function WorkoutHome({
  hideHeader = false,
  photos,
  hasPartner = false,
  partnerName,
  onMotivate,
  overview,
}: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const c = usePlanColors();
  const dark = useColorScheme() === 'dark';
  const [captureOpen, setCaptureOpen] = useState(false);
  const goal = overview?.mine.weeklyTarget ?? 0;
  const partnerGoal = overview?.partner?.weeklyTarget ?? 0;
  const myWorkouts = overview?.mine.weeklyCount ?? 0;
  const partnerWorkouts = overview?.partner?.weeklyCount ?? 0;
  const myStreak = photos.mine.streak;
  const mine = Math.max(0, myWorkouts);
  const theirs = Math.max(0, partnerWorkouts);
  const myName = firstName(user?.displayName ?? user?.name) || 'You';
  const theirName = firstName(partnerName) || 'Partner';
  const myPhotos = photos.photos.filter(photo => photo.authorUserId === user?.id);
  const partnerPhotos = photos.photos.filter(photo => photo.authorUserId === photos.partnerId);

  const openWorkout = (participant: 'you' | 'partner' = 'you') => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push({ pathname: '/workout', params: { participant, name: participant === 'partner' ? theirName : myName } });
  };

  const player = (opts: {
    label: string;
    count: number;
    weeklyGoal: number;
    own: boolean;
    tile: React.ReactNode;
    onPhotoPress?: () => void;
  }) => (
    <View style={styles.player}>
      {opts.tile}
      <View style={[styles.namePill, { backgroundColor: c.accent }]}>
        <Text style={styles.namePillText}>{opts.label}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View ${opts.label}'s workout schedule, ${opts.count} of ${opts.weeklyGoal} workouts`}
        onPress={() => openWorkout(opts.own ? 'you' : 'partner')}
        style={styles.stats}
      >
        <Text style={[styles.countValue, { color: c.text }]}>
          {opts.weeklyGoal > 0 ? `${opts.count} / ${opts.weeklyGoal}` : '—'}
        </Text>
        <Text style={[styles.countLabel, { color: c.sub }]}>
          {opts.own ? 'Workouts completed' : 'Partner completed'}
        </Text>
      </Pressable>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={`${opts.label}'s weekly workouts`}
        accessibilityValue={{ min: 0, max: opts.weeklyGoal || 1, now: opts.count }}
        style={[styles.track, { backgroundColor: c.soft }]}
      >
        <View style={[styles.fill, { backgroundColor: c.accent, width: progressWidth(opts.count, opts.weeklyGoal) }]} />
      </View>
    </View>
  );

  const myTile = myPhotos.length ? (
    <WorkoutPhotoStack controller={photos} photos={myPhotos} own name={myName} comparison />
  ) : (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Add your workout photo"
      onPress={() => setCaptureOpen(true)}
      style={[styles.photoSlot, { backgroundColor: c.soft, borderColor: c.line }]}
    >
      <Camera size={32} color={c.accent} strokeWidth={1.75} />
      <Text style={[styles.photoHint, { color: c.sub }]}>Add your photo</Text>
    </Pressable>
  );

  const partnerTile = hasPartner ? (
    partnerPhotos.length ? (
      <WorkoutPhotoStack controller={photos} photos={partnerPhotos} name={theirName} comparison />
    ) : (
      <View style={[styles.photoSlot, { backgroundColor: c.soft, borderColor: c.line }]}>
        <Camera size={32} color={c.accent} strokeWidth={1.75} />
        <Text style={[styles.photoHint, { color: c.sub }]}>No photo yet</Text>
      </View>
    )
  ) : null;

  return (
    <View style={[styles.section, hideHeader && styles.embedded]}>
      {!hideHeader && (
        <View style={styles.header}>
          <View style={[styles.badge, { backgroundColor: c.accent }]}>
            <Text style={styles.badgeText}>3</Text>
          </View>
          <View style={styles.headerCopy}>
            <Text accessibilityRole="header" style={[styles.title, { color: c.text }]}>
              Complete your workout goal
            </Text>
            {myStreak > 0 ? (
              <View style={[styles.streakChip, { backgroundColor: dark ? '#3B2620' : '#FFEDD5' }]}>
                <Flame size={13} color="#F97316" fill="#FDBA74" />
                <Text style={[styles.streakText, { color: dark ? '#FDBA74' : '#9A3412' }]}>
                  YOU · {myStreak}-day streak
                </Text>
              </View>
            ) : null}
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Open workouts"
            onPress={() => openWorkout()}
            hitSlop={10}
            style={styles.headerLink}
          >
            <ArrowUpRight size={20} color={c.accent} strokeWidth={2.25} />
          </TouchableOpacity>
        </View>
      )}

      <View style={[styles.comparisonCard, { backgroundColor: c.card, boxShadow: dark ? undefined : '0 4px 20px rgba(80, 30, 40, 0.06)' }]}>
        {player({ label: 'You', count: mine, weeklyGoal: goal, own: true, tile: myTile })}
        <View style={styles.vsColumn}>
          <View style={[styles.vsLine, { borderColor: c.line }]} />
          <View style={[styles.vsBadge, { backgroundColor: c.soft }]}>
            <Text style={[styles.vsText, { color: c.accent }]}>vs</Text>
          </View>
          <View style={[styles.vsLine, { borderColor: c.line }]} />
        </View>
        {hasPartner ? (
          player({ label: 'Partner', count: theirs, weeklyGoal: partnerGoal, own: false, tile: partnerTile! })
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/Partner')}
            style={styles.invitePlayer}
          >
            <View style={[styles.photoSlot, styles.inviteSlot, { backgroundColor: c.soft, borderColor: c.line }]}>
              <UserPlus size={30} color={c.accent} strokeWidth={1.75} />
              <Text style={[styles.photoHint, { color: c.text }]}>Add a partner</Text>
            </View>
            <Text style={[styles.inviteBody, { color: c.sub }]}>Race each other to the weekly goal</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={photos.draft ? 'Resume workout photo' : 'Log workout photo'}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            setCaptureOpen(true);
          }}
          activeOpacity={0.85}
          style={[styles.primary, { backgroundColor: c.accent }]}
        >
          <Camera size={18} color="#FFFFFF" strokeWidth={2} />
          <Text style={styles.primaryText}>{photos.draft ? 'Resume photo' : 'Log workout'}</Text>
        </TouchableOpacity>
        {hasPartner && onMotivate ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Motivate ${theirName}`}
            onPress={() => {
              void Haptics.selectionAsync().catch(() => {});
              onMotivate();
            }}
            activeOpacity={0.85}
            style={[styles.secondary, { backgroundColor: c.soft }]}
          >
            <Send size={17} color={c.text} strokeWidth={2} />
            <Text style={[styles.secondaryText, { color: c.text }]}>Motivate</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {!!photos.error && (
        <TouchableOpacity accessibilityRole="button" onPress={() => { void photos.refresh(); }}>
          <Text style={[styles.errorText, { color: c.sub }]}>{photos.error} Tap to retry.</Text>
        </TouchableOpacity>
      )}
      {captureOpen && <WorkoutPhotoCapture key={photos.scope} controller={photos} onClose={() => setCaptureOpen(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  embedded: { marginHorizontal: 0, paddingHorizontal: 0, paddingVertical: 0 },
  section: { marginHorizontal: -20, paddingHorizontal: 16, paddingVertical: 20, gap: 16 },
  header: { minHeight: 36, paddingLeft: 32, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  badge: {
    position: 'absolute',
    left: -8,
    top: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  headerCopy: { flex: 1, gap: 6, paddingTop: 5 },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '700', letterSpacing: -0.3 },
  headerLink: { paddingTop: 7, minWidth: 44, minHeight: 44, alignItems: 'center' },
  streakChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  streakText: { fontSize: 12, fontWeight: '700' },
  comparisonCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 18,
    borderRadius: 24,
    borderCurve: 'continuous',
  },
  player: { flex: 1, minWidth: 0, alignItems: 'center', gap: 10 },
  photoSlot: {
    width: '100%',
    minHeight: 120,
    borderRadius: 22,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  photoHint: { fontSize: 12, lineHeight: 16, textAlign: 'center', fontWeight: '500' },
  namePill: {
    marginTop: -18,
    borderRadius: 20,
    borderCurve: 'continuous',
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  namePillText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  stats: { alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 52, width: '100%' },
  countValue: { fontSize: 26, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
  countLabel: { fontSize: 11, lineHeight: 15, textAlign: 'center', fontWeight: '500' },
  track: { height: 7, width: '100%', overflow: 'hidden', borderRadius: 8, borderCurve: 'continuous' },
  fill: { height: '100%', borderRadius: 8, borderCurve: 'continuous' },
  vsColumn: { width: 28, alignItems: 'center', paddingVertical: 8 },
  vsLine: { flex: 1, width: 0, borderLeftWidth: 1, borderStyle: 'dashed' },
  vsBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  vsText: { fontSize: 11, fontWeight: '900', textTransform: 'lowercase' },
  invitePlayer: { flex: 1, minWidth: 0, alignItems: 'center', gap: 8, justifyContent: 'center' },
  inviteSlot: { borderStyle: 'dashed', borderWidth: 1.5 },
  inviteBody: { fontSize: 11, textAlign: 'center', lineHeight: 15, paddingHorizontal: 4 },
  primary: {
    flex: 1,
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: 26,
    borderCurve: 'continuous',
  },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10 },
  secondary: {
    flex: 1,
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 12,
    borderRadius: 26,
    borderCurve: 'continuous',
  },
  secondaryText: { fontSize: 15, fontWeight: '700' },
  errorText: { fontSize: 14, lineHeight: 20, textAlign: 'center', paddingHorizontal: 12 },
});