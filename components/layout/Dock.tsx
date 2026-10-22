import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withTiming, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassPressable } from '@/components/glass/GlassPressable';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { useBrainIAClient, useTheme } from '@/lib/app-state';
import { dockScroll } from '@/lib/dock-scroll';
import { useReduceMotion } from '@/lib/hooks';
import { reducedFade } from '@/lib/motion';

type DockTab = {
  key: string;
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
};

const tabs: DockTab[] = [
  { key: 'index', label: 'Hoy', icon: 'home' },
  { key: 'search', label: 'Explorar', icon: 'search' },
  { key: 'capture', label: 'Capturar', icon: 'plus' },
  { key: 'financials', label: 'Dinero', icon: 'credit-card' },
  { key: 'review', label: 'Revisar', icon: 'shield' },
];

/**
 * Custom expo-router tab bar: floating glass, gliding selection pill, centre
 * capture action, review badge, and a scale-down while the screen scrolls down.
 */
export function Dock({
  state,
  navigation,
}: {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate: (name: string) => void; emit: (event: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean } };
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const client = useBrainIAClient();
  const { width } = useWindowDimensions();
  const [reviewCount, setReviewCount] = useState(0);
  const [barWidth, setBarWidth] = useState(0);
  const reduceMotion = useReduceMotion();
  const pillOpacity = useSharedValue(1);
  const pillX = useSharedValue(0);
  const activeRoute = state.routes[state.index]?.name ?? 'index';
  const visibleTabs = tabs;
  const activeVisibleIndex = Math.max(0, visibleTabs.findIndex((tab) => tab.key === activeRoute));
  const compactDock = width >= 1024;

  useEffect(() => {
    let active = true;
    void client.listReviews('pending')
      .then((items) => { if (active) setReviewCount(items.length); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [client]);

  useEffect(() => {
    if (!barWidth || !visibleTabs.length) return;
    const cell = (barWidth - 12) / visibleTabs.length;
    const target = 6 + activeVisibleIndex * cell;
    pillX.value = reduceMotion ? target : withSpring(target, theme.motion.spring.thumb);
    pillOpacity.value = reduceMotion ? 0 : 1;
    if (reduceMotion) pillOpacity.value = withTiming(1, reducedFade);
  }, [reduceMotion, pillOpacity, activeVisibleIndex, barWidth, pillX, theme.motion.spring.thumb, visibleTabs.length]);

  const pillStyle = useAnimatedStyle(() => ({ opacity: pillOpacity.value, transform: [{ translateX: pillX.value }] }));
  const minScale = theme.layout.dockMinScale;
  const dockStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(dockScroll.value, [0, 1], [1, minScale]) },
      { translateY: interpolate(dockScroll.value, [0, 1], [0, 4]) },
    ],
  }));
  // Opacity and transform only: animating height relayouts every tab per frame.
  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(dockScroll.value, [0, 0.6], [1, 0]),
  }));
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(dockScroll.value, [0, 1], [0, 7]) }] }));

  if (compactDock) return null;

  return (
    <View pointerEvents="box-none" style={[styles.host, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <Animated.View style={[styles.dockWrap, dockStyle]}>
        <GlassSurface level="strong" chrome padding="none" radius="xl" style={styles.dock}>
          <View style={[styles.dockInner, { height: theme.layout.dockHeight }]} onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}>
            {visibleTabs.length ? (
              <Animated.View pointerEvents="none" style={[styles.pill, { width: (barWidth - 12) / visibleTabs.length, backgroundColor: theme.glass.selected }, pillStyle]} />
            ) : null}
            {visibleTabs.map((tab) => {
              const selected = tab.key === activeRoute;
              const route = state.routes.find((candidate) => candidate.name === tab.key);
              const isCapture = tab.key === 'capture';
              return (
                <GlassPressable
                  key={tab.key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  accessibilityLabel={isCapture ? 'Capturar' : tab.label}
                  haptic="selection"
                  scaleTo={0.9}
                  onPress={() => {
                    if (tab.key === 'capture') {
                      router.push('/capture');
                      return;
                    }
                    if (!route) return;
                    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                    if (!event.defaultPrevented) navigation.navigate(tab.key);
                  }}
                  hitSlop={theme.layout.minTarget * (1 / minScale - 1) / 2}
                  style={[styles.tab, { minWidth: theme.layout.minTarget, minHeight: theme.layout.minTarget }]}
                >
                  {isCapture ? (
                    <View style={[styles.captureButton, { backgroundColor: theme.colors.accent }]}>
                      <Feather name="plus" size={22} color={theme.colors.onAccent} />
                    </View>
                  ) : (
                    <>
                      <Animated.View style={iconStyle}>
                        <Feather name={tab.icon} size={19} color={selected ? theme.glass.onSelected : theme.colors.textMuted} />
                        {tab.key === 'review' && reviewCount ? (
                          <View style={[styles.badge, { backgroundColor: theme.colors.accent, borderColor: theme.colors.background }]}>
                            <Text style={[theme.typography.caption, { color: theme.colors.onAccent, fontSize: 9, lineHeight: 11 }]}>{reviewCount > 9 ? '9+' : reviewCount}</Text>
                          </View>
                        ) : null}
                      </Animated.View>
                      <Animated.View style={labelStyle}>
                        <Text numberOfLines={1} style={[theme.typography.caption, { color: selected ? theme.glass.onSelected : theme.colors.textMuted, fontSize: 9, textAlign: 'center' }]}>{tab.label}</Text>
                      </Animated.View>
                    </>
                  )}
                </GlassPressable>
              );
            })}
          </View>
        </GlassSurface>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  dockWrap: {
    width: '100%',
    maxWidth: 520,
  },
  dock: {
    width: '100%',
  },
  dockInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  pill: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    borderRadius: 999,
  },
  tab: {
    flex: 1,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  captureButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -9,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
