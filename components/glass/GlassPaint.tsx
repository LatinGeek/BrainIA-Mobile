import { useId } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { GlassLevel, ThemeTokens } from '@/lib/themes';

/**
 * What makes a surface read as glass rather than as a tinted rectangle: a bright rim that catches
 * the light along the top and fades round to the bottom-right, a bevel just inside it that gives
 * the pane thickness, light spilling onto the pane under the top edge, and a shade where the glass
 * is thickest at the bottom.
 *
 * Android draws this with its own gradient views (an SVG scene per card was measurable on the UI
 * thread there); everything else draws one SVG scene. Both follow the same layers and the same
 * numbers, so the material is the same on both paths.
 */

const CLEAR = 'rgba(255,255,255,0)';

type PaintProps = {
  width: number;
  height: number;
  radius: number;
  level: GlassLevel;
  fill: readonly [string, string];
  light: ThemeTokens['glass']['light'];
  /** Floating plates (dock, sheet, toast) keep their own dense body and only take the rim. */
  rimOnly?: boolean;
  /** A surface that asked for no outline keeps the body but drops the rim, streaks and corner light. */
  edges?: boolean;
};

/** How bright the rim reads per thickness, so a thin row does not compete with a hero card. */
function rimStrength(level: GlassLevel) {
  return level === 'thin' ? 0.5 : 1;
}

function stopOf(value: string) {
  const match = value.match(/^rgba?\(([^)]+)\)$/i);
  if (!match) return { color: value, opacity: 1 };
  const [r, g, b, a] = match[1].split(',').map((part) => Number(part.trim()));
  return { color: `rgb(${r},${g},${b})`, opacity: Number.isFinite(a) ? a : 1 };
}

function withOpacity(value: string, alpha: number) {
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const digits = hex[1];
    const r = parseInt(digits.slice(0, 2), 16);
    const g = parseInt(digits.slice(2, 4), 16);
    const b = parseInt(digits.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  const { color, opacity } = stopOf(value);
  const match = color.match(/^rgb\((\d+),(\d+),(\d+)\)$/);
  if (!match) return value;
  return `rgba(${match[1]},${match[2]},${match[3]},${opacity * alpha})`;
}

export function GlassPaint({ width, height, radius, level, fill, light, rimOnly = false, edges = true }: PaintProps) {
  const strength = rimStrength(level);
  // The bright streaks stop short of the corners, where the rim itself is brightest.
  const streak = Math.max(10, radius * 0.7);
  const hot = Math.max(26, radius * 2.3);
  const android = Platform.OS === 'android';
  // A radial gradient in a background image is sized to its box's farthest corner, so a light drawn
  // in a square of its own would still be ~30% strong at the square's edges and read as a lit
  // rectangle. Each corner light gets a square of twice its radius and stops well before the edge,
  // which puts the falloff where the SVG path puts it: a soft R-pixel bloom, nothing beyond.
  const cornerSpan = hot * 2;
  const cornerStop = `${((100 * hot) / (Math.SQRT2 * cornerSpan)).toFixed(2)}%`;
  // A short surface lit like a tall one turns milky: the same light lands on far less area. Fade
  // the wash with the surface so a tile reads as glass and a hero card still catches the light.
  const lightScale = Math.min(1, height / 130);

  if (android) {
    return (
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {rimOnly ? null : (
          <>
            {/* Body: light enters at the top-left and thins out towards the bottom. */}
            <View style={[StyleSheet.absoluteFill, { experimental_backgroundImage: `linear-gradient(150deg, ${fill[0]} 0%, ${fill[1]} 62%, ${fill[1]} 100%)` }]} />
            {/* Haze pooling under the top edge, as if the light were coming through it. */}
            <View style={[styles.top, { height: Math.min(height * 0.32, 110), opacity: strength, experimental_backgroundImage: `linear-gradient(to bottom, ${light.bloom} 0%, ${CLEAR} 100%)` }]} />
            {/* The pane is thickest at the bottom: shade there, not a line. */}
            <View style={[styles.bottomHalf, { experimental_backgroundImage: `linear-gradient(to bottom, ${withOpacity(light.shade, 0)} 0%, ${light.shade} 100%)` }]} />
          </>
        )}

        {/* The corner the light lands on, and the ones that answer it. */}
        {edges ? (
          <>
            <View style={[styles.topLeft, { width: cornerSpan, height: cornerSpan, opacity: strength, experimental_backgroundImage: `radial-gradient(circle at 0% 0%, rgba(255,255,255,0.26) 0%, rgba(255,255,255,0) ${cornerStop})` }]} />
            <View style={[styles.topRight, { width: cornerSpan, height: cornerSpan, opacity: strength, experimental_backgroundImage: `radial-gradient(circle at 100% 0%, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) ${cornerStop})` }]} />
            <View style={[styles.bottomLeft, { width: cornerSpan, height: cornerSpan, opacity: strength, experimental_backgroundImage: `radial-gradient(circle at 0% 100%, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) ${cornerStop})` }]} />

            {/* Light that came through the top edge, spreading down across the pane. */}
            <View
              style={[styles.top, { height: Math.min(18, height * 0.3), opacity: 0.12 * strength * lightScale, experimental_backgroundImage: `linear-gradient(to bottom, ${light.specular} 0%, ${CLEAR} 100%)` }]}
            />
            {/* The streak where it hits the edge. */}
            <View
              style={[styles.edge, { top: 0.5, height: 1.2, left: streak, right: streak, opacity: strength, experimental_backgroundImage: `linear-gradient(to right, ${CLEAR} 0%, ${light.specular} 42%, ${CLEAR} 100%)` }]}
            />
            {/* Light held inside the two side edges. */}
            <View style={[styles.left, { width: Math.max(18, radius), opacity: strength, experimental_backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0) 100%)' }]} />
            <View style={[styles.right, { width: Math.max(18, radius), opacity: strength, experimental_backgroundImage: 'linear-gradient(to left, rgba(255,255,255,0.028) 0%, rgba(255,255,255,0) 100%)' }]} />
            {/* Light bouncing back off the bottom edge. */}
            <View
              style={[styles.edge, { bottom: 1.5, height: 1, left: streak * 1.4, right: streak * 1.4, opacity: 0.8 * strength, experimental_backgroundImage: `linear-gradient(to right, ${CLEAR} 0%, ${light.bounce} 50%, ${CLEAR} 100%)` }]}
            />
          </>
        ) : null}
      </View>
    );
  }

  return <SvgPaint width={width} height={height} radius={radius} fill={fill} light={light} rimOnly={rimOnly} edges={edges} strength={strength} streak={streak} hot={hot} />;
}

function SvgPaint({
  width,
  height,
  radius,
  fill,
  light,
  rimOnly,
  edges,
  strength,
  streak,
  hot,
}: Required<Omit<PaintProps, 'level'>> & { strength: number; streak: number; hot: number }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const rim = [stopOf(light.edge[0]), stopOf(light.edge[1]), stopOf(light.edge[2])];
  const specular = stopOf(light.specular);
  const bounce = stopOf(light.bounce);
  const shade = stopOf(light.shade);

  return (
    <Svg pointerEvents="none" width="100%" height="100%" style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id={`${id}-body`} x1={0} y1={0} x2={width * 0.55} y2={height} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={stopOf(fill[0]).color} stopOpacity={stopOf(fill[0]).opacity} />
          <Stop offset="0.62" stopColor={stopOf(fill[1]).color} stopOpacity={stopOf(fill[1]).opacity} />
          <Stop offset="1" stopColor={stopOf(fill[1]).color} stopOpacity={stopOf(fill[1]).opacity} />
        </LinearGradient>
        <LinearGradient id={`${id}-bloom`} x1={0} y1={0} x2={0} y2={height * 0.45} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={stopOf(light.bloom).color} stopOpacity={stopOf(light.bloom).opacity} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </LinearGradient>
        <LinearGradient id={`${id}-shade`} x1={0} y1={height * 0.5} x2={0} y2={height} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={shade.color} stopOpacity={0} />
          <Stop offset="1" stopColor={shade.color} stopOpacity={shade.opacity} />
        </LinearGradient>
        <RadialGradient id={`${id}-corner`} cx={0} cy={0} r={hot} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.26 * strength} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id={`${id}-corner-r`} cx={width} cy={0} r={hot * 0.85} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.12 * strength} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id={`${id}-corner-bl`} cx={0} cy={height} r={hot * 0.85} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.06 * strength} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </RadialGradient>
        <LinearGradient id={`${id}-rim`} x1={0} y1={0} x2={width} y2={height} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={rim[0].color} stopOpacity={rim[0].opacity} />
          <Stop offset="0.48" stopColor={rim[1].color} stopOpacity={rim[1].opacity} />
          <Stop offset="1" stopColor={rim[2].color} stopOpacity={rim[2].opacity} />
        </LinearGradient>
        <LinearGradient id={`${id}-specular`} x1={streak} y1={0} x2={width - streak} y2={0} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={specular.color} stopOpacity={0} />
          <Stop offset="0.42" stopColor={specular.color} stopOpacity={specular.opacity} />
          <Stop offset="1" stopColor={specular.color} stopOpacity={0} />
        </LinearGradient>
        <LinearGradient id={`${id}-bounce`} x1={streak * 1.4} y1={0} x2={width - streak * 1.4} y2={0} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={bounce.color} stopOpacity={0} />
          <Stop offset="0.5" stopColor={bounce.color} stopOpacity={bounce.opacity} />
          <Stop offset="1" stopColor={bounce.color} stopOpacity={0} />
        </LinearGradient>
        {/* The bevel: the pane's own thickness, lit at the top and shaded at the bottom. */}
        <LinearGradient id={`${id}-bevel`} x1={0} y1={0} x2={0} y2={height} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.22 * strength} />
          <Stop offset="0.45" stopColor="#FFFFFF" stopOpacity={0} />
          <Stop offset="1" stopColor="#000000" stopOpacity={0.2 * strength} />
        </LinearGradient>
        {/* Light held inside the side edges. */}
        <LinearGradient id={`${id}-side`} x1={0} y1={0} x2={Math.max(18, radius)} y2={0} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.035} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </LinearGradient>
        <LinearGradient id={`${id}-side-r`} x1={width} y1={0} x2={width - Math.max(18, radius)} y2={0} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.028} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </LinearGradient>
      </Defs>

      {rimOnly ? null : (
        <>
          <Rect x={0} y={0} width={width} height={height} fill={`url(#${id}-body)`} />
          <Rect x={0} y={0} width={width} height={height * 0.45} fill={`url(#${id}-bloom)`} opacity={strength} />
          <Rect x={0} y={height * 0.5} width={width} height={height * 0.5} fill={`url(#${id}-shade)`} />
        </>
      )}

      {edges ? (
        <>
          <Rect x={0} y={0} width={width} height={height} fill={`url(#${id}-corner)`} />
          <Rect x={0} y={0} width={width} height={height} fill={`url(#${id}-corner-r)`} />
          <Rect x={0} y={0} width={width} height={height} fill={`url(#${id}-corner-bl)`} />

          {/* The rim, lit from the top-left round to the bottom-right. */}
          <Rect x={0.6} y={0.6} width={width - 1.2} height={height - 1.2} rx={Math.max(0, radius - 0.6)} fill="none" stroke={`url(#${id}-rim)`} strokeWidth={1.2} />
          {/* Thickness: light rolls over the top edge and the bottom edge turns away. */}
          <Rect x={2.2} y={2.2} width={width - 4.4} height={height - 4.4} rx={Math.max(0, radius - 2.2)} fill="none" stroke={`url(#${id}-bevel)`} strokeWidth={2.4} />
          {/* Light that came through the top edge and is spreading across the pane, and the streak where it hits. */}
          <Rect x={0.5} y={0.5} width={width - 1} height={height - 1} rx={Math.max(0, radius - 0.5)} fill="none" stroke={`url(#${id}-specular)`} strokeWidth={12} opacity={0.07 * strength} />
          <Rect x={14} y={0.5} width={width - 28} height={1.3} fill={`url(#${id}-specular)`} opacity={strength} />
          {/* Light held inside the two side edges. */}
          <Rect x={0} y={0} width={Math.max(18, radius)} height={height} fill={`url(#${id}-side)`} opacity={strength} />
          <Rect x={width - Math.max(18, radius)} y={0} width={Math.max(18, radius)} height={height} fill={`url(#${id}-side-r)`} opacity={strength} />
          {/* Light bouncing back off the bottom edge. */}
          <Rect x={streak * 1.4} y={height - 1.6} width={width - streak * 2.8} height={1} fill={`url(#${id}-bounce)`} opacity={0.8 * strength} />
        </>
      ) : null}
    </Svg>
  );
}

const styles = StyleSheet.create({
  top: { position: 'absolute', top: 0, left: 0, right: 0 },
  bottomHalf: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%' },
  topLeft: { position: 'absolute', top: 0, left: 0 },
  topRight: { position: 'absolute', top: 0, right: 0 },
  bottomLeft: { position: 'absolute', bottom: 0, left: 0 },
  left: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  right: { position: 'absolute', top: 0, bottom: 0, right: 0 },
  edge: { position: 'absolute' },
});
