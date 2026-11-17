import { Image as NativeImage } from 'react-native';
import { Image } from 'expo-image';

export const RACE_RUNNERS = require('../../assets/race/runners-v1.webp');
export const RACE_SCENERY = require('../../assets/race/scenery-v1.webp');

let pending: Promise<void> | null = null;

// Must use the same expo-image memory cache that RaceScene renders from.
export function preloadRaceArtwork(): Promise<void> {
  if (pending) return pending;
  pending = Promise.resolve().then(async () => {
    const uris = [RACE_RUNNERS, RACE_SCENERY]
      .map(source => NativeImage.resolveAssetSource(source)?.uri)
      .filter((uri): uri is string => !!uri);
    if (!uris.length || !await Image.prefetch(uris, 'memory-disk')) pending = null;
  }).catch(() => { pending = null; });
  return pending;
}
