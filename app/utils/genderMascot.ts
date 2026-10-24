export function getImageChatAvatarSource(gender?: string | null) {
  return normalizeGender(gender) === 'female'
    ? require('../assets/imagechat-female.png')
    : require('../assets/imagechat-male.png');
}

export function getGenderMascotSource(gender?: string | null) {
  return normalizeGender(gender) === 'female'
    ? require('../assets/pink.png')
    : require('../assets/Gree.png');
}

export function normalizeGender(gender?: string | null): 'male' | 'female' | null {
  const value = String(gender || '').trim().toLowerCase();
  if (value === 'female') return 'female';
  if (value === 'male') return 'male';
  return null;
}

export function getWeeklyAvatarSource(gender?: string | null) {
  return normalizeGender(gender) === 'female'
    ? require('../assets/avatars/weekly-female.png')
    : require('../assets/avatars/weekly-male.png');
}

export function getOppositeWeeklyAvatarSource(gender?: string | null) {
  return normalizeGender(gender) === 'female'
    ? require('../assets/avatars/weekly-male.png')
    : require('../assets/avatars/weekly-female.png');
}

export function getOppositeGenderMascotSource(gender?: string | null) {
  return normalizeGender(gender) === 'female'
    ? require('../assets/Gree.png')
    : require('../assets/pink.png');
}

export const WALK_IMAGE = require('../assets/walkimage.png');

export function getOppositeGender(gender?: string | null): 'male' | 'female' {
  return normalizeGender(gender) === 'male' ? 'female' : 'male';
}

/** Female is the left half of walkimage.png; male is the right half. */
export function isWalkMascotMaleHalf(gender?: string | null): boolean {
  return normalizeGender(gender) === 'male';
}

/** Mirror so the cropped half faces toward the center of the duel card. */
export function shouldMirrorWalkMascot(
  gender?: string | null,
  facing: 'left' | 'right' = 'right'
): boolean {
  const isMale = isWalkMascotMaleHalf(gender);
  return facing === 'right' ? isMale : !isMale;
}
