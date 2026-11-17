import type { ColorSchemeName } from 'react-native';

// Keep the app in light mode until dark mode is ready to return.
export function useColorScheme(): ColorSchemeName {
  return 'light';
}
