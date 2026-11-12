import { describe, expect, it } from 'vitest';
import { BASE } from '../../../base/base';
import { Figure } from '../../../src/features/figure/figure';
import { member } from '../../../src/features/figure/frames';

/**
 * Every base figure builds at every density a stage asks for. Some hair pieces only grow parts at close-up densities
 * (a tail's cuffs from 1.5×), so a material they name that the library lacks shows only there: no golden draws that close.
 */
describe('base figures at every density', () => {
  for (const { def } of BASE) for (const density of [1, 2, 3, 4]) {
    it(`${def.id} builds at density ${density}`, () => {
      expect(() => new Figure(member(def, density))).not.toThrow();
    });
  }
});
