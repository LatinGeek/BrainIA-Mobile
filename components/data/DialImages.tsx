import { useEffect, useState } from 'react';
import { PixelRatio } from 'react-native';
import { BlurMask, Circle, Group, ImageFormat, LinearGradient, Path, Skia, drawAsImage, vec } from '@shopify/react-native-skia';

/**
 * The spending dial, drawn once by Skia into cached images (rings and ticks, the arcs, and one
 * selected-arc overlay per split). The dial is then plain image views that animate by opacity and
 * scale only: rasterising SVG (CPU, at full size) when an overlay first appeared stalled the
 * selection animation for several frames.
 *
 * Skia renders these elements with its own reconciler: no React context in here, props only.
 */

// The 240 x 240 box the prototype draws in.
export const DIAL = { R: 92, W: 18, GAP: 7, TICKS: 60, C: 120, BOX: 240 } as const;
export const DIAL_CIRC = 2 * Math.PI * DIAL.R;
const TICK_RADIUS = DIAL.R + DIAL.W / 2 + 11;

export type DialArc = {
  id: string;
  color: string;
  cap: 'round' | 'butt'; // thin slices get slim butt-capped bars so each keeps its own readable slot
  dash: number; // visible dash length along the circle (round caps add W)
  startAt: number; // distance along the circle, from 3 o'clock, where the dash starts
  selDash: number; // dash length of the selected capsule (always round-capped)
  s0: number;
  s1: number;
};

/** Mix two #rrggbb colours (t = share of `other`). Anything else is returned unchanged. */
export function mixHex(color: string, other: string, t: number) {
  const parse = (value: string) => (/^#[0-9a-f]{6}$/i.test(value) ? [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16)) : null);
  const a = parse(color);
  const b = parse(other);
  if (!a || !b) return color;
  const channel = (i: number) => Math.round(a[i] + (b[i] - a[i]) * t).toString(16).padStart(2, '0');
  return `#${channel(0)}${channel(1)}${channel(2)}`;
}

const ticks = Array.from({ length: DIAL.TICKS }, (_, k) => {
  const f = k / DIAL.TICKS;
  const angle = f * 2 * Math.PI;
  return { k, f, cx: DIAL.C + TICK_RADIUS * Math.sin(angle), cy: DIAL.C - TICK_RADIUS * Math.cos(angle) };
});

/** An arc along the dial ring. Angles are measured clockwise from 3 o'clock, like the SVG dash start. */
function arcPath(arc: DialArc) {
  const path = Skia.Path.Make();
  path.addArc(Skia.XYWHRect(DIAL.C - DIAL.R, DIAL.C - DIAL.R, DIAL.R * 2, DIAL.R * 2), (arc.startAt / DIAL_CIRC) * 360, (arc.dash / DIAL_CIRC) * 360);
  return path;
}

/** The selected capsule, centred at 12 o'clock (the dial turns the image to the split's own angle). */
function capsulePath(arc: DialArc) {
  const path = Skia.Path.Make();
  const sweep = (arc.selDash / DIAL_CIRC) * 360;
  path.addArc(Skia.XYWHRect(DIAL.C - DIAL.R, DIAL.C - DIAL.R, DIAL.R * 2, DIAL.R * 2), 270 - sweep / 2, sweep);
  return path;
}
function Gradient({ color }: { color: string }) {
  return <LinearGradient start={vec(28, 20)} end={vec(212, 220)} colors={[mixHex(color, '#FFFFFF', 0.4), color, mixHex(color, '#000000', 0.28)]} positions={[0, 0.5, 1]} />;
}

function RingScene({ scale }: { scale: number }) {
  return (
    <Group transform={[{ scale }]}>
      {ticks.map((tick) => (
        <Circle key={tick.k} cx={tick.cx} cy={tick.cy} r={1.25} color="rgba(255,255,255,0.17)" />
      ))}
      <Circle cx={DIAL.C} cy={DIAL.C} r={DIAL.R} style="stroke" strokeWidth={DIAL.W} color="rgba(255,255,255,0.045)" />
      <Circle cx={DIAL.C} cy={DIAL.C} r={DIAL.R - DIAL.W / 2 - 5} style="stroke" strokeWidth={1} color="rgba(255,255,255,0.09)" />
    </Group>
  );
}

function ArcsScene({ arcs, scale }: { arcs: DialArc[]; scale: number }) {
  return (
    <Group transform={[{ scale }]}>
      {arcs.map((arc) => (
        <Path key={arc.id} path={arcPath(arc)} style="stroke" strokeWidth={DIAL.W} strokeCap={arc.cap}>
          <Gradient color={arc.color} />
        </Path>
      ))}
    </Group>
  );
}

/**
 * The selected split: a round capsule with a soft halo, its ticks lit, and a pin that points out of the
 * tick ring. It is drawn centred at 12 o'clock and the dial turns the image to the split's own angle, which
 * lets the highlight glide around the ring from one split to the next. A thin slice becomes a magnified
 * capsule, so even a 1% split can be seen and read.
 */
function OverlayScene({ arc, scale }: { arc: DialArc; scale: number }) {
  const mid = (arc.s0 + arc.s1) / 2;
  // Ticks lit under the split; a split narrower than a tick still lights the tick nearest to it.
  const half = Math.max((arc.s1 - arc.s0) / 2, 0.012);
  const lit = ticks
    .map((tick) => {
      let offset = tick.f - mid;
      if (offset > 0.5) offset -= 1;
      if (offset < -0.5) offset += 1;
      return { k: tick.k, offset };
    })
    .filter((tick) => Math.abs(tick.offset) <= half)
    .map((tick) => {
      const angle = tick.offset * 2 * Math.PI;
      return { k: tick.k, cx: DIAL.C + TICK_RADIUS * Math.sin(angle), cy: DIAL.C - TICK_RADIUS * Math.cos(angle) };
    });
  const pinFrom = DIAL.R + DIAL.W / 2 + 5;
  const pinTo = DIAL.R + DIAL.W / 2 + 14;
  const pin = Skia.Path.Make();
  pin.moveTo(DIAL.C, DIAL.C - pinFrom);
  pin.lineTo(DIAL.C, DIAL.C - pinTo);
  return (
    <Group transform={[{ scale }]}>
      {lit.map((tick) => (
        <Circle key={tick.k} cx={tick.cx} cy={tick.cy} r={2.1} color={arc.color} />
      ))}
      <Path path={capsulePath(arc)} style="stroke" strokeWidth={DIAL.W + 8} strokeCap="round" color={arc.color} opacity={0.5}>
        <BlurMask blur={9} style="normal" />
      </Path>
      <Path path={capsulePath(arc)} style="stroke" strokeWidth={DIAL.W + 6} strokeCap="round">
        <Gradient color={arc.color} />
      </Path>
      <Path path={pin} style="stroke" strokeWidth={2.2} strokeCap="round" color={arc.color} />
      <Circle cx={DIAL.C} cy={DIAL.C - pinTo - 3} r={2.8} color={arc.color} />
    </Group>
  );
}
const cache = new Map<string, string>();
// One render at a time keeps the GPU and JS work off the critical path when a screen mounts.
let queue: Promise<unknown> = Promise.resolve();

function render(key: string, scene: (scale: number) => React.ReactElement, pixels: number): Promise<string | null> {
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  const job = queue.then(async () => {
    const scale = pixels / DIAL.BOX;
    const image = await drawAsImage(scene(scale), { width: pixels, height: pixels });
    if (!image) return null;
    const uri = `data:image/png;base64,${image.encodeToBase64(ImageFormat.PNG, 100)}`;
    cache.set(key, uri);
    return uri;
  });
  queue = job.catch(() => null);
  return job;
}

export type DialImageSet = { rings: string | null; arcs: string | null; overlays: Record<string, string | null> };

/**
 * Cached dial images for a set of arcs, or nulls until each is ready: first the rings, then the arcs,
 * then one overlay per split, so the dial appears quickly and selection is instant afterwards.
 */
export function useDialImages(arcs: DialArc[], size: number): DialImageSet {
  const pixels = Math.round(size * Math.min(PixelRatio.get(), 3));
  const signature = arcs.map((arc) => [arc.id, arc.color, arc.cap, arc.dash.toFixed(1), arc.startAt.toFixed(1), arc.selDash.toFixed(1), arc.s0.toFixed(3), arc.s1.toFixed(3)].join(':')).join('|');
  const ringsKey = `rings|${pixels}`;
  const arcsKey = `arcs|${pixels}|${signature}`;
  const overlayKey = (arc: DialArc) => `overlay|${pixels}|${[arc.id, arc.color, arc.cap, arc.dash.toFixed(1), arc.startAt.toFixed(1), arc.selDash.toFixed(1), arc.s0.toFixed(3), arc.s1.toFixed(3)].join(':')}`;

  const [, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    const bump = () => {
      if (alive) setTick((value) => value + 1);
    };
    void render(ringsKey, (scale) => <RingScene scale={scale} />, pixels).then(bump).catch(() => undefined);
    void render(arcsKey, (scale) => <ArcsScene arcs={arcs} scale={scale} />, pixels).then(bump).catch(() => undefined);
    arcs.forEach((arc) => {
      void render(overlayKey(arc), (scale) => <OverlayScene arc={arc} scale={scale} />, pixels).then(bump).catch(() => undefined);
    });
    return () => {
      alive = false;
    };
    // The keys capture every input that changes an image.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ringsKey, arcsKey, signature, pixels]);

  const overlays: Record<string, string | null> = {};
  arcs.forEach((arc) => {
    overlays[arc.id] = cache.get(overlayKey(arc)) ?? null;
  });
  return { rings: cache.get(ringsKey) ?? null, arcs: cache.get(arcsKey) ?? null, overlays };
}
