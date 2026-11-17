import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Check, Footprints, Gift, PenLine, X } from 'lucide-react-native';
import Animated, { Easing, FadeIn, FadeInDown, FadeOut, ReduceMotion, useReducedMotion } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { weeklyRewardColors } from './weeklyRewardTheme';
import { DoodleSignatureSheet, DoodleThumb } from './DoodleSignature';
import { CHALLENGE_TYPE_LABELS, type CoupleChallengeType } from '@/utils/coupleChallengeSim';

export type InvitationCardProps = {
  kind: 'race' | 'couple' | 'prize' | 'partner';
  from: string;
  detail: string;
  challengeType?: CoupleChallengeType;
  challengePrize?: string;
  signature?: string[] | null;
  partnerSignature?: string[] | null;
  onAccept: (signature?: string[]) => Promise<unknown>;
  onDeny: () => Promise<unknown>;
};

const artwork = {
  race: require('../../assets/competitions/virtual-race-v2.webp'),
  couple: require('../../assets/competitions/couple-tug-v2.webp'),
  prize: require('../../assets/rewards/massage.png'),
  partner: require('../../assets/imagechat-female.png'),
};
const labels = { race: 'Virtual race', couple: 'Couple challenge', prize: 'Weekly prize', partner: 'Partner invitation' };

/** An invitation stays pending until an explicit response succeeds. */
export default function InvitationCard({ kind, from, detail, challengeType, challengePrize, signature, partnerSignature, onAccept, onDeny }: InvitationCardProps) {
  const colors = weeklyRewardColors(useColorScheme() === 'dark');
  const proposalTitle = detail.trim().replace(/^winner gets\s+/i, '').replace(/^(a|an)\s+/i, '')
    .replace(/(^|\s)\S/g, character => character.toLocaleUpperCase());
  const proposer = /^your partner$/i.test(from.trim()) ? 'your partner' : from;
  const reducedMotion = useReducedMotion();
  const [action, setAction] = useState<'accept' | 'deny' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [draftSignature, setDraftSignature] = useState<string[]>(signature ?? []);
  const locked = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const respond = async (next: 'accept' | 'deny') => {
    if (locked.current) return;
    locked.current = true;
    setAction(next);
    setError(null);
    try {
      await (next === 'accept' ? onAccept(kind === 'prize' ? draftSignature : undefined) : onDeny());
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'Could not send your response. Please try again.');
    } finally {
      locked.current = false;
      if (mounted.current) setAction(null);
    }
  };

  return (
    <Animated.View
      entering={reducedMotion ? FadeIn.duration(180) : FadeInDown.duration(260).easing(Easing.bezier(0.23, 1, 0.32, 1)).reduceMotion(ReduceMotion.System)}
      exiting={FadeOut.duration(160).reduceMotion(ReduceMotion.System)}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={[styles.illustration, kind !== 'race' && styles.proposalIllustration, kind === 'partner' && styles.partnerIllustration, { backgroundColor: colors.coralSoft }]}>
        {kind === 'partner' ? <View style={styles.partnerArt}>
          <Image source={artwork.partner} contentFit="contain" contentPosition="bottom" style={styles.partnerAvatar} accessible={false} />
          <Image source={require('../../assets/imagechat-male.png')} contentFit="contain" contentPosition="bottom" style={styles.partnerAvatar} accessible={false} />
        </View> : kind === 'prize' && !/massage/i.test(detail)
          ? <Gift size={72} strokeWidth={1.5} color={colors.coral} />
          : <Image source={artwork[kind]} contentFit="contain" style={[styles.art, kind !== 'race' && styles.proposalArt]} accessible={false} />}
      </View>
      <View style={styles.body}>
        {kind === 'prize' ? <View style={styles.proposalCopy}>
          <Text style={[styles.proposalLabel, { color: colors.coral }]}>WEEKLY PRIZE</Text>
          <Text selectable accessibilityRole="header" style={[styles.proposalTitle, { color: colors.ink }]}>{proposalTitle}</Text>
          <Text style={[styles.description, styles.proposalByline, { color: colors.muted }]}>
            Proposed by <Text style={[styles.proposer, { color: colors.ink }]}>{proposer}</Text>
          </Text>
        </View> : kind === 'couple' ? <>
          <View style={styles.proposalCopy}>
            <Text style={[styles.proposalLabel, { color: colors.coral }]}>COUPLE CHALLENGE</Text>
            <Text accessibilityRole="header" style={[styles.challengeTitle, { color: colors.ink }]}>
              {challengeType ? CHALLENGE_TYPE_LABELS[challengeType] : detail}
            </Text>
            <Text style={[styles.description, styles.proposalByline, { color: colors.muted }]}>
              Challenged by <Text style={[styles.proposer, { color: colors.ink }]}>{from}</Text>
            </Text>
          </View>
          {challengeType && <View style={styles.challengeRule}>
            <Footprints size={18} color={colors.coral} />
            <Text style={[styles.challengeRuleText, { color: colors.muted }]}>
              {challengeType === 'FIRST_TO_100K' ? 'First couple to reach 100,000 combined steps wins.' : 'Most combined steps by Sunday wins.'}
            </Text>
          </View>}
          {!!challengePrize && <View style={[styles.challengePrize, { borderColor: colors.border }]}>
            <Gift size={22} color={colors.coral} />
            <View style={styles.challengePrizeCopy}>
              <Text style={[styles.signatureLabel, { color: colors.muted }]}>Winners get</Text>
              <Text selectable style={[styles.challengePrizeText, { color: colors.ink }]}>{challengePrize}</Text>
            </View>
          </View>}
        </> : <>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.ink }]}>{labels[kind]}</Text>
          <Text style={[styles.description, { color: colors.muted }]}>From {from}</Text>
          <View style={styles.detail}>
            <Text selectable style={[styles.detailText, { color: colors.ink }]}>{detail}</Text>
          </View>
        </>}
        {kind === 'prize' && <View style={[styles.signatures, { borderColor: colors.border }]}>
          <Pressable accessibilityRole="button" accessibilityLabel={draftSignature.length ? 'Edit your signature' : 'Add your signature'}
            disabled={action !== null} accessibilityState={{ disabled: action !== null }}
            onPress={() => setSignatureOpen(true)}
            style={({ pressed }) => [styles.signature, pressed && { opacity: 0.7 }]}>
            <View style={styles.signatureHeading}>
              <Text style={[styles.signatureLabel, { color: colors.muted }]}>Your signature</Text>
              <PenLine size={14} color={colors.coral} />
            </View>
            {draftSignature.length ? <DoodleThumb paths={draftSignature} color={colors.ink} height={40} />
              : <Text style={[styles.signPrompt, { color: colors.coral }]}>Tap to sign</Text>}
            <View style={[styles.signatureLine, { backgroundColor: colors.border }]} />
          </Pressable>
          {!!partnerSignature?.length && <View style={styles.signature} accessible accessibilityLabel={`${proposer} signed`}>
            <Text style={[styles.signatureLabel, { color: colors.muted }]}>{proposer}</Text>
            <DoodleThumb paths={partnerSignature} color={colors.ink} height={40} />
            <View style={[styles.signatureLine, { backgroundColor: colors.border }]} />
          </View>}
        </View>}
        {error && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.error, { color: colors.coral }]}>{error}</Text>}
        <View style={styles.actions}>
          {(['deny', 'accept'] as const).map(value => (
            <Pressable key={value} accessibilityRole="button" accessibilityLabel={`${value === 'accept' ? 'Accept' : 'Deny'} ${labels[kind].toLowerCase()}`}
              accessibilityState={{ disabled: action !== null, busy: action === value }} disabled={action !== null}
              onPress={() => { void respond(value); }}
              style={({ pressed }) => [styles.button, { backgroundColor: value === 'accept' ? '#D9434D' : colors.track, opacity: action && action !== value ? 0.5 : 1, transform: [{ scale: pressed && !reducedMotion ? 0.97 : 1 }] }]}
            >
              {action === value ? <ActivityIndicator color={value === 'accept' ? '#FFFFFF' : colors.ink} /> : <>
                {value === 'accept' ? <Check size={18} color="#FFFFFF" /> : <X size={18} color={colors.ink} />}
                <Text style={[styles.buttonText, { color: value === 'accept' ? '#FFFFFF' : colors.ink }]}>{value === 'accept' ? 'Accept' : 'Deny'}</Text>
              </>}
            </Pressable>
          ))}
        </View>
      </View>
      {kind === 'prize' && <DoodleSignatureSheet visible={signatureOpen} initialPaths={draftSignature} partnerName={proposer}
        colors={colors} onClose={() => setSignatureOpen(false)} onSave={async paths => { setDraftSignature(paths); }} />}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', borderWidth: 1, borderRadius: 24, borderCurve: 'continuous', overflow: 'hidden' },
  illustration: { height: 148, alignItems: 'center', justifyContent: 'center' },
  art: { width: '90%', height: 140 },
  proposalIllustration: { height: 168 },
  proposalArt: { height: 152 },
  partnerIllustration: { justifyContent: 'flex-end', overflow: 'hidden' },
  partnerArt: { width: '90%', height: 152, flexDirection: 'row', justifyContent: 'center' },
  partnerAvatar: { flex: 1, height: '100%' },
  proposalCopy: { alignItems: 'center', gap: 8, paddingTop: 4, paddingBottom: 12 },
  proposalLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  proposalTitle: { fontSize: 26, lineHeight: 32, fontWeight: '800', letterSpacing: -0.6, textAlign: 'center' },
  proposalByline: { textAlign: 'center' },
  proposer: { fontWeight: '600' },
  challengeTitle: { fontSize: 24, lineHeight: 30, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center' },
  challengeRule: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  challengeRuleText: { flex: 1, fontSize: 13, lineHeight: 19 },
  challengePrize: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: 1 },
  challengePrizeCopy: { flex: 1, gap: 4 },
  challengePrizeText: { fontSize: 16, lineHeight: 22, fontWeight: '700' },
  signatures: { flexDirection: 'row', gap: 20, borderTopWidth: 1, paddingTop: 12, paddingBottom: 8 },
  signature: { flex: 1, minWidth: 0, minHeight: 72, gap: 4 },
  signatureHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  signatureLabel: { fontSize: 11, lineHeight: 16, fontWeight: '600' },
  signPrompt: { fontSize: 15, lineHeight: 40, fontWeight: '600' },
  signatureLine: { height: 1 },
  body: { padding: 20, gap: 12 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  description: { fontSize: 14, lineHeight: 21 },
  detail: { paddingVertical: 4 },
  detailText: { fontSize: 15, fontWeight: '600', lineHeight: 22 },
  error: { fontSize: 13, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 12 },
  button: { flex: 1, minHeight: 52, padding: 12, borderRadius: 16, borderCurve: 'continuous', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  buttonText: { fontSize: 15, fontWeight: '700' },
});
