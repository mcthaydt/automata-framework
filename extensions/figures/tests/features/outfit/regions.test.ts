import { describe, expect, it } from 'vitest';
import { BASE } from '../../../base/base';
import { J, skeleton } from '../../../src/features/body/rig';
import { measure } from '../../../src/features/body/genes';
import { apply, applyDir, invertRigid, position } from '../../../src/lib/math';
import { evaluate } from '../../../src/features/motion/motion';
import { GAITS } from '../../../src/features/motion/presets';
import { registerGarment, type Garment } from '../../../src/features/outfit/garments';
import { dressed, differs, turned } from '../draw';

/**
 * Two things the body has for a fork's garments and no base figure uses: the shoe region (garments.ts Regions.shoe and
 * sole, which a kind repaints to put the feet in shoes; the base pair is barefoot) and the hems (rig.ts J.hemL and
 * J.hemR, which motion.ts placeHems stands on the floor while a foot is planted and lifts with it).
 */
registerGarment('shod', { build: () => ({ parts: [], paint: { shoe: 'charcoal', sole: 'flatGrey' } }) });

describe('the shoe region', () => {
  const bare = turned(dressed([])), shod = turned(dressed([{ shod: 'x' } as unknown as Garment]));
  it('draws shoes where a kind repaints it, and draws them the same twice', () => {
    expect(differs(shod, bare)).toBe(true);
    expect(differs(turned(dressed([{ shod: 'x' } as unknown as Garment])), shod)).toBe(false);
  });
});

describe('the hems', () => {
  const def = BASE[0].def, s = skeleton(measure(def.sliders).genes), gait = GAITS[def.gait];
  /** The hem's height over the floor (root space) at a point of the walk: 0 at the ankle's own height when planted. */
  const hemAt = (phase: number, side: 'L' | 'R') => {
    const { world } = evaluate(s, gait, { t: 0, moving: true, phase, yaw: 0, headYaw: 0, shuffle: 0 });
    return apply(invertRigid(world[J.root]), position(world[J[`hem${side}`]]))[1] - s.genes.ankle;
  };
  const heights = [...Array(24).keys()].map(i => hemAt(i / 24, 'L'));
  it('stands on the floor while the foot is planted and rises with it through the swing', () => {
    expect(Math.min(...heights)).toBeCloseTo(0, 3);
    expect(Math.max(...heights)).toBeGreaterThan(0.02);
  });
  it('stands upright on the floor whatever the shin\'s tilt (placeHems turns it; on the shin alone it would tip)', () => {
    /** A joint's up axis (its +y in the world), y component: 1 when upright. */
    const up = (phase: number, joint: number) =>
      applyDir(evaluate(s, gait, { t: 0, moving: true, phase, yaw: 0, headYaw: 0, shuffle: 0 }).world[joint], [0, 1, 0])[1];
    const phases = [...Array(24).keys()].map(i => i / 24);
    expect(Math.min(...phases.map(p => up(p, J['shin.L'])))).toBeLessThan(0.98);   // the control: the shin does tip
    expect(Math.min(...phases.map(p => up(p, J.hemL)))).toBeGreaterThan(0.999);
  });
  it('is placed the same every time', () => {
    expect(hemAt(0.3, 'L')).toBe(hemAt(0.3, 'L'));
  });
});
