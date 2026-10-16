// A fixed-step game loop: the sim steps at exactly 60 Hz whatever the display's rate, and the screen redraws
// once per display frame. Stand-in for the runtime's app loop and Time manager (M1.5). Time and frame
// scheduling are injected, so tests drive it by hand and the browser journeys can drive it with Playwright's
// clock.

export const STEP_MS: number = 1000 / 60
/** After a stall (a background tab, a slow device), catch up at most this many steps, then drop the rest. */
export const MAX_STEPS_PER_FRAME = 5
// Frame times are floats, so a frame exactly one step long can measure a hair under STEP_MS (1016.67 - 1000 is
// 16.6666…, just below 1000 / 60). A microsecond of slack keeps such a frame from losing its step.
const SLACK_MS = 0.001

export interface LoopOptions {
  readonly now: () => number
  readonly requestFrame: (callback: () => void) => number
  readonly cancelFrame: (handle: number) => void
  readonly onStep: () => void
  readonly onFrame: () => void
}

export interface Loop {
  start(): void
  stop(): void
}

export function createLoop(options: LoopOptions): Loop {
  let handle: number | null = null
  let last = 0
  let carried = 0

  // Time comes from `now`, not from the frame callback's timestamp: one clock for start and every frame, so a
  // frame timestamp on another time base (Playwright's fake clock, some WebViews) cannot add phantom steps.
  const frame = () => {
    const time = options.now()
    carried += time - last
    last = time
    let steps = 0
    // A step can stop the loop (the goal is reached, the game pauses): then no further step runs this frame.
    while (handle !== null && carried >= STEP_MS - SLACK_MS && steps < MAX_STEPS_PER_FRAME) {
      options.onStep()
      carried -= STEP_MS
      steps++
    }
    // Still behind after the cap: drop the backlog rather than spiralling further behind.
    if (carried >= STEP_MS) carried = 0
    options.onFrame()
    if (handle !== null) handle = options.requestFrame(frame)
  }

  return {
    start() {
      if (handle !== null) return
      last = options.now()
      carried = 0
      handle = options.requestFrame(frame)
    },
    stop() {
      if (handle !== null) options.cancelFrame(handle)
      handle = null
    },
  }
}
