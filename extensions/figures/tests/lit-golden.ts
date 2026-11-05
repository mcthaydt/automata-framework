/**
 * The lit golden's frames: the base pair lit as real character lighting lights it, kept as an md5 of each frame's RGBA
 * and named `<who>/<setup>/<facing>@D<density>`. Each frame is the figure's painted cell and normal map, standing in
 * view `facing` of the 8, stepped along its own DUEL ramps by a time of day (exposure, the cast's lift, an ambient
 * tint), its lamps (warm and cool, a flicker, a spot) and a bounce off the floor. Recorded through the scene's
 * composite before the scene was cut; drawn now by the lighting feature (src/features/lighting/light.ts lightFigure), which
 * matched it.
 * Shared by the recorder (scripts/golden.ts) and the test (tests/lit-golden.test.ts).
 */
import { createHash } from 'node:crypto';
import { Figure } from '../src/features/figure/figure';
import { member, view } from '../scripts/frames';
import { BASE } from '../base/base';
import { lightFigure, type Bounce } from '../src/features/lighting/light';
import type { Lamp, TimeOfDay } from '../src/features/lighting/lamps';

/** A lighting setup: a time, its lamps (metres from the figure's feet: x to the screen's right, y up, z toward the
 * camera), the moment it is lit at (for a flicker), whether it stands in shade, a bounce, and its densities. */
export interface LitSetup { name: string; time: TimeOfDay; lamps: Lamp[]; t: number; shade?: boolean; bounce?: Bounce; densities: number[] }
export const LIT_SETUPS: LitSetup[] = [
  { name: 'nightLamp', time: { exposure: -2, figureLift: 1, ambient: '#3d5083', tint: 0.35 }, lamps: [{ at: [-1.2, 1.5, 0.8], color: '#ffbc4e', steps: 3, radius: 3.2, tint: 0.4 }], t: 0, bounce: { floor: 0x5b5c69 }, densities: [1, 2] },
  { name: 'lampLitTwo', time: { exposure: -1, figureLift: 0, ambient: '#7964ba', tint: 0.2 }, lamps: [{ at: [-1.5, 1.8, 1], color: '#ffbc4e', steps: 2, radius: 3.5 }, { at: [1.4, 1.2, -0.6], color: '#4ea6ff', steps: 2, radius: 2.6, flicker: 0.5, rate: 6, seed: 3 }], t: 1.25, bounce: { floor: 0x3d5083, glow: 0x4ea6ff, side: 1 }, densities: [2] },
  { name: 'duskSpot', time: { exposure: -1, figureLift: 0, ambient: '#8e8ce2', tint: 0.25 }, lamps: [{ at: [0.4, 3, 1.2], color: '#eadbc9', steps: 3, radius: 4.5, aim: [-0.1, -1, -0.3], cone: 30 }], t: 0, densities: [2] },
  { name: 'dayShade', time: { exposure: 0, ambient: '#c7d6ff', tint: 0.05 }, lamps: [], t: 0, shade: true, densities: [2] },
];
/** The views each setup is drawn in (of the 8: front, three-quarter, side, back three-quarter, away three-quarter). */
const FACINGS = [0, 1, 2, 3, 5];
/** The sheets' pitch. */
const PITCH = 18 * Math.PI / 180;
const md5 = (px: Uint8ClampedArray) => createHash('md5').update(px).digest('hex');

/** A base figure standing in view `d`, drawn at `density`. */
export function standingFigure(who: string, density: number, d: number): Figure {
  const b = BASE.find(c => c.def.id === who)!, f = new Figure(member(b.def, density));
  for (let i = 0; i < 3; i++) f.update(1 / 60, { facing: d * Math.PI / 4, moving: false, view: view(PITCH) });
  return f;
}
/** A standing figure lit by `setup`: its RGBA. */
const lit = (f: Figure, s: LitSetup) => lightFigure(f, { time: s.time, lamps: s.lamps, t: s.t, shade: s.shade, bounce: s.bounce });
/** Every lit golden frame: name → md5. */
export function litFrames(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of LIT_SETUPS) for (const c of BASE) for (const D of s.densities) for (const d of FACINGS)
    out[`${c.def.id}/${s.name}/${d}@D${D}`] = md5(lit(standingFigure(c.def.id, D, d), s));
  return out;
}
