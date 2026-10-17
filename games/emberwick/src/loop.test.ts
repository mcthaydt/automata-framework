import { describe, expect, it } from 'vitest'
import { createLoop, MAX_STEPS_PER_FRAME, STEP_MS } from './loop.ts'

/** A clock and frame scheduler driven by hand: `frame(t)` moves the clock to t and runs the scheduled frame. */
function fakeFrames(start = 1000) {
  let pending: (() => void) | null = null
  let time = start
  return {
    now: () => time,
    request: (fn: () => void) => {
      pending = fn
      return 1
    },
    cancel: () => {
      pending = null
    },
    frame: (at: number) => {
      time = at
      const fn = pending
      pending = null
      fn?.()
    },
    get scheduled() {
      return pending !== null
    },
  }
}

function setup() {
  const frames = fakeFrames()
  const counts = { steps: 0, draws: 0 }
  const loop = createLoop({
    now: frames.now,
    requestFrame: frames.request,
    cancelFrame: frames.cancel,
    onStep: () => {
      counts.steps++
    },
    onFrame: () => {
      counts.draws++
    },
  })
  return { frames, counts, loop }
}

describe('the fixed-step loop', () => {
  it('steps 60 times for one second of frames at 60 Hz', () => {
    const { frames, counts, loop } = setup()
    loop.start()
    for (let i = 1; i <= 60; i++) frames.frame(1000 + i * STEP_MS)
    expect(counts.steps).toBe(60)
    expect(counts.draws).toBe(60)
  })

  it('steps twice on a frame that took two ticks (a 30 Hz display)', () => {
    const { frames, counts, loop } = setup()
    loop.start()
    frames.frame(1000 + 2 * STEP_MS)
    expect(counts.steps).toBe(2)
  })

  it('catches up at most a few steps after a long stall, then drops the rest', () => {
    const { frames, counts, loop } = setup()
    loop.start()
    frames.frame(1000 + 5000)
    expect(counts.steps).toBe(MAX_STEPS_PER_FRAME)
    frames.frame(1000 + 5000 + STEP_MS)
    expect(counts.steps).toBe(MAX_STEPS_PER_FRAME + 1)
  })

  it('does nothing once stopped, and restarting does not replay the stopped time', () => {
    const { frames, counts, loop } = setup()
    loop.start()
    frames.frame(1000 + STEP_MS)
    loop.stop()
    expect(frames.scheduled).toBe(false)
    frames.frame(1000 + 100 * STEP_MS)
    expect(counts.steps).toBe(1)
  })

  it('stops stepping at once when a step stops the loop', () => {
    const frames = fakeFrames()
    let steps = 0
    const loop = createLoop({
      now: frames.now,
      requestFrame: frames.request,
      cancelFrame: frames.cancel,
      onStep: () => {
        steps++
        loop.stop() // the goal was reached on this step
      },
      onFrame: () => {},
    })
    loop.start()
    frames.frame(1000 + 3 * STEP_MS)
    expect(steps).toBe(1)
    expect(frames.scheduled).toBe(false)
  })
})
