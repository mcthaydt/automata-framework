import { describe, expect, it } from 'vitest';
import { J } from '../../../src/features/body/rig';
import { GROUP, type Material } from '../../../src/features/body/parts';
import { box, registerGarment, type Garment } from '../../../src/features/outfit/garments';
import { dressed, differs, turned } from '../draw';

/**
 * The painter's material features (paint.ts), restored as generic machinery that no base material sets: a holo and a
 * mirror lens, a see-through lens, a stain and its wash, and strands. Each is drawn on a plain probe cloth against the
 * same cloth without it: the frames must differ, and a second drawing must be the same. (The hair's sheen band has its
 * own test with the hair options.) Without these, a sweep for dead code would cut them again.
 */
const probe: Material = { ramp: 5, base: 3 };
const outfit: Garment[] = [{ top: 'probe', sleeves: 'long' }, { shorts: 'probe' }];
const draw = (swatch: Material) => turned(dressed(outfit, { probe: swatch }));

describe('a material feature changes the drawing, repeatably', () => {
  const plain = draw(probe);
  const features: [string, Material][] = [
    ['holo', { ...probe, holo: true }],
    ['a mirror', { ...probe, holo: 'mirror' }],
    // Stained from the knee down; on the legs (the shorts' thighs) it is the wash, on the torso's cloth the drips.
    ['a stain', { ...probe, stain: { paint: ['#d8c8a0', '#b8a070', '#887048', '#584828'], hem: 0.3, below: 0.9 } }],
    ['strands', { ...probe, strands: true }],
  ];
  for (const [name, swatch] of features) it(name, () => {
    const drawn = draw(swatch);
    expect(differs(drawn, plain), 'differs').toBe(true);
    expect(differs(draw(swatch), drawn), 'repeatable').toBe(false);
  });
});

describe('a see-through lens shows the eyes under it', () => {
  // A lens over the eyes: a test-only kind with one wide slab standing off the head's front at the eyes' height (the
  // head's joint is at its foot, so the eyes are over half its height up), in the probe swatch.
  registerGarment('lens', { build: c => {
    const g = c.s.genes, h = g.head, hw = h * g.headWidth / 2, hd = h * g.headDepth / 2;
    return { parts: [box(J.head, 'probe', GROUP.head, { at: [0, h * 0.55, hd * 1.2], r: [hw * 0.9, h * 0.08, hd * 0.15] })] };
  } });
  const face: Garment[] = [{ eyes: 'eyeBrown', white: 'eyeWhite', brows: 'hairBlack', lips: 'lipsWarm' }, { lens: 'x' } as unknown as Garment];
  it('differs from the same lens that does not', () => {
    const lens = (see?: boolean) => turned(dressed(face, { probe: { ...probe, see } }));
    expect(differs(lens(true), lens(false))).toBe(true);
    expect(differs(lens(true), lens(true))).toBe(false);
  });
});
