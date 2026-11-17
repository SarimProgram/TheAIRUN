import { useColorScheme } from '@/hooks/use-color-scheme';
import React, { useEffect, useId, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowUpRight, Droplet, Send, UserPlus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Animated, { cancelAnimation, Easing, ReduceMotion, useAnimatedProps, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useWaterSync } from '@/hooks/useWaterSync';
import type { PartnerSummaryData } from '@/hooks/usePartnerSummary';
import { useAuth } from '@/src/auth/authContext';
import WaterCharacter from './WaterCharacter';

const AnimatedGroup = Animated.createAnimatedComponent(G);
const WATER_PER_TAP = 250;
const IS_WEB = process.env.EXPO_OS === 'web';
const BODY = 'M48 48 L102 48 L102 60 C102 72 126 76 126 104 L126 214 Q126 238 102 238 L48 238 Q24 238 24 214 L24 104 C24 76 48 72 48 60 Z';
// Two half-waves make one 120-unit period, so the loop joins without a jump.
const WAVE = 'M-120 0 Q-90 -10 -60 0 T0 0 T60 0 T120 0 T180 0 T240 0 T300 0';
const formatMl = (value: number) => Math.round(value).toLocaleString();
const firstName = (value?: string | null) => value?.trim().split(/\s+/)[0] || 'You';
const fillFraction = (value: number, target: number) => Math.max(0, Math.min(1, value / Math.max(1, target)));
const timing = { duration: 650, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System };

/** The liquid moves inside a clipped bottle, so every logged drink raises its surface. */
function WaterBottle({ value, target, accent }: { value: number; target: number; accent: string }) {
  const id = useId().replace(/:/g, '');
  const fill = useSharedValue(fillFraction(value, target));
  const wave = useSharedValue(0);
  const hasWater = value > 0;
  useEffect(() => { fill.set(withTiming(fillFraction(value, target), timing)); }, [fill, target, value]);
  useEffect(() => {
    if (hasWater) {
      wave.set(withRepeat(withTiming(1, { duration: 3200, easing: Easing.linear, reduceMotion: ReduceMotion.System }), -1, false, undefined, ReduceMotion.System));
    }
    return () => { cancelAnimation(wave); wave.set(0); };
  }, [hasWater, wave]);
  const waveProps = useAnimatedProps<{ transform?: string; matrix?: number[] }>(() => {
    const x = -wave.get() * 120;
    return IS_WEB ? { transform: `translate(${x} 0)` } : { matrix: [1, 0, 0, 1, x, 0] };
  });
  const liquidProps = useAnimatedProps<{ transform?: string; matrix?: number[] }>(() => {
    const y = 246 - fill.get() * 170;
    // Native SVG groups consume a matrix; the browser consumes an SVG transform.
    return IS_WEB ? { transform: `translate(0 ${y})` } : { matrix: [1, 0, 0, 1, 0, y] };
  });

  return <Svg width="100%" height="100%" viewBox="0 0 150 252" accessible={false}>
    <Defs>
      <ClipPath id={`${id}clip`}><Path d={BODY} /></ClipPath>
      <LinearGradient id={`${id}glass`} x1="0" x2="1" y1="0" y2="0">
        <Stop offset="0" stopColor="#B9D8E3" stopOpacity={0.7} />
        <Stop offset="0.25" stopColor="#F2FBFF" stopOpacity={0.25} />
        <Stop offset="0.75" stopColor="#E0F2FE" stopOpacity={0.3} />
        <Stop offset="1" stopColor="#80B8CA" stopOpacity={0.7} />
      </LinearGradient>
      <LinearGradient id={`${id}water`} x1="0" x2="0" y1="0" y2="180" gradientUnits="userSpaceOnUse">
        <Stop offset="0" stopColor="#08B8E1" /><Stop offset="1" stopColor="#62E8EA" />
      </LinearGradient>
      <LinearGradient id={`${id}cap`} x1="0" x2="1" y1="0" y2="0">
        <Stop offset="0" stopColor="#FFACA4" /><Stop offset="0.4" stopColor={accent} /><Stop offset="1" stopColor="#EF6266" />
      </LinearGradient>
    </Defs>
    <Ellipse cx={75} cy={244} rx={59} ry={6} fill="#0D9488" opacity={0.1} />
    <Path d={BODY} fill={`url(#${id}glass)`} stroke="#9BBECD" strokeWidth={3} />
    <G clipPath={`url(#${id}clip)`}>
      <AnimatedGroup animatedProps={liquidProps}>
        <AnimatedGroup animatedProps={waveProps}>
          <Path d={`${WAVE} L300 250 L-120 250 Z`} fill={`url(#${id}water)`} />
          <Path d={WAVE} fill="none" stroke="#B5FAFF" strokeWidth={3} opacity={0.65} />
        </AnimatedGroup>
        <Circle cx={94} cy={40} r={4} fill="#D4FCFF" opacity={0.7} />
        <Circle cx={66} cy={86} r={3} fill="#D4FCFF" opacity={0.65} />
        <Circle cx={100} cy={125} r={5} fill="#D4FCFF" opacity={0.6} />
      </AnimatedGroup>
      <Path d="M33 108 L33 213 Q33 228 49 228" stroke="#FFFFFF" strokeOpacity={0.65} strokeWidth={5} strokeLinecap="round" fill="none" />
      <Path d="M109 88 Q118 94 118 108 L118 214" stroke="#FFFFFF" strokeOpacity={0.5} strokeWidth={3} strokeLinecap="round" fill="none" />
      {[110, 129, 148, 167, 186, 205].map((y, index) => <Path key={y} d={`M42 ${y} h${index % 2 === 0 ? 12 : 7}`} stroke="#FFFFFF" strokeOpacity={0.9} strokeWidth={2.5} strokeLinecap="round" />)}
    </G>
    <Rect x={46} y={43} width={58} height={12} rx={4} fill="#BCD5E0" stroke="#99B9C7" strokeWidth={2} />
    <Path d="M100 18 H111 Q129 18 129 32 Q129 46 111 46 H102" fill="none" stroke={accent} strokeWidth={7} />
    <Rect x={43} y={15} width={64} height={29} rx={9} fill={`url(#${id}cap)`} />
    <Path d="M51 21 H94" stroke="#FFD8D2" strokeWidth={3} strokeLinecap="round" opacity={0.7} />
  </Svg>;
}

type Props = {
  onProgressChange?: (metrics: { current: number; target: number }) => void;
  onCompletionChange?: (complete: boolean) => void;
  hideHeader?: boolean;
  hasPartner?: boolean;
  partnerName?: string;
  partnerGender?: string | null;
  partnerSummary?: PartnerSummaryData | null;
  onRemind?: () => void;
};

export default function WaterHome({ hideHeader = false, hasPartner = false, partnerName, partnerGender, partnerSummary, onCompletionChange, onProgressChange, onRemind }: Props) {
  const router = useRouter();
  const { user, accessToken } = useAuth();
  const { waterMl, waterTarget, logWater, loading, error } = useWaterSync({ accessToken });
  useEffect(() => { onCompletionChange?.(!loading && waterTarget > 0 && waterMl >= waterTarget); }, [loading, onCompletionChange, waterMl, waterTarget]);
  useEffect(() => { if (!loading) onProgressChange?.({ current: waterMl, target: waterTarget }); }, [loading, onProgressChange, waterMl, waterTarget]);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const dark = useColorScheme() === 'dark';
  const ink = dark ? '#F1F5F9' : '#111827';
  const muted = dark ? '#A8B7C9' : '#64748B';
  const surface = dark ? '#1E293B' : '#F3F8FC';
  const openDetails = () => router.push({ pathname: '/activity', params: { action: 'water' } });

  const addWater = async () => {
    if (savingRef.current || loading) return;
    savingRef.current = true;
    setSaving(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try { await logWater(WATER_PER_TAP); }
    finally { savingRef.current = false; setSaving(false); }
  };

  const player = (name: string, value: number | null, gender: string | null | undefined, own: boolean) => (
    <View style={styles.player} accessible={false} accessibilityLabel={`${name}, ${value === null ? 'water intake loading' : `${formatMl(value)} of ${formatMl(waterTarget)} millilitres`} today`}>
      <Text style={[styles.amount, { color: own ? '#F56565' : '#0D9488' }]} numberOfLines={1} adjustsFontSizeToFit>{value === null ? '\u2014' : formatMl(value)}</Text>
      <Text style={[styles.target, { color: muted }]}>of {formatMl(waterTarget)}</Text>
      <View style={styles.scene}>
        <View style={[styles.character, own ? styles.characterLeft : styles.characterRight]}>
          <WaterCharacter
            name={name}
            gender={gender}
            role={own ? 'you' : 'partner'}
            hasWater={(value ?? 0) > 0}
            facing={own ? 'right' : 'left'}
            onPress={own ? () => { void addWater(); } : undefined}
            disabled={own && (loading || saving)}
            accessibilityLabel={own ? `Log ${WATER_PER_TAP} millilitres of water` : undefined}
          />
        </View>
        <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={[styles.bottle, own ? styles.bottleRight : styles.bottleLeft]}>
          <WaterBottle value={value ?? 0} target={waterTarget} accent="#FF6B6B" />
        </View>
      </View>
      <Text style={[styles.name, { color: muted }]} numberOfLines={1}>{name.toUpperCase()}</Text>
      {own && <Text style={[styles.tapHint, { color: muted }]} accessibilityLiveRegion="polite">{saving ? 'Logging water\u2026' : 'Tap to log water'}</Text>}
    </View>
  );

  return <View style={[styles.section, hideHeader && styles.embedded, { backgroundColor: dark ? '#0F172A' : '#FFFFFF' }]}>
    {!hideHeader && <View style={styles.header}>
      <View style={styles.badge}><Text style={styles.badgeText}>4</Text></View>
      <View style={styles.headerCopy}>
        <Text accessibilityRole="header" style={[styles.title, { color: ink }]}>Complete your water goal</Text>
      </View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open water tracking" onPress={openDetails} style={styles.headerLink}><ArrowUpRight size={22} color="#FF6B6B" /></TouchableOpacity>
    </View>}

    <View style={styles.arena}>
      {player(firstName(user?.displayName ?? user?.name), loading ? null : waterMl, user?.gender, true)}
      {hasPartner ? <>
        <View style={styles.separator}><View style={styles.dash} /><View style={[styles.dropBadge, { backgroundColor: surface }]}><Droplet size={19} color="#08B8E1" fill="#B0EEFA" /></View><View style={styles.dash} /></View>
        {player(firstName(partnerName || partnerSummary?.name || 'Partner'), partnerSummary?.waterMl ?? null, partnerGender, false)}
      </> : null}
    </View>

    <View style={styles.actions}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={hasPartner ? 'Send a water reminder to your partner' : 'Add a partner'}
        activeOpacity={0.8}
        onPress={() => {
          if (hasPartner && onRemind) {
            onRemind();
            return;
          }
          router.push('/Partner');
        }}
        style={[styles.secondary, { backgroundColor: surface }]}
      >
        {hasPartner ? <Send size={17} color={ink} /> : <UserPlus size={17} color={ink} />}
        <Text style={[styles.secondaryText, { color: ink }]}>{hasPartner ? 'Remind' : 'Add partner'}</Text>
      </TouchableOpacity>
    </View>
    {!!error && <Text accessibilityRole="alert" style={styles.error}>Couldn&apos;t log water. Please try again.</Text>}
  </View>;
}

const styles = StyleSheet.create({
  embedded: { marginHorizontal: 0, paddingHorizontal: 0, paddingVertical: 0 },
  section: { marginHorizontal: -20, paddingHorizontal: 16, paddingVertical: 24, gap: 16 },
  header: { paddingLeft: 32, flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  badge: { position: 'absolute', left: -8, top: 4, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FF6B6B' },
  badgeText: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  headerCopy: { flex: 1, gap: 6, paddingTop: 5 },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '700', letterSpacing: -0.3 },
  headerLink: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  arena: { flexDirection: 'row', alignItems: 'stretch', paddingTop: 4, overflow: 'hidden' },
  player: { flex: 1, minWidth: 0, alignItems: 'center' },
  amount: { fontSize: 28, fontWeight: '800', letterSpacing: -0.7, fontVariant: ['tabular-nums'] },
  target: { fontSize: 12, marginTop: 2 },
  scene: { width: '100%', maxWidth: 210, height: 205, marginTop: 12 },
  character: { position: 'absolute', bottom: 0, width: '65%', height: 205, zIndex: 1 },
  characterLeft: { left: 0 },
  characterRight: { right: 0 },
  bottle: { position: 'absolute', bottom: 0, width: '50%', height: '72%' },
  bottleRight: { right: 0 },
  bottleLeft: { left: 0 },
  name: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5, marginTop: 8 },
  tapHint: { fontSize: 11, marginTop: 4 },
  separator: { width: 28, paddingTop: 16, paddingBottom: 24, alignItems: 'center', gap: 8 },
  dash: { flex: 1, borderLeftWidth: 1.5, borderColor: '#CBD5E1', borderStyle: 'dashed' },
  dropBadge: { width: 28, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: 8 },
  secondary: { flex: 1, minHeight: 48, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 20, borderCurve: 'continuous' },
  secondaryText: { fontSize: 14, fontWeight: '700' },
  error: { color: '#DC2626', fontSize: 13, lineHeight: 18, textAlign: 'center' },
});
