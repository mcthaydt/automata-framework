import { describe, expect, it } from 'vitest';
import { BASE } from '../../../base/base';
import { DEFAULT_SLIDERS, measure, type Sliders } from '../../../src/features/body/genes';
import { ear } from '../../../src/features/body/head';
import { J, fk, skeleton } from '../../../src/features/body/rig';
import { fromDef, type CharacterDef } from '../../../src/features/figure/cast';
import { evaluate, type Stand } from '../../../src/features/motion/motion';
import { POSES } from '../../../src/features/motion/presets';
import { apply, position } from '../../../src/lib/math';

/**
 * The natural stand, measured on the posed skeleton in the figure's own frame (yaw 0, no camera tip: what a profile
 * view shows) against the published references the design cites (docs/superpowers/specs/2026-11-06-natural-stand-design.md):
 * the ear over the shoulder's tip, the weight knee over its ankle, the hips and shoulders level to a trace, the free foot
 * flat, the arms hanging as close as clears the figure. The walk is not the stand: it takes none of it.
 */
const ENDS: Partial<Record<keyof Sliders, [number, number]>> = { height: [150, 200], headTilt: [-10, 10] };
const BODY = (Object.keys(DEFAULT_SLIDERS) as (keyof Sliders)[]).filter(k => typeof DEFAULT_SLIDERS[k] === 'number');
const DEG = 180 / Math.PI;

/** A character relaxed (or in `stand`), facing the camera: its posed joints, the ear's height ahead, its clearance. */
function stood(def: CharacterDef, stand?: Stand, moving = false, phase = 0) {
  const m = fromDef(def), s = skeleton(m.genes), look = m.outfits[m.defaultOutfit](s);
  const ev = evaluate(s, m.gait, { t: 0, moving, phase, yaw: 0, headYaw: 0, shuffle: 0, stand, clear: look.clear });
  const clear = look.clear!;
  const world = fk(s, ev.pose), P = (name: keyof typeof J) => position(world[J[name]]);
  const earZ = apply(world[J.head], ear({ ...measure(def.sliders), genes: m.genes }, s, 1).c)[2];
  const acromionZ = (P('upperArm.L')[2] + P('upperArm.R')[2]) / 2;
  /** The degrees of the line a→b from horizontal (positive: b above a). */
  const tilt = (a: keyof typeof J, b: keyof typeof J) => Math.atan2(P(b)[1] - P(a)[1], Math.abs(P(b)[0] - P(a)[0])) * DEG;
  return { ev, world, P, clear, ahead: earZ - acromionZ, tilt };
}

describe('the relaxed stand', () => {
  for (const { def } of BASE) it(`${def.id}: upright, the weight barely on one leg, the free foot flat, the arms at the thighs`, () => {
    const { P, clear, ahead, tilt } = stood(def);
    expect(ahead).toBeLessThanOrEqual(0.035);                                       // today 0.065 / 0.049
    const knee = P('shin.R')[2] - P('foot.R')[2];
    expect(knee).toBeGreaterThanOrEqual(0);
    expect(knee).toBeLessThanOrEqual(0.02);                                         // today 0.037 / 0.034
    const pelvis = tilt('thigh.R', 'thigh.L'), shoulder = tilt('upperArm.R', 'upperArm.L');
    expect(Math.abs(pelvis)).toBeLessThanOrEqual(2.5);                              // today 6.4 / 5.8
    expect(Math.abs(shoulder)).toBeLessThanOrEqual(1);                              // today 5.5 / 4.9
    expect(Math.sign(pelvis) !== Math.sign(shoulder) || Math.min(Math.abs(pelvis), Math.abs(shoulder)) < 0.5).toBe(true);
    expect(Math.abs(P('foot.L')[1] - P('foot.R')[1])).toBeLessThanOrEqual(0.001);   // today 0.014
    // A guard (it holds today too): each arm hangs exactly as close as clears the dressed figure.
    for (const [i, side] of (['L', 'R'] as const).entries()) {
      const x = side === 'L' ? 1 : -1, a = P(`upperArm.${side}`), w = P(`hand.${side}`);
      expect(Math.abs(Math.atan2(x * (w[0] - a[0]), a[1] - w[1]) - clear[i])).toBeLessThanOrEqual(0.01);
    }
  });

  for (const { def } of BASE) it(`${def.id}: handOnHip takes the slide, keeps its own weight`, () => {
    const { ahead, tilt } = stood(def, POSES.handOnHip);
    expect(ahead).toBeLessThanOrEqual(0.035); // today 0.057 / 0.040
    // The pose sets its own weight and feet: the stand's quieter weight does not reach it. -5.157° on main, both members.
    expect(tilt('thigh.R', 'thigh.L')).toBeCloseTo(-5.157, 0);
    expect(Math.abs(tilt('thigh.R', 'thigh.L') + 5.157)).toBeLessThanOrEqual(0.1);
  });

  for (const { def } of BASE) it(`${def.id}: walking takes none of it`, () => {
    for (const phase of [0, 0.5]) expect(stood(def, undefined, true, phase).ev.pose.shift[J.neck][2]).toBe(0);
  });
});

describe('every slider at either end still stands', () => {
  for (const { def } of BASE) for (const key of BODY) it(`${def.id} ${key}`, () => {
    for (const v of ENDS[key] ?? [0, 1]) {
      const { world, P } = stood({ ...def, sliders: { ...def.sliders, [key]: v } } as CharacterDef);
      for (const m of world) for (const e of m) expect(Number.isFinite(e), `${key} ${v}`).toBe(true);
      const knee = P('shin.R')[2] - P('foot.R')[2];
      expect(knee, `${key} ${v} knee`).toBeGreaterThanOrEqual(0);
      expect(knee, `${key} ${v} knee`).toBeLessThanOrEqual(0.02);
    }
  });
});
