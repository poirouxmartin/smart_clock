import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

export type ThemeId = 'night' | 'nature' | 'dawn';

export interface Palette {
  bg: string;
  bgCard: string;
  bgCardAlt: string;
  bgSurface: string;
  border: string;
  borderLight: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  textDim: string;
  primary: string;
  primaryDark: string;
  primaryLight: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
  onPrimary: string;
  /** Screen background gradient. */
  background: readonly string[];
  /** Primary button gradient. */
  button: readonly string[];
  hypno: { calm: string; light: string; wake: string; unknown: string };
  statusBar: 'light' | 'dark';
  icon: ComponentProps<typeof Ionicons>['name'];
}

const night: Palette = {
  bg: '#0b1020',
  bgCard: '#151c33',
  bgCardAlt: '#1a2347',
  bgSurface: '#1f2845',
  border: '#232c4a',
  borderLight: '#34406a',
  text: '#f5f7ff',
  textSecondary: '#d5dbf0',
  textMuted: '#98a3c7',
  textDim: '#6b7699',
  primary: '#7aa7ff',
  primaryDark: '#5a87e0',
  primaryLight: '#a5c3ff',
  accent: '#a78bfa',
  success: '#4ade80',
  warning: '#f5b453',
  danger: '#f87171',
  onPrimary: '#0b1020',
  background: ['#0b1020', '#141a33', '#241f4d'],
  button: ['#6f9bf5', '#9a7cf2'],
  hypno: { calm: '#2b3f8f', light: '#7aa7ff', wake: '#f5b453', unknown: '#4b5563' },
  statusBar: 'light',
  icon: 'moon',
};

const nature: Palette = {
  bg: '#0e1d15',
  bgCard: '#16291f',
  bgCardAlt: '#1d3527',
  bgSurface: '#21392c',
  border: '#2b4636',
  borderLight: '#3d5c49',
  text: '#f4efe1',
  textSecondary: '#dcd5c0',
  textMuted: '#a3b8a0',
  textDim: '#7d927b',
  primary: '#8fc27a',
  primaryDark: '#6a9f57',
  primaryLight: '#b9dea2',
  accent: '#f2b660',
  success: '#8fc27a',
  warning: '#f2b660',
  danger: '#e87a6b',
  onPrimary: '#10221a',
  background: ['#0e1d15', '#173225', '#2a4a35'],
  button: ['#6a9f57', '#c99a4a'],
  hypno: { calm: '#2f5d46', light: '#9cc97f', wake: '#f2b660', unknown: '#56665d' },
  statusBar: 'light',
  icon: 'leaf',
};

const dawn: Palette = {
  bg: '#1b1024',
  bgCard: '#2a1a2c',
  bgCardAlt: '#3a2338',
  bgSurface: '#3a2538',
  border: '#42283f',
  borderLight: '#5a3a56',
  text: '#fff4ec',
  textSecondary: '#f0dcd2',
  textMuted: '#c4a6b0',
  textDim: '#977b88',
  primary: '#ff9e6d',
  primaryDark: '#e0804f',
  primaryLight: '#ffc09a',
  accent: '#ffd28a',
  success: '#9bd48a',
  warning: '#ffd28a',
  danger: '#ff7b7b',
  onPrimary: '#2a1020',
  background: ['#1b1024', '#3b1d33', '#6a3242'],
  button: ['#ff8a65', '#ffc371'],
  hypno: { calm: '#5b2a4a', light: '#ff9e6d', wake: '#ffd28a', unknown: '#5d4a55' },
  statusBar: 'light',
  icon: 'sunny',
};

export const PALETTES: Record<ThemeId, Palette> = { night, nature, dawn };
export const THEME_IDS: ThemeId[] = ['nature', 'night', 'dawn'];
export const DEFAULT_THEME_ID: ThemeId = 'nature';

/** Typing helper for LinearGradient's `colors` prop (needs at least two stops). */
export const asGradient = (g: readonly string[]) => g as unknown as readonly [string, string, ...string[]];

export function getPalette(id: string | null | undefined): Palette {
  return id && id in PALETTES ? PALETTES[id as ThemeId] : night;
}
