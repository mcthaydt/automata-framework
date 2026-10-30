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
import { angledCamera, type CameraRig } from '../camera/angled-camera.js'
import { cameraDriver, type Pixi3dCameraOptions } from '../camera/camera-driver.js'
import { loadModels, type ModelLibrary } from '../model/load-models.js'
import type { EntityView3d, EntityViewResolver3d } from '../views/view-3d.js'
import { watchContextLoss } from './context-loss.js'

export interface Pixi3dOptions extends PixiRendererOptions {
  /** Component id → its 3D view (`mesh`, `box`). `entityViews` stays the 2D layer's, drawn over the 3D view. */
  readonly views: EntityViewResolver3d
  /**
   * After the `View3D` is mounted, before the first frame: the camera, the lights and the static scenery. It may
   * return hooks, which run after the views (and the camera) each step and frame.
   */
  readonly scene?: ((view: View3D, stage: PixiStage) => PixiStageHooks | undefined) | undefined
  /**
   * The angled camera on the player (M3 spec §4.2): the rig follows the entity with `camera-heading` (the `./sim`
   * entry), reading its `view` and `heading` and the position in `follow`. Without it the `View3D`'s camera is the
   * game's to place in `scene`.
   */
  readonly camera?: Pixi3dCameraOptions | undefined
}

export interface Pixi3dRenderer extends PixiRenderer {
  /** The `@pixi/3d` view the scene draws in, mounted in `stage.world`. */
  readonly view: View3D
  /** The angled camera when `options.camera` was given: the game calls `frame(lock)` on it. */
  readonly camera: CameraRig | undefined
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
  readonly camera: CameraRig | undefined
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
  const entities: PixiStageHooks = {
    apply: (result) => consumer.apply(result.render),
    draw: (frame) => consumer.interpolate(frame.alpha),
    reset: () => consumer.reset(),
  }
  if (options.camera === undefined) return { view, consumer, hooks: entities, camera: undefined }
  const camera = angledCamera({
    camera: view.camera,
    views: options.camera.views,
    initial: options.camera.initial,
    // Before the first layout an auto-sized view is 0 by 0, and 0/0 would make lock-on's middle-third test NaN:
    // the rig's 16:9 stands in until the view has a size.
    aspect: () => (view.width > 0 && view.height > 0 ? view.width / view.height : 16 / 9),
  })
  return { view, consumer, hooks: mergeHooks(entities, cameraDriver(camera, options.camera)), camera }
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

      const { view, consumer, camera } = mounted
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
        camera,
        apply: (result) => base.apply(result),
        draw: (frame) => {
          if (!context.lost()) base.draw(frame)
        },
        reset: () => base.reset(),
      }
    })
}
