import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import { ColorValue, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppState } from '@/lib/app-state';
import { ThemeTokens, makeShadow } from '@/lib/themes';

function TabIcon({ theme, name, focused, color }: { theme: ThemeTokens; name: ComponentProps<typeof Feather>['name']; focused: boolean; color: ColorValue }) {
  return (
    <View
      style={{
        width: 52,
        height: 34,
        borderRadius: theme.radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: focused ? theme.colors.accent : 'transparent',
      }}
    >
      <Feather name={name} size={20} color={focused ? theme.colors.onAccent : color} />
    </View>
  );
}

export default function TabLayout() {
  const { theme } = useAppState();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: theme.colors.onAccent,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.background,
          borderTopColor: theme.depth.hairline,
          borderTopWidth: 1,
          height: 72 + insets.bottom,
          paddingTop: 6,
          paddingBottom: 6 + insets.bottom,
          ...makeShadow({
            color: theme.isDark ? '#000000' : '#101820',
            opacity: theme.isDark ? 0.6 : 0.08,
            blur: 20,
            offsetY: -8,
            elevation: 8,
          }),
        },
        tabBarItemStyle: {
          minHeight: 44,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Hoy',
          tabBarIcon: ({ color, focused }) => <TabIcon theme={theme} name="home" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Explorar',
          tabBarIcon: ({ color, focused }) => <TabIcon theme={theme} name="search" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="capture"
        options={{
          title: 'Capturar',
          tabBarIcon: ({ color, focused }) => <TabIcon theme={theme} name="plus-circle" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="financials"
        options={{
          title: 'Dinero',
          tabBarIcon: ({ color, focused }) => <TabIcon theme={theme} name="credit-card" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="review"
        options={{
          title: 'Revisar',
          tabBarIcon: ({ color, focused }) => <TabIcon theme={theme} name="shield" focused={focused} color={color} />,
        }}
      />
    </Tabs>
  );
}
