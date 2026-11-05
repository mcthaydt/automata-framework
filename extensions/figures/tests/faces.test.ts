import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { BASE } from '../base/base';
import { Figure, type FigureInput } from '../src/render/figure/figure';
import { EXPRESSIONS, type Expression } from '../src/render/figure/garments';
import { member, view } from '../scripts/frames';

/**
 * The face marks (garments.ts face): a figure whose face is not the painter's drawn one wears marks, the eyes, lids,
 * brows and mouth as decals, and an expression changes them. The base pair draw their faces, so nothing else exercises
 * the marks; base keeps them for the characters forks make. Each expression that moves the marks (fear, surprise,
 * sadness, anger) must paint differently from neutral, on both base figures, from the front.
 */
const md5 = (px: Uint8ClampedArray) => createHash('md5').update(px).digest('hex');
function face(id: string, expression: Expression): string {
  const c = BASE.find(b => b.def.id === id)!, f = new Figure(member({ ...c.def, face: { ...c.def.face, drawn: false } }, 2));
  const input: FigureInput = { facing: 0, moving: false, view: view(), expression, clock: 0.2 };
  for (let i = 0; i < 3; i++) f.update(1 / 60, input);
  return md5(f.painted);
}

describe('the face marks draw each expression', () => {
  for (const c of BASE) it(c.def.id, () => {
    const neutral = face(c.def.id, 'neutral');
    for (const e of EXPRESSIONS.filter(e => e !== 'neutral' && e !== 'talk')) expect(face(c.def.id, e), e).not.toBe(neutral);
  });
});
