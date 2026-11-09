import type { Command, Sim } from '@automata/sim'
import type { PresentationBus } from '../presentation/presentation-bus.manager.js'
import type { GameRenderer } from '../render/renderer.js'
import type { Time } from '../time/time.manager.js'
import { createFrameLoop, stepOnce } from './frame-loop.js'
import type { FrameSource } from './frames.js'

/**
 * The frame loop service: `run` steps a sim at its fixed tick rate from display frames, with the commands for each
 * tick, and the renderer draws every frame. No step runs while `Time` is paused; a throw from a step stops it.
 */
export interface AppLoop {
  run(options: { sim: Sim; commands: (tick: number) => readonly Command[] }): void
  stop(): void
  readonly running: boolean
}

export interface AppLoopOptions {
  readonly frames: FrameSource
  readonly renderer: GameRenderer
  readonly time: Time
  readonly bus: PresentationBus
  readonly onFault: (cause: unknown) => void
  readonly logError?: (error: unknown) => void
}

/**
 * Creates the runtime AppLoop.
 * The frame loop runs without allocating per frame.
 * A throw from step stops the loop, calls onFault once and requests no further frames.
 * `dispose()` cancels any pending frame and prevents further runs.
 */
export function createAppLoop(options: AppLoopOptions): AppLoop & { dispose(): void } {
  let closed = false
  let faulted = false
  let currentSim: Sim | null = null
  let currentCommands: ((tick: number) => readonly Command[]) | null = null

  const loop = createFrameLoop({
    frames: options.frames,
    isPaused: () => options.time.paused,
    stepMs: () => (currentSim ? 1000 / currentSim.tickHz : 1000 / 60),
    step: () => {
      if (!currentSim || !currentCommands || faulted || closed) return
      try {
        stepOnce(currentSim, currentCommands, options.renderer, options.bus, options.logError)
      } catch (cause) {
        faulted = true
        loop.stop()
        options.onFault(cause)
      }
    },
    draw: (frame) => {
      if (closed) return
      options.renderer.draw(frame)
    },
  })

  return {
    run(opts) {
      if (closed || faulted) return
      currentSim = opts.sim
      currentCommands = opts.commands
      options.renderer.reset()
      loop.reset()
      if (!loop.running) {
        loop.start()
      }
    },
    stop() {
      loop.stop()
    },
    get running() {
      return loop.running
    },
    dispose() {
      closed = true
      loop.stop()
    },
  }
}
