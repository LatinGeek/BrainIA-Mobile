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

type Spring = { damping: number; stiffness: number; mass: number };
export type Bezier = [number, number, number, number];
export type GlassLevel = 'thin' | 'regular' | 'strong';

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
    fill: Record<GlassLevel, [string, string]>;
    edge: [string, string];
    stroke: string;
    inner: string;
    innerStroke: string;
    divider: string;
    /** Opacity of the solid base under chrome (dock, bars) so content never bleeds through. */
    chromeBase: number;
    selected: string;
    onSelected: string;
    /** Opaque fills used when Reduce Transparency is on. */
    solid: Record<GlassLevel, string>;
  };
  ambient: { base: string; baseRaised: string; orbs: [string, string, string]; ring: string };
  motion: {
    /** @deprecated use duration.press */
    fast: number;
    /** @deprecated use duration.quick */
    base: number;
    /** @deprecated use duration.enter */
    slow: number;
    /** @deprecated use springs.press */
    spring: Spring;
    duration: { press: number; quick: number; enter: number; count: number };
    stagger: number;
    springs: { thumb: Spring; press: Spring };
    easing: { out: Bezier; in: Bezier; soft: Bezier };
  };
  typography: {
    title: TextStyle;
    display: TextStyle;
    headline: TextStyle;
    body: TextStyle;
    bodyStrong: TextStyle;
    caption: TextStyle;
    mono: TextStyle;
    numeral: TextStyle;
    numeralCompact: TextStyle;
    overline: TextStyle;
  };
  spacing: { xs: number; sm: number; md: number; lg: number; xl: number; xxl: number; xxxl: number };
  radius: { sm: number; md: number; lg: number; xl: number; pill: number };
  shadow: { card: ViewStyle; floating: ViewStyle };
};

const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 40 };
const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };
const pressSpring: Spring = { damping: 18, stiffness: 320, mass: 1 };
const motion: ThemeTokens['motion'] = {
  fast: 140,
  base: 240,
  slow: 420,
  spring: pressSpring,
  duration: { press: 140, quick: 240, enter: 420, count: 800 },
  stagger: 45,
  springs: { thumb: { damping: 16, stiffness: 220, mass: 0.9 }, press: pressSpring },
  easing: { out: [0.2, 0.8, 0.2, 1], in: [0.4, 0, 1, 1], soft: [0.25, 1.1, 0.4, 1] },
};

/**
 * BrainIA's single visual system: dark glass over a teal ambient field.
 * Colour is semantic: lime is the one action/signal colour, cyan is machine
 * output, amber is unresolved, violet is user intent, and money keeps its own
 * directional palette.
 */
export const brainiaTheme: ThemeTokens = {
  id: 'intelligence-console',
  name: 'BrainIA Glass',
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
    accentStrong: '#DDFB8C',
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
    overlay: 'rgba(3,8,9,0.72)',
    glow: 'rgba(196,245,74,0.16)',
    hairline: 'rgba(255,255,255,0.08)',
  },
  glass: {
    blur: { thin: 12, regular: 22, strong: 36 },
    fill: {
      thin: ['rgba(255,255,255,0.075)', 'rgba(255,255,255,0.035)'],
      regular: ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.055)'],
      strong: ['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.09)'],
    },
    edge: ['rgba(255,255,255,0.32)', 'rgba(255,255,255,0.05)'],
    stroke: 'rgba(255,255,255,0.12)',
    inner: 'rgba(255,255,255,0.06)',
    innerStroke: 'rgba(255,255,255,0.08)',
    divider: 'rgba(255,255,255,0.08)',
    chromeBase: 0.74,
    selected: 'rgba(246,249,248,0.95)',
    onSelected: '#0B1113',
    solid: { thin: '#142124', regular: '#1A2B2F', strong: '#22363B' },
  },
  ambient: { base: '#091315', baseRaised: '#0D1C1F', orbs: ['#1F6E78', '#24465A', '#B9E85A'], ring: '#5BB3BE' },
  motion,
  typography: {
    title: { fontFamily: 'Poppins_600SemiBold', fontSize: 28, lineHeight: 34, letterSpacing: -0.5 },
    display: { fontFamily: 'Poppins_600SemiBold', fontSize: 24, lineHeight: 30, letterSpacing: -0.4 },
    headline: { fontFamily: 'Inter_600SemiBold', fontSize: 17, lineHeight: 23, letterSpacing: -0.1 },
    body: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 21 },
    bodyStrong: { fontFamily: 'Inter_600SemiBold', fontSize: 15, lineHeight: 21 },
    caption: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16 },
    mono: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, lineHeight: 15, letterSpacing: 0.45 },
    // Inter, not Poppins: Poppins has no tabular figures, so counting numbers would jitter.
    numeral: { fontFamily: 'Inter_700Bold', fontSize: 30, lineHeight: 36, letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
    numeralCompact: { fontFamily: 'Inter_700Bold', fontSize: 19, lineHeight: 24, letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
    overline: { fontFamily: 'JetBrainsMono_600SemiBold', fontSize: 10, lineHeight: 14, letterSpacing: 1.2, textTransform: 'uppercase' },
  },
  spacing,
  radius,
  shadow: {
    card: makeShadow({ color: '#000000', opacity: 0.22, blur: 24, offsetY: 10, elevation: 2 }),
    floating: makeShadow({ color: '#000000', opacity: 0.4, blur: 36, offsetY: 16, elevation: 8 }),
  },
};

export const themeRegistry: Record<ThemeId, ThemeTokens> = {
  'intelligence-console': brainiaTheme,
};

export const themeOptions = [{
  id: brainiaTheme.id,
  name: brainiaTheme.name,
  description: 'Dark glass with a single lime signal colour and explicit trust and money semantics.',
}];
