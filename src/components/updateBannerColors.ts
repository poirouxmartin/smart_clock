import type { Palette } from '@/theme';

export interface UpdateBannerColors {
  background: string;
  text: string;
  buttonBackground: string;
  buttonText: string;
}

/**
 * The update banner must stand out from the regular cards: solid primary background
 * (not bgCard), primary-contrast text and an inverted button.
 */
export function updateBannerColors(c: Palette): UpdateBannerColors {
  return {
    background: c.primary,
    text: c.onPrimary,
    buttonBackground: c.onPrimary,
    buttonText: c.primary,
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
