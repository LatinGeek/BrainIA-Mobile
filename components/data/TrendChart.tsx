import { ReactNode, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInUp, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { GlassSurface } from '@/components/glass/GlassSurface';
import { useTheme } from '@/lib/app-state';
import { cleanDisplayText } from '@/lib/format';

export type TrendSeries = {
  label: string;
  color: string;
  data: number[];
};

export function TrendChart({
  mode = 'line',
  labels,
  series,
  title,
  subtitle,
  formatValue = (value) => String(Math.round(value)),
  selectedIndex,
  onSelect,
  action,
  height = 180,
}: {
  mode?: 'line' | 'bars' | 'spark';
  labels: string[];
  series: TrendSeries[];
  title?: string;
  subtitle?: string;
  formatValue?: (value: number) => string;
  selectedIndex?: number;
  onSelect?: (index: number) => void;
  action?: ReactNode;
  height?: number;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [internalIndex, setInternalIndex] = useState<number | null>(null);
  const activeIndex = selectedIndex ?? internalIndex ?? Math.max(0, labels.length - 1);
  const active = Math.min(activeIndex, Math.max(0, labels.length - 1));
  const maximum = Math.max(1, ...series.flatMap((item) => item.data.map((value) => Math.abs(value))));
  const padding = { top: 12, right: 8, bottom: 22, left: 8 };
  const plotWidth = Math.max(0, width - padding.left - padding.right);
  const plotHeight = Math.max(0, height - padding.top - padding.bottom);
  const x = (index: number) => padding.left + (index / Math.max(1, labels.length - 1)) * plotWidth;
  const y = (value: number) => padding.top + (1 - Math.abs(value) / maximum) * plotHeight;
  const draw = useSharedValue(0);

  useEffect(() => {
    draw.value = 0;
    draw.value = withTiming(1, { duration: theme.motion.duration.count, easing: Easing.out(Easing.cubic) });
  }, [draw, mode, theme.motion.duration.count]);

  const totalLength = Math.max(1, plotWidth * 1.6);
  const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);
  const animatedLineProps = useAnimatedProps(() => ({
    strokeDashoffset: totalLength * (1 - draw.value),
  }));

  const select = (index: number) => {
    setInternalIndex(index);
    onSelect?.(index);
  };

  const rows = series.map((item) => ({ ...item, value: item.data[active] ?? 0 }));

  return (
    <GlassSurface level="regular" padding="md" contentStyle={{ gap: 10 }}>
      {title || subtitle || action ? (
        <View style={styles.between}>
          <View style={{ flex: 1, gap: 2 }}>
            {title ? <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>{cleanDisplayText(title)}</Text> : null}
            {subtitle ? <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{cleanDisplayText(subtitle)}</Text> : null}
          </View>
          {action}
        </View>
      ) : null}

      {mode !== 'spark' ? (
        <View style={styles.legend}>
          {rows.map((item) => (
            <View key={item.label} style={{ gap: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View style={[styles.dot, { backgroundColor: item.color }]} />
                <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{cleanDisplayText(item.label)}</Text>
              </View>
              <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary, fontVariant: ['tabular-nums'] }]}>{formatValue(item.value)}</Text>
            </View>
          ))}
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginLeft: 'auto' }]}>{cleanDisplayText(labels[active])}</Text>
        </View>
      ) : null}

      <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ height, width: '100%' }}>
        {width > 0 && mode === 'bars' ? (
          <View style={[styles.plot, { height, paddingTop: padding.top, paddingBottom: padding.bottom, paddingHorizontal: padding.left }]}>
            {labels.map((label, index) => (
              <Pressable
                key={`${label}-${index}`}
                accessibilityRole="button"
                accessibilityState={{ selected: index === active }}
                accessibilityLabel={`${label}. ${series.map((item) => `${item.label} ${formatValue(item.data[index] ?? 0)}`).join('. ')}`}
                onPress={() => select(index)}
                style={[styles.barColumn, { backgroundColor: index === active ? theme.glass.inner : 'transparent' }]}
              >
                <View style={styles.bars}>
                  {series.map((item, seriesIndex) => (
                    <Animated.View
                      key={item.label}
                      entering={FadeInUp.delay(Math.min(index, 9) * theme.motion.stagger).duration(theme.motion.duration.enter)}
                      style={{
                        width: series.length > 1 ? '38%' : '58%',
                        maxWidth: 18,
                        height: `${Math.max(3, (Math.abs(item.data[index] ?? 0) / maximum) * 100)}%`,
                        borderRadius: 6,
                        backgroundColor: item.color,
                        opacity: index === active ? 1 : 0.72 + seriesIndex * 0,
                      }}
                    />
                  ))}
                </View>
                <Text numberOfLines={1} style={[theme.typography.caption, { color: index === active ? theme.colors.textPrimary : theme.colors.textMuted, fontSize: 10 }]}>{cleanDisplayText(label)}</Text>
              </Pressable>
            ))}
          </View>
        ) : width > 0 ? (
          <Svg width={width} height={height}>
            {[0.25, 0.5, 0.75].map((fraction) => (
              <Line
                key={fraction}
                x1={padding.left}
                x2={width - padding.right}
                y1={padding.top + fraction * plotHeight}
                y2={padding.top + fraction * plotHeight}
                stroke={theme.glass.divider}
                strokeWidth={1}
              />
            ))}
            {series.map((item) => (
              <AnimatedPolyline
                key={item.label}
                points={item.data.map((value, index) => `${x(index)},${y(value)}`).join(' ')}
                fill="none"
                stroke={item.color}
                strokeWidth={mode === 'spark' ? 2 : 2.6}
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray={`${totalLength} ${totalLength}`}
                animatedProps={animatedLineProps}
              />
            ))}
            {mode !== 'spark' ? series.map((item) => item.data.map((value, index) => (
              <Circle
                key={`${item.label}-${index}`}
                cx={x(index)}
                cy={y(value)}
                r={index === active ? 4.6 : 2.8}
                fill={item.color}
                opacity={index === active ? 1 : 0.8}
              />
            ))) : null}
          </Svg>
        ) : null}
      </View>

      {mode !== 'spark' && labels.length ? (
        <View style={[styles.labels, { paddingHorizontal: padding.left }]}>
          {labels.map((label, index) => (
            <Pressable key={`${label}-${index}`} accessibilityRole="button" accessibilityState={{ selected: index === active }} accessibilityLabel={`Show ${label}`} onPress={() => select(index)} hitSlop={{ top: 14, bottom: 14, left: 12, right: 12 }}>
              <Text style={[theme.typography.caption, { color: index === active ? theme.colors.textPrimary : theme.colors.textMuted, fontSize: 10 }]}>{cleanDisplayText(label)}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  between: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    gap: 16,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  plot: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 4,
  },
  barColumn: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    borderRadius: 10,
    paddingHorizontal: 2,
    paddingTop: 6,
    gap: 6,
  },
  bars: {
    flex: 1,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 3,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -18,
  },
});
