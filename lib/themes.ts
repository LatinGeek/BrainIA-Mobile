import { Platform, TextStyle, ViewStyle } from 'react-native';

import { ThemeId } from './domain';

function hexToRgba(hex: string, opacity: number) {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

export function makeShadow({ color, opacity, blur, offsetY, elevation }: {
  color: string;
  opacity: number;
  blur: number;
  offsetY: number;
  elevation: number;
}): ViewStyle {
  if (Platform.OS === 'web') {
    return { boxShadow: `0px ${offsetY}px ${blur}px ${hexToRgba(color, opacity)}` } as ViewStyle;
  }
  return {
    shadowColor: color,
    shadowOpacity: opacity,
    shadowRadius: blur,
    shadowOffset: { width: 0, height: offsetY },
    elevation,
  };
}

export type GlassLevel = 'thin' | 'regular' | 'strong';

export type MotionEasing = readonly [number, number, number, number];

export type ThemeTokens = {
  id: ThemeId;
  name: string;
  isDark: true;
  colors: {
    background: string;
    surface: string;
    surfaceRaised: string;
    surfaceSubtle: string;
    border: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    accent: string;
    accentSoft: string;
    accentStrong: string;
    onAccent: string;
    success: string;
    warning: string;
    danger: string;
    model: string;
    captured: string;
    user: string;
    pending: string;
    chart: string[];
  };
  status: {
    income: string;
    expense: string;
    transfer: string;
    insight: string;
    review: string;
    warning: string;
  };
  depth: { overlay: string; glow: string; hairline: string };
  glass: {
    blur: Record<GlassLevel, number>;
    fill: Record<GlassLevel, readonly [string, string]>;
    edge: readonly [string, string];
    inner: string;
    chromeBase: number;
    /** Ambient base at chromeBase opacity: dock, compact header and sheet backing. */
    chrome: string;
    /** Denser chrome for the pinned action bar so fields never show through. */
    chromeStrong: string;
    /** Near-opaque chrome for floating plates when no native blur hides what scrolls beneath. */
    chromeOpaque: string;
    selected: string;
    onSelected: string;
    solid: Record<GlassLevel, string>;
    divider: string;
    /**
     * The light baked into a glass sheet (the rim, its bevel and the specular streaks). Kept apart
     * from `edge`, which is a plain hairline for flat surfaces and handles.
     */
    light: {
      /** Outer rim, lit from the top-left corner round to the bottom-right. */
      edge: readonly [string, string, string];
      /** The bright streak along the top edge, and the soft light that spills off it. */
      specular: string;
      /** Light bouncing back off the bottom edge. */
      bounce: string;
      /** Haze that pools where the light enters at the top. */
      bloom: string;
      /** Shade inside the bottom edge, where the pane is thickest. */
      shade: string;
    };
  };
  motion: {
    /** Legacy aliases kept until the glass cleanup phase. */
    fast: number;
    base: number;
    slow: number;
    spring: {
      damping: number;
      stiffness: number;
      mass: number;
      thumb: { damping: number; stiffness: number; mass: number };
      press: { damping: number; stiffness: number; mass: number };
    };
    duration: { press: number; quick: number; enter: number; count: number; reduced: number };
    stagger: number;
    staggerMax: number;
    distance: { rise: number; push: number; headerCollapse: number };
    easing: { out: MotionEasing; in: MotionEasing; soft: MotionEasing };
  };
  ambient: { base: string; base2: string; orbs: readonly [string, string, string]; ring: string };
  typography: {
    display: TextStyle;
    headline: TextStyle;
    body: TextStyle;
    bodyStrong: TextStyle;
    caption: TextStyle;
    mono: TextStyle;
    numeral: TextStyle;
    overline: TextStyle;
  };
  layout: { minTarget: number; answerTarget: number; dockHeight: number; dockMinScale: number; reviewCardMax: number };
  spacing: { xs: number; sm: number; md: number; lg: number; xl: number; xxl: number; xxxl: number };
  radius: { sm: number; md: number; lg: number; xl: number; sheet: number; pill: number };
  shadow: { card: ViewStyle; floating: ViewStyle };
};

const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 40 };
const radius = { sm: 10, md: 14, lg: 20, xl: 28, sheet: 34, pill: 999 };
const springPress = { damping: 18, stiffness: 320, mass: 1 };

/**
 * Teal ambient field, lime signal, specular glass. The only app theme.
 */
export const brainiaTheme: ThemeTokens = {
  id: 'intelligence-console',
  name: 'Glass',
  isDark: true,
  colors: {
    background: '#091315',
    surface: '#142124',
    surfaceRaised: '#1A2B2F',
    surfaceSubtle: '#22363B',
    border: 'rgba(255,255,255,0.12)',
    textPrimary: '#F4F7F6',
    textSecondary: 'rgba(236,243,241,0.76)',
    textMuted: 'rgba(236,243,241,0.58)',
    accent: '#C4F54A',
    accentSoft: 'rgba(196,245,74,0.14)',
    accentStrong: '#D6FF6B',
    onAccent: '#0B1205',
    success: '#7EE0A6',
    warning: '#F6C65B',
    danger: '#FF7B7B',
    model: '#74D7EE',
    captured: '#AFBBC2',
    user: '#B5A8FF',
    pending: '#F6C65B',
    chart: ['#C4F54A', '#74D7EE', '#B5A8FF', '#FF8E85', '#F6C65B', '#8FA3AD'],
  },
  status: {
    income: '#9FE870',
    expense: '#FF8E85',
    transfer: '#B5A8FF',
    insight: '#74D7EE',
    review: '#F6C65B',
    warning: '#F6C65B',
  },
  depth: {
    overlay: 'rgba(3,8,9,0.86)',
    glow: 'rgba(196,245,74,0.10)',
    hairline: 'rgba(255,255,255,0.12)',
  },
  glass: {
    blur: { thin: 8, regular: 14, strong: 22 },
    fill: {
      thin: ['rgba(255,255,255,0.045)', 'rgba(255,255,255,0.012)'],
      regular: ['rgba(255,255,255,0.072)', 'rgba(255,255,255,0.02)'],
      strong: ['rgba(255,255,255,0.105)', 'rgba(255,255,255,0.032)'],
    },
    edge: ['rgba(255,255,255,0.32)', 'rgba(255,255,255,0.05)'],
    inner: 'rgba(255,255,255,0.06)',
    chromeBase: 0.74,
    chrome: hexToRgba('#091315', 0.74),
    chromeStrong: hexToRgba('#091315', 0.86),
    chromeOpaque: hexToRgba('#091315', 1),
    selected: 'rgba(246,249,248,0.95)',
    onSelected: '#0B1113',
    solid: { thin: '#142124', regular: '#1A2B2F', strong: '#22363B' },
    divider: 'rgba(255,255,255,0.08)',
    light: {
      edge: ['rgba(232,250,248,0.72)', 'rgba(232,250,248,0.26)', 'rgba(232,250,248,0.38)'],
      specular: 'rgba(245,255,254,0.62)',
      bounce: 'rgba(232,250,248,0.38)',
      bloom: 'rgba(232,250,248,0.038)',
      shade: 'rgba(3,10,12,0.24)',
    },
  },
  motion: {
    fast: 140,
    base: 240,
    slow: 420,
    spring: {
      ...springPress,
      thumb: { damping: 16, stiffness: 220, mass: 0.9 },
      press: springPress,
    },
    duration: { press: 140, quick: 240, enter: 420, count: 800, reduced: 120 },
    stagger: 45,
    staggerMax: 9,
    distance: { rise: 14, push: 34, headerCollapse: 64 },
    easing: { out: [0.2, 0.8, 0.2, 1], in: [0.4, 0, 1, 1], soft: [0.25, 1.1, 0.4, 1] },
  },
  ambient: {
    base: '#091315',
    base2: '#0D1C1F',
    orbs: ['#1F6E78', '#24465A', '#B9E85A'],
    ring: '#5BB3BE',
  },
  typography: {
    display: { fontFamily: 'Poppins_600SemiBold', fontSize: 28, lineHeight: 34, letterSpacing: -0.5 },
    headline: { fontFamily: 'Poppins_600SemiBold', fontSize: 17, lineHeight: 23, letterSpacing: -0.2 },
    body: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 21 },
    bodyStrong: { fontFamily: 'Inter_600SemiBold', fontSize: 15, lineHeight: 21 },
    caption: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16 },
    mono: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, lineHeight: 15, letterSpacing: 0.45 },
    numeral: { fontFamily: 'Inter_700Bold', fontSize: 34, lineHeight: 40, letterSpacing: -1.2, fontVariant: ['tabular-nums'] },
    overline: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 10, lineHeight: 14, letterSpacing: 1.2, textTransform: 'uppercase' },
  },
  layout: { minTarget: 44, answerTarget: 52, dockHeight: 68, dockMinScale: 0.86, reviewCardMax: 470 },
  spacing,
  radius,
  shadow: {
    card: makeShadow({ color: '#000000', opacity: 0.22, blur: 36, offsetY: 16, elevation: 3 }),
    floating: makeShadow({ color: '#000000', opacity: 0.4, blur: 28, offsetY: 10, elevation: 8 }),
  },
};

export const themeRegistry: Record<ThemeId, ThemeTokens> = {
  'intelligence-console': brainiaTheme,
};

export const themeOptions = [{
  id: brainiaTheme.id,
  name: brainiaTheme.name,
  description: 'Ambient teal glass, lime signal and a single dark material system.',
}];
