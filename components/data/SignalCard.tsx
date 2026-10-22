import { Feather } from '@expo/vector-icons';
import { ReactNode, useContext, useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { Extrapolation, SharedValue, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { GlassPressable } from '@/components/glass/GlassPressable';
import { GlassScrollContext } from '@/components/glass/GlassScroll';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { ConfidenceMeter, Tag } from '@/components/controls';
import { useTheme } from '@/lib/app-state';
import { ProvenanceOrigin } from '@/lib/domain';
import { cleanDisplayText } from '@/lib/format';

const originCopy: Record<ProvenanceOrigin, { label: string; tone: 'info' | 'neutral' | 'positive' | 'warning' }> = {
  model: { label: 'BrainIA', tone: 'info' },
  captured: { label: 'Capturado', tone: 'neutral' },
  user: { label: 'You', tone: 'positive' },
  pending: { label: 'Pendiente', tone: 'warning' },
};

export function SignalCard({
  variant = 'card',
  origin = 'model',
  title,
  summary,
  takeaways = [],
  metrics = [],
  confidence,
  meta,
  footer,
  onPress,
  action,
}: {
  variant?: 'brief' | 'card' | 'block';
  origin?: ProvenanceOrigin;
  title: string;
  summary?: string;
  takeaways?: string[];
  metrics?: { label: string; value: string }[];
  confidence?: number;
  meta?: string;
  footer?: string;
  onPress?: () => void;
  action?: ReactNode;
}) {
  const theme = useTheme();
  const copy = originCopy[origin];
  const dense = variant === 'brief';

  const content = (
    <GlassSurface
      level="regular"
      tone={origin === 'pending' ? 'review' : 'model'}
      padding={dense ? 'md' : 'lg'}
      style={{ flex: 1, minHeight: dense ? 132 : undefined }}
      contentStyle={{ gap: dense ? 8 : 12 }}
    >
      <View style={styles.header}>
        <Tag label={copy.label} tone={copy.tone} kind="provenance" icon={origin === 'model' ? 'cpu' : origin === 'user' ? 'user' : origin === 'pending' ? 'alert-circle' : 'inbox'} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {meta ? <Text style={[theme.typography.overline, { color: theme.colors.textMuted }]}>{cleanDisplayText(meta)}</Text> : null}
          <ConfidenceMeter value={confidence} showValue={variant !== 'brief'} />
          {action}
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        <Text numberOfLines={dense ? 3 : 4} style={[variant === 'block' ? theme.typography.headline : theme.typography.bodyStrong, { color: theme.colors.textPrimary, flex: 1, fontSize: variant === 'block' ? 19 : 16, lineHeight: variant === 'block' ? 25 : 22 }]}>
          {cleanDisplayText(title)}
        </Text>
        {onPress ? <Feather name="arrow-up-right" size={15} color={theme.colors.accentStrong} /> : null}
      </View>
      {summary ? (
        <Text numberOfLines={variant === 'brief' ? 3 : undefined} style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
          {cleanDisplayText(summary)}
        </Text>
      ) : null}
      {takeaways.length ? (
        <View style={{ gap: 6 }}>
          {takeaways.slice(0, variant === 'brief' ? 1 : 3).map((takeaway) => (
            <View key={takeaway} style={styles.takeaway}>
              <View style={[styles.bullet, { backgroundColor: theme.colors.accent }]} />
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, flex: 1 }]}>{cleanDisplayText(takeaway)}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {metrics.length ? (
        <View style={styles.metrics}>
          {metrics.slice(0, 4).map((metric) => (
            <View key={metric.label} style={{ gap: 2 }}>
              <Text style={[theme.typography.overline, { color: theme.colors.textMuted }]}>{cleanDisplayText(metric.label)}</Text>
              <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary, fontVariant: ['tabular-nums'] }]}>{cleanDisplayText(metric.value)}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {footer ? <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{cleanDisplayText(footer)}</Text> : null}
    </GlassSurface>
  );

  if (!onPress) return content;

  return (
    <GlassPressable accessibilityRole="button" accessibilityLabel={cleanDisplayText(title)} onPress={onPress} scaleTo={0.985}>
      {content}
    </GlassPressable>
  );
}

/** A rail slot: the card that is not in focus recedes, so the peeking edge reads as intended. */
function CarouselSlot({ index, step, width, scrollX, children }: { index: number; step: number; width: number; scrollX: SharedValue<number>; children: ReactNode }) {
  const style = useAnimatedStyle(() => {
    const away = Math.abs(scrollX.value - index * step) / step;
    return {
      opacity: interpolate(away, [0, 1], [1, 0.42], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(away, [0, 1], [1, 0.97], Extrapolation.CLAMP) }],
    };
  });
  return <Animated.View style={[{ width }, style]}>{children}</Animated.View>;
}

/** Horizontal highlight rail. The first card can start the review session. */
export function SignalCarousel({
  items,
  accessibilityLabel = 'Highlights',
}: {
  items: {
    id: string;
    title: string;
    summary?: string;
    origin?: ProvenanceOrigin;
    confidence?: number;
    meta?: string;
    onPress: () => void;
  }[];
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(352, Math.max(264, width - 64));
  // The rail's horizontal offset moves each card's glass backdrop with the card.
  const parentScroll = useContext(GlassScrollContext);
  const scrollX = useSharedValue(0);
  const glassScroll = useMemo(() => ({ y: parentScroll?.y ?? null, x: scrollX }), [parentScroll, scrollX]);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollX.set(event.contentOffset.x);
  });

  return (
    <GlassScrollContext.Provider value={glassScroll}>
    <Animated.ScrollView
      horizontal
      onScroll={onScroll}
      scrollEventThrottle={16}
      directionalLockEnabled
      decelerationRate="fast"
      showsHorizontalScrollIndicator={false}
      snapToInterval={cardWidth + theme.spacing.sm}
      snapToAlignment="start"
      accessibilityLabel={accessibilityLabel}
      contentContainerStyle={{ gap: theme.spacing.sm, paddingRight: theme.spacing.md }}
    >
      {items.slice(0, 8).map((item, index) => (
        <CarouselSlot key={item.id} index={index} step={cardWidth + theme.spacing.sm} width={cardWidth} scrollX={scrollX}>
          <SignalCard
            variant="brief"
            origin={item.origin}
            title={item.title}
            summary={item.summary}
            confidence={item.confidence}
            meta={item.meta}
            onPress={item.onPress}
          />
        </CarouselSlot>
      ))}
    </Animated.ScrollView>
    </GlassScrollContext.Provider>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  takeaway: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 5,
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 18,
  },
});
