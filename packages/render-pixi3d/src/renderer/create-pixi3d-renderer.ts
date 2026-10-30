import {
  createPixiRenderer,
  type PixiRenderer,
  type PixiRendererOptions,
  type PixiStage,
  type PixiStageHooks,
  RenderDeltaConsumer,
} from '@mcthaydt/automata-render-pixi'
import { type ModelInvalid, RendererUnavailable, type RenderTarget } from '@mcthaydt/automata-runtime'
import type { RenderDelta, RenderRow } from '@mcthaydt/automata-sim'
import { type Container3D, View3D } from '@pixi/3d'
import { Effect, ExecutionStrategy, Exit, Runtime, Scope } from 'effect'
import { Graphics } from 'pixi.js'
import { loadModels, type ModelLibrary } from '../model/load-models.js'
import { pixi3dUniformSyncInstalled } from '../no-eval/pixi3d-uniform-sync.js'
import type { EntityView3d, EntityViewResolver3d } from '../views/view-3d.js'
import { type ContextWatch, watchContextLoss } from './context-loss.js'

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
  // The sky. The view draws no colour where no mesh is, so the letterbox's black field shows through there (the app's
  // clear colour is under that field). A 2D fill of the view's rect, under it, draws `backgroundColor` exactly on
  // both backends; `@pixi/3d`'s hemisphere background lifts dark colours (0x020c0c draws as 0x091414). Inside the
  // view only, so the bars keep `barColor`. Without a letterbox the app's clear colour is the sky already.
  if (letterboxed && options.backgroundColor !== undefined)
    stage.world.addChild(new Graphics().rect(0, 0, view.width, view.height).fill(options.backgroundColor))
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

/** The rows the sim says are drawn now, kept from each delta so a rebuilt renderer can resync its views. */
class DrawnRows {
  private readonly rows = new Map<number, RenderRow>()
  take(delta: RenderDelta): void {
    if (delta.resync) this.rows.clear()
    for (const sid of delta.removed) this.rows.delete(sid)
    for (const row of [...delta.added, ...delta.changed]) this.rows.set(row.sid, row)
  }
  all(): RenderRow[] {
    return [...this.rows.values()]
  }
  clear(): void {
    this.rows.clear()
  }
}

/** One Pixi app with its View3D and views, in a scope of its own so Try again can replace it. */
interface Instance {
  readonly scope: Scope.CloseableScope
  readonly base: PixiRenderer
  readonly view: View3D
  readonly context: ContextWatch
}

function buildInstance(
  outer: Scope.Scope,
  target: RenderTarget,
  options: Pixi3dOptions,
  models: ModelLibrary,
  runtime: Runtime.Runtime<never>,
  onGone: () => void,
): Effect.Effect<Instance, RendererUnavailable> {
  return Effect.gen(function* () {
    const scope = yield* Scope.fork(outer, ExecutionStrategy.sequential)
    const built = yield* Effect.gen(function* () {
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
      const device = (base.stage.app.renderer as unknown as { gpu?: { device?: GPUDevice } }).gpu?.device
      const context = watchContextLoss({
        canvas: base.stage.app.canvas,
        device,
        bus: target.bus,
        runtime,
        onGone,
      })
      // Runs before the app's own teardown (last added, first run): stop watching, then drop the views.
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          context.stop()
          consumer.destroy()
        }),
      )
      return { base, view, context }
    }).pipe(
      Scope.extend(scope),
      Effect.onError(() => Scope.close(scope, Exit.void)),
    )
    return { scope, ...built }
  })
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
 *
 * A lost context the browser gives back draws again; one it does not (or a lost WebGPU device) asks the runtime for
 * the "picture stopped" panel, whose Try again replaces the app, the View3D and the views, resynced from the sim's
 * current rows (M3 spec §5). The models and the game's state are kept.
 */
export function createPixi3dRenderer(
  options: Pixi3dOptions,
): (target: RenderTarget) => Effect.Effect<Pixi3dRenderer, RendererUnavailable | ModelInvalid, Scope.Scope> {
  return (target) =>
    Effect.gen(function* () {
      // Without the shim, pixi.js/unsafe-eval cannot upload @pixi/3d's uniforms and the first draw throws (S7-Q1).
      if (!pixi3dUniformSyncInstalled())
        return yield* Effect.die(
          new Error(
            "render-pixi3d: import '@mcthaydt/automata-render-pixi3d/no-eval' first, before anything else (in place of render-pixi/no-eval)",
          ),
        )
      const files = Object.values(options.views).flatMap((factory) => factory.models ?? [])
      const models = yield* loadModels(files, target.assets)
      // Freed when the scope closes, after the app and the views that draw them (finalizers run last-added first).
      yield* Effect.addFinalizer(() => Effect.sync(() => models.dispose()))

      const runtime = yield* Effect.runtime<never>()
      const outer = yield* Effect.scope
      const drawn = new DrawnRows()
      let current: Instance | undefined
      let rebuilding = false

      // A context that will not come back (M3 spec §5): the runtime shows the panel, and Try again builds the Pixi
      // app, the View3D and the views again in a fresh scope, from the sim's current rows (a resync).
      const onGone = (): void => void target.reportLost?.(retry)
      const retry = (): void => {
        if (rebuilding) return
        rebuilding = true
        Runtime.runFork(runtime)(
          Effect.gen(function* () {
            if (current !== undefined) yield* Scope.close(current.scope, Exit.void)
            current = yield* buildInstance(outer, target, options, models, runtime, onGone)
            current.base.apply({
              tick: 0,
              events: [],
              rejected: [],
              render: { resync: true, added: drawn.all(), changed: [], removed: [] },
            })
          }).pipe(
            Effect.catchAll(() => Effect.sync(onGone)),
            Effect.ensuring(
              Effect.sync(() => {
                rebuilding = false
              }),
            ),
          ),
        )
      }

      current = yield* buildInstance(outer, target, options, models, runtime, onGone)
      const live = (): Instance => current as Instance
      return {
        get stage() {
          return live().base.stage
        },
        get view() {
          return live().view
        },
        apply: (result) => {
          drawn.take(result.render)
          if (!rebuilding) live().base.apply(result)
        },
        draw: (frame) => {
          if (!rebuilding && !live().context.lost()) live().base.draw(frame)
        },
        reset: () => {
          drawn.clear()
          live().base.reset()
        },
      }
    })
}
