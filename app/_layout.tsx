import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { JetBrainsMono_500Medium, JetBrainsMono_600SemiBold } from '@expo-google-fonts/jetbrains-mono';
import { Poppins_600SemiBold } from '@expo-google-fonts/poppins';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';

import { AppStateProvider, useAppState } from '@/lib/app-state';

SplashScreen.preventAutoHideAsync().catch(() => {});

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

function BootstrapScreen() {
  const { theme } = useAppState();

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.background,
        padding: 24,
      }}
    >
      <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>BrainIA Mobile</Text>
      <Text style={[theme.typography.body, { color: theme.colors.textSecondary, marginTop: 8, textAlign: 'center' }]}>
        Initializing your second brain.
      </Text>
      <ActivityIndicator style={{ marginTop: 20 }} color={theme.colors.accent} />
    </View>
  );
}

function RootNavigator() {
  const { hydrated, theme } = useAppState();
  const [fontsLoaded, fontsError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    JetBrainsMono_500Medium,
    JetBrainsMono_600SemiBold,
    Poppins_600SemiBold,
  });
  const typographyReady = fontsLoaded || Boolean(fontsError);

  useEffect(() => {
    if (hydrated && typographyReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [hydrated, typographyReady]);

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(theme.colors.background);
  }, [theme.colors.background]);

  if (!hydrated || !typographyReady) {
    return <BootstrapScreen />;
  }

  return (
    <>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} animated />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
        <Stack.Screen name="entity/[id]" />
        <Stack.Screen name="insight/[id]" />
        <Stack.Screen name="digest/[id]" />
        <Stack.Screen name="transaction/[id]" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppStateProvider>
        <RootNavigator />
      </AppStateProvider>
    </GestureHandlerRootView>
  );
}
