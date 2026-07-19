import { Platform, TextStyle, ViewStyle } from 'react-native';
import { ThemeId } from './domain';

function hexToRgba(hex: string, opacity: number) {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

export function makeShadow({
  color,
  opacity,
  blur,
  offsetY,
  elevation,
}: {
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

export type ThemeTokens = {
  id: ThemeId;
  name: string;
  isDark: boolean;
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
  depth: {
    overlay: string;
    glow: string;
    hairline: string;
  };
  motion: {
    fast: number;
    base: number;
    slow: number;
    spring: {
      damping: number;
      stiffness: number;
      mass: number;
    };
  };
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
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
    xxxl: number;
  };
  radius: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
    pill: number;
  };
  shadow: {
    card: ViewStyle;
    floating: ViewStyle;
  };
};

const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 40,
};

const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
};

// Stitch "Technical Precision" shape scale: disciplined, instrument-like corners.
const radiusTight = {
  sm: 4,
  md: 6,
  lg: 10,
  xl: 14,
  pill: 999,
};

const motion = {
  fast: 120,
  base: 220,
  slow: 360,
  spring: {
    damping: 18,
    stiffness: 180,
    mass: 0.9,
  },
};

const editorial: ThemeTokens = {
  id: 'editorial-minimal',
  name: 'Editorial Control',
  isDark: false,
  colors: {
    background: '#F5F7FA',
    surface: '#FFFFFF',
    surfaceRaised: '#FFFFFF',
    surfaceSubtle: '#EEF2F6',
    border: '#D9E1EA',
    textPrimary: '#101820',
    textSecondary: '#465563',
    textMuted: '#74808C',
    accent: '#117A7A',
    accentSoft: '#DDF3F0',
    accentStrong: '#075D5D',
    onAccent: '#FFFFFF',
    success: '#1B7F5A',
    warning: '#B46908',
    danger: '#C2413A',
    chart: ['#117A7A', '#6B5BD6', '#D46B45', '#2E90FA', '#87913D', '#344054'],
  },
  status: {
    income: '#1B7F5A',
    expense: '#C56A12',
    transfer: '#2E90FA',
    insight: '#6B5BD6',
    review: '#B46908',
    warning: '#B46908',
  },
  depth: {
    overlay: 'rgba(16,24,32,0.36)',
    glow: 'rgba(17,122,122,0.16)',
    hairline: 'rgba(16,24,32,0.08)',
  },
  motion,
  typography: {
    display: { fontFamily: 'Sora_800ExtraBold', fontSize: 29, lineHeight: 35, letterSpacing: -0.4 },
    headline: { fontFamily: 'Sora_700Bold', fontSize: 19, lineHeight: 25, letterSpacing: -0.2 },
    body: { fontFamily: 'Manrope_500Medium', fontSize: 15, lineHeight: 22 },
    bodyStrong: { fontFamily: 'Manrope_700Bold', fontSize: 15, lineHeight: 21 },
    caption: { fontFamily: 'Manrope_600SemiBold', fontSize: 12, lineHeight: 16, letterSpacing: 0.1 },
    mono: { fontFamily: 'IBMPlexMono_600SemiBold', fontSize: 12, lineHeight: 16, letterSpacing: 0 },
    numeral: { fontFamily: 'Sora_700Bold', fontSize: 30, lineHeight: 36, letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
    overline: { fontFamily: 'Manrope_700Bold', fontSize: 11, lineHeight: 14, letterSpacing: 1.2, textTransform: 'uppercase' },
  },
  spacing,
  radius,
  shadow: {
    card: makeShadow({ color: '#111111', opacity: 0.04, blur: 8, offsetY: 3, elevation: 1 }),
    floating: makeShadow({ color: '#111111', opacity: 0.09, blur: 14, offsetY: 8, elevation: 3 }),
  },
};

// "Technical Precision" — rebuilt from the Stitch "BrainIA Second Brain System" design
// (projects/17053346601361389369). Slate canvas, indigo intelligence accent,
// emerald/rose money signals, Inter + JetBrains Mono.
const consoleTheme: ThemeTokens = {
  id: 'intelligence-console',
  name: 'Technical Precision',
  isDark: true,
  colors: {
    background: '#0B1326',
    surface: '#131B2E',
    surfaceRaised: '#171F33',
    surfaceSubtle: '#222A3D',
    border: '#464555',
    textPrimary: '#DAE2FD',
    textSecondary: '#C7C4D8',
    textMuted: '#918FA1',
    accent: '#4F46E5',
    accentSoft: '#232057',
    accentStrong: '#C3C0FF',
    onAccent: '#FFFFFF',
    success: '#4EDEA3',
    warning: '#FBBF24',
    danger: '#FB7185',
    chart: ['#C3C0FF', '#4EDEA3', '#FB7185', '#818CF8', '#FBBF24', '#64748B'],
  },
  status: {
    income: '#4EDEA3',
    expense: '#FB7185',
    transfer: '#818CF8',
    insight: '#C3C0FF',
    review: '#FBBF24',
    warning: '#FBBF24',
  },
  depth: {
    overlay: 'rgba(6,14,32,0.78)',
    glow: 'rgba(79,70,229,0.22)',
    hairline: 'rgba(255,255,255,0.10)',
  },
  motion,
  typography: {
    display: { fontFamily: 'Inter_700Bold', fontSize: 25, lineHeight: 32, letterSpacing: -0.3 },
    headline: { fontFamily: 'Inter_600SemiBold', fontSize: 18, lineHeight: 25, letterSpacing: -0.1 },
    body: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22 },
    bodyStrong: { fontFamily: 'Inter_600SemiBold', fontSize: 15, lineHeight: 21 },
    caption: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16, letterSpacing: 0.1 },
    mono: { fontFamily: 'JetBrainsMono_600SemiBold', fontSize: 12, lineHeight: 16, letterSpacing: 0.5 },
    numeral: { fontFamily: 'JetBrainsMono_600SemiBold', fontSize: 28, lineHeight: 35, letterSpacing: -0.2, fontVariant: ['tabular-nums'] },
    overline: { fontFamily: 'JetBrainsMono_600SemiBold', fontSize: 11, lineHeight: 15, letterSpacing: 1.4, textTransform: 'uppercase' },
  },
  spacing,
  radius: radiusTight,
  shadow: {
    card: makeShadow({ color: '#060E20', opacity: 0.35, blur: 12, offsetY: 4, elevation: 2 }),
    floating: makeShadow({ color: '#4F46E5', opacity: 0.15, blur: 28, offsetY: 10, elevation: 6 }),
  },
};

const warm: ThemeTokens = {
  id: 'warm-knowledge',
  name: 'Warm Knowledge',
  isDark: false,
  colors: {
    background: '#F5EBDD',
    surface: '#FFF9F1',
    surfaceRaised: '#F0E0CB',
    surfaceSubtle: '#E5D3B8',
    border: '#D4C0A5',
    textPrimary: '#1F1B16',
    textSecondary: '#51473F',
    textMuted: '#75695E',
    accent: '#D88A2B',
    accentSoft: '#F7E3BE',
    accentStrong: '#9C5E12',
    onAccent: '#FFF9F1',
    success: '#2C7A59',
    warning: '#C17C12',
    danger: '#B84A3A',
    chart: ['#D88A2B', '#2C7A59', '#6D4C41', '#C17C12', '#7C3AED', '#A16207'],
  },
  status: {
    income: '#2C7A59',
    expense: '#C17C12',
    transfer: '#6D4C41',
    insight: '#7C3AED',
    review: '#C17C12',
    warning: '#C17C12',
  },
  depth: {
    overlay: 'rgba(31,27,22,0.34)',
    glow: 'rgba(216,138,43,0.16)',
    hairline: 'rgba(31,27,22,0.08)',
  },
  motion,
  typography: {
    display: { fontFamily: 'Fraunces_700Bold', fontSize: 29, lineHeight: 36, letterSpacing: -0.2 },
    headline: { fontFamily: 'Fraunces_600SemiBold', fontSize: 19, lineHeight: 26, letterSpacing: 0 },
    body: { fontFamily: 'Manrope_500Medium', fontSize: 15, lineHeight: 22 },
    bodyStrong: { fontFamily: 'Manrope_700Bold', fontSize: 15, lineHeight: 21 },
    caption: { fontFamily: 'Manrope_600SemiBold', fontSize: 12, lineHeight: 16, letterSpacing: 0.1 },
    mono: { fontFamily: 'IBMPlexMono_600SemiBold', fontSize: 12, lineHeight: 16, letterSpacing: 0 },
    numeral: { fontFamily: 'Fraunces_600SemiBold', fontSize: 30, lineHeight: 37, letterSpacing: -0.2, fontVariant: ['tabular-nums'] },
    overline: { fontFamily: 'Manrope_700Bold', fontSize: 11, lineHeight: 14, letterSpacing: 1.2, textTransform: 'uppercase' },
  },
  spacing,
  radius,
  shadow: {
    card: makeShadow({ color: '#8B5E34', opacity: 0.09, blur: 14, offsetY: 8, elevation: 3 }),
    floating: makeShadow({ color: '#8B5E34', opacity: 0.15, blur: 20, offsetY: 10, elevation: 5 }),
  },
};

export const themeRegistry: Record<ThemeId, ThemeTokens> = {
  'editorial-minimal': editorial,
  'intelligence-console': consoleTheme,
  'warm-knowledge': warm,
};

export const themeOptions = Object.values(themeRegistry).map((theme) => ({
  id: theme.id,
  name: theme.name,
  description:
    theme.id === 'editorial-minimal'
      ? 'Compact control-room clarity.'
      : theme.id === 'intelligence-console'
        ? 'Premium dark, dense, lime-accented.'
        : 'Warm, calm, editorial and human.',
}));
