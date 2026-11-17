import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing, LayoutAnimationConfig, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useCoupleChallenge } from '@/hooks/useCoupleChallenge';
import { useWeekPrize } from '@/hooks/useWeekPrize';
import { useWeekCountdown } from '@/hooks/useWeekCountdown';
import { useRaceInviteResponse } from '@/hooks/useRaceInviteResponse';
import InvitationCard, { type InvitationCardProps } from './InvitationCard';

export type HomeInvitation = InvitationCardProps & { id: string };

export function useHomeInvitations() {
  const challenges = useCoupleChallenge();
  const prize = useWeekPrize();
  const race = useRaceInviteResponse({ navigateOnAccept: false });
  const proposal = prize.data;
  const countdown = useWeekCountdown(proposal?.weekEnd, true);
  const currentPrize = !!proposal?.weekprize && proposal.hasPartner && countdown.remaining > 0;
  const incoming = challenges.data?.incoming.find(item => item.status === 'PENDING' && item.direction === 'received');
  let invitation: HomeInvitation | null = null;

  if (race.raceState === 'invited' && race.inviteFrom) {
    const invite = race.inviteFrom;
    invitation = {
      id: `race:${invite.inviteId ?? invite.fromUserId}`,
      kind: 'race', from: invite.fromName,
      detail: `${(invite.distance / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} km`,
      onAccept: race.onAccept, onDeny: race.onDeny,
    };
  } else if (incoming) {
    invitation = {
      id: `couple:${incoming.id}`, kind: 'couple', from: incoming.theirCouple.name,
      detail: incoming.typeLabel, challengeType: incoming.type, challengePrize: incoming.prize,
      onAccept: () => challenges.accept(incoming.id),
      onDeny: () => challenges.decline(incoming.id),
    };
  } else if (currentPrize && proposal.proposedByYou === false && !proposal.accepted) {
    invitation = {
      id: `prize:${proposal.weekStart}:${proposal.weekprize}`,
      kind: 'prize', from: proposal.partnerName || 'Your partner', detail: proposal.weekprize!,
      signature: proposal.yourSignature, partnerSignature: proposal.partnerSignature,
      onAccept: paths => paths?.length ? prize.sign(paths) : prize.accept(), onDeny: prize.decline,
    };
  }

  return { invitation, prize: proposal };
}

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const ENTER = { duration: 520, dampingRatio: 0.82 };
const EXIT = { duration: 200, easing: EASE_OUT };

const DEV_SAMPLES: Omit<HomeInvitation, 'id' | 'onAccept' | 'onDeny'>[] = [
  { kind: 'partner', from: 'Alex', detail: 'Connect as partners to share your progress and keep each other motivated.' },
  { kind: 'race', from: 'Alex', detail: '5 km' },
  { kind: 'couple', from: 'Sam & Jordan', detail: 'First to 100,000 steps', challengeType: 'FIRST_TO_100K', challengePrize: 'Dinner date' },
  { kind: 'prize', from: 'Alex', detail: 'Full body massage' },
];

/** Blocking overlay: the only way out is a successful Accept or Deny. */
export default function HomeInvitations({ invitation, active }: { invitation: HomeInvitation | null; active: boolean }) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [devInvitation, setDevInvitation] = useState<HomeInvitation | null>(null);
  const devCount = useRef(0);
  const current = active ? invitation ?? devInvitation : null;
  const lastShown = useRef<HomeInvitation | null>(null);
  if (current) lastShown.current = current;
  const shown = current ?? lastShown.current;

  const [mounted, setMounted] = useState(false);
  const progress = useSharedValue(0);
  const nudge = useSharedValue(1);
  const currentId = current?.id;

  useEffect(() => {
    if (currentId) {
      setMounted(true);
      progress.set(reducedMotion ? withTiming(1, { duration: 200 }) : withSpring(1, ENTER));
      return;
    }
    progress.set(withTiming(0, EXIT, finished => { if (finished) scheduleOnRN(setMounted, false); }));
  }, [currentId, progress, reducedMotion]);

  const nudgeCard = useCallback(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    if (reducedMotion) return;
    nudge.set(withSequence(withTiming(1.03, { duration: 110, easing: EASE_OUT }), withSpring(1, { duration: 360, dampingRatio: 0.55 })));
  }, [nudge, reducedMotion]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, progress.get()) }));
  const cardStyle = useAnimatedStyle(() => {
    const p = progress.get();
    if (reducedMotion) return { opacity: Math.min(1, p) };
    return {
      opacity: interpolate(p, [0, 0.6], [0, 1], 'clamp'),
      transform: [
        { translateY: interpolate(p, [0, 1], [32, 0]) },
        { scale: interpolate(p, [0, 1], [0.94, 1]) * nudge.get() },
      ],
    };
  });

  const openDevInvitation = () => {
    const sample = DEV_SAMPLES[devCount.current++ % DEV_SAMPLES.length];
    const settle = () => new Promise<void>(resolve => setTimeout(() => { setDevInvitation(null); resolve(); }, 900));
    setDevInvitation({ ...sample, id: `dev:${devCount.current}`, onAccept: settle, onDeny: settle });
  };

  return <>
    {__DEV__ && !current && (
      <Pressable accessibilityRole="button" accessibilityLabel="Preview home invitation" onPress={openDevInvitation}
        style={({ pressed }) => [styles.devButton, { bottom: insets.bottom + 96, opacity: pressed ? 0.7 : 1 }]}>
        <Text style={styles.devButtonText}>Test invite</Text>
      </Pressable>
    )}
    <Modal visible={mounted || !!current} transparent animationType="none" statusBarTranslucent navigationBarTranslucent
      onRequestClose={nudgeCard}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />
      <ScrollView bounces={false} showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={nudgeCard} accessible={false} />
        <Animated.View accessibilityViewIsModal style={[styles.card, cardStyle]}>
          <LayoutAnimationConfig skipEntering>
            {shown && <InvitationCard key={shown.id} {...shown} />}
          </LayoutAnimationConfig>
        </Animated.View>
      </ScrollView>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(15,23,42,0.55)' },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  card: { width: '100%', maxWidth: 400, borderRadius: 24, borderCurve: 'continuous', boxShadow: '0 20px 48px rgba(15,23,42,0.28)' },
  devButton: { position: 'absolute', left: 16, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#111827', zIndex: 50 },
  devButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
});
