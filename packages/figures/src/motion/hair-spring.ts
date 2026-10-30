// The hair's spring (secondary motion, M3 spec §4.4.5 step 7): it trails behind as the figure walks, bounces
// with each step, lags through a turn, and hangs against the head's nod and tilt. A pure step: the spring's
// state in, the next state out, so the view (or a test) owns the state and the same inputs give the same swing.
//
// Extracted from FigureBuilder (mcthaydt/FigureBuilder) src/render/figure/figure.ts at a1f7246
// (`Figure.swingHair`), its formulas and their order. Changed for AF: what the method read from the figure
// (the walk, the speed, the turn's rate, the head's nod and tilt) comes in as `HairInput`; the swing is not
// rounded to a tenth (the source's sprite cell cache).

import type { HairDynamics } from '../figure/figure.schema'
import type { M } from '../math/math'

/** The spring: its swing (rad) and how fast it swings. `base()` reads the swing as `MotionState.hair`. */
export interface HairSpring {
  readonly pitch: number
  readonly roll: number
  readonly vPitch: number
  readonly vRoll: number
}
export const HAIR_AT_REST: HairSpring = { pitch: 0, roll: 0, vPitch: 0, vRoll: 0 }

export interface HairInput {
  readonly moving: boolean
  /** The walk's phase, [0, 1). */
  readonly phase: number
  /** The walking speed (m/s): FigureBuilder passed the gait's tuned speed. */
  readonly speed: number
  /** How fast the shown facing turns (rad/s). */
  readonly yawRate: number
  /** The head's nod (rad, `headNod`), and its tilt (the genes' `headTilt`). */
  readonly nod: number
  readonly headTilt: number
}

/** The substep: semi-implicit Euler in fixed 1/120 s steps, so the swing is the same whatever the frame rate. */
const SUBSTEP = 1 / 120

/** The spring `dt` seconds on. */
export function hairStep(hp: HairDynamics, h: HairSpring, input: HairInput, dt: number): HairSpring {
  const pitchTarget =
    (input.moving ? (hp.trail * input.speed) / 3 + hp.bounce * Math.cos(4 * Math.PI * input.phase) : 0) -
    input.nod * hp.hang
  const rollTarget = Math.max(-0.6, Math.min(0.6, -hp.sway * input.yawRate * 0.05)) - input.headTilt * hp.hang
  let { pitch, roll, vPitch, vRoll } = h
  for (let left = dt; left > 1e-9; left -= SUBSTEP) {
    const step = Math.min(left, SUBSTEP)
    vPitch += (hp.stiff * (pitchTarget - pitch) - hp.damp * vPitch) * step
    pitch += vPitch * step
    vRoll += (hp.stiff * (rollTarget - roll) - hp.damp * vRoll) * step
    roll += vRoll * step
  }
  return { pitch, roll, vPitch, vRoll }
}

/** The head's nod along the facing `yaw` (rad), from its world matrix: the hair hangs plumb against it, so a
 * tail falls down the back rather than swinging out behind with the face. */
export function headNod(head: M, yaw: number): number {
  return Math.atan2(head[1] * Math.sin(yaw) + head[7] * Math.cos(yaw), head[4])
}
