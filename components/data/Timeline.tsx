import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { GlassPressable } from '@/components/glass/GlassPressable';
import { IconTile } from './Row';
import { useTheme } from '@/lib/app-state';
import { cleanDisplayText } from '@/lib/format';

export type TimelineItem = {
  id: string;
  icon?: React.ComponentProps<typeof Feather>['name'];
  title: string;
  subtitle?: string;
  amount?: string;
  time?: string;
  reason?: string;
  onPress?: () => void;
};

export function Timeline({ items, emptyLabel = 'No hay evidencia de respaldo disponible.' }: { items: TimelineItem[]; emptyLabel?: string }) {
  const theme = useTheme();
  if (!items.length) {
    return <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{emptyLabel}</Text>;
  }

  return (
    <View style={[styles.rail, { borderColor: theme.glass.divider }]}>
      {items.map((item, index) => {
        const content = (
          <View style={[styles.row, index < items.length - 1 ? { borderBottomColor: theme.glass.divider, borderBottomWidth: StyleSheet.hairlineWidth } : null]}>
            <View style={styles.nodeColumn}>
              <IconTile icon={item.icon ?? 'inbox'} size="sm" />
              {index < items.length - 1 ? <View style={[styles.railLine, { backgroundColor: theme.glass.divider }]} /> : null}
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 2, paddingBottom: 4 }}>
              <View style={styles.between}>
                <Text numberOfLines={1} style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary, flex: 1 }]}>{cleanDisplayText(item.title)}</Text>
                {item.amount ? <Text style={[theme.typography.caption, { color: theme.colors.textPrimary, fontVariant: ['tabular-nums'] }]}>{cleanDisplayText(item.amount)}</Text> : null}
              </View>
              {item.subtitle || item.time ? <Text numberOfLines={1} style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{cleanDisplayText([item.subtitle, item.time].filter(Boolean).join(' · '))}</Text> : null}
              {item.reason ? <Text numberOfLines={2} style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{cleanDisplayText(item.reason)}</Text> : null}
            </View>
            {item.onPress ? <Feather name="chevron-right" size={15} color={theme.colors.textMuted} /> : null}
          </View>
        );

        return item.onPress ? (
          <GlassPressable key={item.id} accessibilityRole="button" accessibilityLabel={cleanDisplayText(item.title)} onPress={item.onPress} scaleTo={0.99}>
            {content}
          </GlassPressable>
        ) : <View key={item.id}>{content}</View>;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    paddingVertical: 10,
  },
  nodeColumn: {
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  railLine: {
    width: StyleSheet.hairlineWidth,
    flex: 1,
    minHeight: 10,
    marginTop: 4,
  },
  between: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
});
