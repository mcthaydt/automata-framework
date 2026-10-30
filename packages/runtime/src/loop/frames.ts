export interface FrameSource {
  now(): number
  request(callback: (timestamp: number) => void): number
  cancel(handle: number): void
}

/**
 * One display frame: the interpolation alpha between the last two ticks, the frame's length in ms, and
 * whether time is paused.
 */
export interface FrameInfo {
  alpha: number
  frameMs: number
  paused: boolean
}

/** The Last Light clock.ts 0.1 s clamp: at most 6 steps at 60 Hz, the rest is dropped */
export const MAX_FRAME_MS = 100

export function liveFrames(): FrameSource {
  return {
    now: () => performance.now(),
    request: (callback: (timestamp: number) => void) => requestAnimationFrame(callback),
    cancel: (handle: number) => cancelAnimationFrame(handle),
  }
}
