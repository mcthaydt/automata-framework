import { describe, expect, it } from 'vitest';
import { BASE } from '../../../base/base';
import { measure } from '../../../src/features/body/genes';
import { NECK } from '../../../src/features/outfit/garments';
import { Figure } from '../../../src/features/figure/figure';
import { member, view } from '../../../src/features/figure/frames';
import type { CharacterDef } from '../../../src/features/figure/cast';
import type { GBuffer } from '../../../src/features/paint/raster';

/**
 * Bust and seat (c4 stage 4): `Sliders.bust` and `Sliders.seat`, 0–1, 0.5 today's body, for any frame (a man's chest and
 * seat vary too). A range of real bodies under the painted blocks: no sexualised extreme, and the blocks always cover.
 */
const TORSO = 3000;                                                  // garments.ts SURFACE: the torso's part id in the G-buffer
const withSliders = (def: CharacterDef, s: Record<string, number>): CharacterDef => ({ ...def, sliders: { ...def.sliders, ...s } });
/** A figure standing in view d: its frame, its G-buffer and its neck's part ids. */
function drawn(def: CharacterDef, d: number) {
  const f = new Figure(member(def, 2));
  for (let i = 0; i < 3; i++) f.update(1 / 60, { facing: d * Math.PI / 4, moving: false, view: view() });
  const necks = new Set<number>((f as any).built.parts.flatMap((p: { tag?: string; seam?: number }, i: number) => (p.tag === NECK ? [p.seam ?? i] : [])));
  return { px: f.painted.slice(), g: f.g as GBuffer, skin: (f as any).built.materialIndex.get(def.skin) as number, necks };
}
/** Neck runs of at most min(2·D, 4) texels with one non-neck material on both sides and under every texel (neckline.test.ts). */
function teeth(g: GBuffer, neck: Set<number>): number {
  const D = Math.max(1, Math.round(g.w / 64)), isNeck = (k: number) => neck.has(g.part[k]);
  let found = 0;
  for (let y = 0; y < g.h - 1; y++) for (let x = 1; x < g.w - 1; x++) {
    const k = y * g.w + x; if (!isNeck(k) || isNeck(k - 1)) continue;
    let n = 0; while (x + n < g.w && isNeck(k + n)) n++;
    if (x + n >= g.w || n > Math.min(2 * D, 4)) { x += n - 1; continue; }
    const m = g.material[k - 1], top = (q: number) => g.part[q] >= 0 && !neck.has(g.part[q]) && g.material[q] === m;
    let ok = top(k - 1) && top(k + n);
    for (let i = 0; ok && i < n; i++) ok = top(k + i + g.w);
    if (ok) found++;
    x += n - 1;
  }
  return found;
}
/** The torso's rows (its texels in the G-buffer, part 3000) in a figure: its first and last, and how many texels each holds. */
const torsoRows = (g: GBuffer) => { const rows: number[] = new Array(g.h).fill(0); for (let k = 0; k < g.w * g.h; k++) if (g.part[k] === TORSO) rows[Math.floor(k / g.w)]++; return rows; };
/** The chest (the top half of the 0.5 figure's torso rows) and the seat (its bottom quarter): the rows one figure fixes for
 * every end, so a deeper seat that reaches further down is measured over the same rows. */
function regions(g: GBuffer) {
  const rows = torsoRows(g), ys = rows.flatMap((n, y) => (n ? [y] : [])), lo = ys[0], hi = ys[ys.length - 1], span = hi - lo + 1;
  return { chest: [lo, lo + Math.floor(span / 2) - 1], seat: [hi - Math.floor(span / 4) + 1, hi] };
}
/** The widest row of the torso's texels over the chest rows and the seat rows. */
function widest(g: GBuffer, r: ReturnType<typeof regions>) {
  const rows = torsoRows(g), over = ([a, b]: number[]) => Math.max(...rows.slice(a, b + 1));
  return { chest: over(r.chest), seat: over(r.seat) };
}
const frameDiffers = (a: Uint8ClampedArray, b: Uint8ClampedArray) => Buffer.compare(Buffer.from(a), Buffer.from(b)) !== 0;

describe('Measure.bust and Measure.seat are exactly the default at 0.5', () => {
  it('every factor is 1 and every offset 0', () => {
    const m = measure({ bust: 0.5, seat: 0.5 });
    expect(m.bust).toEqual({ rz: 1, dz: 0 }); expect(m.seat).toEqual({ rz: 1, dz: 0, rx: 1 });
    expect(measure({}).bust).toEqual({ rz: 1, dz: 0 });
  });
  it('the ends are a real range: bust 0.92–1.15 of the depth, seat 0.93–1.12 deep and 0.94–1.06 wide', () => {
    expect(measure({ bust: 0 }).bust.rz).toBeCloseTo(0.92, 9); expect(measure({ bust: 1 }).bust.rz).toBeCloseTo(1.15, 9);
    expect(measure({ seat: 0 }).seat.rz).toBeCloseTo(0.93, 9); expect(measure({ seat: 1 }).seat.rz).toBeCloseTo(1.12, 9);
    expect(measure({ seat: 0 }).seat.rx).toBeCloseTo(0.94, 9); expect(measure({ seat: 1 }).seat.rx).toBeCloseTo(1.06, 9);
  });
});

describe('bust and seat at either end', () => {
  for (const { def } of BASE) for (const key of ['bust', 'seat'] as const) for (const v of [0, 1]) {
    it(`${def.id} ${key} ${v}: differs from 0.5 in views 1, 2 and 3; the blocks cover; the silhouette stays a body`, () => {
      const base = withSliders(def, { [key]: 0.5 }), end = withSliders(def, { [key]: v });
      for (let d = 0; d < 8; d++) {
        const o = drawn(base, d), e = drawn(end, d);
        if ([1, 2, 3].includes(d)) expect(frameDiffers(o.px, e.px), `view ${d} differs`).toBe(true);
        // The torso (the top over the chest and the waist, the shorts over the seat) never shows the skin's material.
        let skinTexels = 0; for (let k = 0; k < e.g.w * e.g.h; k++) if (e.g.part[k] === TORSO && e.g.material[k] === e.skin) skinTexels++;
        expect(skinTexels, `view ${d} skin in the torso`).toBe(0);
        expect(teeth(e.g, e.necks), `view ${d} neck teeth`).toBe(0);
      }
      for (const d of [0, 2]) {
        const ob = drawn(base, d).g, r = regions(ob), o = widest(ob, r), e = widest(drawn(end, d).g, r);
        expect(e.chest, `view ${d} chest ${e.chest} vs ${o.chest}`).toBeLessThanOrEqual(Math.ceil(1.2 * o.chest));
        expect(e.seat, `view ${d} seat ${e.seat} vs ${o.seat}`).toBeLessThanOrEqual(Math.ceil(1.2 * o.seat));
      }
    });
  }
  for (const { def } of BASE) {
    it(`${def.id}: bust 1 is at least a texel deeper at the chest than bust 0, in profile`, () => {
      const r = regions(drawn(def, 2).g), lo = widest(drawn(withSliders(def, { bust: 0 }), 2).g, r), hi = widest(drawn(withSliders(def, { bust: 1 }), 2).g, r);
      expect(hi.chest - lo.chest).toBeGreaterThanOrEqual(1);
    });
    it(`${def.id}: seat 1 is at least a texel deeper at the seat than seat 0, in profile`, () => {
      const r = regions(drawn(def, 2).g), lo = widest(drawn(withSliders(def, { seat: 0 }), 2).g, r), hi = widest(drawn(withSliders(def, { seat: 1 }), 2).g, r);
      expect(hi.seat - lo.seat).toBeGreaterThanOrEqual(1);
    });
  }
});
