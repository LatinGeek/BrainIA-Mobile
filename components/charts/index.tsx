import Svg, { Circle } from 'react-native-svg';
import { Pressable, Text, View, StyleSheet, useWindowDimensions } from 'react-native';
import { type ReactNode, useEffect, useState } from 'react';
import Animated, {
  Easing,
  FadeIn,
  FadeInUp,
  FadeOut,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Surface } from '@/components/primitives';
import { useTheme } from '@/lib/app-state';
import { cleanDisplayText } from '@/lib/format';

type RadialSegment = {
  label: string;
  value: number;
  displayValue?: number;
  color?: string;
};

function formatChartPercentage(value: number, total: number) {
  if (total <= 0) return '0%';
  const percentage = (value / total) * 100;
  return `${percentage >= 10 ? percentage.toFixed(0) : percentage.toFixed(1)}%`;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function AnimatedRadialSlice({
  center,
  radius,
  circumference,
  sliceLength,
  offset,
  strokeWidth,
  color,
  index,
  isSelected,
  isDimmed,
}: {
  center: number;
  radius: number;
  circumference: number;
  sliceLength: number;
  offset: number;
  strokeWidth: number;
  color: string;
  index: number;
  isSelected: boolean;
  isDimmed: boolean;
}) {
  const reveal = useSharedValue(0);
  const selection = useSharedValue(isSelected ? 1 : 0);
  const dimming = useSharedValue(isDimmed ? 1 : 0);
  const baseOffset = circumference * 0.25 - offset;

  useEffect(() => {
    reveal.value = 0;
    reveal.value = withDelay(
      Math.min(index, 8) * 55,
      withTiming(1, { duration: 680, easing: Easing.out(Easing.cubic) }),
    );
  }, [circumference, index, reveal, sliceLength]);

  useEffect(() => {
    selection.value = withSpring(isSelected ? 1 : 0, { damping: 16, stiffness: 190, mass: 0.65 });
    dimming.value = withTiming(isDimmed ? 1 : 0, { duration: 220 });
  }, [dimming, isDimmed, isSelected, selection]);

  const animatedProps = useAnimatedProps(() => ({
    opacity: reveal.value * (1 - dimming.value * 0.68),
    strokeDashoffset: baseOffset - sliceLength * (1 - reveal.value),
    strokeWidth: strokeWidth + selection.value * Math.max(3, strokeWidth * 0.14),
  }));

  return (
    <AnimatedCircle
      cx={center}
      cy={center}
      r={radius}
      stroke={color}
      fill="none"
      strokeLinecap="butt"
      strokeDasharray={`${sliceLength} ${Math.max(0, circumference - sliceLength)}`}
      transform={`rotate(-90 ${center} ${center})`}
      animatedProps={animatedProps}
    />
  );
}

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

export type MonthlyCashFlowPoint = {
  label: string;
  periodLabel: string;
  income: number;
  spending: number;
};

export function MonthlyCashFlowBar({
  title = 'Monthly cash flow',
  subtitle,
  points,
  formatValue,
  headerAction,
}: {
  title?: string;
  subtitle?: string;
  points: MonthlyCashFlowPoint[];
  formatValue: (value: number) => string;
  headerAction?: ReactNode;
}) {
  const theme = useTheme();
  const [selectedIndex, setSelectedIndex] = useState(Math.max(0, points.length - 1));
  const selected = points[selectedIndex] ?? points.at(-1);
  const maximum = points.reduce((largest, point) => Math.max(largest, point.income, point.spending), 1);

  return (
    <Surface variant="raised" style={{ borderColor: theme.depth.glow, gap: theme.spacing.md, overflow: 'hidden' }}>
      <View style={[styles.radialGlow, { backgroundColor: theme.colors.accent + '0D' }]} />
      <View style={styles.rowBetween}>
        <View style={{ flex: 1 }}>
          <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>{cleanDisplayText(title)}</Text>
          {subtitle ? <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 4 }]}>{cleanDisplayText(subtitle)}</Text> : null}
        </View>
        {headerAction}
      </View>

      {selected ? (
        <Animated.View key={selected.periodLabel} entering={FadeIn.duration(180)} style={{ gap: theme.spacing.sm }}>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{selected.periodLabel}</Text>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <View style={[styles.cashFlowMetric, { backgroundColor: theme.status.income + '12', borderColor: theme.status.income + '2E' }]}>
              <View style={[styles.cashFlowLegendDot, { backgroundColor: theme.status.income }]} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Income</Text>
                <Text numberOfLines={1} adjustsFontSizeToFit style={[theme.typography.bodyStrong, { color: theme.status.income, fontVariant: ['tabular-nums'] }]}>{formatValue(selected.income)}</Text>
              </View>
            </View>
            <View style={[styles.cashFlowMetric, { backgroundColor: theme.status.expense + '12', borderColor: theme.status.expense + '2E' }]}>
              <View style={[styles.cashFlowLegendDot, { backgroundColor: theme.status.expense }]} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Spending</Text>
                <Text numberOfLines={1} adjustsFontSizeToFit style={[theme.typography.bodyStrong, { color: theme.status.expense, fontVariant: ['tabular-nums'] }]}>{formatValue(selected.spending)}</Text>
              </View>
            </View>
          </View>
        </Animated.View>
      ) : null}

      <View style={[styles.cashFlowPlot, { borderBottomColor: theme.colors.border }]}>
        {points.map((point, index) => {
          const isSelected = selectedIndex === index;
          const incomeHeight = point.income > 0 ? Math.max(4, (point.income / maximum) * 100) : 1;
          const spendingHeight = point.spending > 0 ? Math.max(4, (point.spending / maximum) * 100) : 1;
          return (
            <Pressable
              key={`${point.periodLabel}-${index}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${point.periodLabel}. Income ${formatValue(point.income)}. Spending ${formatValue(point.spending)}.`}
              onPress={() => setSelectedIndex(index)}
              style={[styles.cashFlowColumn, { backgroundColor: isSelected ? theme.colors.accent + '0E' : 'transparent' }]}
            >
              <View style={styles.cashFlowBars}>
                <Animated.View
                  entering={FadeInUp.delay(index * 55).duration(420)}
                  style={[styles.cashFlowBar, { height: `${incomeHeight}%`, backgroundColor: theme.status.income, opacity: isSelected ? 1 : 0.72 }]}
                />
                <Animated.View
                  entering={FadeInUp.delay(index * 55 + 40).duration(420)}
                  style={[styles.cashFlowBar, { height: `${spendingHeight}%`, backgroundColor: theme.status.expense, opacity: isSelected ? 1 : 0.72 }]}
                />
              </View>
              <Text style={[theme.typography.caption, { color: isSelected ? theme.colors.accentStrong : theme.colors.textMuted, fontWeight: isSelected ? '700' : '500' }]}>{point.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Tap a month to inspect its totals.</Text>
    </Surface>
  );
}

export function SpendingRadial({
  title,
  subtitle,
  amount,
  segments,
  formatValue = (value) => String(Math.round(value)),
  totalLabel = 'Total spent',
  itemNoun = 'area',
  percentageNoun = 'spend',
  emptyLabel = 'No spend',
  headerAction,
}: {
  title: string;
  subtitle?: string;
  amount: string;
  segments: RadialSegment[];
  formatValue?: (value: number) => string;
  totalLabel?: string;
  itemNoun?: string;
  percentageNoun?: string;
  emptyLabel?: string;
  headerAction?: ReactNode;
}) {
  const theme = useTheme();
  const { width: viewportWidth } = useWindowDimensions();
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const size = Math.round(Math.min(300, Math.max(224, viewportWidth - 76)));
  const center = size / 2;
  const strokeWidth = Math.max(24, Math.min(32, size * 0.105));
  const radius = size / 2 - strokeWidth / 2 - 7;
  const circumference = 2 * Math.PI * radius;
  const centerDiameter = Math.max(126, radius * 2 - strokeWidth - 10);
  const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0);
  const palette = [theme.colors.accent, '#56C7F2', '#A78BFA', '#F4A261', '#F4C542', theme.status.income];
  const sourceSegments = total > 0 ? segments.filter((segment) => segment.value > 0).sort((a, b) => b.value - a.value) : [{ label: emptyLabel, value: 1, color: theme.colors.surfaceSubtle }];
  const chartTotal = sourceSegments.reduce((sum, segment) => sum + segment.value, 0) || 1;
  const radialSegments = sourceSegments.reduce<(RadialSegment & { offset: number; color: string })[]>((acc, segment, index) => {
    const offset = acc.length ? acc[acc.length - 1].offset + (acc[acc.length - 1].value / chartTotal) * circumference : 0;
    acc.push({ ...segment, offset, color: segment.color ?? palette[index % palette.length] });
    return acc;
  }, []);
  const selected = radialSegments.find((segment) => segment.label === selectedLabel);
  const centerAmount = selected ? formatValue(selected.displayValue ?? selected.value) : amount;
  const centerLabel = selected ? cleanDisplayText(selected.label) : totalLabel;

  return (
    <Surface variant="raised" style={{ borderColor: theme.depth.glow, gap: theme.spacing.md, overflow: 'hidden' }}>
      <View style={[styles.radialGlow, { backgroundColor: theme.colors.accent + '12' }]} />
      <View style={styles.rowBetween}>
        <View style={{ flex: 1 }}>
          <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>{cleanDisplayText(title)}</Text>
          {subtitle ? <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 4 }]}>{cleanDisplayText(subtitle)}</Text> : null}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          {headerAction}
          <View style={[styles.categoryCount, { backgroundColor: theme.colors.surfaceSubtle, borderColor: theme.colors.border }]}>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{`${sourceSegments.length} ${sourceSegments.length === 1 ? itemNoun : `${itemNoun}s`}`}</Text>
          </View>
        </View>
      </View>
      <View style={{ alignItems: 'center', marginTop: -2 }}>
        <Pressable
          accessibilityRole={selected ? 'button' : undefined}
          accessibilityLabel={selected ? `Clear ${selected.label} selection` : `${title} radial chart`}
          disabled={!selected}
          onPress={() => setSelectedLabel(null)}
          style={{ width: size, height: size }}
        >
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <Circle cx={center} cy={center} r={radius + strokeWidth / 2 + 4} stroke={theme.colors.border + '88'} strokeWidth={1} fill="none" />
            <Circle
              cx={center}
              cy={center}
              r={radius}
              stroke={theme.colors.surfaceSubtle + 'CC'}
              strokeWidth={strokeWidth}
              fill="none"
            />
            {radialSegments.map((segment, index) => {
              const slice = Math.max(0, (segment.value / chartTotal) * circumference);
              const isSelected = selectedLabel === segment.label;
              return (
                <AnimatedRadialSlice
                  key={`${segment.label}-${index}`}
                  center={center}
                  radius={radius}
                  circumference={circumference}
                  sliceLength={slice}
                  offset={segment.offset}
                  strokeWidth={strokeWidth}
                  color={segment.color}
                  index={index}
                  isSelected={isSelected}
                  isDimmed={Boolean(selectedLabel && !isSelected)}
                />
              );
            })}
            <Circle cx={center} cy={center} r={radius - strokeWidth / 2 - 3} stroke={theme.colors.border + 'B8'} strokeWidth={1} fill="none" />
          </Svg>
          <View pointerEvents="none" style={styles.radialCenter}>
            <View
              style={[
                styles.radialCenterPlate,
                {
                  width: centerDiameter,
                  height: centerDiameter,
                  borderRadius: centerDiameter / 2,
                  backgroundColor: theme.colors.surface + 'F2',
                  borderColor: selected ? selected.color + '55' : theme.colors.border,
                  shadowColor: selected?.color ?? theme.colors.accent,
                },
              ]}
            >
              <Animated.View
                key={selectedLabel ?? '__total__'}
                entering={FadeIn.duration(180)}
                exiting={FadeOut.duration(110)}
                style={styles.radialCenterContent}
              >
                <Text numberOfLines={1} style={[theme.typography.caption, { color: selected ? selected.color : theme.colors.textMuted, textAlign: 'center' }]}>{centerLabel}</Text>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.66}
                  style={[
                    theme.typography.numeral,
                    {
                      color: theme.colors.textPrimary,
                      marginTop: 4,
                      fontSize: Math.max(25, Math.min(31, size * 0.104)),
                      lineHeight: Math.max(31, Math.min(37, size * 0.124)),
                      textAlign: 'center',
                    },
                  ]}
                >
                  {cleanDisplayText(centerAmount)}
                </Text>
                {selected ? <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 2 }]}>{`${formatChartPercentage(selected.value, chartTotal)} of ${percentageNoun}`}</Text> : null}
              </Animated.View>
            </View>
          </View>
        </Pressable>
      </View>
      <View style={{ gap: 6 }}>
        {radialSegments.map((segment) => {
          const isSelected = selectedLabel === segment.label;
          return (
            <Pressable
              key={`${segment.label}-legend`}
              accessibilityRole="button"
              accessibilityLabel={`${segment.label}, ${formatValue(segment.displayValue ?? segment.value)}, ${formatChartPercentage(segment.value, chartTotal)} of ${percentageNoun}`}
              onPress={() => setSelectedLabel(isSelected ? null : segment.label)}
              style={({ pressed }) => [
                styles.categoryRow,
                {
                  backgroundColor: isSelected ? segment.color + '16' : pressed ? theme.colors.surfaceSubtle + '88' : 'transparent',
                  borderColor: isSelected ? segment.color + '66' : 'transparent',
                  transform: [{ scale: pressed ? 0.992 : 1 }],
                },
              ]}
            >
              <View style={[styles.categoryDotHalo, { backgroundColor: segment.color + '20' }]}>
                <View style={[styles.categoryDot, { backgroundColor: segment.color }]} />
              </View>
              <Text numberOfLines={1} style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary, flex: 1 }]}>{cleanDisplayText(segment.label)}</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary, maxWidth: '38%', fontVariant: ['tabular-nums'] }]}>{formatValue(segment.displayValue ?? segment.value)}</Text>
              <View style={[styles.percentagePill, { backgroundColor: isSelected ? segment.color + '22' : theme.colors.surfaceSubtle }]}> 
                <Text style={[theme.typography.caption, { color: isSelected ? segment.color : theme.colors.textMuted, minWidth: 35, textAlign: 'right', fontVariant: ['tabular-nums'] }]}>{formatChartPercentage(segment.value, chartTotal)}</Text>
              </View>
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
  },
  radialCenterPlate: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 5,
  },
  radialCenterContent: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
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
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  categoryDotHalo: {
    width: 18,
    height: 18,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentagePill: {
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  cashFlowMetric: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  cashFlowLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  cashFlowPlot: {
    height: 188,
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cashFlowColumn: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    borderRadius: 10,
    paddingHorizontal: 2,
    paddingTop: 8,
    paddingBottom: 5,
    gap: 7,
  },
  cashFlowBars: {
    flex: 1,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 3,
  },
  cashFlowBar: {
    width: '30%',
    maxWidth: 16,
    minHeight: 2,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
});
