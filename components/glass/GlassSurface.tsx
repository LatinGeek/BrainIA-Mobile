import { ReactNode, useId } from 'react';
import { Platform, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/lib/app-state';
import { useReduceTransparency } from '@/lib/hooks';
import { GlassLevel } from '@/lib/themes';

export type GlassTone = 'neutral' | 'finance' | 'review' | 'model' | 'danger' | 'accent';

const toneTint: Record<GlassTone, (theme: ReturnType<typeof useTheme>) => string | null> = {
  neutral: () => null,
  accent: (theme) => `${theme.colors.accent}0F`,
  finance: (theme) => `${theme.status.income}0F`,
  review: (theme) => `${theme.status.review}13`,
  model: (theme) => `${theme.colors.model}0F`,
  danger: (theme) => `${theme.colors.danger}12`,
};

export function GlassSurface({
  children,
  level = 'regular',
  tone = 'neutral',
  chrome = false,
  title,
  subtitle,
  action,
  padding = 'md',
  radius = 'lg',
  style,
  contentStyle,
  bordered = true,
}: {
  children?: ReactNode;
  level?: GlassLevel;
  tone?: GlassTone;
  chrome?: boolean;
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  radius?: 'sm' | 'md' | 'lg' | 'xl';
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  bordered?: boolean;
}) {
  const theme = useTheme();
  const reduceTransparency = useReduceTransparency();
  const gradientId = `glass-edge-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const paddingValue = padding === 'none' ? 0 : padding === 'sm' ? theme.spacing.sm : padding === 'lg' ? theme.spacing.lg : theme.spacing.md;
  const borderRadius = theme.radius[radius];
  const fill = theme.glass.fill[level];
  const tint = toneTint[tone](theme);

  // Android blur is expensive. Keep real blur for floating chrome and strong
  // panels only; everything else uses the translucent fill.
  const useBlur = !reduceTransparency && !(Platform.OS === 'android' && !chrome && level !== 'strong');
  const backgroundColor = reduceTransparency
    ? theme.glass.solid[level]
    : chrome
      ? `${theme.ambient.base}BD`
      : fill[0];

  return (
    <View
      style={[
        {
          backgroundColor,
          borderRadius,
          borderWidth: bordered ? StyleSheet.hairlineWidth : 0,
          borderColor: reduceTransparency ? theme.glass.divider : theme.glass.edge[0],
          overflow: 'hidden',
          ...(level === 'thin' ? {} : theme.shadow.card),
        },
        style,
      ]}
    >
      {useBlur ? (
        <BlurView
          intensity={theme.glass.blur[level]}
          tint="dark"
          experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {!reduceTransparency ? (
        <Svg pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={fill[0]} />
              <Stop offset="1" stopColor={fill[1]} />
            </LinearGradient>
          </Defs>
          <Rect x="0.5" y="0.5" width="99.7%" height="99.7%" rx={borderRadius} fill={`url(#${gradientId})`} />
        </Svg>
      ) : null}
      {tint ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} /> : null}
      {!reduceTransparency ? (
        <Svg pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={`${gradientId}-stroke`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={theme.glass.edge[0]} />
              <Stop offset="0.55" stopColor={theme.glass.edge[1]} />
              <Stop offset="1" stopColor={theme.glass.edge[1]} />
            </LinearGradient>
          </Defs>
          <Rect x="0.5" y="0.5" width="99.7%" height="99.7%" rx={borderRadius} fill="none" stroke={`url(#${gradientId}-stroke)`} strokeWidth={1} />
        </Svg>
      ) : null}

      <View style={[{ padding: paddingValue, gap: theme.spacing.md }, contentStyle]}>
        {title || subtitle || action ? (
          <View style={styles.header}>
            <View style={{ flex: 1, gap: 2 }}>
              {title ? typeof title === 'string' ? <HeaderText text={title} /> : title : null}
              {subtitle ? typeof subtitle === 'string' ? <SubtitleText text={subtitle} /> : subtitle : null}
            </View>
            {action}
          </View>
        ) : null}
        {children}
      </View>
    </View>
  );
}

function HeaderText({ text }: { text: string }) {
  const theme = useTheme();
  return <>{text ? <View accessibilityRole="header"><Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>{text}</Text></View> : null}</>;
}

function SubtitleText({ text }: { text: string }) {
  const theme = useTheme();
  return <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{text}</Text>;
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
});
