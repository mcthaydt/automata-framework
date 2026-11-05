// Replaces Effect's `Clock`. Code that waits takes a `Clock` as an argument instead of reaching for `setTimeout`, so a
// test can hand it `fakeClock()` (src/testing/fake-clock.ts) and move time by hand, the way `TestClock` did.

/** What a timeout is called back with: opaque, only ever handed back to `clearTimeout`. */
export type TimeoutHandle = unknown

export interface Clock {
  /** Milliseconds; only differences between two calls mean anything. */
  now(): number
  setTimeout(callback: () => void, ms: number): TimeoutHandle
  clearTimeout(handle: TimeoutHandle): void
}

/** The real clock. `performance.now()` is steady: it does not jump when the player changes the system time. */
export const systemClock: Clock = {
  now: () => performance.now(),
  setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
}
