/** The clock shape `@ruken/sdk-host`'s fake host takes; the game's `SdkEnv.timers` run on it too. */
export interface FakeHostClock {
  epochMs(): number
  setTimeout(fn: () => void, ms: number): unknown
  clearTimeout(handle: unknown): void
}

/** Real time, for tests that only need the host to answer. */
export const realClock: FakeHostClock = {
  epochMs: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}

/**
 * A clock that moves only when the test calls `advance`. It is both the fake
 * host's `BridgeClock` (`epochMs`) and the SDK's `SdkTimers` (`now`), so one
 * clock drives both sides (shared contracts §1.4).
 */
export interface ManualClock extends FakeHostClock {
  now(): number
  advance(ms: number): void
}

/**
 * SDK and fake-host timing (hello retries, the 10 s handshake give-up, request
 * timeouts) runs on this clock, so a test can step past them without waiting
 * (shared contracts §1.4). AF's own timing takes a `Clock` instead (`fakeClock()` in tests).
 * Timers fire in due order; a timer scheduled by another one fires in the same
 * `advance` if it falls due within it.
 */
export function manualClock(startMs = 1_760_000_000_000): ManualClock {
  let now = startMs
  let nextId = 1
  const timers = new Map<number, { due: number; fn: () => void }>()
  return {
    epochMs: () => now,
    now: () => now,
    setTimeout: (fn, ms) => {
      const id = nextId++
      timers.set(id, { due: now + Math.max(0, ms), fn })
      return id
    },
    clearTimeout: (handle) => {
      timers.delete(handle as number)
    },
    advance: (ms) => {
      const end = now + ms
      for (;;) {
        let nextTimer: [number, { due: number; fn: () => void }] | undefined
        for (const entry of timers) {
          if (entry[1].due <= end && (nextTimer === undefined || entry[1].due < nextTimer[1].due))
            nextTimer = entry
        }
        if (nextTimer === undefined) break
        timers.delete(nextTimer[0])
        now = nextTimer[1].due
        nextTimer[1].fn()
      }
      now = end
    },
  }
}
