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

/** A figure drawn mid-stride: one walking step of 0.7 s from standing. */
const walking = (who: number, D: number, d: number) => {
  const f = new Figure(member(BASE[who].def, D));
  f.cache = false;
  f.update(0.7, { facing: d * Math.PI / 4, moving: true, view: view() });
  return f;
};

/** The depth an outline texel (opaque, no surface of its own) must take: its nearest surface's, searching the ring that
 * first holds one, however far; null for a cell with no surface at all. */
const nearestSurface = (f: Figure, x: number, y: number) => {
  const [w, h] = f.cell, z = f.g.depth;
  for (let r = 1; r < Math.max(w, h); r++) {
    let best = -Infinity;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const X = x + dx, Y = y + dy;
      if (X >= 0 && X < w && Y >= 0 && Y < h && z[Y * w + X] > best) best = z[Y * w + X];
    }
    if (best > -Infinity) return { best, r };
  }
  return null;
};

/** The frames the fallback is checked on, per density: the woman standing at four bearings and each of the pair mid-stride.
 * At D4 these are where the old three-texel search left texels on the root's plane. */
const FRAMES: { who: number; d: number; walk: boolean }[] = [
  ...[1, 3, 5, 7].map(d => ({ who: 1, d, walk: false })), { who: 0, d: 3, walk: true }, { who: 1, d: 1, walk: true },
];

describe('Figure.depth', () => {
  it.each([1, 2, 4])('never leaves an opaque texel at the fallback plane: an outline texel takes its nearest surface\'s depth, at D%i', D => {
    let far = 0;                                                  // outline texels whose nearest surface is beyond 3 texels
    const bad: string[] = [];                                     // collected, asserted once: an expect() a texel costs seconds at D4
    for (const { who, d, walk } of FRAMES) {
      const f = walk ? walking(who, D, d) : drawn(who, D, d, false), [w, h] = f.cell, id = `${BASE[who].def.id} view ${d} ${walk ? 'walk' : 'stand'}`;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const k = y * w + x;
        if (!f.painted[k * 4 + 3] || Number.isFinite(f.g.depth[k])) continue;
        const near = nearestSurface(f, x, y);
        if (!near) { bad.push(`${id} (${x},${y}): no surface anywhere`); continue; }
        if (near.r > 3) far++;
        if (f.depth[k] !== near.best) bad.push(`${id} (${x},${y}): ${f.depth[k]}, wanted ${near.best}`);
      }
    }
    expect(bad.slice(0, 5)).toEqual([]);
    if (D === 4) expect(far).toBeGreaterThan(0);                  // the case that was 67 texels of depth 0 at D4
  });
  it.each([1, 2, 4])('is finite at every opaque texel, the outline included, in every view, at D%i', D => {
    let bad = 0;
    for (const who of [0, 1]) for (let d = 0; d < 8; d++) {
      const f = drawn(who, D, d, false);
      for (let i = 0; i < f.depth.length; i++) if (f.painted[i * 4 + 3] && !Number.isFinite(f.depth[i])) bad++;
    }
    expect(bad).toBe(0);
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
  it('a walking actor drawn with the cell cache and without gives the same rgba and depth at every revisit, at D1 and D2', async () => {
    const { ScriptedActor } = await import('../../../src/features/actors/actor');
    for (const D of [1, 2]) {
      const cached = new ScriptedActor({ who: 'base-m', at: [0, 0], path: [{ at: [2, 0] }] }), fresh = new ScriptedActor({ who: 'base-m', at: [0, 0], path: [{ at: [2, 0] }] }, { cache: false });
      let diff = 0;
      for (let i = 0; i < 24; i++) for (const az of [0, 1]) {
        const t = (i % 8) / 10, v = { azimuth: az * Math.PI / 4, pitch: 18 * Math.PI / 180 };   // t repeats: revisits hit the cache
        const a = cached.draw(t, v, D, null), b = fresh.draw(t, v, D, null);
        if (Buffer.compare(Buffer.from(a.painted), Buffer.from(b.painted)) || Buffer.compare(Buffer.from(a.depth.buffer), Buffer.from(b.depth.buffer))) diff++;
      }
      expect(diff, `D${D}`).toBe(0);
    }
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
