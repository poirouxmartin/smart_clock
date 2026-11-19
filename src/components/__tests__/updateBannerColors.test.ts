import { PALETTES, THEME_IDS } from '@/theme/themes';
import { contrastRatio, updateBannerColors } from '../updateBannerColors';

describe('update banner colours', () => {
  it.each(THEME_IDS)('%s: does not reuse the selection colour', id => {
    const p = PALETTES[id];
    const b = updateBannerColors(p);
    expect(b.background.toLowerCase()).not.toBe(p.primary.toLowerCase());
    expect(b.buttonBackground.toLowerCase()).not.toBe(p.primary.toLowerCase());
  });

  it.each(THEME_IDS)('%s: text and button are readable', id => {
    const p = PALETTES[id];
    const b = updateBannerColors(p);
    expect(contrastRatio(b.text, b.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(b.buttonText, b.buttonBackground)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(b.border, p.bg)).toBeGreaterThanOrEqual(3);
  });
});
