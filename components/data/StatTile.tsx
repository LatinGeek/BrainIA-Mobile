import { Feather } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { GlassPressable } from '@/components/glass/GlassPressable';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { useTheme } from '@/lib/app-state';
import { cleanDisplayText } from '@/lib/format';
import { Amount } from './Row';

export function StatTile({
  label,
  value,
  currency,
  tone = 'neutral',
  delta,
  icon,
  layout = 'start',
  onPress,
  children,
}: {
  label: string;
  value: string | number;
  currency?: string;
  tone?: 'neutral' | 'income' | 'expense' | 'positive' | 'warning';
  delta?: string;
  icon?: React.ComponentProps<typeof Feather>['name'];
  layout?: 'start' | 'center';
  onPress?: () => void;
  children?: ReactNode;
}) {
  const theme = useTheme();
  const deltaTone = delta?.trim().startsWith('↓') ? theme.status.expense : delta?.trim().startsWith('↑') ? theme.status.income : theme.colors.textMuted;
  const content = (
    <GlassSurface level="regular" padding="md" style={{ flex: 1, minWidth: 0, gap: 6 }} contentStyle={{ gap: 6 }}>
      <View style={[styles.labelRow, layout === 'center' ? { justifyContent: 'center' } : null]}>
        {icon ? <Feather name={icon} size={13} color={theme.colors.textMuted} /> : null}
        <Text style={[theme.typography.overline, { color: theme.colors.textMuted }]}>{cleanDisplayText(label)}</Text>
      </View>
      <View style={layout === 'center' ? { alignItems: 'center' } : undefined}>
        {typeof value === 'number' ? (
          <Amount value={value} currency={currency} tone={tone === 'warning' ? 'neutral' : tone} size="tile" />
        ) : (
          <Text numberOfLines={2} adjustsFontSizeToFit style={[theme.typography.headline, { color: tone === 'expense' ? theme.status.expense : tone === 'income' ? theme.status.income : theme.colors.textPrimary, fontSize: 22, lineHeight: 27 }]}>
            {cleanDisplayText(value)}
          </Text>
        )}
        {delta ? <Text style={[theme.typography.caption, { color: deltaTone, marginTop: 2 }]}>{cleanDisplayText(delta)}</Text> : null}
        {children}
      </View>
    </GlassSurface>
  );

  return onPress ? (
    <View style={{ flex: 1 }}>
      <GlassPressable accessibilityRole="button" onPress={onPress} scaleTo={0.98} style={{ flex: 1 }}>{content}</GlassPressable>
    </View>
  ) : content;
}

export function StatGrid({
  children,
  columns = 2,
}: {
  children: ReactNode;
  columns?: 2 | 4;
}) {
  const theme = useTheme();
  const { fontScale, width } = useWindowDimensions();
  const largeText = fontScale >= 1.3;
  const effectiveColumns = largeText ? 1 : width < 360 || columns === 2 ? 2 : 4;

  return (
    <View style={[styles.grid, { gap: theme.spacing.sm }]}>
      {Array.isArray(children)
        ? children.map((child, index) => (
            <View key={index} style={{ width: effectiveColumns === 1 ? '100%' : `${100 / effectiveColumns - 2}%`, flexGrow: 1, minWidth: effectiveColumns === 1 ? '100%' : 0 }}>
              {child}
            </View>
          ))
        : <View style={{ width: '100%' }}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
