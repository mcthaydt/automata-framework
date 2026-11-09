// A track: keys of one value type in time order, and the time a loop mode makes of a clock.

import type { Ease } from './ease.ts'
import type { Key } from './key.ts'

export type Track<V> = readonly Key<V>[]

/** How time past the end runs: held at the end, wrapped round, or bounced back and forth. */
export type LoopMode = 'once' | 'hold' | 'loop' | 'pingpong'

/** A track from `[t, value, ease?]` rows, sorted by time (keys at one time keep the order they were written in). */
export function track<V>(rows: readonly (readonly [number, V, Ease?])[]): Track<V> {
  return rows
    .map(([t, value, ease], order) => ({ key: { t, value, ease }, order }))
    .sort((p, q) => p.key.t - q.key.t || p.order - q.order)
    .map((row) => row.key)
}

/**
 * The time inside a span of `length` seconds after `elapsed` seconds of play. `once` and `hold` clamp to
 * [0, length] (whether `once` has ended is the caller's); `loop` wraps, so `length` itself is 0; `pingpong` runs
 * forward then back over twice the length. A negative `elapsed` is 0.
 */
export function wrapTime(mode: LoopMode, length: number, elapsed: number): number {
  const t = Math.max(0, elapsed)
  switch (mode) {
    case 'once':
    case 'hold':
      return Math.min(t, length)
    case 'loop':
      return t % length
    case 'pingpong': {
      const u = t % (2 * length)
      return u <= length ? u : 2 * length - u
    }
  }
}
