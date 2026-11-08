import type { StorageClock } from '../../shared/kit/storage/clock.ts'

// A clock the tests move by hand: the autosave debounce and the memory store's modification times follow it.

export interface TestClock extends StorageClock {
  /** Moves time forward, running every timer that falls due on the way, in order. */
  advance(ms: number): void
}

export function createTestClock(start = 1_700_000_000_000): TestClock {
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
