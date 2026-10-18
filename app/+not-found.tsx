import { Link, Stack } from 'expo-router';
import { View, Text } from 'react-native';

import { useTheme } from '@/lib/app-state';

export default function NotFoundScreen() {
  const theme = useTheme();

  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          backgroundColor: theme.colors.background,
        }}
      >
        <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>Esta pantalla no existe.</Text>
        <Link href="/" style={{ marginTop: 16 }}>
          <Text style={[theme.typography.body, { color: theme.colors.accentStrong }]}>Volver al inicio</Text>
        </Link>
      </View>
    </>
  );
}
