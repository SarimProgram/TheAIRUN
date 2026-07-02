import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
  PanResponder,
  KeyboardAvoidingView,
} from 'react-native';
import { MessageSquare, Send, X, MessageCircle, Swords, ChevronDown, ChevronUp, AlertTriangle, UserX } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const COLORS = {
  coral: '#FF6B6B',
  inkDark: '#2C1810',
  inkFaded: '#5C4033',
  noteYellow: '#FFF8DC',
  noteYellowDark: '#F5E6B8',
  notePartner: '#F0EDE4',
  notePartnerDark: '#DDD8CB',
  tapeColor: 'rgba(255, 220, 150, 0.6)',
};

const WATER = '\u{1F4A7}';
const FIRE = '\u{1F525}';
const HEART = '\u2764\uFE0F';

const ChatBubble = ({ msg, isMe, onExpiry }: any) => {
  const [timeLeft, setTimeLeft] = useState(60);
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const isStepMsg = msg.content?.startsWith('[STEPS]');
  const displayContent = isStepMsg ? msg.content.replace('[STEPS]', '').trim() : msg.content;
  const timerStartedAt = isMe ? msg.createdAt : msg.viewedAt;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();

    if (isStepMsg) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [isStepMsg, msg.id, pulseAnim, scaleAnim, slideAnim]);

  useEffect(() => {
    if (!timerStartedAt) {
      setTimeLeft(60);
      return;
    }

    const timerStart = new Date(timerStartedAt).getTime();
    const elapsed = Math.floor((Date.now() - timerStart) / 1000);
    const initialTimeLeft = Math.max(0, 60 - elapsed);
    setTimeLeft(initialTimeLeft);

    if (initialTimeLeft <= 0) {
      onExpiry?.();
      return;
    }

    const interval = setInterval(() => {
      setTimeLeft((prev: number) => {
        if (prev <= 1) {
          clearInterval(interval);
          Animated.timing(scaleAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
            onExpiry?.();
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [onExpiry, scaleAnim, timerStartedAt]);

  const progressRatio = timerStartedAt ? timeLeft / 60 : 1;

  return (
    <Animated.View
      style={[
        styles.bubbleContainer,
        isMe ? styles.bubbleRight : styles.bubbleLeft,
        {
          transform: [
            { scale: scaleAnim },
            { translateY: slideAnim },
            { scale: isStepMsg ? pulseAnim : 1 },
            { rotate: isMe ? '-0.8deg' : '0.6deg' },
          ],
        },
      ]}
    >
      <View style={[styles.tapeStrip, isMe ? styles.tapeStripRight : styles.tapeStripLeft]} />

      <View
        style={[
          styles.bubble,
          styles.retroNote,
          isMe ? styles.retroNoteMe : styles.retroNotePartner,
          styles.shadowDepth,
        ]}
      >
        {!isMe && <Text style={styles.bubbleSender}>Partner</Text>}
        <Text style={[styles.bubbleText, styles.retroText]}>{displayContent}</Text>
        {isStepMsg && (
          <View style={[styles.stepTag, isMe && styles.stepTagMe]}>
            <Swords size={10} color={COLORS.inkFaded} strokeWidth={3} />
            <Text style={styles.stepTagText}>STEP BATTLE</Text>
          </View>
        )}
      </View>

      <View style={styles.bubbleMeta}>
        <Text style={styles.retroMetaText}>
          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
        <Text style={styles.retroMetaText}>{timerStartedAt ? `${timeLeft}s` : '60s'}</Text>
      </View>

      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBar, { width: `${progressRatio * 100}%` }]} />
      </View>
    </Animated.View>
  );
};

const MessagePreset = ({ emoji, label, onPress, disabled }: any) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled}
    activeOpacity={0.7}
    style={[styles.presetPill, disabled && styles.disabled]}
  >
    <View style={styles.presetInner}>
      <Text style={styles.presetEmoji}>{emoji}</Text>
      <Text style={styles.presetLabel}>{label}</Text>
    </View>
  </TouchableOpacity>
);

type Props = {
  partnerName?: string;
  messages?: any[];
  sendMessage?: (content: string) => void;
  connected?: boolean;
  chatError?: string | null;
  currentUserId?: string | null;
  expanded?: boolean;
  onExpand?: () => void;
  onCollapse?: () => void;
  onReport?: () => void;
  onBlock?: () => void;
  moderationBusy?: boolean;
  showStatusText?: boolean;
  compactModeration?: boolean;
};

export default function PartnerChatPanel({
  partnerName = 'Partner',
  messages = [],
  sendMessage,
  connected = false,
  chatError = null,
  currentUserId,
  expanded = false,
  onExpand,
  onCollapse,
  onReport,
  onBlock,
  moderationBusy = false,
  showStatusText = true,
  compactModeration = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const handleDrag = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          !expanded && Math.abs(gestureState.dy) > 8 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
        onPanResponderRelease: (_, gestureState) => {
          if (!expanded && gestureState.dy > 28) {
            onExpand?.();
          }
        },
      }),
    [expanded, onExpand]
  );

  const handleSend = (content?: string) => {
    const msg = content || text;
    if (!msg.trim() || !sendMessage) return;
    sendMessage(msg.trim());
    setText('');
    setShowCustom(false);
  };

  const sortedMessages = [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 200);

    return () => clearTimeout(timeout);
  }, [sortedMessages.length, showCustom]);

  return (
    <View style={styles.fullScreenWrapper}>
      {!expanded && (
        <View style={styles.expandHandleWrap} {...handleDrag.panHandlers}>
          <TouchableOpacity activeOpacity={0.8} onPress={onExpand} style={styles.expandHandleButton}>
            <View style={styles.expandHandleBar} />
            <ChevronDown size={14} color="#FFF" />
          </TouchableOpacity>
        </View>
      )}
      {expanded && (
        <View style={styles.expandHandleWrap}>
          <TouchableOpacity activeOpacity={0.8} onPress={onCollapse} style={styles.expandHandleButton}>
            <View style={styles.expandHandleBar} />
            <ChevronUp size={14} color="#FFF" />
          </TouchableOpacity>
        </View>
      )}

      <View style={[styles.headerLabel, expanded && styles.headerLabelExpanded]}>
        <View style={styles.headerRow}>
          <View style={[styles.connDot, { backgroundColor: connected ? '#4ADE80' : '#EF4444' }]} />
          <Text style={styles.headerLabelText}>{partnerName.toUpperCase()}</Text>
        </View>
        {showStatusText && (
          <Text style={styles.headerSubText}>
            {chatError || (connected ? 'Active Group Chat' : 'Connecting...')}
          </Text>
        )}
        {(onReport || onBlock) && (
          <View style={[styles.headerActionsRow, !showStatusText && styles.headerActionsRowTight]}>
            <TouchableOpacity
              style={[
                styles.headerActionButton,
                compactModeration && styles.headerActionButtonCompact,
                moderationBusy && styles.headerActionButtonDisabled,
              ]}
              onPress={onReport}
              disabled={!onReport || moderationBusy}
              activeOpacity={0.8}
            >
              <AlertTriangle size={compactModeration ? 12 : 14} color="#FFF7ED" />
              <Text style={[styles.headerActionText, compactModeration && styles.headerActionTextCompact]}>Report</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.headerActionButton,
                styles.headerActionDangerButton,
                compactModeration && styles.headerActionButtonCompact,
                moderationBusy && styles.headerActionButtonDisabled,
              ]}
              onPress={onBlock}
              disabled={!onBlock || moderationBusy}
              activeOpacity={0.8}
            >
              <UserX size={compactModeration ? 12 : 14} color="#FFF5F5" />
              <Text style={[styles.headerActionText, compactModeration && styles.headerActionTextCompact]}>Block</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={[styles.scrollWrapper, expanded && styles.scrollWrapperExpanded]}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.scrollContent, expanded && styles.scrollContentExpanded]}
          showsVerticalScrollIndicator={false}
          bounces
          keyboardShouldPersistTaps="handled"
        >
          {sortedMessages.map((msg) => (
            <ChatBubble
              key={msg.id}
              msg={msg}
              isMe={msg.fromUserId === currentUserId}
              onExpiry={() => {}}
            />
          ))}
          {sortedMessages.length === 0 && (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconCircle}>
                <MessageCircle size={24} color="rgba(255,255,255,0.8)" />
              </View>
              <Text style={styles.emptyText}>Start a conversation</Text>
            </View>
          )}
        </ScrollView>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={expanded ? insets.top + 12 : 0}
      >
        <View style={[styles.footerContainer, expanded && styles.footerContainerExpanded]}>
          {showCustom ? (
            <View style={styles.customInputContainer}>
              <TextInput
                style={styles.motivationInput}
                placeholder="Type your message..."
                placeholderTextColor="#94A3B8"
                autoFocus
                value={text}
                onChangeText={setText}
                onSubmitEditing={() => handleSend()}
                maxLength={100}
                returnKeyType="send"
                blurOnSubmit={false}
              />
              <TouchableOpacity onPress={() => setShowCustom(false)} style={styles.cancelBtn}>
                <X size={18} color="#64748B" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleSend()}
                style={[styles.miniSendBtn, !text.trim() && styles.sendBtnDisabled]}
                disabled={!text.trim()}
              >
                <Send size={14} color="#FFF" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.quickActionsBox}>
              <View style={styles.presetsContainer}>
                <MessagePreset emoji={WATER} label="Water" onPress={() => handleSend(`${WATER} Hydration reminder!`)} disabled={!connected} />
                <MessagePreset emoji={FIRE} label="Fire" onPress={() => handleSend(`${FIRE} Keep it up!`)} disabled={!connected} />
                <MessagePreset emoji={HEART} label="Love" onPress={() => handleSend(`${HEART} Thinking of you!`)} disabled={!connected} />
              </View>
              <TouchableOpacity onPress={() => setShowCustom(true)} style={styles.customMessageBtn} activeOpacity={0.8}>
                <LinearGradient
                  colors={[COLORS.coral, '#F43F5E']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.customBtnGradient}
                >
                  <MessageSquare size={16} color="#FFF" />
                  <Text style={styles.customBtnText}>Tap to type custom message...</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreenWrapper: { flex: 1, width: '100%', justifyContent: 'space-between' },
  expandHandleWrap: { alignItems: 'center', marginTop: 2, marginBottom: 4 },
  expandHandleButton: {
    width: 56,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  expandHandleBar: {
    width: 20,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  headerLabel: { alignItems: 'center', marginTop: 5 },
  headerLabelExpanded: { marginTop: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  connDot: { width: 6, height: 6, borderRadius: 3 },
  headerLabelText: { fontSize: 11, color: '#FFF', letterSpacing: 4, fontWeight: '900' },
  headerSubText: { fontSize: 9, color: 'rgba(255,255,255,0.6)', marginTop: 2, letterSpacing: 0.5 },
  headerActionsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  headerActionsRowTight: { marginTop: 6 },
  headerActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.24)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  headerActionButtonCompact: {
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 13,
  },
  headerActionDangerButton: {
    backgroundColor: 'rgba(127, 29, 29, 0.35)',
    borderColor: 'rgba(254, 202, 202, 0.2)',
  },
  headerActionButtonDisabled: { opacity: 0.55 },
  headerActionText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  headerActionTextCompact: {
    fontSize: 9,
    letterSpacing: 0.5,
  },
  scrollWrapper: { flex: 1, width: '100%', marginTop: 8 },
  scrollWrapperExpanded: { marginTop: 12 },
  scrollContent: { paddingHorizontal: 12, paddingBottom: 10, flexGrow: 1 },
  scrollContentExpanded: { paddingBottom: 24 },
  bubbleContainer: { marginVertical: 8, maxWidth: '82%' },
  bubbleRight: { alignSelf: 'flex-end' },
  bubbleLeft: { alignSelf: 'flex-start' },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, overflow: 'hidden' },
  retroNote: {
    borderRadius: 4,
    borderWidth: 1,
    borderStyle: 'dashed',
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingTop: 18,
  },
  retroNoteMe: { backgroundColor: COLORS.noteYellow, borderColor: COLORS.noteYellowDark },
  retroNotePartner: { backgroundColor: COLORS.notePartner, borderColor: COLORS.notePartnerDark },
  retroText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
    color: COLORS.inkDark,
    letterSpacing: 0.3,
  },
  tapeStrip: {
    position: 'absolute',
    top: -3,
    width: 40,
    height: 10,
    backgroundColor: COLORS.tapeColor,
    borderRadius: 1,
    zIndex: 10,
  },
  tapeStripLeft: { left: 12 },
  tapeStripRight: { right: 12 },
  shadowDepth: {
    shadowColor: '#5C4033',
    shadowOffset: { width: 1, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  bubbleSender: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.inkFaded,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  bubbleText: { fontSize: 14, lineHeight: 19, fontWeight: '600' },
  stepTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    backgroundColor: 'rgba(92, 64, 51, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(92, 64, 51, 0.15)',
    alignSelf: 'flex-start',
  },
  stepTagMe: { backgroundColor: 'rgba(92, 64, 51, 0.12)' },
  stepTagText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: COLORS.inkFaded,
  },
  bubbleMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  retroMetaText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: COLORS.inkFaded,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  progressBarContainer: {
    height: 2,
    borderRadius: 1,
    marginTop: 6,
    overflow: 'hidden',
    backgroundColor: 'rgba(92, 64, 51, 0.15)',
  },
  progressBar: { height: '100%', borderRadius: 1, backgroundColor: COLORS.inkFaded },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 30 },
  emptyIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  footerContainer: { paddingHorizontal: 16, paddingBottom: 20 },
  footerContainerExpanded: { paddingBottom: 28 },
  quickActionsBox: { gap: 10 },
  presetsContainer: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  presetPill: {
    backgroundColor: '#1E293B',
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 14,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  disabled: { opacity: 0.5 },
  presetInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  presetEmoji: { fontSize: 14 },
  presetLabel: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  customMessageBtn: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: COLORS.coral,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  customBtnGradient: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  customBtnText: { color: '#FFF', fontSize: 13, fontWeight: '800', letterSpacing: 0.3 },
  customInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  motivationInput: { flex: 1, height: 42, color: '#0F172A', fontSize: 14, fontWeight: '600' },
  cancelBtn: { padding: 6 },
  miniSendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#CBD5E1' },
});
