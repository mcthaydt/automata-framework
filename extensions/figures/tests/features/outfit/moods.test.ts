import { describe, expect, it } from 'vitest';
import { BASE } from '../../../base/base';
import { Figure, type FigureInput } from '../../../src/features/figure/figure';
import { member, view } from '../../../src/features/figure/frames';
import type { Expression } from '../../../src/features/outfit/garments';
import { differs } from '../draw';

/**
 * The drawn face's moods (paint.ts stampFace, figure.ts face): smile and dead lids, angry and surprised brows, the lips
 * parted in 'talk', and the eyes to one side or just off the camera, which a character takes as `expression` or as
 * `mood` tags beside it. The base pair draw their faces but only in the stock expressions, so each mood is drawn here
 * against the neutral face, from the front at density 2 (the face is big enough there to carry every one), and drawn
 * twice to the same texels. (The actors golden samples talk's open mouth in its `script` case; this test is the guard for every other mood.)
 */
/** The base man's face from the front, at a clock where `talk`'s mouth is open (floor(t · 6) even), with the given mood. */
function face(expression: Expression, mood?: string[]): Uint8ClampedArray {
  const f = new Figure(member(BASE[0].def, 2)), input: FigureInput = { facing: 0, moving: false, view: view(), expression, mood, clock: 0 };
  for (let i = 0; i < 3; i++) f.update(1 / 60, input);
  return f.painted.slice();
}

/** How many texels of the base man's face (density 2) are his drawn face's lash or iris colour (figure.ts drawnFace). */
function count(expression: Expression, colour: 'lash' | 'iris'): number {
  const f = new Figure(member(BASE[0].def, 2)), input: FigureInput = { facing: 0, moving: false, view: view(), expression, clock: 0 };
  for (let i = 0; i < 3; i++) f.update(1 / 60, input);
  const rgb: number = (f as unknown as { built: { face: Record<string, number> } }).built.face[colour];
  let n = 0;
  for (let i = 0; i < f.painted.length; i += 4) if (((f.painted[i] << 16) | (f.painted[i + 1] << 8) | f.painted[i + 2]) === rgb) n++;
  return n;
}

/** The expressions the drawn face draws (fear and sad change the face's marks only, faces.test.ts: the drawn face stays as neutral's). */
const DRAWN: Expression[] = ['smile', 'dead', 'angry', 'surprised', 'talk'];

describe('the drawn face\'s moods', () => {
  const neutral = face('neutral');
  for (const e of DRAWN) it(`${e} differs from neutral`, () => {
    expect(differs(face(e), neutral)).toBe(true);
    expect(differs(face(e), face(e)), 'repeatable').toBe(false);
  });
  for (const tag of ['lookL', 'lookR', 'beside']) it(`the eyes ${tag} differ from looking ahead`, () => {
    expect(differs(face('neutral', [tag]), neutral)).toBe(true);
    expect(differs(face('neutral', [tag]), face('neutral', [tag]))).toBe(false);
  });
  it('lookL and lookR look different ways', () => {
    expect(differs(face('neutral', ['lookL']), face('neutral', ['lookR']))).toBe(true);
  });
  it('a dead eye shows its iris under the lid, not a black pupil row', () => {
    // The live eye's iris is two texels wide, its top row the lash's dark (48 lash texels in all); the dead eye's lid
    // hides the whites and the iris stares out in its own colour, so each of the two eyes trades its two lash texels
    // for iris ones (44). Before the fix the dead eye drew all 48 and its iris sat a row lower.
    expect(count('dead', 'lash')).toBe(count('neutral', 'lash') - 4);
    expect(count('dead', 'iris')).toBeGreaterThanOrEqual(count('neutral', 'iris'));
  });
  it('talk with another expression parts the lips of it', () => {
    expect(differs(face('angry', ['talk']), face('angry'))).toBe(true);
  });
});

/**
 * The small face's open mouth (density 1, paint.ts lips, `!big`): its dark row keeps a texel of the face's own skin between
 * its ends and the jaw's outline (a mouth that runs into the outline reads as a wider mouth, a gash), but never shrinks
 * below one texel, so talk still shows. Per view, the base man's face against the neutral one.
 */
describe('talk at density 1', () => {
  /** The base man's face at D1, facing `d` eighths of a turn round, at a clock where `talk`'s mouth is open. */
  const draw = (expression: Expression, d: number) => {
    const cast = member(BASE[0].def, 1), f = new Figure(cast), input: FigureInput = { facing: d * Math.PI / 4, moving: false, view: view(), expression, clock: 0 };
    for (let i = 0; i < 3; i++) f.update(1 / 60, input);
    const lash: number = (f as unknown as { built: { face: Record<string, number> } }).built.face.lash;
    return { px: f.painted.slice(), w: cast.cell[0], h: cast.cell[1], lash };
  };
  const rgb = (px: Uint8ClampedArray, k: number) => (px[k * 4] << 16) | (px[k * 4 + 1] << 8) | px[k * 4 + 2];
  /** The texels the mouth's dark added to the neutral face, and the neutral texels left and right of each run of them that are not skin (the outline). */
  function touching(d: number) {
    const t = draw('talk', d), n = draw('neutral', d), added: number[] = [];
    for (let k = 0; k < t.w * t.h; k++) if (rgb(t.px, k) === t.lash && rgb(n.px, k) !== t.lash) added.push(k);
    const set = new Set(added), dark = (k: number) => n.px[k * 4 + 3] > 0 && n.px[k * 4] + n.px[k * 4 + 1] + n.px[k * 4 + 2] < 150;
    const hits = added.filter(k => (!set.has(k - 1) && dark(k - 1)) || (!set.has(k + 1) && dark(k + 1)));
    return { added, hits };
  }
  // The profile (view 2) is left out: its chin's row is two texels wide with the outline on both sides, so no place for the
  // dark avoids it; it keeps its one texel (the second test).
  for (const d of [0, 1, 3, 4, 5, 6, 7]) it(`view ${d}: the mouth's dark row does not touch the jaw's outline`, () => {
    expect(touching(d).hits.map(k => [k % 64, Math.floor(k / 64)])).toEqual([]);
  });
  it('the profile keeps its one dark texel (no place on a two-texel chin keeps off the outline)', () => {
    expect(touching(2).added.length).toBe(1);
  });
  it('the front view still shows an open mouth (at least one dark texel)', () => {
    expect(touching(0).added.length).toBeGreaterThanOrEqual(1);
    expect(differs(draw('talk', 0).px, draw('neutral', 0).px)).toBe(true);
  });
});
