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
  motion: {
    fast: number;
    base: number;
    slow: number;
    spring: { damping: number; stiffness: number; mass: number };
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
  spacing: { xs: number; sm: number; md: number; lg: number; xl: number; xxl: number; xxxl: number };
  radius: { sm: number; md: number; lg: number; xl: number; pill: number };
  shadow: { card: ViewStyle; floating: ViewStyle };
};

const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 40 };
const radius = { sm: 6, md: 10, lg: 14, xl: 20, pill: 999 };
const motion = {
  fast: 110,
  base: 180,
  slow: 260,
  spring: { damping: 22, stiffness: 260, mass: 0.8 },
};

/**
 * Precision graphite: ice-blue actions, platinum content and semantic money colors.
 */
export const brainiaTheme: ThemeTokens = {
  id: 'intelligence-console',
  name: 'Precisión grafito',
  isDark: true,
  colors: {
    background: '#101214',
    surface: '#171A1E',
    surfaceRaised: '#1D2126',
    surfaceSubtle: '#242A30',
    border: '#343D46',
    textPrimary: '#F1F3F5',
    textSecondary: '#B4BDC7',
    textMuted: '#929EAC',
    accent: '#A5D8FA',
    accentSoft: '#253C4B',
    accentStrong: '#BDE7FF',
    onAccent: '#102332',
    success: '#42D59A',
    warning: '#F4B942',
    danger: '#FF6B7A',
    model: '#44C7E8',
    captured: '#8A97AA',
    user: '#9BC7DF',
    pending: '#F4B942',
    chart: ['#A5D8FA', '#44C7E8', '#42D59A', '#FF6B7A', '#F4B942', '#929EAC'],
  },
  status: {
    income: '#42D59A',
    expense: '#FF6B7A',
    transfer: '#9BC7DF',
    insight: '#44C7E8',
    review: '#F4B942',
    warning: '#F4B942',
  },
  depth: {
    overlay: 'rgba(3,6,12,0.84)',
    glow: 'rgba(165,216,250,0.08)',
    hairline: 'rgba(174,185,203,0.16)',
  },
  motion,
  typography: {
    display: { fontFamily: 'Inter_700Bold', fontSize: 26, lineHeight: 32, letterSpacing: -0.45 },
    headline: { fontFamily: 'Inter_600SemiBold', fontSize: 17, lineHeight: 23, letterSpacing: -0.1 },
    body: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 21 },
    bodyStrong: { fontFamily: 'Inter_600SemiBold', fontSize: 15, lineHeight: 21 },
    caption: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16 },
    mono: { fontFamily: 'JetBrainsMono_600SemiBold', fontSize: 11, lineHeight: 15, letterSpacing: 0.45 },
    numeral: { fontFamily: 'JetBrainsMono_600SemiBold', fontSize: 27, lineHeight: 33, letterSpacing: -0.35, fontVariant: ['tabular-nums'] },
    overline: { fontFamily: 'JetBrainsMono_600SemiBold', fontSize: 10, lineHeight: 14, letterSpacing: 1.2, textTransform: 'uppercase' },
  },
  spacing,
  radius,
  shadow: {
    card: makeShadow({ color: '#000000', opacity: 0.18, blur: 8, offsetY: 2, elevation: 1 }),
    floating: makeShadow({ color: '#000000', opacity: 0.36, blur: 18, offsetY: 8, elevation: 5 }),
  },
};

export const themeRegistry: Record<ThemeId, ThemeTokens> = {
  'intelligence-console': brainiaTheme,
};

export const themeOptions = [{
  id: brainiaTheme.id,
  name: brainiaTheme.name,
  description: 'Restrained dark surfaces with explicit trust and money semantics.',
}];
