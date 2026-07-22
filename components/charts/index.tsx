import Svg, { Circle } from 'react-native-svg';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { useState } from 'react';

import { Surface } from '@/components/primitives';
import { useTheme } from '@/lib/app-state';
import { cleanDisplayText } from '@/lib/format';

type RadialSegment = {
  label: string;
  value: number;
  color?: string;
};

function MiniBarChart({ values }: { values: number[] }) {
  const theme = useTheme();
  const normalizedValues = values.map((value) => Math.abs(value));
  const max = Math.max(...normalizedValues, 1);

  return (
    <View style={[styles.row, { alignItems: 'flex-end', gap: 5, height: 64 }]}>
      {normalizedValues.map((value, index) => (
        <View key={`${index}-${value}`} style={{ flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' }}>
          <View
            style={{
              width: '46%',
              height: `${Math.max(12, (value / max) * 100)}%`,
              backgroundColor: values[index] < 0 ? theme.status.expense : index === values.length - 1 ? theme.colors.accent : theme.colors.surfaceSubtle,
              borderRadius: 7,
            }}
          />
        </View>
      ))}
    </View>
  );
}

function DistributionRing({ values }: { values: { label: string; value: number; color: string }[] }) {
  const theme = useTheme();
  const size = 148;
  const strokeWidth = 14;
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = values.reduce((sum, item) => sum + Math.max(0, item.value), 0) || 1;
  const segments = values.reduce<{ label: string; value: number; color: string; offset: number }[]>((acc, item) => {
    const offset = acc.length ? acc[acc.length - 1].offset + (acc[acc.length - 1].value / total) * circumference : 0;
    acc.push({ ...item, offset });
    return acc;
  }, []);

  return (
    <View style={{ width: size, height: size, alignSelf: 'center' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={center} cy={center} r={radius} stroke={theme.colors.surfaceSubtle} strokeWidth={strokeWidth} fill="none" />
        {segments.map((item) => {
          const sliceLength = Math.max(0, item.value === 0 ? 0 : (item.value / total) * circumference - 3);
          const dash = `${sliceLength} ${Math.max(0, circumference - sliceLength)}`;

          return (
            <Circle
              key={item.label}
              cx={center}
              cy={center}
              r={radius}
              stroke={item.color}
              strokeWidth={strokeWidth}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={dash}
              strokeDashoffset={circumference * 0.25 - item.offset}
              rotation="-90"
              origin={`${center}, ${center}`}
            />
          );
        })}
      </Svg>
      <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 }}>
        <Text style={[theme.typography.headline, { color: theme.colors.textPrimary, textAlign: 'center', marginTop: 2 }]}>{Math.round(total)}</Text>
      </View>
    </View>
  );
}

export function ChartCard({ title, subtitle, values, labels }: { title: string; subtitle?: string; values: number[]; labels?: string[] }) {
  const theme = useTheme();
  const entries = values
    .map((value, index) => ({
      label: labels?.[index] ?? `Series ${index + 1}`,
      value: Math.max(0, Math.abs(value)),
      color: theme.colors.chart[index % theme.colors.chart.length],
    }))
    .filter((item) => item.value > 0);
  const total = entries.reduce((sum, item) => sum + item.value, 0);

  return (
    <Surface variant="raised" style={{ borderColor: theme.depth.glow }}>
      <View style={[styles.signal, { backgroundColor: theme.colors.accent }]} />
      <View style={styles.rowBetween}>
        <View style={{ flex: 1 }}>
          <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>{cleanDisplayText(title)}</Text>
          {subtitle ? <Text style={[theme.typography.body, { color: theme.colors.textSecondary, marginTop: 4 }]}>{cleanDisplayText(subtitle)}</Text> : null}
        </View>
      </View>
      <View style={{ marginTop: theme.spacing.md }}>{entries.length ? <DistributionRing values={entries} /> : <MiniBarChart values={values} />}</View>
      {labels ? (
        <View style={[styles.rowWrap, { marginTop: theme.spacing.md }]}>
          {entries.map((item) => (
            <View key={item.label} style={[styles.pill, { backgroundColor: theme.colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border, justifyContent: 'space-between' }]}>
              <View style={[styles.row, { marginRight: theme.spacing.sm }]}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.color, marginRight: 8 }} />
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{cleanDisplayText(item.label)}</Text>
              </View>
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{total ? `${Math.round((item.value / total) * 100)}%` : '0%'}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </Surface>
  );
}

export function SpendingRadial({
  title,
  subtitle,
  amount,
  segments,
  formatValue = (value) => String(Math.round(value)),
}: {
  title: string;
  subtitle?: string;
  amount: string;
  segments: RadialSegment[];
  formatValue?: (value: number) => string;
}) {
  const theme = useTheme();
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const size = 232;
  const center = size / 2;
  const radius = 88;
  const strokeWidth = 20;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0);
  const palette = [theme.colors.accent, '#56C7F2', '#A78BFA', '#F4A261', '#F4C542', theme.status.income];
  const sourceSegments = total > 0 ? segments.filter((segment) => segment.value > 0).sort((a, b) => b.value - a.value) : [{ label: 'No spend', value: 1, color: theme.colors.surfaceSubtle }];
  const topSegments = sourceSegments.slice(0, 4);
  const remaining = sourceSegments.slice(4).reduce((sum, segment) => sum + segment.value, 0);
  const visibleSegments = remaining > 0 ? [...topSegments, { label: 'Other', value: remaining }] : topSegments;
  const chartTotal = visibleSegments.reduce((sum, segment) => sum + segment.value, 0) || 1;
  const radialSegments = visibleSegments.reduce<(RadialSegment & { offset: number; color: string })[]>((acc, segment, index) => {
    const offset = acc.length ? acc[acc.length - 1].offset + (acc[acc.length - 1].value / chartTotal) * circumference : 0;
    acc.push({ ...segment, offset, color: segment.color ?? palette[index % palette.length] });
    return acc;
  }, []);
  const selected = radialSegments.find((segment) => segment.label === selectedLabel);
  const centerAmount = selected ? formatValue(selected.value) : amount;
  const centerLabel = selected ? cleanDisplayText(selected.label) : 'Total spent';

  return (
    <Surface variant="raised" style={{ borderColor: theme.depth.glow, gap: theme.spacing.md, overflow: 'hidden' }}>
      <View style={[styles.radialGlow, { backgroundColor: theme.colors.accent + '12' }]} />
      <View style={styles.rowBetween}>
        <View style={{ flex: 1 }}>
          <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>{cleanDisplayText(title)}</Text>
          {subtitle ? <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 4 }]}>{cleanDisplayText(subtitle)}</Text> : null}
        </View>
        <View style={[styles.categoryCount, { backgroundColor: theme.colors.surfaceSubtle, borderColor: theme.colors.border }]}>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{`${sourceSegments.length} ${sourceSegments.length === 1 ? 'area' : 'areas'}`}</Text>
        </View>
      </View>
      <View style={{ alignItems: 'center', marginTop: -2 }}>
        <View style={{ width: size, height: size }}>
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <Circle
              cx={center}
              cy={center}
              r={radius}
              stroke={theme.colors.surfaceSubtle}
              strokeWidth={strokeWidth}
              fill="none"
            />
            {radialSegments.map((segment, index) => {
              const slice = Math.max(0, (segment.value / chartTotal) * circumference - 5);
              const isSelected = selectedLabel === segment.label;
              return (
              <Circle
                key={`${segment.label}-${index}`}
                cx={center}
                cy={center}
                r={radius}
                stroke={segment.color}
                strokeWidth={isSelected ? strokeWidth + 3 : strokeWidth}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={`${slice} ${Math.max(0, circumference - slice)}`}
                strokeDashoffset={circumference * 0.25 - segment.offset}
                transform={`rotate(-90 ${center} ${center})`}
                opacity={selectedLabel && !isSelected ? 0.28 : 1}
              />
              );
            })}
          </Svg>
          <View style={styles.radialCenter}>
            <Text style={[theme.typography.caption, { color: selected ? theme.colors.accentStrong : theme.colors.textMuted, textAlign: 'center' }]}>{centerLabel}</Text>
            <Text numberOfLines={1} adjustsFontSizeToFit style={[theme.typography.numeral, { color: theme.colors.textPrimary, marginTop: 4, fontSize: 29, lineHeight: 35, textAlign: 'center' }]}>{cleanDisplayText(centerAmount)}</Text>
            {selected ? <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 2 }]}>{`${Math.round((selected.value / chartTotal) * 100)}% of spend`}</Text> : null}
          </View>
        </View>
      </View>
      <View style={{ gap: 6 }}>
        {radialSegments.map((segment) => {
          const isSelected = selectedLabel === segment.label;
          return (
            <Pressable
              key={`${segment.label}-legend`}
              accessibilityRole="button"
              accessibilityLabel={`${segment.label}, ${formatValue(segment.value)}, ${Math.round((segment.value / chartTotal) * 100)} percent of spending`}
              onPress={() => setSelectedLabel(isSelected ? null : segment.label)}
              style={[styles.categoryRow, { backgroundColor: isSelected ? segment.color + '16' : 'transparent', borderColor: isSelected ? segment.color + '55' : 'transparent' }]}
            >
              <View style={[styles.categoryDot, { backgroundColor: segment.color }]} />
              <Text numberOfLines={1} style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary, flex: 1 }]}>{cleanDisplayText(segment.label)}</Text>
              <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary, fontVariant: ['tabular-nums'] }]}>{formatValue(segment.value)}</Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted, width: 34, textAlign: 'right' }]}>{`${Math.round((segment.value / chartTotal) * 100)}%`}</Text>
            </Pressable>
          );
        })}
      </View>
    </Surface>
  );
}

export const TrendChart = ChartCard;
export const CategoryBreakdown = ChartCard;
export const AccountBreakdown = ChartCard;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  signal: {
    width: 28,
    height: 3,
    borderRadius: 999,
    marginBottom: 12,
  },
  radialGlow: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 999,
    right: -64,
    top: 54,
  },
  radialCenter: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 42,
  },
  categoryCount: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  categoryRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  categoryDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
  },
});
