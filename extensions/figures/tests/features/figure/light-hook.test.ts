import { describe, expect, it } from 'vitest';
import { Figure, type FigureLight } from '../../../src/features/figure/figure';
import { member } from '../../../src/features/figure/frames';
import { RAMPS } from '../../../src/features/paint/duel-ramps';
import { BASE } from '../../../base/base';

const cast = member(BASE[0].def, 2);
const input = { facing: 0, moving: false, view: { azimuth: 0, pitch: 18 * Math.PI / 180 } };
const drawn = (light: FigureLight | null) => {
  const f = new Figure(cast);
  f.light = light;
  f.update(0, input);
  return f;
};
const colour = (px: Uint8ClampedArray, i: number) => (px[i] << 16) | (px[i + 1] << 8) | px[i + 2];
const luma = (px: Uint8ClampedArray, i: number) => 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
/** The mean luma of the opaque texels in the columns [x0, x1). */
const mean = (f: Figure, x0 = 0, x1 = f.cell[0]) => {
  let sum = 0, n = 0;
  for (let y = 0; y < f.cell[1]; y++) for (let x = x0; x < x1; x++) { const i = (y * f.cell[0] + x) * 4; if (f.painted[i + 3]) { sum += luma(f.painted, i); n++; } }
  return sum / n;
};
const opaque = (px: Uint8ClampedArray) => { let n = 0; for (let i = 3; i < px.length; i += 4) if (px[i]) n++; return n; };

describe('the light hook', () => {
  const plain = drawn(null);
  it('changes nothing without a light', () => {
    expect(Buffer.from(plain.painted).equals(Buffer.from(drawn(null).painted))).toBe(true);
  });
  it('paints only DUEL colours, with the same silhouette, and drops the key bands', () => {
    const lit = drawn(() => [1, 1, 1]), duel = new Set(RAMPS.flat());
    expect(opaque(lit.painted)).toBe(opaque(plain.painted));
    for (let i = 0; i < lit.painted.length; i += 4) if (lit.painted[i + 3]) expect(duel.has(colour(lit.painted, i))).toBe(true);
    expect(Buffer.from(lit.painted).equals(Buffer.from(plain.painted))).toBe(false);
  });
  it('is darker under a dimmer light', () => {
    expect(mean(drawn(() => [0.5, 0.5, 0.5]))).toBeLessThan(mean(drawn(() => [1, 1, 1])));
  });
  it('lights each place by its own light', () => {
    const f = drawn(p => (p[0] < 0 ? [1.4, 1.4, 1.4] : [0.4, 0.4, 0.4])), mid = f.cell[0] / 2;
    expect(mean(f, 0, mid)).toBeGreaterThan(mean(f, mid));
  });
});
