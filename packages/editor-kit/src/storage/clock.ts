/**
 * Time and timers for the storage layer. `now` is epoch milliseconds, because an autosave's `savedAt` is compared
 * with a file's modification time; it is structurally a `GestureClock`, so tests pass `createTestClock(1_700_000_000_000)`.
 */
export interface StorageClock {
  now(): number
  setTimer(ms: number, run: () => void): unknown
  clearTimer(handle: unknown): void
}

export const systemClock: StorageClock = {
  now: () => Date.now(),
  setTimer: (ms, run) => setTimeout(run, ms),
  clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}
