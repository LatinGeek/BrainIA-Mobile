import { Feather } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { Platform, Text, View } from 'react-native';

import { Button } from '@/components/controls';
import { GlassPressable } from '@/components/glass/GlassPressable';
import { useTheme } from '@/lib/app-state';

const destinations = [
  { path: '/', label: 'Hoy', icon: 'sun' },
  { path: '/search', label: 'Explorar', icon: 'compass' },
  { path: '/financials', label: 'Dinero', icon: 'credit-card' },
  { path: '/review', label: 'Revisar', icon: 'check-circle' },
] as const;

export function NavigationRail() {
  const theme = useTheme();
  const pathname = usePathname();

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        router.push('/search');
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <View style={{ width: 236, borderRightWidth: 1, borderRightColor: theme.glass.divider, backgroundColor: theme.glass.chrome, padding: 24, gap: 28 }}>
      <View style={{ gap: 6, paddingTop: 18 }}>
        <Text style={[theme.typography.display, { color: theme.colors.textPrimary, fontSize: 24, lineHeight: 29 }]}>
          brain ia<Text style={{ color: theme.colors.accent }}> /</Text>
        </Text>
        <Text style={[theme.typography.overline, { color: theme.colors.textMuted }]}>PERSONAL INTELLIGENCE</Text>
      </View>
      <Button label="Capturar" onPress={() => router.push('/capture')} full icon={<Feather name="plus" size={16} color={theme.colors.onAccent} />} />
      <View style={{ gap: 4 }}>
        {destinations.map((item) => {
          const selected = pathname === item.path;
          return (
            <GlassPressable
              key={item.path}
              accessibilityRole="link"
              accessibilityState={{ selected }}
              onPress={() => router.push(item.path)}
              scaleTo={0.98}
              style={{ minHeight: 46, flexDirection: 'row', gap: 12, alignItems: 'center', paddingHorizontal: 14, borderRadius: theme.radius.md, backgroundColor: selected ? theme.glass.selected : 'transparent' }}
            >
              <Feather name={item.icon} size={18} color={selected ? theme.glass.onSelected : theme.colors.textSecondary} />
              <Text style={[theme.typography.bodyStrong, { color: selected ? theme.glass.onSelected : theme.colors.textSecondary }]}>{item.label}</Text>
            </GlassPressable>
          );
        })}
      </View>
      <View style={{ gap: 6, borderTopWidth: 1, borderTopColor: theme.glass.divider, paddingTop: 20 }}>
        <Text style={[theme.typography.overline, { color: theme.colors.textMuted }]}>Tu espacio</Text>
        <Button label="Knowledge" variant="ghost" onPress={() => router.push('/intelligence')} full />
        <Button label="Learning" variant="ghost" onPress={() => router.push('/learning')} full />
        <Button label="Settings" variant="ghost" onPress={() => router.push('/settings')} full />
      </View>
      <View style={{ flex: 1 }} />
      <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Search  Ctrl / ⌘ K</Text>
    </View>
  );
}
