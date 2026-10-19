import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ReactNode, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  ScrollViewProps,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmbientBackground } from '@/components/glass/AmbientBackground';
import { GlassPressable } from '@/components/glass/GlassPressable';
import { Tag } from '@/components/controls';
import { NavigationRail } from '@/components/layout/NavigationRail';
import { useTheme } from '@/lib/app-state';
import { cleanDisplayText } from '@/lib/format';
import { dockScroll } from '@/lib/dock-scroll';

const DOCK_HEIGHT = 68;

export function Screen({
  title,
  subtitle,
  overline,
  back = false,
  backLabel = 'Back',
  actions,
  children,
  scrollable = true,
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
  refreshing?: boolean;
  onRefresh?: () => void;
  bar?: ReactNode;
  ambientAnimated?: boolean;
  contentStyle?: ScrollViewProps['style'];
  contentContainerStyle?: ScrollViewProps['contentContainerStyle'];
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const desktop = width >= 1024;
  const scrollY = useSharedValue(0);
  const [compactVisible, setCompactVisible] = useState(false);

  const handleScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
      dockScroll.value = interpolate(event.contentOffset.y, [0, 48, 120], [0, 0, 1], Extrapolation.CLAMP);
      runOnJS(setCompactVisible)(event.contentOffset.y > 64);
    },
  });

  const compactStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [56, 84], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [56, 84], [-10, 0], Extrapolation.CLAMP) }],
  }));
  const largeTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 72], [1, 0.18], Extrapolation.CLAMP),
  }));

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const headerBlock = (
    <Animated.View style={[{ gap: 6 }, largeTitleStyle]}>
      <View style={styles.headerTop}>
        <View style={{ flex: 1, gap: 4 }}>
          {overline ? <Text style={[theme.typography.overline, { color: theme.colors.textMuted }]}>{cleanDisplayText(overline)}</Text> : null}
          <Text accessibilityRole="header" style={[theme.typography.display, { color: theme.colors.textPrimary, fontSize: fontScale >= 1.3 ? 24 : 28, lineHeight: fontScale >= 1.3 ? 30 : 34 }]}>
            {cleanDisplayText(title)}
          </Text>
          {subtitle ? <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>{cleanDisplayText(subtitle)}</Text> : null}
        </View>
        {actions ? <View style={styles.actions}>{actions}</View> : null}
      </View>
    </Animated.View>
  );

  const contentPaddingTop = desktop ? 32 : 16;
  const bottomPadding = DOCK_HEIGHT + insets.bottom + (bar ? 92 : 24);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.flex, { backgroundColor: theme.colors.background }]}>
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
                {headerBlock}
                {children}
              </Animated.ScrollView>
            ) : (
              <View style={[styles.flex, { paddingTop: contentPaddingTop, paddingBottom: bottomPadding, paddingHorizontal: desktop ? 40 : 20, width: '100%', maxWidth: 1440, alignSelf: 'center' }]}>
                {headerBlock}
                <ScrollView contentContainerStyle={{ gap: 22, paddingTop: 18 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {children}
                </ScrollView>
              </View>
            )}

            <Animated.View pointerEvents="box-none" style={[styles.compactBarWrap, compactStyle]}>
              {compactVisible ? (
                <View style={[styles.compactBar, { borderColor: theme.glass.edge[0], backgroundColor: `${theme.ambient.base}BD` }]}>
                  {back ? (
                    <GlassPressable accessibilityRole="button" accessibilityLabel={backLabel} onPress={goBack} hitSlop={10} scaleTo={0.92} style={styles.iconButton}>
                      <Feather name="arrow-left" size={18} color={theme.colors.textPrimary} />
                    </GlassPressable>
                  ) : null}
                  <Text numberOfLines={1} style={[theme.typography.headline, { color: theme.colors.textPrimary, flex: 1, fontSize: 16 }]}>{cleanDisplayText(title)}</Text>
                  {actions}
                </View>
              ) : null}
            </Animated.View>

            {bar ? (
              <View style={[styles.actionBar, { borderTopColor: theme.glass.divider, paddingBottom: Math.max(insets.bottom, 10), backgroundColor: `${theme.ambient.base}DB` }]}>
                {bar}
              </View>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
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
    paddingTop: 6,
  },
  compactBar: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: DOCK_HEIGHT,
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
    minHeight: 32,
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
