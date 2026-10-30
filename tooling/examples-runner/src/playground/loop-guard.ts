// The playground's loop guard (website playground spec §7.3). The compile step puts a call to it at the top of every
// loop body. It counts calls and reads the clock once per LOOP_GUARD_SAMPLE of them; the first reading in a stretch of
// synchronous work records when the stretch began and asks `onStretch` to call back when the stretch ends (the frame
// posts to itself on a MessageChannel, delivered only once the event loop gets a turn; not animation frames or timers,
// which an off-screen frame may not get). A later reading more than `limitMs` after the start throws, naming the line.
// It reads the clock and nothing else, so a run that never trips it hashes the same as the unguarded code.

/** Calls between two clock readings. */
export const LOOP_GUARD_SAMPLE = 1024

export class LoopGuardError extends Error {
  readonly line: number
  constructor(line: number, limitMs: number) {
    super(`this loop ran for over ${limitMs / 1000} s without a break, so the preview stopped it`)
    this.name = 'LoopGuardError'
    this.line = line
  }
}

export interface LoopGuardOptions {
  readonly now: () => number
  /** Calls `end` once the current stretch of synchronous work is over. */
  readonly onStretch: (end: () => void) => void
  readonly limitMs: number
}

export function createLoopGuard(options: LoopGuardOptions): (line: number) => void {
  let calls = 0
  let stretchStart: number | undefined
  const endStretch = () => {
    stretchStart = undefined
  }
  return (line) => {
    calls += 1
    if (calls % LOOP_GUARD_SAMPLE !== 0) return
    const now = options.now()
    if (stretchStart === undefined) {
      stretchStart = now
      options.onStretch(endStretch)
      return
    }
    if (now - stretchStart > options.limitMs) throw new LoopGuardError(line, options.limitMs)
  }
}
