import { PALETTES, THEME_IDS } from '@/theme/themes';
import { contrastRatio, updateBannerColors } from '../updateBannerColors';

describe('update banner colours', () => {
  it.each(THEME_IDS)('%s: the banner stands out from the page and the cards', id => {
    const p = PALETTES[id];
    const b = updateBannerColors(p);
    // 17/11: the banner used bgCard like every other card and went unnoticed.
    expect(contrastRatio(b.background, p.bg)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(b.background, p.bgCard)).toBeGreaterThanOrEqual(3);
  });

  it.each(THEME_IDS)('%s: title and button are readable', id => {
    const b = updateBannerColors(PALETTES[id]);
    expect(contrastRatio(b.text, b.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(b.buttonText, b.buttonBackground)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(b.buttonBackground, b.background)).toBeGreaterThanOrEqual(3);
  });

  it('the previous card colour would not stand out (guards against going back)', () => {
    const p = PALETTES.night;
    expect(contrastRatio(p.bgCard, p.bg)).toBeLessThan(3);
  });
});
