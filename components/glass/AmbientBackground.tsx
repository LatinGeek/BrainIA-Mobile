import { useEffect } from 'react';
import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useAmbientField } from '@/components/glass/GlassBackdrop';
import { useTheme } from '@/lib/app-state';
import { useReduceMotion } from '@/lib/hooks';

/**
 * One ambient light field per screen, behind the scroll view. The field is rendered once by
 * Skia as a cached image (the same scene the glass surfaces blur), so mounting a screen draws
 * one bitmap instead of re-recording five radial gradients, a mask and two ring strokes through
 * SVG on the UI thread. It drifts only on Today, and settles after one slow pass.
 */
export function AmbientBackground({ animated = false }: { animated?: boolean }) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const { width, height } = useWindowDimensions();
  const field = useAmbientField(theme.ambient, width, height);
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
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: theme.ambient.base }]}>
      {field ? <Image source={{ uri: field }} resizeMode="stretch" fadeDuration={0} style={StyleSheet.absoluteFill} /> : null}
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
