import { useEffect, useRef, useState } from 'react';
import {
  isInterventionAnimation,
  parseInterventionMessage,
  getInterventionDisplayTitle,
} from '../components/chat/partnerNoteShared';
import type { ChatMessage } from '../contexts/ChatContext';
import type { ImageSourcePropType } from 'react-native';
import type { ReminderPhotoAnimation } from '../components/partner/reminderPhotoAnimations';
import { CUSTOM_REMINDER_PREFIX, parseCustomReminderPayload } from '../utils/customReminderMessage';

export type InterventionCelebrationRequest = {
  key: string;
  mode: 'hearts' | 'angry' | 'cat' | 'photo';
  previewImage?: ImageSourcePropType;
  photoAnimation?: ReminderPhotoAnimation;
  copy: {
    eyebrow: string;
    title: string;
    fromPartner: boolean;
  };
};

type Options = {
  messages: ChatMessage[];
  currentUserId: string | null;
  onPartnerAnimation?: () => void;
};

function pruneProcessedIds(processedIds: Set<string>, maxSize = 200) {
  if (processedIds.size <= maxSize) return;
  const overflow = processedIds.size - maxSize;
  const iterator = processedIds.values();
  for (let i = 0; i < overflow; i += 1) {
    const next = iterator.next();
    if (next.done) break;
    processedIds.delete(next.value);
  }
}

function customCelebrationEyebrow(fromName: string, content: string) {
  const payload = parseCustomReminderPayload(content);
  if (payload?.title) {
    return `${fromName} · ${payload.title.toUpperCase()}`;
  }
  return `${fromName} · YOUR REMINDER`;
}

export function useInterventionCelebration({
  messages,
  currentUserId,
  onPartnerAnimation,
}: Options) {
  const processedIdsRef = useRef(new Set<string>());
  const partnerAnimationKeyRef = useRef<string | null>(null);
  const [celebrationRequest, setCelebrationRequest] =
    useState<InterventionCelebrationRequest | null>(null);

  useEffect(() => {
    if (!currentUserId || messages.length === 0) return;

    const animatedMessages = messages
      .filter((message) => {
        if (!isInterventionAnimation(message.content)) return false;
        const isMine = message.fromUserId === currentUserId;
        if (isMine) return !!message.optimistic;
        return true;
      })
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

    const latest = animatedMessages[animatedMessages.length - 1];
    if (!latest) return;

    if (processedIdsRef.current.has(latest.id)) {
      return;
    }

    const age = Date.now() - new Date(latest.createdAt).getTime();
    if (age > 60_000) {
      processedIdsRef.current.add(latest.id);
      pruneProcessedIds(processedIdsRef.current);
      return;
    }

    const parsed = parseInterventionMessage(latest.content);
    if (!parsed || parsed.mode === 'plain') {
      processedIdsRef.current.add(latest.id);
      pruneProcessedIds(processedIdsRef.current);
      return;
    }

    processedIdsRef.current.add(latest.id);
    pruneProcessedIds(processedIdsRef.current);

    const isMine = latest.fromUserId === currentUserId;
    const isKcal = /^\[KCAL/i.test(latest.content);
    const isWater = /^\[WATER/i.test(latest.content);
    const isCustom = latest.content.trim().startsWith(CUSTOM_REMINDER_PREFIX);
    const fromName = isMine
      ? 'YOU'
      : String(latest.fromName || 'Partner').split(' ')[0].toUpperCase();

    setCelebrationRequest((current) => {
      if (current?.key === latest.id) {
        return current;
      }

      return {
        key: latest.id,
        mode: parsed.mode as 'hearts' | 'angry' | 'cat' | 'photo',
        previewImage: parsed.previewImage,
        photoAnimation: parsed.photoAnimation,
        copy: {
          eyebrow: isCustom
            ? customCelebrationEyebrow(fromName, latest.content)
            : isWater
              ? `${fromName} · HYDRATION`
              : isKcal
                ? `${fromName} · CALORIE CHECK`
                : `${fromName} · STEP BATTLE`,
          title: getInterventionDisplayTitle(latest.content),
          fromPartner: !isMine,
        },
      };
    });

    if (!isMine && partnerAnimationKeyRef.current !== latest.id) {
      partnerAnimationKeyRef.current = latest.id;
      onPartnerAnimation?.();
    }
  }, [currentUserId, messages, onPartnerAnimation]);

  return celebrationRequest;
}
