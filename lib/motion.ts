import { Easing, LinearTransition, ReduceMotion, withSpring, withTiming } from 'react-native-reanimated';
import type { WithSpringConfig } from 'react-native-reanimated';

import { brainiaTheme } from './themes';

const M = brainiaTheme.motion;

/** Explicitly keep the replacement opacity fade when the OS disables motion. */
export const reducedFade = {
  duration: M.duration.reduced,
  easing: Easing.bezier(...M.easing.out),
  reduceMotion: ReduceMotion.Never,
};

/** For opacity-like values only; positional springs must jump and fade separately. */
export function springOrFade(reduce: boolean, toValue: number, springConfig: WithSpringConfig) {
  'worklet';
  return reduce ? withTiming(toValue, reducedFade) : withSpring(toValue, springConfig);
}

export const listLayout = LinearTransition.springify()
  .damping(M.spring.thumb.damping)
  .stiffness(M.spring.thumb.stiffness)
  .mass(M.spring.thumb.mass);
