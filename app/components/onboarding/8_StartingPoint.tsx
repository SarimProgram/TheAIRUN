import React, { useCallback, useEffect, useState } from 'react';
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
} from 'react-native';
import { ChevronLeft, ArrowRight, Users, Mail, Link2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useAuth } from '@/src/auth/authContext';
import { API_BASE_URL } from '@/config/api';

const COLORS = {
  coral: '#FF6B6B',
  coralDark: '#EE5253',
  black: '#1F2937',
  muted: '#6B7280',
  white: '#FFFFFF',
  bg: '#FFFFFF',
  cardBg: '#F9FAFB',
  border: '#E5E7EB',
  success: '#10B981',
};

type Partner = {
  id: string;
  displayName: string;
  email: string;
};

type Invite = {
  id: string;
  toEmail: string;
  status: string;
  createdAt: string;
};

type Props = {
  onContinue: (id: string | null) => void;
  onBack: () => void;
};

export default function JourneyTypeSelection({ onContinue, onBack }: Props) {
  const { authFetch, isAuthenticated } = useAuth();
  const [loadingState, setLoadingState] = useState(true);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [email, setEmail] = useState('');
  const [hasPartner, setHasPartner] = useState(false);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [sentInvites, setSentInvites] = useState<Invite[]>([]);
  const hasInviteSent = sentInvites.length > 0;

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

  const sendInvite = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      Alert.alert('Missing email', "Please enter your partner's email.");
      return;
    }

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

      Alert.alert('Invite sent', `Invitation sent to ${normalizedEmail}`);
      setEmail('');
      await fetchPartnerState();
      onContinue('couple');
    } catch (err: any) {
      Alert.alert('Invite failed', err?.message || 'Unable to send invite');
    } finally {
      setSendingInvite(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.flex}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
            <ChevronLeft color={COLORS.black} size={30} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.main}>
            <View style={styles.headerRow}>
              <View style={styles.headerTextSide}>
                <View style={styles.badge}>
                  <Users color={COLORS.coral} size={14} strokeWidth={2.5} />
                  <Text style={styles.badgeText}>PARTNERSHIP</Text>
                </View>
                <Text style={styles.title}>
                  Starting{'\n'}
                  <Text style={{ color: COLORS.coral }}>Point?</Text>
                </Text>
              </View>

              <View style={styles.visualContainer}>
                <View style={styles.visualCircle} />
                <Image
                  source={require('../../assets/couple.png')}
                  style={styles.visualImage}
                  contentFit="contain"
                />
              </View>
            </View>
            <Text style={styles.subtitle}>
              {hasPartner
                ? 'Your partner is already connected. Continue to personalize your plan.'
                : hasInviteSent
                  ? 'Invite already sent. You can continue now and sync once your partner accepts.'
                : "Invite your partner by email so you can sync goals and run together."}
            </Text>

            {loadingState ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator color={COLORS.coral} />
              </View>
            ) : hasPartner && partner ? (
              <View style={styles.partnerCard}>
                <View style={styles.partnerIconBox}>
                  <Link2 size={20} color={COLORS.success} />
                </View>
                <View style={styles.partnerInfo}>
                  <Text style={styles.partnerName}>{partner.displayName}</Text>
                  <Text style={styles.partnerEmail}>{partner.email}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.inviteCard}>
                <Text style={styles.inputLabel}>Partner Email</Text>
                <View style={styles.inviteRow}>
                  <TextInput
                    style={styles.input}
                    placeholder="name@email.com"
                    placeholderTextColor="#9CA3AF"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={!sendingInvite}
                  />
                  <TouchableOpacity style={[styles.sendBtn, sendingInvite && styles.btnDisabled]} onPress={sendInvite} disabled={sendingInvite}>
                    {sendingInvite ? <ActivityIndicator size="small" color="#FFF" /> : <Mail size={18} color="#FFF" />}
                  </TouchableOpacity>
                </View>
                {sentInvites.length > 0 && (
                  <View style={styles.sentWrap}>
                    <Text style={styles.sentTitle}>Already invited</Text>
                    {sentInvites.slice(0, 3).map((invite) => (
                      <View key={invite.id} style={styles.sentRow}>
                        <Text style={styles.sentEmail}>{invite.toEmail}</Text>
                        <Text style={styles.sentStatus}>{invite.status}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        </ScrollView>

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
              <Text style={styles.buttonText}>{hasPartner || hasInviteSent ? 'Move Next' : 'Invite Later'}</Text>
              <ArrowRight color="white" size={20} strokeWidth={3} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
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
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
  },
  main: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 10,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  headerTextSide: {
    flex: 1,
  },
  badge: {
    backgroundColor: '#FFF0F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.coral,
    letterSpacing: 1.5,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.black,
    lineHeight: 38,
    letterSpacing: -1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.muted,
    lineHeight: 22,
    fontWeight: '500',
    marginBottom: 10,
  },
  visualContainer: {
    width: 150,
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 0,
  },
  visualCircle: {
    position: 'absolute',
    width: '85%',
    height: '85%',
    borderRadius: 75,
    backgroundColor: '#FFF0F0',
    zIndex: -1,
  },
  visualImage: {
    width: '125%',
    height: '120%',
  },
  loadingWrap: {
    minHeight: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  partnerCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    flexDirection: 'row',
    alignItems: 'center',
  },
  partnerIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  partnerInfo: {
    marginLeft: 12,
  },
  partnerName: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.black,
  },
  partnerEmail: {
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 2,
  },
  inviteCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.black,
    marginBottom: 10,
  },
  inviteRow: {
    flexDirection: 'row',
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.black,
  },
  sendBtn: {
    width: 48,
    borderRadius: 12,
    backgroundColor: COLORS.coral,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.7,
  },
  sentWrap: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 10,
    gap: 6,
  },
  sentTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.muted,
    letterSpacing: 0.4,
  },
  sentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sentEmail: {
    fontSize: 13,
    color: COLORS.black,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  sentStatus: {
    fontSize: 11,
    color: COLORS.muted,
    fontWeight: '700',
  },
  footer: {
    padding: 24,
    paddingBottom: 30,
  },
  mainButton: {
    height: 60,
    borderRadius: 20,
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
    gap: 12,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
});
