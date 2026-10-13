import { describe, expect, it } from 'vitest'
import { manualFrames } from '../testing/manual-frames.js'
import { createFrameLoop } from './frame-loop.js'
import { type FrameInfo, MAX_FRAME_MS } from './frames.js'

describe('createFrameLoop', () => {
  const STEP_60_HZ = 1000 / 60

  it('fixed ticks however frames group: one second as 60 frames of 1000/60 ms and as 30 frames of 1000/30 ms both give 60 steps at 60 Hz', () => {
    // 60 frames of 1000/60 ms
    const frames60 = manualFrames(0)
    let steps60 = 0
    let draws60 = 0
    const loop60 = createFrameLoop({
      frames: frames60,
      isPaused: () => false,
      stepMs: STEP_60_HZ,
      step: () => {
        steps60++
      },
      draw: () => {
        draws60++
      },
    })
    loop60.start()
    for (let i = 0; i < 60; i++) {
      frames60.advance(STEP_60_HZ)
    }
    expect(steps60).toBe(60)
    expect(draws60).toBe(60)

    // 30 frames of 1000/30 ms
    const frames30 = manualFrames(0)
    let steps30 = 0
    let draws30 = 0
    const loop30 = createFrameLoop({
      frames: frames30,
      isPaused: () => false,
      stepMs: STEP_60_HZ,
      step: () => {
        steps30++
      },
      draw: () => {
        draws30++
      },
    })
    loop30.start()
    for (let i = 0; i < 30; i++) {
      frames30.advance(1000 / 30)
    }
    expect(steps30).toBe(60)
    expect(draws30).toBe(30)
  })

  it('paused time is dropped: frames while isPaused() run no step, draw with alpha 1, and the accumulator is 0 after', () => {
    const frames = manualFrames(0)
    let paused = false
    let steps = 0
    let lastFrame: FrameInfo | undefined
    const loop = createFrameLoop({
      frames,
      isPaused: () => paused,
      stepMs: STEP_60_HZ,
      step: () => {
        steps++
      },
      draw: (frame) => {
        lastFrame = { ...frame }
      },
    })
    loop.start()

    // 1 frame normal
    frames.advance(STEP_60_HZ)
    expect(steps).toBe(1)
    expect(lastFrame?.paused).toBe(false)
    expect(lastFrame?.alpha).toBeCloseTo(0, 5)

    // Pause for 500 ms (many steps of time)
    paused = true
    frames.advance(500)
    expect(steps).toBe(1) // no new step
    expect(lastFrame?.paused).toBe(true)
    expect(lastFrame?.alpha).toBe(1)

    // Resume: next frame of 0.5 step should NOT step if accumulator was 0
    paused = false
    frames.advance(STEP_60_HZ * 0.5)
    expect(steps).toBe(1)
    expect(lastFrame?.paused).toBe(false)
    expect(lastFrame?.alpha).toBeCloseTo(0.5, 5)
  })

  it('a long frame is capped: one 1 000 ms frame gives 6 steps at 60 Hz (MAX_FRAME_MS 100)', () => {
    const frames = manualFrames(0)
    let steps = 0
    let lastFrame: FrameInfo | undefined
    const loop = createFrameLoop({
      frames,
      isPaused: () => false,
      stepMs: STEP_60_HZ,
      step: () => {
        steps++
      },
      draw: (frame) => {
        lastFrame = { ...frame }
      },
    })
    loop.start()

    frames.advance(1000)
    // 100 ms max clamped / (1000/60) = 6 steps
    expect(steps).toBe(6)
    expect(lastFrame?.frameMs).toBe(MAX_FRAME_MS)
  })

  it('reset() clears a fractional tick', () => {
    const frames = manualFrames(0)
    let steps = 0
    const loop = createFrameLoop({
      frames,
      isPaused: () => false,
      stepMs: STEP_60_HZ,
      step: () => {
        steps++
      },
      draw: () => {},
    })
    loop.start()

    // Advance by 10 ms (< 16.666 ms, so 0 steps, accumulator = 10 ms)
    frames.advance(10)
    expect(steps).toBe(0)

    // reset() clears the 10 ms accumulator
    loop.reset()

    // Advance by 10 ms again: if not reset, accumulator would be 20 ms -> 1 step.
    // Because it was reset, accumulator is 10 ms -> 0 steps.
    frames.advance(10)
    expect(steps).toBe(0)

    // Advance by another 10 ms -> 20 ms -> 1 step
    frames.advance(10)
    expect(steps).toBe(1)
  })

  it('time comes from frames.now(), not the callback timestamp (manualFrames passes a misleading timestamp)', () => {
    const frames = manualFrames(100)
    let steps = 0
    const loop = createFrameLoop({
      frames,
      isPaused: () => false,
      stepMs: STEP_60_HZ,
      step: () => {
        steps++
      },
      draw: () => {},
    })
    loop.start()

    // advance passes misleading timestamp (999_999_999) to the callback
    frames.advance(STEP_60_HZ)
    expect(steps).toBe(1)
  })

  it('a step that stops the loop ends that frame steps and requests no further frame; restarting does not replay the stopped time', () => {
    const frames = manualFrames(0)
    let steps = 0
    let draws = 0
    let loop!: ReturnType<typeof createFrameLoop>
    loop = createFrameLoop({
      frames,
      isPaused: () => false,
      stepMs: STEP_60_HZ,
      step: () => {
        steps++
        if (steps === 1) {
          loop.stop()
        }
      },
      draw: () => {
        draws++
      },
    })
    loop.start()

    // Advance 50 ms (normally 3 steps)
    frames.advance(50)
    expect(steps).toBe(1)
    expect(draws).toBe(0) // stopped during step, draw not called
    expect(loop.running).toBe(false)
    expect(frames.pending).toBe(false) // no further frame requested

    // Stopped time: advance frames while stopped
    frames.advance(5000)

    // Restart
    loop.start()
    expect(loop.running).toBe(true)
    expect(frames.pending).toBe(true)

    // Advance one frame: should not replay the 5000 ms stopped time
    frames.advance(STEP_60_HZ)
    expect(steps).toBe(2)
    expect(draws).toBe(1)
  })

  it('draw gets the same FrameInfo object every frame with alpha = accumulator / stepMs and frameMs the clamped elapsed time', () => {
    const frames = manualFrames(0)
    const seenObjects: FrameInfo[] = []
    const alphas: number[] = []
    const frameMsList: number[] = []

    const loop = createFrameLoop({
      frames,
      isPaused: () => false,
      stepMs: STEP_60_HZ,
      step: () => {},
      draw: (frame) => {
        seenObjects.push(frame)
        alphas.push(frame.alpha)
        frameMsList.push(frame.frameMs)
      },
    })
    loop.start()

    // Frame 1: 10 ms (alpha = 10 / STEP_60_HZ)
    frames.advance(10)
    // Frame 2: 20 ms (accum was 10, + 20 = 30. Step takes 16.666..., remaining 13.333...)
    frames.advance(20)

    expect(seenObjects).toHaveLength(2)
    expect(seenObjects[0]).toBe(seenObjects[1]) // exactly the same reused object reference
    expect(alphas[0]).toBeCloseTo(10 / STEP_60_HZ, 5)
    expect(frameMsList[0]).toBe(10)
    expect(frameMsList[1]).toBe(20)
  })

  it('a frame of exactly one step runs that step (the 1e-6 tolerance)', () => {
    const frames = manualFrames(0)
    let steps = 0
    const loop = createFrameLoop({
      frames,
      isPaused: () => false,
      stepMs: STEP_60_HZ,
      step: () => {
        steps++
      },
      draw: () => {},
    })
    loop.start()

    // Advance by slightly less than stepMs, but within 1e-6 tolerance (e.g. stepMs - 0.5e-6)
    frames.advance(STEP_60_HZ - 0.5e-6)
    expect(steps).toBe(1)
  })
})
