import { describe, expect, it } from 'vitest';
import { compose, type StageFrame } from '../../../src';
import { CASES, wallBackdrop } from '../../../viewer/cases';
import { coloursOf } from './fixtures';

/**
 * The per-texel depth cases view-check draws on the GPU (viewer/cases.ts), asked of the CPU reference: that each really
 * exercises what it is named for, so a GPU that merely matched `compose` on an empty frame could not pass them.
 */
/** The old rule: each sprite wholly over the earlier, in the frame's order. */
const painters = (fr: StageFrame) => {
  const out = new Uint8ClampedArray(fr.camera.size[0] * fr.camera.size[1] * 4);
  for (const s of fr.sprites) {
    const one = compose({ ...fr, sprites: [s] });
    for (let i = 0; i < one.length; i += 4) if (one[i + 3]) out.set(one.subarray(i, i + 4), i);
  }
  return out;
};
const differing = (a: Uint8ClampedArray, b: Uint8ClampedArray) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]) n++; return n; };

describe('the depth cases', () => {
  it('overlap: the walking woman\'s nearer arm shows in front of the standing man, texel by texel, not quad by quad', () => {
    const fr = CASES.overlap.frame();
    expect(fr.sprites.map(s => s.name)).toEqual(['base-f', 'base-m']);   // she is the farther: drawn first
    expect(differing(compose(fr), painters(fr))).toBeGreaterThan(100);
  });
  it('tie/same: two cells tied at every texel resolve to the later sprite', () => {
    const fr = CASES['tie/same'].frame(), out = compose(fr), [first, later] = fr.sprites;
    expect(differing(out, compose({ ...fr, sprites: [later] }))).toBe(0);
    expect(differing(out, compose({ ...fr, sprites: [first] }))).toBeGreaterThan(1000);
  });
  for (const name of ['wall', 'gameplay/wall/0']) it(`${name}: a wall quad cuts through the legs: hidden behind it, shown in front, the wall itself where nothing is nearer`, () => {
    const c = CASES[name], fr = c.frame(), wall = c.wall!, back = wallBackdrop(fr.camera, wall);
    const withWall = compose(fr, back), without = compose(fr), alone = compose({ ...fr, sprites: [] }, back);
    const wallColour = wall.rgba[0] << 16 | wall.rgba[1] << 8 | wall.rgba[2];
    expect(coloursOf(alone)).toEqual(new Set([wallColour]));                          // the wall is one colour
    let hidden = 0, shown = 0;
    for (let i = 0; i < without.length; i += 4) if (alone[i + 3] && without[i + 3]) { if (differing(withWall.subarray(i, i + 4), without.subarray(i, i + 4))) hidden++; else shown++; }
    expect(hidden).toBeGreaterThan(30);    // figure texels the wall hides
    expect(shown).toBeGreaterThan(30);     // figure texels in front of the wall, where the legs pass through it
  });
});
