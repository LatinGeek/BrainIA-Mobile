import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions, Platform } from 'react-native';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { GlassSurface } from '@/components/glass/GlassSurface';
import { useTheme } from '@/lib/app-state';
import { cleanDisplayText, formatCurrency } from '@/lib/format';
import { useCountedAmount } from '@/components/data/Row';
import { useReduceMotion } from '@/lib/hooks';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type MixSegment = {
  id: string;
  label: string;
  value: number;
  displayValue?: number;
  color?: string;
};

function percent(value: number, total: number) {
  if (total <= 0) return '0%';
  const share = (value / total) * 100;
  return `${share >= 10 ? share.toFixed(0) : share.toFixed(1).replace('.', ',')}%`;
}

export function MixCard({
  overline,
  title,
  action,
  note,
  segments,
  centerValue,
  centerAmount,
  currency,
  centerLabel,
  delta,
  formatValue = (value) => String(Math.round(value)),
  selectedId,
  onSelect,
  emptyLabel = 'No spend',
  percentageNoun = 'del gasto',
}: {
  overline?: string;
  title: string;
  action?: React.ReactNode;
  note?: string;
  segments: MixSegment[];
  centerValue: string;
  centerAmount?: number;
  currency?: string;
  centerLabel?: string;
  delta?: { text: string; tone?: 'good' | 'bad' | 'neutral' };
  formatValue?: (value: number) => string;
  selectedId?: string | null;
  onSelect?: (segment: MixSegment | null) => void;
  emptyLabel?: string;
  percentageNoun?: string;
}) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const { width, fontScale } = useWindowDimensions();
  const [internalSelected, setInternalSelected] = useState<string | null>(null);
  const activeId = selectedId === undefined ? internalSelected : selectedId;
  const source = useMemo(
    () => (segments.some((segment) => segment.value > 0) ? segments.filter((segment) => segment.value > 0) : [{ id: 'empty', label: emptyLabel, value: 1, color: theme.glass.solid.strong }]),
    [emptyLabel, segments, theme.glass.solid.strong],
  );
  const total = source.reduce((sum, segment) => sum + Math.max(0, segment.value), 0) || 1;
  const active = source.find((segment) => segment.id === activeId);
  const amountTarget = active ? active.displayValue ?? active.value : centerAmount ?? 0;
  const countedAmount = useCountedAmount(amountTarget, centerAmount !== undefined);
  const amountLabel = active ? formatValue(amountTarget) : cleanDisplayText(centerValue);
  const amountText = centerAmount === undefined ? amountLabel : active ? formatValue(countedAmount) : `${centerValue.startsWith('≈ ') ? '≈ ' : ''}${currency ? formatCurrency(countedAmount, currency) : formatValue(countedAmount)}`;
  const size = Math.round(Math.min(268, Math.max(204, width - (fontScale >= 1.3 ? 76 : 92))));
  const strokeWidth = 22;
  const radius = size / 2 - strokeWidth / 2 - 4;
  const circumference = 2 * Math.PI * radius;
  const centerDiameter = radius * 2 - strokeWidth - 6;
  const gap = circumference * 0.012;

  const reveal = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    reveal.value = reduceMotion ? 1 : 0;
    if (!reduceMotion) reveal.value = withTiming(1, { duration: theme.motion.duration.count, easing: Easing.bezier(...theme.motion.easing.out) });
  }, [reduceMotion, theme.motion.easing.out, reveal, source.length, theme.motion.duration.count]);

  const totalProps = useAnimatedProps(() => ({ opacity: reveal.value }));

  // Drawn layout only: every slice gets at least 2% of the ring (then all shares are renormalised), so a
  // tiny category stays a visible arc with a gap on both sides. The legend and the centre keep true values.
  const drawnShares = (() => {
    const floored = source.map((segment) => (segment.value > 0 ? Math.max(segment.value / total, 0.02) : 0));
    const flooredTotal = floored.reduce((sum, share) => sum + share, 0) || 1;
    return floored.map((share) => share / flooredTotal);
  })();
  const arcs = source.map((segment, index) => {
    const slice = drawnShares[index] * circumference;
    const start = drawnShares.slice(0, index).reduce((sum, share) => sum + share * circumference, 0);
    return {
      ...segment,
      index,
      length: Math.max(0, slice - gap),
      offset: start,
      color: segment.color ?? theme.colors.chart[index % theme.colors.chart.length],
    };
  });

  const select = (segment: MixSegment | null) => {
    setInternalSelected(segment?.id ?? null);
    onSelect?.(segment);
  };

  return (
    <GlassSurface level="regular" padding="lg" contentStyle={{ gap: 12 }}>
      <View style={styles.between}>
        <View style={{ flex: 1, gap: 2 }}>
          {overline ? <Text style={[theme.typography.overline, { color: theme.colors.textMuted }]}>{cleanDisplayText(overline)}</Text> : null}
          <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>{cleanDisplayText(title)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          {action}
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{`${source.length} ${source.length === 1 ? 'grupo' : 'grupos'}`}</Text>
        </View>
      </View>

      <View style={{ alignItems: 'center' }}>
        <Pressable
          accessibilityRole={active ? 'button' : undefined}
          accessibilityLabel={active ? `Clear ${active.label} selection` : `${title} radial chart`}
          disabled={!active}
          onPress={() => select(null)}
          style={{ width: size, height: size }}
        >
          <Svg width={size} height={size}>
            <Circle cx={size / 2} cy={size / 2} r={radius + strokeWidth / 2 + 5} stroke={theme.glass.divider} strokeWidth={1} fill="none" />
            <Circle cx={size / 2} cy={size / 2} r={radius + strokeWidth / 2 + 2} stroke={theme.glass.edge[0]} strokeWidth={1} strokeDasharray="1 5" fill="none" />
            <Circle cx={size / 2} cy={size / 2} r={radius} stroke={theme.glass.inner} strokeWidth={strokeWidth} fill="none" />
            {arcs.map((arc) => (
              <AnimatedCircle
                key={arc.id}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={arc.color}
                strokeWidth={arc.id === activeId ? strokeWidth + 3 : strokeWidth}
                fill="none"
                strokeLinecap="butt"
                strokeDasharray={`${arc.length} ${circumference - arc.length}`}
                strokeDashoffset={circumference * 0.25 - arc.offset}
                animatedProps={totalProps}
                onPress={Platform.OS === 'web' ? undefined : () => select(active?.id === arc.id ? null : arc)}
                pointerEvents={Platform.OS === 'web' ? 'none' : 'auto'}
              />
            ))}
          </Svg>
          <View pointerEvents="none" style={styles.center}>
            <View style={[styles.centerPlate, { width: centerDiameter, height: centerDiameter, borderRadius: centerDiameter / 2, backgroundColor: `${theme.ambient.base}B8`, borderColor: active ? `${arcColor(active, theme.colors.accent)}66` : theme.glass.divider }]}>
              <Text numberOfLines={1} style={[theme.typography.caption, { color: active ? arcColor(active, theme.colors.accent) : theme.colors.textMuted, textAlign: 'center' }]}>
                {active ? cleanDisplayText(active.label) : cleanDisplayText(centerLabel ?? 'Total')}
              </Text>
              <Text accessibilityLabel={amountLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55} style={[theme.typography.numeral, { color: theme.colors.textPrimary, fontSize: width < 360 ? 20 : 26, lineHeight: width < 360 ? 25 : 32, textAlign: 'center' }]}>
                {amountText}
              </Text>
              {active ? (
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, textAlign: 'center', fontSize: 10 }]}>{percent(active.value, total)} {percentageNoun}</Text>
              ) : delta ? (
                <Text style={[theme.typography.caption, { color: delta.tone === 'bad' ? theme.status.expense : delta.tone === 'good' ? theme.status.income : theme.colors.textMuted, textAlign: 'center', fontSize: 10 }]}>{cleanDisplayText(delta.text)}</Text>
              ) : null}
            </View>
          </View>
        </Pressable>
      </View>

      <View style={{ gap: 2 }}>
        {arcs.map((arc) => {
          const selected = arc.id === activeId;
          return (
            <Pressable
              key={arc.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${arc.label}, ${formatValue(arc.displayValue ?? arc.value)}, ${percent(arc.value, total)} ${percentageNoun}`}
              onPress={() => select(selected ? null : arc)}
              style={[styles.legendRow, { backgroundColor: selected ? theme.glass.inner : 'transparent' }]}
            >
              <View style={[styles.legendDot, { backgroundColor: arc.color }]} />
              <Text numberOfLines={1} style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary, flex: 1, fontSize: 13 }]}>{cleanDisplayText(arc.label)}</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit style={[theme.typography.caption, { color: theme.colors.textPrimary, width: 84, textAlign: 'right', fontVariant: ['tabular-nums'] }]}>{formatValue(arc.displayValue ?? arc.value)}</Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted, width: 42, textAlign: 'right', fontVariant: ['tabular-nums'] }]}>{percent(arc.value, total)}</Text>
            </Pressable>
          );
        })}
      </View>

      {note ? <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{cleanDisplayText(note)}</Text> : null}
    </GlassSurface>
  );
}

function arcColor(segment: MixSegment | undefined, fallback: string) {
  return segment?.color ?? fallback;
}

const styles = StyleSheet.create({
  between: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  center: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerPlate: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
  },
  legendRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
