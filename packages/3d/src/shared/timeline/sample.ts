// Sampling a track is pure: no clock of its own and no state carried between calls, so a frame at `t` is the same
// whether it is drawn first, last or alone. Before the first key a track holds its first value, after the last its last.

import { type Ease, easeAt } from './ease.ts'
import type { Track } from './track.ts'

/** What bracketing needs of a key: its time, and how it is eased into. A figure clip's authored key has both. */
export interface Timed {
  readonly t: number
  readonly ease?: Ease | undefined
}

/** How two values mix, `u` of the way from `a` to `b` (u can pass [0, 1] when an ease overshoots). */
export type Mix<V> = (a: V, b: V, u: number) => V

export const mixNumber: Mix<number> = (a, b, u) => a + (b - a) * u

/** Where `t` falls in a track: the two keys either side and the eased fraction between them (a and b are one key
 * before the first and after the last). A track with no keys has no place. */
export function bracket<K extends Timed>(
  keys: readonly K[],
  t: number,
): { a: K; b: K; u: number } | undefined {
  const first = keys[0]
  const last = keys.at(-1)
  if (!first || !last) return undefined
  if (t <= first.t) return { a: first, b: first, u: 0 }
  if (t >= last.t) return { a: last, b: last, u: 0 }
  let i = 0
  while (i < keys.length - 2 && (keys[i + 1]?.t ?? Number.POSITIVE_INFINITY) <= t) i++
  const a = keys[i] as K
  const b = keys[i + 1] as K
  return { a, b, u: easeAt(b.ease, (t - a.t) / (b.t - a.t)) }
}

/** A track's value at `t`; undefined when it has no keys. A fraction of 0 or 1 is the key's own value, untouched. */
export function sample<V>(keys: Track<V>, t: number, mix: Mix<V>): V | undefined {
  const place = bracket(keys, t)
  if (!place) return undefined
  if (place.u === 0 || place.a === place.b) return place.a.value
  if (place.u === 1) return place.b.value
  return mix(place.a.value, place.b.value, place.u)
}
