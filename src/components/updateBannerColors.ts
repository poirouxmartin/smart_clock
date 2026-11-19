import type { Palette } from '@/theme';

export interface UpdateBannerColors {
  background: string;
  border: string;
  text: string;
  accent: string;
  buttonBackground: string;
  buttonText: string;
}

/**
 * Compact bar: it must not reuse the selection colour (primary), which already means
 * "active" on chips and buttons. The accent border and button make it noticeable instead.
 */
export function updateBannerColors(c: Palette): UpdateBannerColors {
  return {
    background: c.bgCardAlt,
    border: c.accent,
    text: c.text,
    accent: c.accent,
    buttonBackground: c.accent,
    buttonText: c.onPrimary,
  };
}

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map(i => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG contrast ratio between two #rrggbb colours. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
