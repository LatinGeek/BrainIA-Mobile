import { ReactNode } from 'react';
import { Pressable as NativePressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/lib/app-state';
import { useReduceMotion } from '@/lib/hooks';
import { reducedFade, springOrFade } from '@/lib/motion';

const AnimatedNativePressable = Animated.createAnimatedComponent(NativePressable);

export type GlassPressableProps = Omit<PressableProps, 'style'> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Compact controls use 0.94; rows and cards use 0.98. */
  scaleTo?: number;
  haptic?: 'light' | 'selection' | 'none';
};

export function GlassPressable({
  children,
  style,
  scaleTo = 0.98,
  haptic = 'none',
  disabled,
  onPressIn,
  onPressOut,
  onPress,
  ...props
}: GlassPressableProps) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const pressed = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: reduceMotion ? 1 : 1 - pressed.value * (1 - scaleTo) }],
    opacity: disabled ? 0.55 : 1 - pressed.value * 0.06,
  }));

  return (
    <AnimatedNativePressable
      {...props}
      disabled={disabled}
      accessibilityState={{ disabled: Boolean(disabled), ...props.accessibilityState }}
      onPressIn={(event) => {
        pressed.value = withTiming(1, reduceMotion ? reducedFade : { duration: theme.motion.duration.press });
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        pressed.value = springOrFade(reduceMotion, 0, theme.motion.spring.press);
        onPressOut?.(event);
      }}
      onPress={(event) => {
        if (haptic === 'selection') void Haptics.selectionAsync();
        else if (haptic === 'light') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.(event);
      }}
      style={[animatedStyle, style]}
    >
      {children}
    </AnimatedNativePressable>
  );
}
