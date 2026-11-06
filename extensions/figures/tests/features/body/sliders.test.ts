import { describe, expect, it } from 'vitest';
import { BASE } from '../../../base/base';
import { DEFAULT_HEAD, type HeadShape, type Sliders } from '../../../src/features/body/genes';
import { BODY, ENDS, FACE_ENDS } from './ends';
import type { CharacterDef } from '../../../src/features/figure/cast';
import { member, standing, walking } from '../../../src/features/figure/frames';

/**
 * The generator's reach over bodies, standing in for a random cast that once proved any character file renders: each
 * slider of the base pair pushed to either end of its range (0 and 1; the height to 150 and 200 cm; the head's tilt to
 * ±10°), one at a time, still builds and paints a figure. A body slider is drawn three-quarter and through its walk; a
 * face slider (the head's structure, genes.ts HeadShape) only changes the head, so it is drawn from the front.
 */
/** A drawn figure covers at least this many texels of the D1 cell (render.test's floor). */
const FILLED = 400;
const filled = (px: Uint8ClampedArray) => { let n = 0; for (let i = 3; i < px.length; i += 4) if (px[i]) n++; return n; };
const FACE = Object.keys(DEFAULT_HEAD) as (keyof HeadShape)[];

describe('every slider at either end still builds and paints', () => {
  for (const c of BASE) {
    for (const key of BODY) it(`${c.def.id} ${key}`, () => {
      for (const v of ENDS[key] ?? [0, 1]) {
        const cast = member({ ...c.def, sliders: { ...c.def.sliders, [key]: v } } as CharacterDef, 1);
        expect(filled(standing(cast, 1)), `${key} ${v} standing`).toBeGreaterThan(FILLED);
        walking(cast).forEach((f, i) => expect(filled(f), `${key} ${v} walk ${i}`).toBeGreaterThan(FILLED));
      }
    });
    it(`${c.def.id} face`, () => {
      for (const key of FACE) for (const v of FACE_ENDS[key] ?? [0, 1]) {
        const cast = member({ ...c.def, sliders: { ...c.def.sliders, face: { ...c.def.sliders.face, [key]: v } } }, 1);
        expect(filled(standing(cast, 0)), `${key} ${v}`).toBeGreaterThan(FILLED);
      }
    });
  }
});
