import { describe, expect, it } from 'vitest';
import { hslToHex, rasterColors, spectrumColor } from './colorPicker';

describe('colour window', () => {
  it('converts HSL to hex', () => {
    expect(hslToHex(0, 100, 50)).toBe('#FF0000');
    expect(hslToHex(120, 100, 50)).toBe('#00FF00');
    expect(hslToHex(0, 0, 100)).toBe('#FFFFFF');
    expect(hslToHex(0, 0, 0)).toBe('#000000');
  });

  it('has a grid of 12 × 10: grey row from white to black, then the rainbow from light to dark', () => {
    const g = rasterColors();
    expect(g).toHaveLength(10);
    for (const row of g) expect(row).toHaveLength(12);
    expect(g[0][0]).toBe('#FFFFFF');
    expect(g[0][11]).toBe('#000000');
    expect(g[1][0]).toBe(hslToHex(0, 75, 90));
    expect(g[3][0]).toBe(hslToHex(0, 85, 74));
    expect(g[9][11]).toBe(hslToHex(300, 85, 21));
  });

  it('spectrum: white on top, full colour in the middle, black at the bottom', () => {
    expect(spectrumColor(0, 0)).toBe('#FFFFFF');
    expect(spectrumColor(0, 0.5)).toBe('#FF0000');
    expect(spectrumColor(1 / 3, 0.5)).toBe('#00FF00');
    expect(spectrumColor(0.5, 1)).toBe('#000000');
  });
});
