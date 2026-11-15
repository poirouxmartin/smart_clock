export const Colors = {
  bg: '#0a0e1a',
  bgCard: '#131a2e',
  bgCardAlt: '#0c2d48',
  bgSurface: '#1e293b',

  border: '#1e293b',
  borderLight: '#334155',

  text: '#ffffff',
  textSecondary: '#e2e8f0',
  textMuted: '#8b9cb3',
  textDim: '#64748b',

  primary: '#0ea5e9',
  primaryDark: '#0284c7',
  primaryLight: '#38bdf8',

  accent: '#22d3ee',
  purple: '#7c3aed',
  purpleDark: '#6d28d9',

  success: '#22c55e',
  successDark: '#16a34a',
  warning: '#f59e0b',
  danger: '#ef4444',

  gradient: {
    night: ['#0a0e1a', '#0f172a', '#1e1b4b'] as const,
    card: ['#131a2e', '#1e293b'] as const,
    primary: ['#0ea5e9', '#7c3aed'] as const,
    sleep: ['#1e1b4b', '#0f172a', '#0a0e1a'] as const,
    sunset: ['#f97316', '#ef4444', '#7c3aed'] as const,
    dawn: ['#0ea5e9', '#22d3ee', '#34d399'] as const,
  },
};

export const Typography = {
  clock: { fontSize: 76, fontWeight: '200' as const, color: Colors.text, letterSpacing: -3 },
  h1: { fontSize: 28, fontWeight: '700' as const, color: Colors.text },
  h2: { fontSize: 22, fontWeight: '600' as const, color: Colors.text },
  h3: { fontSize: 18, fontWeight: '600' as const, color: Colors.text },
  body: { fontSize: 16, color: Colors.textSecondary },
  bodySmall: { fontSize: 14, color: Colors.textSecondary },
  caption: { fontSize: 12, color: Colors.textMuted },
  label: { fontSize: 14, color: Colors.textMuted, textTransform: 'uppercase' as const, letterSpacing: 1 },
};

import type { Palette } from './themes';

export function makeTypography(p: Palette) {
  return {
    clock: { ...Typography.clock, color: p.text },
    h1: { ...Typography.h1, color: p.text },
    h2: { ...Typography.h2, color: p.text },
    h3: { ...Typography.h3, color: p.text },
    body: { ...Typography.body, color: p.textSecondary },
    bodySmall: { ...Typography.bodySmall, color: p.textSecondary },
    caption: { ...Typography.caption, color: p.textMuted },
    label: { ...Typography.label, color: p.textMuted },
  };
}

export * from './themes';
export * from './ThemeContext';

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
};
