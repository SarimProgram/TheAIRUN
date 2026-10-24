import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  PanResponder,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import { PenLine, Swords, ChevronDown, ChevronUp, AlertTriangle, UserX } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import PartnerNoteCompose from './PartnerNoteCompose';
import NoteDrawingPreview from './NoteDrawingPreview';
import {
  COLORS,
  MESSAGE_LIFETIME_MS,
  mono,
  getDisplayContent,
  isStepMessage,
  isKcalMessage,
  isInterventionAnimation,
  parseDrawMessage,
} from './partnerNoteShared';

type ChatMessage = {
  id: string;
  fromUserId: string;
  fromName?: string;
  content: string;
  createdAt: string;
  viewedAt?: string;
};

const TimeLeftBar = ({ createdAt }: { createdAt: string }) => {
  const [fraction, setFraction] = useState(1);

  useEffect(() => {
    const msgTime = new Date(createdAt).getTime();
    const interval = setInterval(() => {
      const elapsed = Date.now() - msgTime;
      const remaining = Math.max(0, 1 - elapsed / MESSAGE_LIFETIME_MS);
      setFraction(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 500);
    return () => clearInterval(interval);
  }, [createdAt]);

  return (
    <View style={noteStyles.progressTrack}>
      <View style={[noteStyles.progressFill, { width: `${fraction * 100}%` }]} />
    </View>
  );
};

const PartnerNote = ({ msg, compact, isMe }: { msg: ChatMessage; compact?: boolean; isMe?: boolean }) => {
  const drawStrokes = parseDrawMessage(msg.content);
  const displayContent = getDisplayContent(msg.content);
  const stepMsg = isStepMessage(msg.content);
  const kcalMsg = isKcalMessage(msg.content);
  const isDrawing = !!drawStrokes || msg.content.startsWith('[DRAW]');

  return (
    <Animated.View
      entering={FadeInDown.duration(260)}
      style={[noteStyles.wrap, isMe && noteStyles.wrapMe]}
    >
      <View style={[noteStyles.tape, compact && noteStyles.tapeCompact, isMe && noteStyles.tapeMe]} />
      <View
        style={[
          noteStyles.note,
          isMe ? noteStyles.noteMe : noteStyles.notePartner,
          compact && noteStyles.noteCompact,
        ]}
      >
        <Text style={noteStyles.sender}>{isMe ? 'You' : msg.fromName || 'Partner'}</Text>
        {isDrawing ? (
          <>
            <Text style={noteStyles.drawLabel}>Drawing</Text>
            <NoteDrawingPreview content={msg.content} height={compact ? 56 : 72} compact={compact} />
          </>
        ) : (
          <Text style={[noteStyles.body, compact && noteStyles.bodyCompact]} numberOfLines={compact ? 3 : undefined}>
            {displayContent}
          </Text>
        )}
        {stepMsg && (
          <View style={noteStyles.stepTag}>
            <Swords size={10} color={COLORS.inkFaded} strokeWidth={3} />
            <Text style={noteStyles.stepTagText}>STEP BATTLE</Text>
          </View>
        )}
        {kcalMsg && (
          <View style={[noteStyles.stepTag, noteStyles.kcalTag]}>
            <AlertTriangle size={10} color="#B45309" strokeWidth={3} />
            <Text style={[noteStyles.stepTagText, noteStyles.kcalTagText]}>CALORIE CHECK</Text>
          </View>
        )}
        <View style={noteStyles.metaRow}>
          <Text style={noteStyles.meta}>
            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          <Text style={noteStyles.meta}>expires in 60s</Text>
        </View>
        <TimeLeftBar createdAt={msg.createdAt} />
      </View>
    </Animated.View>
  );
};

const noteStyles = StyleSheet.create({
  wrap: { marginBottom: 10, alignSelf: 'flex-start', maxWidth: '92%' },
  wrapMe: { alignSelf: 'flex-end' },
  tape: {
    position: 'absolute',
    top: -4,
    left: 18,
    width: 42,
    height: 12,
    backgroundColor: COLORS.tapeColor,
    borderRadius: 1,
    zIndex: 2,
  },
  tapeMe: { left: undefined, right: 18 },
  tapeCompact: { width: 36, height: 10, left: 14 },
  note: {
    borderRadius: 4,
    borderWidth: 1,
    borderStyle: 'dashed',
    paddingHorizontal: 14,
    paddingVertical: 12,
    paddingTop: 16,
    shadowColor: '#5C4033',
    shadowOffset: { width: 1, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2,
  },
  notePartner: {
    backgroundColor: COLORS.notePartner,
    borderColor: COLORS.notePartnerDark,
  },
  noteMe: {
    backgroundColor: COLORS.noteYellow,
    borderColor: COLORS.noteYellowDark,
  },
  noteCompact: { paddingVertical: 10, paddingTop: 14 },
  sender: {
    fontFamily: mono,
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.inkFaded,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  drawLabel: {
    fontFamily: mono,
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.inkFaded,
    marginBottom: 4,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  body: {
    fontFamily: mono,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: COLORS.inkDark,
  },
  bodyCompact: { fontSize: 13, lineHeight: 18 },
  stepTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(92, 64, 51, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(92, 64, 51, 0.15)',
  },
  stepTagText: {
    fontFamily: mono,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
    color: COLORS.inkFaded,
  },
  kcalTag: {
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
    borderColor: 'rgba(220, 38, 38, 0.15)',
  },
  kcalTagText: {
    color: '#B45309',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  meta: {
    fontFamily: mono,
    fontSize: 9,
    color: COLORS.inkFaded,
    letterSpacing: 0.4,
  },
  progressTrack: {
    height: 2,
    borderRadius: 1,
    marginTop: 6,
    overflow: 'hidden',
    backgroundColor: 'rgba(92, 64, 51, 0.12)',
  },
  progressFill: {
    height: '100%',
    borderRadius: 1,
    backgroundColor: COLORS.inkFaded,
  },
});

type Props = {
  partnerName?: string;
  messages?: ChatMessage[];
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
  hasPartner?: boolean;
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
  hasPartner = true,
}: Props) {
  const insets = useSafeAreaInsets();
  const [lastSent, setLastSent] = useState<string | null>(null);

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

  const latestPartnerMessage = useMemo(
    () =>
      [...messages]
        .filter((m) => m.fromUserId !== currentUserId)
        .filter((m) => !isInterventionAnimation(m.content))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null,
    [messages, currentUserId]
  );

  const latestOwnMessage = useMemo(
    () =>
      [...messages]
        .filter((m) => m.fromUserId === currentUserId)
        .filter((m) => !isInterventionAnimation(m.content))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null,
    [messages, currentUserId]
  );

  const hasVisibleNotes = !!latestPartnerMessage || !!latestOwnMessage;

  useEffect(() => {
    if (!lastSent) return;
    const timer = setTimeout(() => setLastSent(null), 2800);
    return () => clearTimeout(timer);
  }, [lastSent]);

  const guardSend = () => {
    if (!hasPartner) {
      Alert.alert('Partner is not connected', 'Connect with a partner before sending a message.');
      return false;
    }
    if (!connected) {
      Alert.alert('Chat unavailable', 'Live partner chat is not available right now.');
      return false;
    }
    return true;
  };

  const deliverMessage = (content: string, preview?: string) => {
    if (!sendMessage) return;
    sendMessage(content);
    setLastSent(preview ?? content);
  };

  const handleComposeSend = (content: string) => {
    if (!guardSend()) return;
    const preview = content.startsWith('[DRAW]') ? 'Drawing sent' : content;
    deliverMessage(content, preview);
  };

  const sendDisabled = !hasPartner || !connected;

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
          <Text style={styles.headerLabelText}>NOTE TO {partnerName.toUpperCase()}</Text>
        </View>
        {showStatusText && (
          <Text style={styles.headerSubText}>
            {chatError || (connected ? 'Write a note • disappears in 60s' : 'Connecting...')}
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

      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={expanded ? insets.top + 12 : 0}
      >
        <View style={[styles.notesArea, expanded && styles.notesAreaExpanded]}>
          {hasVisibleNotes ? (
            <View style={styles.notesStack}>
              {latestPartnerMessage && (
                <PartnerNote msg={latestPartnerMessage} compact={!expanded} />
              )}
              {latestOwnMessage && (
                <PartnerNote msg={latestOwnMessage} compact={!expanded} isMe />
              )}
            </View>
          ) : (
            <Animated.View entering={FadeIn.duration(200)} style={[styles.emptyState, !expanded && styles.emptyStateCompact]}>
              <View style={styles.emptyIconCircle}>
                <PenLine size={expanded ? 22 : 18} color="rgba(255,255,255,0.85)" />
              </View>
              <Text style={[styles.emptyText, !expanded && styles.emptyTextCompact]}>Send a quick note</Text>
              {!expanded && (
                <Text style={styles.emptySubText}>Use the note box below</Text>
              )}
            </Animated.View>
          )}
        </View>

        <View style={[styles.footerContainer, expanded && styles.footerContainerExpanded]}>
          {lastSent && (
            <Animated.View entering={FadeIn.duration(180)} style={styles.sentChip}>
              <Text style={styles.sentChipLabel}>Sent</Text>
              <Text style={styles.sentChipText} numberOfLines={1}>{lastSent}</Text>
            </Animated.View>
          )}

          <PartnerNoteCompose
            partnerName={partnerName}
            compact={!expanded}
            disabled={sendDisabled}
            onSend={handleComposeSend}
          />
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
  headerLabel: { alignItems: 'center', marginTop: 4 },
  headerLabelExpanded: { marginTop: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  connDot: { width: 6, height: 6, borderRadius: 3 },
  headerLabelText: { fontSize: 11, color: '#FFF', letterSpacing: 3, fontWeight: '900' },
  headerSubText: { fontSize: 9, color: 'rgba(255,255,255,0.65)', marginTop: 3, letterSpacing: 0.4 },
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
    fontFamily: mono,
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  headerActionTextCompact: { fontSize: 9, letterSpacing: 0.5 },

  body: { flex: 1, justifyContent: 'space-between' },
  notesArea: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 8,
    justifyContent: 'flex-start',
  },
  notesAreaExpanded: { paddingTop: 12, paddingHorizontal: 16 },
  notesStack: { gap: 4 },

  emptyState: {
    alignItems: 'center',
    paddingVertical: 16,
    marginBottom: 4,
  },
  emptyStateCompact: { paddingVertical: 8, marginBottom: 0 },
  emptyIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyText: {
    fontFamily: mono,
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  emptyTextCompact: { fontSize: 11, letterSpacing: 1 },
  emptySubText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    marginTop: 4,
  },

  footerContainer: { paddingHorizontal: 14, paddingBottom: 16, paddingTop: 8, gap: 8 },
  footerContainerExpanded: { paddingHorizontal: 16, paddingBottom: 24 },
  sentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sentChipLabel: {
    fontFamily: mono,
    fontSize: 9,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sentChipText: {
    flex: 1,
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
});
