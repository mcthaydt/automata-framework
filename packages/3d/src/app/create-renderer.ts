import {
  createPixiRenderer,
  type ModelInvalid,
  type PixiRenderer,
  type PixiRendererOptions,
  type PixiStage,
  type PixiStageHooks,
  RenderDeltaConsumer,
  RendererUnavailable,
  type RenderTarget,
} from '@automata/framework'
import type { RenderDelta, RenderRow } from '@automata/sim'
import { type Container3D, View3D } from '@pixi/3d'
import { Cause, Effect, ExecutionStrategy, Exit, Option, Runtime, Scope } from 'effect'
import { Graphics } from 'pixi.js'
import { angledCamera, type CameraRig } from '../features/camera/angled-camera.ts'
import { cameraDriver, type Pixi3dCameraOptions, PLAYER_HEIGHT } from '../features/camera/camera-driver.ts'
import {
  createOccluders,
  type OccluderStage,
  type Occluders,
  occluderHooks,
} from '../features/camera/occluders/occluders.ts'
import { type ContextWatch, watchContextLoss } from '../features/renderer/context-loss.ts'
import { pixi3dUniformSyncInstalled } from '../features/renderer/no-eval/pixi3d-uniform-sync.ts'
import { lampSwitches } from '../shared/render/light/lamp-switches.ts'
import { createSceneLight, type SceneLight } from '../shared/render/light/scene-light.ts'
import type { SceneFog, SceneLighting } from '../shared/render/light/scene-lighting.schema.ts'
import { fogSkyColor, viewFog } from '../shared/render/light/view-fog.ts'
import { loadModels, type ModelLibrary } from '../shared/render/model/load-models.ts'
import type { EntityView3d, EntityViewResolver3d } from '../shared/render/views/view-3d.ts'

export interface Pixi3dOptions extends PixiRendererOptions {
  /** Component id → its 3D view (`mesh`, `box`). `entityViews` stays the 2D layer's, drawn over the 3D view. */
  readonly views: EntityViewResolver3d
  /**
   * After the `View3D` is mounted, before the first frame: the camera, the lights and the static scenery. Walls,
   * ceilings and tall props are registered with `occluders`, so the angled camera's occluder rule keeps them off the
   * player (M3 spec §4.2). With `lighting`, `light` is the room's light: bake each static mesh with
   * `light.bake(mesh)`. `models` holds the views' model files and the scene's own (`models`), loaded. It may return
   * hooks, which run after the views (and the camera) each step and frame.
   */
  readonly scene?:
    | ((
        view: View3D,
        stage: PixiStage,
        occluders: Occluders,
        light: SceneLight | undefined,
        models: ModelLibrary,
      ) => PixiStageHooks | undefined)
    | undefined
  /**
   * Model files the `scene` hook draws itself (static props with no sim entity), loaded with the views' before the
   * first frame and failing boot the same way (`ModelInvalid`). The game preloads them as it does the views'.
   */
  readonly models?: readonly string[] | undefined
  /**
   * The view's linear fog (M3 spec §4.1). Without it, the lighting content's `fog`; without both, none. With fog, the
   * sky behind the scene is the colour fog reaches (in place of `backgroundColor`), so fogged walls meet it with no edge.
   */
  readonly fog?: SceneFog | undefined
  /**
   * The room's light from content (M3 spec §4.3): static meshes baked in `scene`, `lit` views tinted each frame.
   */
  readonly lighting?: SceneLighting | undefined
  /**
   * The component whose entities switch lamps, with fields `lamp` (a lamp id) and `level` (0 off, 1 full): a change
   * rebakes the meshes that lamp reaches and relights the characters in its range. Needs `lighting`.
   */
  readonly lamps?: string | undefined
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
  readonly occluders: OccluderStage
  readonly consumer: RenderDeltaConsumer<Container3D>
  readonly hooks: PixiStageHooks
  readonly light: SceneLight | undefined
  readonly camera: CameraRig | undefined
}

/**
 * The sky behind the scene: `backgroundColor`, or with fog the colour fog reaches, so fogged walls meet it with no edge
 * (spec §4.2, S7-Q10).
 */
function skyOf(options: Pixi3dOptions): number | undefined {
  const fog = options.fog ?? options.lighting?.fog
  return fog === undefined ? options.backgroundColor : fogSkyColor(fog)
}

function mount(stage: PixiStage, options: Pixi3dOptions, models: ModelLibrary): Mounted {
  const letterboxed = options.logicalWidth != null && options.logicalHeight != null
  // Sized from the letterbox's logical field when there is one; otherwise it follows the screen.
  const view = letterboxed
    ? new View3D({ width: options.logicalWidth, height: options.logicalHeight, toneMapping: 'none' })
    : new View3D({ autoResize: true, toneMapping: 'none' })
  view.fog = viewFog(options.fog, options.lighting?.fog)
  // The sky. The view draws no colour where no mesh is, so the letterbox's black field shows through there (the app's
  // clear colour is under that field). A 2D fill of the view's rect, under it, draws the sky exactly on both backends;
  // `@pixi/3d`'s hemisphere background lifts dark colours (0x020c0c draws as 0x091414). Inside the view only, so the
  // bars keep `barColor`. Without a letterbox the app's clear colour is the sky already (`skyOf`).
  const sky = skyOf(options)
  if (letterboxed && sky !== undefined)
    stage.world.addChild(new Graphics().rect(0, 0, view.width, view.height).fill(sky))
  stage.world.addChild(view)
  const light = options.lighting === undefined ? undefined : createSceneLight(options.lighting)
  const switches =
    light === undefined || options.lamps === undefined ? undefined : lampSwitches(options.lamps)
  const resolver: Record<string, (row: RenderRow, componentId?: string) => EntityView3d | undefined> = {}
  for (const [id, factory] of Object.entries(options.views))
    resolver[id] = (row, componentId) => factory(row, componentId, models, light)
  const consumer = new RenderDeltaConsumer<Container3D>(view.root, resolver)
  const entities: PixiStageHooks = {
    apply: (result) => {
      const levels = switches?.apply(result.render)
      if (levels !== undefined) light?.setLevels(levels)
      consumer.apply(result.render)
    },
    draw: (frame) => consumer.interpolate(frame.alpha),
    reset: () => consumer.reset(),
  }
  const occluders = createOccluders(view.root)
  if (options.camera === undefined)
    return { view, occluders, consumer, hooks: entities, light, camera: undefined }
  const camera = angledCamera({
    camera: view.camera,
    views: options.camera.views,
    initial: options.camera.initial,
    // Before the first layout an auto-sized view is 0 by 0, and 0/0 would make lock-on's middle-third test NaN:
    // the rig's 16:9 stands in until the view has a size.
    aspect: () => (view.width > 0 && view.height > 0 ? view.width / view.height : 16 / 9),
  })
  // The rule runs after the camera has moved, on the pose it just wrote.
  const occluding = occluderHooks(camera, occluders, { height: options.camera.height ?? PLAYER_HEIGHT })
  return {
    view,
    occluders,
    consumer,
    hooks: mergeHooks(entities, cameraDriver(camera, options.camera), occluding),
    light,
    camera,
  }
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
  /** This instance's camera rig; a rebuild after a lost context makes a new one, and the resync cuts it to the player. */
  readonly camera: CameraRig | undefined
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
      const made = yield* Effect.promise(() =>
        createPixiRenderer({
          ...options,
          backgroundColor: skyOf(options),
          setup: (stage) => {
            if (!acceptsRenderer(stage.app.renderer as unknown as RendererKind)) return undefined
            const made = mount(stage, options, models)
            mounted = made
            const own = options.setup?.(stage) ?? undefined
            return mergeHooks(
              made.hooks,
              own,
              options.scene?.(made.view, stage, made.occluders, made.light, models),
            )
          },
        })(target),
      )
      if (!made.ok) return yield* Effect.fail(made.reason)
      const base = made.value
      // Added first, so it runs last: the app is destroyed after the views that draw in it.
      yield* Effect.addFinalizer(() => Effect.sync(() => base.dispose()))
      if (mounted === undefined) {
        const tried: ('webgl2' | 'webgpu')[] =
          options.preference === 'webgpu' ? ['webgpu', 'webgl2'] : ['webgl2']
        return yield* Effect.fail(new RendererUnavailable({ tried }))
      }
      const { view, consumer, camera, occluders } = mounted
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
          occluders.dispose()
        }),
      )
      return { base, view, context, camera }
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
  seams: Pixi3dSeams = {},
): (target: RenderTarget) => Promise<Pixi3dResult> {
  const build = scopedPixi3dRenderer(options)
  const runPromiseExit = seams.runPromiseExit ?? Effect.runPromiseExit
  // The runtime's factory is plain; this package still builds in an Effect scope inside (its own refactor converts
  // it), so the scope is opened here and `dispose` closes it.
  return async (target) => {
    const scope = Effect.runSync(Scope.make())
    const exit = await runPromiseExit(Scope.extend(build(target), scope))
    if (Exit.isFailure(exit)) {
      await Effect.runPromise(Scope.close(scope, exit))
      const failure = Cause.failureOption(exit.cause)
      if (Option.isSome(failure)) return { ok: false, reason: failure.value }
      throw Cause.squash(exit.cause)
    }
    const renderer = exit.value
    let disposed = false
    // Defined, not spread: the renderer's `stage`, `view` and `camera` are getters that follow a rebuilt app.
    Object.defineProperty(renderer, 'dispose', {
      value: () => {
        if (disposed) return
        disposed = true
        Effect.runSync(Scope.close(scope, Exit.void))
      },
    })
    return { ok: true, value: renderer }
  }
}

/** Test seams: the Effect runtime the renderer is built on, so a `TestClock` times the lost-context wait. */
export interface Pixi3dSeams {
  readonly runPromiseExit?: <A, E>(effect: Effect.Effect<A, E>) => Promise<Exit.Exit<A, E>>
}

/** What `createPixi3dRenderer`'s factory answers: the renderer, or why it could not start. */
export type Pixi3dResult =
  | { readonly ok: true; readonly value: Pixi3dRenderer }
  | { readonly ok: false; readonly reason: RendererUnavailable | ModelInvalid }

/** The renderer built in an Effect scope; closing the scope destroys it. */
function scopedPixi3dRenderer(
  options: Pixi3dOptions,
): (target: RenderTarget) => Effect.Effect<Pixi3dRenderer, RendererUnavailable | ModelInvalid, Scope.Scope> {
  return (target) =>
    Effect.gen(function* () {
      // Without the shim, pixi.js/unsafe-eval cannot upload @pixi/3d's uniforms and the first draw throws (S7-Q1).
      if (!pixi3dUniformSyncInstalled())
        return yield* Effect.die(
          new Error(
            "@automata/3d: import '@automata/3d/no-eval' first, before anything else (in place of render-pixi/no-eval)",
          ),
        )
      const files = [
        ...Object.values(options.views).flatMap((factory) => factory.models ?? []),
        ...(options.models ?? []),
      ]
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
        get camera() {
          return live().camera
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
        // Replaced by `createPixi3dRenderer`, which owns the scope this renderer lives in.
        dispose: () => undefined,
      }
    })
}
