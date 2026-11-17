import { useColorScheme } from '@/hooks/use-color-scheme';
import { Image } from 'expo-image';
import { COUPLE_REST, OPPONENT_REST, preloadCoupleArtwork } from '@/components/battle/coupleArenaAssets';
import React, { useEffect } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useAuth } from '../../src/auth/authContext';
import RaceCourse from '../../components/race/RaceCourse';
import { useRaceSocketContext } from '@/contexts/RaceSocketContext';
import { useScheduledRuns } from '@/hooks/useScheduledRuns';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ArrowRight, History, Trophy, User, Users } from 'lucide-react-native';
import { COMPETITIONS, type Competition } from '@/constants/competitions';

const THEME = {
  bg: '#FFF7F7',
  surface: '#FFFFFF',
  primary: '#FF6B81',
  secondary: '#2EC4B6',
  textMain: '#111827',
  textBody: '#4B5563',
  textMuted: '#6B7280',
  border: 'rgba(17, 24, 39, 0.06)',
};

export default function CompetitionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { user } = useAuth();
  const dark = useColorScheme() === 'dark';
  const surface = dark ? '#18232B' : '#FFFFFF';
  const ink = dark ? '#F5F7FA' : '#172035';
  const { raceState, raceDistance, myDistance, partnerPosition } = useRaceSocketContext();
  const { scheduledRuns } = useScheduledRuns();
  const activeRace = raceState === 'countdown' || raceState === 'racing';
  const scheduledRun = [...scheduledRuns.sent, ...scheduledRuns.received]
    .filter(run => run.status === 'ACCEPTED' || (run.isSender && run.status === 'PENDING'))
    .sort((a, b) => Date.parse(a.scheduledTime) - Date.parse(b.scheduledTime))[0];
  const showCourse = activeRace || Boolean(scheduledRun);
  const courseDistance = activeRace ? raceDistance : (scheduledRun?.distanceKm ?? 1) * 1000;
  const liveDistance = activeRace ? myDistance : 0;
  const partnerDistance = activeRace ? partnerPosition?.distanceCovered ?? 0 : 0;
  const myProgress = useSharedValue(0);
  const theirProgress = useSharedValue(0);
  useEffect(() => {
    myProgress.value = courseDistance > 0 ? Math.min(Math.max(liveDistance / courseDistance, 0), 1) : 0;
    theirProgress.value = courseDistance > 0 ? Math.min(Math.max(partnerDistance / courseDistance, 0), 1) : 0;
  }, [courseDistance, liveDistance, partnerDistance, myProgress, theirProgress]);
  const raceStatus = activeRace
    ? raceState === 'countdown' ? 'STARTING SOON' : 'RACE IN PROGRESS'
    : scheduledRun?.status === 'PENDING' ? 'AWAITING PARTNER' : 'SCHEDULED RACE';
  const sceneHeight = Math.max(460, Math.min(620, height * 0.63));

  useEffect(() => { void preloadCoupleArtwork(); }, []);

  const openCompetition = (competition: Competition) => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (competition.route) {
      router.push(competition.route);
      return;
    }
    Alert.alert(competition.title, `${competition.title} is coming soon. We'll let you know when it's ready.`);
  };

  return (
    <View style={[styles.container, { backgroundColor: surface }]}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        <View style={[styles.heroHeader, { paddingTop: insets.top + 12 }]}>
          <View style={[styles.heroPill, { backgroundColor: surface }]}><Trophy size={16} color={THEME.primary} /><Text style={[styles.heroTitle, { color: ink }]}>RACE TOGETHER</Text></View>
          <Pressable style={[styles.historyButton, { backgroundColor: surface }]} onPress={() => router.push('/race/history')} accessibilityRole="button" accessibilityLabel="Race history"><History size={21} color={ink} /></Pressable>
        </View>
        {showCourse && (
          <Pressable style={{ height: sceneHeight, overflow: 'hidden' }}
            onPress={() => router.push('/race/virtual')}
            accessibilityRole="button" accessibilityLabel={activeRace ? 'Return to virtual race' : 'View scheduled virtual race'}>
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <RaceCourse width={width} viewportHeight={sceneHeight} bottomInset={26} raceDistance={courseDistance}
                myProgress={myProgress} theirProgress={theirProgress} myDistance={liveDistance}
                partnerDistance={partnerDistance} gender={user?.gender} running={raceState === 'racing'}
                following onBrowse={() => {}} />
            </View>
            <View style={styles.previewPill}><View style={styles.previewDot} /><Text style={styles.previewText}>{raceStatus}</Text></View>
          </Pressable>
        )}
        <View style={[styles.dashboard, { backgroundColor: surface }, showCourse && styles.dashboardOverCourse]}>
          <View style={styles.list}>
            {COMPETITIONS.map(competition => <CompetitionCard key={competition.id} competition={competition} dark={dark} onJoin={() => openCompetition(competition)} />)}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function CompetitionCard({ competition, onJoin, dark }: { competition: Competition; onJoin: () => void; dark: boolean }) {
  const { icon: Icon, range, tint } = competition;
  const SideIcon = competition.matchup === '2v2' ? Users : User;
  const RangeIcon = range.icon;

  return (
    <Pressable
      onPress={onJoin}
      style={({ pressed }) => [styles.card, dark && { backgroundColor: '#25323E' }, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${competition.title}. ${competition.description}`}
    >
      <LinearGradient colors={tint} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cardArt}>
        <View style={styles.vsPill}>
          <SideIcon size={15} color={THEME.secondary} strokeWidth={2.4} />
          <Text style={styles.vsText}>vs</Text>
          <SideIcon size={15} color={THEME.primary} strokeWidth={2.4} />
        </View>
        {competition.matchup === '2v2' ? <View pointerEvents="none" style={styles.couplePreview}>
          {[0, 1, 2, 3].map((member) => <Image key={member}
            source={(member > 1 ? OPPONENT_REST : COUPLE_REST)[member === 0 || member === 3 ? 'male' : 'female']}
            contentFit="contain" cachePolicy="memory-disk" transition={0} accessible={false}
            style={[styles.coupleAvatar, { left: member * 23, transform: [{ scaleX: member > 1 ? -1 : 1 }] }]} />)}
        </View> : <Icon size={54} color="rgba(17,24,39,0.2)" strokeWidth={1.6} />}
        {!competition.available ? (
          <View style={styles.soonPill}>
            <Text style={styles.soonText}>Coming soon</Text>
          </View>
        ) : null}
      </LinearGradient>

      <View style={styles.cardBody}>
        <View>
          <Text style={[styles.cardTitle, dark && { color: '#F5F7FA' }]} numberOfLines={2}>
            {competition.title}
          </Text>
          <Text style={[styles.cardDescription, dark && { color: '#B6C2D0' }]} numberOfLines={4}>
            {competition.description}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <RangeIcon size={13} color={THEME.primary} strokeWidth={2.4} />
            <Text style={[styles.metaText, dark && { color: '#B6C2D0' }]} numberOfLines={1}>
              {range.label}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <SideIcon size={13} color={THEME.textMuted} strokeWidth={2.4} />
            <Text style={[styles.metaText, dark && { color: '#B6C2D0' }]} numberOfLines={1}>
              {competition.format}
            </Text>
          </View>
        </View>

        <View style={styles.joinButton}>
          <Text style={styles.joinText}>{competition.available ? 'Join challenge' : 'Coming soon'}</Text>
          <ArrowRight size={15} color="#FFF" strokeWidth={2.6} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  couplePreview: { width: 123, height: 104, marginTop: 26 },
  coupleAvatar: { position: 'absolute', width: 54, height: 104, bottom: 0 },
  heroHeader: { paddingHorizontal: 20, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroPill: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 24 },
  heroTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  previewPill: { position: 'absolute', bottom: 42, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFFFFD9', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  previewDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#009F97' },
  previewText: { fontSize: 8, letterSpacing: 1.5, fontWeight: '800', color: '#536476' },
  dashboard: { borderTopLeftRadius: 32, borderTopRightRadius: 32, borderCurve: 'continuous', paddingTop: 24, paddingHorizontal: 20, paddingBottom: 24 },
  dashboardOverCourse: { marginTop: -26 },
  container: { flex: 1, backgroundColor: THEME.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 20 },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.94 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  titleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '800', color: THEME.textMain, letterSpacing: -0.6 },
  historyButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderCurve: 'continuous',
    backgroundColor: THEME.surface,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 14px rgba(255, 107, 129, 0.14)',
  },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: -6 },
  sectionTitle: { fontSize: 20, lineHeight: 26, fontWeight: '700', color: THEME.textMain, letterSpacing: -0.3 },

  list: { gap: 14 },
  card: {
    flexDirection: 'row',
    minHeight: 160,
    backgroundColor: THEME.surface,
    borderRadius: 24,
    borderCurve: 'continuous',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: THEME.border,
    boxShadow: '0 6px 18px rgba(17, 24, 39, 0.06)',
  },
  cardArt: { width: '42%', alignItems: 'center', justifyContent: 'center' },
  vsPill: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  vsText: { fontSize: 12, fontWeight: '800', color: THEME.primary },
  soonPill: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(17,24,39,0.72)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  soonText: { fontSize: 11, fontWeight: '700', color: '#FFF' },
  cardBody: { flex: 1, padding: 14, gap: 10, justifyContent: 'space-between' },
  cardTitle: { fontSize: 18, lineHeight: 24, fontWeight: '700', color: THEME.textMain, letterSpacing: -0.3 },
  cardDescription: { fontSize: 13, lineHeight: 19, color: THEME.textBody, marginTop: 2 },
  metaRow: { gap: 4 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { flexShrink: 1, fontSize: 12, fontWeight: '600', color: THEME.textMuted },
  joinButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: THEME.primary,
  },
  joinText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});
