import { describe, expect, it } from 'vitest';
import { Figure } from '../../../src/features/figure/figure';
import { member, view } from '../../../src/features/figure/frames';
import { BASE } from '../../../base/base';

/**
 * The cell's depth (Figure.depth): metres toward the camera per texel, for every opaque texel, in every drawing, fresh or
 * from the cell cache. The scene's per-texel depth test reads it (docs/contract.md).
 */
const input = (d: number) => ({ facing: d * Math.PI / 4, moving: false, view: view() });
const drawn = (who: number, D: number, d: number, cache: boolean) => {
  const f = new Figure(member(BASE[who].def, D));
  f.cache = cache;
  f.update(0, input(d));
  return f;
};

describe('Figure.depth', () => {
  it('is finite at every opaque texel, the outline included, in every view', () => {
    for (const who of [0, 1]) for (const D of [1, 2]) for (let d = 0; d < 8; d++) {
      const f = drawn(who, D, d, false);
      let bad = 0;
      for (let i = 0; i < f.depth.length; i++) if (f.painted[i * 4 + 3] && !Number.isFinite(f.depth[i])) bad++;
      expect(bad, `${BASE[who].def.id} D${D} view ${d}`).toBe(0);
    }
  });
  it('is the G-buffer\'s depth where a surface is, and an outline texel takes its nearest neighbour\'s', () => {
    const f = drawn(0, 2, 1, false), [w, h] = f.cell;
    let outline = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = y * w + x;
      if (!f.painted[k * 4 + 3]) { expect(f.depth[k]).toBe(-Infinity); continue; }
      if (Number.isFinite(f.g.depth[k])) { expect(f.depth[k]).toBe(f.g.depth[k]); continue; }
      outline++;
      let near = -Infinity;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const X = x + dx, Y = y + dy;
        if (X >= 0 && X < w && Y >= 0 && Y < h && Number.isFinite(f.g.depth[Y * w + X])) near = Math.max(near, f.g.depth[Y * w + X]);
      }
      if (Number.isFinite(near)) expect(f.depth[k]).toBe(near);
    }
    expect(outline).toBeGreaterThan(100);   // the outline ring is a real share of the cell
  });
  it('a cache hit gives the same depth, colours and normals as a fresh drawing', () => {
    const f = new Figure(member(BASE[0].def, 2));
    f.update(0, input(1)); const first = f.depth.slice();
    f.update(0, input(3));
    f.update(0, input(1));                                                   // a hit: no raster
    expect((f as unknown as { cells: Map<string, unknown> }).cells.size).toBe(2);
    const fresh = drawn(0, 2, 1, false);
    expect(Buffer.compare(Buffer.from(f.depth.buffer), Buffer.from(fresh.depth.buffer))).toBe(0);
    expect(Buffer.compare(Buffer.from(f.depth.buffer), Buffer.from(first.buffer))).toBe(0);
    expect(Buffer.compare(Buffer.from(f.painted), Buffer.from(fresh.painted))).toBe(0);
    for (let i = 0; i < f.normals.length; i += 4) if (f.painted[i + 3]) for (let c = 0; c < 4; c++) expect(f.normals[i + c]).toBe(fresh.normals[i + c]);   // the texels that show (a fresh drawing leaves stale bytes under alpha 0)
  });
});
