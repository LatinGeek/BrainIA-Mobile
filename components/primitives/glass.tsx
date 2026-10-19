import { BlurView } from 'expo-blur';
import { ReactNode, useId, useState } from 'react';
import { LayoutChangeEvent, Platform, StyleProp, StyleSheet, Text, useWindowDimensions, View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/lib/app-state';
import { useReduceTransparency } from '@/lib/hooks';
import { GlassLevel, ThemeTokens } from '@/lib/themes';

export type GlassTone = 'neutral' | 'finance' | 'review' | 'model' | 'danger' | 'accent';
type Padding = 'none' | 'sm' | 'md' | 'lg';

function toneColor(theme: ThemeTokens, tone: GlassTone) {
  switch (tone) {
    case 'finance':
      return theme.status.income;
    case 'review':
      return theme.status.review;
    case 'model':
      return theme.colors.model;
    case 'danger':
      return theme.colors.danger;
    case 'accent':
      return theme.colors.accent;
    default:
      return null;
  }
}

/**
 * The glass material. A translucent two-stop fill over the ambient field with
 * a specular top edge. Real blur is reserved for `strong` and `chrome`
 * surfaces (and skipped on Android except for chrome) to stay inside the
 * per-screen blur budget. Reduce Transparency renders `glass.solid`.
 */
export function GlassSurface({
  children,
  level = 'regular',
  tone = 'neutral',
  chrome = false,
  padding = 'md',
  radius = 'lg',
  title,
  subtitle,
  action,
  style,
}: {
  children?: ReactNode;
  level?: GlassLevel;
  tone?: GlassTone;
  chrome?: boolean;
  padding?: Padding;
  radius?: 'sm' | 'md' | 'lg' | 'xl' | 'pill';
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const reduceTransparency = useReduceTransparency();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const borderRadius = theme.radius[radius];
  const paddingValue = padding === 'none' ? 0 : padding === 'sm' ? theme.spacing.sm : padding === 'lg' ? theme.spacing.lg : theme.spacing.md;
  const tint = toneColor(theme, tone);
  const useBlur = !reduceTransparency && (chrome || (level === 'strong' && Platform.OS !== 'android'));
  const [fillTop, fillBottom] = theme.glass.fill[level];

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (Math.abs(width - size.width) > 0.5 || Math.abs(height - size.height) > 0.5) setSize({ width, height });
  };

  const header = title ? (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  ) : null;

  if (reduceTransparency) {
    return (
      <View
        style={[
          {
            borderRadius,
            padding: paddingValue,
            backgroundColor: theme.glass.solid[level],
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: tint ? `${tint}55` : theme.glass.stroke,
          },
          style,
        ]}
      >
        {header}
        {children}
      </View>
    );
  }

  const { width, height } = size;
  return (
    <View
      onLayout={onLayout}
      style={[
        {
          borderRadius,
          padding: paddingValue,
          overflow: 'hidden',
          // Chrome sits over scrolling content, so it gets a dense base that keeps text legible.
          backgroundColor: chrome ? hexWithAlpha(theme.ambient.base, theme.glass.chromeBase) : 'transparent',
        },
        style,
      ]}
    >
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {useBlur ? (
          <BlurView
            intensity={theme.glass.blur[level] * 2}
            tint="dark"
            experimentalBlurMethod={chrome && Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        {width > 0 ? (
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id={`f${id}`} x1="0" y1="0" x2="0.35" y2="1">
                <Stop offset="0" stopColor={fillTop} />
                <Stop offset="1" stopColor={fillBottom} />
              </LinearGradient>
              <LinearGradient id={`e${id}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={theme.glass.edge[0]} />
                <Stop offset="0.45" stopColor={theme.glass.edge[1]} />
                <Stop offset="1" stopColor={theme.glass.stroke} stopOpacity={0.6} />
              </LinearGradient>
              {tint ? (
                <RadialGradient id={`t${id}`} cx="0" cy="0" rx={width * 0.9} ry={Math.max(height, 1) * 1.1} fx="0" fy="0" gradientUnits="userSpaceOnUse">
                  <Stop offset="0" stopColor={tint} stopOpacity={0.16} />
                  <Stop offset="1" stopColor={tint} stopOpacity={0} />
                </RadialGradient>
              ) : null}
            </Defs>
            <Rect x={0} y={0} width={width} height={height} rx={borderRadius} fill={`url(#f${id})`} />
            {tint ? <Rect x={0} y={0} width={width} height={height} rx={borderRadius} fill={`url(#t${id})`} /> : null}
            <Rect
              x={0.5}
              y={0.5}
              width={Math.max(width - 1, 0)}
              height={Math.max(height - 1, 0)}
              rx={Math.max(borderRadius - 0.5, 0)}
              fill="none"
              stroke={`url(#e${id})`}
              strokeWidth={1}
            />
          </Svg>
        ) : (
          <View style={[StyleSheet.absoluteFill, { borderRadius, backgroundColor: fillBottom, borderWidth: 1, borderColor: theme.glass.stroke }]} />
        )}
      </View>
      {header}
      {children}
    </View>
  );
}

function hexWithAlpha(hex: string, alpha: number) {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * The ambient field behind every screen: base colour, three soft orbs and two
 * faint rings. Static (no drift) so it costs nothing while scrolling.
 */
export function AmbientBackground() {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const reduceTransparency = useReduceTransparency();
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [o1, o2, o3] = theme.ambient.orbs;

  if (reduceTransparency) {
    return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: theme.ambient.base }]} />;
  }

  const orbs = [
    { key: 'a', color: o1, cx: width * 0.95, cy: height * 0.04, r: width * 0.95, opacity: 0.55 },
    { key: 'b', color: o2, cx: width * 0.02, cy: height * 0.5, r: width * 0.9, opacity: 0.5 },
    { key: 'c', color: o3, cx: width * 0.9, cy: height * 0.98, r: width * 0.6, opacity: 0.12 },
  ];

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: theme.ambient.base }]}>
      <Svg width={width} height={height}>
        <Defs>
          {orbs.map((orb) => (
            <RadialGradient key={orb.key} id={`${orb.key}${id}`} cx={orb.cx} cy={orb.cy} r={orb.r} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={orb.color} stopOpacity={orb.opacity} />
              <Stop offset="1" stopColor={orb.color} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        {orbs.map((orb) => (
          <Rect key={orb.key} x={0} y={0} width={width} height={height} fill={`url(#${orb.key}${id})`} />
        ))}
        <Circle cx={width * 1.02} cy={height * 0.1} r={width * 0.62} fill="none" stroke={theme.ambient.ring} strokeOpacity={0.12} strokeWidth={1} />
        <Circle cx={width * 1.02} cy={height * 0.1} r={width * 0.82} fill="none" stroke={theme.ambient.ring} strokeOpacity={0.06} strokeWidth={1} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  headerText: { flex: 1, minWidth: 0, gap: 2 },
});
