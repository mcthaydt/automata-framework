import { describe, expect, it } from 'vitest';
import { BASE } from '../../../base/base';
import { eyeWidth, Figure } from '../../../src/features/figure/figure';
import { member, view } from '../../../src/features/figure/frames';
import type { CharacterDef } from '../../../src/features/figure/cast';

/**
 * The eye's size (figure.ts eyeWidth): the density sizes it (four texels at density 2), capped at a little over half the
 * head's half-width so that a small head does not carry an eye that covers a third of its face. The base pair never reach
 * the cap, which is why no golden moves.
 */
/** The eye width (texels) the painter was handed for a character at density 2, standing and facing the camera. */
function eyeOf(def: CharacterDef): number {
  const f = new Figure(member(def, 2));
  for (let i = 0; i < 3; i++) f.update(1 / 60, { facing: 0, moving: false, view: view() });
  return (f as unknown as { faceStamp: { eye: number; size: number } }).faceStamp.eye;
}

describe('the eye\'s size', () => {
  for (const c of BASE) it(`${c.def.id} keeps its four-texel eye at density 2`, () => {
    expect(eyeOf(c.def)).toBe(4);
  });
  it('a small head (head 0.62 on the base woman, whose half-width is then 6.7 texels) gets a three-texel eye at density 2', () => {
    const def = BASE[1].def;
    expect(eyeOf({ ...def, sliders: { ...def.sliders, head: 0.62 } })).toBe(3);
  });
  it('the cap is the only thing that narrows it: without it the same head would draw four', () => {
    expect(eyeWidth(6.66, 73.8)).toBe(3);
    expect(eyeWidth(7.9, 73.8)).toBe(4);
    expect(eyeWidth(2, 73.8)).toBe(1);   // never under one texel
  });
});
