import {
  type FrameInfo,
  type GameRenderer,
  RendererUnavailable,
  type RenderTarget,
} from '@mcthaydt/automata-runtime'
import type { StepResult } from '@mcthaydt/automata-sim'
import { Effect, type Scope } from 'effect'
import { Application, Container, type Filter, TextureSource } from 'pixi.js'
import { type EntityViewResolver, RenderDeltaConsumer } from './delta/render-delta-consumer.js'
import { canvasResolutionFor } from './letterbox/canvas-resolution.js'
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
  /** Optional view factory resolver for entity components. */
  readonly entityViews?: EntityViewResolver | undefined
  /** Optional setup hook called before the first frame to add layers/filters. */
  readonly setup?: ((stage: PixiStage) => void) | undefined
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
  /** Post-processing filters applied to the root rendered scene. */
  filters: Filter[] | null
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

      const initialGeometry = target.geometry.geometry.current
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1
      const initialResolution = canvasResolutionFor(initialGeometry.formFactor, dpr)

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
      app.canvas.classList.add('af-stage')
      target.host.appendChild(app.canvas)

      let frame: LetterboxFrame | undefined
      let world: Container
      let ui: Container
      let backdrop: Container

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
        frame.layout(initialGeometry.usable.width, initialGeometry.usable.height)
      } else {
        backdrop = new Container()
        world = new Container()
        ui = new Container()
        app.stage.addChild(backdrop)
        app.stage.addChild(world)
        app.stage.addChild(ui)
      }

      const consumer = new RenderDeltaConsumer(world, options.entityViews)

      const stage: PixiStage = {
        app,
        frame,
        world,
        ui,
        backdrop,
        consumer,
        get filters(): Filter[] | null {
          return (frame ? frame.scene.filters : app.stage.filters) as Filter[] | null
        },
        set filters(val: Filter[] | null) {
          if (frame) {
            frame.scene.filters = val
          } else {
            app.stage.filters = val
          }
        },
      }

      options.setup?.(stage)

      const unsubscribe = target.geometry.onChange((g) => {
        app.renderer.resize(g.usable.width, g.usable.height)
        frame?.layout(g.usable.width, g.usable.height)
        const newDpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1
        app.renderer.resolution = canvasResolutionFor(g.formFactor, newDpr)
      })

      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          unsubscribe()
          consumer.destroy()
          frame?.destroy()
          try {
            app.destroy(true, { children: true })
          } catch {
            // ignore error
          }
          if (app.canvas.parentNode) {
            app.canvas.parentNode.removeChild(app.canvas)
          }
        }),
      )

      const renderer: PixiRenderer = {
        stage,
        apply(result: StepResult): void {
          consumer.apply(result.render)
        },
        draw(frameInfo: FrameInfo): void {
          consumer.interpolate(frameInfo.alpha)
          app.render()
        },
        reset(): void {
          consumer.reset()
        },
      }

      return renderer
    })
}
