import { Feather } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, TextInput, TextInputProps, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeOutUp,
  SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { DIAL, DIAL_CIRC, DialArc, useDialImages } from '@/components/data/DialImages';
import { useCountedAmount } from '@/components/data/Row';
import { GlassPressable } from '@/components/glass/GlassPressable';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { useTheme } from '@/lib/app-state';
import { cleanDisplayText, formatCurrency } from '@/lib/format';
import { useReduceMotion } from '@/lib/hooks';

export type MixSegment = {
  id: string;
  label: string;
  value: number;
  displayValue?: number;
  color?: string;
};

/**
 * SpendingRadial, as in the prototype: round-capped gradient arcs from 12 o'clock with even gaps,
 * an outer tick ring that lights the selected share, a glass disc in the middle and legend rows
 * with share bars. Selecting a split widens its arc with a spring and a glow, dims the others,
 * lights its ticks, counts the centre figure to the new value and bumps the disc.
 *
 * The dial itself is three kinds of cached Skia image (rings and ticks, arcs, one overlay per
 * split), so every animation here is view opacity and scale: nothing re-rasterises while it moves.
 */
const { R, W, GAP, C } = DIAL;
const CIRC = DIAL_CIRC;
const MIN_SHARE = 0.01; // thinnest drawn slice, as a share of the ring
const THIN_GAP = 2.4; // gap between a thin bar and its neighbours
const THIN_EXTRA = 4; // a slice shorter than a capsule plus this becomes a bar

function percent(value: number, total: number) {
  if (total <= 0) return '0%';
  const share = (value / total) * 100;
  return `${share >= 10 ? share.toFixed(0) : share.toFixed(1).replace('.', ',')}%`;
}

type Arc = MixSegment & DialArc & { index: number };

export function MixCard({
  overline,
  title,
  action,
  note,
  segments,
  centerValue,
  centerAmount,
  currency,
  centerLabel,
  delta,
  formatValue = (value) => String(Math.round(value)),
  selectedId,
  onSelect,
  emptyLabel = 'Sin gasto',
  percentageNoun = 'del gasto',
}: {
  overline?: string;
  title: string;
  action?: React.ReactNode;
  note?: string;
  segments: MixSegment[];
  centerValue: string;
  centerAmount?: number;
  currency?: string;
  centerLabel?: string;
  delta?: { text: string; tone?: 'good' | 'bad' | 'neutral' };
  formatValue?: (value: number) => string;
  selectedId?: string | null;
  onSelect?: (segment: MixSegment | null) => void;
  emptyLabel?: string;
  percentageNoun?: string;
}) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const { width, fontScale } = useWindowDimensions();
  const [internalSelected, setInternalSelected] = useState<string | null>(null);
  const activeId = selectedId === undefined ? internalSelected : selectedId;

  const source = useMemo(
    () => (segments.some((segment) => segment.value > 0) ? segments.filter((segment) => segment.value > 0) : [{ id: 'empty', label: emptyLabel, value: 1, color: theme.glass.solid.strong }]),
    [emptyLabel, segments, theme.glass.solid.strong],
  );
  const total = source.reduce((sum, segment) => sum + Math.max(0, segment.value), 0) || 1;
  const maxValue = Math.max(...source.map((segment) => segment.value), 1);
  const active = source.find((segment) => segment.id === activeId);
  const anySelected = Boolean(active);
  const introKey = source.map((segment) => segment.id).join('|');

  const amountTarget = active ? active.displayValue ?? active.value : centerAmount ?? 0;
  const amountLabel = active ? formatValue(amountTarget) : cleanDisplayText(centerValue);
  const size = Math.round(Math.min(268, Math.max(204, width - (fontScale >= 1.3 ? 76 : 92))));
  const discSize = size * 0.61;

  // Drawn layout only: every slice keeps its own slot (nothing is merged). A slice too thin for a
  // round-capped capsule becomes a slim bar of its exact width, floored at 1% of the ring so it stays
  // visible, and the shares are renormalised. The legend and the centre keep the true values.
  const arcs: Arc[] = (() => {
    const floored = source.map((segment) => (segment.value > 0 ? Math.max(segment.value / total, MIN_SHARE) : 0));
    const flooredTotal = floored.reduce((sum, share) => sum + share, 0) || 1;
    const shares = floored.map((share) => share / flooredTotal);
    return source.map((segment, index) => {
      const s0 = shares.slice(0, index).reduce((sum, share) => sum + share, 0);
      const s1 = s0 + shares[index];
      const length = shares[index] * CIRC;
      const thin = length < GAP + W + THIN_EXTRA;
      return {
        ...segment,
        index,
        color: segment.color ?? theme.colors.chart[index % theme.colors.chart.length],
        cap: thin ? ('butt' as const) : ('round' as const),
        dash: thin ? Math.max(length - THIN_GAP, 1.2) : Math.max(length - GAP - W, 0.1),
        startAt: thin ? ((0.75 + s0) * CIRC + THIN_GAP / 2) % CIRC : ((0.75 + s0) * CIRC + GAP / 2 + W / 2) % CIRC,
        selDash: Math.max(length - GAP - W, 0.1),
        s0,
        s1,
      };
    });
  })();
  const activeArc = arcs.find((arc) => arc.id === activeId);
  const images = useDialImages(arcs, size);

  // Remember which arc was selected before, so its overlay can fade out while the new one comes in.
  const [tracked, setTracked] = useState<{ id: string | null; arc: Arc | null }>({ id: activeId ?? null, arc: activeArc ?? null });
  const [leaving, setLeaving] = useState<Arc | null>(null);
  if ((activeId ?? null) !== tracked.id) {
    setLeaving(tracked.arc);
    setTracked({ id: activeId ?? null, arc: activeArc ?? null });
  }

  const select = (segment: MixSegment | null) => {
    setInternalSelected(segment?.id ?? null);
    onSelect?.(segment);
  };

  // The highlight's angle (in turns, from 12 o'clock). Switching splits glides it around the ring by
  // the shortest way on a spring; a first selection sweeps in from a little before its own angle.
  const activeMid = activeArc ? (activeArc.s0 + activeArc.s1) / 2 : null;
  const travel = useSharedValue(activeMid ?? 0);
  useEffect(() => {
    if (activeMid === null) return;
    if (reduceMotion) {
      travel.set(activeMid);
      return;
    }
    const current = travel.get();
    const delta = ((((activeMid - current) % 1) + 1.5) % 1) - 0.5; // shortest way round, in (-0.5, 0.5]
    const wasIdle = !leaving;
    const from = wasIdle ? activeMid - 0.07 : current;
    travel.set(from);
    travel.set(withSpring(wasIdle ? activeMid : current + delta, { damping: 17, stiffness: 120, mass: 1 }));
    // `leaving` is the split that was selected before this change (null when nothing was).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMid, reduceMotion, travel]);

  // A tap on the ring picks the split under the finger (the arcs are images, so this is angle maths).
  const onDialPress = (x: number, y: number) => {
    const k = DIAL.BOX / size;
    const dx = x * k - C;
    const dy = y * k - C;
    if (Math.abs(Math.hypot(dx, dy) - R) > W / 2 + 6) {
      if (active) select(null);
      return;
    }
    let turn = Math.atan2(dx, -dy) / (2 * Math.PI);
    if (turn < 0) turn += 1;
    const arc = arcs.find((candidate) => turn >= candidate.s0 && turn < candidate.s1) ?? arcs[arcs.length - 1];
    select(active?.id === arc.id ? null : arc);
  };

  // The disc bumps on every change of selection (not on first paint).
  const bump = useSharedValue(1);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (reduceMotion) return;
    bump.set(withSequence(withTiming(0.95, { duration: 140 }), withSpring(1, theme.motion.spring.thumb)));
  }, [activeId, bump, reduceMotion, theme.motion.spring.thumb]);
  const bumpStyle = useAnimatedStyle(() => ({ transform: [{ scale: bump.value }] }));

  const sharePill = active ? percent(active.value, total) : null;

  return (
    <GlassSurface level="regular" padding="lg" contentStyle={{ gap: 18 }}>
      <View style={styles.between}>
        <View style={{ flex: 1, gap: 2 }}>
          {overline ? <Text style={[theme.typography.overline, { color: theme.colors.textMuted }]}>{cleanDisplayText(overline)}</Text> : null}
          <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>{cleanDisplayText(title)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          {action}
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{`${source.length} ${source.length === 1 ? 'grupo' : 'grupos'}`}</Text>
        </View>
      </View>

      <View style={{ alignItems: 'center' }}>
        <View
          accessibilityRole="image"
          accessibilityLabel={`${title}: ${amountLabel}, repartido en ${source.length} ${source.length === 1 ? 'grupo' : 'grupos'}`}
          style={{ width: size, height: size }}
        >
          {images.rings ? <Image source={{ uri: images.rings }} fadeDuration={0} style={StyleSheet.absoluteFill} /> : null}
          <ArcsLayer uri={images.arcs} anySelected={anySelected} introKey={introKey} reduceMotion={reduceMotion} />
          {/* Overlay images are decoded ahead of the first tap (drawn at near-zero opacity), so selecting never waits on a decode. */}
          {arcs.map((arc) => (images.overlays[arc.id] && arc.id !== activeId && arc.id !== leaving?.id ? <Image key={`warm-${arc.id}`} source={{ uri: images.overlays[arc.id] as string }} fadeDuration={0} style={[StyleSheet.absoluteFill, { opacity: 0.01 }]} /> : null))}
          {leaving && leaving.id !== activeArc?.id ? <SelectedOverlay key={`leave-${leaving.id}`} uri={images.overlays[leaving.id] ?? null} visible={false} reduceMotion={reduceMotion} travel={null} fixedTurn={(leaving.s0 + leaving.s1) / 2} /> : null}
          {activeArc ? <SelectedOverlay key={`on-${activeArc.id}`} uri={images.overlays[activeArc.id] ?? null} visible reduceMotion={reduceMotion} travel={travel} /> : null}

          <Pressable
            accessibilityElementsHidden
            importantForAccessibility="no"
            onPress={(event) => onDialPress(event.nativeEvent.locationX, event.nativeEvent.locationY)}
            style={StyleSheet.absoluteFill}
          />

          <Animated.View style={[styles.center, bumpStyle]} pointerEvents="box-none">
            <Pressable
              accessibilityRole={active ? 'button' : undefined}
              accessibilityLabel={active ? `Quitar la selección de ${active.label}` : undefined}
              disabled={!active}
              onPress={() => select(null)}
              style={[styles.disc, { width: discSize, height: discSize, borderRadius: discSize / 2, borderColor: 'rgba(255,255,255,0.09)', experimental_backgroundImage: 'radial-gradient(circle at 50% 22%, rgba(255,255,255,0.14), rgba(255,255,255,0.025) 68%)' }]}
            >
              <Animated.Text key={activeId ?? 'total'} entering={reduceMotion ? undefined : FadeInDown.duration(260)} exiting={reduceMotion ? undefined : FadeOutUp.duration(140)} numberOfLines={1} style={[styles.discLabel, { color: active ? activeArc?.color ?? theme.colors.accent : theme.colors.textMuted, maxWidth: discSize - 24 }]}>
                {cleanDisplayText(active ? active.label : centerLabel ?? 'Total')}
              </Animated.Text>
              <CenterAmount target={amountTarget} animate={centerAmount !== undefined} hasActive={Boolean(active)} centerValue={centerValue} currency={currency} formatValue={formatValue} amountLabel={amountLabel} maxWidth={discSize - 20} fontSize={width < 360 ? 20 : 24} lineHeight={width < 360 ? 25 : 29} reduceMotion={reduceMotion} />
              {sharePill ? (
                <Animated.View key={`pill-${activeId}`} entering={reduceMotion ? undefined : FadeInDown.delay(80).duration(280)} style={[styles.pill, { backgroundColor: theme.glass.selected }]}>
                  <Text style={[styles.pillText, { color: theme.glass.onSelected, fontFamily: theme.typography.mono.fontFamily }]}>{`${sharePill} ${percentageNoun}`}</Text>
                </Animated.View>
              ) : delta ? (
                <Animated.View key="pill-total" entering={reduceMotion ? undefined : FadeInDown.delay(80).duration(280)} style={[styles.pill, { backgroundColor: delta.tone === 'good' ? `${theme.status.income}1A` : 'rgba(255,255,255,0.08)' }]}>
                  <Text style={[styles.pillText, { color: delta.tone === 'bad' ? theme.status.expense : delta.tone === 'good' ? theme.status.income : theme.colors.textSecondary }]}>{cleanDisplayText(delta.text)}</Text>
                </Animated.View>
              ) : null}
            </Pressable>
          </Animated.View>
        </View>
      </View>

      <View style={{ gap: 2, marginHorizontal: -8 }}>
        {arcs.map((arc) => (
          <MixRow
            key={arc.id}
            arc={arc}
            selected={arc.id === activeId}
            anySelected={anySelected}
            introKey={introKey}
            barShare={arc.value / maxValue}
            percentLabel={percent(arc.value, total)}
            valueLabel={formatValue(arc.displayValue ?? arc.value)}
            accessibilityLabel={`${arc.label}, ${formatValue(arc.displayValue ?? arc.value)}, ${percent(arc.value, total)} ${percentageNoun}`}
            reduceMotion={reduceMotion}
            onPress={() => select(arc.id === activeId ? null : arc)}
          />
        ))}
      </View>

      {note ? (
        <View style={[styles.note, { backgroundColor: theme.glass.inner, borderColor: theme.glass.divider }]}>
          <Feather name="zap" size={15} color={theme.colors.accent} style={{ marginTop: 1 }} />
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, flex: 1, lineHeight: 18 }]}>{cleanDisplayText(note)}</Text>
        </View>
      ) : null}
    </GlassSurface>
  );
}

/**
 * The centre figure counts to its new value like the prototype's; on web a plain Text with a JS count-up is used.
 */
const COUNT_STEPS = 24;
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

type CenterAmountProps = {
  target: number;
  animate: boolean;
  hasActive: boolean;
  centerValue: string;
  currency?: string;
  formatValue: (value: number) => string;
  amountLabel: string;
  maxWidth: number;
  fontSize: number;
  lineHeight: number;
  reduceMotion: boolean;
};

function CenterAmount(props: CenterAmountProps) {
  return Platform.OS === 'web' ? <CenterAmountWeb {...props} /> : <CenterAmountNative {...props} />;
}

function CenterAmountWeb({ target, animate, hasActive, centerValue, currency, formatValue, amountLabel, maxWidth, fontSize, lineHeight }: CenterAmountProps) {
  const theme = useTheme();
  const counted = useCountedAmount(target, animate);
  const text = !animate ? amountLabel : hasActive ? formatValue(counted) : `${centerValue.startsWith('≈ ') ? '≈ ' : ''}${currency ? formatCurrency(counted, currency) : formatValue(counted)}`;
  return (
    <Text accessibilityLabel={amountLabel} numberOfLines={1} style={[theme.typography.numeral, { color: theme.colors.textPrimary, fontSize, lineHeight, textAlign: 'center', maxWidth }]}>
      {text}
    </Text>
  );
}

function CenterAmountNative({ target, animate, hasActive, centerValue, currency, formatValue, amountLabel, maxWidth, fontSize, lineHeight, reduceMotion }: CenterAmountProps) {
  const theme = useTheme();
  // Prototype behaviour: the figure counts from the old value to the new one over ~650 ms. The in-between
  // numbers are formatted once and an animated TextInput shows the frame for the current progress, so the
  // count costs no React render or layout per frame.
  const [pair, setPair] = useState({ from: target, to: target });
  if (pair.to !== target) setPair({ from: pair.to, to: target });

  const frames = useMemo(() => {
    const format = (value: number) => (!animate ? amountLabel : hasActive ? formatValue(value) : `${centerValue.startsWith('≈ ') ? '≈ ' : ''}${currency ? formatCurrency(value, currency) : formatValue(value)}`);
    return Array.from({ length: COUNT_STEPS }, (_, i) => {
      const x = i / (COUNT_STEPS - 1);
      const eased = 1 - (1 - x) * (1 - x) * (1 - x);
      return format(pair.from + (pair.to - pair.from) * eased);
    });
    // formatValue is a fresh closure every render; the values it reads are the real inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pair.from, pair.to, animate, hasActive, centerValue, currency, amountLabel]);

  const index = useSharedValue(COUNT_STEPS - 1);
  useEffect(() => {
    if (!animate || reduceMotion) {
      index.set(COUNT_STEPS - 1);
      return;
    }
    index.set(0);
    index.set(withTiming(COUNT_STEPS - 1, { duration: 650, easing: Easing.linear }));
  }, [animate, index, pair.from, pair.to, reduceMotion]);

  const animatedProps = useAnimatedProps(() => {
    const i = Math.min(COUNT_STEPS - 1, Math.max(0, Math.round(index.value)));
    // Reanimated writes `text` straight to the native input (not part of TextInputProps).
    return { text: frames[i] } as unknown as TextInputProps;
  }, [frames]);

  // A TextInput cannot auto-fit, so long figures shrink to the disc up front.
  const longest = frames.reduce((n, text) => Math.max(n, text.length), 1);
  const fitted = Math.max(fontSize * 0.62, Math.min(fontSize, (maxWidth / longest) * 1.75));

  return (
    <AnimatedTextInput
      accessibilityLabel={amountLabel}
      editable={false}
      pointerEvents="none"
      defaultValue={frames[COUNT_STEPS - 1]}
      animatedProps={animatedProps}
      style={[theme.typography.numeral, { color: theme.colors.textPrimary, fontSize: fitted, lineHeight, height: lineHeight, width: maxWidth, textAlign: 'center', padding: 0, margin: 0, includeFontPadding: false }]}
    />
  );
}
/** The arcs, as one image. The ring settles in on first show (and when the groups change) and recedes while a split is selected. */
function ArcsLayer({ uri, anySelected, introKey, reduceMotion }: { uri: string | null; anySelected: boolean; introKey: string; reduceMotion: boolean }) {
  const theme = useTheme();
  const dim = useSharedValue(anySelected ? 0.22 : 1);
  const intro = useSharedValue(reduceMotion ? 1 : 0);
  const ready = Boolean(uri);

  useEffect(() => {
    dim.set(reduceMotion ? (anySelected ? 0.22 : 1) : withTiming(anySelected ? 0.22 : 1, { duration: 300 }));
  }, [anySelected, dim, reduceMotion]);

  // Starts when the image is ready, so the intro is never missed while Skia is still drawing.
  useEffect(() => {
    if (reduceMotion || !ready) {
      intro.set(reduceMotion ? 1 : 0);
      return;
    }
    intro.set(0);
    intro.set(withDelay(60, withTiming(1, { duration: 1000, easing: Easing.bezier(...theme.motion.easing.out) })));
  }, [intro, introKey, ready, reduceMotion, theme.motion.easing.out]);

  const style = useAnimatedStyle(() => ({
    opacity: dim.value * Math.min(1, intro.value * 2),
    transform: [{ rotate: `${(1 - intro.value) * -40}deg` }, { scale: 0.94 + 0.06 * intro.value }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      {uri ? <Image source={{ uri }} fadeDuration={0} style={StyleSheet.absoluteFill} /> : null}
    </Animated.View>
  );
}

/** The selected arc: wider, with a soft halo and its share of the tick ring lit. It fades and springs in or out. */
function SelectedOverlay({ uri, visible, reduceMotion, travel, fixedTurn = 0 }: { uri: string | null; visible: boolean; reduceMotion: boolean; travel: SharedValue<number> | null; fixedTurn?: number }) {
  const theme = useTheme();
  const ready = Boolean(uri);
  const progress = useSharedValue(visible ? 0 : 1);

  useEffect(() => {
    // The spring waits for the image, so the capsule never pops in without animating.
    if (visible && !ready) return;
    if (reduceMotion) {
      progress.set(visible ? 1 : 0);
      return;
    }
    progress.set(visible ? withSpring(1, { damping: 15, stiffness: 150, mass: 1 }) : withTiming(0, { duration: 340, easing: Easing.bezier(...theme.motion.easing.in) }));
  }, [visible, ready, progress, reduceMotion, theme.motion.easing.in]);

  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, progress.value * 1.4),
    // The image is drawn centred at 12 o'clock. The incoming overlay turns with the shared angle; the
    // outgoing one stays where it was and fades there, so it never sweeps across the ring.
    transform: [{ rotate: `${(travel ? travel.value : fixedTurn) * 360}deg` }, { scale: 0.96 + 0.04 * progress.value }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      {uri ? <Image source={{ uri }} fadeDuration={0} style={StyleSheet.absoluteFill} /> : null}
    </Animated.View>
  );
}

function MixRow({
  arc,
  selected,
  anySelected,
  introKey,
  barShare,
  percentLabel,
  valueLabel,
  accessibilityLabel,
  reduceMotion,
  onPress,
}: {
  arc: Arc;
  selected: boolean;
  anySelected: boolean;
  introKey: string;
  barShare: number;
  percentLabel: string;
  valueLabel: string;
  accessibilityLabel: string;
  reduceMotion: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const dim = useSharedValue(anySelected && !selected ? 0.45 : 1);
  const bar = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    dim.set(reduceMotion ? (anySelected && !selected ? 0.45 : 1) : withTiming(anySelected && !selected ? 0.45 : 1, { duration: 300 }));
  }, [anySelected, dim, reduceMotion, selected]);

  useEffect(() => {
    if (reduceMotion) {
      bar.set(1);
      return;
    }
    bar.set(0);
    bar.set(withDelay(arc.index * 70 + 320, withTiming(1, { duration: 900, easing: Easing.bezier(...theme.motion.easing.out) })));
  }, [arc.index, bar, introKey, reduceMotion, theme.motion.easing.out]);

  const rowStyle = useAnimatedStyle(() => ({ opacity: dim.value }));
  const barStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: bar.value }] }));

  return (
    <GlassPressable accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={accessibilityLabel} haptic="selection" scaleTo={0.98} onPress={onPress}>
      <Animated.View
        style={[
          styles.row,
          rowStyle,
          selected ? { backgroundColor: theme.glass.inner, borderColor: 'rgba(255,255,255,0.07)' } : { borderColor: 'transparent' },
        ]}
      >
        <View style={styles.swatchWrap}>
          <View style={[styles.swatchHalo, { backgroundColor: arc.color }]} />
          <View style={[styles.swatch, { backgroundColor: arc.color }]} />
        </View>
        <View style={{ flex: 1, gap: 7, minWidth: 0 }}>
          <Text numberOfLines={1} style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary, fontSize: 13.5, lineHeight: 15 }]}>{cleanDisplayText(arc.label)}</Text>
          <View style={[styles.barTrack, { backgroundColor: 'rgba(255,255,255,0.07)' }]}>
            <Animated.View style={[styles.barFill, { width: `${Math.max(2, barShare * 100)}%`, backgroundColor: arc.color, transformOrigin: 'left center' }, barStyle]} />
          </View>
        </View>
        <Text style={[styles.pct, { color: selected ? theme.colors.textPrimary : theme.colors.textMuted, fontFamily: theme.typography.mono.fontFamily }]}>{percentLabel}</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit style={[theme.typography.bodyStrong, styles.value, { color: theme.colors.textPrimary }]}>{valueLabel}</Text>
      </Animated.View>
    </GlassPressable>
  );
}

const styles = StyleSheet.create({
  between: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  center: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disc: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1,
    paddingHorizontal: 10,
  },
  discLabel: {
    fontSize: 9.5,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    textAlign: 'center',
    fontWeight: '600',
  },
  pill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    minHeight: 20,
    borderRadius: 99,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  row: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  swatchWrap: {
    width: 6,
    height: 26,
    justifyContent: 'center',
  },
  swatch: {
    width: 6,
    height: 26,
    borderRadius: 3,
  },
  swatchHalo: {
    position: 'absolute',
    left: -3,
    width: 12,
    height: 26,
    borderRadius: 6,
    opacity: 0.18,
  },
  barTrack: {
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: 3,
    borderRadius: 2,
  },
  pct: {
    width: 40,
    textAlign: 'right',
    fontSize: 11,
    fontWeight: '600',
  },
  value: {
    width: 92,
    textAlign: 'right',
    fontSize: 13.5,
    fontVariant: ['tabular-nums'],
  },
  note: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
