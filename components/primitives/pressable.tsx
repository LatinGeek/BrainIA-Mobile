import * as Haptics from 'expo-haptics';
import { ReactNode } from 'react';
import { Platform, Pressable as NativePressable, PressableProps } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/lib/app-state';
import { useReduceMotion } from '@/lib/hooks';

const AnimatedPressableRoot = Animated.createAnimatedComponent(NativePressable);

export type PressHaptic = 'selection' | 'light' | 'success' | 'warning';

function playHaptic(kind: PressHaptic) {
  if (Platform.OS === 'web') return;
  if (kind === 'selection') void Haptics.selectionAsync();
  else if (kind === 'light') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  else void Haptics.notificationAsync(kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
}

/**
 * Pressable with a spring press scale. Use `scaleTo={0.94}` for compact
 * controls and the default 0.98 for rows and cards. Reduce Motion keeps the
 * opacity dip and drops the scale.
 */
export function Pressable({
  children,
  style,
  onPressIn,
  onPressOut,
  onPress,
  disabled,
  scaleTo = 0.98,
  haptic,
  ...props
}: PressableProps & {
  children: ReactNode;
  scaleTo?: number;
  haptic?: PressHaptic;
}) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(0);
  const target = reduceMotion ? 1 : scaleTo;
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - progress.value * (1 - target) }],
    opacity: disabled ? 0.5 : 1 - progress.value * 0.1,
  }));

  return (
    <AnimatedPressableRoot
      {...props}
      disabled={disabled}
      onPressIn={(event) => {
        progress.value = withTiming(1, { duration: theme.motion.duration.press });
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        progress.value = withSpring(0, theme.motion.springs.press);
        onPressOut?.(event);
      }}
      onPress={(event) => {
        if (haptic) playHaptic(haptic);
        onPress?.(event);
      }}
      style={[animatedStyle, style as object]}
    >
      {children}
    </AnimatedPressableRoot>
  );
}
