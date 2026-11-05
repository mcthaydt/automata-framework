import { describe, expect, it } from 'vitest';
import { J } from '../../../src/features/body/rig';
import type { Decal } from '../../../src/features/body/parts';
import { registerGarment, type Garment } from '../../../src/features/outfit/garments';
import { dressed, differs, turned } from '../draw';

/**
 * Prints (parts.ts Print, raster.ts stampPrint): a bitmap laid flat in the cell, as a brand mark or a nameplate is, and
 * not texel by texel on the cloth. No base decal carries one, so a test-only garment kind hangs a small cross on the chest
 * (over whatever lies behind it, as a pendant does) and the figure drawn with it must differ from the figure without it,
 * and draw the same twice. The print's own ink must be among the figure's materials (figure.ts names them).
 */
const CROSS = ['..#..', '..#..', '#####', '..#..', '..#..'];
/** The print on the chest at the top's centre; its across is +x, its down −y, a bitmap texel 2 cm. */
const mark = (inks?: Record<string, string>): Decal => ({
  bone: J.chest, at: [0, 0.1, 0.2], normal: [0, 0, 1], material: 'charcoal',
  print: { rows: CROSS, u: [1, 0, 0], v: [0, -1, 0], texel: 0.02, inks },
});
registerGarment('printed', { build: (_c, item: { printed: string }) => ({ parts: [], decals: [mark(item.printed === 'inks' ? { '#': 'flatGrey' } : undefined)] }) });
const wear = (...g: Garment[]) => turned(dressed([{ top: 'charcoal', sleeves: 'short' }, ...g]));

describe('a print', () => {
  const plain = wear();
  it('is drawn, and drawn the same twice', () => {
    const printed = wear({ printed: 'plain' } as unknown as Garment);
    expect(differs(printed, plain)).toBe(true);
    expect(differs(wear({ printed: 'plain' } as unknown as Garment), printed)).toBe(false);
  });
  it('takes the colours of its own inks', () => {
    expect(differs(wear({ printed: 'inks' } as unknown as Garment), wear({ printed: 'plain' } as unknown as Garment))).toBe(true);
  });
});
