// Trauma shake (M6 spec §4.1; the arcade source's model, which core's `camera2d.shake` also follows): a budget from 0 to 1 that
// each impact adds to and time drains, and a shake that is the square of it, so a small knock stays a tremor and two big ones
// stack into a jolt. The noise is a hash of integers, the offset whole pixels (a 2D picture stays crisp) and capped by the limit.
import { hash } from './noise'

export class Trauma {
  private value = 0

  get level(): number {
    return this.value
  }

  /** Adds a moment's share; trauma never passes one. */
  add(amount: number): void {
    this.value = Math.min(1, this.value + Math.max(0, amount))
  }

  /** Drains `decayPerSecond` a second, down to zero. */
  update(dtSeconds: number, decayPerSecond: number): void {
    this.value = Math.max(0, this.value - decayPerSecond * Math.max(0, dtSeconds))
  }

  /** The shake at noise step `step`: whole pixels, at most `limitPx`. */
  offset(limitPx: number, seed: number, step: number): [number, number] {
    const shake = this.value * this.value
    if (shake === 0) return [0, 0]
    const axis = (k: number): number => {
      const v = Math.round((hash(seed, step, k) * 2 - 1) * limitPx * shake)
      return v === 0 ? 0 : v
    }
    return [axis(1), axis(2)]
  }

  settle(): void {
    this.value = 0
  }
}
