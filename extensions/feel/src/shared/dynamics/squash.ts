// Squash and stretch on a spring: a knock sends a view's x out and y in, and
// the spring settles back to rest with its own wobble. Drawn on steps of 1/32, so the pixel art keeps whole scales while the
// motion underneath keeps its overshoot. Keyed by any view (a number or a name).
import type { SpringTuning } from '../feel.schema'
import { SecondOrder, snapTo } from './second-order'

export type Scale = { readonly x: number; readonly y: number }
export type ViewKey = string | number

const REST: Scale = { x: 1, y: 1 }
/** The scale grid a squash is drawn on. */
const SCALE_STEP = 1 / 32

/** Every view's squash spring, at rest 0: the value is how far x is out and y is in. */
export class SquashBook {
  private readonly springs = new Map<ViewKey, SecondOrder>()
  private readonly spring: () => SpringTuning

  constructor(spring: () => SpringTuning) {
    this.spring = spring
  }

  /** Knocks a view's squash to `amount`; a landing on one still settling re-knocks it, never past its amount. */
  knock(id: ViewKey, amount: number): void {
    let spring = this.springs.get(id)
    if (spring === undefined) {
      spring = new SecondOrder(this.spring())
      this.springs.set(id, spring)
    }
    spring.lift(amount)
  }

  /** Steps every squash toward rest, except the frozen views': hit-stop holds their pose. */
  update(dtSeconds: number, frozen: ReadonlySet<ViewKey> = new Set()): void {
    const tuning = this.spring()
    for (const [id, spring] of this.springs) {
      spring.retune(tuning)
      if (!frozen.has(id)) spring.update(dtSeconds, 0)
    }
  }

  /** A view's scale as drawn. */
  scaleOf(id: ViewKey): Scale {
    const spring = this.springs.get(id)
    if (spring === undefined) return REST
    return { x: snapTo(1 + spring.value, SCALE_STEP), y: snapTo(1 - spring.value, SCALE_STEP) }
  }

  /** The views that are not at rest, with their scales, in the order they were first knocked. */
  scales(): [ViewKey, Scale][] {
    return [...this.springs].filter(([, spring]) => !spring.settled).map(([id]) => [id, this.scaleOf(id)])
  }

  /** Every view at rest at once: reduced motion, a restart. */
  settle(): void {
    for (const spring of this.springs.values()) spring.set(0)
  }

  /** Squashes still moving. */
  get moving(): number {
    let moving = 0
    for (const spring of this.springs.values()) if (!spring.settled) moving += 1
    return moving
  }
}
