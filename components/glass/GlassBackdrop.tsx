import { File, Paths } from 'expo-file-system';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Blur, Circle, Fill, Group, ImageFormat, Paint, RadialGradient, drawAsImage, rect, vec } from '@shopify/react-native-skia';

/**
 * Android glass backdrop. The native blur view adds per-pixel static (about 7/255), and a
 * Skia canvas behind the screen cannot stay in step with scrolling content (it renders on
 * its own thread). So Skia renders the blurred ambient light once, as a screen-sized image,
 * and each glass surface shows that image through its own bounds (like a fixed-attachment
 * background), sliding it against the card with the scroll offset. The card's edges, text
 * and backdrop image are all ordinary views, so nothing runs on a second render thread.
 *
 * Skia renders these elements with its own reconciler: no React context in here, props only.
 */

// Half resolution: it is a blurred backdrop, so the detail is lost anyway.
const SCALE = 0.5;
// The unblurred field keeps its thin ring strokes, so it gets more pixels.
const FIELD_SCALE = 0.75;

export type AmbientColors = { base: string; orbs: readonly string[]; ring: string };

function withAlpha(hex: string, alpha: number) {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** The screen's ambient light field (mirrors AmbientBackground), static. */
function AmbientShapes({ colors, width, height }: { colors: AmbientColors; width: number; height: number }) {
  const { base, orbs, ring } = colors;
  const orb = (cx: number, cy: number, r: number, color: string, peak: number, mid?: number) => (
    <Circle cx={cx} cy={cy} r={r}>
      <RadialGradient
        c={vec(cx, cy)}
        r={r}
        colors={mid === undefined ? [withAlpha(color, peak), withAlpha(color, 0)] : [withAlpha(color, peak), withAlpha(color, mid), withAlpha(color, 0)]}
        positions={mid === undefined ? [0, 1] : [0, 0.55, 1]}
      />
    </Circle>
  );
  return (
    <>
      <Fill color={base} />
      {orb(width * 0.12, height * 0.04, 240, orbs[0], 0.55, 0.18)}
      <Circle cx={70} cy={60} r={150} color={withAlpha(orbs[0], 0.16)} />
      {orb(width * 0.92, height * 0.32, 210, orbs[1], 0.6, 0.18)}
      {orb(width * 0.46, height * 0.96, 200, orbs[2], 0.24)}
      {orb(width * 0.9, height * 0.62, 170, orbs[2], 0.14)}
      {orb(width * 0.04, height * 0.46, 170, orbs[0], 0.3)}
      <Group clip={rect(0, 0, width, height * 0.62)}>
        <Circle cx={width * 1.06} cy={-height * 0.08} r={190} style="stroke" strokeWidth={18} color={withAlpha(ring, 0.18)} />
      </Group>
      <Circle cx={-width * 0.14} cy={height * 0.74} r={150} style="stroke" strokeWidth={14} color={withAlpha(ring, 0.1)} />
    </>
  );
}

function AmbientBlurred({ blur, colors, width, height, scale }: { blur: number; colors: AmbientColors; width: number; height: number; scale: number }) {
  if (blur <= 0) {
    return (
      <Group transform={[{ scale }]}>
        <AmbientShapes colors={colors} width={width} height={height} />
      </Group>
    );
  }
  return (
    <Group transform={[{ scale }]}>
      <Group layer={<Paint><Blur blur={blur} mode="clamp" /></Paint>}>
        <AmbientShapes colors={colors} width={width} height={height} />
      </Group>
    </Group>
  );
}

/**
 * Bump this whenever the drawing changes (AmbientShapes, the blur mode, the scale): the images are kept as files
 * and reused across launches and app updates, so an old file would otherwise be served for the new drawing.
 */
const BACKDROP_VERSION = 2;

function keyOf(blur: number, colors: AmbientColors, width: number, height: number) {
  return [BACKDROP_VERSION, blur, blur <= 0 ? FIELD_SCALE : SCALE, Math.round(width), Math.round(height), colors.base, colors.orbs.join(','), colors.ring].join('|');
}

const cache = new Map<string, string>();

/** The blur levels glass surfaces use (thin, regular, strong), plus 0 for the unblurred field. */
export const AMBIENT_BLURS = [8, 12, 18] as const;

function hashKey(value: string) {
  let h = 5381;
  for (let i = 0; i < value.length; i++) h = ((h * 33) ^ value.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/**
 * Images live in the app cache folder as PNG files, named after their inputs. A screen switch, or a
 * relaunch, finds them there and shows them straight away: nothing is re-rendered or re-decoded from a
 * base64 string. They are only rendered the first time a theme, size or blur has no file yet.
 */
function fromDisk(key: string): string | undefined {
  const hit = cache.get(key);
  if (hit) return hit;
  if (Platform.OS === 'web') return undefined;
  try {
    const file = new File(Paths.cache, `ambient-${hashKey(key)}.png`);
    if (file.exists) {
      cache.set(key, file.uri);
      return file.uri;
    }
  } catch {
    // An unreadable cache folder only means the image is rendered again.
  }
  return undefined;
}
// One render at a time keeps the GPU work off the critical path when a screen mounts.
let queue: Promise<unknown> = Promise.resolve();

function render(blur: number, colors: AmbientColors, width: number, height: number): Promise<string | null> {
  const key = keyOf(blur, colors, width, height);
  const hit = fromDisk(key);
  if (hit) return Promise.resolve(hit);

  const job = queue.then(async () => {
    const scale = blur <= 0 ? FIELD_SCALE : SCALE;
    const image = await drawAsImage(<AmbientBlurred blur={blur} colors={colors} width={width} height={height} scale={scale} />, {
      width: Math.max(1, Math.ceil(width * scale)),
      height: Math.max(1, Math.ceil(height * scale)),
    });
    if (!image) return null;
    let uri: string;
    if (Platform.OS === 'web') {
      uri = `data:image/png;base64,${image.encodeToBase64(ImageFormat.PNG, 100)}`;
    } else {
      const file = new File(Paths.cache, `ambient-${hashKey(key)}.png`);
      file.create({ overwrite: true });
      file.write(image.encodeToBytes(ImageFormat.PNG, 100));
      uri = file.uri;
    }
    cache.set(key, uri);
    return uri;
  });
  queue = job.catch(() => null);
  return job;
}

/**
 * A screen-sized image of the ambient light, blurred, or null until it is ready. Shared by
 * every glass surface at the same blur level, so a screen costs a couple of small images.
 */
function useRenderedAmbient(blur: number, enabled: boolean, colors: AmbientColors, width: number, height: number): string | null {
  const key = keyOf(blur, colors, width, height);
  const [loaded, setLoaded] = useState<{ key: string; uri: string } | null>(() => {
    const hit = fromDisk(key);
    return hit ? { key, uri: hit } : null;
  });

  useEffect(() => {
    if (!enabled || fromDisk(key)) return;
    let alive = true;
    render(blur, colors, width, height)
      .then((uri) => {
        if (alive && uri) setLoaded({ key, uri });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
    // The key captures every input that changes the image.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  if (!enabled) return null;
  return fromDisk(key) ?? (loaded?.key === key ? loaded.uri : null);
}

export function useAmbientBackdrop(blur: number, colors: AmbientColors, width: number, height: number): string | null {
  return useRenderedAmbient(blur, blur > 0, colors, width, height);
}

/** The unblurred ambient field as one cached image: new screens draw a bitmap instead of re-recording an SVG scene. */
export function useAmbientField(colors: AmbientColors, width: number, height: number): string | null {
  return useRenderedAmbient(0, true, colors, width, height);
}

/**
 * Renders (or finds on disk) every backdrop image the app uses, one at a time, so the first screen already has them.
 * Resolves when all are ready.
 */
export async function warmAmbientBackdrops(colors: AmbientColors, width: number, height: number) {
  for (const blur of [0, ...AMBIENT_BLURS]) {
    try {
      await render(blur, colors, width, height);
    } catch {
      // A failed warm-up just means that surface renders it on demand.
    }
  }
}
