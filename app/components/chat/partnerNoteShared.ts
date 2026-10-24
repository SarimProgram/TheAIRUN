import { Platform, type ImageSourcePropType } from 'react-native';

import { REMINDER_ASSET_BY_ID } from '@/components/partner/reminderAssets';

import type { ReminderPhotoAnimation } from '@/components/partner/reminderPhotoAnimations';

import { DEFAULT_REMINDER_PHOTO_ANIMATION } from '@/components/partner/reminderPhotoAnimations';

import {

  CUSTOM_REMINDER_PREFIX,

  customReminderPreviewSource,

  parseCustomReminderPayload,

} from '@/utils/customReminderMessage';



export const COLORS = {

  coral: '#FF6B6B',

  inkDark: '#2C1810',

  inkFaded: '#5C4033',

  noteYellow: '#FFF8DC',

  noteYellowDark: '#F5E6B8',

  notePartner: '#F0EDE4',

  notePartnerDark: '#DDD8CB',

  tapeColor: 'rgba(255, 220, 150, 0.65)',

};



export const MESSAGE_LIFETIME_MS = 60 * 1000;

export const WATER = '\u{1F4A7}';

export const FIRE = '\u{1F525}';

export const HEART = '\u2764\uFE0F';

export const DRAW_PREFIX = '[DRAW]';



export const mono = Platform.OS === 'ios' ? 'Courier' : 'monospace';



export type StrokePoint = { x: number; y: number };

export type Stroke = StrokePoint[];



export type ParsedInterventionMessage = {

  mode: 'hearts' | 'angry' | 'cat' | 'photo' | 'plain';

  text: string;

  previewTitle?: string;

  assetId?: string;

  previewImage?: ImageSourcePropType;

  photoAnimation?: ReminderPhotoAnimation;

};



export function encodeDrawMessage(strokes: Stroke[], width: number, height: number): string {

  const w = Math.max(1, width);

  const h = Math.max(1, height);

  const compact = strokes.map((stroke) =>

    stroke.map((p) => [

      Math.round((p.x / w) * 1000),

      Math.round((p.y / h) * 1000),

    ])

  );

  return `${DRAW_PREFIX}${JSON.stringify({ s: compact })}`;

}



export function parseDrawMessage(content: string, width = 280, height = 72): Stroke[] | null {

  if (!content.startsWith(DRAW_PREFIX)) return null;

  try {

    const data = JSON.parse(content.slice(DRAW_PREFIX.length));

    const raw = data.s ?? data.strokes ?? [];

    return raw.map((stroke: number[][]) =>

      stroke.map(([x, y]) => ({

        x: (x / 1000) * width,

        y: (y / 1000) * height,

      }))

    );

  } catch {

    return null;

  }

}



function interventionModeFallbackTitle(mode: ParsedInterventionMessage['mode']): string {
  switch (mode) {
    case 'hearts':
      return 'You are doing so good!';
    case 'angry':
      return 'Eat less!!';
    case 'cat':
    case 'photo':
      return 'Drink some water.';
    default:
      return '';
  }
}

function resolveInterventionDisplayText(intervention: ParsedInterventionMessage): string {
  const asset = intervention.assetId ? REMINDER_ASSET_BY_ID[intervention.assetId] : undefined;

  if (intervention.mode === 'photo' && !intervention.assetId && intervention.text?.trim()) {
    return intervention.text.trim();
  }

  return (
    intervention.previewTitle?.trim()
    || intervention.text?.trim()
    || asset?.previewTitle?.trim()
    || asset?.message?.trim()
    || (intervention.mode !== 'plain' ? interventionModeFallbackTitle(intervention.mode) : '')
  );
}

export function stripInterventionMarkup(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith(CUSTOM_REMINDER_PREFIX)) {
    const payload = parseCustomReminderPayload(trimmed);
    if (payload) {
      return payload.text?.trim() || payload.title?.trim() || '';
    }
  }

  const tagged = trimmed.replace(
    /^\[(?:STEPS|KCAL|WATER)\s*:\s*(?:hearts|angry|cat|photo\s*:\s*[\w-]+)\]\s*/i,
    '',
  );
  if (tagged !== trimmed) {
    return tagged.trim();
  }

  const plain = trimmed.replace(/^\[(?:STEPS|KCAL|WATER)\]\s*/i, '');
  return plain.trim();
}

function parseTaggedMessage(
  content: string,
  tag: 'STEPS' | 'KCAL' | 'WATER',
): ParsedInterventionMessage | null {
  const trimmed = content.trim();
  const tagPrefix = new RegExp(`^\\[${tag}(?=[\\]:\\s])`, 'i');
  if (!tagPrefix.test(trimmed)) return null;

  const photoMatch = trimmed.match(
    new RegExp(`^\\[${tag}\\s*:\\s*photo\\s*:\\s*([\\w-]+)\\]\\s*(.*)$`, 'is'),
  );
  if (photoMatch) {
    const assetId = photoMatch[1];
    const asset = REMINDER_ASSET_BY_ID[assetId];
    const bodyText = (photoMatch[2] || '').trim();

    return {
      mode: 'photo',
      assetId,
      previewImage: asset?.image,
      photoAnimation: asset?.photoAnimation ?? DEFAULT_REMINDER_PHOTO_ANIMATION,
      previewTitle: asset?.previewTitle,
      text: bodyText || asset?.message || asset?.previewTitle || '',
    };
  }

  const animatedMatch = trimmed.match(
    new RegExp(`^\\[${tag}\\s*:\\s*(hearts|angry|cat)\\]\\s*(.*)$`, 'is'),
  );
  if (animatedMatch) {
    const mode = animatedMatch[1].toLowerCase() as 'hearts' | 'angry' | 'cat';
    const assetId = mode === 'cat' ? 'water-cat' : undefined;
    const asset = assetId ? REMINDER_ASSET_BY_ID[assetId] : undefined;
    const bodyText = (animatedMatch[2] || '').trim();

    return {
      mode,
      assetId,
      previewImage: asset?.image,
      photoAnimation: asset?.photoAnimation ?? (mode === 'cat' ? 'beg' : undefined),
      previewTitle: asset?.previewTitle,
      text: bodyText || asset?.message || asset?.previewTitle || '',
    };
  }

  const plainMatch = trimmed.match(new RegExp(`^\\[${tag}\\]\\s*(.*)$`, 'is'));
  if (plainMatch) {
    return {
      mode: 'plain',
      text: (plainMatch[1] || '').trim(),
    };
  }

  return null;
}



export function parseStepMessage(content: string): ParsedInterventionMessage | null {

  const parsed = parseTaggedMessage(content, 'STEPS');

  if (!parsed || parsed.mode === 'cat') return null;

  return parsed;

}



export function parseKcalMessage(content: string): ParsedInterventionMessage | null {

  const parsed = parseTaggedMessage(content, 'KCAL');

  if (!parsed || parsed.mode === 'cat') return null;

  return parsed;

}



export function parseWaterMessage(content: string): ParsedInterventionMessage | null {

  const parsed = parseTaggedMessage(content, 'WATER');

  if (!parsed || parsed.mode === 'hearts' || parsed.mode === 'angry') return null;

  return parsed;

}



export function parseCustomMessage(content: string): ParsedInterventionMessage | null {

  const payload = parseCustomReminderPayload(content);

  if (!payload) {

    return null;

  }



  return {

    mode: 'photo',

    previewImage: customReminderPreviewSource(payload.img),

    photoAnimation: payload.anim,

    previewTitle: payload.title,

    text: payload.text,

  };

}



export function parseInterventionMessage(content: string): ParsedInterventionMessage | null {

  return (

    parseCustomMessage(content)

    || parseStepMessage(content)

    || parseKcalMessage(content)

    || parseWaterMessage(content)

  );

}



export function isStepMessage(content: string) {
  return /^\[STEPS(?=[\]:\s])/i.test(content.trim());
}

export function isKcalMessage(content: string) {
  return /^\[KCAL(?=[\]:\s])/i.test(content.trim());
}

export function isWaterMessage(content: string) {
  return /^\[WATER(?=[\]:\s])/i.test(content.trim());
}

export function isInterventionAnimation(content: string) {
  const trimmed = content.trim();
  return trimmed.startsWith(CUSTOM_REMINDER_PREFIX)
    || /^\[(?:STEPS|KCAL)\s*:\s*(?:hearts|angry|photo\s*:[\w-]+)\]/i.test(trimmed)
    || /^\[WATER\s*:\s*(?:cat|photo\s*:[\w-]+)\]/i.test(trimmed);
}

export function isInterventionMessage(content: string) {
  const trimmed = content.trim();
  return isStepMessage(trimmed)
    || isKcalMessage(trimmed)
    || isWaterMessage(trimmed)
    || trimmed.startsWith(CUSTOM_REMINDER_PREFIX);
}

export function formatChatNotificationBody(content: string): string {
  const display = getDisplayContent(content).trim();
  if (display) return display;

  const stripped = stripInterventionMarkup(content).trim();
  if (stripped) return stripped;

  if (isInterventionAnimation(content) || isInterventionMessage(content)) {
    return 'New partner reminder';
  }

  return content.trim() || 'New partner message';
}

export function isInterventionMarkup(content: string): boolean {
  const trimmed = content.trim();
  return trimmed.startsWith(CUSTOM_REMINDER_PREFIX)
    || /^\[(?:STEPS|KCAL|WATER)\b/i.test(trimmed);
}

export function getInterventionDisplayTitle(content: string): string {
  const trimmed = content.trim();
  if (trimmed.startsWith(CUSTOM_REMINDER_PREFIX)) {
    const payload = parseCustomReminderPayload(trimmed);
    if (payload) {
      return payload.text || payload.title || 'New partner reminder';
    }
  }

  const intervention = parseInterventionMessage(content);
  if (intervention) {
    return resolveInterventionDisplayText(intervention);
  }
  return stripInterventionMarkup(content);
}

export function getDisplayContent(content: string) {
  const intervention = parseInterventionMessage(content);
  if (intervention) {
    const display = resolveInterventionDisplayText(intervention);
    if (display) return display;
    if (intervention.mode === 'plain') return intervention.text;
    return '';
  }

  if (content.startsWith(DRAW_PREFIX)) return '';

  const stripped = stripInterventionMarkup(content);
  return stripped || content;
}


