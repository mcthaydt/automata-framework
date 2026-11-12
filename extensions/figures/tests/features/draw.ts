import { BASE } from '../../base/base';
import type { CharacterDef } from '../../src/features/figure/cast';
import { member, standing, type Frame } from '../../src/features/figure/frames';
import type { Garment } from '../../src/features/outfit/garments';
import type { Material } from '../../src/features/body/parts';

/**
 * What the feature tests of the generic machinery share (tests/features/*): a base figure in a test outfit, drawn from
 * every direction, and the two questions asked of its frames. The machinery reaches no base figure, so each test dresses
 * one in it, draws it with and without, and asks that the frames differ and that a second drawing is the same.
 */
/** The base man in the given garments, and swatches beside the library's. */
export const dressed = (garments: Garment[], swatches?: Record<string, Material>, base = BASE[0].def): CharacterDef =>
  ({ ...base, outfits: { [base.default]: garments }, swatches: { ...base.swatches, ...swatches } });
/** A figure standing, in each of the 8 directions (density 2, so the face and the small marks have room), as one buffer. */
export function turned(def: CharacterDef): Frame {
  const cast = member(def, 2), views = [0, 1, 2, 3, 4, 5, 6, 7].map(d => standing(cast, d));
  const out = new Uint8ClampedArray(views.reduce((n, f) => n + f.length, 0));
  let at = 0;
  for (const f of views) { out.set(f, at); at += f.length; }
  return out;
}
/** Whether two drawings differ in any texel. */
export const differs = (a: Frame, b: Frame) => Buffer.compare(Buffer.from(a), Buffer.from(b)) !== 0;
