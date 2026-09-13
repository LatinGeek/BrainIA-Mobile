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
const radius = { sm: 4, md: 6, lg: 8, xl: 10, pill: 999 };
const motion = {
  fast: 110,
  base: 180,
  slow: 260,
  spring: { damping: 22, stiffness: 260, mass: 0.8 },
};

/**
 * BrainIA's single visual system. Colour is semantic: indigo is action/user
 * intent, cyan is machine output, amber is unresolved, and money keeps its
 * own directional palette.
 */
export const brainiaTheme: ThemeTokens = {
  id: 'intelligence-console',
  name: 'BrainIA Dark',
  isDark: true,
  colors: {
    background: '#070A12',
    surface: '#0B101C',
    surfaceRaised: '#0F1625',
    surfaceSubtle: '#121B2B',
    border: '#263247',
    textPrimary: '#F1F5FC',
    textSecondary: '#AEB9CB',
    textMuted: '#718096',
    accent: '#6558F5',
    accentSoft: '#1D1A48',
    accentStrong: '#BDB7FF',
    onAccent: '#FFFFFF',
    success: '#42D59A',
    warning: '#F4B942',
    danger: '#FF6B7A',
    model: '#44C7E8',
    captured: '#8A97AA',
    user: '#8B7CFF',
    pending: '#F4B942',
    chart: ['#6558F5', '#44C7E8', '#42D59A', '#FF6B7A', '#F4B942', '#718096'],
  },
  status: {
    income: '#42D59A',
    expense: '#FF6B7A',
    transfer: '#8B7CFF',
    insight: '#44C7E8',
    review: '#F4B942',
    warning: '#F4B942',
  },
  depth: {
    overlay: 'rgba(3,6,12,0.84)',
    glow: 'rgba(101,88,245,0.16)',
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
