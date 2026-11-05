import { describe, expect, it } from 'vitest';
import { Figure } from '../../../src/features/figure/figure';
import { fromDef } from '../../../src/features/figure/cast';
import { BASE } from '../../../base/base';

describe('the base pair', () => {
  for (const c of BASE) it(`${c.def.id} paints a figure in every direction`, () => {
    const member = fromDef(c.def);
    for (let d = 0; d < 8; d++) {
      const f = new Figure(member);
      f.update(1 / 60, { facing: d * Math.PI / 4, moving: false, view: { azimuth: 0, pitch: 0.3 } });
      let filled = 0;
      for (let i = 3; i < f.painted.length; i += 4) if (f.painted[i]) filled++;
      expect(filled).toBeGreaterThan(400);
    }
  });
});
