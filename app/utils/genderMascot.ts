export function getGenderMascotSource(gender?: string | null) {
  return String(gender || '').trim().toLowerCase() === 'female'
    ? require('../assets/pink.png')
    : require('../assets/Gree.png');
}
