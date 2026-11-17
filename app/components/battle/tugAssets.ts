import { Image } from 'react-native';

export const TUG_SHEET = require('../../assets/avatars/step-battle-tug-sheet-1536.png');

let pending: Promise<void> | null = null;

// Use the same native image cache as Animated.Image in the battle renderer.
export function preloadTugArtwork(): Promise<void> {
  if (pending) return pending;
  pending = Promise.resolve().then(async () => {
    const uri = Image.resolveAssetSource(TUG_SHEET)?.uri;
    if (!uri || !await Image.prefetch(uri)) pending = null;
  }).catch(() => { pending = null; });
  return pending;
}
