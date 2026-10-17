import {
  DEFAULT_QUALITY,
  type FrameInfo,
  type GameRenderer,
  type QualityTier,
  RendererUnavailable,
  type RenderTarget,
} from '@mcthaydt/automata-runtime'
import type { StepResult } from '@mcthaydt/automata-sim'
import { Effect, type Scope } from 'effect'
import { Application, Container, type Filter, TextureSource } from 'pixi.js'
import { type EntityViewResolver, RenderDeltaConsumer } from './delta/render-delta-consumer.js'
import {
  createPostFilterSlot,
  type PostFilterSlot,
  type PostFilterTarget,
} from './filter/post-filter-slot.js'
import { canvasResolutionFor } from './letterbox/canvas-resolution.js'
import { CompositeTarget } from './letterbox/composite-target.js'
import { LetterboxFrame } from './letterbox/letterbox.js'

export type RendererPreference = 'webgl' | 'webgpu'

export interface PixiRendererOptions {
  /**
   * Preferred backend. Default is 'webgl' (WebGL2).
   * Overridden by URL query param `?renderer=webgl` or `?renderer=webgpu` if present in browser.
   */
  readonly preference?: RendererPreference | undefined
  /** Logical playfield width in pixels (e.g. 960 or 320). If omitted, renders unletterboxed. */
  readonly logicalWidth?: number | undefined
  /** Logical playfield height in pixels (e.g. 540 or 192). If omitted, renders unletterboxed. */
  readonly logicalHeight?: number | undefined
  /** Background clear colour (hex number, e.g. 0x000000). Default is 0x000000. */
  readonly backgroundColor?: number | undefined
  /** If true, textures default to nearest-neighbour sampling for crisp pixel art. Default is true. */
  readonly pixelArt?: boolean | undefined
  /** Letterbox cropping fraction for top and bottom bars. Default is 0.05 (5%). */
  readonly barFraction?: number | undefined
  /** Bar color in hex. Default is 0x2e222f (FloorFifty plum black). */
  readonly barColor?: number | undefined
  /** The graphics quality tier to start at (M4 spec §4.11); `PixiStage.setQuality` changes it. Default `high`. */
  readonly quality?: QualityTier | undefined
  /**
   * Draws the world and UI at the logical size and resolution 1, then nearest-upscales them into the letterbox
   * (`CompositeTarget`). Needs a letterbox. Default: on when `pixelArt` is on.
   */
  readonly composite?: boolean | undefined
  /** Optional view factory resolver for entity components. */
  readonly entityViews?: EntityViewResolver | undefined
  /**
   * Optional setup hook called before the first frame to add layers/filters. It may return hooks for a game
   * that draws its own scene: they run after the entity views each step, before Pixi renders each frame, and
   * after the views reset.
   */
  readonly setup?:
    | ((stage: PixiStage) => PixiStageHooks | undefined)
    | ((stage: PixiStage) => void)
    | undefined
}

/** What a `setup` may return to hear every step, frame and reset (DX spec §3.4, DX.3 decision E-1). */
export interface PixiStageHooks {
  /** After the entity views took the step's render delta. */
  readonly apply?: ((result: StepResult) => void) | undefined
  /** Each display frame, after the views interpolated and before Pixi renders. */
  readonly draw?: ((frame: FrameInfo) => void) | undefined
  /** After the views reset (a new sim or a resync). */
  readonly reset?: (() => void) | undefined
}

export interface PixiStage {
  readonly app: Application
  readonly frame?: LetterboxFrame | undefined
  /** The world container where entity views and gameplay objects are mounted. */
  readonly world: Container
  /** The logical screen-space UI layer (masked with the playfield). */
  readonly ui: Container
  /** The unclipped background scenery container. */
  readonly backdrop: Container
  /** The delta consumer tracking entity views. */
  readonly consumer: RenderDeltaConsumer
  /** The fixed-resolution composite the world and UI draw into, when it is on. */
  readonly composite?: CompositeTarget | undefined
  /** Post-processing filters applied to the root rendered scene. Owned by `postFilters` once it is used. */
  filters: Filter[] | null
  /** The post-filter slot over `filters`: each owner keeps its own filters by id and order (PRODUCT spec §2 F1). */
  readonly postFilters: PostFilterSlot
  /** The graphics quality tier now. */
  readonly quality: QualityTier
  /** Changes the tier: re-caps the canvas resolution and leaves out post-filter owners registered for a higher one. */
  setQuality(tier: QualityTier): void
}

export interface PixiRenderer extends GameRenderer {
  readonly stage: PixiStage
}

function resolvePreference(optionPreference?: RendererPreference): RendererPreference {
  if (typeof window !== 'undefined' && window.location?.search) {
    const params = new URLSearchParams(window.location.search)
    const param = params.get('renderer')
    if (param === 'webgpu' || param === 'webgl') {
      return param
    }
  }
  return optionPreference ?? 'webgl'
}

export function createPixiRenderer(
  options: PixiRendererOptions = {},
): (target: RenderTarget) => Effect.Effect<PixiRenderer, RendererUnavailable, Scope.Scope> {
  return (target: RenderTarget) =>
    Effect.gen(function* () {
      const preferred = resolvePreference(options.preference)
      if (options.pixelArt !== false) {
        TextureSource.defaultOptions.scaleMode = 'nearest'
      }

      let quality: QualityTier = options.quality ?? DEFAULT_QUALITY
      const devicePixelRatio = (): number => (typeof window !== 'undefined' ? window.devicePixelRatio : 1)
      const initialGeometry = target.geometry.geometry.current
      const initialResolution = canvasResolutionFor(initialGeometry.formFactor, devicePixelRatio(), quality)

      const tryInit = async (pref: RendererPreference): Promise<Application | null> => {
        const app = new Application()
        try {
          await app.init({
            preference: pref,
            width: initialGeometry.usable.width,
            height: initialGeometry.usable.height,
            resolution: initialResolution,
            backgroundColor: options.backgroundColor ?? 0x000000,
            autoStart: false,
            autoDensity: true,
          })
          return app
        } catch {
          try {
            app.destroy(true, { children: true })
          } catch {
            // ignore teardown errors on failed init
          }
          return null
        }
      }

      let app: Application | null = null
      const tried: ('webgpu' | 'webgl2')[] = []

      if (preferred === 'webgpu') {
        tried.push('webgpu')
        app = yield* Effect.promise(() => tryInit('webgpu'))
        if (!app) {
          tried.push('webgl2')
          app = yield* Effect.promise(() => tryInit('webgl'))
        }
      } else {
        tried.push('webgl2')
        app = yield* Effect.promise(() => tryInit('webgl'))
      }

      if (!app) {
        return yield* Effect.fail(new RendererUnavailable({ tried }))
      }

      const rendererName = app.renderer.name === 'webgpu' ? 'webgpu' : 'webgl'
      app.canvas.dataset.renderer = rendererName
      const canvas = app.canvas
      canvas.classList.add('af-stage')
      target.host.appendChild(canvas)

      let frame: LetterboxFrame | undefined
      let world: Container
      let ui: Container
      let backdrop: Container
      let composite: CompositeTarget | undefined

      if (options.logicalWidth != null && options.logicalHeight != null) {
        frame = new LetterboxFrame({
          logicalWidth: options.logicalWidth,
          logicalHeight: options.logicalHeight,
          barFraction: options.barFraction,
          barColor: options.barColor,
        })
        app.stage.addChild(frame.scene)
        app.stage.addChild(frame.bars)
        world = frame.world
        ui = frame.ui
        backdrop = frame.backdrop
        const { fieldHeight } = frame.layout(initialGeometry.usable.width, initialGeometry.usable.height)
        if ((options.composite ?? true) && options.pixelArt !== false) {
          composite = new CompositeTarget({ width: options.logicalWidth, height: options.logicalHeight })
          composite.adopt(frame)
          composite.resize(fieldHeight)
        }
      } else {
        backdrop = new Container()
        world = new Container()
        ui = new Container()
        app.stage.addChild(backdrop)
        app.stage.addChild(world)
        app.stage.addChild(ui)
      }

      const consumer = new RenderDeltaConsumer(world, options.entityViews)

      // The rendered scene's filters: the composite when it is on, so their cost is bounded by the logical size;
      // else the letterboxed scene when there is a frame; else the whole stage.
      const sceneFilters: PostFilterTarget = {
        get filters(): Filter[] | null {
          if (composite) return composite.stage.filters as Filter[] | null
          return (frame ? frame.scene.filters : app.stage.filters) as Filter[] | null
        },
        set filters(val: Filter[] | null) {
          if (composite) {
            composite.stage.filters = val
          } else if (frame) {
            frame.scene.filters = val
          } else {
            app.stage.filters = val
          }
        },
      }

      const postFilters = createPostFilterSlot(sceneFilters)
      postFilters.setTier(quality)
      let formFactor = initialGeometry.formFactor
      const applyResolution = (): void => {
        app.renderer.resolution = canvasResolutionFor(formFactor, devicePixelRatio(), quality)
      }

      const stage: PixiStage = {
        app,
        frame,
        world,
        ui,
        backdrop,
        consumer,
        composite,
        get filters(): Filter[] | null {
          return sceneFilters.filters
        },
        set filters(val: Filter[] | null) {
          sceneFilters.filters = val
        },
        postFilters,
        get quality(): QualityTier {
          return quality
        },
        setQuality(tier: QualityTier): void {
          quality = tier
          postFilters.setTier(tier)
          applyResolution()
        },
      }

      const hooks: PixiStageHooks = options.setup?.(stage) ?? {}

      const unsubscribe = target.geometry.onChange((g) => {
        app.renderer.resize(g.usable.width, g.usable.height)
        const layout = frame?.layout(g.usable.width, g.usable.height)
        if (layout) composite?.resize(layout.fieldHeight)
        formFactor = g.formFactor
        applyResolution()
      })

      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          unsubscribe()
          consumer.destroy()
          composite?.destroy()
          frame?.destroy()
          try {
            app.destroy(true, { children: true })
          } catch {
            // ignore error
          }
          // The canvas held from creation: once destroyed, the app has no renderer and its `canvas` getter throws.
          canvas.remove()
        }),
      )

      const renderer: PixiRenderer = {
        stage,
        apply(result: StepResult): void {
          consumer.apply(result.render)
          hooks.apply?.(result)
        },
        draw(frameInfo: FrameInfo): void {
          consumer.interpolate(frameInfo.alpha)
          hooks.draw?.(frameInfo)
          if (composite)
            app.renderer.render({ container: composite.stage, target: composite.texture, clear: true })
          app.render()
        },
        reset(): void {
          consumer.reset()
          hooks.reset?.()
        },
      }

      return renderer
    })
}
