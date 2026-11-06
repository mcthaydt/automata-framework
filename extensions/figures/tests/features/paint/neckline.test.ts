import { describe, expect, it } from 'vitest';
import { BASE } from '../../../base/base';
import { NECK } from '../../../src/features/outfit/garments';
import { Figure } from '../../../src/features/figure/figure';
import { member, view } from '../../../src/features/figure/frames';
import { gbuffer, neckline, type GBuffer } from '../../../src/features/paint/raster';

/**
 * The neckline rule (raster.ts neckline): where the neck meets a top, a run of one or two texels (2·D at density D, at most 4) of the
 * neck part hanging below the collar line, with the top on both sides and under it, joins the top; as a pixel artist
 * removes a skin tooth from a shirt. It keys on the neck's parts only: a finger, a run too wide, a run with the
 * background beside it are left alone.
 */
const TOP = { part: 0, material: 0 }, NECKP = { part: 1, material: 1 }, FINGER = { part: 2, material: 1 };

/** A buffer `w` wide with a top (part 0, material 0) from row 4 down and the background above. */
function shirt(w: number) {
  const g = gbuffer(w, 8);
  g.part.fill(-1); g.material.fill(-1); g.group.fill(-1);
  for (let y = 4; y < 8; y++) for (let x = 0; x < w; x++) put(g, x, y, TOP);
  return g;
}
const put = (g: GBuffer, x: number, y: number, t: { part: number; material: number }) => { g.part[y * g.w + x] = t.part; g.material[y * g.w + x] = t.material; };
const at = (g: GBuffer, x: number, y: number) => ({ part: g.part[y * g.w + x], material: g.material[y * g.w + x] });
/** The neck's texels at `row`, columns `from`..`to`, with the neck above them. */
function neckRun(g: GBuffer, row: number, from: number, to: number, t = NECKP) {
  for (let x = from; x <= to; x++) { put(g, x, row, t); put(g, x, row - 1, t); }
}

describe('neckline, on a hand-made G-buffer', () => {
  it('a 2-texel neck tooth into a top joins the top', () => {
    const g = shirt(64); neckRun(g, 4, 10, 11);
    neckline(g, new Set([1]));
    expect(at(g, 10, 4)).toEqual(TOP); expect(at(g, 11, 4)).toEqual(TOP);
    expect(at(g, 10, 3)).toEqual(NECKP);                                        // only the tooth, not the neck above it
  });
  it('a run of 2·D + 1 is left alone', () => {
    const g = shirt(64); neckRun(g, 4, 20, 22);
    neckline(g, new Set([1]));
    for (const x of [20, 21, 22]) expect(at(g, x, 4)).toEqual(NECKP);
  });
  it('a run with the background on one side is left alone', () => {
    const g = shirt(64); neckRun(g, 4, 30, 31); put(g, 32, 4, { part: -1, material: -1 });
    neckline(g, new Set([1]));
    expect(at(g, 30, 4)).toEqual(NECKP); expect(at(g, 31, 4)).toEqual(NECKP);
  });
  it('a non-neck part (a finger) is never touched', () => {
    const g = shirt(64); neckRun(g, 4, 40, 41, FINGER);
    neckline(g, new Set([1]));
    expect(at(g, 40, 4)).toEqual(FINGER); expect(at(g, 41, 4)).toEqual(FINGER);
  });
  it('a peg two rows tall goes too, bottom-up', () => {
    const g = shirt(64); neckRun(g, 4, 50, 51); neckRun(g, 5, 50, 51);              // neck at rows 3, 4 and 5
    neckline(g, new Set([1]));
    for (const x of [50, 51]) for (const y of [4, 5]) expect(at(g, x, y), `${x},${y}`).toEqual(TOP);
    expect(at(g, 50, 3)).toEqual(NECKP);
  });
  it('a run under a different material is left alone', () => {
    const g = shirt(64); neckRun(g, 4, 5, 6); put(g, 5, 5, { part: 3, material: 2 });
    neckline(g, new Set([1]));
    expect(at(g, 5, 4)).toEqual(NECKP);
  });
  it('at density 4 the run is capped at 4: a run of 4 joins and a run of 5 (the neck U\'s round bottom) does not', () => {
    const g = shirt(256); neckRun(g, 4, 10, 13); neckRun(g, 4, 30, 34); neckRun(g, 4, 50, 57);
    neckline(g, new Set([1]));
    for (let x = 10; x <= 13; x++) expect(at(g, x, 4)).toEqual(TOP);
    for (const [a, b] of [[30, 34], [50, 57]]) for (let x = a; x <= b; x++) expect(at(g, x, 4), `${x}`).toEqual(NECKP);
  });
  it('at density 2 a run of 4 joins and a run of 5 does not', () => {
    const g = shirt(128); neckRun(g, 4, 10, 13); neckRun(g, 4, 30, 34);
    neckline(g, new Set([1]));
    for (let x = 10; x <= 13; x++) expect(at(g, x, 4)).toEqual(TOP);
    for (let x = 30; x <= 34; x++) expect(at(g, x, 4)).toEqual(NECKP);
  });
});

/** Neck runs of at most min(2·D, 4) texels with one non-neck material on both sides and under every texel: the teeth. */
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
/** The G-buffer part ids of the figure's neck: what soupOf writes (`seam ?? index`) for the parts tagged NECK. */
const necksOf = (f: Figure) => new Set<number>((f as any).built.parts.flatMap((p: { tag?: string; seam?: number }, i: number) => (p.tag === NECK ? [p.seam ?? i] : [])));

describe('the base pair has no neck tooth in its top', () => {
  for (const D of [1, 2, 4]) for (const { def } of BASE) it(`${def.id} at density ${D}: standing in 8 views${D < 4 ? ', and through the walk' : ''}`, () => {
    const cast = member(def, D);
    const f = new Figure(cast), necks = necksOf(f);
    expect(necks.size, 'the body tags a neck').toBeGreaterThan(0);
    for (let d = 0; d < 8; d++) {
      for (let i = 0; i < 3; i++) f.update(1 / 60, { facing: d * Math.PI / 4, moving: false, view: view() });
      expect(teeth(f.g, necks), `view ${d}`).toBe(0);
    }
    if (D > 2) return;                                                                // D4: the 8 standing views only (the walk's run time)
    const w = new Figure({ ...cast, blink: 0 });
    for (let i = 0; i < Math.round(cast.gait.cycle * 4 * 60); i++) {
      w.update(1 / 60, { facing: Math.PI / 4, moving: true, view: view() });
      expect(teeth(w.g, necks), `walk update ${i}`).toBe(0);
    }
  });
});
