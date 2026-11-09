// A key: a value the timeline holds at a time. The one shape under a figure's clip, a light's style, a door's swing.

import type { Ease } from './ease.ts'

export interface Key<V> {
  /** Seconds from the start of whatever the track belongs to. */
  readonly t: number
  readonly value: V
  /** How the value arrives at this key from the one before; linear when left out. */
  readonly ease?: Ease | undefined
}
