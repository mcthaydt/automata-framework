import {
  createPixiRenderer,
  type PixiRenderer,
  type PixiRendererOptions,
  type PixiStage,
  type PixiStageHooks,
  RenderDeltaConsumer,
} from '@mcthaydt/automata-render-pixi'
import { type ModelInvalid, RendererUnavailable, type RenderTarget } from '@mcthaydt/automata-runtime'
import type { RenderRow } from '@mcthaydt/automata-sim'
import { type Container3D, View3D } from '@pixi/3d'
import { Effect, type Scope } from 'effect'
import { loadModels, type ModelLibrary } from '../model/load-models.js'
import type { EntityView3d, EntityViewResolver3d } from '../views/view-3d.js'
import { watchContextLoss } from './context-loss.js'

export interface Pixi3dOptions extends PixiRendererOptions {
  /** Component id → its 3D view (`mesh`, `box`). `entityViews` stays the 2D layer's, drawn over the 3D view. */
  readonly views: EntityViewResolver3d
  /**
   * After the `View3D` is mounted, before the first frame: the camera, the lights and the static scenery. It may
   * return hooks, which run after the views each step and frame. (M3.4b gives the camera its rig.)
   */
  readonly scene?: ((view: View3D, stage: PixiStage) => PixiStageHooks | undefined) | undefined
}

export interface Pixi3dRenderer extends PixiRenderer {
  /** The `@pixi/3d` view the scene draws in, mounted in `stage.world`. */
  readonly view: View3D
}

/** What a renderer must be for a `View3D` to draw: WebGL2 or WebGPU (Pixi's Canvas fallback draws no 3D at all). */
export interface RendererKind {
  readonly name: string
  readonly context?: { readonly webGLVersion?: number } | undefined
}

/** Whether a `View3D` can draw on this renderer: WebGPU, or WebGL at version 2. */
export function acceptsRenderer(renderer: RendererKind): boolean {
  if (renderer.name === 'webgpu') return true
  return renderer.name === 'webgl' && renderer.context?.webGLVersion === 2
}

/** Runs each defined hook in order. */
function mergeHooks(...all: readonly (PixiStageHooks | undefined)[]): PixiStageHooks {
  const hooks = all.filter((h): h is PixiStageHooks => h !== undefined)
  return {
    apply: (result) => {
      for (const h of hooks) h.apply?.(result)
    },
    draw: (frame) => {
      for (const h of hooks) h.draw?.(frame)
    },
    reset: () => {
      for (const h of hooks) h.reset?.()
    },
  }
}

interface Mounted {
  readonly view: View3D
  readonly consumer: RenderDeltaConsumer<Container3D>
  readonly hooks: PixiStageHooks
}

function mount(stage: PixiStage, options: Pixi3dOptions, models: ModelLibrary): Mounted {
  const letterboxed = options.logicalWidth != null && options.logicalHeight != null
  // Sized from the letterbox's logical field when there is one; otherwise it follows the screen.
  const view = letterboxed
    ? new View3D({ width: options.logicalWidth, height: options.logicalHeight, toneMapping: 'none' })
    : new View3D({ autoResize: true, toneMapping: 'none' })
  stage.world.addChild(view)
  const resolver: Record<string, (row: RenderRow, componentId?: string) => EntityView3d | undefined> = {}
  for (const [id, factory] of Object.entries(options.views))
    resolver[id] = (row, componentId) => factory(row, componentId, models)
  const consumer = new RenderDeltaConsumer<Container3D>(view.root, resolver)
  const hooks: PixiStageHooks = {
    apply: (result) => consumer.apply(result.render),
    draw: (frame) => consumer.interpolate(frame.alpha),
    reset: () => consumer.reset(),
  }
  return { view, consumer, hooks }
}

/**
 * The 3D renderer (M3 spec §4.1): core's Pixi renderer with one `View3D` mounted in `stage.world` through its
 * `setup`, and a second `RenderDeltaConsumer` over the view's `Container3D` root for the 3D entity views. 2D
 * layers (`stage.ui`, `stage.backdrop`, `entityViews`) keep working over it.
 *
 * Init order (2026-10-16 spec §4.1): every model file the views name is read from the runtime's loaded assets
 * first, so a bad one fails with `ModelInvalid` before anything is drawn; then the Pixi app (WebGL2 by default,
 * WebGPU when asked); then the `View3D`, the game's own `setup` and `scene`. A renderer that is not WebGL2 or
 * WebGPU (Pixi's Canvas fallback) fails with `RendererUnavailable`.
 */
export function createPixi3dRenderer(
  options: Pixi3dOptions,
): (target: RenderTarget) => Effect.Effect<Pixi3dRenderer, RendererUnavailable | ModelInvalid, Scope.Scope> {
  return (target) =>
    Effect.gen(function* () {
      const files = Object.values(options.views).flatMap((factory) => factory.models ?? [])
      const models = yield* loadModels(files, target.assets)
      // Freed when the scope closes, after the app and the views that draw them (finalizers run last-added first).
      yield* Effect.addFinalizer(() => Effect.sync(() => models.dispose()))

      let mounted: Mounted | undefined
      const base = yield* createPixiRenderer({
        ...options,
        setup: (stage) => {
          if (!acceptsRenderer(stage.app.renderer as unknown as RendererKind)) return undefined
          const made = mount(stage, options, models)
          mounted = made
          const own = options.setup?.(stage) ?? undefined
          return mergeHooks(made.hooks, own, options.scene?.(made.view, stage))
        },
      })(target)
      if (mounted === undefined) {
        const tried: ('webgl2' | 'webgpu')[] =
          options.preference === 'webgpu' ? ['webgpu', 'webgl2'] : ['webgl2']
        return yield* new RendererUnavailable({ tried })
      }

      const { view, consumer } = mounted
      const context = watchContextLoss(base.stage.app.canvas, target.bus)
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          context.stop()
          consumer.destroy()
        }),
      )

      return {
        stage: base.stage,
        view,
        apply: (result) => base.apply(result),
        draw: (frame) => {
          if (!context.lost()) base.draw(frame)
        },
        reset: () => base.reset(),
      }
    })
}
