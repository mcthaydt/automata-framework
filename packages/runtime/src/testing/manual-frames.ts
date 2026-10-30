import type { FrameSource } from '../loop/frames.js'

/** A frame source a test drives: `advance` moves time on and runs the frame asked for, if any. */
export interface ManualFrames extends FrameSource {
  advance(ms: number): void
  readonly pending: boolean
}

/** A frame source that runs a frame only when a test advances it, starting at `startMs`. */
export function manualFrames(startMs = 0): ManualFrames {
  let time = startMs
  let pendingCallback: ((timestamp: number) => void) | null = null
  let nextHandle = 1

  return {
    now: () => time,
    request: (callback: (timestamp: number) => void) => {
      pendingCallback = callback
      return nextHandle++
    },
    cancel: (_handle: number) => {
      pendingCallback = null
    },
    advance: (ms: number) => {
      time += ms
      if (pendingCallback !== null) {
        const cb = pendingCallback
        pendingCallback = null
        // Misleading timestamp to prove the frame loop reads frames.now() rather than the callback argument
        cb(999_999_999)
      }
    },
    get pending() {
      return pendingCallback !== null
    },
  }
}
