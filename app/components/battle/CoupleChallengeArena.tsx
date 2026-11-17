import { useColorScheme } from '@/hooks/use-color-scheme';
import React, { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { CalendarDays, ChevronLeft, ChevronRight, Gift, Share2, Trophy, Users } from 'lucide-react-native';
import Animated, { cancelAnimation, Easing, FadeIn, useAnimatedProps, useAnimatedStyle, useDerivedValue, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Defs, Ellipse, G, Path, RadialGradient, Stop } from 'react-native-svg';
import type { CoupleChallenge, CoupleView } from '@/utils/coupleChallengeSim';
import { Image } from 'expo-image';
import { COUPLE_HEADS, OPPONENT_HEADS, COUPLE_PARK, preloadCoupleArtwork } from './coupleArenaAssets';
import { stageGrip, type TugIdentity } from './tugSprite';
import CoupleCharacterRig from './CoupleCharacterRig';
import { RIG_WIDTH as TUG_FRAME_WIDTH, RIG_BASELINE, rigBreath, rigGrip } from './coupleRigGeometry';
import ArenaStepTotal from './ArenaStepTotal';
import CoupleMedal from './CoupleMedal';
import { medalForPrize } from '@/constants/coupleMedals';

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const TEAL = '#137E76';
const CORAL = '#D74559';
const count = (value: number) => Math.round(value).toLocaleString();
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const NUMBER_FONT = process.env.EXPO_OS === 'android' ? 'sans-serif-medium' : 'System';

// One coordinate system for the landscape, feet, shadows and rope. The artwork
// can change pose without translating its feet away from the grass plane.
const WIDTH = 400;
const HEIGHT = 300;
const FLOOR = 258;
const SCALE = 0.32;
const FIGURE_WIDTH = TUG_FRAME_WIDTH * SCALE;
const POSITIONS = [8, 80, WIDTH - 80 - FIGURE_WIDTH, WIDTH - 8 - FIGURE_WIDTH];
const IDENTITIES: TugIdentity[] = ['male', 'female', 'female', 'male'];
// Avatars, their shadows and every grip travel together toward the leader.
const MAX_SHIFT = 16;
const ROPE_Y = FLOOR - RIG_BASELINE * SCALE + rigGrip('female', 0).front.y * SCALE;
const MARKER_SIZE = 24;

function tugShift(you: number, them: number) {
  const lead = (you - them) / Math.max(you + them, 1);
  // Your couple is on the left, so a lead pulls the rope to negative x.
  // Proportional to the step-share difference; even a large lead stays on stage.
  return -Math.max(-1, Math.min(1, lead * 2)) * MAX_SHIFT;
}

function Head({ identity, size, flip, ring, tint }: { identity: TugIdentity; size: number; flip?: boolean; ring: string; tint: string }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: ring, backgroundColor: tint, overflow: 'hidden' }}>
    <Image source={(flip ? OPPONENT_HEADS : COUPLE_HEADS)[identity]} accessible={false} contentFit="fill" cachePolicy="memory-disk" transition={0}
      style={{ flex: 1, transform: flip ? [{ scaleX: -1 }] : undefined }} />
  </View>;
}

function CoupleHeads({ team, flip, ring, tint }: { team: CoupleView; flip?: boolean; ring: string; tint: string }) {
  const identities: TugIdentity[] = team.members.length ? team.members.map((_, i) => i % 2 ? 'female' : 'male') : ['male', 'female'];
  return <View style={styles.heads}>
    {identities.slice(0, 2).map((identity, i) => <View key={i} style={i ? styles.overlap : undefined}>
      <Head identity={identity} size={30} flip={flip} ring={ring} tint={tint} />
    </View>)}
  </View>;
}

export default function CoupleChallengeArena({ challenge, topInset, onBack, onShare }: {
  challenge: CoupleChallenge; topInset: number; onBack: () => void; onShare: () => void;
}) {
  const dark = useColorScheme() === 'dark';
  const focused = useIsFocused();
  const reduced = useReducedMotion();
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const viewport = useWindowDimensions();
  const [width, setWidth] = useState(viewport.width);
  const [showContributions, setShowContributions] = useState(false);
  const [headingBottom, setHeadingBottom] = useState(topInset + 170);
  const leftPhase = useSharedValue(0);
  const openingPull = useSharedValue(0);
  const entrance = useSharedValue(0);
  const tension = useSharedValue(0);
  const leadFlash = useSharedValue(0);
  const entered = useRef(false);
  const previousTotals = useRef({ id: challenge.id, you: challenge.yourCouple.totalSteps, them: challenge.theirCouple.totalSteps });
  const leader = challenge.yourCouple.totalSteps === challenge.theirCouple.totalSteps ? null : challenge.yourCouple.totalSteps > challenge.theirCouple.totalSteps ? 'you' : 'them';
  const previousLeader = useRef({ id: challenge.id, value: leader });
  const [leadMessage, setLeadMessage] = useState<string | null>(null);
  const rightPhase = useSharedValue(0);
  const you = challenge.yourCouple.totalSteps;
  const them = challenge.theirCouple.totalSteps;
  const shift = useSharedValue(tugShift(you, them));
  const share = you + them ? you / (you + them) : 0.5;
  const ratio = width / WIDTH;
  const text = dark ? '#F1F3F1' : '#1D2B33';
  const muted = dark ? '#AFBBB5' : '#66726C';
  const surface = dark ? '#1E302CF2' : '#FFFFFFF2';
  const background = dark ? '#172D29' : '#FFF3F3';
  const border = dark ? '#354139' : '#E8EBE4';
  const teal = dark ? '#78C8BC' : TEAL;
  const coral = dark ? '#EE9B9F' : CORAL;
  const tealSoft = dark ? '#78C8BC26' : '#137E7614';
  const coralSoft = dark ? '#EE9B9F26' : '#D7455914';
  const floorY = headingBottom + 32 + 180 * ratio;
  // Keep the grass under the feet while the artwork still covers the viewport.
  const artHeight = Math.max(viewport.height, (viewport.height - floorY) / 0.425);
  const artTop = floorY - artHeight * 0.575;

  useEffect(() => { void preloadCoupleArtwork(); }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setAppActive(state === 'active'));
    return () => subscription.remove();
  }, []);
  const motionActive = focused && appActive && !reduced;
  useEffect(() => {
    // Fast Refresh and an interrupted UI animation can leave the phase at 1.
    // Restart from zero so repeating a timing animation cannot become 1 -> 1.
    leftPhase.set(0);
    rightPhase.set(0);
    openingPull.set(0);
    if (motionActive) {
      openingPull.set(withDelay(180, withSequence(
        withTiming(1.1, { duration: 250, easing: Easing.inOut(Easing.quad) }),
        withTiming(-0.55, { duration: 300, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 300, easing: Easing.out(Easing.quad) }),
      )));
      leftPhase.set(withDelay(1030, withRepeat(withTiming(1, { duration: 3000, easing: Easing.linear }), -1, false)));
      rightPhase.set(withDelay(1330, withRepeat(withTiming(1, { duration: 3300, easing: Easing.linear }), -1, false)));
    }
    return () => { cancelAnimation(leftPhase); cancelAnimation(rightPhase); cancelAnimation(openingPull); };
  }, [motionActive, challenge.id, leftPhase, rightPhase, openingPull]);

  useEffect(() => {
    // Scores must appear even if an artwork request is slow or fails.
    if (!entered.current) {
      entered.current = true;
      entrance.set(motionActive ? withTiming(1, { duration: 280, easing: EASE_OUT }) : 1);
    }
    if (!motionActive && entered.current) entrance.set(1);
  }, [motionActive, entrance]);
  const arenaEntrance = useAnimatedStyle(() => ({ opacity: entrance.get() }));
  const scoreEntrance = useAnimatedStyle(() => ({ opacity: entrance.get(), transform: [{ translateY: (1 - entrance.get()) * 8 }] }));
  const yourHighlight = useAnimatedStyle(() => ({ opacity: leader === 'you' ? leadFlash.get() * 0.12 : 0 }));
  const theirHighlight = useAnimatedStyle(() => ({ opacity: leader === 'them' ? leadFlash.get() * 0.12 : 0 }));

  useEffect(() => {
    const previous = previousTotals.current;
    const updated = previous.id === challenge.id && (previous.you !== you || previous.them !== them);
    previousTotals.current = { id: challenge.id, you, them };
    const offset = tugShift(you, them);
    shift.set(motionActive ? withTiming(offset, { duration: 280, easing: EASE_OUT }) : offset);
    if (updated && motionActive) {
      // Reuse the opening pose so a fresh step update visibly pulls the bodies,
      // including updates where both couples keep the same share of the total.
      openingPull.set(withSequence(
        withTiming(1.1, { duration: 140, easing: EASE_OUT }),
        withTiming(0, { duration: 140, easing: EASE_OUT }),
      ));
      tension.set(1);
      tension.set(withTiming(0, { duration: 280, easing: EASE_OUT }));
    } else tension.set(0);
    return () => { cancelAnimation(shift); cancelAnimation(tension); };
  }, [you, them, challenge.id, motionActive, shift, tension, openingPull]);

  useEffect(() => {
    const previous = previousLeader.current;
    previousLeader.current = { id: challenge.id, value: leader };
    if (previous.id !== challenge.id || previous.value === leader || !motionActive || !leader) {
      setLeadMessage(null);
      leadFlash.set(0);
      return;
    }
    setLeadMessage(leader === 'you' ? "You've taken the lead!" : `${challenge.theirCouple.name} take the lead`);
    leadFlash.set(withSequence(withTiming(1, { duration: 140 }), withTiming(0, { duration: 700 })));
    const timer = setTimeout(() => setLeadMessage(null), 2600);
    return () => { clearTimeout(timer); cancelAnimation(leadFlash); };
  }, [leader, challenge.id, challenge.theirCouple.name, motionActive, leadFlash]);

  const ropeGrips = useDerivedValue(() => {
    // Avoid nested callbacks: React Compiler can hoist them outside the worklet.
    const points = [];
    for (let i = 0; i < IDENTITIES.length; i += 1) {
      const frame = rigGrip(IDENTITIES[i], rigBreath(i < 2 ? leftPhase.get() : rightPhase.get(), i), openingPull.get());
      const side = i < 2 ? 'left' : 'right';
      const top = FLOOR - RIG_BASELINE * SCALE;
      const grips = i < 2 ? [frame.rear, frame.front] : [frame.front, frame.rear];
      for (let g = 0; g < grips.length; g += 1) {
        points.push(stageGrip(grips[g], side, POSITIONS[i] + shift.get(), top, SCALE, 0));
      }
    }
    return points;
  });
  const rope = useAnimatedProps(() => {
    const points = ropeGrips.get();
    const first = points[0];
    const last = points[points.length - 1];
    let segments = '';
    for (let i = 1; i < points.length; i += 1) {
      const previous = points[i - 1];
      if (i === 4) {
        const sag = 1.5 + (1 - tension.get()) * 2;
        segments += `Q${(previous.x + points[i].x) / 2} ${(previous.y + points[i].y) / 2 + sag} ${points[i].x} ${points[i].y} `;
      } else segments += `L${points[i].x} ${points[i].y} `;
    }
    // Meet the outer fists horizontally rather than cutting diagonally across the hands.
    return { d: `M-4 ${FLOOR} C0 ${first.y + 20} ${first.x - 24} ${first.y} ${first.x} ${first.y} `
      + segments
      + ` C${last.x + 24} ${last.y} ${WIDTH} ${last.y + 20} ${WIDTH + 4} ${FLOOR}` };
  });
  const pointer = useAnimatedStyle(() => {
    const points = ropeGrips.get();
    const x = WIDTH / 2 + shift.get();
    const left = points[3];
    const right = points[4];
    const t = Math.max(0, Math.min(1, (x - left.x) / (right.x - left.x)));
    const sag = 1.5 + (1 - tension.get()) * 2;
    const y = left.y + (right.y - left.y) * t + 2 * (1 - t) * t * sag;
    return { transform: [{ translateX: shift.get() * ratio }, { translateY: (y - ROPE_Y) * ratio }] };
  });

  const actorTravel = useAnimatedStyle(() => ({ transform: [{ translateX: shift.get() * ratio }] }));
  const shadowTravel = useAnimatedProps(() => ({ transform: `translate(${shift.get()} 0)` }));

  const leadColor = leader === 'you' ? teal : leader === 'them' ? coral : dark ? '#3A4A44' : '#FFFFFF';
  const status = leader === null ? 'All square' : leader === 'you' ? 'Your couple is ahead' : `${challenge.theirCouple.name} are ahead`;
  const lead = leader === null ? 'The rope is on the centre line.' : `by ${count(Math.abs(you - them))} steps`;
  const end = challenge.endsAt ? new Date(challenge.endsAt) : null;
  const started = challenge.startDayKey ? new Date(`${challenge.startDayKey}T00:00:00`).getTime()
    : new Date(challenge.acceptedAt ?? challenge.createdAt).getTime();
  const elapsed = Math.max(1, Math.floor((Date.now() - started) / 86400000) + 1);
  const totalDays = challenge.startDayKey && challenge.endDayKey
    ? Math.round((new Date(`${challenge.endDayKey}T00:00:00`).getTime() - new Date(`${challenge.startDayKey}T00:00:00`).getTime()) / 86400000) + 1
    : null;
  const day = totalDays ? Math.min(elapsed, totalDays) : elapsed;
  const endLabel = end ? end.getTime() <= Date.now() ? 'Awaiting final result' : `Ends ${end.toLocaleDateString(undefined, { weekday: 'short' })} ${end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : 'Most steps wins';
  const medal = medalForPrize(challenge.prize);
  const prize = medal ? `${medal.name} medal` : challenge.prize ? challenge.prize.charAt(0).toUpperCase() + challenge.prize.slice(1) : 'Bragging rights';
  const teams = [
    { team: challenge.yourCouple, color: teal, soft: tealSoft, label: 'Your couple' },
    { team: challenge.theirCouple, color: coral, soft: coralSoft, label: 'Opponents' },
  ];
  const cardStyle = [styles.card, { backgroundColor: surface, borderColor: dark ? '#63877955' : '#FFFFFF' }];

  return <View style={[styles.page, { backgroundColor: background, minHeight: viewport.height }]}>
    <Image source={COUPLE_PARK} accessible={false} contentFit="fill" cachePolicy="memory-disk" priority="high" transition={0} style={[styles.background, { height: artHeight, top: artTop }]} />
    {dark ? <View pointerEvents="none" style={[styles.background, { height: artHeight, top: artTop, backgroundColor: '#102B2866' }]} /> : null}
    <View style={[styles.topContent, { paddingTop: topInset + 8 }]} onLayout={event => setHeadingBottom(event.nativeEvent.layout.height)}>
      <View style={styles.navigation}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back to competitions"
          style={({ pressed }) => [styles.navButton, pressed && styles.pressed]}><ChevronLeft size={24} color="#203832" strokeWidth={2.4} /></Pressable>
        <View style={styles.titleGroup}>
          <Text accessibilityRole="header" style={styles.title}>Couple Clash</Text>
          <Text style={styles.subtitle}>Step Challenge</Text>
        </View>
        <Pressable onPress={onShare} accessibilityRole="button" accessibilityLabel="Share couple challenge"
          style={({ pressed }) => [styles.navButton, pressed && styles.pressed]}><Share2 size={20} color="#203832" strokeWidth={2.4} /></Pressable>
      </View>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>Day {day}{totalDays ? ` of ${totalDays}` : ''} {'\u00b7'} {challenge.target ? `First to ${count(challenge.target)} steps` : 'Most steps this week'}</Text>
        <View style={styles.prize}>
          {medal ? <CoupleMedal medal={medal} size={18} /> : <Gift size={16} color="#C23A52" strokeWidth={2.4} />}
          <Text style={styles.prizeText} numberOfLines={1}>Winners get {challenge.prize}</Text>
        </View>
      </View>
    </View>

    <Animated.View style={[styles.scene, arenaEntrance, { top: floorY - FLOOR * ratio, height: width * HEIGHT / WIDTH }]} onLayout={event => setWidth(event.nativeEvent.layout.width)}
      accessible accessibilityRole="image" accessibilityLabel={`Tug of war. ${status} ${lead}`} accessibilityLiveRegion="polite">
      <Svg pointerEvents="none" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="shoeShadow">
            <Stop offset="0" stopColor="#20382B" stopOpacity="0.28" />
            <Stop offset="0.5" stopColor="#20382B" stopOpacity="0.12" />
            <Stop offset="1" stopColor="#20382B" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="groundShade">
            <Stop offset="0" stopColor="#355E38" stopOpacity="0.1" />
            <Stop offset="1" stopColor="#355E38" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Ellipse cx={WIDTH / 2} cy={FLOOR + 3} rx="195" ry="15" fill="url(#groundShade)" />
        <AnimatedG animatedProps={shadowTravel}>
        {POSITIONS.map((x, i) => <G key={i}>
          <Ellipse cx={x + FIGURE_WIDTH / 2} cy={FLOOR + 2} rx="43" ry="7" fill="url(#groundShade)" />
          {[48, 230].map(foot => <G key={foot}>
            <Ellipse cx={x + (i > 1 ? TUG_FRAME_WIDTH - foot : foot) * SCALE} cy={FLOOR} rx="14" ry="4" fill="url(#shoeShadow)" />
            <Ellipse cx={x + (i > 1 ? TUG_FRAME_WIDTH - foot : foot) * SCALE} cy={FLOOR - 0.5} rx="9" ry="1.5" fill="#20382B" opacity="0.12" />
          </G>)}
        </G>)}
        </AnimatedG>
        <Path d={`M200 ${ROPE_Y + 22} v9`} stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
        <AnimatedPath animatedProps={rope} stroke="#5B3E1F" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" fill="none" />
        <AnimatedPath animatedProps={rope} stroke="#C0904F" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" fill="none" />
        <AnimatedPath animatedProps={rope} stroke="#F0D39C" strokeWidth="0.65" strokeDasharray="2 3" strokeLinecap="round" fill="none" />
      </Svg>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, actorTravel]}>
      {IDENTITIES.map((_, i) => <CoupleCharacterRig key={i} identity={IDENTITIES[i]} index={i} phase={i < 2 ? leftPhase : rightPhase} openingPull={openingPull} scale={SCALE * ratio} left={POSITIONS[i] * ratio} floor={FLOOR * ratio} />)}
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.pointer, { left: WIDTH / 2 * ratio - MARKER_SIZE / 2, top: ROPE_Y * ratio - MARKER_SIZE }, pointer]}>
        <Svg width={MARKER_SIZE} height={MARKER_SIZE} viewBox="0 0 24 24">
          <Path d="M3 3 H21 L12 21 Z" fill={leader ? leadColor : '#F46F7C'} stroke="#FFFFFF" strokeWidth="2" strokeLinejoin="round" />
        </Svg>
      </Animated.View>
    </Animated.View>

    <Animated.View style={[cardStyle, styles.scoreCard, scoreEntrance, { marginTop: floorY + 40 }]}>
      {teams.map(({ team, color, soft, label }, i) => <React.Fragment key={team.id}>
        {i ? <View style={[styles.scoreDivider, { backgroundColor: border }]} /> : null}
        <View style={styles.score}>
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.scoreHighlight, { backgroundColor: color }, i === 0 ? yourHighlight : theirHighlight]} />
          <View style={[styles.tag, { backgroundColor: soft }]}><Text style={[styles.tagText, { color }]}>{label}</Text></View>
          <View style={styles.nameRow}>
            <CoupleHeads team={team} flip={i === 1} ring={dark ? '#1E302C' : '#FFFFFF'} tint={soft} />
            <Text style={[styles.teamName, { color: text }]} numberOfLines={2}>{team.name}</Text>
          </View>
          <ArenaStepTotal key={`${challenge.id}-${team.id}`} value={team.totalSteps} color={color} muted={muted} animate={motionActive} />
        </View>
      </React.Fragment>)}
    </Animated.View>

    <View style={styles.progressCard}>
      <View style={styles.rowBetween}>
        <Text style={[styles.sectionTitle, { color: text }]}>{challenge.target ? `Race to ${count(challenge.target)} steps` : 'Balance of steps'}</Text>
        <Text style={[styles.progressValue, { color: text }]}>
          {challenge.target ? `${count(Math.max(0, challenge.target - you))} to go` : endLabel}
        </Text>
      </View>
      {challenge.target ? (() => {
        const target = challenge.target;
        const mine = Math.max(0, Math.min(you / target, 1));
        const theirs = Math.max(0, Math.min(them / target, 1));
        return <View style={[styles.track, { backgroundColor: border }]} accessibilityRole="progressbar"
          accessibilityLabel={`Your couple: progress to ${count(target)} steps. ${challenge.theirCouple.name} are at ${Math.round(theirs * 100)} percent.`}
          accessibilityValue={{ min: 0, max: target, now: Math.min(you, target), text: `${Math.round(mine * 100)} percent` }}>
          <View style={[styles.trackFill, { width: `${mine * 100}%`, backgroundColor: teal }]} />
          <View style={[styles.rival, { left: `${theirs * 100}%`, backgroundColor: coral, borderColor: dark ? '#1E302C' : '#FFFFFF' }]} />
        </View>;
      })() : <View style={[styles.track, styles.splitTrack]} accessibilityRole="progressbar" accessibilityLabel="Your share of both couples' steps" accessibilityValue={{ min: 0, max: 100, now: Math.round(share * 100) }}>
        <View style={{ flex: share, backgroundColor: teal }} /><View style={{ flex: 1 - share, backgroundColor: coral }} />
      </View>}
      <Animated.Text key={leadMessage ?? status} entering={reduced ? undefined : FadeIn.duration(180)} style={[styles.caption, { color: leadMessage ? leadColor : muted }]} accessibilityLiveRegion="polite">{leadMessage ?? `${status}${leader ? ` ${lead}` : '. Every step counts.'}`}</Animated.Text>
    </View>

    <View style={[cardStyle, styles.stats]}>
      {[
        { icon: CalendarDays, label: 'Day', value: totalDays ? `${day} / ${totalDays}` : `${day}` },
        { icon: Users, label: 'Couples', value: '2' },
        { icon: Trophy, label: 'Winners', value: prize },
      ].map(({ icon: Icon, label, value }, i) => <React.Fragment key={label}>
        {i ? <View style={[styles.statDivider, { backgroundColor: border }]} /> : null}
        <View style={styles.stat}>
          <View style={[styles.statIcon, { backgroundColor: coralSoft }]}><Icon size={17} color={coral} strokeWidth={2.4} /></View>
          <View style={styles.flex}>
            <Text style={[styles.statLabel, { color: muted }]}>{label}</Text>
            <Text style={[styles.statValue, { color: text }]} numberOfLines={1}>{value}</Text>
          </View>
        </View>
      </React.Fragment>)}
    </View>

    <View style={[cardStyle, styles.contributions]}>
      <Pressable onPress={() => setShowContributions(value => !value)} accessibilityRole="button" accessibilityLabel="Individual step contributions" accessibilityState={{ expanded: showContributions }} style={({ pressed }) => [styles.contributionToggle, pressed && styles.pressed]}>
        <Text style={[styles.sectionTitle, { color: text }]}>Every step, together</Text>
        <ChevronRight size={18} color={muted} style={{ transform: [{ rotate: showContributions ? '90deg' : '0deg' }] }} />
      </Pressable>
      {showContributions ? teams.map(({ team, color, soft, label }, t) => <View key={team.id} style={styles.memberGroup}>
        <Text style={[styles.memberGroupLabel, { color }]}>{label} {'\u00b7'} {team.name}</Text>
        {team.members.map((member, i) => <View key={member.id} style={[styles.member, { borderColor: border }]}>
          <Head identity={i % 2 ? 'female' : 'male'} size={28} flip={t === 1} ring={dark ? '#1E302C' : '#FFFFFF'} tint={soft} />
          <Text style={[styles.memberName, { color: text }]} numberOfLines={1}>{member.name}</Text>
          <Text selectable style={[styles.memberSteps, { color: text }]}>{count(member.steps)} <Text style={[styles.unit, { color: muted }]}>steps</Text></Text>
        </View>)}
      </View>) : null}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  page: { width: '100%', paddingBottom: 24 },
  background: { position: 'absolute', top: 0, left: 0, width: '100%' },
  topContent: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2 },
  flex: { flex: 1, minWidth: 0 },
  navigation: { paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  navButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFFE6', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(17, 24, 39, 0.08)' },
  pressed: { opacity: 0.55 },
  heading: { paddingHorizontal: 16, alignItems: 'center', paddingBottom: 8, gap: 8 },
  titleGroup: { flex: 1, alignItems: 'center', paddingVertical: 8, gap: 2 },
  title: { fontSize: 25, lineHeight: 31, fontWeight: '800', letterSpacing: -0.7, textAlign: 'center', color: '#1D2B33' },
  subtitle: { fontSize: 12, lineHeight: 17, fontWeight: '600', color: '#476158' },
  eyebrow: { fontSize: 14, lineHeight: 20, fontWeight: '700', textAlign: 'center', color: '#2C4440' },
  prize: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, borderCurve: 'continuous', backgroundColor: '#FFFFFFE0', maxWidth: '100%', boxShadow: '0 4px 14px rgba(17, 24, 39, 0.06)' },
  prizeText: { fontSize: 14, lineHeight: 20, fontWeight: '600', flexShrink: 1, color: '#1D2B33' },

  scene: { position: 'absolute', left: 0, width: '100%' },
  pointer: { position: 'absolute', width: MARKER_SIZE, height: MARKER_SIZE },
  contributionToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },

  card: { marginHorizontal: 16, borderRadius: 24, borderCurve: 'continuous', borderWidth: 1, boxShadow: '0 4px 16px rgba(32, 44, 41, 0.05)' },
  scoreCard: { flexDirection: 'row', paddingVertical: 18, paddingHorizontal: 12 },
  scoreHighlight: { borderRadius: 16, borderCurve: 'continuous' },
  score: { flex: 1, alignItems: 'center', gap: 8, minWidth: 0 },
  scoreDivider: { width: 1, marginVertical: 6 },
  tag: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  tagText: { fontSize: 12, fontWeight: '600', letterSpacing: 0.2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%', minHeight: 40 },
  heads: { flexDirection: 'row' },
  overlap: { marginLeft: -10 },
  teamName: { fontSize: 15, lineHeight: 20, fontWeight: '600', letterSpacing: -0.3, flexShrink: 1 },

  progressCard: { marginTop: 20, marginHorizontal: 22, gap: 10 },
  sectionTitle: { fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.4 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  progressValue: { fontFamily: NUMBER_FONT, fontSize: 14, lineHeight: 20, fontWeight: '500', fontVariant: ['tabular-nums', 'lining-nums'], letterSpacing: -0.3 },
  track: { height: 12, borderRadius: 6, justifyContent: 'center' },
  trackFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 6 },
  rival: { position: 'absolute', width: 16, height: 16, marginLeft: -8, borderRadius: 8, borderWidth: 3 },
  splitTrack: { flexDirection: 'row', gap: 3, overflow: 'hidden' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '600' },

  stats: { marginTop: 12, flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 10 },
  stat: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, minWidth: 0 },
  statDivider: { width: 1, alignSelf: 'stretch' },
  statIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  statLabel: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  statValue: { fontFamily: NUMBER_FONT, fontSize: 15, lineHeight: 20, fontWeight: '500', letterSpacing: -0.3, fontVariant: ['tabular-nums', 'lining-nums'] },

  contributions: { marginTop: 16, paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  memberGroup: { gap: 2 },
  memberGroupLabel: { fontSize: 13, lineHeight: 18, fontWeight: '600', marginBottom: 4 },
  member: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  memberName: { fontSize: 15, lineHeight: 22, fontWeight: '600', flex: 1 },
  memberSteps: { fontFamily: NUMBER_FONT, fontSize: 15, lineHeight: 22, fontWeight: '500', letterSpacing: -0.3, fontVariant: ['tabular-nums', 'lining-nums'], flexShrink: 1 },
  unit: { fontSize: 12, fontWeight: '600' },
});
