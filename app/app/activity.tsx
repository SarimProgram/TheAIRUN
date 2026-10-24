import { Redirect, useLocalSearchParams } from 'expo-router';

export default function ActivityRedirectScreen() {
  const params = useLocalSearchParams();

  return (
    <Redirect
      href={{
        pathname: '/(tabs)/activity',
        params,
      }}
    />
  );
}
