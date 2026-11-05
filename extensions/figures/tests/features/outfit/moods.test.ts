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
  it('talk with another expression parts the lips of it', () => {
    expect(differs(face('angry', ['talk']), face('angry'))).toBe(true);
  });
});
