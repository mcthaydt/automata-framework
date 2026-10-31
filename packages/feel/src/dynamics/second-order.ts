// Second-order dynamics (M6 spec §4.1; from the arcade source's `second-order.ts`): a value that follows a target the way a
// spring does. `f` is how fast it answers in hertz, `zeta` how much it wobbles (below 1 overshoots), `r` how it starts (above 1
// anticipates past the target, below 0 winds up first). Semi-implicit Euler with the stability clamp of the f/zeta/r form,
// sub-stepped so a long frame (a tab back from the background) never diverges. Simulated smooth; callers draw it snapped
// (`snapTo`), so the pixel art keeps its whole units while the motion underneath keeps its overshoot.
import type { SpringTuning } from '../feel.schema'

/** The longest step taken at once; a longer frame is split into steps this long. */
const MAX_STEP = 1 / 240
/** A frame longer than this is treated as this long: nothing should spring through a stall. */
const MAX_FRAME = 0.1
/** Close enough to rest to call it settled, in the value's own units. */
const SETTLE_EPSILON = 1e-3

export class SecondOrder {
  private k1 = 0
  private k2 = 0
  private k3 = 0
  private y: number
  private yd = 0
  private previousTarget: number

  constructor(tuning: SpringTuning, initial = 0) {
    this.y = initial
    this.previousTarget = initial
    this.retune(tuning)
  }

  /** New constants, keeping where the value is and how fast it is moving. */
  retune({ f, zeta, r }: SpringTuning): void {
    const w = 2 * Math.PI * f
    this.k1 = zeta / (Math.PI * f)
    this.k2 = 1 / (w * w)
    this.k3 = (r * zeta) / w
  }

  /** Steps toward `target` over `dtSeconds`, and returns the new value. */
  update(dtSeconds: number, target: number): number {
    const frame = Math.min(Math.max(dtSeconds, 0), MAX_FRAME)
    if (frame === 0) return this.y
    const targetVelocity = (target - this.previousTarget) / frame
    this.previousTarget = target
    let left = frame
    while (left > 1e-9) {
      const step = Math.min(left, MAX_STEP)
      // The clamp keeps k2 above the explicit step's stability bound.
      const k2 = Math.max(this.k2, (step * step) / 2 + (step * this.k1) / 2, step * this.k1)
      this.y += step * this.yd
      this.yd += (step * (target + this.k3 * targetVelocity - this.y - this.k1 * this.yd)) / k2
      left -= step
    }
    return this.y
  }

  /** Displaces the value without moving the target, so it springs back. */
  knock(offset: number): void {
    this.y += offset
  }

  /** Lifts the value to `height` if it is below it, from rest, without moving the target: a knock that never stacks. */
  lift(height: number): void {
    if (this.y >= height) return
    this.y = height
    this.yd = 0
  }

  /** Jumps to `value` at rest: a respawn, or reduced motion. */
  set(value: number): void {
    this.y = value
    this.yd = 0
    this.previousTarget = value
  }

  get value(): number {
    return this.y
  }

  get velocity(): number {
    return this.yd
  }

  /** At its last target and not moving. */
  get settled(): boolean {
    return Math.abs(this.y - this.previousTarget) < SETTLE_EPSILON && Math.abs(this.yd) < SETTLE_EPSILON
  }
}

/** Snaps a drawn value onto a grid of `step`: whole units, scale steps, lean steps. Never -0. */
export function snapTo(value: number, step: number): number {
  const snapped = Math.round(value / step) * step
  return snapped === 0 ? 0 : snapped
}
