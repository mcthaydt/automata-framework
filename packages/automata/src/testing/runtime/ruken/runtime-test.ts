import type { FlowGraph } from '@automata/content'
import type { FakeHostOptions } from '@ruken/sdk-host/testing'
import { contentHashOf } from '../../../app/boot/boot-program.js'
import type { CompiledContentData } from '../../../app/boot/game-definition.js'
import { type Teardown, teardown } from '../../../app/boot/teardown.ts'
import { createFlow } from '../../../app/flow/flow.manager.js'
import type { RuntimeServices, ScreenDef } from '../../../app/flow/screen.js'
import { createVeil } from '../../../app/flow/veil.js'
import { createAudio } from '../../../features/audio/audio.manager.js'
import type { AudioContextLike } from '../../../features/audio/audio-graph.js'
import { fakeAudioContext } from '../../../features/audio/testing/fake-audio-context.js'
import { createHaptics } from '../../../features/input/haptics/haptics.manager.js'
import { createLeaderboards } from '../../../features/leaderboards/leaderboards.manager.js'
import { createLocale, type LocaleDef, singleLocale } from '../../../features/locale/locale.manager.js'
import type { SaveDef } from '../../../features/saves/save.schema.js'
import { createSaves } from '../../../features/saves/saves.manager.js'
import { type Clock, systemClock } from '../../../shared/lib/clock.ts'
import { disposables } from '../../../shared/lib/disposables.ts'
import { createAssets } from '../../../shared/runtime/assets.manager.js'
import { HostError } from '../../../shared/runtime/boot-error.js'
import { createLoadMeter } from '../../../shared/runtime/load-meter.js'
import { createAppLoop } from '../../../shared/runtime/loop/app-loop.manager.js'
import type { FrameSource } from '../../../shared/runtime/loop/frames.js'
import { createPageLayers, type PageLayers } from '../../../shared/runtime/page-layers.svelte.js'
import { createPresentationBus } from '../../../shared/runtime/presentation/presentation-bus.manager.js'
import type { GameRenderer, RendererFactory, RenderTarget } from '../../../shared/runtime/render/renderer.js'
import type { DeviceStorage } from '../../../shared/runtime/settings/device-storage.js'
import { createSettings, type SettingsDef } from '../../../shared/runtime/settings/settings.manager.js'
import { createTime, watchLifecycle } from '../../../shared/runtime/time/time.manager.js'
import { createGeometryOwner } from '../../../shared/ui/geometry/geometry-owner.svelte.ts'
import {
  type FakeHostHandle,
  type HostingTestOptions,
  openHostingTest,
} from '../../host/page/ruken/hosting-test.ts'
import { fakeFetch } from '../fake-fetch.js'
import { type ManualFrames, manualFrames } from '../manual-frames.js'
import { nullRenderer } from '../null-renderer.js'

/**
 * What `openRuntimeTest` boots: the fake host, the screens, content, settings and save, and the frames, renderer,
 * fetch and locale it uses.
 */
export interface RuntimeTestOptions {
  readonly hosting?: HostingTestOptions | Partial<Omit<FakeHostOptions, 'gameOrigin' | 'gameId'>>
  readonly screens?: readonly ScreenDef[]
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
  /** The clock the runtime's timers run on (the stall rule, fades, toasts, the exit cap); default the real one. */
  readonly clock?: Clock
  /** The wall clock saves are stamped with; default `Date.now`. */
  readonly now?: () => number
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

/** A booted runtime over the fake Ruken host: every service a screen reads, the host's handle and the page layers. */
export interface RuntimeTestSession {
  readonly services: RuntimeServices
  readonly handle: FakeHostHandle
  readonly layers: PageLayers
  /** Closes everything the session opened, last opened first: the screen, the save, the renderer, then the host. */
  dispose(): Promise<void>
}

/** Splits `RuntimeTestOptions.hosting` into `openHostingTest`'s options (a bare object is the fake host's own). */
function hostingTestOptionsOf(hosting: RuntimeTestOptions['hosting']): HostingTestOptions | undefined {
  if (hosting === undefined) return undefined
  if ('host' in hosting || 'hosting' in hosting || 'env' in hosting || 'gameOrigin' in hosting)
    return hosting as HostingTestOptions
  return { host: hosting as Omit<FakeHostOptions, 'gameOrigin' | 'gameId'> }
}

/**
 * Boots the runtime for screen and integration tests, as `runGame` does but without the loader or failure panel:
 * `openHostingTest` behind the scenes, page layers and geometry, the settings, the save, the services, and the flow
 * started when there are screens. A host refusal throws the `HostError` boot would show; a refused renderer throws its
 * reason. Whatever opened before a throw is closed.
 */
export async function openRuntimeTest(options: RuntimeTestOptions = {}): Promise<RuntimeTestSession> {
  const owned = teardown()
  try {
    return await open(options, owned)
  } catch (error) {
    await owned.close()
    throw error
  }
}

/** Runs `program` on an open runtime and always closes it. */
export async function withRuntimeTest<A>(
  program: (session: RuntimeTestSession) => Promise<A> | A,
  options: RuntimeTestOptions = {},
): Promise<A> {
  const session = await openRuntimeTest(options)
  try {
    return await program(session)
  } finally {
    await session.dispose()
  }
}

async function open(options: RuntimeTestOptions, owned: Teardown): Promise<RuntimeTestSession> {
  const clock = options.clock ?? systemClock
  const hostingTestOptions = hostingTestOptionsOf(options.hosting)
  const opened = await openHostingTest(hostingTestOptions, { clock })
  if (!opened.ok) throw new HostError(opened.reason)
  owned.add(() => opened.value.dispose())
  const { hosting, handle } = opened.value

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
  owned.add(() => layers.dispose())

  const geometry = createGeometryOwner({
    window: win ?? ({} as Window),
    root: doc ? doc.documentElement : root,
  })
  owned.add(() => geometry.dispose())
  owned.add(hosting.display.subscribe((metrics) => geometry.setHostDisplay(metrics)))

  let rawSettings: string | null = null
  if (options.settings !== undefined) {
    const read = await hosting.saves.get(options.settings.key)
    if (!read.ok) throw new HostError(read.reason)
    rawSettings = read.value
  }
  const settingsService = createSettings(
    options.settings,
    rawSettings,
    hosting.saves,
    options.deviceStorage ?? memoryDeviceStorage(),
  )

  const frames = options.frames ?? manualFrames()

  const meter = createLoadMeter(clock)
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
  const assets = createAssets({
    assets: content.assets,
    fonts: screenFonts,
    fetch: options.fetch ?? fakeFetch({}).fetch,
    ...(fontFaces ? { fontFaces } : {}),
    meter,
  })

  const renderTarget: RenderTarget = { host: layers.stage, geometry, assets }

  let renderer: GameRenderer
  if (options.renderer !== undefined && typeof options.renderer !== 'function') {
    renderer = options.renderer
  } else {
    const built = await (options.renderer ?? nullRenderer())(renderTarget)
    if (!built.ok) throw built.reason
    const owns = built.value
    owned.add(() => owns.dispose())
    renderer = owns
  }

  const ready = await hosting.ready
  if (!ready.ok) throw new HostError(ready.reason)
  layers.setState('ready')

  const bus = createPresentationBus()
  owned.add(() => bus.dispose())
  const time = createTime(bus)
  const locale = await createLocale({
    def: options.locale ?? singleLocale(content.game?.source_language ?? 'en'),
    hosting,
    browser: options.languages ?? [],
    bus,
    element: doc?.documentElement,
  })
  const veil = createVeil({ overlay: layers.overlay, reducedMotion: () => false, clock })
  owned.add(() => veil.dispose())
  // A page without a DOM (Node) still gets an Audio: it is never unlocked, so it stays silent.
  const audio = createAudio({
    hosting,
    assets,
    bus,
    window: win ?? new EventTarget(),
    document: doc ?? Object.assign(new EventTarget(), { visibilityState: 'visible' as const }),
    createContext: options.createAudioContext ?? (() => fakeAudioContext()),
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
  })
  owned.add(() => audio.dispose())

  let services: RuntimeServices | undefined
  const keptAcrossScreens = disposables()
  owned.add(() => keptAcrossScreens.dispose())

  // The save, opened as boot opens it: its triggers and exit flush run for the session.
  const savesOpened = await createSaves(options.saves, {
    contentHash: contentHashOf(content),
    hosting,
    bus,
    clock,
    ...(options.now === undefined ? {} : { now: options.now }),
  })
  if (!savesOpened.ok) throw new HostError(savesOpened.reason)
  const openedSaves = savesOpened.value
  owned.add(() => openedSaves.dispose())

  const flowHandle = createFlow({
    graph: content.flow,
    screens,
    layers,
    assets,
    time,
    bus,
    geometry,
    veil,
    runtime: keptAcrossScreens,
    services: () => {
      if (services === undefined) throw new Error('A screen entered before the runtime services were built')
      return services
    },
  })
  owned.add(() => flowHandle.dispose())

  owned.add(hosting.onMenuRequest(() => flowHandle.flow.openMenu()))

  owned.add(
    watchLifecycle({
      hosting,
      time,
      pauseBehavior: hostingTestOptions?.hosting?.pauseBehavior ?? 'pause',
      ...(doc ? { document: doc } : {}),
      openMenu: () => flowHandle.flow.openMenu(),
    }),
  )

  const appLoop = createAppLoop({
    frames,
    renderer,
    time,
    bus,
    onFault: (cause) =>
      flowHandle.reportFailure({ _tag: 'ScreenFailed', screen: flowHandle.flow.current ?? '', cause }),
  })
  owned.add(() => appLoop.dispose())

  services = {
    audio,
    hosting,
    bus,
    clock,
    time,
    flow: flowHandle.flow,
    settings: settingsService,
    saves: { key: openedSaves.key, save: openedSaves.save },
    appLoop,
    assets,
    renderer,
    locale,
    leaderboards: createLeaderboards(hosting, bus),
    // A device that can neither rumble nor buzz: a test that pulses checks only that nothing throws.
    haptics: createHaptics({ touch: () => false }),
  }

  if (screens.length > 0 && content.flow?.entry) await flowHandle.start()

  return { services, handle, layers, dispose: () => owned.close() }
}
