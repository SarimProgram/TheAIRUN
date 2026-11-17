import { useColorScheme } from '@/hooks/use-color-scheme';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Image, Pressable, type PressableProps,
  RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import Animated, {
  cancelAnimation, Easing, FadeIn, FadeInDown, LinearTransition, ReduceMotion,
  useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { ArrowUpRight, Check, ChevronRight, Clock, Crown, Flame, Footprints, Trophy, Users, Zap } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import TugOfWar from './TugOfWar';
import AnimatedStepCount from './AnimatedStepCount';
import { getOppositeWeeklyAvatarSource, getWeeklyAvatarSource } from '@/utils/genderMascot';
import type { CoupleChallengeState } from '@/utils/coupleChallengeSim';

// One shape family: 24pt cards, 16pt tiles and controls, pills and circular badges.
const CORAL = '#FF6B6B';
const CORAL_INK = '#BF414B';
const TEAL = '#0E8A90';
const EASE = Easing.bezier(0.23, 1, 0.32, 1);
const SPRING = { duration: 300, dampingRatio: 1, reduceMotion: ReduceMotion.System } as const;
const MARKER = 32;
const STREAK_DOTS = 5;
export const PALETTES = {
  light: { bg: '#FFF7F7', card: '#FFFFFF', ink: '#182033', muted: '#64748B', line: '#F1E4E6', soft: '#FFECEC', tile: '#FFF4F4', tealSoft: '#DDF4F4', arena: '#FFE6E8', track: '#F1F2F5', coralInk: CORAL_INK },
  dark: { bg: '#0F172A', card: '#1F2937', ink: '#F1F5F9', muted: '#CBD5E1', line: '#334155', soft: '#39252C', tile: '#2A3342', tealSoft: '#193E43', arena: '#39252C', track: '#374151', coralInk: '#FFA4AA' },
};
type Palette = typeof PALETTES.light;
export type BattleDay = { dayKey: string; youSteps: number; partnerSteps: number; winner: 'YOU' | 'PARTNER' | 'TIE' };
type Participant = { name: string; liveTodaySteps: number; timezone: string };
export type BattleState = {
  hasPartner: boolean;
  participants: { you: Participant; partner: Participant } | null;
  comparison: { youSteps: number; partnerSteps: number };
  transition: { isSplitDay: boolean; countdownLabel: string | null };
  lastMonth: { youWins: number; partnerWins: number; ties: number; days?: BattleDay[] };
};
export type StepbattleViewProps = {
  battle: BattleState | null;
  userName?: string;
  gender?: string;
  authenticated: boolean;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  topInset: number;
  bottomInset: number;
  challenge: CoupleChallengeState | null;
  challengeLoading: boolean;
  challengeError: string | null;
  onRefresh: () => void;
  onConnect: () => void;
  onSignIn: () => void;
  onOpenChallenge: () => void;
};
const fmt = (value: number) => value.toLocaleString();
const compact = (value: number) => value >= 10000 ? `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k` : fmt(value);
const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;
const dateLabel = (key: string, weekday = false) => new Date(`${key}T12:00:00Z`).toLocaleDateString(undefined, weekday ? { weekday: 'short', timeZone: 'UTC' } : { month: 'short', day: 'numeric', timeZone: 'UTC' });
const feedback = () => { void Haptics.selectionAsync().catch(() => {}); };

function SpringButton({ children, style, onPress, disabled, fill, ...props }: PressableProps & { children: React.ReactNode; fill?: boolean }) {
  const scale = useSharedValue(1);
  const motion = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  useEffect(() => () => cancelAnimation(scale), [scale]);
  return <Animated.View style={[fill && { flex: 1 }, motion]}>
    <Pressable {...props} disabled={disabled} accessibilityRole="button" style={state => [typeof style === 'function' ? style(state) : style, disabled && { opacity: 0.5 }]}
      onPressIn={() => { scale.set(withTiming(0.97, { duration: 100, reduceMotion: ReduceMotion.System })); }}
      onPressOut={() => { scale.set(withSpring(1, SPRING)); }}
      onPress={event => { feedback(); onPress?.(event); }}>{children}</Pressable>
  </Animated.View>;
}

function Reveal({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: React.ComponentProps<typeof Animated.View>['style'] }) {
  const reduced = useReducedMotion();
  return <Animated.View style={style} entering={reduced ? FadeIn.duration(150) : FadeInDown.duration(260).delay(delay).easing(EASE).reduceMotion(ReduceMotion.System)}>{children}</Animated.View>;
}

function BattleMeter({ share, empty, colors }: { share: number; empty: boolean; colors: Palette }) {
  const [width, setWidth] = useState(0);
  const progress = useSharedValue(share);
  useEffect(() => {
    progress.set(withTiming(share, { duration: 280, easing: EASE, reduceMotion: ReduceMotion.System }));
    return () => cancelAnimation(progress);
  }, [progress, share]);
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.get() }] }));
  const marker = useAnimatedStyle(() => ({ transform: [{ translateX: Math.min(Math.max(0, width - MARKER), Math.max(0, progress.get() * width - MARKER / 2)) }] }));
  return <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={s.meterWrap} accessible accessibilityLabel={empty ? 'No steps recorded yet' : `You ${Math.round(share * 100)} percent, partner ${Math.round((1 - share) * 100)} percent of combined steps`}>
    <View style={[s.meterTrack, { backgroundColor: empty ? colors.track : TEAL }]}>{!empty && <Animated.View style={[s.meterFill, fill]} />}</View>
    {!empty && <Animated.View style={[s.meterMarker, { backgroundColor: colors.card }, marker]}><Zap size={15} fill={CORAL} color={CORAL} /></Animated.View>}
  </View>;
}

function ChartBar({ value, max, color, faded }: { value: number; max: number; color: string; faded: boolean }) {
  const height = Math.max(value > 0 ? 0.04 : 0, value / max);
  const scale = useSharedValue(0);
  const opacity = useSharedValue(1);
  useEffect(() => {
    scale.set(withTiming(height, { duration: 280, easing: EASE, reduceMotion: ReduceMotion.System }));
    return () => cancelAnimation(scale);
  }, [scale, height]);
  useEffect(() => {
    opacity.set(withTiming(faded ? 0.25 : 1, { duration: 120, reduceMotion: ReduceMotion.System }));
    return () => cancelAnimation(opacity);
  }, [faded, opacity]);
  const motion = useAnimatedStyle(() => ({ transform: [{ scaleY: scale.get() }], opacity: opacity.get() }));
  return <Animated.View style={[s.chartBar, { backgroundColor: color }, motion]} />;
}

function HistoryPeriod({ period, onChange, colors }: { period: 7 | 30; onChange: (value: 7 | 30) => void; colors: Palette }) {
  const [width, setWidth] = useState(0);
  const position = useSharedValue(0);
  useEffect(() => {
    position.set(withSpring(period === 7 ? 0 : 1, SPRING));
    return () => cancelAnimation(position);
  }, [period, position]);
  const motion = useAnimatedStyle(() => ({ transform: [{ translateX: position.get() * Math.max(0, (width - 8) / 2) }] }));
  return <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={[s.periodControl, { backgroundColor: colors.track }]}>
    {width > 0 && <Animated.View pointerEvents="none" style={[s.periodIndicator, { width: (width - 8) / 2, backgroundColor: colors.card }, motion]} />}
    {([7, 30] as const).map(option => <Pressable key={option} accessibilityRole="tab" accessibilityState={{ selected: period === option }} onPress={() => { if (period !== option) { feedback(); onChange(option); } }} style={({ pressed }) => [s.periodTab, pressed && { opacity: 0.65 }]}>
      <Text style={[s.smallBold, { color: period === option ? colors.ink : colors.muted }]}>{option === 7 ? 'Last 7 days' : 'Last 30 days'}</Text>
    </Pressable>)}
  </View>;
}

function Trend({ days, you, partner, colors }: { days: BattleDay[]; you: string; partner: string; colors: Palette }) {
  const [period, setPeriod] = useState<7 | 30>(7);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const recent = days.slice(-period);
  const selected = recent.find(day => day.dayKey === selectedKey);
  const youTotal = recent.reduce((sum, day) => sum + day.youSteps, 0);
  const partnerTotal = recent.reduce((sum, day) => sum + day.partnerSteps, 0);
  const max = Math.max(1, ...recent.flatMap(day => [day.youSteps, day.partnerSteps]));
  const rows = [
    { id: 'you', name: you, steps: youTotal, color: CORAL, wins: recent.filter(day => day.winner === 'YOU').length },
    { id: 'partner', name: partner, steps: partnerTotal, color: TEAL, wins: recent.filter(day => day.winner === 'PARTNER').length },
  ].sort((a, b) => b.steps - a.steps);
  return <View style={[s.panel, { backgroundColor: colors.card }]}>
    <View style={s.between}><Text accessibilityRole="header" style={[s.sectionTitle, { color: colors.ink }]}>History</Text><View style={[s.smallIcon, { backgroundColor: colors.soft }]}><Footprints size={18} color={colors.coralInk} /></View></View>
    <HistoryPeriod period={period} onChange={value => { setPeriod(value); setSelectedKey(null); }} colors={colors} />
    <View style={s.chartSummary}><Text style={[s.chartTotal, { color: colors.ink }]} selectable>{compact(selected ? selected.youSteps + selected.partnerSteps : youTotal + partnerTotal)}</Text><View style={s.flex}><Text style={[s.smallBold, { color: colors.ink }]}>{selected ? dateLabel(selected.dayKey) : 'combined steps'}</Text><Text style={[s.caption, { color: colors.muted }]}>{selected ? `${fmt(selected.youSteps)} you · ${fmt(selected.partnerSteps)} ${firstName(partner)}` : `Over the last ${period} days`}</Text></View></View>
    {recent.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chartScroll}>
      <View style={[s.chartArea, period === 30 && { minWidth: Math.max(280, recent.length * 44) }]}>
      <View pointerEvents="none" style={s.chartGrid}>{[0, 1, 2].map(line => <View key={line} style={[s.chartGridLine, { borderColor: colors.line }]} />)}</View>
      <View style={s.chart}>{recent.map(day => <Pressable key={day.dayKey} accessibilityRole="button" accessibilityLabel={`${dateLabel(day.dayKey)}. You ${fmt(day.youSteps)} steps. Partner ${fmt(day.partnerSteps)} steps.`} accessibilityState={{ selected: day.dayKey === selectedKey }} onPress={() => { feedback(); setSelectedKey(day.dayKey === selectedKey ? null : day.dayKey); }} style={s.chartColumn}>
        <View style={s.barPair}><ChartBar value={day.youSteps} max={max} color={CORAL} faded={!!selected && selected.dayKey !== day.dayKey} /><ChartBar value={day.partnerSteps} max={max} color={TEAL} faded={!!selected && selected.dayKey !== day.dayKey} /></View><Text style={[s.chartLabel, { color: day.dayKey === selectedKey ? colors.ink : colors.muted, fontWeight: day.dayKey === selectedKey ? '800' : '500' }]}>{period === 7 ? dateLabel(day.dayKey, true) : new Date(`${day.dayKey}T12:00:00Z`).getUTCDate()}</Text><View style={[s.chartSelectedDot, { backgroundColor: day.dayKey === selectedKey ? CORAL : 'transparent' }]} />
      </Pressable>)}</View>
    </View></ScrollView> : <View style={s.chartEmpty}><Footprints size={28} color={CORAL} /><Text style={[s.body, { color: colors.muted }]}>Your first steps will show up here.</Text></View>}
    <View style={[s.legend, { borderBottomColor: colors.line }]}><View style={s.inline}><View style={[s.dot, { backgroundColor: CORAL }]} /><Text style={[s.caption, { color: colors.muted }]}>You</Text></View><View style={s.inline}><View style={[s.dot, { backgroundColor: TEAL }]} /><Text numberOfLines={1} style={[s.caption, { color: colors.muted, flexShrink: 1 }]}>{partner}</Text></View><Text style={[s.tiny, { color: colors.muted, marginLeft: 'auto' }]}>{period === 30 ? 'Scroll to explore every day' : 'Tap a day'}</Text></View>
    <View style={s.between}><View style={s.inline}><Trophy size={16} color={colors.coralInk} /><Text style={[s.smallBold, { color: colors.ink }]}>Standings</Text></View><Text style={[s.tiny, { color: colors.muted }]}>TODAY INCLUDED</Text></View>
    {rows.map((row, i) => <Animated.View key={row.id} layout={LinearTransition.duration(200).reduceMotion(ReduceMotion.System)} style={s.leaderRow}>
      <View style={[s.rank, { backgroundColor: i === 0 ? colors.soft : colors.track }]}>{i === 0 && youTotal !== partnerTotal ? <Crown size={16} color={colors.coralInk} /> : <Text style={[s.smallBold, { color: colors.muted }]}>{youTotal === partnerTotal ? '=' : '02'}</Text>}</View><View style={s.flex}><Text style={[s.name, { color: colors.ink }]} numberOfLines={1}>{row.name}</Text><Text style={[s.caption, { color: colors.muted }]}>{row.wins} daily {row.wins === 1 ? 'win' : 'wins'}</Text></View><Text style={[s.leaderCount, { color: colors.ink }]} selectable>{fmt(row.steps)}</Text><View style={[s.playerDot, { backgroundColor: row.color }]} />
    </Animated.View>)}
  </View>;
}

function NamePill({ label, color, leading }: { label: string; color: string; leading: boolean }) {
  return <View style={[s.namePill, { borderColor: color, backgroundColor: leading ? color : 'transparent' }]}>
    {leading ? <Crown size={14} color="#FFFFFF" strokeWidth={2.5} /> : null}
    <Text numberOfLines={1} style={[s.namePillText, { color: leading ? '#FFFFFF' : color }]}>{label}</Text>
  </View>;
}

function TileHeader({ icon, label, trailing, colors }: { icon: React.ReactNode; label: string; trailing?: React.ReactNode; colors: Palette }) {
  return <View style={s.tileHead}>
    <View style={s.inline}>{icon}<Text numberOfLines={1} style={[s.tileLabel, { color: colors.ink }]}>{label}</Text></View>
    {trailing}
  </View>;
}

function StreakTile({ streak, holder, recent, partner, colors }: { streak: number; holder?: BattleDay['winner']; recent: BattleDay[]; partner: string; colors: Palette }) {
  const yours = holder === 'YOU';
  const caption = !streak ? 'Win a day to start one' : yours ? 'You’re on a roll' : `${firstName(partner)} is on a roll`;
  return <View accessible accessibilityLabel={!streak ? 'No winning streak yet' : `${yours ? 'Your' : `${partner}'s`} winning streak: ${streak} ${streak === 1 ? 'day' : 'days'}`} style={[s.tile, { backgroundColor: colors.soft }]}>
    <TileHeader icon={<Flame size={18} color={CORAL} fill={streak ? '#FF6B6B33' : 'transparent'} />} label="Win streak" colors={colors} />
    <View>
      <Text style={[s.tileValue, { color: colors.ink }]} numberOfLines={1}>{streak}<Text style={[s.tileUnit, { color: colors.ink }]}> {streak === 1 ? 'day' : 'days'}</Text></Text>
      <Text numberOfLines={1} style={[s.caption, { color: yours || !streak ? colors.coralInk : TEAL }]}>{caption}</Text>
    </View>
    <View style={s.dotRow}>{Array.from({ length: STREAK_DOTS }, (_, i) => {
      const day = recent[recent.length - STREAK_DOTS + i];
      const won = day && day.winner !== 'TIE' && day.youSteps + day.partnerSteps > 0;
      const color = day?.winner === 'YOU' ? CORAL : TEAL;
      return won ? <View key={i} style={[s.streakDot, { backgroundColor: color, borderColor: color }]}><Check size={12} strokeWidth={3} color="#FFFFFF" /></View>
        : <View key={i} style={[s.streakDot, { borderColor: colors.line }]} />;
    })}</View>
  </View>;
}

function TeamRow({ name, steps, color, colors }: { name: string; steps: number; color: string; colors: Palette }) {
  return <View style={s.teamRow}>
    <View style={[s.dot, { backgroundColor: color }]} />
    <Text numberOfLines={1} style={[s.teamName, { color: colors.muted }]}>{name}</Text>
    <Text style={[s.teamSteps, { color: colors.ink }]}>{compact(steps)}</Text>
  </View>;
}

function CoupleTile({ challenge, loading, error, onPress, colors }: { challenge: CoupleChallengeState | null; loading: boolean; error: string | null; onPress: () => void; colors: Palette }) {
  const active = challenge?.active ?? null;
  const invite = challenge?.incoming[0];
  const waiting = challenge?.sent.find(item => item.status === 'PENDING');
  const checking = loading && !challenge;
  const ours = active?.yourCouple.totalSteps ?? 0;
  const theirs = active?.theirCouple.totalSteps ?? 0;
  const share = ours + theirs ? ours / (ours + theirs) : 0.5;
  const title = checking ? 'Checking…'
    : invite ? `${invite.theirCouple.name} challenged you`
    : waiting ? `Waiting on ${waiting.theirCouple.name}`
    : error && !challenge ? 'Unavailable right now'
    : 'None running';
  const caption = active ? (active.target ? `First to ${compact(active.target)}` : active.typeLabel)
    : invite ? 'Tap to respond'
    : waiting ? 'Starts once they accept'
    : checking ? '' : 'Tap to challenge a couple';
  const trailing = active ? <View style={[s.badge, { backgroundColor: colors.soft }]}><View style={s.liveDot} /><Text style={[s.tinyBold, { color: colors.coralInk }]}>LIVE</Text></View>
    : invite ? <View style={[s.badge, { backgroundColor: colors.soft }]}><Text style={[s.tinyBold, { color: colors.coralInk }]}>NEW</Text></View>
    : checking ? <ActivityIndicator size="small" color={CORAL} />
    : <ChevronRight size={16} color={colors.muted} />;
  return <SpringButton fill onPress={onPress} disabled={checking} accessibilityLabel={active ? `Couple battle, live against ${active.theirCouple.name}. Your team ${fmt(ours)} steps, theirs ${fmt(theirs)}.` : `Couple battle. ${title}. ${caption}`}
    style={[s.tile, { backgroundColor: colors.card }]}>
    <TileHeader icon={<Users size={18} color={CORAL} />} label="Couple battle" trailing={trailing} colors={colors} />
    {active ? <>
      <View style={s.teamList}>
        <TeamRow name="You two" steps={ours} color={CORAL} colors={colors} />
        <TeamRow name={active.theirCouple.name} steps={theirs} color={TEAL} colors={colors} />
      </View>
      <View style={s.tileMeter}>
        <View style={[s.coupleTrack, { backgroundColor: TEAL }]}><View style={[s.coupleFill, { width: `${Math.round(share * 100)}%` }]} /></View>
        <Text numberOfLines={1} style={[s.caption, { color: colors.muted }]}>{caption}</Text>
      </View>
    </> : <View>
      <Text numberOfLines={2} style={[s.tileTitle, { color: colors.ink }]}>{title}</Text>
      {caption ? <Text numberOfLines={1} style={[s.caption, { color: colors.muted }]}>{caption}</Text> : null}
    </View>}
  </SpringButton>;
}

function BattleSkeleton({ colors, arenaHeight }: { colors: Palette; arenaHeight: number }) {
  return <View accessibilityLabel="Loading your battle" style={s.skeletonStack}>
    <View style={[s.skeletonArena, { backgroundColor: colors.soft, height: arenaHeight }]}><ActivityIndicator color={CORAL} /></View>
    <View style={[s.skeletonScore, { backgroundColor: colors.card }]} />
    <View style={s.tileRow}><View style={[s.skeletonTile, { backgroundColor: colors.soft }]} /><View style={[s.skeletonTile, { backgroundColor: colors.card }]} /></View>
  </View>;
}

export default function StepbattleFullView(props: StepbattleViewProps) {
  const { battle, authenticated, loading, error, refreshing, topInset, bottomInset } = props;
  const dark = useColorScheme() === 'dark';
  const colors = PALETTES[dark ? 'dark' : 'light'];
  const { width, fontScale } = useWindowDimensions();
  const contentWidth = Math.min(width, 560);
  const arenaHeight = Math.round(contentWidth * 9 / 16);
  const days = battle?.lastMonth.days ?? [];
  const you = battle?.participants?.you.name || props.userName || 'You';
  const partner = battle?.participants?.partner.name || 'Partner';
  const linked = !!battle?.hasPartner;
  const mine = battle?.comparison.youSteps ?? 0;
  const theirs = battle?.comparison.partnerSteps ?? 0;
  const halfWidth = (contentWidth - 32 - 40 - 1) / 2;
  const digits = Math.max(fmt(mine).length, fmt(theirs).length);
  const scoreFontSize = Math.max(20, Math.min(34, (halfWidth - 8) / ((digits * 0.64 + 0.6) * Math.max(1, fontScale))));
  const vsSize = Math.round(contentWidth * 0.36);
  const difference = mine - theirs;
  const share = mine + theirs ? mine / (mine + theirs) : 0.5;
  const split = !!battle?.transition.isSplitDay;
  const period = split ? 'last day' : 'today';
  // Only completed battles can contribute to a win streak.
  const completedDays = days.slice(0, -1);
  const completed = [...completedDays].reverse();
  const holder = completed[0]?.winner;
  let streak = 0;
  if (holder && holder !== 'TIE') { for (const day of completed) { if (day.winner !== holder) break; streak++; } }
  const headline = mine + theirs === 0 ? 'A fresh start' : difference === 0 ? 'Neck and neck' : difference > 0 ? `You're ${fmt(difference)} ahead` : `${firstName(partner)} leads by ${fmt(-difference)}`;

  return <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ flex: 1, backgroundColor: colors.bg }} showsVerticalScrollIndicator={false} contentContainerStyle={[s.content, { paddingTop: topInset + 8, paddingBottom: bottomInset + 24 }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={props.onRefresh} tintColor={CORAL} progressViewOffset={topInset} />}>
    <Reveal style={s.pageHeading}>
      <Text accessibilityRole="header" style={[s.tagline, { color: colors.ink }]}>Every <Text style={{ color: CORAL }}>step</Text> counts.</Text>
      {linked ? <View style={s.inline}>
        {split ? <Clock size={14} color={colors.muted} /> : null}
        <Text style={[s.metaText, { color: colors.muted }]}>{split ? `Previous day · ${battle?.transition.countdownLabel ?? 'wrapping up'}` : `${headline} today`}</Text>
      </View> : null}
    </Reveal>
    {error ? <View style={[s.error, { backgroundColor: colors.soft }]}><Text accessibilityRole="alert" style={[s.body, { color: colors.ink, flex: 1 }]}>{error}</Text><SpringButton onPress={props.onRefresh} accessibilityLabel="Retry loading battle" style={s.retry}><Text style={[s.smallBold, { color: colors.coralInk }]}>Retry</Text></SpringButton></View> : null}

    {authenticated && loading && !battle ? <BattleSkeleton colors={colors} arenaHeight={arenaHeight} /> : linked ? <>
      <Reveal delay={40} style={[s.arena, { width: contentWidth }]}>
        <Svg width="100%" height="100%" viewBox="0 0 320 240" preserveAspectRatio="none" style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <LinearGradient id="arenaFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.arena} stopOpacity={1} />
              <Stop offset="1" stopColor={colors.arena} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path d="M 0 70 C 0 20, 50 20, 90 36 C 130 50, 190 50, 230 36 C 270 20, 320 20, 320 70 V 240 H 0 Z" fill="url(#arenaFade)" />
        </Svg>
        <Text pointerEvents="none" accessible={false} style={[s.vsBackdrop, { fontSize: vsSize, lineHeight: Math.round(vsSize * 1.3), top: Math.round((arenaHeight - vsSize * 1.3) / 2), color: CORAL, opacity: dark ? 0.12 : 0.08 }]}>VS</Text>
        <View style={{ height: arenaHeight }}>
          <TugOfWar share={share} youSteps={mine} partnerSteps={theirs} you={you} partner={partner} gender={props.gender} difference={difference} arenaWidth={contentWidth} cardColor={colors.card} dark={dark} showCrowns={false} />
        </View>
        <View style={s.pillRow}>
          <NamePill label="You" color={CORAL} leading={difference > 0} />
          <NamePill label={firstName(partner)} color={dark ? '#78D9DC' : TEAL} leading={difference < 0} />
        </View>
      </Reveal>

      <Reveal delay={80}>
        <View accessible accessibilityLabel={`${headline}. You ${fmt(mine)} steps, ${partner} ${fmt(theirs)} steps ${period}.`} style={[s.scoreCard, { backgroundColor: colors.card }]}>
          <View style={s.scoreRow}>
            {([[mine, CORAL], [theirs, dark ? '#78D9DC' : TEAL]] as const).map(([value, color], i) => <React.Fragment key={i}>
              {i ? <View style={[s.scoreDivider, { backgroundColor: colors.line }]} /> : null}
              <View style={s.scoreHalf}>
                <View style={s.scoreLine}>
                  <Footprints size={Math.round(scoreFontSize * 0.6)} color={color} strokeWidth={2.2} />
                  <View style={{ width: Math.ceil(fmt(value).length * scoreFontSize * 0.64) }}><AnimatedStepCount value={value} color={colors.ink} fontSize={scoreFontSize} /></View>
                </View>
                <Text style={[s.caption, { color: colors.muted }]}>steps {period}</Text>
              </View>
            </React.Fragment>)}
          </View>
          <BattleMeter share={share} empty={mine + theirs === 0} colors={colors} />
        </View>
      </Reveal>

      <Reveal delay={120} style={s.tileRow}>
        <View style={s.tileSlot}><StreakTile streak={streak} holder={holder} recent={completedDays} partner={partner} colors={colors} /></View>
        <View style={s.tileSlot}><CoupleTile challenge={props.challenge} loading={props.challengeLoading} error={props.challengeError} onPress={props.onOpenChallenge} colors={colors} /></View>
      </Reveal>
    </> : !loading && !error ? <Reveal><View style={[s.emptyPanel, { backgroundColor: colors.card }]}><View style={[s.emptyArt, { backgroundColor: colors.soft }]}><Image source={getWeeklyAvatarSource(props.gender)} style={s.emptyImage} resizeMode="contain" /><Image source={getOppositeWeeklyAvatarSource(props.gender)} style={s.emptyImage} resizeMode="contain" /></View><Text style={[s.emptyTitle, { color: colors.ink }]}>{authenticated ? 'Better with a partner.' : 'Every step starts here.'}</Text><Text style={[s.body, { color: colors.muted, textAlign: 'center' }]}>{authenticated ? 'Connect with your partner and turn your daily steps into a friendly challenge.' : 'Sign in to track your steps and cheer each other on.'}</Text><SpringButton onPress={authenticated ? props.onConnect : props.onSignIn} style={s.primaryButton}><Text style={s.primaryText}>{authenticated ? 'Find your partner' : 'Sign in'}</Text><ArrowUpRight size={18} color="#FFFFFF" /></SpringButton></View></Reveal> : null}

    {linked ? <Reveal delay={160}><Trend days={days} you={you} partner={partner} colors={colors} /></Reveal> : null}
  </ScrollView>;
}

const s = StyleSheet.create({
  content: { paddingHorizontal: 16, gap: 12, maxWidth: 560, width: '100%', alignSelf: 'center' },
  pageHeading: { alignItems: 'center', gap: 2 },
  tagline: { fontSize: 28, lineHeight: 34, fontWeight: '900', fontStyle: 'italic', letterSpacing: -1, textAlign: 'center' },
  metaText: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  arena: { marginHorizontal: -16, marginTop: -4, alignSelf: 'center', overflow: 'hidden' },
  vsBackdrop: { position: 'absolute', left: 0, right: 0, paddingHorizontal: 32, textAlign: 'center', fontWeight: '900', fontStyle: 'italic', includeFontPadding: false },
  pillRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 36, gap: 12, marginTop: -14 },
  namePill: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1.5, maxWidth: '48%' },
  namePillText: { fontSize: 14, fontWeight: '700', flexShrink: 1 },
  scoreCard: { borderRadius: 24, borderCurve: 'continuous', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 16, gap: 12, boxShadow: '0 2px 12px rgba(191,65,75,0.06)' },
  scoreRow: { flexDirection: 'row', alignItems: 'center' },
  scoreHalf: { flex: 1, minWidth: 0, alignItems: 'center', gap: 0 },
  scoreLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  scoreDivider: { width: 1, alignSelf: 'stretch', marginVertical: 4 },
  meterWrap: { height: MARKER, justifyContent: 'center' },
  meterTrack: { height: 10, borderRadius: 5, overflow: 'hidden' },
  meterFill: { backgroundColor: CORAL, width: '100%', height: '100%', transformOrigin: 'left center' },
  meterMarker: { position: 'absolute', left: 0, width: MARKER, height: MARKER, borderRadius: MARKER / 2, alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(191,65,75,0.25)' },
  tileRow: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  tileSlot: { flex: 1, minWidth: 0 },
  tile: { flex: 1, minHeight: 132, borderRadius: 20, borderCurve: 'continuous', padding: 14, gap: 8, justifyContent: 'space-between', boxShadow: '0 2px 12px rgba(191,65,75,0.06)' },
  tileHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 24 },
  tileLabel: { fontSize: 13, fontWeight: '700' },
  teamList: { gap: 4 },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  teamName: { flex: 1, minWidth: 0, fontSize: 13, fontWeight: '600' },
  teamSteps: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  tileValue: { fontSize: 28, lineHeight: 34, fontWeight: '800', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  tileUnit: { fontSize: 15, fontWeight: '700', letterSpacing: -0.3 },
  tileTitle: { fontSize: 15, lineHeight: 20, fontWeight: '700', letterSpacing: -0.3 },
  tileMeter: { gap: 6 },
  dotRow: { flexDirection: 'row', gap: 4 },
  streakDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: CORAL },
  coupleTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  coupleFill: { height: '100%', backgroundColor: CORAL },
  panel: { borderRadius: 24, borderCurve: 'continuous', padding: 16, gap: 12, boxShadow: '0 2px 12px rgba(191,65,75,0.06)' },
  sectionTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.4 },
  smallIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  periodControl: { flexDirection: 'row', borderRadius: 16, borderCurve: 'continuous', padding: 4 },
  periodIndicator: { position: 'absolute', top: 4, bottom: 4, left: 4, borderRadius: 12, borderCurve: 'continuous', boxShadow: '0 1px 4px rgba(15,23,42,0.08)' },
  periodTab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderCurve: 'continuous', flexDirection: 'row', gap: 6 },
  chartSummary: { flexDirection: 'row', gap: 12, alignItems: 'center', flexWrap: 'wrap' },
  chartTotal: { fontSize: 32, letterSpacing: -1.3, fontWeight: '800', fontVariant: ['tabular-nums'] },
  chartScroll: { flexGrow: 1 },
  chartArea: { paddingTop: 8, flex: 1 },
  chartGrid: { position: 'absolute', top: 8, left: 0, right: 0, height: 112, justifyContent: 'space-between' },
  chartGridLine: { borderTopWidth: 1, borderStyle: 'dashed' },
  chart: { flexDirection: 'row', gap: 8 },
  chartColumn: { flex: 1, minHeight: 148, gap: 8, alignItems: 'center', justifyContent: 'flex-end' },
  barPair: { height: 112, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', width: '100%', gap: 4 },
  chartBar: { height: '100%', width: '30%', maxWidth: 16, borderTopLeftRadius: 4, borderTopRightRadius: 4, transformOrigin: 'center bottom' },
  chartLabel: { fontSize: 9 },
  chartSelectedDot: { width: 4, height: 4, borderRadius: 2 },
  chartEmpty: { height: 148, gap: 12, justifyContent: 'center', alignItems: 'center' },
  legend: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingBottom: 16, borderBottomWidth: 1, flexWrap: 'wrap' },
  leaderRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  rank: { width: 36, height: 36, borderRadius: 16, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  leaderCount: { fontSize: 18, fontWeight: '800', letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
  playerDot: { width: 3, height: 24, borderRadius: 2 },
  emptyPanel: { borderRadius: 24, borderCurve: 'continuous', padding: 24, gap: 20 },
  emptyArt: { height: 228, borderRadius: 16, borderCurve: 'continuous', overflow: 'hidden', flexDirection: 'row', alignItems: 'center', padding: 16 },
  emptyImage: { width: '50%', height: '100%' },
  emptyTitle: { textAlign: 'center', fontSize: 26, lineHeight: 32, fontWeight: '800', letterSpacing: -0.8 },
  primaryButton: { minHeight: 52, backgroundColor: CORAL, borderRadius: 999, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, padding: 12 },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  error: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, borderCurve: 'continuous' },
  retry: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  skeletonStack: { gap: 12 },
  skeletonArena: { marginHorizontal: -16, alignItems: 'center', justifyContent: 'center' },
  skeletonScore: { height: 120, borderRadius: 24, borderCurve: 'continuous' },
  skeletonTile: { flex: 1, height: 132, borderRadius: 20, borderCurve: 'continuous' },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  flex: { flex: 1, minWidth: 0, gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  name: { fontSize: 13, fontWeight: '700' },
  body: { fontSize: 13, lineHeight: 20 },
  caption: { fontSize: 12, lineHeight: 18 },
  smallBold: { fontSize: 12, fontWeight: '700' },
  tiny: { fontSize: 9, lineHeight: 14 },
  tinyBold: { fontSize: 8, fontWeight: '800', letterSpacing: 0.7 },
});
