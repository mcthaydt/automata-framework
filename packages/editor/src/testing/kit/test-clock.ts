import type { GestureClock } from '../../shared/kit/gestures/gesture-clock'

export interface TestClock extends GestureClock {
  /** Moves time forward, running every timer that falls due on the way, in order, each seeing its own due time. */
  advance(ms: number): void
}

/** A fake `now` and timer set for the renderer-free tests. */
export function createTestClock(start = 0): TestClock {
  let time = start
  let next = 1
  const timers = new Map<number, { due: number; run: () => void }>()
  return {
    now: () => time,
    setTimer(ms, run) {
      const handle = next++
      timers.set(handle, { due: time + ms, run })
      return handle
    },
    clearTimer(handle) {
      timers.delete(handle as number)
    },
    advance(ms) {
      const target = time + ms
      for (;;) {
        let soonest: [number, { due: number; run: () => void }] | undefined
        for (const entry of timers) {
          if (entry[1].due <= target && (soonest === undefined || entry[1].due < soonest[1].due))
            soonest = entry
        }
        if (soonest === undefined) break
        timers.delete(soonest[0])
        time = soonest[1].due
        soonest[1].run()
      }
      time = target
    },
  }
}
