import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect, useIsFocused } from 'expo-router';
import { Children, Fragment, ReactNode, createContext, cloneElement, isValidElement, useCallback, useContext, useEffect, useId, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollViewProps,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  cancelAnimation,
  withDelay,
  withTiming,
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { AmbientBackground } from '@/components/glass/AmbientBackground';
import { GlassScrollContext } from '@/components/glass/GlassScroll';
import { useToastInset } from '@/components/layout/Toast';
import { GlassPressable } from '@/components/glass/GlassPressable';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { Tag } from '@/components/controls';
import { NavigationRail } from '@/components/layout/NavigationRail';
import { useTheme } from '@/lib/app-state';
import { cleanDisplayText } from '@/lib/format';
import { dockScroll } from '@/lib/dock-scroll';
import { useReduceMotion } from '@/lib/hooks';

const ScreenEnteringContext = createContext(false);

/** Amounts mounted during an entrance may count from zero. */
export function useScreenEntering() {
  return useContext(ScreenEnteringContext);
}

function flattenChildren(children: ReactNode) {
  return Children.toArray(children).flatMap((child) =>
    isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment
      // A fragment's children are keyed from zero again; prefix the fragment's key so they cannot collide with
      // its siblings' (a collision reuses a finished entrance on the wrong item, or remounts one).
      ? Children.toArray(child.props.children).map((inner) =>
          isValidElement(inner) ? cloneElement(inner, { key: `${child.key}/${inner.key}` }) : inner)
      : [child]);
}

function StaggerItem({ children, index, enterKey, enabled = true }: { children: ReactNode; index: number; enterKey: number; enabled?: boolean }) {
  const { motion: M } = useTheme();
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(reduceMotion || !enabled ? 1 : 0);
  useEffect(() => {
    cancelAnimation(progress);
    if (reduceMotion || !enabled) { progress.value = 1; return; }
    progress.value = 0;
    progress.value = withDelay(Math.min(index, M.staggerMax) * M.stagger,
      withTiming(1, { duration: M.duration.enter, easing: Easing.bezier(...M.easing.out) }));
    return () => cancelAnimation(progress);
  }, [M, enabled, enterKey, index, progress, reduceMotion]);
  const style = useAnimatedStyle(() => ({
    opacity: reduceMotion || !enabled ? 1 : progress.value,
    transform: [{ translateY: reduceMotion || !enabled ? 0 : (1 - progress.value) * M.distance.rise }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

function staggerChildren(children: ReactNode, enterKey: number, startIndex = 0) {
  let index = startIndex;
  return flattenChildren(children).map((child) => {
    // Native modal children occupy no scroll layout and own their own entrance.
    if (isValidElement(child) && typeof child.type === 'function' && 'screenOverlay' in child.type && child.type.screenOverlay) return child;
    const itemIndex = index++;
    // A group owns its children; wrapping it again would double the rise and fade.
    if (isValidElement<{ enterKey?: number; startIndex?: number }>(child) && typeof child.type === 'function' && 'screenStaggerGroup' in child.type && child.type.screenStaggerGroup) {
      return cloneElement(child, { enterKey, startIndex: itemIndex });
    }
    return <StaggerItem key={isValidElement(child) ? child.key ?? itemIndex : itemIndex} index={itemIndex} enterKey={enterKey}>{child}</StaggerItem>;
  });
}

/** Key the group to replay only a view body, without moving its controls. */
export function StaggerGroup({ children, gap = 22, enterKey = 0, startIndex = 0 }: { children: ReactNode; gap?: number; enterKey?: number; startIndex?: number }) {
  return <View style={{ gap }}>{staggerChildren(children, enterKey, startIndex)}</View>;
}
StaggerGroup.screenStaggerGroup = true;

/** Soft fade under the status bar, so scrolled content dissolves instead of being cut off. */
function StatusFade({ height, color, from = 'top' }: { height: number; color: string; from?: 'top' | 'bottom' }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, height, ...(from === 'top' ? { top: 0 } : { bottom: 0 }) }}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={`status-fade-${id}`} x1="0" y1={from === 'bottom' ? 1 : 0} x2="0" y2={from === 'bottom' ? 0 : 1}>
            <Stop offset="0" stopColor={color} stopOpacity={1} />
            <Stop offset="0.55" stopColor={color} stopOpacity={1} />
            <Stop offset="0.8" stopColor={color} stopOpacity={0.5} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#status-fade-${id})`} />
      </Svg>
    </View>
  );
}

export function Screen({
  title,
  subtitle,
  overline,
  back = false,
  backLabel = 'Volver',
  actions,
  children,
  scrollable = true,
  stagger = true,
  refreshing = false,
  onRefresh,
  bar,
  ambientAnimated = false,
  contentStyle,
  contentContainerStyle,
}: {
  title: string;
  subtitle?: string;
  overline?: string;
  back?: boolean;
  backLabel?: string;
  actions?: ReactNode;
  children: ReactNode;
  scrollable?: boolean;
  stagger?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  bar?: ReactNode;
  ambientAnimated?: boolean;
  contentStyle?: ScrollViewProps['style'];
  contentContainerStyle?: ScrollViewProps['contentContainerStyle'];
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const reduceMotion = useReduceMotion();
  const M = theme.motion;
  const [enterKey, setEnterKey] = useState(0);
  const [entering, setEntering] = useState(focused);
  const lastY = useSharedValue(0);
  const dockTarget = useSharedValue(0);
  const wasCompact = useSharedValue(false);
  const { width, fontScale } = useWindowDimensions();
  const desktop = width >= 1024;
  const scrollY = useSharedValue(0);
  const [settledKey, setSettledKey] = useState(0);
  const glassScroll = useMemo(() => ({ y: scrollY, x: null, settled: settledKey }), [scrollY, settledKey]);
  const [compactVisible, setCompactVisible] = useState(false);
  // A pinned action bar sits above the dock; toasts must clear it too.
  const [barHeight, setBarHeight] = useState(0);
  useToastInset(focused && bar && barHeight > 0 ? theme.layout.dockHeight + Math.max(0, barHeight - insets.bottom) : 0);

  useFocusEffect(useCallback(() => {
    setEnterKey((key) => key + 1);
    setEntering(true);
    dockTarget.set(0);
    dockScroll.value = reduceMotion ? 0 : withTiming(0, { duration: M.duration.quick, easing: Easing.bezier(...M.easing.out) });
    const timer = setTimeout(() => {
      setEntering(false);
      setSettledKey((key) => key + 1);
    }, M.duration.enter + M.staggerMax * M.stagger);
    return () => {
      clearTimeout(timer);
      dockScroll.value = 0;
    };
  }, [M, dockTarget, reduceMotion]));

  const handleScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      if (!focused) return;
      const maxY = Math.max(0, event.contentSize.height - event.layoutMeasurement.height);
      const y = Math.max(0, Math.min(event.contentOffset.y, maxY));
      const delta = y - lastY.value;
      lastY.value = y;
      scrollY.set(y);
      const target = reduceMotion || y <= M.distance.headerCollapse ? 0 : delta > 0 ? 1 : delta < 0 ? 0 : dockTarget.value;
      if (target !== dockTarget.value) {
        dockTarget.set(target);
        dockScroll.value = reduceMotion ? 0 : withTiming(target, { duration: M.duration.quick, easing: Easing.bezier(...(target ? M.easing.in : M.easing.out)) });
      }
      const compact = y > M.distance.headerCollapse;
      if (compact !== wasCompact.value) {
        wasCompact.value = compact;
        runOnJS(setCompactVisible)(compact);
      }
    },
  });

  const compactStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [M.distance.headerCollapse - M.distance.rise / 2, M.distance.headerCollapse + M.distance.rise], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [M.distance.headerCollapse - M.distance.rise / 2, M.distance.headerCollapse + M.distance.rise], [-M.distance.rise, 0], Extrapolation.CLAMP) }],
  }));
  const largeTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, M.distance.headerCollapse], [1, 0.18], Extrapolation.CLAMP),
  }));

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const headerBlock = (
    <Animated.View style={[{ gap: 6 }, largeTitleStyle]}>
      <View style={styles.headerTop}>
        {back ? (
          <GlassPressable accessibilityRole="button" accessibilityLabel={backLabel} onPress={goBack} hitSlop={4} scaleTo={0.92} style={[styles.iconButton, { width: theme.layout.minTarget, height: theme.layout.minTarget, borderRadius: theme.radius.pill, backgroundColor: theme.glass.inner, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.glass.divider }]}>
            <Feather name="arrow-left" size={18} color={theme.colors.textPrimary} />
          </GlassPressable>
        ) : null}
        <View style={{ flex: 1, gap: 4 }}>
          {overline ? <Text style={[theme.typography.overline, { color: theme.colors.textMuted }]}>{cleanDisplayText(overline)}</Text> : null}
          <Text accessibilityRole="header" style={[theme.typography.display, { color: theme.colors.textPrimary, fontSize: fontScale >= 1.3 ? 24 : 28, lineHeight: fontScale >= 1.3 ? 30 : 34 }]}>
            {cleanDisplayText(title)}
          </Text>
        </View>
        {actions ? <View style={styles.actions}>{actions}</View> : null}
      </View>
      {/* Below the row, at full width: a status pill that changes label ("Actual" / "Actualizando") must not re-wrap it. */}
      {subtitle ? <Text style={[theme.typography.body, { color: theme.colors.textSecondary, marginLeft: back ? theme.layout.minTarget + 12 : 0 }]}>{cleanDisplayText(subtitle)}</Text> : null}
    </Animated.View>
  );

  const contentPaddingTop = (desktop ? 32 : 16) + insets.top;
  const bottomPadding = theme.layout.dockHeight + insets.bottom + (bar ? 92 : 24);

  const staggeredHeader = stagger ? <StaggerItem index={0} enterKey={enterKey}>{headerBlock}</StaggerItem> : headerBlock;
  const staggeredChildren = stagger ? staggerChildren(children, enterKey, 1) : children;

  return (
    <ScreenEnteringContext.Provider value={focused && entering}>
    <GlassScrollContext.Provider value={glassScroll}>
    <SafeAreaView edges={['left', 'right']} style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <AmbientBackground animated={ambientAnimated} />
      <View style={[styles.flex, desktop ? styles.desktopRow : null]}>
        {desktop ? <NavigationRail /> : null}
        <KeyboardAvoidingView style={styles.flex} behavior="padding" enabled={Platform.OS === 'ios'}>
          <View style={styles.flex}>
            {scrollable ? (
              <Animated.ScrollView
                style={[styles.flex, contentStyle]}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                contentContainerStyle={[
                  {
                    paddingTop: contentPaddingTop,
                    paddingBottom: bottomPadding,
                    paddingHorizontal: desktop ? 40 : 20,
                    width: '100%',
                    maxWidth: 1440,
                    alignSelf: 'center',
                    gap: 22,
                  },
                  contentContainerStyle,
                ]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
                refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accent} colors={[theme.colors.accent]} /> : undefined}
              >
                {staggeredHeader}
                {staggeredChildren}
              </Animated.ScrollView>
            ) : (
              <View style={[styles.flex, { paddingTop: contentPaddingTop, paddingBottom: bottomPadding, paddingHorizontal: desktop ? 40 : 20, width: '100%', maxWidth: 1440, alignSelf: 'center' }]}>
                {staggeredHeader}
                <Animated.ScrollView onScroll={handleScroll} scrollEventThrottle={16} contentContainerStyle={{ gap: 22, paddingTop: 18 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {staggeredChildren}
                </Animated.ScrollView>
              </View>
            )}

            <StatusFade height={insets.top + 30} color={theme.ambient.base} />
            <StatusFade from="bottom" height={theme.layout.dockHeight + insets.bottom + 24} color={theme.ambient.base} />
            <Animated.View pointerEvents="box-none" style={[styles.compactBarWrap, { paddingTop: insets.top + 6 }, compactStyle]}>
              {compactVisible ? (
                <GlassSurface chrome level="regular" padding="none" radius="md" contentStyle={styles.compactBar}>
                  {back ? (
                    <GlassPressable accessibilityRole="button" accessibilityLabel={backLabel} onPress={goBack} hitSlop={4} scaleTo={0.92} style={[styles.iconButton, { width: theme.layout.minTarget, height: theme.layout.minTarget, borderRadius: theme.radius.pill }]}>
                      <Feather name="arrow-left" size={18} color={theme.colors.textPrimary} />
                    </GlassPressable>
                  ) : null}
                  <Text accessibilityRole="header" numberOfLines={1} style={[theme.typography.headline, { color: theme.colors.textPrimary, flex: 1, fontSize: 16 }]}>{cleanDisplayText(title)}</Text>
                  {actions ? <View style={styles.actions}>{actions}</View> : null}
                </GlassSurface>
              ) : null}
            </Animated.View>

            {bar ? (
              <View onLayout={(event) => setBarHeight(event.nativeEvent.layout.height)} style={[styles.actionBar, { bottom: theme.layout.dockHeight, borderTopColor: theme.glass.divider, paddingBottom: Math.max(insets.bottom, 10), backgroundColor: theme.glass.chromeStrong }]}>
                {bar}
              </View>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
    </GlassScrollContext.Provider>
    </ScreenEnteringContext.Provider>
  );
}

/** @deprecated Kept for the migration; use Screen. */
export const AppScreen = Screen;
/** @deprecated Kept for the migration; use Screen. */
export const AppShell = Screen;
/** @deprecated Use Screen. */
export const TopBar = Screen;
/** @deprecated Use Screen. */
export const ScreenHeader = Screen;

export function Section({
  title,
  subtitle,
  count,
  actionLabel,
  onActionPress,
  action,
  collapsible = false,
  defaultOpen = true,
  children,
}: {
  title?: string;
  subtitle?: string;
  count?: number;
  actionLabel?: string;
  onActionPress?: () => void;
  action?: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(defaultOpen);

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {title && !collapsible ? (
        <View style={styles.sectionHeader}>
          <View style={{ flex: 1, gap: 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[theme.typography.headline, { color: theme.colors.textPrimary, fontSize: 16 }]}>{cleanDisplayText(title)}</Text>
              {typeof count === 'number' ? (
                <Tag label={String(count)} tone="neutral" kind="status" />
              ) : null}
            </View>
            {subtitle ? <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{cleanDisplayText(subtitle)}</Text> : null}
          </View>
          {action ?? (actionLabel ? (
            <GlassPressable accessibilityRole="button" accessibilityLabel={actionLabel} onPress={onActionPress} hitSlop={8} scaleTo={0.94} style={styles.sectionAction}>
              <Text style={[theme.typography.caption, { color: theme.colors.accentStrong }]}>{cleanDisplayText(actionLabel)}</Text>
              <Feather name="chevron-right" size={14} color={theme.colors.accentStrong} />
            </GlassPressable>
          ) : null)}
        </View>
      ) : null}
      {collapsible && title ? (
        <GlassPressable accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={title} onPress={() => setOpen((value) => !value)} scaleTo={0.99} style={styles.collapseRow}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>{cleanDisplayText(title)}</Text>
            {subtitle ? <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{cleanDisplayText(subtitle)}</Text> : null}
          </View>
          <Feather name={open ? 'chevron-up' : 'chevron-down'} size={17} color={theme.colors.textMuted} />
        </GlassPressable>
      ) : null}
      {(open || !collapsible) ? <View style={{ gap: theme.spacing.sm }}>{children}</View> : null}
    </View>
  );
}

/** @deprecated Use Section. */
export const SectionHeader = Section;
/** @deprecated Use Section. */
export const SectionTitle = Section;
/** @deprecated Use Section. */
export const DetailBlock = Section;
/** @deprecated Use Section's collapsible prop. */
export const DisclosureSection = Section;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  desktopRow: { flexDirection: 'row' },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  compactBarWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
  },
  compactBar: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 6,
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionAction: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  collapseRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
});
