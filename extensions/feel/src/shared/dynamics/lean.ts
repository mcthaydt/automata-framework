// Views lean into their motion: each skews toward its drawn sideways velocity
// on its own spring, so a turn swings through upright with a little overshoot. Drawn on `stepDeg` steps, so it reads as pixel
// art. Drawing only: nothing here reaches a hitbox or the sim.
import type { SpringTuning } from '../feel.schema'
import { SecondOrder, snapTo } from './second-order'
import type { ViewKey } from './squash'

const DEG = Math.PI / 180
/** How far past the cap a turn's overshoot may draw. */
const LEAN_OVERSHOOT = 1.25

export interface LeanTuning {
  /** The most a lean draws, in degrees. */
  readonly maxDeg: number
  /** The sideways speed at which a view leans fully. */
  readonly fullSpeed: number
  /** The grid a lean is drawn on, in degrees. */
  readonly stepDeg: number
  readonly spring: SpringTuning
}

/** The lean a view moving at `vx` springs toward: against the motion's sign (skew.x < 0 leans right), capped. */
export function leanTarget(vx: number, lean: Pick<LeanTuning, 'maxDeg' | 'fullSpeed'>): number {
  const share = Math.max(-1, Math.min(1, vx / lean.fullSpeed))
  const target = -share * lean.maxDeg * DEG
  return target === 0 ? 0 : target
}

/** Each view's lean on its own spring. */
export class LeanBook {
  private readonly springs = new Map<ViewKey, SecondOrder>()
  private readonly braces = new Map<ViewKey, { readonly target: number; readonly untilMs: number }>()
  private step = 3 * DEG
  /** The most a drawn lean may show: a quarter over the cap, whatever the spring is tuned to. */
  private limit = 15 * DEG

  /** A sharp lateral tilt toward a contacted wall face, for 100 ms. */
  brace(id: ViewKey, towardLeft: boolean, nowMs: number): void {
    this.braces.set(id, { target: (towardLeft ? -18 : 18) * DEG, untilMs: nowMs + 100 })
  }

  /** Steps every view's lean toward its motion, except the frozen ones' (hit-stop). */
  update(
    views: readonly { readonly id: ViewKey; readonly vx: number }[],
    dtSeconds: number,
    tuning: LeanTuning,
    frozen: ReadonlySet<ViewKey> = new Set(),
  ): void {
    this.step = tuning.stepDeg * DEG
    this.limit = tuning.maxDeg * LEAN_OVERSHOOT * DEG
    for (const view of views) {
      let spring = this.springs.get(view.id)
      if (spring === undefined) {
        spring = new SecondOrder(tuning.spring)
        this.springs.set(view.id, spring)
      }
      spring.retune(tuning.spring)
      if (!frozen.has(view.id)) spring.update(dtSeconds, leanTarget(view.vx, tuning))
    }
  }

  /** A view's lean as drawn, in radians on whole steps. */
  drawnOf(id: ViewKey, nowMs?: number): number {
    if (nowMs !== undefined) {
      const brace = this.braces.get(id)
      if (brace !== undefined) {
        if (nowMs < brace.untilMs) return brace.target
        this.braces.delete(id)
      }
    }
    const value = this.springs.get(id)?.value ?? 0
    // Clamped onto a whole step inside the limit: a loose spring overshoots, the drawing never runs away.
    const bound = Math.floor(this.limit / this.step + 1e-9) * this.step
    return snapTo(Math.max(-bound, Math.min(bound, value)), this.step)
  }

  forget(id: ViewKey): void {
    this.springs.delete(id)
    this.braces.delete(id)
  }

  /** Every view upright at once: reduced motion, a restart. */
  settle(): void {
    this.braces.clear()
    for (const spring of this.springs.values()) spring.set(0)
  }
}
