import {
  type Clock,
  createPixiRenderer,
  type Disposables,
  disposables,
  ModelInvalid,
  type PixiRenderer,
  type PixiRendererOptions,
  type PixiStage,
  type PixiStageHooks,
  RenderDeltaConsumer,
  RendererUnavailable,
  type RenderTarget,
  systemClock,
} from '@automata/framework'
import type { RenderDelta, RenderRow } from '@automata/sim'
import { type Container3D, View3D } from '@pixi/3d'
import { Graphics } from 'pixi.js'
import { angledCamera, type CameraRig } from '../features/camera/angled-camera.ts'
import { cameraDriver, type Pixi3dCameraOptions, PLAYER_HEIGHT } from '../features/camera/camera-driver.ts'
import {
  createOccluders,
  type OccluderStage,
  type Occluders,
  occluderHooks,
} from '../features/camera/occluders/occluders.ts'
import type { Look } from '../features/look/look.schema.ts'
import { createLookPasses, type LookPasses } from '../features/look/look-pass.ts'
import { compositeDepthHooks } from '../features/renderer/composite-depth.ts'
import { type ContextWatch, watchContextLoss } from '../features/renderer/context-loss.ts'
import { pixi3dUniformSyncInstalled } from '../features/renderer/no-eval/pixi3d-uniform-sync.ts'
import { lampSwitches } from '../shared/render/light/lamp-switches.ts'
import { createSceneLight, type SceneLight } from '../shared/render/light/scene-light.ts'
import type { SceneFog, SceneLighting } from '../shared/render/light/scene-lighting.schema.ts'
import { fogSkyColor, viewFog } from '../shared/render/light/view-fog.ts'
import { loadModels, type ModelLibrary, type ModelStore } from '../shared/render/model/load-models.ts'
import type { EntityView3d, EntityViewResolver3d } from '../shared/render/views/view-3d.ts'
import { type TimeOfDay, timeOfDay } from '../shared/time-of-day/time-of-day.ts'

export interface Pixi3dOptions extends PixiRendererOptions {
  /** Component id → its 3D view (`mesh`, `box`). `entityViews` stays the 2D layer's, drawn over the 3D view. */
  readonly views: EntityViewResolver3d
  /**
   * After the `View3D` is mounted, before the first frame: the camera, the lights and the static scenery. Walls,
   * ceilings and tall props are registered with `occluders`, so the angled camera's occluder rule keeps them off the
   * player. With `lighting`, `light` is the room's light: bake each static mesh with
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
   * The view's linear fog. Without it, the lighting content's `fog`; without both, none. With fog, the
   * sky behind the scene is the colour fog reaches (in place of `backgroundColor`), so fogged walls meet it with no edge.
   */
  readonly fog?: SceneFog | undefined
  /**
   * The room's light from content: static meshes baked in `scene`, `lit` views tinted each frame.
   */
  readonly lighting?: SceneLighting | undefined
  /**
   * The component whose entities switch lamps, with fields `lamp` (a lamp id) and `level` (0 off, 1 full): a change
   * rebakes the meshes that lamp reaches and relights the characters in its range. Needs `lighting`.
   */
  readonly lamps?: string | undefined
  /**
   * The angled camera on the player: the rig follows the entity with `camera-heading` (the `./sim`
   * entry), reading its `view` and `heading` and the position in `follow`. Without it the `View3D`'s camera is the
   * game's to place in `scene`.
   */
  readonly camera?: Pixi3dCameraOptions | undefined
  /**
   * The pixel-art look (ADR 0007): the DUEL snap, the outline when its switch is on, and the passes extensions added
   * with `addLookPass`, over the view. The low-resolution field is the game's own `size` (`targetSize`), which the
   * letterbox draws at resolution 1 and upscales whole pixels. Without it the frame is drawn as it is.
   */
  readonly look?: Look | undefined
  /** The time of day the look's passes read (default `day`). Only with `look`. */
  readonly time?: TimeOfDay | undefined
  /** Times the lost-context wait. The real clock unless a test hands over a fake one. */
  readonly clock?: Clock | undefined
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
  /** The look's passes, retired with the view (a pass may be shared, so the view never destroys them itself). */
  readonly passes: LookPasses | undefined
}

/**
 * The sky behind the scene: `backgroundColor`, or with fog the colour fog reaches, so fogged walls meet it with no edge.
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
  const passes =
    options.look === undefined ? undefined : createLookPasses(options.look, options.time ?? timeOfDay('day'))
  if (passes !== undefined) view.passes = [...passes.list]
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
  const entities: PixiStageHooks = mergeHooks(
    {
      apply: (result) => {
        const levels = switches?.apply(result.render)
        if (levels !== undefined) light?.setLevels(levels)
        consumer.apply(result.render)
      },
      draw: (frame) => consumer.interpolate(frame.alpha),
      reset: () => consumer.reset(),
    },
    compositeDepthHooks(stage),
  )
  const occluders = createOccluders(view.root)
  if (options.camera === undefined)
    return { view, occluders, consumer, hooks: entities, light, camera: undefined, passes }
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
    passes,
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

/** One Pixi app with its View3D and views, torn down together so Try again can replace it. */
interface Instance {
  /** Undoes everything this instance built, views first and the app last. */
  readonly cleanup: Disposables
  readonly base: PixiRenderer
  readonly view: View3D
  readonly context: ContextWatch
  /** This instance's camera rig; a rebuild after a lost context makes a new one, and the resync cuts it to the player. */
  readonly camera: CameraRig | undefined
}

/** Why the first build failed: the renderer is not WebGL2 or WebGPU, or the platform refused to make one. */
type BuildResult =
  | { readonly ok: true; readonly value: Instance }
  | { readonly ok: false; readonly reason: RendererUnavailable }

async function buildInstance(
  target: RenderTarget,
  options: Pixi3dOptions,
  models: ModelLibrary,
  clock: Clock,
  onGone: () => void,
): Promise<BuildResult> {
  let mounted: Mounted | undefined
  const made = await createPixiRenderer({
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
  })(target)
  if (!made.ok) return made
  const base = made.value
  const cleanup = disposables()
  // Added first, so it runs last: the app is destroyed after the views that draw in it.
  cleanup.add(() => base.dispose())
  if (mounted === undefined) {
    cleanup.dispose()
    const tried: ('webgl2' | 'webgpu')[] = options.preference === 'webgpu' ? ['webgpu', 'webgl2'] : ['webgl2']
    return { ok: false, reason: new RendererUnavailable({ tried }) }
  }
  const { view, consumer, camera, occluders, passes } = mounted
  const device = (base.stage.app.renderer as unknown as { gpu?: { device?: GPUDevice } }).gpu?.device
  const context = watchContextLoss({ canvas: base.stage.app.canvas, device, bus: target.bus, clock, onGone })
  // Runs before the app's own teardown (added last, run first): stop watching, then drop the views.
  cleanup.add(() => {
    context.stop()
    consumer.destroy()
    occluders.dispose()
    for (const pass of passes?.list ?? []) pass.destroy()
  })
  return { ok: true, value: { cleanup, base, view, context, camera } }
}

/** What `createPixi3dRenderer`'s factory answers: the renderer, or why it could not start. */
export type Pixi3dResult =
  | { readonly ok: true; readonly value: Pixi3dRenderer }
  | { readonly ok: false; readonly reason: RendererUnavailable | ModelInvalid }

/**
 * The 3D renderer: core's Pixi renderer with one `View3D` mounted in `stage.world` through its
 * `setup`, and a second `RenderDeltaConsumer` over the view's `Container3D` root for the 3D entity views. 2D
 * layers (`stage.ui`, `stage.backdrop`, `entityViews`) keep working over it.
 *
 * Init order (2026-10-16): every model file the views name is read from the runtime's loaded assets
 * first, so a bad one fails with `ModelInvalid` before anything is drawn; then the Pixi app (WebGL2 by default,
 * WebGPU when asked); then the `View3D`, the game's own `setup` and `scene`. A renderer that is not WebGL2 or
 * WebGPU (Pixi's Canvas fallback) fails with `RendererUnavailable`.
 *
 * A lost context the browser gives back draws again; one it does not (or a lost WebGPU device) asks the runtime for
 * the "picture stopped" panel, whose Try again replaces the app, the View3D and the views, resynced from the sim's
 * current rows. The models and the game's state are kept.
 */
export function createPixi3dRenderer(
  options: Pixi3dOptions,
): (target: RenderTarget) => Promise<Pixi3dResult> {
  const clock = options.clock ?? systemClock
  return async (target) => {
    // Without the shim, pixi.js/unsafe-eval cannot upload @pixi/3d's uniforms and the first draw throws (S7-Q1).
    if (!pixi3dUniformSyncInstalled())
      throw new Error(
        "@automata/3d: import '@automata/3d/no-eval' first, before anything else (in place of render-pixi/no-eval)",
      )
    const files = [
      ...Object.values(options.views).flatMap((factory) => factory.models ?? []),
      ...(options.models ?? []),
    ]
    let models: ModelStore
    try {
      models = await loadModels(files, target.assets)
    } catch (error) {
      if (error instanceof ModelInvalid) return { ok: false, reason: error }
      throw error
    }
    // Freed last: the models outlive the app and the views that draw them.
    const lifetime = disposables()
    lifetime.add(() => models.dispose())
    const drawn = new DrawnRows()
    let current: Instance | undefined
    let rebuilding = false

    const first = await buildInstance(target, options, models, clock, onGone)
    if (!first.ok) {
      lifetime.dispose()
      return first
    }
    current = first.value
    lifetime.add(() => current?.cleanup.dispose())

    // A context that will not come back: the runtime shows the panel, and Try again builds the Pixi
    // app, the View3D and the views again, from the sim's current rows (a resync).
    function onGone(): void {
      void target.reportLost?.(retry)
    }
    function retry(): void {
      if (rebuilding) return
      rebuilding = true
      void rebuild()
        .catch(onGone)
        .finally(() => {
          rebuilding = false
        })
    }
    async function rebuild(): Promise<void> {
      current?.cleanup.dispose()
      const next = await buildInstance(target, options, models, clock, onGone)
      if (!next.ok) throw next.reason
      // The game quit while the new app was being made: nothing is left to draw it.
      if (lifetime.disposed) return next.value.cleanup.dispose()
      current = next.value
      current.base.apply({
        tick: 0,
        events: [],
        rejected: [],
        render: { resync: true, added: drawn.all(), changed: [], removed: [] },
      })
    }

    const live = (): Instance => current as Instance
    // A getter object, not a spread: the renderer's `stage`, `view` and `camera` follow a rebuilt app.
    const renderer: Pixi3dRenderer = {
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
      dispose: () => lifetime.dispose(),
    }
    return { ok: true, value: renderer }
  }
}
