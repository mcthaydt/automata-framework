import { describe, expect, it } from 'vitest';
import { BASE } from '../../../base/base';
import { measure } from '../../../src/features/body/genes';
import { skeleton } from '../../../src/features/body/rig';
import { superquadric, type Material } from '../../../src/features/body/parts';
import { SWATCHES } from '../../../src/features/outfit/garments';
import { CROWN, HAIR_SEAM, HAIR_STYLES, hairParts, registerFinish, registerHairPiece, type HairStyle } from '../../../src/features/hair/hair';

/**
 * The hair hooks (hair.ts H3 and H4): a fork registers hair pieces and finishes, and hairParts builds them with the
 * three generators', sharing the one seam counter. Base registers none, so this test registers a toy piece and a toy
 * finish in its own module scope (vitest isolates test files, so no other test sees them).
 */
const ball = () => superquadric({ at: [0, 0, 0], r: [0.01, 0.01, 0.01] });
registerHairPiece('toy', { build: c => { c.rigid(ball(), 'hair', c.seam()); c.rigid(ball(), 'hair', c.seam()); } });
registerHairPiece('crowned', { build: c => c.rigid(ball(), 'hair', c.seam()), crown: true });
registerFinish('toyFinish', { tones: [0.8, 0.3, -0.4], matte: false });

const def = BASE[0].def, m = measure(def.sliders), s = skeleton(m.genes);
const swatch = (name: string): Material => SWATCHES[name];
/** The base fade's scalp, which takes no seam: the toy pieces after it are the first to count. */
const scalp = HAIR_STYLES.shortFade.pieces.find(p => 'scalp' in p)!;
const draw = (style: HairStyle) => hairParts({ m, s, hair: 'hairBlack', skin: def.skin, swatch }, style);

describe('hair pieces (H3)', () => {
  it('number their own surfaces from the style\'s one counter, after the pieces that took none', () => {
    const { parts } = draw({ about: 'toy', finish: 'coil', pieces: [scalp, { toy: {} }] });
    expect(parts.slice(-2).map(p => p.seam)).toEqual([HAIR_SEAM + 100, HAIR_SEAM + 101]);
  });
  it('a piece declared crown takes the CROWN tag, and one that is not does not', () => {
    const tagged = (kind: string) => draw({ about: 'toy', finish: 'coil', pieces: [{ [kind]: {} }] }).parts.map(p => p.tag);
    expect(tagged('crowned')).toEqual([CROWN]);
    expect(tagged('toy')).toEqual([undefined, undefined]);
  });
  it('an unregistered piece throws, and so does a name taken (the generators\' included)', () => {
    expect(() => draw({ about: 'toy', finish: 'coil', pieces: [{ nothing: {} }] })).toThrow('no hair piece nothing');
    expect(() => registerHairPiece('toy', { build: () => undefined })).toThrow('registered already');
    expect(() => registerHairPiece('rows', { build: () => undefined })).toThrow('registered already');
  });
});

describe('hair finishes (H4)', () => {
  it('a registered finish names the materials of the style that wears it', () => {
    const look = draw({ about: 'toy', finish: 'toyFinish', pieces: [{ toy: {} }] });
    expect(Object.keys(look.materials).every(n => n.includes(':toyFinish'))).toBe(true);
    expect(Object.keys(look.materials)).not.toHaveLength(0);
  });
  it('an undulled finish takes the sheen band, a matte one does not', () => {
    const sheen = (finish: string) => Object.values(draw({ about: 'toy', finish, pieces: [{ toy: {} }] }).materials)[0].sheen;
    expect(sheen('toyFinish')).toBe(true);
    expect(sheen('coil')).toBeUndefined();
  });
  it('an unregistered finish throws, and so does a name taken', () => {
    expect(() => draw({ about: 'toy', finish: 'nothing', pieces: [{ toy: {} }] })).toThrow('no finish nothing');
    expect(() => registerFinish('toyFinish', { tones: [0, 0, 0], matte: true })).toThrow('registered already');
    expect(() => registerFinish('coil', { tones: [0, 0, 0], matte: true })).toThrow('registered already');
  });
});
