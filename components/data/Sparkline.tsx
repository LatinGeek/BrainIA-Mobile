import { useId, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { useTheme } from '@/lib/app-state';

/**
 * Thin trend line with a soft area fill and an end-point dot. Colour defaults to
 * the live accent so it reads as "current" next to a hero amount. Without a
 * `width` the line fills its container.
 */
export function Sparkline({
  values,
  width,
  height = 40,
  color,
  accessibilityLabel,
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const gradientId = `spark-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const stroke = color ?? theme.colors.accent;
  const chartWidth = width ?? measuredWidth;

  const chart = (() => {
    if (values.length < 2 || chartWidth <= 0) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const inset = 3;
    const points = values.map((value, index) => ({
      x: (index / (values.length - 1)) * chartWidth,
      y: inset + (1 - (value - min) / range) * (height - inset * 2),
    }));
    const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
    const area = `${line} L${chartWidth},${height} L0,${height} Z`;
    const last = points[points.length - 1];
    return (
      <Svg width={chartWidth} height={height} viewBox={`0 0 ${chartWidth} ${height}`}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={stroke} stopOpacity="0.28" />
            <Stop offset="1" stopColor={stroke} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Path d={area} fill={`url(#${gradientId})`} />
        <Path d={line} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={last.x} cy={last.y} r={2.75} fill={stroke} />
      </Svg>
    );
  })();

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel ?? 'Tendencia del ciclo'}
      onLayout={width === undefined ? (event) => setMeasuredWidth(event.nativeEvent.layout.width) : undefined}
      style={{ width: width ?? '100%', height }}
    >
      {chart}
    </View>
  );
}
