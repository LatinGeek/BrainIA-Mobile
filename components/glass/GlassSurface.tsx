import { createContext, ReactNode, useCallback, useContext, useId, useRef, useState } from 'react';
import { Platform, StyleProp, StyleSheet, Text, View, ViewStyle, useWindowDimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useAmbientBackdrop } from '@/components/glass/GlassBackdrop';
import { GlassScrollContext } from '@/components/glass/GlassScroll';
import { useTheme } from '@/lib/app-state';
import { useReduceTransparency } from '@/lib/hooks';
import { GlassLevel } from '@/lib/themes';

export type GlassTone = 'neutral' | 'finance' | 'review' | 'model' | 'danger' | 'accent';

const toneTint: Record<GlassTone, (theme: ReturnType<typeof useTheme>) => string | null> = {
  neutral: () => null,
  accent: (theme) => `${theme.colors.accent}0A`,
  finance: (theme) => `${theme.status.income}0A`,
  review: (theme) => `${theme.status.review}0C`,
  model: (theme) => `${theme.colors.model}0A`,
  danger: (theme) => `${theme.colors.danger}0C`,
};

function svgStop(value: string) {
  const match = value.match(/^rgba?\(([^)]+)\)$/i);
  if (!match) return { color: value, opacity: 1 };
  const [r, g, b, a] = match[1].split(',').map((part) => Number(part.trim()));
  return { color: `rgb(${r},${g},${b})`, opacity: Number.isFinite(a) ? a : 1 };
}

/** A rim colour from a theme edge colour, with its alpha scaled (clamped to opaque). */
function rimColor(value: string, scale: number) {
  const { color, opacity } = svgStop(value);
  const match = color.match(/^rgb\((\d+),(\d+),(\d+)\)$/);
  if (!match) return value;
  return `rgba(${match[1]},${match[2]},${match[3]},${Math.min(1, opacity * scale)})`;
}

/**
 * Set inside every GlassSurface so a nested surface knows what it sits on. `veil` is the
 * white haze already laid down by the surfaces around it (a nested surface adds its own on
 * top, so it never reads darker than its parent); `chrome` marks a flat plate (dock, sheet,
 * toast), whose children stay flat too.
 */
const ParentGlass = createContext<{ veil: number; chrome: boolean } | null>(null);

// Android backdrop: blur sigma (dp) and white veil strength per level. Every surface
// follows the same layers; the level only changes how strong they are.
const backdropBlur: Record<GlassLevel, number> = { thin: 8, regular: 12, strong: 18 };
const backdropVeil: Record<GlassLevel, number> = { thin: 0.035, regular: 0.06, strong: 0.08 };

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
  const parent = useContext(ParentGlass);
  const nested = parent !== null;
  const gradientId = `glass-edge-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const paddingValue = padding === 'none' ? 0 : padding === 'sm' ? theme.spacing.sm : padding === 'lg' ? theme.spacing.lg : theme.spacing.md;
  const borderRadius = theme.radius[radius];
  const fill = theme.glass.fill[level];
  const tint = toneTint[tone](theme);
  const android = Platform.OS === 'android';

  // Android: every glass surface (any level, nested or not) shows a blurred copy of the
  // ambient light, slid against the card with the scroll offset so it always matches what
  // sits behind the card. Chrome plates, and anything inside one, stay flat.
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const glassScroll = useContext(GlassScrollContext);
  const scrollY = glassScroll?.y ?? null;
  const scrollX = glassScroll?.x ?? null;
  const viewRef = useRef<View>(null);
  // Where the card sits in its scroll content (the scroll offsets added back to its window position).
  const [spot, setSpot] = useState<{ contentX: number; contentY: number } | null>(null);
  const wantsBackdrop = android && !reduceTransparency && !chrome && !parent?.chrome;
  const veilAlpha = backdropVeil[level] + (parent?.veil ?? 0);
  const onLayout = useCallback(() => {
    if (!wantsBackdrop) return;
    viewRef.current?.measureInWindow((x, y, w, h) => {
      if (w <= 0 || h <= 0) return;
      const contentX = x + (scrollX ? scrollX.get() : 0);
      const contentY = y + (scrollY ? scrollY.get() : 0);
      setSpot((prev) => (prev && Math.abs(prev.contentX - contentX) < 1 && Math.abs(prev.contentY - contentY) < 1 ? prev : { contentX, contentY }));
    });
  }, [wantsBackdrop, scrollX, scrollY]);
  const backdropUri = useAmbientBackdrop(wantsBackdrop ? backdropBlur[level] : 0, theme.ambient, screenWidth, screenHeight);
  const childGlass = { veil: wantsBackdrop ? veilAlpha : parent?.veil ?? 0, chrome: chrome || (parent?.chrome ?? false) };
  const glass = backdropUri !== null && spot !== null;
  const backdropStyle = useAnimatedStyle(
    () => ({
      transform: [
        { translateX: (scrollX ? scrollX.value : 0) - (spot ? spot.contentX : 0) },
        { translateY: (scrollY ? scrollY.value : 0) - (spot ? spot.contentY : 0) },
      ],
    }),
    [scrollX, scrollY, spot],
  );

  // iOS and web keep the native blur view.
  const nativeBlur = !android && !reduceTransparency && !nested && level !== 'thin';
  // Flat Android glass (no blur): fill, top light, rim and a specular line.
  const crisp = android && !reduceTransparency;
  const backgroundColor = glass
    ? 'transparent'
    : reduceTransparency
      ? theme.glass.solid[level]
      : chrome
        // Without a blur, scrolled content would ghost through the plate, so
        // Android chrome uses the denser plate.
        ? android ? theme.glass.chromeOpaque : theme.glass.chrome
        : fill[0];

  return (
    <View
      ref={viewRef}
      collapsable={false}
      onLayout={onLayout}
      style={[
        {
          backgroundColor,
          borderRadius,
          borderWidth: bordered ? StyleSheet.hairlineWidth : 0,
          borderColor: reduceTransparency ? theme.glass.divider : theme.glass.edge[0],
          overflow: 'hidden',
          // Android elevation shadows cannot be clipped under a translucent surface, so they
          // show through as a dark ring with a lighter square in the middle. Skip them there.
          ...(level === 'thin' || android ? {} : theme.shadow.card),
        },
        style,
      ]}
    >
      {nativeBlur ? (
        <BlurView intensity={theme.glass.blur[level]} tint="dark" style={StyleSheet.absoluteFill} />
      ) : null}
      {glass && backdropUri && spot ? (
        <>
          <Animated.Image
            source={{ uri: backdropUri }}
            resizeMode="stretch"
            fadeDuration={0}
            style={[{ position: 'absolute', left: 0, top: 0, width: screenWidth, height: screenHeight }, backdropStyle]}
          />
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(255,255,255,${veilAlpha})` }]} />
        </>
      ) : null}
      {crisp ? (
        // Soft top-lit sheen: brightest at the top edge, gone by the middle. A native gradient
        // style, so a screen full of cards does not record one SVG scene per card on the UI thread.
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { experimental_backgroundImage: 'linear-gradient(to bottom, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 45%, rgba(255,255,255,0) 100%)' }]}
        />
      ) : !reduceTransparency ? (
        <Svg pointerEvents="none" width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={svgStop(fill[0]).color} stopOpacity={svgStop(fill[0]).opacity} />
              <Stop offset="1" stopColor={svgStop(fill[1]).color} stopOpacity={svgStop(fill[1]).opacity} />
            </LinearGradient>
          </Defs>
          <Rect x="0.5" y="0.5" width="99.7%" height="99.7%" rx={borderRadius} fill={`url(#${gradientId})`} />
        </Svg>
      ) : null}
      {tint ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} /> : null}
      {crisp ? (
        <>
          {/* Rim: one uniform colour. Per-side border colours leave a visible notch at rounded corners; the top light comes from the specular line below. */}
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius, borderWidth: 1, borderColor: rimColor(theme.glass.edge[0], 0.45) }]} />
          {/* Specular line along the top edge, fading out at both ends. */}
          <View
            pointerEvents="none"
            style={{ position: 'absolute', top: 0, left: '10%', width: '80%', height: 1, experimental_backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0) 100%)' }}
          />
        </>
      ) : !reduceTransparency ? (
        <Svg pointerEvents="none" width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={`${gradientId}-stroke`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={svgStop(theme.glass.edge[0]).color} stopOpacity={Math.min(1, svgStop(theme.glass.edge[0]).opacity * (crisp ? 1.6 : 1))} />
              <Stop offset="0.55" stopColor={svgStop(theme.glass.edge[1]).color} stopOpacity={svgStop(theme.glass.edge[1]).opacity} />
              <Stop offset="1" stopColor={svgStop(theme.glass.edge[1]).color} stopOpacity={svgStop(theme.glass.edge[1]).opacity} />
            </LinearGradient>
            {/* Specular line along the top edge, fading out at both ends. */}
            <LinearGradient id={`${gradientId}-hi`} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
              <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0.55} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect x="0.5" y="0.5" width="99.7%" height="99.7%" rx={borderRadius} fill="none" stroke={`url(#${gradientId}-stroke)`} strokeWidth={1} />
          {crisp ? <Rect x="10%" y="0.5" width="80%" height="1" fill={`url(#${gradientId}-hi)`} /> : null}
        </Svg>
      ) : null}

      <ParentGlass.Provider value={childGlass}>
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
      </ParentGlass.Provider>
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
