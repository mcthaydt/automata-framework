import type { RenderTarget } from '@automataframework/automata'
import { Duration, Effect, Fiber, Runtime } from 'effect'

/**
 * How long the renderer waits for the browser to give a lost WebGL context back before it shows the "picture
 * stopped" panel (M3 spec §5). Browsers that restore do so within a second or two; the spec names no figure, so
 * this is the agent's default (M3.4a).
 */
export const CONTEXT_RESTORE_MS = 5000

export interface ContextWatchOptions {
  /** The renderer's canvas: `webglcontextlost` and `webglcontextrestored` arrive on it. */
  readonly canvas: EventTarget
  /** The WebGPU device, when the renderer is WebGPU: its `lost` settles once and the device never comes back. */
  readonly device?: { readonly lost: Promise<unknown> } | undefined
  readonly bus: RenderTarget['bus']
  /** Runs the wait on the game's clock (a test clock in tests). */
  readonly runtime: Runtime.Runtime<never>
  /** The context will not come back: the renderer asks for the panel and rebuilds itself on Try again. */
  readonly onGone: () => void
}

export interface ContextWatch {
  /** Whether the context is lost now: the renderer draws nothing while it is. */
  lost(): boolean
  stop(): void
}

/**
 * Watches the renderer's graphics context (M3 spec §5). A lost WebGL context is published as `render.context.lost`
 * and nothing is drawn; when the browser gives it back within `CONTEXT_RESTORE_MS`, Pixi re-creates its GPU
 * resources and `@pixi/3d`'s meshes upload again on the next draw (renderer.parity.test.ts shows the frame after a
 * restore equals the frame before the loss), and `render.context.restored` is published. When it does not, or when
 * a WebGPU device is lost (it never comes back), `onGone` is called.
 */
export function watchContextLoss(options: ContextWatchOptions): ContextWatch {
  let lost = false
  let stopped = false
  let wait: Fiber.RuntimeFiber<void> | undefined
  const run = Runtime.runFork(options.runtime)
  const cancelWait = (): void => {
    if (wait !== undefined) run(Fiber.interrupt(wait))
    wait = undefined
  }
  const onLost = (): void => {
    lost = true
    options.bus?.publish('render.context.lost', {})
    cancelWait()
    wait = run(
      Effect.sleep(Duration.millis(CONTEXT_RESTORE_MS)).pipe(
        Effect.andThen(
          Effect.sync(() => {
            wait = undefined
            if (lost && !stopped) options.onGone()
          }),
        ),
      ),
    )
  }
  const onRestored = (): void => {
    lost = false
    cancelWait()
    options.bus?.publish('render.context.restored', {})
  }
  options.canvas.addEventListener('webglcontextlost', onLost)
  options.canvas.addEventListener('webglcontextrestored', onRestored)
  options.device?.lost.then(
    (info) => {
      // A device the renderer destroyed itself is not a loss.
      if (stopped || (info as { reason?: string } | undefined)?.reason === 'destroyed') return
      lost = true
      options.bus?.publish('render.context.lost', {})
      options.onGone()
    },
    () => {},
  )
  return {
    lost: () => lost,
    stop: () => {
      stopped = true
      cancelWait()
      options.canvas.removeEventListener('webglcontextlost', onLost)
      options.canvas.removeEventListener('webglcontextrestored', onRestored)
    },
  }
}
