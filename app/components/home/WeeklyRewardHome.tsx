import { useColorScheme } from '@/hooks/use-color-scheme';
import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { CalendarDays, ChevronDown, ChevronUp, Crown, Play } from 'lucide-react-native';
import Svg, { Defs, Ellipse, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import { useWeekPrize, type WeekPrize, type WeeklyResult } from '../../hooks/useWeekPrize';
import { useWeekCountdown } from '../../hooks/useWeekCountdown';
import WeeklyWinnerCelebration from './WeeklyWinnerCelebration';
import WeekPrizePicker from './WeekPrizePicker';
import WeeklyScoreBar from './WeeklyScoreBar';
import { Image } from 'expo-image';
import { DoodleSignatureSheet } from './DoodleSignature';
import { weeklyRewardColors } from './weeklyRewardTheme';
import AnimatedStepCount from '../battle/AnimatedStepCount';
import { useAuth } from '../../src/auth/authContext';
import { getOppositeGender } from '../../utils/genderMascot';
import EditableAvatar from './EditableAvatar';
import { homeAvatarKey } from '../../lib/home-avatar';
import RewardTrophy from './RewardTrophy';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  interpolate,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
export const REWARD_RESIZE_EASING = Easing.bezier(0.25, 1, 0.5, 1);
export const REWARD_RESIZE_MS = 460;
const RESIZE = { duration: REWARD_RESIZE_MS, easing: REWARD_RESIZE_EASING };
const DROP_IN_MS = 640;
const DROP_IN_LEAD_MS = 420;
const EXPANDED_H = 450;
const COLLAPSED_H = 164;
const AUTO_COLLAPSE_DELAY_MS = 3600;
// First-launch drop-in and auto-collapse run once per app launch; any touch on the card opts out of the collapse.
let pactEntered = false;
let pactAutoCollapseDone = false;

export type WeeklyRewardHomeProps = {
  skipIntro?: boolean;
  initialPrize?: WeekPrize | null;
  refreshVersion?: number;
  onPress: () => void;
  partnerName?: string;
  partnerGender?: string | null;
  partnerId?: string | null;
  hasPartner?: boolean;
  isActive?: boolean;
  showDevPreview?: boolean;
  /** Driven on the UI thread so the surrounding layout resizes in the same frame as the card. */
  heightValue?: SharedValue<number>;
};

export const rewardCardScale = (width: number, height: number) => Math.min((width - 16) / 390, height * 0.6 / EXPANDED_H, 1.25);
export const rewardExpandedHeight = (width: number, height: number) => EXPANDED_H * rewardCardScale(width, height);

export default function WeeklyRewardHome({
  skipIntro = false,
  initialPrize,
  refreshVersion = 0,
  onPress,
  partnerName = 'Partner',
  partnerGender,
  partnerId,
  hasPartner = false,
  isActive = true,
  showDevPreview = true,
  heightValue,
}: WeeklyRewardHomeProps) {
  const { user } = useAuth();
  const { data, loading, saving, error, save, accept, sign, refetch } = useWeekPrize(initialPrize);
  useEffect(() => { if (refreshVersion > 0) void refetch(); }, [refreshVersion, refetch]);
  const [collapsed, setCollapsed] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [celebration, setCelebration] = useState<WeeklyResult | null>(null);
  const [preview, setPreview] = useState<WeeklyResult | null>(null);
  const previewIndex = useRef(0);
  const shownResult = useRef<string | null>(null);
  const finishCelebration = useCallback(() => setCelebration(null), []);
  const dark = useColorScheme() === 'dark';
  const colors = { ...weeklyRewardColors(dark), ...(!dark ? { coral: '#FF4357', teal: '#00A6AB' } : {}) };
  const { width, height } = useWindowDimensions();
  // Scale the complete composition together, keeping the reward below 60% of the viewport.
  const scale = rewardCardScale(width, height);

  // 0 = expanded, 1 = collapsed. Card height, panel cross-fade and the parent pager all read this.
  const progress = useSharedValue(0);
  const [expandedPlay, setExpandedPlay] = useState(0);
  const [compactPlay, setCompactPlay] = useState(0);
  const applyCollapsed = useCallback((next: boolean) => {
    setCollapsed(next);
    setIntroDelay(0);
    progress.value = withTiming(next ? 1 : 0, RESIZE);
    if (next) setCompactPlay(k => k + 1); else setExpandedPlay(k => k + 1);
  }, [progress]);
  useEffect(() => {
    if (celebration && collapsed) applyCollapsed(false);
  }, [celebration, collapsed, applyCollapsed]);
  useAnimatedReaction(() => progress.value, (p) => {
    if (heightValue) heightValue.value = interpolate(p, [0, 1], [EXPANDED_H, COLLAPSED_H]) * scale;
  }, [heightValue, scale]);
  const cardGradientId = `reward-card-${useId().replace(/:/g, '')}`;
  const portraitSize = 108;
  const scoreSize = 44;
  const countdown = useWeekCountdown(data?.weekEnd, isActive);
  const prize = countdown.remaining > 0 ? data?.weekprize : null;
  const initialLoad = loading && !data;

  const titleIn = useSharedValue(skipIntro ? 1 : 0);
  const flash = useSharedValue(0);
  // 1 = lifted above its slot and hidden, 0 = resting in place.
  const dropIn = useSharedValue(skipIntro || pactEntered ? 0 : 1);
  const [introDelay, setIntroDelay] = useState(0);
  const introPlayed = useRef(false);
  useEffect(() => {
    if (!isActive || introPlayed.current) return;
    introPlayed.current = true;
    const firstLaunch = !skipIntro && !pactEntered;
    pactEntered = true;
    const lead = firstLaunch ? DROP_IN_LEAD_MS : 0;
    if (firstLaunch) dropIn.value = withTiming(0, { duration: DROP_IN_MS, easing: REWARD_RESIZE_EASING });
    setIntroDelay(lead);
    setExpandedPlay(k => k + 1);
    titleIn.value = withDelay(lead + 100, withTiming(1, { duration: 560, easing: EASE_OUT }));
  }, [isActive, titleIn, dropIn, skipIntro]);

  const pulse = useCallback(() => withSequence(
    withTiming(1, { duration: 140, easing: EASE_OUT }),
    withTiming(0, { duration: 280, easing: EASE_OUT }),
  ), []);
  const toggleCollapsed = useCallback((next: boolean) => {
    flash.value = pulse();
    applyCollapsed(next);
  }, [flash, pulse, applyCollapsed]);
  const autoCollapse = useCallback(() => {
    flash.value = withSequence(pulse(), withTiming(1, { duration: 140, easing: EASE_OUT }, (finished) => {
      'worklet';
      if (finished) scheduleOnRN(applyCollapsed, true);
    }), withTiming(0, { duration: 280, easing: EASE_OUT }));
  }, [flash, pulse, applyCollapsed]);

  const lastWeek = preview ?? data?.lastWeek;
  const realResult = data?.lastWeek;
  useEffect(() => {
    if (!isActive || pickerVisible || !realResult || !user?.id || error) return;
    let cancelled = false;
    const key = `weekly-winner:${user.id}:${realResult.id}`;
    void AsyncStorage.getItem(key).then(seen => {
      if (cancelled || seen || shownResult.current === key) return;
      shownResult.current = key;
      setCelebration(realResult);
      void AsyncStorage.setItem(key, 'seen').catch(() => {});
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [isActive, pickerVisible, realResult, user?.id, error]);

  useEffect(() => {
    if (pactAutoCollapseDone || collapsed || !isActive || initialLoad || pickerVisible || signatureOpen || celebration) return;
    const timer = setTimeout(() => {
      if (pactAutoCollapseDone) return;
      pactAutoCollapseDone = true;
      autoCollapse();
    }, AUTO_COLLAPSE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [collapsed, isActive, initialLoad, pickerVisible, signatureOpen, celebration, autoCollapse]);

  const cardStyle = useAnimatedStyle(() => ({
    height: interpolate(progress.value, [0, 1], [EXPANDED_H, COLLAPSED_H]) * scale,
    opacity: interpolate(dropIn.value, [0, 0.8], [1, 0], 'clamp'),
    transform: [{ translateY: interpolate(dropIn.value, [0, 1], [0, -72 * scale]) }],
  }));
  const expandedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.55], [1, 0], 'clamp'),
    transform: [{ translateY: interpolate(progress.value, [0, 1], [0, -18 * scale]) }],
  }));
  const compactStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.3, 1], [0, 1], 'clamp'),
    transform: [{ translateY: interpolate(progress.value, [0, 1], [12 * scale, 0]) }],
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(titleIn.value, [0, 0.7], [0, 1], 'clamp'),
    transform: [{ translateY: interpolate(titleIn.value, [0, 1], [8, 0]) }],
  }));
  const laurelLeftStyle = useAnimatedStyle(() => ({
    opacity: interpolate(titleIn.value, [0.15, 0.85], [0, 1], 'clamp'),
    transform: [{ translateX: interpolate(titleIn.value, [0, 1], [12, 0]) }, { rotate: `${interpolate(titleIn.value, [0, 1], [-16, 0])}deg` }],
  }));
  const laurelRightStyle = useAnimatedStyle(() => ({
    opacity: interpolate(titleIn.value, [0.15, 0.85], [0, 1], 'clamp'),
    transform: [{ translateX: interpolate(titleIn.value, [0, 1], [-12, 0]) }, { rotate: `${interpolate(titleIn.value, [0, 1], [16, 0])}deg` }],
  }));
  const pillStyle = useAnimatedStyle(() => ({
    opacity: interpolate(titleIn.value, [0.3, 1], [0, 1], 'clamp'),
    transform: [{ scale: interpolate(titleIn.value, [0.3, 1], [0.95, 1], 'clamp') }],
  }));

  const linked = data?.hasPartner ?? hasPartner;
  const yourGoals = data?.yourGoalsCompleted;
  const partnerGoals = data?.partnerGoalsCompleted;
  const name = data?.partnerName || partnerName;
  const prizeDescription = prize?.replace(/^winner gets\s+/i, '') ?? '';
  const headline = initialLoad ? 'Loading prize...'
    : error ? 'Tap to retry'
      : prize ? /^(a\s+)?massage$/i.test(prizeDescription.trim())
        ? 'Loser owes a massage' : `Winner gets ${prizeDescription}`
        : "What's on the line?";

  const accepted = !!prize && !!data?.accepted;
  const awaitingYou = !!prize && !accepted && data?.proposedByYou === false;
  const awaitingPartner = !!prize && !accepted && data?.proposedByYou === true;
  const stakesStatus = !prize ? 'NOT SET'
    : awaitingYou ? `${name.toLocaleUpperCase()} PROPOSED`
      : awaitingPartner ? `WAITING FOR ${name.toLocaleUpperCase()}` : null;
  const busy = initialLoad || saving;
  const actionLabel = saving ? 'Saving...' : initialLoad ? 'Loading...' : error ? 'Retry'
    : !linked ? 'Connect partner' : awaitingYou ? 'Accept' : prize ? 'Edit' : 'Set reward';
  const actionAccessibilityLabel = error ? 'Retry loading reward' : !linked ? 'Connect partner'
    : awaitingYou ? `Accept prize: ${headline}` : prize ? 'Edit reward' : 'Set reward';

  const previewWinner = () => {
    const winner = (['you', 'partner', 'tie'] as const)[previewIndex.current++ % 3];
    const result: WeeklyResult = {
      id: `preview-${previewIndex.current}`, weekStart: '', weekEnd: '',
      weekprize: prize || 'a massage', winner,
      yourGoalsCompleted: winner === 'partner' ? 16 : 21,
      partnerGoalsCompleted: winner === 'you' ? 16 : 21,
    };
    setPreview(result);
    setCelebration(result);
  };
  const footer = error ? 'Could not load your prize. Tap to retry.' : 'Link your partner to set a prize';
  const handlePress = () => {
    if (error) { void refetch(); return; }
    if (initialLoad) return;
    if (!linked) { onPress(); return; }
    setPickerVisible(true);
  };
  const handleAction = () => {
    if (!awaitingYou) { handlePress(); return; }
    accept().catch(cause => Alert.alert('Could not accept the prize', cause instanceof Error ? cause.message : 'Please try again.'));
  };

  const you = yourGoals ?? 0;
  const them = partnerGoals ?? 0;
  const scored = linked && yourGoals != null && partnerGoals != null;
  const noGoals = scored && you + them === 0;
  const share = scored && !noGoals ? you / (you + them) : 0.5;
  
  const leader = !scored || you === them ? null : you > them ? 'you' : 'partner';

  const renderPortrait = (isYou: boolean, compact = false) => {
    const size = compact ? 44 : portraitSize;
    return (
    <View style={[styles.player, { width: size + 6 }]}>
      <View style={[styles.ring, { backgroundColor: isYou ? colors.tealRing : colors.coralRing }]}>
        <View style={[styles.portrait, { width: size, height: size }, { backgroundColor: isYou ? colors.tealSoft : colors.coralSoft, borderColor: colors.surface }]}>
          <EditableAvatar storageKey={homeAvatarKey(user?.id, isYou ? 'you' : 'partner', partnerId)}
            name={isYou ? 'your' : name} gender={isYou ? user?.gender : partnerGender || getOppositeGender(user?.gender)}
            active={isActive && collapsed === compact && !pickerVisible && !celebration} dimmed={!isYou && !linked} editable={!compact}
            imageStyle={{ position: 'absolute', top: -2, left: -size * 0.13, width: size * 1.21, height: size * 1.36 }} />
        </View>
      </View>
      <View style={[styles.nameBadge, compact && styles.miniNameBadge, { backgroundColor: isYou ? colors.teal : colors.coral }]}>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} style={[styles.name, compact && styles.miniName, { color: '#FFFFFF' }]}>
          {isYou ? 'You' : linked ? name : 'Partner'}
        </Text>
      </View>
    </View>
  );
  };
  const renderScore = (value: number | undefined | null, label: string) => (
    <View accessible accessibilityLabel={label} style={styles.scoreColumn}>
      {value == null ? <Text style={[styles.scoreText, { color: colors.ink }]}>?</Text>
        : <AnimatedStepCount value={value} color={colors.ink} fontSize={scoreSize} animateOnMount />}
    </View>
  );

  const massage = !!prize && /^(a\s+)?massage$/i.test(prizeDescription.trim());
  const openReward = () => {
    if (!prize || error || !linked) { handleAction(); return; }
    Alert.alert('Weekly reward', headline, [
      { text: 'Edit reward', onPress: handlePress },
      ...(awaitingYou ? [{ text: 'Accept reward', onPress: handleAction }] : []),
      { text: data?.yourSignature?.length ? 'Edit signature' : 'Sign reward', onPress: () => setSignatureOpen(true) },
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  return (
    <>
      <Animated.View style={[styles.card, { width: 390 * scale }, cardStyle]}
        onTouchStart={() => { pactAutoCollapseDone = true; }}>
        <Animated.View style={expandedStyle} pointerEvents={collapsed ? 'none' : 'auto'}
          accessibilityElementsHidden={collapsed} importantForAccessibility={collapsed ? 'no-hide-descendants' : 'auto'}>
        <View style={[styles.panel, { transform: [{ scale }], transformOrigin: 'top left' }]}>
          <Svg width={390} height={450} viewBox="0 0 390 450" style={styles.backdrop} pointerEvents="none" accessible={false}>
            <Defs>
              <SvgGradient id={cardGradientId} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={dark ? colors.hero[0] : '#FFF9FA'} />
                <Stop offset="0.48" stopColor={dark ? colors.hero[1] : '#FFFCFC'} />
                <Stop offset="1" stopColor={dark ? colors.hero[2] : '#FFFFFF'} />
              </SvgGradient>
            </Defs>
            <Path d="M104 0H286C350 0 390 40 390 104V426Q390 450 366 450H24Q0 450 0 426V104C0 40 40 0 104 0Z"
              fill={`url(#${cardGradientId})`} />
          </Svg>
          <Pressable accessibilityRole="button" accessibilityLabel="Collapse fitness pact" accessibilityState={{ expanded: true, disabled: !!celebration }}
            accessibilityHint="Shows scores and reward side by side" disabled={!!celebration}
            onPress={() => { void Haptics.selectionAsync(); toggleCollapsed(true); }} style={styles.headerRow}>
            <View style={styles.collapseIcon}><FlashChevron flash={flash} direction="up" color={colors.muted} glow={colors.coral} /></View>
            <RewardTrophy playKey={expandedPlay} delay={introDelay} active={isActive && !collapsed && !celebration} accent={colors.coral} replayable />
            <View style={styles.titleRow}>
              <Animated.View style={laurelLeftStyle}><Laurel /></Animated.View>
              <Animated.Text maxFontSizeMultiplier={1.2} style={[styles.subtitle, { color: colors.ink }, titleStyle]}> Fitness Pact</Animated.Text>
              <Animated.View style={laurelRightStyle}><Laurel flipped /></Animated.View>
            </View>
            <Animated.View style={[styles.countdown, { backgroundColor: dark ? colors.coralSoft : '#FFE7EB' }, pillStyle]}>
              <CalendarDays size={18} color={colors.coral} strokeWidth={2.5} />
              <Text maxFontSizeMultiplier={1.2} style={[styles.countdownText, { color: colors.coral }]}>{countdown.label}</Text>
            </Animated.View>
          </Pressable>
          <WeeklyWinnerCelebration result={isActive ? celebration : null} partnerName={name}
            yourGender={user?.gender} partnerGender={partnerGender || getOppositeGender(user?.gender)} onFinish={finishCelebration}>
            <View testID="weekly-matchup" style={styles.contestants}>
              {renderPortrait(true)}
              <View style={styles.scoreboard}>
                <View style={styles.scoreRow}>
                  {renderScore(yourGoals, yourGoals == null ? 'Your goals are loading' : `You: ${yourGoals} completed goals`)}
                  <Text style={[styles.versusText, { color: colors.coral }]}>-</Text>
                  {renderScore(partnerGoals, partnerGoals == null ? 'Partner goals unavailable' : `${name}: ${partnerGoals} completed goals`)}
                </View>
                <Text maxFontSizeMultiplier={1.2} style={[styles.scoreLabel, { color: colors.muted }]}>Goals completed</Text>
              </View>
              {renderPortrait(false)}
            </View>
            <WeeklyScoreBar share={share} empty={!scored || noGoals} crown={leader} track={colors.track} left="#16BFC3" right="#FF5366" />
          </WeeklyWinnerCelebration>
          <Pressable accessibilityRole="button" accessibilityLabel={`${prize ? headline : actionAccessibilityLabel}${stakesStatus && prize ? `. ${stakesStatus}` : ''}`}
            accessibilityHint={prize ? 'Opens reward editing, acceptance and signatures' : undefined}
            accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={openReward}
            style={({ pressed }) => [styles.rewardBanner, { backgroundColor: dark ? colors.coralSoft : '#FFF0E7' }, pressed && styles.pressed]}>
            {massage ? <>
              <ReferenceArtwork kind="massage" />
              <View style={styles.rewardCopy}>
                <Text maxFontSizeMultiplier={1.2} style={[styles.rewardLabel, { color: colors.ink }]}>Win &amp; get a</Text>
                <Text maxFontSizeMultiplier={1.2} adjustsFontSizeToFit numberOfLines={1} style={[styles.rewardTitle, { color: colors.coral }]}>Massage</Text>
              </View>
            </> : <View style={styles.customRewardCopy}>
              <Text maxFontSizeMultiplier={1.2} style={[styles.rewardLabel, { color: colors.ink }]}>{prize ? 'Win & get' : 'Your weekly reward'}</Text>
              <Text maxFontSizeMultiplier={1.2} numberOfLines={2} adjustsFontSizeToFit style={[styles.customRewardTitle, { color: colors.coral }]}>{prize ? prizeDescription : headline}</Text>
              {!prize && <Text style={[styles.rewardHint, { color: colors.muted }]}>{actionLabel}</Text>}
            </View>}
            {prize && stakesStatus && <Text numberOfLines={1} style={[styles.rewardStatus, { color: colors.coral }]}>{stakesStatus}</Text>}
          </Pressable>
          {(!linked || error) && <Text accessibilityRole={error ? 'alert' : undefined} numberOfLines={1} style={[styles.notice, { color: colors.muted }]}>{footer}</Text>}
          {lastWeek && <Pressable accessibilityRole="button" accessibilityLabel="Replay last week's winner" onPress={() => setCelebration(lastWeek)} style={styles.replay}>
            <Crown size={14} color={colors.coral} /><Text style={[styles.rewardHint, { color: colors.muted }]}>Last week</Text>
          </Pressable>}
          {__DEV__ && showDevPreview && <Pressable accessibilityRole="button" accessibilityLabel="Preview weekly winner" onPress={previewWinner} style={styles.replay}><Play size={14} color={colors.coral} /></Pressable>}
        </View>
        </Animated.View>
        <Animated.View style={[styles.compactLayer, compactStyle]} pointerEvents={collapsed ? 'auto' : 'none'}
          accessibilityElementsHidden={!collapsed} importantForAccessibility={collapsed ? 'auto' : 'no-hide-descendants'}>
        <View testID="weekly-reward-collapsed" style={[styles.compactPanel, { backgroundColor: colors.surface, transform: [{ scale }], transformOrigin: 'top left' }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Expand fitness pact" accessibilityState={{ expanded: false }}
            onPress={() => { void Haptics.selectionAsync(); toggleCollapsed(false); }} style={({ pressed }) => [styles.compactHeader, pressed && styles.pressed]}>
            <RewardTrophy size={24} playKey={compactPlay} active={isActive && collapsed} accent={colors.coral} />
            <Text maxFontSizeMultiplier={1.2} style={[styles.compactTitle, { color: colors.ink }]}>Fitness Pact</Text>
            <View style={styles.compactCountdown}>
              <CalendarDays size={14} color={colors.coral} />
              <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={[styles.compactTime, { color: colors.coral }]}>{countdown.label}</Text>
            </View>
            <FlashChevron flash={flash} direction="down" color={colors.muted} glow={colors.coral} />
          </Pressable>
          <View style={styles.compactBody}>
            <View style={styles.compactMatch}>
              <View style={styles.compactPlayers}>
                {renderPortrait(true, true)}
                <View accessible accessibilityLabel={`You: ${yourGoals ?? 'unavailable'}. ${name}: ${partnerGoals ?? 'unavailable'}. Goals completed.`} style={styles.compactScore}>
                  <Text maxFontSizeMultiplier={1.2} numberOfLines={1} adjustsFontSizeToFit style={[styles.compactScoreText, { color: colors.ink }]}>
                    {yourGoals ?? '?'} <Text style={{ color: colors.coral }}>-</Text> {partnerGoals ?? '?'}
                  </Text>
                </View>
                {renderPortrait(false, true)}
              </View>
              <Text maxFontSizeMultiplier={1.2} style={[styles.scoreLabel, { color: colors.muted }]}>Goals completed</Text>
              <WeeklyScoreBar compact share={share} empty={!scored || noGoals} crown={leader} track={colors.track} left="#16BFC3" right="#FF5366" />
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={prize ? headline : actionAccessibilityLabel}
              accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={openReward}
              style={({ pressed }) => [styles.compactReward, { borderColor: colors.border }, pressed && styles.pressed]}>
              {massage && <View style={styles.miniArtwork}><View style={{ transform: [{ scale: 0.45 }], transformOrigin: 'top left' }}><ReferenceArtwork kind="massage" /></View></View>}
              <Text maxFontSizeMultiplier={1.2} style={[styles.compactRewardLabel, { color: colors.muted }]}>{prize ? 'Win & get' : 'Weekly reward'}</Text>
              <Text maxFontSizeMultiplier={1.2} numberOfLines={2} adjustsFontSizeToFit style={[styles.compactRewardTitle, { color: colors.coral }]}>{massage ? 'Massage' : prize ? prizeDescription : actionLabel}</Text>
              {!!prize && !!stakesStatus && <Text numberOfLines={1} style={[styles.compactStatus, { color: colors.muted }]}>{stakesStatus}</Text>}
            </Pressable>
          </View>
        </View>
        </Animated.View>
      </Animated.View>
      <DoodleSignatureSheet visible={signatureOpen} initialPaths={data?.yourSignature ?? []} partnerName={name}
        colors={colors} onClose={() => setSignatureOpen(false)} onSave={sign} />
      <WeekPrizePicker visible={pickerVisible} currentPrize={prize ?? null} saving={saving}
        onClose={() => setPickerVisible(false)} onSave={save} />
    </>
  );
}

// Display the supplied artwork without rasterizing or altering the reference image.
function ReferenceArtwork(_: { kind: 'massage' }) {
  const crop = { x: 54, y: 912, width: 304, height: 198, displayWidth: 157, displayHeight: 96 };
  const scale = Math.max(crop.displayWidth / crop.width, crop.displayHeight / crop.height);
  return <View pointerEvents="none" accessible={false} style={{ width: crop.displayWidth, height: crop.displayHeight, overflow: 'hidden' }}>
    <Image source={require('../../assets/rewards/reward-reference.png')} contentFit="fill"
      style={{ position: 'absolute', width: 852 * scale, height: 1846 * scale, left: -crop.x * scale, top: -crop.y * scale }} />
  </View>;
}

function FlashChevron({ flash, direction, color, glow }: { flash: SharedValue<number>; direction: 'up' | 'down'; color: string; glow: string }) {
  const haloStyle = useAnimatedStyle(() => ({
    opacity: flash.value * 0.22,
    transform: [{ scale: interpolate(flash.value, [0, 1], [0.7, 1]) }],
  }));
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(flash.value, [0, 1], [1, 1.2]) }],
  }));
  const Icon = direction === 'up' ? ChevronUp : ChevronDown;
  return <View style={styles.flashChevron}>
    <Animated.View style={[styles.flashHalo, { backgroundColor: glow }, haloStyle]} />
    <Animated.View style={iconStyle}><Icon size={20} color={color} /></Animated.View>
  </View>;
}

function Laurel({ flipped = false }: { flipped?: boolean }) {
  return <Svg width={32} height={48} viewBox="0 0 32 48" style={flipped ? { transform: [{ scaleX: -1 }] } : undefined} accessible={false}>
    <Path d="M27 45C9 37 5 19 14 3" fill="none" stroke="#FFABB3" strokeWidth={1.3} />
    {[0, 1, 2, 3, 4, 5, 6].map(i => <React.Fragment key={i}>
      <Ellipse cx={10 + i * i * 0.32} cy={7 + i * 5.5} rx={2} ry={4.2} fill="#FF9CA7" rotation={-28 - i * 9} origin={`${10 + i * i * 0.32}, ${7 + i * 5.5}`} />
      <Ellipse cx={17 + i * i * 0.18} cy={7 + i * 5.5} rx={1.8} ry={3.8} fill="#FFB5BC" rotation={35 - i * 10} origin={`${17 + i * i * 0.18}, ${7 + i * 5.5}`} />
    </React.Fragment>)}
  </Svg>;
}

const styles = StyleSheet.create({
  compactPanel: { width: 390, height: 164, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, borderRadius: 24, borderCurve: 'continuous' },
  compactHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  compactTitle: { flex: 1, fontSize: 18, fontWeight: '800', fontStyle: 'italic' },
  compactCountdown: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  compactTime: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  compactBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  compactMatch: { flex: 1, minWidth: 0 },
  compactPlayers: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  compactScore: { flex: 1, minWidth: 0, alignItems: 'center' },
  compactScoreText: { fontSize: 28, fontWeight: '900', fontVariant: ['tabular-nums'], textAlign: 'center' },
  miniNameBadge: { width: '100%', height: 18, marginTop: -4, paddingHorizontal: 3 },
  miniName: { fontSize: 10 },
  compactReward: { width: 124, minHeight: 88, paddingLeft: 12, borderLeftWidth: 1, justifyContent: 'center', alignItems: 'center' },
  miniArtwork: { width: 71, height: 43, overflow: 'hidden', borderRadius: 12, borderCurve: 'continuous' },
  compactRewardLabel: { fontSize: 10, marginTop: 2 },
  compactRewardTitle: { fontSize: 19, fontWeight: '900', fontStyle: 'italic', textAlign: 'center' },
  compactStatus: { fontSize: 8, textAlign: 'center', marginTop: 2 },
  card: { alignSelf: 'center', overflow: 'hidden' },
  panel: { width: 390, height: 450, paddingHorizontal: 16, paddingTop: 12 },
  backdrop: { ...StyleSheet.absoluteFillObject },
  headerRow: { alignItems: 'center' },
  collapseIcon: { position: 'absolute', right: 0, top: 0, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  subtitle: { fontSize: 31, lineHeight: 43, fontWeight: '900', fontStyle: 'italic', letterSpacing: -1.2, textAlign: 'center' },
  countdown: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 34, paddingHorizontal: 16, borderRadius: 20, borderCurve: 'continuous', boxShadow: '0 3px 6px rgba(244,101,111,0.12)' },
  countdownText: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  contestants: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, gap: 8 },
  scoreboard: { flex: 1, minWidth: 0, alignItems: 'center', paddingBottom: 16 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
  scoreLabel: { marginTop: 4, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  versusText: { fontSize: 35, fontWeight: '900', paddingHorizontal: 2 },
  player: { alignItems: 'center' },
  ring: { padding: 4, borderRadius: 999 },
  portrait: { borderRadius: 999, borderWidth: 3, overflow: 'hidden' },
  nameBadge: { width: '76%', alignItems: 'center', marginTop: -12, paddingHorizontal: 8, height: 27, justifyContent: 'center', borderRadius: 20, borderCurve: 'continuous' },
  name: { fontSize: 15, fontWeight: '800' },
  scoreColumn: { flex: 1, minWidth: 0, alignItems: 'center' },
  scoreText: { fontSize: 44, fontWeight: '900', fontVariant: ['tabular-nums'] },
  rewardBanner: { flexDirection: 'row', alignItems: 'center', height: 96, marginTop: 24, borderRadius: 32, borderCurve: 'continuous', overflow: 'hidden' },
  rewardCopy: { flex: 1, minWidth: 0, paddingRight: 12, paddingLeft: 4 },
  rewardLabel: { fontSize: 18, fontWeight: '600' },
  rewardTitle: { fontSize: 40, lineHeight: 46, fontWeight: '900', fontStyle: 'italic', letterSpacing: -1.8 },
  customRewardCopy: { flex: 1, alignItems: 'center', paddingHorizontal: 20 },
  customRewardTitle: { fontSize: 24, fontWeight: '900', fontStyle: 'italic', textAlign: 'center' },
  rewardHint: { fontSize: 11 },
  rewardStatus: { position: 'absolute', bottom: 3, left: 12, right: 12, textAlign: 'center', fontSize: 8, fontWeight: '800' },
  notice: { fontSize: 11, textAlign: 'center', marginTop: 6 },
  replay: { position: 'absolute', bottom: 0, right: 20, height: 44, flexDirection: 'row', alignItems: 'center', gap: 4 },
  pressed: { opacity: 0.7 },
  compactLayer: { position: 'absolute', top: 0, left: 0 },
  flashChevron: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  flashHalo: { position: 'absolute', width: 32, height: 32, borderRadius: 16 },
});
