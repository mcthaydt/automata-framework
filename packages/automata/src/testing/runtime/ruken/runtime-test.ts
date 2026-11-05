import type { FlowGraph } from '@mcthaydt/automata-content'
import type { FakeHostOptions } from '@ruken/sdk-host/testing'
import { Context, Effect, Layer, Stream } from 'effect'
import type { BootError } from '../../../app/boot/boot-error.js'
import { buildRuntimeServices, contentHashOf } from '../../../app/boot/boot-program.js'
import type { CompiledContentData } from '../../../app/boot/game-definition.js'
import { createPageLayers, type PageLayers } from '../../../app/boot/page-layers.svelte.js'
import { makeAppLoop } from '../../../app/loop/app-loop.manager.js'
import type { FrameSource } from '../../../app/loop/frames.js'
import { makePresentationBus, PresentationBus } from '../../../app/presentation/presentation-bus.manager.js'
import type { GameRenderer, RendererFactory, RenderTarget } from '../../../app/render/renderer.js'
import { makeTime, watchLifecycle } from '../../../app/time/time.manager.js'
import { makeAudio } from '../../../features/audio/audio.manager.js'
import type { AudioContextLike } from '../../../features/audio/audio-graph.js'
import { fakeAudioContext } from '../../../features/audio/testing/fake-audio-context.js'
import { makeFlow } from '../../../features/flow/flow.manager.js'
import type { RuntimeServices, ScreenDef } from '../../../features/flow/screen.js'
import { makeVeil } from '../../../features/flow/veil.js'
import { createHaptics } from '../../../features/input/haptics/haptics.manager.js'
import { makeLeaderboards } from '../../../features/leaderboards/leaderboards.manager.js'
import { makeAssets } from '../../../features/loading/assets.manager.js'
import { makeLoadMeter } from '../../../features/loading/load-meter.js'
import { type LocaleDef, makeLocale, singleLocale } from '../../../features/locale/locale.manager.js'
import type { SaveDef } from '../../../features/saves/save.schema.js'
import { makeSaves } from '../../../features/saves/saves.manager.js'
import type { DeviceStorage } from '../../../features/settings/device-storage.js'
import { makeSettings, type SettingsDef } from '../../../features/settings/settings.manager.js'
import { Hosting } from '../../../shared/host/hosting.ts'
import { createGeometryOwner } from '../../../shared/ui/geometry/geometry-owner.svelte.ts'
import { FakeHostHandle, HostingTest, type HostingTestOptions } from '../../host/page/ruken/hosting-test.ts'
import { fakeFetch } from '../fake-fetch.js'
import { type ManualFrames, manualFrames } from '../manual-frames.js'
import { nullRenderer } from '../null-renderer.js'

/**
 * What `RuntimeTest` boots: the fake host, the screens, content, settings and save, and the frames, renderer,
 * fetch and locale it uses.
 */
export interface RuntimeTestOptions {
  readonly hosting?: HostingTestOptions | Partial<Omit<FakeHostOptions, 'gameOrigin' | 'gameId'>>
  readonly screens?: readonly ScreenDef<any>[]
  readonly content?: CompiledContentData
  readonly settings?: SettingsDef<unknown>
  /** The game's save, opened as boot opens it: its triggers and exit flush run, and `saveOf(def)` finds it. */
  readonly saves?: SaveDef<unknown>
  /** Where settings fields kept on the device go; default a fresh in-memory one, so a test never meets the browser's. */
  readonly deviceStorage?: DeviceStorage
  readonly frames?: ManualFrames | FrameSource
  readonly renderer?: GameRenderer | RendererFactory
  readonly fetch?: typeof fetch
  /** The game's languages (a Paraglide `runtime.js`); absent, the content's source language alone. */
  readonly locale?: LocaleDef
  /** The browser's languages, best first; default none. */
  readonly languages?: readonly string[]
  /** Builds the audio context on the first gesture; defaults to `fakeAudioContext()`. */
  readonly createAudioContext?: () => AudioContextLike
}

/** A device that keeps what it is given for as long as the test runs. */
function memoryDeviceStorage(): DeviceStorage {
  const held = new Map<string, string>()
  return {
    get: (key) => held.get(key) ?? null,
    set: (key, value) => {
      held.set(key, value)
    },
    remove: (key) => {
      held.delete(key)
    },
  }
}

/**
 * Test harness providing `RuntimeServices | FakeHostHandle` for screen and integration tests (spec §3.1, §8.1).
 * Uses `HostingTest` behind the scenes, hooks DOM layers and geometry, starts the flow if screens exist,
 * and yields all runtime services plus `FakeHostHandle`.
 */
export function RuntimeTest(
  options: RuntimeTestOptions = {},
): Layer.Layer<RuntimeServices | FakeHostHandle, BootError> {
  return Layer.scopedContext(
    Effect.gen(function* () {
      let hostingTestOptions: HostingTestOptions | undefined
      if (options.hosting) {
        if (
          'host' in options.hosting ||
          'hosting' in options.hosting ||
          'env' in options.hosting ||
          'gameOrigin' in options.hosting
        ) {
          hostingTestOptions = options.hosting as HostingTestOptions
        } else {
          hostingTestOptions = {
            host: options.hosting as Omit<FakeHostOptions, 'gameOrigin' | 'gameId'>,
          }
        }
      }

      const hostingContext = yield* Layer.build(HostingTest(hostingTestOptions))
      const hosting = Context.get(hostingContext, Hosting)
      const fakeHostHandle = Context.get(hostingContext, FakeHostHandle)

      const doc = typeof document !== 'undefined' ? document : undefined
      const win = typeof window !== 'undefined' ? window : undefined
      const root = doc ? doc.createElement('div') : ({} as HTMLElement)
      const layers = doc
        ? createPageLayers(root, doc)
        : ({
            root,
            stage: root,
            screens: root,
            overlay: root,
            setState: () => {},
            showLoader: () => ({ setProgress: () => {}, setSlow: () => {}, close: () => {} }),
            showBootFailure: () => () => {},
            showError: () => () => {},
            dispose: () => {},
          } as PageLayers)

      yield* Effect.addFinalizer(() => Effect.sync(() => layers.dispose()))

      const geometry = createGeometryOwner({
        window: win ?? ({} as Window),
        root: doc ? doc.documentElement : root,
      })
      yield* Effect.addFinalizer(() => Effect.sync(() => geometry.dispose()))

      const initialDisplay = yield* hosting.display.get
      geometry.setHostDisplay(initialDisplay)
      yield* Effect.forkScoped(
        Stream.runForEach(hosting.display.changes, (metrics) =>
          Effect.sync(() => geometry.setHostDisplay(metrics)),
        ),
      )

      let rawSettings: string | null = null
      if (options.settings !== undefined) {
        rawSettings = yield* hosting.saves.get(options.settings.key)
      }
      const settingsService = yield* makeSettings(
        options.settings,
        rawSettings,
        hosting.saves,
        options.deviceStorage ?? memoryDeviceStorage(),
      )

      const frames = options.frames ?? manualFrames()

      const meter = yield* makeLoadMeter
      const screens = options.screens ?? []
      const screenFonts: Record<string, readonly string[]> = {}
      for (const screen of screens) {
        if (screen.fonts) screenFonts[screen.id] = screen.fonts
      }

      const defaultFlow: FlowGraph = {
        entry: screens[0]?.id ?? 'entry',
        screens: screens.map((s) => s.id),
        terminal: [],
        transitions: [],
      }

      const content: CompiledContentData = options.content ?? {
        flow: defaultFlow,
        game: {
          source_language: 'en',
          rating: 'everyone',
          descriptors: [],
          custom_events: [],
          preload_screens: screens[0] ? [screens[0].id] : [],
        },
      }

      const fontFaces = doc?.fonts
      const assets = yield* makeAssets({
        assets: content.assets,
        fonts: screenFonts,
        fetch: options.fetch ?? fakeFetch({}).fetch,
        ...(fontFaces ? { fontFaces } : {}),
        meter,
      })

      const renderTarget: RenderTarget = {
        host: layers.stage,
        geometry,
        assets,
      }

      let renderer: GameRenderer
      if (options.renderer) {
        if (typeof options.renderer === 'function') {
          renderer = yield* options.renderer(renderTarget)
        } else {
          renderer = options.renderer
        }
      } else {
        renderer = yield* nullRenderer()(renderTarget)
      }

      yield* hosting.ready
      layers.setState('ready')

      const bus = yield* makePresentationBus()
      const time = makeTime(bus)
      const locale = yield* makeLocale({
        def: options.locale ?? singleLocale(content.game?.source_language ?? 'en'),
        hosting,
        browser: options.languages ?? [],
        bus,
        element: doc?.documentElement,
      })
      const veil = yield* makeVeil({
        overlay: layers.overlay,
        reducedMotion: () => false,
      })
      // A page without a DOM (Node) still gets an Audio: it is never unlocked, so it stays silent.
      const audio = yield* makeAudio({
        hosting,
        assets,
        bus,
        window: win ?? new EventTarget(),
        document: doc ?? Object.assign(new EventTarget(), { visibilityState: 'visible' as const }),
        createContext: options.createAudioContext ?? (() => fakeAudioContext()),
        ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
      })

      let runtimeContext: Context.Context<RuntimeServices | FakeHostHandle> =
        Context.empty() as Context.Context<RuntimeServices | FakeHostHandle>

      const flowHandle = yield* makeFlow<FakeHostHandle>({
        graph: content.flow,
        screens,
        layers,
        assets,
        time,
        bus,
        geometry,
        veil,
        services: () => runtimeContext,
      })

      yield* hosting.onMenuRequest(() => flowHandle.flow.openMenu())

      yield* watchLifecycle({
        hosting,
        time,
        pauseBehavior: hostingTestOptions?.hosting?.pauseBehavior ?? 'pause',
        ...(doc ? { document: doc } : {}),
        openMenu: () => flowHandle.flow.openMenu(),
      })

      const appLoop = yield* makeAppLoop({
        frames,
        renderer,
        time,
        bus,
        onFault: (cause) =>
          flowHandle.reportFailure({
            _tag: 'ScreenFailed',
            screen: flowHandle.flow.current ?? '',
            cause,
          }),
      })

      const runtimeServices = buildRuntimeServices({
        audio,
        hosting,
        bus,
        time,
        flow: flowHandle.flow,
        settings: settingsService,
        saves: yield* makeSaves(options.saves, { contentHash: contentHashOf(content) }).pipe(
          Effect.provideService(Hosting, hosting),
          Effect.provideService(PresentationBus, bus),
        ),
        appLoop,
        assets,
        renderer,
        locale,
        leaderboards: yield* makeLeaderboards.pipe(
          Effect.provideService(Hosting, hosting),
          Effect.provideService(PresentationBus, bus),
        ),
        // A device that can neither rumble nor buzz: a test that pulses checks only that nothing throws.
        haptics: createHaptics({ touch: () => false }),
      })

      runtimeContext = Context.merge(runtimeServices, Context.make(FakeHostHandle, fakeHostHandle))

      if (screens.length > 0 && content.flow?.entry) {
        yield* flowHandle.start()
      }

      return runtimeContext
    }),
  )
}
