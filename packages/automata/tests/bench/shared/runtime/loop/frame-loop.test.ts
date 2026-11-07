import type { Command, Sim, StepResult } from '@automata/sim'
import { describe, expect, it } from 'vitest'
import { createFrameLoop, stepOnce } from '#src/shared/runtime/loop/frame-loop.ts'
import type { PresentationBus } from '#src/shared/runtime/presentation/presentation-bus.manager.ts'
import type { GameRenderer } from '#src/shared/runtime/render/renderer.ts'
import { manualFrames } from '#src/testing/runtime/manual-frames.ts'

// M1.5 spec §9 / Task 20:
// Measures frame-loop overhead per frame (median µs over 10 000 frames)
// with a no-op sim double and nullRenderer on manualFrames, after a warm-up.
// Runs under `bench` (Node) and `bench-chromium` (headless Chromium).

describe('frame loop overhead benchmark', () => {
  const STEP_60_HZ = 1000 / 60
  const WARMUP_FRAMES = 1_000
  const TOTAL_FRAMES = 10_000
  const BATCH_SIZE = 1_000
  const BATCH_COUNT = TOTAL_FRAMES / BATCH_SIZE

  it('measures median µs per frame across 10 000 frames', () => {
    let tick = 0
    const emptyResult: StepResult = {
      tick: 0,
      events: [],
      render: { resync: false, added: [], changed: [], removed: [] },
      rejected: [],
    }

    const sim: Sim = {
      get tick() {
        return tick
      },
      step: (_cmds: readonly Command[]) => {
        tick++
        return emptyResult
      },
    } as unknown as Sim

    const renderer: GameRenderer = {
      apply: () => {},
      draw: () => {},
      reset: () => {},
    }

    const bus: PresentationBus = {
      publish: () => {},
      subscribe: () => () => {},
      dispose: () => {},
    } as unknown as PresentationBus

    const frames = manualFrames(0)

    const loop = createFrameLoop({
      frames,
      isPaused: () => false,
      stepMs: STEP_60_HZ,
      step: () => {
        stepOnce(sim, () => [], renderer, bus)
      },
      draw: (frame) => {
        renderer.draw(frame)
      },
    })

    loop.start()

    // 1. Warm-up
    for (let i = 0; i < WARMUP_FRAMES; i++) {
      frames.advance(STEP_60_HZ)
    }

    // 2. Measure 10 000 frames in batches of 10 for timer precision
    const samples: number[] = new Array(BATCH_COUNT)
    for (let b = 0; b < BATCH_COUNT; b++) {
      const t0 = performance.now()
      for (let f = 0; f < BATCH_SIZE; f++) {
        frames.advance(STEP_60_HZ)
      }
      const t1 = performance.now()
      samples[b] = ((t1 - t0) * 1000) / BATCH_SIZE
    }

    loop.stop()

    samples.sort((a, b) => a - b)
    const medianUs = samples[Math.floor(samples.length / 2)] as number

    const env = typeof window !== 'undefined' ? 'Chromium' : 'Node'
    console.log(
      `[${env}] Frame loop overhead: ${medianUs.toFixed(3)} µs/frame (median of ${TOTAL_FRAMES} frames, warm-up ${WARMUP_FRAMES})`,
    )

    expect(Number.isFinite(medianUs)).toBe(true)
    expect(medianUs).toBeGreaterThan(0)
  })
})
