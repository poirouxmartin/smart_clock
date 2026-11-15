import { getPalette, PALETTES, THEME_IDS } from '../themes';

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map(i => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('themes', () => {
  it.each(THEME_IDS)('%s: text contrast on bgCard', id => {
    const p = PALETTES[id];
    expect(contrast(p.text, p.bgCard)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.textSecondary, p.bgCard)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.textMuted, p.bgCard)).toBeGreaterThanOrEqual(3);
  });

  it.each(THEME_IDS)('%s: onPrimary readable on primary', id => {
    const p = PALETTES[id];
    expect(contrast(p.onPrimary, p.primary)).toBeGreaterThanOrEqual(4.5);
  });

  it('falls back to night for unknown ids', () => {
    expect(getPalette('nope')).toBe(PALETTES.night);
    expect(getPalette(null)).toBe(PALETTES.night);
    expect(getPalette('nature')).toBe(PALETTES.nature);
  });
});
