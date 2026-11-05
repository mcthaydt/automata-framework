import type { Clock } from '../lib/clock.ts'
import { LoadStalled } from './boot-error.js'

/** A download that makes no progress for this long, in ms, fails `LoadStalled`. */
export const STALL_MS = 30_000
/** After this long, in ms, a download still running is reported slow (the loader says so). */
export const SLOW_MS = 8_000

export interface GuardInfo {
  readonly url: string
  readonly bytesSoFar?: () => number
  readonly onSlow?: () => void
}

/**
 * Watches downloads: `guard` rejects a wait with `LoadStalled` after `STALL_MS` without progress (any guarded wait's
 * `progress()` counts), and calls its `onSlow` after `SLOW_MS`.
 */
export interface LoadMeter {
  progress(): void
  /**
   * Runs `wait` under the stall rule. The wait gets a signal that aborts when it stalls or when the caller's `signal`
   * aborts; the guard then rejects (with `LoadStalled`, or with the caller's abort reason). A wait's own rejection
   * passes through unchanged. Every timer is cleared when the guard settles.
   */
  guard<A>(wait: (signal: AbortSignal) => Promise<A>, info: GuardInfo, signal?: AbortSignal): Promise<A>
}

/** Creates a load meter that enforces stall and slow timeouts on asset downloads, timed by `clock`. */
export function createLoadMeter(clock: Clock): LoadMeter {
  let lastReport = clock.now()
  let activeGuards = 0

  const progress = () => {
    lastReport = clock.now()
  }

  const guard = <A>(
    wait: (signal: AbortSignal) => Promise<A>,
    info: GuardInfo,
    signal?: AbortSignal,
  ): Promise<A> => {
    // Silence before the first wait starts is not a stall: the clock starts when there is something to wait for.
    if (activeGuards === 0) lastReport = clock.now()
    activeGuards++

    const inner = new AbortController()
    const timers: unknown[] = []
    let stopCaller: (() => void) | undefined

    const finished = new Promise<A>((resolve, reject) => {
      if (info.onSlow !== undefined) timers.push(clock.setTimeout(info.onSlow, SLOW_MS))

      // The stall check sleeps until the earliest moment the wait could have stalled, then looks again: progress
      // reported meanwhile moves `lastReport`, so it sleeps once more for what is left.
      const watch = () => {
        const elapsed = clock.now() - lastReport
        if (elapsed >= STALL_MS) {
          const stalled = new LoadStalled({
            url: info.url,
            bytesSoFar: info.bytesSoFar ? info.bytesSoFar() : 0,
            stalledMs: STALL_MS,
          })
          inner.abort(stalled)
          reject(stalled)
          return
        }
        timers.push(clock.setTimeout(watch, STALL_MS - elapsed))
      }
      watch()

      if (signal !== undefined) {
        const onAbort = () => {
          inner.abort(signal.reason)
          reject(signal.reason)
        }
        if (signal.aborted) onAbort()
        else {
          signal.addEventListener('abort', onAbort, { once: true })
          stopCaller = () => signal.removeEventListener('abort', onAbort)
        }
      }

      if (!inner.signal.aborted) wait(inner.signal).then(resolve, reject)
    })

    return finished.finally(() => {
      for (const timer of timers) clock.clearTimeout(timer)
      stopCaller?.()
      activeGuards--
      lastReport = clock.now()
    })
  }

  return { progress, guard }
}
