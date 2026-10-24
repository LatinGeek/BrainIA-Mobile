import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, Platform, StyleProp, StyleSheet, Text, View, ViewStyle, useWindowDimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useAmbientBackdrop } from '@/components/glass/GlassBackdrop';
import { GlassPaint } from '@/components/glass/GlassPaint';
import { GlassScrollContext } from '@/components/glass/GlassScroll';
import { useTheme } from '@/lib/app-state';
import { useReduceMotion, useReduceTransparency } from '@/lib/hooks';
import { GlassLevel } from '@/lib/themes';

export type GlassTone = 'neutral' | 'finance' | 'review' | 'model' | 'danger' | 'accent';

/** The flat wash a tone lays over the pane. */
const toneTint: Record<GlassTone, (theme: ReturnType<typeof useTheme>) => string | null> = {
  neutral: () => null,
  accent: (theme) => `${theme.colors.accent}0A`,
  finance: (theme) => `${theme.status.income}0A`,
  review: (theme) => `${theme.status.review}0A`,
  model: (theme) => `${theme.colors.model}0A`,
  danger: (theme) => `${theme.colors.danger}0A`,
};

/** The same colour with its alpha replaced, for a rim that is drawn under a brighter one. */
function withAlpha(color: string, alpha: number) {
  const match = color.match(/^rgba?\(([^)]+)\)$/i);
  if (!match) return color;
  const [r, g, b] = match[1].split(',').map((part) => Number(part.trim()));
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Set inside every GlassSurface so a nested surface knows what it sits on. `veil` is the
 * white haze already laid down by the surfaces around it (a nested surface adds its own on
 * top, so it never reads darker than its parent); `chrome` marks a flat plate (dock, sheet,
 * toast), whose children stay flat too.
 */
const ParentGlass = createContext<{ veil: number; chrome: boolean } | null>(null);

// Android backdrop: blur sigma (dp) and white veil strength per level. Every surface
// follows the same layers; the level only changes how strong they are. Keep the sigmas in step
// with AMBIENT_BLURS in GlassBackdrop, which pre-renders them before the first screen.
const backdropBlur: Record<GlassLevel, number> = { thin: 1.5, regular: 2, strong: 3.5 };

// The backdrop sits this many px left of where it truly lies behind the card, faking glass refraction.
const REFRACTION_OFFSET = 4;
const backdropVeil: Record<GlassLevel, number> = { thin: 0.014, regular: 0.024, strong: 0.036 };

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
  const reduceMotion = useReduceMotion();
  const parent = useContext(ParentGlass);
  const nested = parent !== null;
  const paddingValue = padding === 'none' ? 0 : padding === 'sm' ? theme.spacing.sm : padding === 'lg' ? theme.spacing.lg : theme.spacing.md;
  const borderRadius = theme.radius[radius];
  const fill = theme.glass.fill[level];
  const tint = toneTint[tone](theme);
  const android = Platform.OS === 'android';
  // The card's own box, which is what the glass paint is drawn to.
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  // A caller can override the radius or the border from its own style (a sheet, an error field);
  // the paint has to follow, or its rim sits away from the card's edge.
  const override = StyleSheet.flatten(style) as ViewStyle | undefined;
  const paintRadius = typeof override?.borderRadius === 'number' ? override.borderRadius : borderRadius;
  const keepsBorder = override?.borderColor !== undefined;
  // With the paint on, the SVG paths draw their own rim; Android needs the view's border as the
  // continuous hairline that its gradient layers light up.
  const painted = !reduceTransparency && box !== null;
  const borderAsRim = painted && android;
  const paintBorder = bordered && !(painted && !android && !keepsBorder);

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
  // The spot also lives in shared values: a card measured while its screen is still rising into place is measured
  // again once the entrance ends, and that correction glides instead of stepping.
  const spotX = useSharedValue(0);
  const spotY = useSharedValue(0);
  const hasSpot = useRef(false);
  const measureSpot = useCallback(() => {
    if (!wantsBackdrop) return;
    viewRef.current?.measureInWindow((x, y, w, h) => {
      if (w <= 0 || h <= 0) return;
      const contentX = x + (scrollX ? scrollX.get() : 0);
      const contentY = y + (scrollY ? scrollY.get() : 0);
      if (!hasSpot.current) {
        hasSpot.current = true;
        spotX.set(contentX);
        spotY.set(contentY);
      } else if (Math.abs(spotX.get() - contentX) >= 1 || Math.abs(spotY.get() - contentY) >= 1) {
        spotX.set(withTiming(contentX, { duration: 160 }));
        spotY.set(withTiming(contentY, { duration: 160 }));
      }
      setSpot((prev) => (prev && Math.abs(prev.contentX - contentX) < 1 && Math.abs(prev.contentY - contentY) < 1 ? prev : { contentX, contentY }));
    });
  }, [wantsBackdrop, scrollX, scrollY, spotX, spotY]);
  // The sheet is drawn to the card's own box, on every platform.
  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      if (width > 0 && height > 0) {
        setBox((prev) => (prev && Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1 ? prev : { width, height }));
      }
      measureSpot();
    },
    [measureSpot],
  );
  const settled = glassScroll?.settled;
  useEffect(() => {
    if (settled) measureSpot();
  }, [settled, measureSpot]);
  // A card that mounts while its screen rises into place (a tab, or a segment switch inside a screen that replays
  // the rise) is measured mid-rise; measure it again when the longest entrance has finished.
  const entranceMs = theme.motion.duration.enter + theme.motion.staggerMax * theme.motion.stagger + 40;
  useEffect(() => {
    if (!wantsBackdrop) return;
    const timer = setTimeout(measureSpot, entranceMs);
    return () => clearTimeout(timer);
  }, [wantsBackdrop, measureSpot, entranceMs]);
  const backdropUri = useAmbientBackdrop(wantsBackdrop ? backdropBlur[level] : 0, theme.ambient, screenWidth, screenHeight);
  const childGlass = { veil: wantsBackdrop ? veilAlpha : parent?.veil ?? 0, chrome: chrome || (parent?.chrome ?? false) };
  const glass = backdropUri !== null && spot !== null;
  // A new surface paints no flat fill while its glass backdrop is on the way (a flat fill is a different colour, and
  // swapping it for glass a moment later was visible on every tab switch). The glass fades in once ready; if it
  // never comes (no image, no measurement), the flat fill is shown after a short wait.
  const reveal = useSharedValue(0);
  const [giveUp, setGiveUp] = useState(false);
  useEffect(() => {
    reveal.set(reduceMotion ? (glass ? 1 : 0) : withTiming(glass ? 1 : 0, { duration: 180 }));
  }, [glass, reduceMotion, reveal]);
  useEffect(() => {
    if (!wantsBackdrop || glass) return;
    const timer = setTimeout(() => setGiveUp(true), 900);
    return () => clearTimeout(timer);
  }, [glass, wantsBackdrop]);
  const revealStyle = useAnimatedStyle(() => ({ opacity: reveal.value }));
  const backdropStyle = useAnimatedStyle(
    () => ({
      transform: [
        { translateX: (scrollX ? scrollX.value : 0) - spotX.value - REFRACTION_OFFSET },
        { translateY: (scrollY ? scrollY.value : 0) - spotY.value },
      ],
    }),
    [scrollX, scrollY, spotX, spotY],
  );

  // iOS and web keep the native blur view.
  const nativeBlur = !android && !reduceTransparency && !nested && level !== 'thin';
  const waitingForGlass = wantsBackdrop && !glass && !giveUp;
  const backgroundColor = glass || waitingForGlass
    ? 'transparent'
    : reduceTransparency
      ? theme.glass.solid[level]
      : chrome
        // Without a blur, scrolled content would ghost through the plate, so
        // Android chrome uses the denser plate.
        ? android ? theme.glass.chromeOpaque : theme.glass.chrome
        // The paint layer carries the body; this is only what shows before it arrives.
        : fill[1];

  return (
    <View
      ref={viewRef}
      collapsable={false}
      onLayout={onLayout}
      style={[
        {
          backgroundColor,
          borderRadius,
          // On the SVG paths the rim is drawn by the paint layer, so a border here would read as a
          // second outline. Android keeps it, and so does a caller that brought its own colour.
          borderWidth: paintBorder ? StyleSheet.hairlineWidth : 0,
          borderColor: reduceTransparency ? theme.glass.divider : borderAsRim ? withAlpha(theme.glass.edge[1], 0.4) : withAlpha(theme.glass.edge[0], 0.5),
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
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, revealStyle]}>
          <Animated.Image
            source={{ uri: backdropUri }}
            resizeMode="stretch"
            fadeDuration={0}
            style={[{ position: 'absolute', left: 0, top: 0, width: screenWidth, height: screenHeight }, backdropStyle]}
          />
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(255,255,255,${veilAlpha})` }]} />
        </Animated.View>
      ) : null}
      {/*
        The material itself: body haze, rim, bevel, specular streaks and colour split. Chrome
        plates keep their own dense body and only take the rim.
      */}
      {!reduceTransparency && box ? (
        <GlassPaint
          width={box.width}
          height={box.height}
          radius={paintRadius}
          level={level}
          rimOnly={chrome || Boolean(parent?.chrome)}
          edges={bordered}
          fill={fill}
          light={theme.glass.light}
        />
      ) : null}
      {tint ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} /> : null}

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
