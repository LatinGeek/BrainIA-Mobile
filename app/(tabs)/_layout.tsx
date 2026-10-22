import { Tabs } from 'expo-router';
import { useWindowDimensions } from 'react-native';

import { Dock } from '@/components/layout/Dock';

export default function TabLayout() {
  const { width } = useWindowDimensions();

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
      <Tabs.Screen name="search" options={{ title: 'Explorar' }} />
      <Tabs.Screen name="capture" options={{ href: null, title: 'Capturar' }} />
      <Tabs.Screen name="financials" options={{ title: 'Dinero' }} />
      <Tabs.Screen name="review" options={{ title: 'Revisar' }} />
    </Tabs>
  );
}
