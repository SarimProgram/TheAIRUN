import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import PartnerChatPanel from '@/components/chat/PartnerChatPanel';
import { useChat } from '@/contexts/ChatContext';
import { API_BASE_URL } from '@/config/api';
import { useAuth } from '@/src/auth/authContext';

export default function ChatFullscreenScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { partnerName } = useLocalSearchParams<{ partnerName?: string }>();
  const { authFetch } = useAuth();
  const { connected, messages, sendMessage, chatError, currentUserId, setIsViewingChat } = useChat() as any;
  const [chatModerationBusy, setChatModerationBusy] = useState(false);

  const latestPartnerMessage = useMemo(() => {
    return [...messages]
      .filter((message) => message.fromUserId !== currentUserId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null;
  }, [messages, currentUserId]);

  useEffect(() => {
    setIsViewingChat(true);
    return () => setIsViewingChat(false);
  }, [setIsViewingChat]);

  const submitChatReport = useCallback(async () => {
    try {
      setChatModerationBusy(true);
      const res = await authFetch(`${API_BASE_URL}/partner/chat/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: latestPartnerMessage?.id,
          reason: 'partner_chat_fullscreen_report',
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit report');
      }

      Alert.alert('Report sent', 'Your report has been saved for review.');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setChatModerationBusy(false);
    }
  }, [authFetch, latestPartnerMessage?.id]);

  const handleReportPartnerChat = useCallback(() => {
    Alert.alert(
      'Report chat',
      'This flags the current partner conversation for review.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Report', style: 'destructive', onPress: () => { void submitChatReport(); } },
      ]
    );
  }, [submitChatReport]);

  const submitPartnerBlock = useCallback(async () => {
    try {
      setChatModerationBusy(true);
      const res = await authFetch(`${API_BASE_URL}/partner/chat/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: 'blocked_from_partner_chat_fullscreen',
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to block partner');
      }

      Alert.alert('Partner blocked', 'Chat has been closed and the partner connection has been removed.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setChatModerationBusy(false);
    }
  }, [authFetch, router]);

  const handleBlockPartner = useCallback(() => {
    Alert.alert(
      'Block partner',
      'This will block this person, disconnect your partner link, and stop future chat until you reconnect manually.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Block', style: 'destructive', onPress: () => { void submitPartnerBlock(); } },
      ]
    );
  }, [submitPartnerBlock]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false, presentation: 'card' }} />
      <LinearGradient colors={['#FF8E8E', '#FF6B6B', '#D94666']} style={StyleSheet.absoluteFillObject} />
      <View style={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 10 }]}>
        <PartnerChatPanel
          partnerName={partnerName || 'Partner'}
          messages={messages}
          sendMessage={sendMessage}
          connected={connected}
          chatError={chatError}
          currentUserId={currentUserId}
          onReport={handleReportPartnerChat}
          onBlock={handleBlockPartner}
          moderationBusy={chatModerationBusy}
          expanded
          onCollapse={() => router.back()}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FF6B6B',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
});
