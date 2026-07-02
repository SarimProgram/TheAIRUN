import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, Trophy, X } from 'lucide-react-native';
import { useRaceSocketContext } from '@/contexts/RaceSocketContext';

const THEME = {
  primary: '#FF6B81',
  secondary: '#2EC4B6',
  textMain: '#1A1A1A',
  textLight: '#94A3B8',
};

export default function GlobalRaceInviteOverlay() {
  const router = useRouter();
  const { raceState, inviteFrom, acceptInvite, declineInvite } = useRaceSocketContext();

  const visible = raceState === 'invited' && !!inviteFrom;

  const handleAccept = () => {
    acceptInvite();
    router.push('/Race');
  };

  const handleDecline = () => {
    declineInvite();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.badge}>
            <Trophy size={28} color={THEME.primary} />
          </View>
          <Text style={styles.title}>Race Invite</Text>
          <Text style={styles.subtitle}>
            {inviteFrom?.fromName} wants to race {((inviteFrom?.distance ?? 0) / 1000).toFixed(1)}km
          </Text>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.declineBtn} onPress={handleDecline} activeOpacity={0.85}>
              <X size={18} color={THEME.textMain} />
              <Text style={styles.declineText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept} activeOpacity={0.85}>
              <Check size={18} color="#FFF" />
              <Text style={styles.acceptText}>Accept</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.52)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFF',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 12,
  },
  badge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,107,129,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: THEME.textMain,
  },
  subtitle: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    color: THEME.textLight,
    textAlign: 'center',
  },
  actions: {
    marginTop: 22,
    width: '100%',
    flexDirection: 'row',
    gap: 12,
  },
  declineBtn: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  declineText: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.textMain,
  },
  acceptBtn: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    backgroundColor: THEME.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  acceptText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFF',
  },
});
