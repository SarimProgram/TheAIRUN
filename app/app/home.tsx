import { useEffect } from 'react';
import { useRouter } from 'expo-router';

/** Widget deep link (`app://home`) → main home tab. */
export default function HomeWidgetRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/(tabs)');
  }, [router]);

  return null;
}
