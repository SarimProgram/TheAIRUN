import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { ChevronLeft, ArrowRight, Mail, Link2, Send, Heart } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useAuth } from '@/src/auth/authContext';
import { API_BASE_URL } from '@/config/api';
import { PartnerInviteShareOptions } from '@/components/partner/PartnerInviteShareOptions';
import { buildPartnerInviteShareMessage } from '@/utils/partnerInviteShare';
import { APP_NAME } from '@/constants/branding';

const COLORS = {
  coral: '#FF6B6B',
  coralDark: '#EE5253',
  black: '#1F2937',
  muted: '#6B7280',
  white: '#FFFFFF',
  bg: '#FFFFFF',
  cardBg: '#FAFAFA',
  border: '#E5E7EB',
  success: '#10B981',
  ink: '#121212',
};

type Partner = {
  id: string;
  displayName: string;
  email: string;
};

type Invite = {
  id: string;
  code?: string;
  toEmail: string;
  status: string;
  createdAt: string;
};

type Props = {
  onContinue: (mode: 'couple' | 'later') => void;
  onBack: () => void;
  initialPartnerEmail?: string;
  shouldSendInviteAfterAuth?: boolean;
  inviterName?: string;
  onRequireAuthForInvite: (email: string) => void;
  onInviteSent?: () => void;
};

export default function JourneyTypeSelection({
  onContinue,
  onBack,
  initialPartnerEmail = '',
  shouldSendInviteAfterAuth = false,
  inviterName = `My ${APP_NAME} partner`,
  onRequireAuthForInvite,
  onInviteSent,
}: Props) {
  const { authFetch, isAuthenticated } = useAuth();
  const scrollRef = useRef<ScrollView>(null);
  const autoSendAttemptedRef = useRef(false);
  const [loadingState, setLoadingState] = useState(true);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [email, setEmail] = useState(initialPartnerEmail);
  const [hasPartner, setHasPartner] = useState(false);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [sentInvites, setSentInvites] = useState<Invite[]>([]);
  const [latestSentInvite, setLatestSentInvite] = useState<Invite | null>(null);
  const hasInviteSent = sentInvites.length > 0;
  const canSendInvite = email.trim().length > 0;
  const pendingSentInvite = sentInvites.find((invite) => invite.status === 'PENDING') || null;
  const inviteToShare = latestSentInvite || pendingSentInvite;
  const inviteCode = inviteToShare?.code || '';
  const shareMessage = inviteCode
    ? buildPartnerInviteShareMessage({
        inviterName: inviterName.trim() || `My ${APP_NAME} partner`,
        inviteCode,
        toEmail: inviteToShare?.toEmail,
      })
    : '';

  const fetchPartnerState = useCallback(async () => {
    if (!isAuthenticated) {
      setLoadingState(false);
      return;
    }

    try {
      setLoadingState(true);
      const res = await authFetch(`${API_BASE_URL}/partner`);
      const data = await res.json();
      setHasPartner(!!data?.hasPartner);
      setPartner(data?.partner || null);

      const sentRes = await authFetch(`${API_BASE_URL}/partner/invites/sent`);
      const sentData = await sentRes.json();
      setSentInvites(sentData?.invites || []);
    } catch {
      setHasPartner(false);
      setPartner(null);
      setSentInvites([]);
    } finally {
      setLoadingState(false);
    }
  }, [authFetch, isAuthenticated]);

  useEffect(() => {
    fetchPartnerState();
  }, [fetchPartnerState]);

  useEffect(() => {
    if (initialPartnerEmail) {
      setEmail(initialPartnerEmail);
    }
  }, [initialPartnerEmail]);

  const scrollToInvite = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  };

  const sendInvite = useCallback(async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      Alert.alert('Missing email', "Please enter your partner's email.");
      return;
    }

    if (!isAuthenticated) {
      Keyboard.dismiss();
      onRequireAuthForInvite(normalizedEmail);
      return;
    }

    Keyboard.dismiss();

    try {
      setSendingInvite(true);
      const res = await authFetch(`${API_BASE_URL}/partner/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || data?.message || 'Failed to send invite');
      }

      const invite = data?.invite as Invite | undefined;
      if (invite) {
        setLatestSentInvite(invite);
      }
      setEmail('');
      onInviteSent?.();
      await fetchPartnerState();
    } catch (err: any) {
      Alert.alert('Invite failed', err?.message || 'Unable to send invite');
    } finally {
      setSendingInvite(false);
    }
  }, [
    authFetch,
    email,
    fetchPartnerState,
    isAuthenticated,
    onInviteSent,
    onRequireAuthForInvite,
  ]);

  useEffect(() => {
    if (
      !isAuthenticated ||
      !shouldSendInviteAfterAuth ||
      !email.trim() ||
      autoSendAttemptedRef.current
    ) {
      return;
    }

    autoSendAttemptedRef.current = true;
    void sendInvite();
  }, [email, isAuthenticated, sendInvite, shouldSendInviteAfterAuth]);

  const subtitle = hasPartner
    ? "You're connected. Build a plan that keeps you both moving."
    : hasInviteSent
      ? 'Invite sent. Keep going while your partner joins.'
      : 'Invite your partner to stay motivated together.';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.flex}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
            <ChevronLeft color={COLORS.black} size={28} />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <ScrollView
              ref={scrollRef}
              style={styles.flex}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            >
              <View style={styles.hero}>
                <View style={styles.coupleIconWrap}>
                  <Heart color={COLORS.coral} size={22} fill={COLORS.coral} strokeWidth={2} />
                </View>

                <Text style={styles.title}>
                  Train with your{'\n'}
                  <Text style={styles.titleAccent}>partner</Text>
                </Text>

                <View style={styles.visualContainer}>
                  <View style={styles.visualCircle} />
                  <Image
                    source={require('../../assets/couple.png')}
                    style={styles.visualImage}
                    contentFit="contain"
                  />
                </View>

                <Text style={styles.subtitle}>{subtitle}</Text>
              </View>

              {loadingState ? (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator color={COLORS.coral} />
                </View>
              ) : hasPartner && partner ? (
                <View style={styles.partnerCard}>
                  <View style={styles.partnerIconBox}>
                    <Link2 size={22} color={COLORS.success} />
                  </View>
                  <Text style={styles.partnerName}>{partner.displayName}</Text>
                  <Text style={styles.partnerEmail}>{partner.email}</Text>
                </View>
              ) : (
                <View style={styles.inviteSection}>
                  <View style={styles.inviteCard}>
                    <Text style={styles.inputLabel}>Partner&apos;s email</Text>

                    <View style={styles.inputShell}>
                      <Mail color={COLORS.muted} size={18} strokeWidth={2.2} />
                      <TextInput
                        style={styles.input}
                        placeholder="name@email.com"
                        placeholderTextColor="#9CA3AF"
                        value={email}
                        onChangeText={setEmail}
                        onFocus={scrollToInvite}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        returnKeyType="send"
                        onSubmitEditing={sendInvite}
                        editable={!sendingInvite}
                      />
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.sendButton,
                        canSendInvite && styles.sendButtonActive,
                        (!canSendInvite || sendingInvite) && styles.sendButtonInactive,
                      ]}
                      onPress={sendInvite}
                      disabled={!canSendInvite || sendingInvite}
                      activeOpacity={0.9}
                    >
                      <LinearGradient
                        colors={canSendInvite ? [COLORS.coral, COLORS.coralDark] : ['#F3F4F6', '#E5E7EB']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.sendGradient}
                      >
                        {sendingInvite ? (
                          <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                          <>
                            <Text style={[styles.sendButtonText, !canSendInvite && styles.sendButtonTextInactive]}>
                              Send invite
                            </Text>
                            <Send
                              color={canSendInvite ? COLORS.white : COLORS.muted}
                              size={18}
                              strokeWidth={2.5}
                            />
                          </>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>

                    {sentInvites.length > 0 && (
                      <View style={styles.sentWrap}>
                        <Text style={styles.sentTitle}>Sent</Text>
                        {sentInvites.slice(0, 3).map((invite) => (
                          <View key={invite.id} style={styles.sentPill}>
                            <Text style={styles.sentEmail} numberOfLines={1}>{invite.toEmail}</Text>
                            <Text style={styles.sentStatus}>{invite.status}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {inviteToShare && inviteCode ? (
                      <View style={styles.shareSection}>
                        <Text style={styles.shareTitle}>Share the invite code</Text>
                        <View style={styles.codeShell}>
                          <Text style={styles.codeText}>{inviteCode}</Text>
                        </View>
                        <PartnerInviteShareOptions message={shareMessage} disabled={sendingInvite} />
                      </View>
                    ) : null}
                  </View>
                </View>
              )}

              <View style={styles.scrollSpacer} />
            </ScrollView>
          </TouchableWithoutFeedback>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.mainButton}
              onPress={() => onContinue(hasPartner || hasInviteSent ? 'couple' : 'later')}
              disabled={loadingState || sendingInvite}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={[COLORS.coral, COLORS.coralDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientButton}
              >
                <Text style={styles.buttonText}>
                  {hasPartner || hasInviteSent ? 'Keep going' : 'Invite later'}
                </Text>
                <ArrowRight color={COLORS.white} size={20} strokeWidth={3} />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingBottom: 16,
  },
  scrollSpacer: {
    height: 24,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 22,
  },
  hero: {
    alignItems: 'center',
    paddingTop: 4,
    marginBottom: 8,
  },
  coupleIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 34,
    fontWeight: '900',
    color: COLORS.black,
    lineHeight: 40,
    letterSpacing: -1.2,
    textAlign: 'center',
    marginBottom: 12,
  },
  titleAccent: {
    color: COLORS.coral,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.muted,
    lineHeight: 22,
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: 320,
    marginTop: 8,
  },
  visualContainer: {
    width: 140,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  visualCircle: {
    position: 'absolute',
    width: '88%',
    height: '88%',
    borderRadius: 70,
    backgroundColor: '#FFF0F0',
  },
  visualImage: {
    width: '120%',
    height: '115%',
  },
  loadingWrap: {
    minHeight: 160,
    justifyContent: 'center',
    alignItems: 'center',
  },
  partnerCard: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 3,
  },
  partnerIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  partnerName: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.black,
    textAlign: 'center',
  },
  partnerEmail: {
    fontSize: 14,
    color: COLORS.muted,
    marginTop: 4,
    textAlign: 'center',
  },
  inviteSection: {
    paddingTop: 8,
  },
  inviteCard: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 4,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.ink,
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#ECECEC',
    borderRadius: 16,
    paddingHorizontal: 16,
    minHeight: 56,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: COLORS.black,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontWeight: '500',
  },
  sendButton: {
    marginTop: 14,
    borderRadius: 16,
    overflow: 'hidden',
  },
  sendButtonActive: {
    shadowColor: COLORS.coral,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  sendButtonInactive: {
    opacity: 1,
  },
  sendGradient: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
  },
  sendButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  sendButtonTextInactive: {
    color: COLORS.muted,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  sentWrap: {
    marginTop: 16,
    gap: 8,
  },
  sentTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.muted,
    letterSpacing: 0.8,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  sentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sentEmail: {
    flex: 1,
    fontSize: 13,
    color: COLORS.black,
    fontWeight: '600',
    textAlign: 'center',
  },
  sentStatus: {
    fontSize: 11,
    color: COLORS.coral,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  shareSection: {
    marginTop: 18,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 12,
  },
  shareTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.black,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  codeShell: {
    alignSelf: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    backgroundColor: '#FFF5F5',
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    borderColor: '#FECDD3',
  },
  codeText: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.coral,
    letterSpacing: 6,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 28,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 20,
    backgroundColor: COLORS.bg,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  mainButton: {
    height: 56,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: COLORS.coral,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 8,
  },
  gradientButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
});
