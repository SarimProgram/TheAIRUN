import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRaceInviteResponse } from '@/hooks/useRaceInviteResponse';
import InvitationCard from '@/components/home/InvitationCard';

export default function GlobalRaceInviteOverlay() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { raceState, inviteFrom, onAccept, onDeny } = useRaceInviteResponse();
  const [deferred, setDeferred] = useState(false);
  const [busy, setBusy] = useState(false);
  const onHome = pathname === '/' || pathname === '/home';
  useEffect(() => { setDeferred(false); }, [inviteFrom, pathname]);

  return (
    <Modal visible={!onHome && raceState === 'invited' && !!inviteFrom && !deferred} transparent animationType="fade"
      onRequestClose={() => { if (!busy) setDeferred(true); }} statusBarTranslucent>
      <View style={styles.backdrop}>
        <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]} bounces={false}>
          <View style={styles.card}>
            <InvitationCard key={inviteFrom?.inviteId ?? inviteFrom?.fromUserId} kind="race"
              from={inviteFrom?.fromName || 'Your partner'}
              detail={`${((inviteFrom?.distance ?? 0) / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} km`}
              onAccept={async () => { setBusy(true); try { await onAccept(); } finally { setBusy(false); } }}
              onDeny={onDeny} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.52)' },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  card: { width: '100%', maxWidth: 400 },
});
