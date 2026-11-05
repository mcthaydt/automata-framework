import { describe, expect, it } from 'vitest';
import { BASE } from '../../../base/base';
import { measure } from '../../../src/features/body/genes';
import { J, skeleton } from '../../../src/features/body/rig';
import { apply, invertRigid, position } from '../../../src/lib/math';
import { seated } from '../../../src/features/motion/motion';
import { GAITS, SEATS } from '../../../src/features/motion/presets';

/**
 * The seated stands (motion.ts seated, library/seats.json): no base figure sits, so this is what keeps them from being
 * cut as dead. For every seat, on the base man, the hips land on the seat (its height plus the thigh's flesh under the
 * hip joint, less what a slump sinks them) and both ankles stand on the floor, in the root's space; and a seat is drawn
 * the same every time it is asked for. (The hips are the thigh joints: the pelvis joint itself sits above them.)
 */
const def = BASE[0].def, m = measure(def.sliders), s = skeleton(m.genes), gait = GAITS[def.gait], k = s.genes.height / 1.62;
/** The thigh's flesh under the hip joint on a seat (m at k 1), as motion.ts SIT. */
const SIT = 0.07;
/** A joint's place in the root's space. */
const inRoot = (world: ReturnType<typeof seated>['world'], joint: number) => apply(invertRigid(world[J.root]), position(world[joint]));

describe('every seat', () => {
  for (const [name, seat] of Object.entries(SEATS)) it(name, () => {
    const { world } = seated(s, gait, seat, 0.3);
    for (const side of ['L', 'R'] as const) {
      expect(inRoot(world, J[`thigh.${side}`])[1], `${side} hip`).toBeCloseTo(seat.height + SIT * k - 0.03 * k * (seat.slump ?? 0), 2);
      expect(Math.abs(inRoot(world, J[`foot.${side}`])[1] - s.genes.ankle), `${side} ankle`).toBeLessThan(0.001);
    }
    expect(seated(s, gait, seat, 0.3).pose).toEqual(seated(s, gait, seat, 0.3).pose);
  });
  it('the library has the seats a scene picks by name', () => {
    expect(Object.keys(SEATS)).toEqual(['upright', 'slump', 'typing', 'leanIn', 'mouse', 'reachClick', 'toMouth', 'triumph']);
  });
});
