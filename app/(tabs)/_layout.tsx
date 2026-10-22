import { Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { useWindowDimensions } from 'react-native';

import { Dock } from '@/components/layout/Dock';

// Tabs are mounted lazily, so a first visit pays the whole mount (every frame over 50 ms on a mid-range phone) while its
// entrance plays. Once Hoy has had time to load, the other tabs are mounted one by one in the background; a later visit
// is a plain focus. Visiting one earlier simply mounts it as before.
const WARM_ORDER = ['financials', 'search', 'review'] as const;
const WARM_FIRST_MS = 9000;
const WARM_STEP_MS = 2500;

export default function TabLayout() {
  const { width } = useWindowDimensions();
  const [warm, setWarm] = useState(0);
  useEffect(() => {
    const timers = WARM_ORDER.map((_, index) => setTimeout(() => setWarm(index + 1), WARM_FIRST_MS + index * WARM_STEP_MS));
    return () => timers.forEach(clearTimeout);
  }, []);
  const lazyFor = (name: (typeof WARM_ORDER)[number]) => WARM_ORDER.indexOf(name) >= warm;

  return (
    <Tabs
      tabBar={(props) => (
        <Dock
          state={props.state as unknown as { index: number; routes: { key: string; name: string }[] }}
          navigation={props.navigation as unknown as { navigate: (name: string) => void; emit: (event: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean } }}
        />
      )}
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: width >= 1024 ? 'none' : undefined },
        sceneStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Hoy' }} />
      <Tabs.Screen name="search" options={{ title: 'Explorar', lazy: lazyFor('search') }} />
      <Tabs.Screen name="capture" options={{ href: null, title: 'Capturar' }} />
      <Tabs.Screen name="financials" options={{ title: 'Dinero', lazy: lazyFor('financials') }} />
      <Tabs.Screen name="review" options={{ title: 'Revisar', lazy: lazyFor('review') }} />
    </Tabs>
  );
}
