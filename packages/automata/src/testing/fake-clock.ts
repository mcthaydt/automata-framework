// Replaces Effect's `TestClock`: time stands still until a test calls `advance`.
import type { Clock, TimeoutHandle } from '#src/shared/lib/clock.ts'

export interface FakeClock extends Clock {
  /** Moves time forward by `ms`, firing every timeout that falls due on the way, earliest first. */
  advance(ms: number): void
  /** How many timeouts are still waiting. */
  pending(): number
}

interface Timer {
  readonly id: number
  readonly at: number
  readonly callback: () => void
}

export function fakeClock(): FakeClock {
  let now = 0
  let nextId = 0
  const timers = new Map<number, Timer>()

  /** The next timer due by `limit`: earliest time, then the one set first. */
  function nextDue(limit: number): Timer | undefined {
    let best: Timer | undefined
    for (const timer of timers.values()) {
      if (timer.at > limit) continue
      if (best === undefined || timer.at < best.at || (timer.at === best.at && timer.id < best.id))
        best = timer
    }
    return best
  }

  return {
    now: () => now,
    setTimeout(callback, ms) {
      const id = nextId++
      timers.set(id, { id, at: now + ms, callback })
      return id
    },
    clearTimeout(handle: TimeoutHandle) {
      timers.delete(handle as number)
    },
    advance(ms) {
      const target = now + ms
      for (let timer = nextDue(target); timer !== undefined; timer = nextDue(target)) {
        timers.delete(timer.id)
        // A timeout sees the time it was set for, not the end of the advance.
        now = timer.at
        timer.callback()
      }
      now = target
    },
    pending: () => timers.size,
  }
}
