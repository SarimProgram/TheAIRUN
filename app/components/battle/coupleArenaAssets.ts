import { Image as NativeImage } from 'react-native';
import { Image } from 'expo-image';

export const COUPLE_PARK = require('../../assets/avatars/couple-rig/park.webp');
export const COUPLE_RIG = {
  male: {
    legs: require('../../assets/avatars/couple-rig/male-legs.webp'),
    torso: require('../../assets/avatars/couple-rig/male-torso.webp'),
    head: require('../../assets/avatars/couple-rig/male-head.webp'),
    rear: require('../../assets/avatars/couple-rig/male-rear.webp'),
    front: require('../../assets/avatars/couple-rig/male-front.webp'),
  },
  female: {
    legs: require('../../assets/avatars/couple-rig/female-legs.webp'),
    torso: require('../../assets/avatars/couple-rig/female-torso.webp'),
    head: require('../../assets/avatars/couple-rig/female-head.webp'),
    rear: require('../../assets/avatars/couple-rig/female-rear.webp'),
    front: require('../../assets/avatars/couple-rig/female-front.webp'),
  },
} as const;

export const COUPLE_HEADS = {
  male: require('../../assets/avatars/couple-rig/male-portrait.webp'),
  female: require('../../assets/avatars/couple-rig/female-portrait.webp'),
} as const;
export const COUPLE_REST = {
  male: require('../../assets/avatars/couple-rig/male-rest.webp'),
  female: require('../../assets/avatars/couple-rig/female-rest.webp'),
} as const;

export const OPPONENT_RIG = {
  male: {
    legs: require('../../assets/avatars/couple-opponents-v1/male-legs.webp'),
    torso: require('../../assets/avatars/couple-opponents-v1/male-torso.webp'),
    head: require('../../assets/avatars/couple-opponents-v1/male-head.webp'),
    rear: require('../../assets/avatars/couple-opponents-v1/male-rear.webp'),
    front: require('../../assets/avatars/couple-opponents-v1/male-front.webp'),
  },
  female: {
    legs: require('../../assets/avatars/couple-opponents-v1/female-legs.webp'),
    torso: require('../../assets/avatars/couple-opponents-v1/female-torso.webp'),
    head: require('../../assets/avatars/couple-opponents-v1/female-head.webp'),
    rear: require('../../assets/avatars/couple-opponents-v1/female-rear.webp'),
    front: require('../../assets/avatars/couple-opponents-v1/female-front.webp'),
  },
} as const;
export const OPPONENT_HEADS = {
  male: require('../../assets/avatars/couple-opponents-v1/male-portrait.webp'),
  female: require('../../assets/avatars/couple-opponents-v1/female-portrait.webp'),
} as const;
export const OPPONENT_REST = {
  male: require('../../assets/avatars/couple-opponents-v1/male-rest.webp'),
  female: require('../../assets/avatars/couple-opponents-v1/female-rest.webp'),
} as const;

let pending: Promise<void> | null = null;
export function preloadCoupleArtwork(): Promise<void> {
  if (pending) return pending;
  pending = Promise.resolve().then(async () => {
    const sources = [COUPLE_PARK, ...Object.values(COUPLE_RIG.male), ...Object.values(COUPLE_RIG.female), ...Object.values(COUPLE_HEADS), ...Object.values(OPPONENT_RIG.male), ...Object.values(OPPONENT_RIG.female), ...Object.values(OPPONENT_HEADS)];
    const uris = sources.map(source => NativeImage.resolveAssetSource(source)?.uri).filter((uri): uri is string => !!uri);
    if (!uris.length || !await Image.prefetch(uris, 'memory-disk')) pending = null;
  }).catch(() => { pending = null; });
  return pending;
}
