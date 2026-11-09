import type { Command, Sim } from '@automata/sim'
import type { PresentationBus } from '../presentation/presentation-bus.manager.js'
import type { GameRenderer } from '../render/renderer.js'
import { type FrameInfo, type FrameSource, MAX_FRAME_MS } from './frames.js'

export interface FrameLoopOptions {
  readonly frames: FrameSource
  readonly isPaused: () => boolean
  readonly stepMs: number | (() => number)
  readonly step: () => void
  readonly draw: (frame: FrameInfo) => void
}

export interface FrameLoop {
  start(): void
  stop(): void
  reset(): void
  readonly running: boolean
}

// 1e-6 ms tolerance keeps a frame of exactly one step from losing it due to float inaccuracy
const TOLERANCE_MS = 1e-6

/**
 * Executes a single simulation step in order:
 * 1. commands(sim.tick)
 * 2. sim.step(cmds)
 * 3. renderer.apply(result)
 * 4. rejected commands logged to logError if provided
 * 5. sim.events, then sim.step (the same events with the step's tick), published on the bus only when result.events is non-empty
 */
export function stepOnce(
  sim: Sim,
  commands: (tick: number) => readonly Command[],
  renderer: GameRenderer,
  bus: PresentationBus,
  logError?: (error: unknown) => void,
): void {
  const cmds = commands(sim.tick)
  const result = sim.step(cmds)
  renderer.apply(result)
  if (result.rejected.length > 0 && logError) {
    for (const rejected of result.rejected) {
      logError(rejected)
    }
  }
  if (result.events.length > 0) {
    bus.publish('sim.events', result.events)
    bus.publish('sim.step', { tick: result.tick, events: result.events })
  }
}

export function createFrameLoop(options: FrameLoopOptions): FrameLoop {
  let isRunning = false
  let handle: number | null = null
  let last = 0
  let accumulator = 0

  // One FrameInfo object reused every frame to avoid garbage collection pressure
  const frameInfo: FrameInfo = {
    alpha: 0,
    frameMs: 0,
    paused: false,
  }

  const frame = (_timestamp?: number) => {
    if (!isRunning) return

    // 1. Time comes from frames.now(), not the rAF timestamp (emberwick loop.ts: one time base for start and frames)
    const now = options.frames.now()
    const rawElapsed = now - last
    last = now

    // Clamped to [0, MAX_FRAME_MS]
    const elapsed = Math.min(Math.max(rawElapsed, 0), MAX_FRAME_MS)
    frameInfo.frameMs = elapsed

    const paused = options.isPaused()
    frameInfo.paused = paused

    // 2. While Time is paused the accumulator is zero and no step runs
    if (paused) {
      accumulator = 0
      frameInfo.alpha = 1
      options.draw(frameInfo)
    } else {
      // 3. Otherwise accumulator += elapsed; while accumulator >= stepMs - 1e-6, run step
      const stepMs = typeof options.stepMs === 'function' ? options.stepMs() : options.stepMs
      accumulator += elapsed
      while (isRunning && accumulator >= stepMs - TOLERANCE_MS) {
        accumulator -= stepMs
        options.step()
      }

      // A step that stops the loop ends that frame's steps and requests no further frame
      if (!isRunning) {
        accumulator = 0
      } else {
        // 4. renderer.draw(frame) with alpha = accumulator / stepMs
        frameInfo.alpha = accumulator / stepMs
        options.draw(frameInfo)
      }
    }

    if (isRunning) {
      handle = options.frames.request(frame)
    }
  }

  return {
    start() {
      if (isRunning) return
      isRunning = true
      last = options.frames.now()
      accumulator = 0
      handle = options.frames.request(frame)
    },
    stop() {
      if (!isRunning) return
      isRunning = false
      accumulator = 0
      if (handle !== null) {
        options.frames.cancel(handle)
        handle = null
      }
    },
    reset() {
      accumulator = 0
    },
    get running() {
      return isRunning
    },
  }
}
