// The timers one piece of work owns (a reconnect loop's waits and its attempts' time limits), so that stopping the
// work ends all of them at once: each waiting call is answered now, and no timer is left on the clock.

import type { Clock, TimeoutHandle } from '@automata/framework'

export interface Stopper {
  readonly stopped: boolean
  /** Calls `callback` once after `ms`, or at once if the stopper stops first. Returns a cancel that drops the call. */
  after(ms: number, callback: () => void): () => void
  /** Resolves after `ms`, or when the stopper stops. */
  sleep(ms: number): Promise<void>
  /** Answers everything waiting, now, and every later `after` too. */
  stop(): void
}

interface Waiting {
  readonly handle: TimeoutHandle
  readonly callback: () => void
}

export function createStopper(clock: Clock): Stopper {
  const waiting = new Set<Waiting>()
  let stopped = false
  const after = (ms: number, callback: () => void): (() => void) => {
    if (stopped) {
      callback()
      return () => undefined
    }
    const entry: Waiting = {
      callback,
      handle: clock.setTimeout(() => {
        waiting.delete(entry)
        callback()
      }, ms),
    }
    waiting.add(entry)
    return () => {
      if (!waiting.delete(entry)) return
      clock.clearTimeout(entry.handle)
    }
  }
  return {
    get stopped() {
      return stopped
    },
    after,
    sleep: (ms) => new Promise<void>((resolve) => after(ms, resolve)),
    stop() {
      stopped = true
      const answered = [...waiting]
      waiting.clear()
      for (const entry of answered) {
        clock.clearTimeout(entry.handle)
        entry.callback()
      }
    },
  }
}
