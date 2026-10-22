import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { JetBrainsMono_500Medium, JetBrainsMono_600SemiBold } from '@expo-google-fonts/jetbrains-mono';
import { Poppins_600SemiBold } from '@expo-google-fonts/poppins';
import { useFonts } from 'expo-font';
import { router, Stack, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';

import { AppStateProvider, useAppState } from '@/lib/app-state';
import { Telemetry } from '@/components/Telemetry';
import { ToastProvider } from '@/components/layout/Toast';
import { useReduceMotion } from '@/lib/hooks';
import { AmbientBackground } from '@/components/glass/AmbientBackground';

SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * Global error screen. It is self-contained on purpose: the error may come from the theme
 * or app-state providers themselves, so nothing here can depend on them.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={{ flex: 1, backgroundColor: '#091315', justifyContent: 'center', padding: 24, gap: 14 }}>
      <Text accessibilityRole="header" style={{ color: '#F6F9F8', fontSize: 24, fontWeight: '600' }}>Algo salió mal</Text>
      <Text style={{ color: '#A9B8BB', fontSize: 15, lineHeight: 22 }}>La pantalla no se pudo mostrar. Prueba de nuevo; si vuelve a pasar, cierra y abre la aplicación.</Text>
      <Text numberOfLines={3} style={{ color: '#6F8286', fontSize: 12 }}>{error.message.slice(0, 160)}</Text>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
        <Pressable accessibilityRole="button" onPress={retry} style={{ minHeight: 48, paddingHorizontal: 22, borderRadius: 24, backgroundColor: '#C4F24D', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#0B1113', fontSize: 15, fontWeight: '600' }}>Reintentar</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => { router.replace('/'); retry(); }} style={{ minHeight: 48, paddingHorizontal: 22, borderRadius: 24, borderWidth: 1, borderColor: '#2F4247', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#F6F9F8', fontSize: 15, fontWeight: '600' }}>Ir al inicio</Text>
        </Pressable>
      </View>
    </View>
  );
}

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
        padding: theme.spacing.xl,
      }}
    >
      <AmbientBackground />
      <Text style={{ color: theme.colors.textPrimary, fontSize: 17, fontWeight: '600' }}>Brain IA</Text>
      <Text style={{ color: theme.colors.textSecondary, fontSize: 15, marginTop: theme.spacing.sm, textAlign: 'center' }}>
        Preparando tu segundo cerebro…
      </Text>
      <ActivityIndicator style={{ marginTop: theme.spacing.xl }} color={theme.colors.accent} />
    </View>
  );
}

function RootNavigator() {
  const { hydrated, theme } = useAppState();
  const reduceMotion = useReduceMotion();
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
      <Telemetry/>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} animated />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: reduceMotion ? 'fade' : 'slide_from_right',
          // Native Android transitions use the system duration and back gesture.
          ...(Platform.OS === 'ios' ? { animationDuration: theme.motion.duration.enter, gestureEnabled: true } : {}),
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="learning" />
        <Stack.Screen name="modal" />
        <Stack.Screen name="entity/[id]" />
        <Stack.Screen name="insight/[id]" />
        <Stack.Screen name="digest/[id]" />
        <Stack.Screen name="transaction/[id]" />
        <Stack.Screen name="review-session" options={{ presentation: 'fullScreenModal', animation: reduceMotion ? 'fade' : 'slide_from_bottom' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppStateProvider>
        <ToastProvider>
          <RootNavigator />
        </ToastProvider>
      </AppStateProvider>
    </GestureHandlerRootView>
  );
}
