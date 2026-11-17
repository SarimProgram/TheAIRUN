import { useColorScheme } from '@/hooks/use-color-scheme';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Ellipse, Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Check, ChevronLeft, ChevronRight, Clock, Footprints, Gift, Lock, Share2, Target, Trophy, Users, X, type LucideIcon } from 'lucide-react-native';
import CoupleChallengeArena from '@/components/battle/CoupleChallengeArena';
import CoupleMedal from '@/components/battle/CoupleMedal';
import { COUPLE_PARK, COUPLE_REST, OPPONENT_REST } from '@/components/battle/coupleArenaAssets';
import { MEDALS, WIN_MILESTONES, medalForPrize, type WinMilestone } from '@/constants/coupleMedals';
import { useCoupleChallenge } from '@/hooks/useCoupleChallenge';
import {
  CHALLENGE_TYPE_LABELS,
  COUPLE_CODE_PATTERN,
  normalizeCoupleCode,
  type CoupleChallenge,
  type CoupleChallengeType,
  type CoupleView,
  type EarnedMedal,
} from '@/utils/coupleChallengeSim';

const SNEAKER = require('@/assets/battle/challenge-sneaker.png');
const TROPHY = require('@/assets/battle/challenge-trophy.png');

const LIGHT_THEME = {
  bg: '#FFF7F7',
  surface: '#FFFFFF',
  primary: '#137E76',
  primarySoft: 'rgba(19, 126, 118, 0.08)',
  secondary: '#D74559',
  secondarySoft: 'rgba(215, 69, 89, 0.08)',
  coral: '#FF6B6B',
  coralSoft: '#FFE8E8',
  spark: '#F5C04A',
  textMain: '#1F2937',
  textBody: '#4B5563',
  textMuted: '#6B7280',
  border: 'rgba(17, 24, 39, 0.08)',
  danger: '#DC3036',
  inset: '#F3F4F6',
  sheetTop: '#FFE9EA',
};

const BAND = { fill: '#FF6B6B', accent: '#FF8E8E' };

const TYPE_OPTIONS: { type: CoupleChallengeType; art: number; title: string; sub: string; description: string }[] = [
  { type: 'FIRST_TO_100K', art: SNEAKER, title: '100,000', sub: 'steps', description: 'The first couple to reach 100,000 steps together wins.' },
  { type: 'MOST_STEPS_WEEK', art: TROPHY, title: 'Most steps', sub: 'this week', description: 'The couple with the most steps by Sunday night wins.' },
];

const HERO_HEIGHT = 262;
const BAND_HEIGHT = 64;
const SHEET_OVERLAP = 28;
// Both fists of the rest artwork inside its 74x128 contain box; redrawn over the rope so they grip it.
const FIST = { x: 45, y: 50, width: 24, height: 11 };

const formatSteps = (steps: number) => Math.round(steps).toLocaleString('en-US');
const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

function daysLeft(endsAt: string | null) {
  if (!endsAt) return null;
  const end = new Date(endsAt);
  const today = new Date();
  const endDay = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  const startDay = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.round((endDay - startDay) / 86_400_000));
}

function tap() {
  if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export default function CoupleStepsScreen() {
  const { theme: THEME, styles } = useCoupleStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dark = useColorScheme() === 'dark';
  const challenge = useCoupleChallenge();
  const { data, loading, error, simulated } = challenge;
  const [dismissedResultId, setDismissedResultId] = useState<string | null>(null);
  const [visualArena, setVisualArena] = useState(true);

  const runAction = async (action: () => Promise<unknown>) => {
    tap();
    try {
      await action();
    } catch (cause) {
      Alert.alert('Step challenge', cause instanceof Error ? cause.message : 'Something went wrong. Try again.');
    }
  };

  const result = data?.latestResult && data.latestResult.id !== dismissedResultId ? data.latestResult : null;
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/Race'));
  const [medalsOpen, setMedalsOpen] = useState(false);
  const wins = data?.medals ?? [];
  const medalStrip = data?.couple ? <MedalStrip wins={wins} onPress={() => { tap(); setMedalsOpen(true); }} /> : null;
  const medalsSheet = <MedalsSheet visible={medalsOpen} wins={wins} onClose={() => setMedalsOpen(false)} />;

  const viewToggle = (
    <View style={styles.devRow}>
      <View style={styles.flex}>
        <Text style={styles.devTitle}>Visual arena</Text>
        <Text style={styles.devBody}>Watch both couples pull together</Text>
      </View>
      <Switch value={visualArena} onValueChange={value => { tap(); setVisualArena(value); }}
        trackColor={{ true: THEME.secondary }} accessibilityLabel="Show visual couple arena" />
    </View>
  );
  const developerPanel = __DEV__ ? (
    <DevPanel enabled={simulated} onToggle={challenge.setSimulatedMode}
      hasActive={!!data?.active} hasSent={!!data?.sent.length} sim={challenge.sim}
      onResetResult={() => setDismissedResultId(null)} />
  ) : null;

  const renderBody = () => {
    if (loading && !data) {
      return <ActivityIndicator style={styles.loader} color={THEME.coral} />;
    }
    if (error && !data) {
      return (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Couldn’t load your challenge</Text>
          <Text style={styles.body}>{error}</Text>
          <PrimaryButton label="Try again" onPress={() => { void challenge.refetch(); }} />
        </View>
      );
    }
    if (!data?.couple) {
      return (
        <View style={styles.card}>
          <View style={styles.iconBubble}>
            <Users size={22} color={THEME.coral} strokeWidth={2.4} />
          </View>
          <Text style={styles.cardTitle}>Link your partner first</Text>
          <Text style={styles.body}>
            Couple challenges are played as a team. Once you and your partner are linked, you get a couple code to share with another couple.
          </Text>
          <PrimaryButton label="Go to Partner" onPress={() => router.navigate('/Partner')} />
        </View>
      );
    }
    if (data.active) {
      return <>{__DEV__ ? viewToggle : null}<Scoreboard challenge={data.active} /></>;
    }
    if (result) {
      return <ResultCard challenge={result} onNewChallenge={() => setDismissedResultId(result.id)} />;
    }
    return (
      <>
        {data.incoming.map(invite => (
          <InviteCard
            key={invite.id}
            challenge={invite}
            busy={challenge.busy}
            onAccept={() => runAction(() => challenge.accept(invite.id))}
            onDecline={() => runAction(() => challenge.decline(invite.id))}
          />
        ))}
        {data.sent.map(invite => (
          <SentCard key={invite.id} challenge={invite} busy={challenge.busy} onCancel={() => runAction(() => challenge.cancel(invite.id))} />
        ))}
        {data.sent.length === 0 ? (
          <InviteSteps
            busy={challenge.busy}
            couple={data.couple}
            lookup={challenge.lookup}
            onSend={(code, type, prize) => runAction(() => challenge.invite(code, type, prize))}
          />
        ) : (
          <CoupleCodeCard name={data.couple.name} code={data.couple.code} />
        )}
      </>
    );
  };

  if (data?.active && visualArena) {
    const active = data.active;
    return <View style={[styles.container, { backgroundColor: dark ? '#151C18' : THEME.bg }]}>
      <StatusBar style={dark ? "light" : "dark"} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}>
        <CoupleChallengeArena challenge={active} topInset={insets.top} onBack={goBack}
          onShare={() => {
            tap();
            void Share.share({ message: `${active.yourCouple.name} vs ${active.theirCouple.name}: ${formatSteps(active.yourCouple.totalSteps)} vs ${formatSteps(active.theirCouple.totalSteps)} steps. Winners get ${active.prize}!` });
          }} />
        <View style={[styles.content, { paddingTop: 16 }]}>
          {medalStrip}
          {__DEV__ ? <>{viewToggle}{developerPanel}</> : null}
        </View>
      </ScrollView>
      {medalsSheet}
    </View>;
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Hero topInset={insets.top} onBack={goBack} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 32 }]}>
          <LinearGradient pointerEvents="none" colors={[THEME.sheetTop, THEME.bg]} style={styles.sheetGlow} />
          <View style={styles.sheetHeading}>
            <View style={styles.titleRow}>
              <Laurel />
              <Text style={styles.title} accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit>Couple vs Couple</Text>
              <Laurel flip />
            </View>
            <Text style={styles.subtitle}>Team up, compete, and win together!</Text>
          </View>

          {medalStrip}
          {renderBody()}
          {developerPanel}
        </View>
      </ScrollView>
      {medalsSheet}
    </View>
  );
}

function Sparks({ size = 28, color, flip }: { size?: number; color: string; flip?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" accessible={false} style={flip ? { transform: [{ scaleX: -1 }] } : undefined}>
      <Path d="M3 20 L10 21 M8 9 L13 14 M19 3 L19 10" stroke={color} strokeWidth={3} strokeLinecap="round" />
    </Svg>
  );
}

const LEAVES = [
  { x: 15, y: 40, r: -70 }, { x: 9, y: 33, r: -55 }, { x: 6, y: 25, r: -35 }, { x: 5, y: 17, r: -15 }, { x: 7, y: 9, r: 10 },
  { x: 22, y: 36, r: 20 }, { x: 18, y: 29, r: 35 }, { x: 15, y: 21, r: 50 }, { x: 14, y: 13, r: 65 },
];

function Laurel({ flip }: { flip?: boolean }) {
  const { theme: THEME } = useCoupleStyles();
  return (
    <Svg width={28} height={48} viewBox="0 0 28 48" accessible={false} style={flip ? { transform: [{ scaleX: -1 }] } : undefined}>
      <Path d="M22 46 Q6 32 11 4" stroke={THEME.spark} strokeWidth={2.2} fill="none" strokeLinecap="round" />
      {LEAVES.map((leaf, index) => (
        <Ellipse key={index} cx={leaf.x} cy={leaf.y} rx={5.6} ry={3} fill={THEME.spark} transform={`rotate(${leaf.r} ${leaf.x} ${leaf.y})`} />
      ))}
      <Ellipse cx={11} cy={4} rx={3} ry={4.5} fill={THEME.spark} />
    </Svg>
  );
}

function HeroRope({ paths, width, height }: { paths: string[]; width: number; height: number }) {
  return (
    <Svg pointerEvents="none" width={width} height={height} style={StyleSheet.absoluteFill}>
      {paths.map(d => (
        <React.Fragment key={d}>
          <Path d={d} stroke="#5B3E1F" strokeWidth={4.5} strokeLinejoin="round" strokeLinecap="round" fill="none" />
          <Path d={d} stroke="#C0904F" strokeWidth={2.8} strokeLinejoin="round" strokeLinecap="round" fill="none" />
          <Path d={d} stroke="#F0D39C" strokeWidth={1} strokeDasharray="3 4" strokeLinecap="round" fill="none" />
        </React.Fragment>
      ))}
    </Svg>
  );
}

function Hero({ topInset, onBack }: { topInset: number; onBack: () => void }) {
  const { theme: THEME, styles } = useCoupleStyles();
  const dark = useColorScheme() === 'dark';
  const { width } = useWindowDimensions();
  const height = topInset + HERO_HEIGHT;
  const band = topInset + BAND_HEIGHT;
  const ground = height - SHEET_OVERLAP - 8;
  const artHeight = width * 1.5;
  const center = width / 2;
  const figureHeight = 128;
  const figureWidth = 74;
  const figures = [
    { source: COUPLE_REST.male, left: center - 168, flip: false },
    { source: COUPLE_REST.female, left: center - 110, flip: false },
    { source: OPPONENT_REST.female, left: center + 36, flip: true },
    { source: OPPONENT_REST.male, left: center + 94, flip: true },
  ];
  const wave = `M0,0 L${width},0 L${width},${band - 20} Q${width * 0.75},${band + 4} ${width * 0.45},${band - 10} T0,${band - 6} Z`;
  const waveAccent = `M0,0 L${width},0 L${width},${band - 8} Q${width * 0.7},${band + 14} ${width * 0.4},${band} T0,${band + 4} Z`;
  const figureTop = ground - figureHeight;
  const gripY = figureTop + FIST.y + FIST.height / 2;
  const tails = [-1, 1].map(side => {
    const x = (dx: number) => center + side * dx;
    return `M${x(112)} ${gripY} L${x(176)} ${gripY + 2} C${x(190)} ${gripY + 3} ${x(198)} ${ground - 24} ${x(206)} ${ground - 3}`;
  });
  const span = `M${center - 112} ${gripY} L${center - 46} ${gripY} Q${center} ${gripY + 5} ${center + 46} ${gripY} L${center + 112} ${gripY}`;

  return (
    <View style={[styles.hero, { height }]}>
      <Image source={COUPLE_PARK} accessible={false} contentFit="fill" cachePolicy="memory-disk" priority="high" transition={0}
        style={{ position: 'absolute', left: 0, width, height: artHeight, top: ground - artHeight * 0.61 }} />
      {dark ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#102B2866' }]} /> : null}

      <Svg pointerEvents="none" width={width} height={band + 16} style={StyleSheet.absoluteFill}>
        <Path d={waveAccent} fill={BAND.accent} opacity={0.5} />
        <Path d={wave} fill={BAND.fill} />
      </Svg>

      <View style={[styles.heroMedal, { top: band + 4, left: center - 60 }]} pointerEvents="none">
        <Sparks color={THEME.spark} />
        <CoupleMedal medal={MEDALS[0]} size={60} />
        <Sparks color={THEME.spark} flip />
      </View>
      <HeroRope paths={tails} width={width} height={height} />
      {figures.map((figure, index) => (
        <Image key={index} source={figure.source} accessible={false} contentFit="contain" cachePolicy="memory-disk" transition={0}
          style={{ position: 'absolute', width: figureWidth, height: figureHeight, left: figure.left, top: figureTop, transform: figure.flip ? [{ scaleX: -1 }] : undefined }} />
      ))}
      <HeroRope paths={[span]} width={width} height={height} />
      {figures.map((figure, index) => {
        const cropLeft = figure.flip ? figureWidth - FIST.x - FIST.width : FIST.x;
        return (
          <View key={index} pointerEvents="none"
            style={{ position: 'absolute', overflow: 'hidden', left: figure.left + cropLeft, top: figureTop + FIST.y, width: FIST.width, height: FIST.height }}>
            <Image source={figure.source} accessible={false} contentFit="contain" cachePolicy="memory-disk" transition={0}
              style={{ position: 'absolute', width: figureWidth, height: figureHeight, left: -cropLeft, top: -FIST.y, transform: figure.flip ? [{ scaleX: -1 }] : undefined }} />
          </View>
        );
      })}
      <View pointerEvents="none" style={[styles.vsBadge, { top: ground - 86, left: center - 25 }]}>
        <Text style={styles.vsText}>VS</Text>
      </View>

      <View style={[styles.bandRow, { top: topInset + 4 }]}>
        <Pressable
          onPress={onBack}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Back to competitions"
          hitSlop={6}
        >
          <ChevronLeft size={24} color={LIGHT_THEME.textMain} strokeWidth={2.6} />
        </Pressable>
        <Text style={styles.brand} numberOfLines={1}>RunTogether</Text>
        <View style={styles.backButtonSpacer} />
      </View>
    </View>
  );
}

function PrimaryButton({ label, onPress, disabled, busy, icon: Icon, large }: { label: string; onPress: () => void; disabled?: boolean; busy?: boolean; icon?: LucideIcon; large?: boolean }) {
  const { styles } = useCoupleStyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [styles.primaryButton, large && styles.primaryButtonLarge, (disabled || busy) && styles.disabled, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy, busy }}
    >
      {busy ? <ActivityIndicator color="#FFF" /> : <>
        {Icon ? <Icon size={large ? 24 : 20} color="#FFF" strokeWidth={2.4} /> : null}
        <Text style={[styles.primaryButtonText, large && styles.primaryButtonTextLarge]}>{label}</Text>
      </>}
    </Pressable>
  );
}

function SecondaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const { styles } = useCoupleStyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.secondaryButton, disabled && styles.disabled, pressed && styles.pressed]}
      accessibilityRole="button"
    >
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function PillLabel({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  const { theme: THEME, styles } = useCoupleStyles();
  return (
    <View style={styles.pillLabel}>
      <Icon size={20} color={THEME.coral} strokeWidth={2.4} />
      <Text style={styles.pillLabelText} accessibilityRole="header">{label}</Text>
    </View>
  );
}

function shareCode(name: string, code: string) {
  tap();
  void Share.share({ message: `${name} want to take you on in a couple step challenge. Our couple code is ${code}.` });
}

function OwnCodeRow({ name, code }: { name: string; code: string }) {
  const { theme: THEME, styles } = useCoupleStyles();
  return (
    <Pressable
      onPress={() => shareCode(name, code)}
      style={({ pressed }) => [styles.ownCodeRow, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`Share your couple code ${code.split('').join(' ')}`}
    >
      <Text style={styles.ownCodeLabel}>Your code</Text>
      <Text style={styles.ownCode} selectable>{code}</Text>
      <View style={styles.flex} />
      <Share2 size={18} color={THEME.primary} strokeWidth={2.4} />
      <Text style={styles.shareText}>Share</Text>
    </Pressable>
  );
}

function CoupleCodeCard({ name, code }: { name: string; code: string }) {
  const { styles } = useCoupleStyles();
  return (
    <View style={styles.card}>
      <PillLabel icon={Users} label="Your couple code" />
      <OwnCodeRow name={name} code={code} />
      <Text style={styles.body}>Share it with another couple so they can challenge you.</Text>
    </View>
  );
}

function ChallengeMeta({ challenge }: { challenge: CoupleChallenge }) {
  const { theme: THEME, styles } = useCoupleStyles();
  const medal = medalForPrize(challenge.prize);
  return (
    <View style={styles.metaList}>
      <View style={styles.metaItem}>
        <Footprints size={15} color={THEME.coral} strokeWidth={2.4} />
        <Text style={styles.metaText}>{challenge.typeLabel}</Text>
      </View>
      <View style={styles.metaItem}>
        {medal ? <Trophy size={15} color={THEME.coral} strokeWidth={2.4} /> : <Gift size={15} color={THEME.coral} strokeWidth={2.4} />}
        <Text style={styles.metaText}>Winners get {challenge.prize}</Text>
      </View>
    </View>
  );
}

function ChallengeSummary({ eyebrow, title, challenge }: { eyebrow: React.ReactNode; title: string; challenge: CoupleChallenge }) {
  const { styles } = useCoupleStyles();
  const medal = medalForPrize(challenge.prize);
  return (
    <View style={styles.summaryRow}>
      <View style={[styles.flex, styles.summaryText]}>
        {eyebrow}
        <Text style={styles.cardTitle}>{title}</Text>
        <ChallengeMeta challenge={challenge} />
      </View>
      {medal ? <CoupleMedal medal={medal} size={52} /> : null}
    </View>
  );
}

function InviteCard({ challenge, busy, onAccept, onDecline }: { challenge: CoupleChallenge; busy: boolean; onAccept: () => void; onDecline: () => void }) {
  const { styles } = useCoupleStyles();
  return (
    <View style={[styles.card, styles.highlightCard]}>
      <ChallengeSummary eyebrow={<Text style={styles.eyebrow}>New invite</Text>} title={`${challenge.theirCouple.name} challenged you`} challenge={challenge} />
      <View style={styles.buttonRow}>
        <View style={styles.flex}><SecondaryButton label="Decline" onPress={onDecline} disabled={busy} /></View>
        <View style={styles.flex}><PrimaryButton label="Accept" onPress={onAccept} busy={busy} /></View>
      </View>
    </View>
  );
}

function SentCard({ challenge, busy, onCancel }: { challenge: CoupleChallenge; busy: boolean; onCancel: () => void }) {
  const { theme: THEME, styles } = useCoupleStyles();
  return (
    <View style={styles.card}>
      <ChallengeSummary
        eyebrow={<View style={styles.metaItem}>
          <Clock size={15} color={THEME.textMuted} strokeWidth={2.4} />
          <Text style={styles.eyebrowInline}>Waiting for them to accept</Text>
        </View>}
        title={`You challenged ${challenge.theirCouple.name}`}
        challenge={challenge}
      />
      <SecondaryButton label="Cancel invite" onPress={onCancel} disabled={busy} />
    </View>
  );
}

function Step({ index, icon, label, done, last, children }: { index: number; icon: LucideIcon; label: string; done: boolean; last?: boolean; children: React.ReactNode }) {
  const { styles } = useCoupleStyles();
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepRail}>
        <View style={[styles.stepBadge, done && styles.stepBadgeDone]} accessibilityLabel={done ? `Step ${index} done` : `Step ${index}`}>
          <Text style={[styles.stepNumber, done && styles.stepNumberDone]}>{index}</Text>
        </View>
        {!last ? <View style={styles.stepLine} /> : null}
      </View>
      <View style={[styles.stepBody, !last && styles.stepBodySpaced]}>
        <PillLabel icon={icon} label={label} />
        {children}
      </View>
    </View>
  );
}

function SelectedMark({ selected }: { selected: boolean }) {
  const { styles } = useCoupleStyles();
  return (
    <View style={[styles.selectMark, selected && styles.selectMarkOn]}>
      {selected ? <Check size={14} color="#FFF" strokeWidth={3.2} /> : null}
    </View>
  );
}

function InviteSteps({
  busy,
  couple,
  lookup,
  onSend,
}: {
  busy: boolean;
  couple: CoupleView & { code: string };
  lookup: (code: string) => Promise<CoupleView>;
  onSend: (code: string, type: CoupleChallengeType, prize: string) => Promise<void>;
}) {
  const { theme: THEME, styles } = useCoupleStyles();
  const [code, setCode] = useState('');
  const [opponent, setOpponent] = useState<CoupleView | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [type, setType] = useState<CoupleChallengeType>('FIRST_TO_100K');
  const normalized = normalizeCoupleCode(code);

  const find = async () => {
    if (!COUPLE_CODE_PATTERN.test(normalized)) {
      setLookupError('Couple codes are 6 letters and numbers.');
      return;
    }
    tap();
    setSearching(true);
    setLookupError(null);
    try {
      setOpponent(await lookup(normalized));
    } catch (cause) {
      setOpponent(null);
      setLookupError(cause instanceof Error ? cause.message : 'Could not find that couple.');
    } finally {
      setSearching(false);
    }
  };

  const select = () => { if (process.env.EXPO_OS === 'ios') Haptics.selectionAsync(); };
  const selectedType = TYPE_OPTIONS.find(option => option.type === type)!;

  return (
    <View style={styles.card}>
      <Step index={1} icon={Users} label="Find Couple" done={!!opponent}>
        <View style={styles.codeInputRow}>
          <TextInput
            value={code}
            onChangeText={value => { setCode(value); setOpponent(null); setLookupError(null); }}
            placeholder="e.g. K7Q2MX"
            placeholderTextColor={THEME.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={8}
            returnKeyType="search"
            onSubmitEditing={() => { void find(); }}
            style={styles.codeInput}
            accessibilityLabel="Other couple's code"
          />
          <Pressable
            onPress={() => { void find(); }}
            disabled={searching || !normalized}
            style={({ pressed }) => [styles.findButton, (searching || !normalized) && styles.disabled, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Find couple"
          >
            {searching ? <ActivityIndicator color="#FFF" /> : <Text style={styles.findText}>Find</Text>}
          </Pressable>
        </View>
        {lookupError ? <Text style={styles.errorText} accessibilityRole="alert">{lookupError}</Text> : null}
        {opponent ? (
          <View style={styles.foundRow}>
            <Check size={16} color={THEME.primary} strokeWidth={3} />
            <Text style={styles.foundText}>{opponent.name}</Text>
          </View>
        ) : null}
        <OwnCodeRow name={couple.name} code={couple.code} />
      </Step>

      <Step index={2} icon={Target} label="Pick Challenge" done last>
        <View style={styles.tileRow} accessibilityRole="radiogroup">
          {TYPE_OPTIONS.map(option => {
            const selected = option.type === type;
            return (
              <Pressable
                key={option.type}
                onPress={() => { select(); setType(option.type); }}
                style={({ pressed }) => [styles.tile, selected && styles.tileSelected, pressed && styles.pressed]}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={`${CHALLENGE_TYPE_LABELS[option.type]}. ${option.description}`}
              >
                <View style={styles.tileArt}>
                  <View style={[styles.tileArc, { backgroundColor: selected ? THEME.primarySoft : THEME.coralSoft }]} />
                  <View style={styles.tileSparks}><Sparks size={22} color={THEME.spark} /></View>
                  <Image source={option.art} accessible={false} contentFit="contain" style={styles.tileImage} />
                </View>
                <Text style={[styles.tileTitle, option.title.length > 8 && styles.tileTitleWord]} numberOfLines={1} adjustsFontSizeToFit>{option.title}</Text>
                <Text style={styles.tileSub}>{option.sub}</Text>
                <View style={styles.tileMark}><SelectedMark selected={selected} /></View>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.stepHint}>{selectedType.description}</Text>
      </Step>

      <View style={styles.startBlock}>
        <View>
          <PrimaryButton
            large
            icon={Trophy}
            label="Start Challenge"
            disabled={!opponent}
            busy={busy}
            onPress={() => { if (opponent) void onSend(normalized, type, MEDALS[0].prize); }}
          />
          <View pointerEvents="none" style={styles.ctaSparks}><Sparks size={26} color={THEME.spark} flip /></View>
        </View>
        <Text style={[styles.stepHint, styles.center]}>
          {opponent ? `${opponent.name} get an invite to accept.` : 'Find a couple to start.'}
        </Text>
      </View>
    </View>
  );
}

function milestoneProgress(wins: EarnedMedal[]) {
  const chronological = [...wins].sort((a, b) => Date.parse(a.completedAt) - Date.parse(b.completedAt));
  const earned = WIN_MILESTONES.filter(milestone => wins.length >= milestone.wins);
  const next = WIN_MILESTONES.find(milestone => wins.length < milestone.wins) ?? null;
  const earnedOn = (milestone: WinMilestone) => chronological[milestone.wins - 1]?.completedAt ?? null;
  return { earned, next, earnedOn };
}

function MilestoneBadge({ milestone, size, locked }: { milestone: WinMilestone; size: number; locked?: boolean }) {
  const { theme: THEME } = useCoupleStyles();
  const Icon = milestone.icon;
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center',
      backgroundColor: locked ? THEME.inset : milestone.tint,
      borderWidth: 1.5, borderColor: locked ? THEME.border : `${milestone.color}33`,
    }}>
      <Icon size={size * 0.5} color={locked ? THEME.textMuted : milestone.color} strokeWidth={2.2}
        fill={locked ? 'transparent' : `${milestone.color}40`} />
    </View>
  );
}

function MedalStrip({ wins, onPress }: { wins: EarnedMedal[]; onPress: () => void }) {
  const { theme: THEME, styles } = useCoupleStyles();
  const { earned } = milestoneProgress(wins);
  const start = Math.max(0, Math.min(earned.length - 3, WIN_MILESTONES.length - 4));
  const shown = WIN_MILESTONES.slice(start, start + 4);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.medalStrip, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`Your medals, ${earned.length} earned. Show details`}
    >
      <CoupleMedal medal={MEDALS[0]} size={34} locked={!earned.length} />
      <View style={styles.medalStripText}>
        <Text style={styles.medalStripTitle} numberOfLines={1}>Your Medals</Text>
        <Text style={styles.medalStripSub} numberOfLines={1}>{earned.length ? `${earned.length} earned` : 'None yet'}</Text>
      </View>
      <View style={styles.medalStripDivider} />
      <View style={styles.medalStripBadges}>
        {shown.map(milestone => (
          <MilestoneBadge key={milestone.wins} milestone={milestone} size={34} locked={wins.length < milestone.wins} />
        ))}
      </View>
      <ChevronRight size={22} color={THEME.textMain} strokeWidth={2.4} />
    </Pressable>
  );
}

function MedalsSheet({ visible, wins, onClose }: { visible: boolean; wins: EarnedMedal[]; onClose: () => void }) {
  const { theme: THEME, styles } = useCoupleStyles();
  const insets = useSafeAreaInsets();
  const { earned, next, earnedOn } = milestoneProgress(wins);
  const previous = next ? WIN_MILESTONES[WIN_MILESTONES.indexOf(next) - 1]?.wins ?? 0 : 0;
  const progress = next ? (wins.length - previous) / (next.wins - previous) : 1;
  const recent = [...wins].sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt)).slice(0, 5);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.sheetScreen, { paddingTop: process.env.EXPO_OS === 'ios' ? 12 : Math.max(16, insets.top) }]}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle} accessibilityRole="header">Your Medals</Text>
          <Pressable onPress={onClose} style={({ pressed }) => [styles.sheetClose, pressed && styles.pressed]}
            accessibilityRole="button" accessibilityLabel="Close medals" hitSlop={6}>
            <X size={20} color={THEME.textMain} strokeWidth={2.6} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={[styles.sheetContent, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
          <View style={[styles.card, styles.sheetSummary]}>
            <View style={styles.resultMedal}>
              <Sparks size={28} color={THEME.spark} />
              <CoupleMedal medal={MEDALS[0]} size={72} locked={!earned.length} />
              <Sparks size={28} color={THEME.spark} flip />
            </View>
            <Text style={styles.sheetWins}>{wins.length} {wins.length === 1 ? 'win' : 'wins'} together</Text>
            <Text style={[styles.body, styles.center]}>
              {next
                ? `${next.wins - wins.length} more ${next.wins - wins.length === 1 ? 'win' : 'wins'} to unlock ${next.name}.`
                : 'Every medal unlocked. Legendary.'}
            </Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.max(0.04, progress) * 100}%` }]} />
            </View>
            <Text style={styles.stepHint}>{earned.length} of {WIN_MILESTONES.length} medals earned</Text>
          </View>

          <Text style={styles.sheetSection}>Milestones</Text>
          <View style={[styles.card, styles.milestoneList]}>
            {WIN_MILESTONES.map((milestone, index) => {
              const locked = wins.length < milestone.wins;
              const date = earnedOn(milestone);
              return (
                <View key={milestone.wins} style={[styles.milestoneRow, index > 0 && styles.milestoneRowBorder]} accessible
                  accessibilityLabel={`${milestone.name}. ${milestone.requirement}. ${locked ? `${wins.length} of ${milestone.wins}` : 'Earned'}`}>
                  <MilestoneBadge milestone={milestone} size={48} locked={locked} />
                  <View style={styles.flex}>
                    <Text style={[styles.milestoneName, locked && styles.milestoneLocked]}>{milestone.name}</Text>
                    <Text style={styles.recentBody}>{milestone.requirement}</Text>
                  </View>
                  {locked ? (
                    <View style={styles.milestoneStatus}>
                      <Lock size={13} color={THEME.textMuted} strokeWidth={2.4} />
                      <Text style={styles.recentDate}>{wins.length}/{milestone.wins}</Text>
                    </View>
                  ) : (
                    <View style={[styles.milestoneStatus, styles.milestoneEarned]}>
                      <Check size={13} color={THEME.primary} strokeWidth={3} />
                      <Text style={styles.milestoneEarnedText}>{date ? formatDate(date) : 'Earned'}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          <Text style={styles.sheetSection}>Recent wins</Text>
          <View style={[styles.card, styles.recentList]}>
            {recent.length ? recent.map(win => {
              const medal = medalForPrize(win.prize);
              return (
                <View key={win.id} style={styles.recentRow}>
                  {medal ? <CoupleMedal medal={medal} size={30} /> : <MilestoneBadge milestone={WIN_MILESTONES[0]} size={34} />}
                  <View style={styles.flex}>
                    <Text style={styles.recentTitle} numberOfLines={1}>Beat {win.opponentName}</Text>
                    <Text style={styles.recentBody} numberOfLines={1}>{win.typeLabel}</Text>
                  </View>
                  <Text style={styles.recentDate}>{formatDate(win.completedAt)}</Text>
                </View>
              );
            }) : <Text style={styles.body}>Win your first couple challenge to earn First Victory.</Text>}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function CouplePanel({ couple, accent, label, target }: { couple: CoupleView; accent: string; label: string; target: number | null }) {
  const { styles } = useCoupleStyles();
  const progress = target ? Math.min(couple.totalSteps / target, 1) : null;
  return (
    <View style={styles.couplePanel}>
      <View style={styles.coupleHeader}>
        <View style={[styles.coupleDot, { backgroundColor: accent }]} />
        <Text style={styles.coupleLabel}>{label}</Text>
      </View>
      <Text style={styles.coupleName} numberOfLines={1}>{couple.name}</Text>
      <Text style={styles.coupleTotal}>{formatSteps(couple.totalSteps)}</Text>
      {progress !== null ? (
        <View style={styles.track}>
          <View style={[styles.trackFill, { width: `${progress * 100}%`, backgroundColor: accent }]} />
        </View>
      ) : null}
      <View style={styles.memberList}>
        {couple.members.map(member => (
          <View key={member.id} style={styles.memberRow}>
            <Text style={styles.memberName} numberOfLines={1}>{member.name}</Text>
            <Text style={styles.memberSteps}>{formatSteps(member.steps)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Scoreboard({ challenge }: { challenge: CoupleChallenge }) {
  const { theme: THEME, styles } = useCoupleStyles();
  const you = challenge.yourCouple.totalSteps;
  const them = challenge.theirCouple.totalSteps;
  const remaining = daysLeft(challenge.endsAt);
  const share = you + them > 0 ? you / (you + them) : 0.5;
  const status = you === them ? 'All square' : you > them ? `You lead by ${formatSteps(you - them)}` : `${challenge.theirCouple.name} lead by ${formatSteps(them - you)}`;

  return (
    <View style={styles.card}>
      <View style={styles.liveBadge}>
        <View style={styles.liveDot} />
        <Text style={styles.liveText}>Live</Text>
      </View>
      <ChallengeSummary eyebrow={null} title={`${challenge.yourCouple.name} vs ${challenge.theirCouple.name}`} challenge={challenge} />

      <View style={styles.panels}>
        <CouplePanel couple={challenge.yourCouple} accent={THEME.primary} label="You" target={challenge.target} />
        <CouplePanel couple={challenge.theirCouple} accent={THEME.secondary} label="Them" target={challenge.target} />
      </View>

      {challenge.target ? (
        <Text style={styles.footnote}>
          {status}. First to {formatSteps(challenge.target)} combined steps wins.
        </Text>
      ) : (
        <>
          <View style={styles.splitTrack}>
            <View style={[styles.splitFill, { flex: share, backgroundColor: THEME.primary }]} />
            <View style={[styles.splitFill, { flex: 1 - share, backgroundColor: THEME.secondary }]} />
          </View>
          <Text style={styles.footnote}>
            {status}. {remaining === null ? '' : remaining === 0 ? 'Ends tonight.' : `${remaining} ${remaining === 1 ? 'day' : 'days'} left.`}
          </Text>
        </>
      )}
    </View>
  );
}

function ResultCard({ challenge, onNewChallenge }: { challenge: CoupleChallenge; onNewChallenge: () => void }) {
  const { theme: THEME, styles } = useCoupleStyles();
  const medal = medalForPrize(challenge.prize);
  const won = challenge.winner === 'you';
  const headline = challenge.isTie ? 'It’s a tie' : won ? 'You won!' : `${challenge.theirCouple.name} won`;
  const detail = medal
    ? challenge.isTie
      ? `Nobody takes ${challenge.prize} this time.`
      : won
        ? `${medal.name} medal added to your medal wall.`
        : `${challenge.theirCouple.name} take ${challenge.prize} this time.`
    : challenge.isTie
      ? 'Nobody claims the prize this time.'
      : won
        ? `${challenge.theirCouple.name} owe you ${challenge.prize}.`
        : `You owe them ${challenge.prize}.`;
  return (
    <View style={[styles.card, styles.resultCard]}>
      {medal ? (
        <View style={styles.resultMedal}>
          {won ? <Sparks size={30} color={THEME.spark} /> : null}
          <CoupleMedal medal={medal} size={88} locked={!won} />
          {won ? <Sparks size={30} color={THEME.spark} flip /> : null}
        </View>
      ) : (
        <View style={styles.trophy}>
          <Trophy size={28} color="#FFF" strokeWidth={2.4} />
        </View>
      )}
      <Text style={styles.resultTitle}>{headline}</Text>
      <Text style={[styles.body, styles.center]}>{detail}</Text>
      <View style={styles.resultScores}>
        <View style={styles.resultScore}>
          <Text style={styles.resultValue}>{formatSteps(challenge.yourCouple.totalSteps)}</Text>
          <Text style={styles.resultLabel}>{challenge.yourCouple.name}</Text>
        </View>
        <View style={styles.resultDivider} />
        <View style={styles.resultScore}>
          <Text style={styles.resultValue}>{formatSteps(challenge.theirCouple.totalSteps)}</Text>
          <Text style={styles.resultLabel}>{challenge.theirCouple.name}</Text>
        </View>
      </View>
      <PrimaryButton label="New challenge" icon={Trophy} onPress={onNewChallenge} />
    </View>
  );
}

function DevPanel({
  enabled,
  onToggle,
  hasActive,
  hasSent,
  sim,
  onResetResult,
}: {
  enabled: boolean;
  onToggle: (value: boolean) => void;
  hasActive: boolean;
  hasSent: boolean;
  sim: ReturnType<typeof useCoupleChallenge>['sim'];
  onResetResult: () => void;
}) {
  const { styles } = useCoupleStyles();
  return (
    <View style={styles.devPanel}>
      <View style={styles.devRow}>
        <View style={styles.flex}>
          <Text style={styles.devTitle}>Developer: simulate couples</Text>
          <Text style={styles.devBody}>Skips the real partner link and the other couple, using local sample data.</Text>
        </View>
        <Switch value={enabled} onValueChange={onToggle} accessibilityLabel="Simulate couple challenge without a real link" />
      </View>
      {enabled ? (
        <View style={styles.devActions}>
          <DevButton label="Receive an invite" onPress={sim.receiveInvite} />
          <DevButton label="They accept" onPress={sim.theyAccept} disabled={!hasSent || hasActive} />
          <DevButton label="Add steps" onPress={sim.addSteps} disabled={!hasActive} />
          <DevButton label="Finish now" onPress={sim.finishNow} disabled={!hasActive} />
          <DevButton label="Add 5 wins" onPress={sim.addWins} />
          <DevButton label="Reset" onPress={() => { onResetResult(); void sim.reset(); }} />
        </View>
      ) : null}
    </View>
  );
}

function DevButton({ label, onPress, disabled }: { label: string; onPress: () => unknown; disabled?: boolean }) {
  const { styles } = useCoupleStyles();
  return (
    <Pressable
      onPress={() => { void onPress(); }}
      disabled={disabled}
      style={({ pressed }) => [styles.devButton, disabled && styles.disabled, pressed && styles.pressed]}
      accessibilityRole="button"
    >
      <Text style={styles.devButtonText}>{label}</Text>
    </Pressable>
  );
}

const createStyles = (THEME: typeof LIGHT_THEME) => StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  scrollContent: { flexGrow: 1 },
  content: { paddingHorizontal: 16, gap: 16 },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.94 },
  disabled: { opacity: 0.5 },
  loader: { marginTop: 48 },

  hero: { overflow: 'hidden', backgroundColor: '#BFE3F5' },
  bandRow: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flex: 1, textAlign: 'center', color: '#FFFFFF', fontSize: 20, fontWeight: '800', fontStyle: 'italic', letterSpacing: -0.6 },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(17, 24, 39, 0.12)',
  },
  backButtonSpacer: { width: 44 },
  heroMedal: { position: 'absolute', width: 120, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 },
  vsBadge: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 14px rgba(17, 24, 39, 0.16)',
  },
  vsText: { fontSize: 19, fontWeight: '900', fontStyle: 'italic', color: BAND.fill, letterSpacing: -0.4 },

  sheet: {
    flex: 1,
    marginTop: -SHEET_OVERLAP,
    backgroundColor: THEME.bg,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderCurve: 'continuous',
    overflow: 'hidden',
    paddingTop: 20,
    paddingHorizontal: 16,
    gap: 16,
  },
  sheetGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: 220 },
  sheetHeading: { alignItems: 'center', gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '100%' },
  title: { flexShrink: 1, fontSize: 30, lineHeight: 38, fontWeight: '900', fontStyle: 'italic', color: THEME.textMain, letterSpacing: -0.8 },
  subtitle: { fontSize: 15, lineHeight: 21, fontWeight: '500', color: THEME.textBody, textAlign: 'center' },

  card: {
    backgroundColor: THEME.surface,
    borderRadius: 24,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: THEME.border,
    padding: 16,
    gap: 12,
    boxShadow: '0 8px 24px rgba(255, 107, 107, 0.08)',
  },
  highlightCard: { borderColor: THEME.coral, borderWidth: 1.5 },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.coralSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: { fontSize: 12, fontWeight: '800', color: THEME.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  eyebrowInline: { fontSize: 13, fontWeight: '600', color: THEME.textMuted },
  cardTitle: { fontSize: 18, lineHeight: 24, fontWeight: '800', color: THEME.textMain, letterSpacing: -0.4 },
  body: { fontSize: 14, lineHeight: 21, color: THEME.textBody },
  footnote: { fontSize: 13, lineHeight: 19, fontWeight: '600', color: THEME.textBody },
  errorText: { fontSize: 13, lineHeight: 19, color: THEME.danger },

  pillLabel: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: THEME.coralSoft,
  },
  pillLabelText: { fontSize: 17, fontWeight: '800', color: THEME.textMain, letterSpacing: -0.3 },

  primaryButton: {
    minHeight: 52,
    borderRadius: 26,
    borderCurve: 'continuous',
    backgroundColor: THEME.coral,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
    boxShadow: '0 6px 16px rgba(255, 107, 107, 0.3)',
  },
  primaryButtonLarge: { minHeight: 60, borderRadius: 30 },
  primaryButtonText: { fontSize: 16, fontWeight: '800', color: '#FFF' },
  primaryButtonTextLarge: { fontSize: 19 },
  secondaryButton: {
    minHeight: 52,
    borderRadius: 26,
    borderCurve: 'continuous',
    backgroundColor: THEME.inset,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  secondaryButtonText: { fontSize: 16, fontWeight: '800', color: THEME.textMain },
  buttonRow: { flexDirection: 'row', gap: 10 },
  ctaSparks: { position: 'absolute', right: 6, top: -20 },

  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  summaryText: { gap: 8 },
  shareText: { fontSize: 15, fontWeight: '700', color: THEME.primary },

  stepRow: { flexDirection: 'row', gap: 12 },
  stepRail: { width: 32, alignItems: 'center' },
  stepBadge: {
    width: 32,
    height: 32,
    marginTop: 2,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: THEME.primary,
    backgroundColor: THEME.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeDone: { backgroundColor: THEME.primary },
  stepNumber: { fontSize: 15, fontWeight: '800', color: THEME.primary, fontVariant: ['tabular-nums'] },
  stepNumberDone: { color: '#FFF' },
  stepLine: { flex: 1, width: 2, borderRadius: 1, marginVertical: 4, backgroundColor: THEME.border },
  stepBody: { flex: 1, gap: 12 },
  stepBodySpaced: { paddingBottom: 22 },
  stepHint: { fontSize: 13, lineHeight: 19, color: THEME.textMuted },

  codeInputRow: { flexDirection: 'row', gap: 10 },
  codeInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 52,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: THEME.inset,
    paddingHorizontal: 16,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 2,
    color: THEME.textMain,
  },
  findButton: {
    minHeight: 52,
    minWidth: 92,
    borderRadius: 16,
    borderCurve: 'continuous',
    backgroundColor: THEME.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  findText: { fontSize: 17, fontWeight: '800', color: '#FFF' },
  foundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: THEME.primarySoft,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  foundText: { fontSize: 14, fontWeight: '700', color: THEME.textMain },
  ownCodeRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderCurve: 'continuous',
    backgroundColor: THEME.primarySoft,
  },
  ownCodeLabel: { fontSize: 14, fontWeight: '500', color: THEME.textMuted },
  ownCode: { fontSize: 17, fontWeight: '800', color: THEME.textMain, letterSpacing: 3, fontVariant: ['tabular-nums'] },

  tileRow: { flexDirection: 'row', gap: 10 },
  tile: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 14,
    paddingHorizontal: 8,
    borderRadius: 20,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    borderColor: THEME.border,
    backgroundColor: THEME.surface,
  },
  tileSelected: { borderColor: THEME.primary, backgroundColor: THEME.primarySoft },
  tileArt: { width: 116, height: 82, alignItems: 'center', justifyContent: 'flex-end' },
  tileArc: { position: 'absolute', bottom: 0, width: 104, height: 52, borderTopLeftRadius: 52, borderTopRightRadius: 52 },
  tileSparks: { position: 'absolute', left: 0, top: 4 },
  tileImage: { width: 92, height: 78 },
  tileTitle: { marginTop: 6, fontSize: 24, lineHeight: 30, fontWeight: '900', color: THEME.textMain, letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
  tileTitleWord: { fontSize: 20 },
  tileSub: { fontSize: 14, fontWeight: '500', color: THEME.textMuted },
  tileMark: { position: 'absolute', top: 10, right: 10 },
  selectMark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(17, 24, 39, 0.18)',
    backgroundColor: THEME.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectMarkOn: { backgroundColor: THEME.primary, borderColor: THEME.primary },

  startBlock: { gap: 10, marginTop: 8 },

  medalStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 64,
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 10,
    borderRadius: 24,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: THEME.surface,
    boxShadow: '0 8px 24px rgba(255, 107, 107, 0.1)',
  },
  medalStripText: { flexShrink: 1, minWidth: 74 },
  medalStripTitle: { fontSize: 15, fontWeight: '800', color: THEME.textMain },
  medalStripSub: { fontSize: 13, fontWeight: '500', color: THEME.textMuted, marginTop: 1 },
  medalStripDivider: { width: 1, alignSelf: 'stretch', marginVertical: 4, backgroundColor: THEME.border },
  medalStripBadges: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', gap: 4, paddingRight: 2 },

  sheetScreen: { flex: 1, backgroundColor: THEME.bg },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 8 },
  sheetTitle: { fontSize: 26, lineHeight: 32, fontWeight: '900', fontStyle: 'italic', color: THEME.textMain, letterSpacing: -0.6 },
  sheetClose: { width: 40, height: 40, borderRadius: 20, backgroundColor: THEME.inset, alignItems: 'center', justifyContent: 'center' },
  sheetContent: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  sheetSummary: { alignItems: 'center' },
  sheetWins: { fontSize: 22, lineHeight: 28, fontWeight: '900', fontStyle: 'italic', color: THEME.textMain, letterSpacing: -0.4, fontVariant: ['tabular-nums'] },
  sheetSection: { marginTop: 8, marginLeft: 4, fontSize: 13, fontWeight: '800', color: THEME.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  progressTrack: { alignSelf: 'stretch', height: 10, borderRadius: 5, backgroundColor: THEME.inset, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 5, backgroundColor: THEME.coral },
  milestoneList: { gap: 0, paddingVertical: 4 },
  milestoneRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  milestoneRowBorder: { borderTopWidth: 1, borderTopColor: THEME.border },
  milestoneName: { fontSize: 15, fontWeight: '800', color: THEME.textMain },
  milestoneLocked: { color: THEME.textMuted },
  milestoneStatus: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: THEME.inset },
  milestoneEarned: { backgroundColor: THEME.primarySoft },
  milestoneEarnedText: { fontSize: 12, fontWeight: '700', color: THEME.primary },
  recentList: { gap: 10 },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  recentTitle: { fontSize: 14, fontWeight: '700', color: THEME.textMain },
  recentBody: { fontSize: 12, color: THEME.textMuted, marginTop: 1 },
  recentDate: { fontSize: 12, fontWeight: '600', color: THEME.textMuted },

  metaList: { gap: 6 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaText: { flexShrink: 1, fontSize: 13, fontWeight: '600', color: THEME.textBody },

  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: THEME.primarySoft,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: THEME.primary },
  liveText: { fontSize: 12, fontWeight: '700', color: THEME.primary },
  panels: { flexDirection: 'row', gap: 10 },
  couplePanel: {
    flex: 1,
    backgroundColor: THEME.inset,
    borderRadius: 20,
    borderCurve: 'continuous',
    padding: 12,
    gap: 6,
  },
  coupleHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  coupleDot: { width: 8, height: 8, borderRadius: 4 },
  coupleLabel: { fontSize: 12, fontWeight: '700', color: THEME.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  coupleName: { fontSize: 15, fontWeight: '700', color: THEME.textMain },
  coupleTotal: { fontSize: 26, fontWeight: '900', color: THEME.textMain, letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
  track: { height: 6, borderRadius: 3, backgroundColor: 'rgba(17, 24, 39, 0.08)', overflow: 'hidden' },
  trackFill: { height: '100%', borderRadius: 3 },
  memberList: { gap: 4, marginTop: 4 },
  memberRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  memberName: { flexShrink: 1, fontSize: 13, color: THEME.textBody },
  memberSteps: { fontSize: 13, fontWeight: '700', color: THEME.textMain, fontVariant: ['tabular-nums'] },
  splitTrack: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2 },
  splitFill: { height: '100%' },

  resultCard: { alignItems: 'stretch' },
  resultMedal: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  trophy: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: THEME.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultTitle: { fontSize: 26, lineHeight: 32, fontWeight: '900', fontStyle: 'italic', color: THEME.textMain, letterSpacing: -0.6, textAlign: 'center' },
  resultScores: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.inset,
    borderRadius: 20,
    borderCurve: 'continuous',
    paddingVertical: 14,
  },
  resultScore: { flex: 1, alignItems: 'center', gap: 4, paddingHorizontal: 8 },
  resultValue: { fontSize: 20, fontWeight: '900', color: THEME.textMain, fontVariant: ['tabular-nums'] },
  resultLabel: { fontSize: 12, fontWeight: '600', color: THEME.textMuted, textAlign: 'center' },
  resultDivider: { width: 1, height: 36, backgroundColor: THEME.border },

  devPanel: {
    borderRadius: 20,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(17, 24, 39, 0.2)',
    padding: 14,
    gap: 12,
    marginTop: 8,
  },
  devRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  devTitle: { fontSize: 14, fontWeight: '700', color: THEME.textMain },
  devBody: { fontSize: 12, lineHeight: 17, color: THEME.textMuted, marginTop: 2 },
  devActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  devButton: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: THEME.inset,
    alignItems: 'center',
    justifyContent: 'center',
  },
  devButtonText: { fontSize: 13, fontWeight: '700', color: THEME.textMain },
});


function useCoupleStyles() {
  const dark = useColorScheme() === 'dark';
  return useMemo(() => {
    const theme = dark ? {
      ...LIGHT_THEME,
      bg: '#1A1416', surface: '#262022', inset: '#322A2D',
      primary: '#21867B', primarySoft: '#253F37',
      secondary: '#EE9B9F', secondarySoft: '#403034',
      coral: '#FF7A7A', coralSoft: '#43282B',
      textMain: '#F5F3F3', textBody: '#D2C8CA', textMuted: '#B3A8AB',
      border: '#3D3437', danger: '#FFA3A3', sheetTop: '#3A2326',
    } : LIGHT_THEME;
    return { theme, styles: createStyles(theme) };
  }, [dark]);
}
