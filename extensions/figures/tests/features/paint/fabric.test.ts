import { beforeAll, describe, expect, it } from 'vitest';
import { BASE } from '../../../base/base';
import { GROUP } from '../../../src/features/body/parts';
import { Figure } from '../../../src/features/figure/figure';
import { member, standing } from '../../../src/features/figure/frames';
import { SWATCHES, type Garment } from '../../../src/features/outfit/garments';
import { fabricOf, labelAt, registerFabric } from '../../../src/features/paint/fabric';
import { duel, tonesOf } from '../../../src/features/paint/paint';
import { registerGarment, box } from '../../../src/features/outfit/garments';
import { J } from '../../../src/features/body/rig';
import { lightFigure } from '../../../src/features/lighting/light';
import { TIMES } from '../../../src/features/lighting/lamps';
import { dressed, differs, turned } from '../draw';
import { FIXTURES, registerFixtures } from './fabric-fixtures';

describe('the fabric registry (H5)', () => {
  it('rejects a deep motif', () => {
    expect(() => registerFabric('deep', { w: 2, h: 2, labels: [0, -2, 0, 0] })).toThrow(/motif/);
  });
  it('rejects a wrong number of labels', () => {
    expect(() => registerFabric('short', { w: 3, h: 3, labels: [0] })).toThrow(/labels/);
  });
  it('rejects a non-integer label', () => {
    expect(() => registerFabric('half', { w: 2, h: 1, labels: [0, -0.5] })).toThrow();
  });
  it('rejects a pattern label above +1', () => {
    expect(() => registerFabric('loud', { w: 8, h: 1, labels: [0, 2, 0, 0, 0, 0, 0, 0] })).toThrow();
  });
  it('accepts a pattern from -2 to +1, and returns it', () => {
    registerFabric('photo', { w: 8, h: 1, labels: [-2, -1, 0, 1, 0, 0, 0, 0] });
    expect(fabricOf('photo')!.labels).toEqual([-2, -1, 0, 1, 0, 0, 0, 0]);
  });
  it('rejects a motif with a +1 and a 4×4 at -2, and accepts a 5×4 at -2', () => {
    expect(() => registerFabric('edge-plus', { w: 2, h: 2, labels: [0, 1, 0, 0] })).toThrow(/motif/);
    expect(() => registerFabric('edge-44', { w: 4, h: 4, labels: [-2, ...new Array(15).fill(0)] })).toThrow(/motif/);
    registerFabric('edge-54', { w: 5, h: 4, labels: [-2, ...new Array(19).fill(0)] });
    expect(fabricOf('edge-54')!.labels[0]).toBe(-2);
  });
  it('rejects a tile of no metres and a tile of no width', () => {
    expect(() => registerFabric('edge-m0', { w: 2, h: 1, labels: [0, -1], metres: 0 })).toThrow(/metres/);
    expect(() => registerFabric('edge-w0', { w: 0, h: 1, labels: [] })).toThrow(/whole numbers/);
  });
  it('rejects a taken name', () => {
    expect(() => registerFabric('photo', { w: 1, h: 1, labels: [0] })).toThrow(/registered/);
  });
  it('registers the fixtures twice without throwing, and the twill is one step deep', () => {
    registerFixtures(); registerFixtures();
    expect(new Set(fabricOf('fx-twill')!.labels)).toEqual(new Set([0, -1]));
    expect(FIXTURES.check.labels.length).toBe(64);
  });
  it('labelAt reads a texel-size tile, with positive mods', () => {
    expect(labelAt(FIXTURES.rib, 1.5 / 73.8, 0, 73.8)).toBe(-1);
    expect(labelAt(FIXTURES.rib, -0.5 / 73.8, 0, 73.8)).toBe(-1);
    expect(labelAt(FIXTURES.rib, 0.5 / 73.8, 0, 73.8)).toBe(0);
  });
  it('labelAt keeps a physical-size tile at its metres', () => {
    const f = { ...FIXTURES.rib, metres: 0.01 };
    expect(labelAt(f, 0.015, 0, 73.8)).toBe(-1);
    expect(labelAt(f, 0.015, 0, 147.6)).toBe(-1);
  });
});

const KEYS = ['check', 'twill', 'rib', 'across'] as const;
const swatchOf = (key: string) => ({ ramp: 10, base: 3, fabric: `fx-${key}` });
const PLAIN = { ramp: 10, base: 3 };
const SWATCHES_FX = Object.fromEntries(KEYS.map(k => [`fx${k}`, swatchOf(k)]));
const outfit = (swatch: string): Garment[] => [{ top: swatch, sleeves: 'long' }, { shorts: swatch }];
const colourAt = (px: Uint8ClampedArray, i: number) => (px[i] << 16) | (px[i + 1] << 8) | px[i + 2];
const input = { facing: 0, moving: false, view: { azimuth: 0, pitch: 18 * Math.PI / 180 } };

describe('fabrics drawn', () => {
  beforeAll(() => {
    registerFixtures();
    registerGarment('fxcap', { build: (c, item) => ({ parts: [box(J.head, (item as unknown as { fxcap: string }).fxcap, GROUP.head, { at: [0, c.s.genes.head * 1.0, 0.02], r: [0.1, 0.06, 0.1] })], decals: [] }) });
  });
  for (const key of KEYS) it(`${key} changes the drawing, and a second drawing is the same`, () => {
    const tiled = turned(dressed(outfit(`fx${key}`), SWATCHES_FX)), plain = turned(dressed(outfit('plain'), { plain: PLAIN }));
    expect(differs(tiled, plain)).toBe(true);
    expect(differs(tiled, turned(dressed(outfit(`fx${key}`), SWATCHES_FX)))).toBe(false);
  });
  it('with nothing named, registering fabrics changes nothing', () => {
    const before = turned(dressed([]));
    registerFabric('unused-probe', { w: 2, h: 1, labels: [0, -1] });
    expect(differs(before, turned(dressed([])))).toBe(false);
  });
  it('a fabric on the hair, a head part or a held item changes nothing', () => {
    // Each outfit also wears a tiled top, so the cloth path really runs; what is under test is the head and the item.
    const base = BASE[0].def.outfits.base, top: Garment = { top: 'fxrib', sleeves: 'long' };
    const withHair = (sw: string): Garment[] => [top, ...base.map(g => ('hair' in g ? { ...g, hair: sw } : g))];
    const fxHair = { ...SWATCHES.hairBlack, fabric: 'fx-check' };
    const hairDef = dressed(withHair('fxHair'), { ...SWATCHES_FX, fxHair }), plainHair = dressed(withHair('hairBlack'), SWATCHES_FX);
    expect(new Figure(member(hairDef, 2))['built'].cloth).not.toBeNull();
    expect(differs(turned(hairDef), turned(plainHair))).toBe(false);
    // A head part (a fork's cap) in a fabric: the head group has no cylinder.
    const cap = (sw: string) => dressed([top, { fxcap: sw } as unknown as Garment], { ...SWATCHES_FX, capFx: { ramp: 10, base: 3, fabric: 'fx-check' }, capPlain: PLAIN });
    expect(differs(turned(cap('capPlain')), turned(dressed([top], SWATCHES_FX)))).toBe(true);
    expect(differs(turned(cap('capFx')), turned(cap('capPlain')))).toBe(false);
    const torch = (def: ReturnType<typeof dressed>) => {
      const f = new Figure(member(def, 2));
      f.wear(f.outfit, 'torch');
      for (let i = 0; i < 3; i++) f.update(1 / 60, input);
      return f;
    };
    const wood = { wood: { ...SWATCHES.wood, fabric: 'fx-check' } };
    const withFx = torch(dressed(base, wood)), without = torch(dressed(base));
    expect(withFx['built'].cloth).not.toBeNull();
    expect(differs(withFx.painted, without.painted)).toBe(false);
  });
  it('tiled texels stay on their ramp: in every view, the cloth\'s texels use only colours the plain cloth uses there', () => {
    // Audit S2. Per view, the allowed set is the plain drawing's colours at the cloth's own texels (its material), the swatch's own
    // ramp (a tile can reach its deep tone where the plain view never does) and ink;
    // a tile that picked another ramp (the skin's, a neighbour's at an outline) puts a colour in that is not in it.
    const drawnAt = (def: ReturnType<typeof dressed>, d: number) => {
      const f = new Figure(member(def, 2));
      f.cache = false;
      for (let i = 0; i < 3; i++) f.update(1 / 60, { ...input, facing: d * Math.PI / 4 });
      return f;
    };
    const ink = duel(0x000000);
    let tiledTexels = 0;
    for (let d = 0; d < 8; d++) {
      const tiled = drawnAt(dressed(outfit('fxrib'), SWATCHES_FX), d), plain = drawnAt(dressed(outfit('plain'), { plain: PLAIN }), d);
      const mt = tiled['built'].materialIndex.get('fxrib')!, mp = plain['built'].materialIndex.get('plain')!;
      const allowed = new Set<number>([ink, ...tonesOf(PLAIN).map(c => duel(c))]);
      for (let k = 0; k < plain.g.material.length; k++) if (plain.g.material[k] === mp && plain.painted[k * 4 + 3]) allowed.add(colourAt(plain.painted, k * 4));
      for (let k = 0; k < tiled.g.material.length; k++) {
        if (tiled.g.material[k] !== mt || !tiled.painted[k * 4 + 3]) continue;
        tiledTexels++;
        expect(allowed.has(colourAt(tiled.painted, k * 4)), `view ${d} texel ${k}`).toBe(true);
      }
    }
    expect(tiledTexels).toBeGreaterThan(1000);
  });
  it('the rib survives the colour budget: a good share of the top changes', () => {
    const top = (sw: object | null) => standing(member(dressed([{ top: 'topSw', sleeves: 'long' }], sw ? { topSw: sw as never } : { topSw: PLAIN }), 2), 0);
    const bare = standing(member(dressed([]), 2), 0), worn = top(null), ribbed = top(swatchOf('rib'));
    let inTop = 0, changed = 0;
    for (let i = 0; i < worn.length; i += 4) {
      if (!worn[i + 3] || colourAt(worn, i) === colourAt(bare, i)) continue;
      inTop++;
      if (colourAt(worn, i) !== colourAt(ribbed, i)) changed++;
    }
    expect(inTop).toBeGreaterThan(200);
    expect(changed / inTop).toBeGreaterThanOrEqual(0.15);
  });
  it('lit by the light hook, tiled differs from untiled, and a second drawing is the same', () => {
    const lit = (def: ReturnType<typeof dressed>) => {
      const f = new Figure(member(def, 2));
      f.light = () => [1, 0.9, 0.8];
      f.update(0, input);
      return f.painted.slice();
    };
    const tiled = lit(dressed(outfit('fxrib'), SWATCHES_FX));
    expect(differs(tiled, lit(dressed(outfit('plain'), { plain: PLAIN })))).toBe(true);
    expect(differs(tiled, lit(dressed(outfit('fxrib'), SWATCHES_FX)))).toBe(false);
  });
  it('lit by a time of day and a lamp, the tiled top\'s texels use only colours the untiled top uses lit (N11)', () => {
    const lighting = { time: TIMES.dusk, lamps: [{ at: [-1.2, 1.5, 0.8] as [number, number, number], color: '#ffbc4e', steps: 3, radius: 3.2, tint: 0.4 }], t: 0 };
    const litTop = (swatch: string, sw: Record<string, object>) => {
      const f = new Figure(member(dressed(outfit(swatch), sw as never), 2));
      f.cache = false;
      for (let i = 0; i < 3; i++) f.update(1 / 60, input);
      const out = lightFigure(f, lighting), top = f['built'].materialIndex.get(swatch)!, set = new Set<number>();
      for (let k = 0; k < f.g.material.length; k++) if (f.g.material[k] === top && out[k * 4 + 3]) set.add(colourAt(out, k * 4));
      return set;
    };
    const tiled = litTop('fxrib', SWATCHES_FX), plain = litTop('plain', { plain: PLAIN });
    expect(tiled.size).toBeGreaterThan(1);
    expect([...tiled].filter(c => !plain.has(c)).map(c => c.toString(16))).toEqual([]);
  });
  it('a texel-size tile keeps its texel period at every density', () => {
    for (const D of [1, 2, 4]) {
      const f = new Figure(member(dressed([{ top: 'fxrib', sleeves: 'long' }], SWATCHES_FX), D));
      f.cache = false; f.update(0, { ...input, view: { azimuth: 0, pitch: 0 } });
      const ppm = 36.9 * D, rib = FIXTURES.rib;
      let n = 0, dark = 0;
      for (let k = 0; k < f.g.w * f.g.h; k++) {
        const at = f.clothAt(k);
        if (!at || f.g.group[k] !== GROUP.torso) continue;
        n++; if (labelAt(rib, at[0], at[1], ppm) === -1) dark++;
      }
      expect(n, `D${D}`).toBeGreaterThan(100);
      expect(Math.abs(dark / n - 0.5), `D${D}`).toBeLessThan(0.15);
    }
  });
  it('a physical-size tile keeps its size: its period in texels doubles from D2 to D4', () => {
    registerFabric('fx-across-m', { ...FIXTURES.across, metres: 1 / 73.8 });
    const sw = { fxm: { ramp: 10, base: 3, fabric: 'fx-across-m' } };
    for (const [D, run] of [[2, 1], [4, 2]] as const) {
      const f = new Figure(member(dressed([{ top: 'fxm', sleeves: 'long' }], sw), D));
      f.cache = false; f.update(0, { ...input, view: { azimuth: 0, pitch: 0 } });
      const lab = (k: number) => { const at = f.clothAt(k); return at && f.g.group[k] === GROUP.torso ? labelAt(fabricOf('fx-across-m')!, at[0], at[1], 36.9 * D) : null; };
      let runs = 0, good = 0;
      for (let x = 0; x < f.g.w; x++) {
        let prev: number | null = null, len = 0;
        const close = () => { if (len) { runs++; if (len === run) good++; } };
        for (let y = 0; y < f.g.h; y++) {
          const l = lab(y * f.g.w + x);
          if (l !== null && l === prev) len++; else { close(); len = l === null ? 0 : 1; }
          prev = l;
        }
        close();
      }
      expect(runs, `D${D}`).toBeGreaterThan(50);
      expect(good / runs, `D${D}`).toBeGreaterThanOrEqual(0.9);
    }
  });
});
