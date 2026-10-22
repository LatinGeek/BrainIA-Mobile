import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop, Mask, Rect } from 'react-native-svg';

import { useTheme } from '@/lib/app-state';
import { useReduceMotion } from '@/lib/hooks';

/**
 * One ambient light field per screen, behind the scroll view. It renders once
 * and only drifts on Today while that screen is focused.
 */
export function AmbientBackground({ animated = false }: { animated?: boolean }) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const drift = useSharedValue(0);

  useEffect(() => {
    if (!animated || reduceMotion) {
      drift.value = 0;
      return;
    }
    // One slow settle instead of an endless loop: an infinite animation keeps the GPU rendering at full refresh rate while the screen is idle.
    drift.value = withTiming(1, { duration: 18_000, easing: Easing.inOut(Easing.quad) });
  }, [animated, drift, reduceMotion]);

  const orbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: drift.value * 18 },
      { translateY: drift.value * 10 },
      { scale: 1 + drift.value * 0.08 },
    ],
  }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="ambient-orb-1" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={theme.ambient.orbs[0]} stopOpacity="0.55" />
            <Stop offset="0.55" stopColor={theme.ambient.orbs[0]} stopOpacity="0.18" />
            <Stop offset="1" stopColor={theme.ambient.orbs[0]} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="ambient-orb-2" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={theme.ambient.orbs[1]} stopOpacity="0.6" />
            <Stop offset="0.6" stopColor={theme.ambient.orbs[1]} stopOpacity="0.18" />
            <Stop offset="1" stopColor={theme.ambient.orbs[1]} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="ambient-orb-3" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={theme.ambient.orbs[2]} stopOpacity="0.24" />
            <Stop offset="1" stopColor={theme.ambient.orbs[2]} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="ambient-orb-4" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={theme.ambient.orbs[2]} stopOpacity="0.14" />
            <Stop offset="1" stopColor={theme.ambient.orbs[2]} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="ambient-orb-5" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={theme.ambient.orbs[0]} stopOpacity="0.3" />
            <Stop offset="1" stopColor={theme.ambient.orbs[0]} stopOpacity="0" />
          </RadialGradient>
          <Mask id="ambient-ring-mask">
            <Rect width="100%" height="100%" fill="black" />
            <Rect x="0" y="0" width="100%" height="62%" fill="white" />
          </Mask>
        </Defs>
        <Rect width="100%" height="100%" fill={theme.ambient.base} />
        <Circle cx="12%" cy="4%" r="240" fill="url(#ambient-orb-1)" />
        <Circle cx="92%" cy="32%" r="210" fill="url(#ambient-orb-2)" />
        <Circle cx="46%" cy="96%" r="200" fill="url(#ambient-orb-3)" />
        <Circle cx="90%" cy="62%" r="170" fill="url(#ambient-orb-4)" />
        <Circle cx="4%" cy="46%" r="170" fill="url(#ambient-orb-5)" />
        <Circle cx="106%" cy="-8%" r="190" stroke={theme.ambient.ring} strokeOpacity="0.18" strokeWidth="18" fill="none" mask="url(#ambient-ring-mask)" />
        <Circle cx="-14%" cy="74%" r="150" stroke={theme.ambient.ring} strokeOpacity="0.1" strokeWidth="14" fill="none" />
      </Svg>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            left: -80,
            top: -90,
            width: 300,
            height: 300,
            borderRadius: 150,
            backgroundColor: theme.ambient.orbs[0],
            opacity: 0.16,
          },
          orbStyle,
        ]}
      />
    </View>
  );
}
