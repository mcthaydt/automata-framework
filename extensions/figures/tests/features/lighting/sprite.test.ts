import { beforeAll, describe, expect, it } from 'vitest';
import { BASE } from '../../../base/base';
import { Figure } from '../../../src/features/figure/figure';
import { member, view } from '../../../src/features/figure/frames';
import { RAMPS, RAMP_OUTLINE } from '../../../src/features/paint/duel-ramps';
import { depthAt } from '../../../src/features/paint/fabric';
import { onRow, tiled } from '../../../src/features/paint/row';
import { flatSteps, lightSprite, SPRITE_STYLE, type SpriteLighting } from '../../../src/features/lighting/sprite';
import { viewToWorld } from '../../../src/features/lighting/lamps';
import { dressed } from '../draw';
import { type Garment } from '../../../src/features/outfit/garments';
import { registerFixtures } from '../paint/fabric-fixtures';
import type { V3 } from '../../../src/lib/math';

/**
 * `lightSprite` (c8-lit, spec section 5a): a painted cell lit by the room as a sprite. Drawn on the base woman at
 * direction 1, density 2, standing, as the sheets draw her.
 */
const stand = (def = BASE[1].def, d = 1) => {
  const f = new Figure(member(def, 2));
  f.cache = false;
  for (let i = 0; i < 3; i++) f.update(1 / 60, { facing: d * Math.PI / 4, moving: false, view: view() });
  return f;
};
const colourAt = (px: Uint8ClampedArray, k: number) => (px[k * 4] << 16) | (px[k * 4 + 1] << 8) | px[k * 4 + 2];
const grey = (v: number): V3 => [v, v, v];
const LEFT = [{ dir: [-1, 0, 0] as V3, strength: 1 }];
/** A lamp to the left and a little above, in front of the figure: the form needs light on the figure's front for its far side to fall. */
const FRONT_LEFT = [{ dir: [-0.6, 0.3, 0.74] as V3, strength: 1 }];
/** Every filled texel's index. */
const texels = (px: Uint8ClampedArray) => [...Array(px.length / 4).keys()].filter(k => px[k * 4 + 3]);
const stays = (c: number) => c === 0 || c === RAMP_OUTLINE || onRow(c)[1] === 0;

describe('flatSteps', () => {
  it('flatSteps: 1 is no step, 1.6 two up, 0.5 three down, 0 three down', () => {
    expect([1, 1.6, 0.5, 0, 1.17, 0.86].map(v => flatSteps(grey(v)))).toEqual([0, 2, -3, -3, 1, -1]);
  });
  it('a light a little under 1 is no step, and not a negative zero', () => {
    expect(Object.is(flatSteps(grey(0.99)), 0)).toBe(true);
  });
});

describe('lightSprite', () => {
  let f: Figure;
  beforeAll(() => { f = stand(); });

  it('a grey light of 1 with no lamps returns the painted cell', () => {
    expect(Buffer.compare(Buffer.from(lightSprite(f, { flat: grey(1), lamps: [] })), Buffer.from(f.painted))).toBe(0);
  });
  it('under a grey light every texel stays on its own row', () => {
    for (const v of [0.5, 1, 1.6]) {
      const out = lightSprite(f, { flat: grey(v), lamps: LEFT });
      for (const k of texels(f.painted)) expect(onRow(colourAt(out, k))[0], `texel ${k} at ${v}`).toBe(onRow(colourAt(f.painted, k))[0]);
    }
  });
  it('ink, the outline and a row’s darkest step never move', () => {
    for (const v of [1.6, 0.3]) {
      const out = lightSprite(f, { flat: grey(v), lamps: LEFT });
      let held = 0;
      for (const k of texels(f.painted)) if (stays(colourAt(f.painted, k))) { held++; expect(colourAt(out, k), `texel ${k} at ${v}`).toBe(colourAt(f.painted, k)); }
      expect(held).toBeGreaterThan(100);
    }
  });
  it('a brighter room is whole steps up, a darker one whole steps down', () => {
    for (const v of [1.6, 0.5]) {
      const out = lightSprite(f, { flat: grey(v), lamps: [] }), want = flatSteps(grey(v));
      let moved = 0;
      for (const k of texels(f.painted)) {
        const [r0, s0] = onRow(colourAt(f.painted, k));
        if (stays(colourAt(f.painted, k))) continue;
        const [r1, s1] = onRow(colourAt(out, k));
        expect(r1).toBe(r0);
        expect(s1 - s0, `texel ${k} at ${v}`).toBe(Math.max(1, Math.min(7, s0 + want)) - s0);
        if (s1 !== s0) moved++;
      }
      expect(moved).toBeGreaterThan(500);
    }
  });
  it('a lamp from the left: texels facing left a step up, facing right a step down, the left edge rimmed', () => {
    const out = lightSprite(f, { flat: grey(1), lamps: FRONT_LEFT }), N = f.normals;
    const world = (k: number) => viewToWorld([N[k * 4] / 127.5 - 1, 1 - N[k * 4 + 1] / 127.5, N[k * 4 + 2] / 127.5 - 1], f.pitch);
    const delta = (k: number) => onRow(colourAt(out, k))[1] - onRow(colourAt(f.painted, k))[1];
    const movable = texels(f.painted).filter(k => !stays(colourAt(f.painted, k)) && N[k * 4 + 3]);
    const left = movable.filter(k => world(k)[0] < -0.5), right = movable.filter(k => world(k)[0] > 0.5);
    expect(left.length).toBeGreaterThan(20);
    expect(right.length).toBeGreaterThan(20);
    expect(left.filter(k => delta(k) > 0).length).toBeGreaterThan(left.length / 2);
    expect(right.filter(k => delta(k) < 0).length).toBeGreaterThan(right.length / 2);
    // The left silhouette: the painter outlines it (a held texel), so a movable texel with nothing at its left, or nothing
    // past one held texel. Most take the rim (a lone one settles back).
    const [w] = f.cell, empty = (k: number, x: number) => x < 0 || !f.painted[k * 4 + 3];
    const edge = movable.filter(k => empty(k - 1, (k % w) - 1) || (stays(colourAt(f.painted, k - 1)) && empty(k - 2, (k % w) - 2)));
    expect(edge.length).toBeGreaterThan(3);
    expect(edge.filter(k => delta(k) > 0).length).toBeGreaterThan(edge.length / 2);
  });
  it('a lamp along the view axis rims nothing', () => {
    // With the rim switched off (a share no lamp can reach) the picture is the same: nothing was rimmed.
    const lamps = [{ dir: [0.1, 0.05, 0.99] as V3, strength: 1 }];
    const a = lightSprite(f, { flat: grey(1), lamps }), b = lightSprite(f, { flat: grey(1), lamps, style: { ...SPRITE_STYLE, rim: 99 } });
    expect(Buffer.compare(Buffer.from(a), Buffer.from(b))).toBe(0);
    // ...and the same lamp turned to the left does rim, so the comparison can tell.
    const c = lightSprite(f, { flat: grey(1), lamps: LEFT }), d = lightSprite(f, { flat: grey(1), lamps: LEFT, style: { ...SPRITE_STYLE, rim: 99 } });
    expect(Buffer.compare(Buffer.from(c), Buffer.from(d))).not.toBe(0);
  });
  it('exposure takes whole steps off', () => {
    const a = lightSprite(f, { flat: grey(1.6), lamps: [], exposure: 2 }), b = lightSprite(f, { flat: grey(1), lamps: [] });
    expect(Buffer.compare(Buffer.from(a), Buffer.from(b))).toBe(0);
  });
  it('a warm light tints through grade and stays in DUEL', () => {
    const warm = lightSprite(f, { flat: [1, 0.8, 0.55], lamps: [] }), plain = lightSprite(f, { flat: grey(1), lamps: [] });
    const duel = new Set(RAMPS.flat()).add(0).add(RAMP_OUTLINE);
    for (const k of texels(warm)) expect(duel.has(colourAt(warm, k)), `texel ${k}`).toBe(true);
    expect(texels(warm).some(k => colourAt(warm, k) !== colourAt(plain, k))).toBe(true);
  });
  it('no light at all: dark, finite, no throw', () => {
    const out = lightSprite(f, { flat: [0, 0, 0], lamps: [] });
    expect(Array.from(out).every(Number.isFinite)).toBe(true);
    for (const k of texels(f.painted)) {
      if (stays(colourAt(f.painted, k))) continue;
      const [, s0] = onRow(colourAt(f.painted, k)), [, s1] = onRow(colourAt(out, k));
      expect(s1, `texel ${k}`).toBe(Math.max(1, s0 - 3));
    }
    expect(Array.from(lightSprite(f, { flat: [NaN, 0, 0], lamps: [] })).every(Number.isFinite)).toBe(true);
  });
  it('a cell with no normals under a side lamp is lit flat', () => {
    const blind = { painted: f.painted, normals: new Uint8ClampedArray(f.normals.length), cell: f.cell, feet: f.feet, metres: f.metres, pitch: f.pitch, weave: null };
    const side = lightSprite(blind, { flat: grey(1), lamps: LEFT });
    expect(Array.from(side).every(Number.isFinite)).toBe(true);
    // No form from a mean of nothing, and no rim for a texel with no normal: the same as no lamps at all.
    expect(Buffer.compare(Buffer.from(side), Buffer.from(lightSprite(blind, { flat: grey(1), lamps: [] })))).toBe(0);
  });
  it('deterministic: two calls give equal bytes; the inputs are unchanged', () => {
    const before = f.painted.slice(), nBefore = f.normals.slice(), L: SpriteLighting = { flat: [1.3, 1.1, 0.8], lamps: [{ dir: [-0.8, 0.4, 0.45], strength: 0.8 }] };
    const a = lightSprite(f, L), b = lightSprite(f, L);
    expect(Buffer.compare(Buffer.from(a), Buffer.from(b))).toBe(0);
    expect(Buffer.compare(Buffer.from(f.painted), Buffer.from(before))).toBe(0);
    expect(Buffer.compare(Buffer.from(f.normals), Buffer.from(nBefore))).toBe(0);
    expect(a).not.toBe(f.painted);
  });
  it('the eyes (a gate aid): which dark painted colours are stepped under a bright flat light', () => {
    const out = lightSprite(f, { flat: grey(1.6), lamps: [] }), seen = new Map<number, number>();
    for (const k of texels(f.painted)) {
      const c = colourAt(f.painted, k), peak = Math.max(c >> 16, (c >> 8) & 255, c & 255);
      if (peak <= 40 && colourAt(out, k) !== c) seen.set(c, (seen.get(c) ?? 0) + 1);
    }
    console.log('colours of peak 40 or less that flat 1.6 steps:', [...seen].map(([c, n]) => `#${c.toString(16).padStart(6, '0')}×${n}`).join(' ') || 'none');
    expect(true).toBe(true);
  });
});

describe('lightSprite on a fabric', () => {
  const outfit: Garment[] = [{ top: 'fxtwill', sleeves: 'long' }, { shorts: 'fxtwill' }];
  it('a tiled cloth lights its ground and keeps its tile', () => {
    registerFixtures();
    const cloth = stand(dressed(outfit, { fxtwill: { ramp: 26, base: 3, fabric: 'fx-twill' } }), 0), w = cloth.weave!;
    // A grey light, so no texel is tinted; the cloth's ground is lit as if it were the painted colour, and the tile laid after.
    const L: SpriteLighting = { flat: grey(1.17), lamps: FRONT_LEFT };
    const out = lightSprite(cloth, L);
    const ground = w.ground.map((v, i) => (i % 4 === 3 ? cloth.painted[i] : w.on[i >> 2] ? v : cloth.painted[i]));
    const lit = lightSprite({ ...cloth, painted: new Uint8ClampedArray(ground), weave: null }, L);
    let on = 0;
    for (const k of texels(out)) {
      if (!w.on[k]) continue;
      on++;
      expect(colourAt(out, k), `texel ${k}`).toBe(tiled(colourAt(lit, k), w.labels[k], ...depthAt(w, k)));
    }
    expect(on).toBeGreaterThan(300);
  });
  it('two fabrics of different depth each keep their own tile when lit (the weave holds a table of depths)', () => {
    registerFixtures();
    // fx-twill reaches one step in, fx-check one step either way: their depths differ, so the weave's `on` holds 1 and 2.
    const cloth = stand(
      dressed([{ top: 'fxtwill', sleeves: 'long' }, { shorts: 'fxcheck' }], {
        fxtwill: { ramp: 26, base: 3, fabric: 'fx-twill' },
        fxcheck: { ramp: 24, base: 3, fabric: 'fx-check' },
      }),
      0,
    ), w = cloth.weave!;
    expect(w.depths.length, 'two depths in the table').toBe(2);
    const L: SpriteLighting = { flat: grey(1.17), lamps: FRONT_LEFT };
    const out = lightSprite(cloth, L);
    const ground = w.ground.map((v, i) => (i % 4 === 3 ? cloth.painted[i] : w.on[i >> 2] ? v : cloth.painted[i]));
    const lit = lightSprite({ ...cloth, painted: new Uint8ClampedArray(ground), weave: null }, L);
    let second = 0;
    for (const k of texels(out)) {
      if (!w.on[k]) continue;
      if (w.on[k] === 2) second++;
      expect(colourAt(out, k), `texel ${k} (depth ${w.on[k]})`).toBe(tiled(colourAt(lit, k), w.labels[k], ...depthAt(w, k)));
    }
    expect(second, 'texels of the second depth').toBeGreaterThan(50);
  });
});
