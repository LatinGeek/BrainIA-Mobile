import { Feather } from '@expo/vector-icons';
import { View } from 'react-native';

import { financialAccountColor } from '@/lib/financial-accounts';

export function AccountIcon({ color, size = 40 }: { color?: string; size?: number }) {
  const resolvedColor = financialAccountColor(color);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: resolvedColor,
      }}
    >
      <Feather name="credit-card" size={Math.round(size * 0.45)} color="#FFFFFF" />
    </View>
  );
}
