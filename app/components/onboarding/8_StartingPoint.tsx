import React, { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View, useColorScheme, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { ArrowRight, Check, ChevronLeft, Flame, Gift, Mail, MessageCircle, Share2, Users } from 'lucide-react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, cancelAnimation, withDelay, withTiming, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { useAuth } from '@/src/auth/authContext';
import { API_BASE_URL } from '@/config/api';
import { APP_NAME } from '@/constants/branding';
import { buildPartnerInviteShareMessage, sharePartnerInviteVia, sharePartnerInviteEmail, type PartnerInviteShareChannel } from '@/utils/partnerInviteShare';
import { getOrCreateGuestPartnerInvite, getStoredGuestPartnerInvite } from '@/utils/guestPartnerInvite';

type Invite = { id: string; code?: string; toEmail: string | null; status: string; createdAt: string };
type Partner = { displayName: string; email: string };
type Props = {
  onContinue: (mode: 'couple' | 'later') => void;
  onBack: () => void;
  initialPartnerEmail?: string;
  shouldSendInviteAfterAuth?: boolean;
  initialShareChannel?: PartnerInviteShareChannel;
  inviterName?: string;
  onRequireAuthForInvite: (email: string, channel?: PartnerInviteShareChannel) => void;
  onInviteSent?: () => void;
};
const CORAL = '#FF595D';
const EASE = Easing.bezier(0.23, 1, 0.32, 1);
const CHANNELS = [{ id: 'whatsapp', label: 'WhatsApp' }, { id: 'sms', label: 'Messages' }, { id: 'telegram', label: 'Telegram' }, { id: 'native', label: 'More' }] as const;

export default function JourneyTypeSelection({ onContinue, onBack, initialPartnerEmail = '', shouldSendInviteAfterAuth = false, initialShareChannel, inviterName = `Your ${APP_NAME} partner`, onInviteSent }: Props) {
  const { authFetch, isAuthenticated } = useAuth();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const dark = useColorScheme() === 'dark';
  const reduceMotion = useReducedMotion();
  const palette = dark
    ? { bg: '#171B23', ink: '#F5F6F8', muted: '#A9B0BC', field: '#232934', border: '#353D49', blush: '#36272E' }
    : { bg: '#FFFCFC', ink: '#192532', muted: '#737C89', field: '#F6F6F8', border: '#E8E9EE', blush: '#FFF0F0' };
  const compact = height < 740;
  const [email, setEmail] = useState(initialPartnerEmail);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(isAuthenticated);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [inviteStarted, setInviteStarted] = useState(false);
  const lock = useRef(false);
  const autoAttempted = useRef(false);
  const scroll = useRef<ScrollView>(null);
  const scale = useSharedValue(1);
  const buttonMotion = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const pending = invites.find(item => item.status === 'PENDING');
  const engaged = !!partner || invites.some(item => item.status === 'PENDING' || item.status === 'ACCEPTED');
  const readyToContinue = inviteStarted || engaged;

  const fetchState = useCallback(async () => {
    if (!isAuthenticated) {
      try {
        const saved = await getStoredGuestPartnerInvite();
        if (saved) setInvites(previous => previous.some(item => item.id === saved.id) ? previous : [saved, ...previous]);
      } catch { /* Sharing can still retry local storage on the next tap. */ }
      setLoading(false);
      return;
    }
    try {
      // Invitation state is available before subscribing; /partner requires premium access.
      const invitesResponse = await authFetch(`${API_BASE_URL}/partner/invites/sent`);
      if (!invitesResponse.ok) throw new Error('Could not load your invitations. Please try again.');
      const invitesData = await invitesResponse.json();
      setPartner(invitesData.hasPartner ? invitesData.partner : null);
      setInvites(invitesData.invites || []);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not load your invitations.'); }
    finally { setLoading(false); }
  }, [authFetch, isAuthenticated]);
  useEffect(() => { void fetchState(); }, [fetchState]);
  useEffect(() => { setEmail(initialPartnerEmail); }, [initialPartnerEmail]);

  const invite = useCallback(async (channel?: PartnerInviteShareChannel) => {
    if (lock.current) return;
    const recipient = email.trim().toLowerCase();
    if (!channel && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      setError('Enter a valid partner email, or choose a messaging app below.'); return;
    }
    Keyboard.dismiss();
    setInviteStarted(true);
    lock.current = true;
    setBusy(channel || 'email'); setError(''); setNotice('');
    try {
      if (!isAuthenticated) {
        const guest = await getOrCreateGuestPartnerInvite(inviterName);
        setInvites(previous => [guest, ...previous.filter(item => item.id !== guest.id)]);
        const message = buildPartnerInviteShareMessage({ inviterName, inviteCode: guest.code });
        if (channel) await sharePartnerInviteVia(channel, message);
        else await sharePartnerInviteEmail(recipient, message);
        if (!channel) setNotice('Your invite is ready in your email app. Send it there to invite your partner.');
        onInviteSent?.();
        return;
      }
      let current = channel ? pending : undefined;
      let emailDelivered = false;
      if (!current?.code) {
        const response = await authFetch(`${API_BASE_URL}/partner/invite${channel ? '/code' : ''}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(channel ? {} : { email: recipient }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not create your invite. Please try again.');
        current = data.invite;
        emailDelivered = data.emailDelivery?.sent === true;
        if (!current?.code) throw new Error('The invite code was missing. Please try again.');
        const saved = current;
        setInvites(previous => [saved, ...previous.filter(item => item.id !== saved.id)]);
      }
      if (channel) {
        await sharePartnerInviteVia(channel, buildPartnerInviteShareMessage({ inviterName, inviteCode: current.code!, toEmail: current.toEmail }));
      } else {
        setEmail('');
        setNotice(emailDelivered ? `Invite sent to ${recipient}` : 'Invite code ready. Email delivery is unavailable; share your code below.');
      }
      onInviteSent?.();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not share your invite. Please try again.'); }
    finally { lock.current = false; setBusy(null); }
  }, [authFetch, email, inviterName, isAuthenticated, onInviteSent, pending]);

  useEffect(() => {
    if (!isAuthenticated || loading || !shouldSendInviteAfterAuth || autoAttempted.current) return;
    autoAttempted.current = true;
    void invite(initialShareChannel || (initialPartnerEmail ? undefined : 'native'));
  }, [initialPartnerEmail, initialShareChannel, invite, isAuthenticated, loading, shouldSendInviteAfterAuth]);

  return <View style={[styles.root, { backgroundColor: palette.bg }]}>
    <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.blush, { backgroundColor: palette.blush }]} />
      <View style={[styles.mint, { backgroundColor: dark ? '#1B3337' : '#E4F5F1' }]} />
    </View>
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.headerArea, { paddingTop: insets.top + 12 }]}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} hitSlop={8} style={({ pressed }) => [styles.back, { opacity: pressed ? 0.5 : 1 }]}><ChevronLeft size={30} color={palette.ink} strokeWidth={2.6} /></Pressable>
          <View style={styles.brand}><Image source={require('../../assets/logo.png')} tintColor={CORAL} style={styles.logo} contentFit="contain" accessible={false} /><Text style={[styles.brandName, { color: palette.ink }]}>{APP_NAME}</Text></View>
        </View>
      </View>
      <ScrollView ref={scroll} style={styles.root} contentContainerStyle={[styles.content, { paddingTop: compact ? 8 : 16 }]} contentInsetAdjustmentBehavior="never" keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} showsVerticalScrollIndicator={false}>
        <Reveal delay={0}><Text accessibilityRole="header" style={[styles.title, { color: palette.ink, fontSize: width < 360 ? 34 : 38 }]}>{partner ? 'Better ' : 'Invite a '}<Text style={styles.accent}>{partner ? 'together.' : 'partner?'}</Text></Text></Reveal>
        <Reveal delay={60} style={[styles.art, { height: Math.min(240, Math.max(150, height * 0.23)) }]}>
          <View style={[styles.halo, { backgroundColor: palette.blush }]} />
          <Image source={require('../../assets/onboarding/together-fist-bump.png')} style={styles.artImage} contentFit="contain" accessibilityLabel="Our teal and coral training partners with white eyes, sharing a fist bump" />
          <LinearGradient colors={[`${palette.bg}00`, palette.bg]} style={styles.artFade} pointerEvents="none" />
        </Reveal>
        <View style={styles.benefits}>
          {[{ Icon: Flame, text: 'Stay\nmotivated' }, { Icon: Users, text: 'Be\naccountable' }, { Icon: Gift, text: 'Bet on\nyour week' }].map(({ Icon, text }, index) => <Reveal key={text} delay={100 + index * 40} style={styles.benefit}><View style={[styles.benefitIcon, { backgroundColor: palette.blush }]}><Icon size={27} color={CORAL} strokeWidth={2.5} /></View><Text style={[styles.benefitText, { color: palette.muted }]}>{text}</Text></Reveal>)}
        </View>
        <Reveal delay={220} style={styles.inviteSection}>
          {loading ? <ActivityIndicator color={CORAL} style={styles.loader} /> : partner ? <View style={[styles.partnerCard, { backgroundColor: palette.blush }]}><Check color={CORAL} size={26} /><Text style={[styles.partnerName, { color: palette.ink }]}>{partner.displayName}</Text><Text style={{ color: palette.muted }}>You’re connected. Let’s make this week count.</Text></View> : <>
            <View style={[styles.inviteCard, { backgroundColor: palette.field, borderColor: error ? CORAL : palette.border }]}>
              <View style={styles.inputShell}>
                <Mail size={20} color={palette.muted} strokeWidth={1.8} />
                <TextInput accessibilityLabel="Partner’s email" placeholder="Their email address" placeholderTextColor={palette.muted} value={email} onChangeText={value => { setEmail(value); setError(''); }} style={[styles.input, { color: palette.ink }]} keyboardType="email-address" autoComplete="email" autoCapitalize="none" autoCorrect={false} returnKeyType="send" editable={!busy} onSubmitEditing={() => void invite()} onFocus={() => scroll.current?.scrollToEnd({ animated: !reduceMotion })} />
              </View>
            </View>
            {pending?.code && <Reveal delay={0} style={[styles.codeCard, { backgroundColor: palette.blush }]}><Text style={[styles.codeLabel, { color: palette.muted }]}>Your partner’s invite code</Text><Text selectable accessibilityLabel={`Invite code ${pending.code}`} style={styles.code}>{pending.code}</Text><Text style={[styles.codeHint, { color: palette.muted }]}>{isAuthenticated ? 'Enter it in “I have a code” to join you.' : 'Finish creating your account to activate this code.'}</Text></Reveal>}
          </>}
          {!!error && <View accessibilityLiveRegion="polite" style={styles.feedback}><Text style={styles.error}>{error}</Text>{!busy && <Pressable onPress={() => { setError(''); setLoading(true); void fetchState(); }} accessibilityRole="button" style={styles.retry}><Text style={styles.accent}>Reload invitations</Text></Pressable>}</View>}
          {!!notice && <Text accessibilityLiveRegion="polite" style={[styles.notice, { color: palette.muted }]}>{notice}</Text>}
        </Reveal>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16), backgroundColor: palette.bg }]}>
        {readyToContinue ? <Pressable accessibilityRole="button" onPress={() => onContinue('couple')} style={({ pressed }) => [styles.sendButton, { opacity: pressed ? 0.6 : 1 }]}><Text style={styles.sendText}>Ready to go</Text><ArrowRight color="#FFFFFF" size={24} strokeWidth={2.7} /></Pressable> : <Pressable accessibilityRole="button" accessibilityLabel="Send email invite" accessibilityState={{ disabled: !!busy || loading || !email.trim(), busy: busy === 'email' }} disabled={!!busy || loading || !email.trim()} onPress={() => void invite()} onPressIn={() => scale.set(withSpring(reduceMotion ? 1 : 0.97, { duration: 140, dampingRatio: 1 }))} onPressOut={() => scale.set(withSpring(1, { duration: 180, dampingRatio: 1 }))}><Animated.View style={[styles.sendButton, buttonMotion, (!email.trim() || busy || loading) && { opacity: 0.5 }]}>{busy === 'email' ? <ActivityIndicator color="#FFFFFF" /> : <><Text style={styles.sendText}>Send invite</Text><ArrowRight color="#FFFFFF" size={24} strokeWidth={2.7} /></>}</Animated.View></Pressable>}
        {!partner && !loading && <View style={styles.shareRow}>
          <Text style={[styles.shareLabel, { color: palette.muted }]}>Or invite via</Text>
          {CHANNELS.map(channel => <Pressable key={channel.id} accessibilityRole="button" accessibilityLabel={`Invite via ${channel.label}`} accessibilityState={{ disabled: !!busy, busy: busy === channel.id }} disabled={!!busy} onPress={() => void invite(channel.id)} style={({ pressed }) => [styles.shareOption, { opacity: pressed || (busy && busy !== channel.id) ? 0.45 : 1 }]}>
            {busy === channel.id ? <ActivityIndicator size="small" color={CORAL} /> : channel.id === 'whatsapp' ? <Ionicons name="logo-whatsapp" size={21} color={palette.muted} /> : channel.id === 'sms' ? <MessageCircle size={20} color={palette.muted} strokeWidth={1.8} /> : channel.id === 'telegram' ? <Ionicons name="paper-plane-outline" size={20} color={palette.muted} /> : <Share2 size={19} color={palette.muted} strokeWidth={1.8} />}
          </Pressable>)}
        </View>}
        {!readyToContinue && <Pressable accessibilityRole="button" disabled={!!busy} onPress={() => onContinue('later')} style={({ pressed }) => [styles.laterButton, { opacity: pressed || busy ? 0.6 : 1 }]}><Text style={[styles.laterText, { color: palette.muted }]}>Invite later</Text></Pressable>}
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </View>;
}

function Reveal({ children, delay, style }: { children: ReactNode; delay: number; style?: StyleProp<ViewStyle> }) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    progress.set(withDelay(reduceMotion ? 0 : delay, withTiming(1, { duration: reduceMotion ? 160 : 280, easing: EASE })));
    return () => cancelAnimation(progress);
  }, [delay, progress, reduceMotion]);
  const motion = useAnimatedStyle(() => ({ opacity: progress.get(), transform: [{ translateY: reduceMotion ? 0 : (1 - progress.get()) * 14 }] }));
  return <Animated.View style={[style, motion]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  blush: { position: 'absolute', width: 320, height: 260, borderRadius: 160, top: -200, left: -100, transform: [{ rotate: '-24deg' }] },
  mint: { position: 'absolute', width: 440, height: 220, borderRadius: 220, bottom: -195, right: -100, transform: [{ rotate: '-18deg' }] },
  headerArea: { paddingHorizontal: 28, width: '100%', maxWidth: 480, alignSelf: 'center' },
  header: { height: 56, justifyContent: 'center', alignItems: 'center' },
  back: { position: 'absolute', left: -8, width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: 27, height: 30 },
  brandName: { fontSize: 22, fontWeight: '900', letterSpacing: -1 },
  content: { flexGrow: 1, paddingHorizontal: 28, maxWidth: 480, alignSelf: 'center', width: '100%' },
  title: { fontWeight: '900', letterSpacing: -1.6, textAlign: 'center' },
  accent: { color: CORAL },
  art: { marginTop: 12, marginHorizontal: -16, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: '72%', height: '88%', borderRadius: 160 },
  artImage: { width: '100%', height: '100%' },
  artFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 40 },
  benefits: { flexDirection: 'row', gap: 8, paddingTop: 4 },
  benefit: { flex: 1, alignItems: 'center', gap: 8 },
  benefitIcon: { width: 44, height: 44, borderRadius: 16, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  benefitText: { fontSize: 12, lineHeight: 17, fontWeight: '500', textAlign: 'center' },
  inviteSection: { marginTop: 24 },
  loader: { paddingVertical: 24 },
  inviteCard: { borderWidth: 1, borderRadius: 20, borderCurve: 'continuous' },
  inputShell: { minHeight: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, gap: 12 },
  input: { flex: 1, minWidth: 0, fontSize: 15, fontWeight: '400', paddingVertical: 18 },
  shareLabel: { fontSize: 12, fontWeight: '400', marginRight: 8 },
  shareRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 4 },
  shareOption: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  codeCard: { borderRadius: 20, borderCurve: 'continuous', padding: 16, alignItems: 'center', gap: 8, marginTop: 20 },
  codeLabel: { fontSize: 12, fontWeight: '600' },
  code: { fontSize: 28, fontWeight: '900', color: CORAL, letterSpacing: 5, fontVariant: ['tabular-nums'] },
  codeHint: { fontSize: 12, textAlign: 'center' },
  partnerCard: { borderRadius: 20, borderCurve: 'continuous', padding: 20, alignItems: 'center', gap: 12 },
  partnerName: { fontSize: 20, fontWeight: '800' },
  feedback: { marginTop: 16, gap: 4 },
  error: { color: CORAL, textAlign: 'center', fontSize: 13, lineHeight: 19 },
  retry: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  notice: { marginTop: 16, textAlign: 'center', fontSize: 13, lineHeight: 19 },
  footer: { paddingTop: 16, gap: 10, width: '100%' },
  sendButton: { minHeight: 56, paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, borderRadius: 24, borderCurve: 'continuous', backgroundColor: CORAL },
  sendText: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  laterButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', padding: 8 },
  laterText: { fontSize: 14, fontWeight: '500' },
});
