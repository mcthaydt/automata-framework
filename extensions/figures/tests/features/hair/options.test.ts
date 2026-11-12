import { describe, expect, it } from 'vitest';
import { BASE } from '../../../base/base';
import { measure } from '../../../src/features/body/genes';
import { skeleton } from '../../../src/features/body/rig';
import type { Material } from '../../../src/features/body/parts';
import { SWATCHES } from '../../../src/features/outfit/garments';
import { HAIR_STYLES, hairParts, registerFinish, type HairInput, type HairStyle, type Piece, type Rope } from '../../../src/features/hair/hair';
import { dressed, differs, turned } from '../draw';

/**
 * The hair options restored for a fork's styles, which no base style sets: the sheen band of a glossy finish, cornrows
 * laid to the nape, beaded ropes, and hair drawn for headwear (`capped`). Each is drawn on the base fade's own scalp
 * (or a rows piece of its own) against the same style without it: the parts or the frame must differ, and repeat.
 */
const def = BASE[0].def, m = measure(def.sliders), s = skeleton(m.genes);
const input: HairInput = { m, s, hair: 'hairBlack', skin: def.skin, swatch: (name: string): Material => SWATCHES[name] };
const scalp = HAIR_STYLES.shortFade.pieces.find(p => 'scalp' in p)!;
/** A style whose one piece is `rows` of `rope` from the hairline `to` a direction or the nape. */
const rows = (to: 'nape' | [number, number, number], rope: Rope): HairStyle => ({
  about: 'rows', finish: 'coil',
  pieces: [{ rows: { count: 3, span: 0.6, from: [[0, 0.6], [1.2, -0.1], [3.1416, -0.55]], to, lift: 0.02, rope } } as Piece],
});
/** A style's positions, flattened: what two drawings of its geometry are compared by. */
const shape = (style: HairStyle, i: HairInput = input) => hairParts(i, style).parts.flatMap(p => p.mesh.positions);

describe('the sheen finish', () => {
  // Two finishes of one light, one matte and one not: the sheen band is all that differs between them.
  registerFinish('glossTest', { tones: [0.8, 0.3, -0.4], matte: false });
  registerFinish('mattTest', { tones: [0.8, 0.3, -0.4], matte: true });
  const style = (finish: string) => ({ ...HAIR_STYLES.shortFade, finish });
  const frame = (finish: string) => turned(dressed([{ hair: 'hairBlack', style: style(finish) }]));
  it('lays a band on an undulled finish, and none on a matte one', () => {
    expect(differs(frame('glossTest'), frame('mattTest'))).toBe(true);
    expect(differs(frame('glossTest'), frame('glossTest'))).toBe(false);
  });
});

describe('cornrows to the nape', () => {
  const rope: Rope = { r: 0.24, flat: 0.55, root: 0.1 };
  it('run straight back over the head, not gathered to a point', () => {
    const nape = shape(rows('nape', rope));
    expect(nape.length).toBeGreaterThan(0);
    expect(nape).not.toEqual(shape(rows([0, 0.95, -0.35], rope)));
    expect(shape(rows('nape', rope))).toEqual(nape);
  });
});

describe('beaded ropes', () => {
  it('a rope\'s beads change its form, and a rope with none is smooth', () => {
    const plain: Rope = { r: 0.24, flat: 0.55, root: 0.1 }, beaded: Rope = { ...plain, beads: 6, depth: 0.3 };
    expect(shape(rows('nape', beaded))).not.toEqual(shape(rows('nape', plain)));
  });
});

describe('hair under headwear', () => {
  it('is drawn for it (capped), which the base pieces ignore, so the input is kept alive', () => {
    const style: HairStyle = { about: 'fade', finish: 'coil', pieces: [scalp] };
    expect(shape(style, { ...input, capped: true })).toEqual(shape(style));
  });
});
