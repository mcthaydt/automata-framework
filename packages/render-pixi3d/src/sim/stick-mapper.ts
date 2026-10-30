// The stick mapper (M3 spec §4.2, D3-i): a stick turns into a world direction through the sim's heading, so pushing
// up moves the character away from the camera at any heading. It changes gameplay, so it runs in the sim, on
// `dmath`'s `sin` and `cos` (the sim may not call `Math` trig), and gives Q16.16 integers so a replay hashes the
// same in Node, Chromium, WebKit and Firefox.
import { cos, sin } from '@mcthaydt/automata-sim/math'
import { TURN_UNITS } from './heading.js'

/** One in Q16.16: the mapper's outputs are this many to a metre's worth of direction. */
export const Q16 = 65_536
/** A stick axis's full push, as `Input.stick()` quantizes it (M4-D2): integers in −127..127, y positive down. */
export const STICK_MAX = 127

// 2π spelled out: `Math.PI` is not sim-safe.
const TAU = 6.283185307179586
const RADIANS_PER_UNIT = TAU / TURN_UNITS

/** A stick vector: integers in −`STICK_MAX`..`STICK_MAX`, y positive down. */
export interface Stick {
  readonly x: number
  readonly y: number
}

/** A world direction on the floor, `x` and `z` in Q16.16. */
export interface Direction {
  readonly x: number
  readonly z: number
}

/**
 * `stick` as a world direction at `heading` (turn units), scaled by the stick's length: up is the camera's forward
 * `(sin h, cos h)`, right the camera's right `(−cos h, sin h)` (`@pixi/3d` is right-handed, so a camera looking
 * toward +z has +x on its left). Each component is rounded to the nearest Q16.16 unit and is never `-0`.
 */
export function mapStick(stick: Stick, heading: number): Direction {
  const angle = heading * RADIANS_PER_UNIT
  const s = sin(angle)
  const c = cos(angle)
  const forward = -stick.y / STICK_MAX
  const right = stick.x / STICK_MAX
  return {
    x: Math.round((s * forward - c * right) * Q16) + 0,
    z: Math.round((c * forward + s * right) * Q16) + 0,
  }
}
