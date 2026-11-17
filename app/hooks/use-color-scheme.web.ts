import type { ColorSchemeName } from 'react-native';

// Match native and static rendering regardless of the browser's theme.
export function useColorScheme(): ColorSchemeName {
  return 'light';
}
