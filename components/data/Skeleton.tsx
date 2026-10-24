import { ReactNode, createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DimensionValue, StyleProp, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeOut,
  ReduceMotion,
  SharedValue,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/lib/app-state';
import { useReduceMotion } from '@/lib/hooks';

type SweepState = {
  /** The sweep's position (0 = off the left edge, 1 = off the right) for every block of one group. */
  progress: SharedValue<number>;
  /** Whether each block draws its own sweep; a crowded group pulses as a whole instead. */
  sweeping: boolean;
  /** Blocks announce themselves on mount, so the group can tell how crowded it is. */
  register: () => void;
};

/** Null (outside a group, or with reduced motion) holds every block still. */
const SweepContext = createContext<SweepState | null>(null);

/**
 * Past this many blocks, one animated sweep per block costs more frame time than the screen can spare (each is its
 * own animated view redrawn every frame over glass surfaces), so the group breathes with a single opacity pulse.
 */
const MAX_SWEPT_BLOCKS = 12;
const PULSE_DEPTH = 0.4;

const SWEEP_MS = 1300;
const SWEEP_REST_MS = 450;
const BAND = 0.6;

/**
 * One loading placeholder as a whole: a single shared value drives every block inside it, so the highlight
 * sweeps them in step with one UI-thread animation and no timers. Reduced motion leaves the blocks still.
 * Screen readers get one "Cargando" element instead of every block.
 */
export function SkeletonGroup({
  children,
  label = 'Cargando',
  style,
  containerStyle,
}: {
  children: ReactNode;
  label?: string;
  style?: StyleProp<ViewStyle>;
  /** Style of the outer view, for a placeholder that must fill its parent (flex: 1). */
  containerStyle?: StyleProp<ViewStyle>;
}) {
  const { motion: M } = useTheme();
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(0);
  const blockCount = useRef(0);
  const [crowded, setCrowded] = useState(false);
  const register = useCallback(() => { blockCount.current += 1; }, []);

  useEffect(() => {
    cancelAnimation(progress);
    progress.value = 0;
    if (reduceMotion) return;
    // The rest at the end keeps the sweep from reading as a constant flicker; the reset is invisible (band off-screen).
    progress.value = withRepeat(
      withSequence(
        withTiming(1, { duration: SWEEP_MS, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: SWEEP_REST_MS }),
        withTiming(0, { duration: 0 }),
      ),
      -1,
    );
    return () => cancelAnimation(progress);
  }, [progress, reduceMotion]);

  // Children's mount effects run before this one, so the count is complete by now.
  useEffect(() => {
    if (blockCount.current > MAX_SWEPT_BLOCKS) setCrowded(true);
  }, []);

  const pulse = useAnimatedStyle(() => ({ opacity: crowded ? 1 - PULSE_DEPTH * Math.sin(progress.value * Math.PI) : 1 }), [crowded]);
  const sweepState = useMemo<SweepState | null>(() => (reduceMotion ? null : { progress, sweeping: !crowded, register }), [crowded, progress, reduceMotion, register]);

  return (
    <SweepContext.Provider value={sweepState}>
      <Animated.View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        accessibilityState={{ busy: true }}
        style={containerStyle}
        // Fades out instead of vanishing, so the content rising in behind it never meets an empty screen.
        exiting={FadeOut.duration(reduceMotion ? M.duration.reduced : M.duration.quick).reduceMotion(ReduceMotion.Never)}
      >
        <Animated.View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[style, pulse]}>
          {children}
        </Animated.View>
      </Animated.View>
    </SweepContext.Provider>
  );
}

/** A rounded placeholder. Outside a SkeletonGroup it is simply still. */
export function SkeletonBlock({
  width = '100%',
  height = 16,
  radius,
  style,
}: {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const sweep = useContext(SweepContext);
  const register = sweep?.register;
  useEffect(() => register?.(), [register]);
  return (
    <View
      style={[
        { width, height, borderRadius: radius ?? theme.radius.sm, backgroundColor: theme.glass.divider, overflow: 'hidden' },
        style,
      ]}
    >
      {sweep?.sweeping ? <Sweep progress={sweep.progress} /> : null}
    </View>
  );
}

function Sweep({ progress }: { progress: SharedValue<number> }) {
  const theme = useTheme();
  const highlight = theme.glass.fill.strong[0];
  const style = useAnimatedStyle(() => ({
    // Percentages are of the band itself: from just outside the left edge to just outside the right.
    transform: [{ translateX: `${-100 + progress.value * (100 + 100 / BAND)}%` }, { skewX: '-16deg' }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', top: 0, bottom: 0, left: 0, width: `${BAND * 100}%`, experimental_backgroundImage: `linear-gradient(90deg, transparent, ${highlight}, transparent)` },
        style,
      ]}
    />
  );
}

/**
 * A line of text. `lineHeight` is the real text style's, so the line reserves the same height as the text it
 * stands for; the bar drawn inside is a little shorter than that.
 */
export function SkeletonLine({
  width = '100%',
  lineHeight = 16,
  style,
}: {
  width?: DimensionValue;
  lineHeight?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const bar = Math.max(6, Math.round(lineHeight * 0.58));
  return (
    <View style={[{ width, height: lineHeight, justifyContent: 'center' }, style]}>
      <SkeletonBlock height={bar} radius={bar / 2} />
    </View>
  );
}

export function SkeletonCircle({ size, style }: { size: number; style?: StyleProp<ViewStyle> }) {
  return <SkeletonBlock width={size} height={size} radius={size / 2} style={style} />;
}
