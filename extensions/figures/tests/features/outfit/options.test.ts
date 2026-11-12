import { describe, expect, it } from 'vitest';
import type { Garment } from '../../../src/features/outfit/garments';
import { dressed, differs, turned } from '../draw';

/**
 * The garment options restored for a fork's wardrobe, which the base pair's blocks never set: a top's cuffs and collar and
 * the eyes' stubble (garments.ts dress). Each is drawn on the base man against the same garment without it: the frames
 * must differ, and a second drawing must be the same.
 */
const top = (extra: object = {}): Garment => ({ top: 'charcoal', sleeves: 'long', ...extra } as Garment);
const eyes = (extra: object = {}): Garment => ({ eyes: 'eyeBrown', white: 'eyeWhite', brows: 'hairBlack', lips: 'lipsWarm', ...extra } as Garment);

describe('garment options', () => {
  const cases: [string, Garment[], Garment[]][] = [
    ['long cuffs', [top()], [top({ cuffs: 'flatGrey' })]],
    ['short cuffs', [top({ sleeves: 'short' })], [top({ sleeves: 'short', cuffs: 'flatGrey' })]],
    ['a collar', [top()], [top({ collar: 'flatGrey' })]],
    ['stubble', [eyes()], [eyes({ stubble: 'charcoal' })]],
  ];
  for (const [name, without, withIt] of cases) it(name, () => {
    const plain = turned(dressed(without)), drawn = turned(dressed(withIt));
    expect(differs(drawn, plain)).toBe(true);
    expect(differs(turned(dressed(withIt)), drawn)).toBe(false);
  });
});
