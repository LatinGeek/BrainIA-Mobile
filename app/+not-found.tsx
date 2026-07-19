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
        <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>This screen does not exist.</Text>
        <Link href="/" style={{ marginTop: 16 }}>
          <Text style={[theme.typography.body, { color: theme.colors.accentStrong }]}>Go back home</Text>
        </Link>
      </View>
    </>
  );
}
