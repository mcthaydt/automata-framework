// The stick mapper: a stick turns into a world direction through the sim's heading, so pushing
// up moves the character away from the camera at any heading. It changes gameplay, so it runs in the sim, on
// `dmath`'s `sin` and `cos` (the sim may not call `Math` trig), and gives Q16.16 integers so a replay hashes the
// same in Node, Chromium, WebKit and Firefox.
import { cos, sin } from '@automata/sim/math'
import { TURN_UNITS } from './heading.ts'

/** One in Q16.16: the mapper's outputs are this many to a metre's worth of direction. */
export const Q16 = 65_536
/** A stick axis's full push, as `Input.stick()` quantizes it: integers in −127..127, y positive down. */
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

/** `value` rounded to a whole number, halves away from zero, never `-0`: the opposite input gives the opposite output. */
const roundHalfAway = (value: number): number => Math.sign(value) * Math.round(Math.abs(value)) + 0

/**
 * `stick` as a world direction at `heading` (turn units), scaled by the stick's length: up is the camera's forward
 * `(sin h, cos h)`, right the camera's right `(−cos h, sin h)` (`@pixi/3d` is right-handed, so a camera looking
 * toward +z has +x on its left). A stick past full push (a keyboard's or a square gate's diagonal, up to √2) is
 * scaled back to unit length, so a diagonal is never faster than straight ahead. Each component is rounded to the
 * nearest Q16.16 unit, halves away from zero, and is never `-0`.
 */
export function mapStick(stick: Stick, heading: number): Direction {
  const angle = heading * RADIANS_PER_UNIT
  const s = sin(angle)
  const c = cos(angle)
  const lengthSquared = stick.x * stick.x + stick.y * stick.y
  // `Math.sqrt` is correctly rounded (IEEE 754), so this is the same in every engine.
  const scale = lengthSquared > STICK_MAX * STICK_MAX ? 1 / Math.sqrt(lengthSquared) : 1 / STICK_MAX
  const forward = -stick.y * scale
  const right = stick.x * scale
  return {
    x: roundHalfAway((s * forward - c * right) * Q16),
    z: roundHalfAway((c * forward + s * right) * Q16),
  }
}
