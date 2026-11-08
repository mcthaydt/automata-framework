/** The recognizer's only sources of time, injected so its rules run on a fake clock. */
export interface GestureClock {
  now(): number
  setTimer(ms: number, run: () => void): unknown
  clearTimer(handle: unknown): void
}

/** The browser's clock and timers. */
export const realClock: GestureClock = {
  now: () => performance.now(),
  setTimer: (ms, run) => setTimeout(run, ms),
  clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}
