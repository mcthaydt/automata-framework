// The build's publish target picks the adapter: Ruken by default, the web adapter under `automata-web`.
import { createHosting } from '@automata/framework/target'
import { canonicalJson, hex64, utf8, xxhash64 } from '@automata/sim/hash'
import { createAudio } from '../../features/audio/audio.manager.js'
import { playEventSounds } from '../../features/audio/event-sounds.js'
import { createDisplayPolicy } from '../../features/display/display-policy.svelte.js'
import { browserHaptics } from '../../features/input/haptics/haptics.manager.js'
import { submitEventScores } from '../../features/leaderboards/event-scores.js'
import { createLeaderboards } from '../../features/leaderboards/leaderboards.manager.js'
import { browserLanguages, createLocale, singleLocale } from '../../features/locale/locale.manager.js'
import { savesKept } from '../../features/saves/save.manager.js'
import { createSaves } from '../../features/saves/saves.manager.js'
import { type HostResult, refuse } from '../../shared/host/errors.ts'
import type { Hosting, HostingOptions, HostingSeams } from '../../shared/host/hosting.ts'
import { type Clock, systemClock } from '../../shared/lib/clock.ts'
import { disposables } from '../../shared/lib/disposables.ts'
import { ok, type Result, refused } from '../../shared/lib/result.ts'
import { createAssets } from '../../shared/runtime/assets.manager.js'
import {
  BootDefect,
  type BootError,
  ContentHashMismatch,
  HostError,
  LoadStalled,
} from '../../shared/runtime/boot-error.js'
import { createLoadMeter, SLOW_MS } from '../../shared/runtime/load-meter.js'
import { createAppLoop } from '../../shared/runtime/loop/app-loop.manager.js'
import { type FrameSource, liveFrames } from '../../shared/runtime/loop/frames.js'
import type { LoaderControls, PageLayers } from '../../shared/runtime/page-layers.svelte.js'
import { createPageLayers } from '../../shared/runtime/page-layers.svelte.js'
import { createPresentationBus } from '../../shared/runtime/presentation/presentation-bus.manager.js'
import type { RenderTarget } from '../../shared/runtime/render/renderer.js'
import { liveDeviceStorage } from '../../shared/runtime/settings/device-storage.js'
import { createSettings } from '../../shared/runtime/settings/settings.manager.js'
import { createTime, watchLifecycle } from '../../shared/runtime/time/time.manager.js'
import { installGlobalErrorHandlers } from '../../shared/ui/browser/global-errors.ts'
import { lockOverscroll } from '../../shared/ui/browser/lock-overscroll.ts'
import { reducedMotion } from '../../shared/ui/browser/reduced-motion.ts'
import { suppressPageGestures } from '../../shared/ui/browser/suppress-page-gestures.ts'
import { createGeometryOwner } from '../../shared/ui/geometry/geometry-owner.svelte.ts'
import { createFlow, type Flow } from '../flow/flow.manager.js'
import type { RuntimeServices } from '../flow/screen.js'
import { createVeil } from '../flow/veil.js'
import type { CompiledContentData, GameDefinition } from './game-definition.js'
import { notifyFailure } from './notify-failure.js'
import type { Teardown } from './teardown.ts'

/**
 * The content hash formula: hex64(xxhash64(utf8(canonicalJson(data)))).
 * Matches `@automata/content`'s contentHash formula, pinned by tests.
 */
export function contentHashOf(data: unknown): string {
  return hex64(xxhash64(utf8(canonicalJson(data))))
}

/**
 * The content's assets with a game's own preload files added to the first preload screen's list (`GameDefinition
 * .preload`), so they load with that screen and the renderer finds them in `Assets`. The content itself, and so its
 * hash, is untouched.
 */
function withPreload(
  assets: CompiledContentData['assets'],
  screen: string | undefined,
  preload: readonly string[] | undefined,
): CompiledContentData['assets'] {
  if (preload === undefined || preload.length === 0 || screen === undefined) return assets
  const screens = assets?.screens ?? {}
  const files = [...(screens[screen]?.files ?? [])]
  for (const file of preload) if (!files.includes(file)) files.push(file)
  return { ...assets, screens: { ...screens, [screen]: { files } } }
}

/** The context-lost panel's English default, in Ruken's quiet tone. */
const CONTEXT_LOST_COPY_EN = 'The picture stopped. Try again to bring it back.'

/**
 * Ruken's save key pattern (/^[A-Za-z0-9._:-]{1,128}$/).
 * A refused key fails with HostError{code: 'INVALID_PAYLOAD', operation: 'saves.get'}.
 */
const SAVE_KEY_RE = /^[A-Za-z0-9._:-]{1,128}$/

export interface BootProgramOptions {
  readonly skipSettingsRead?: boolean
  readonly onHosting?: (hosting: Hosting) => void
  readonly onLayers?: (layers: PageLayers) => void
  readonly onLoader?: (loader: LoaderControls) => void
  /** Hears the flow once it exists, so the runtime's handle can say which screen shows. */
  readonly onFlow?: (flow: Flow) => void
  /** The screen the flow starts on instead of its entry (`StartOptions.at`). */
  readonly startAt?: string | undefined
  /**
   * Stops the boot: the step under way gives up (the handshake, a download, the frame wait) and boot returns at the
   * next step without starting the flow. What it opened is in the caller's `Teardown`, so the caller closes it.
   */
  readonly signal?: AbortSignal
}

/** Waits for the next display frame, or for `signal` to abort (then the frame request is cancelled). */
function nextFrame(frames: FrameSource, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve) => {
    const handle = frames.request(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    })
    function onAbort() {
      frames.cancel(handle)
      resolve()
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/** The build target's adapter, or the test's `seams.hosting` in its place. */
function openHosting<S>(
  game: GameDefinition<S>,
  options: HostingOptions,
  clock: Clock,
  signal: AbortSignal,
): Promise<HostResult<Hosting>> {
  if (game.seams?.hosting !== undefined) return game.seams.hosting(options, { clock, signal })
  const sdkEnv = game.seams?.sdkEnv?.()
  const seams: HostingSeams = sdkEnv !== undefined ? { env: sdkEnv, clock, signal } : { clock, signal }
  return createHosting(options, seams)
}

/**
 * Runs the boot sequence, its seven steps in order, and starts the flow. Everything it opens goes into `owned`, which
 * the caller closes (on shutdown, or before Try again): nothing is closed here, even on failure, so the failure panel
 * can still reach `Hosting`. A host refusal or a load failure answers its `BootError`; anything thrown is logged and
 * answered as `BootDefect`. An aborted boot answers `ok` early, without starting the flow.
 */
export async function bootProgram<S>(
  game: GameDefinition<S>,
  owned: Teardown,
  options: BootProgramOptions = {},
): Promise<Result<void, BootError>> {
  try {
    return await boot(game, owned, options)
  } catch (defect) {
    console.error('Boot defect', defect)
    return refused(new BootDefect({ cause: defect }))
  }
}

async function boot<S>(
  game: GameDefinition<S>,
  owned: Teardown,
  options: BootProgramOptions,
): Promise<Result<void, BootError>> {
  const signal = options.signal ?? new AbortController().signal
  const clock = game.seams?.clock ?? systemClock

  // Step 1: page layers, geometry owner, ui hygiene, loader overlay, and wait one frame
  const doc = game.seams?.document ?? game.root.ownerDocument ?? document
  const win = doc.defaultView ?? window
  const frames = game.seams?.frames ?? liveFrames()

  const layers = createPageLayers(game.root, doc)
  options.onLayers?.(layers)
  owned.add(() => layers.dispose())
  layers.setState('loading')

  const geometry = createGeometryOwner({ window: win, root: doc.documentElement })
  owned.add(() => geometry.dispose())

  // Uncaught errors reported by class name only
  owned.add(installGlobalErrorHandlers(win, (cls) => console.error(`Global error: ${cls}`)))
  owned.add(suppressPageGestures(doc))
  const lock = lockOverscroll(doc.documentElement)
  owned.add(() => lock.destroy())

  const loaderHandle = layers.showLoader({
    label: game.copy?.loading ?? 'Loading…',
    slowLabel: game.copy?.slow ?? 'Taking a while…',
  })
  options.onLoader?.(loaderHandle)
  owned.add(() => loaderHandle.close())

  // Wait one display frame so host lifts its cover onto the game's loader
  await nextFrame(frames, signal)
  if (signal.aborted) return ok(undefined)

  // Step 2: host session over Hosting
  const disclosedEvents = game.content.data.game?.custom_events
  const hostingOptions: HostingOptions = {
    ...game.hosting,
    ...(disclosedEvents !== undefined ? { disclosedEvents } : {}),
  }
  const opened = await openHosting(game, hostingOptions, clock, signal)
  if (!opened.ok) return refused(new HostError(opened.reason))
  const hosting = opened.value
  owned.add(() => hosting.dispose())
  options.onHosting?.(hosting)
  if (signal.aborted) return ok(undefined)

  // The host's display metrics, now and as they change, for as long as the session lasts.
  owned.add(hosting.display.subscribe((metrics) => geometry.setHostDisplay(metrics)))

  // Step 3: storage and settings
  let rawSettings: string | null = null
  if (game.settings !== undefined && !options.skipSettingsRead) {
    if (!SAVE_KEY_RE.test(game.settings.key)) {
      return refused(new HostError({ code: 'INVALID_PAYLOAD', retryable: false, operation: 'saves.get' }))
    }
    // A target that does not grant saves (a web page with storage blocked) boots on the defaults and says so on the
    // paused screen; reading would fail DENIED and stop a game that can run.
    if (savesKept(hosting)) {
      const read = await hosting.saves.get(game.settings.key)
      if (!read.ok) return refused(new HostError(read.reason))
      rawSettings = read.value
      if (signal.aborted) return ok(undefined)
    }
  }
  // Fields a game keeps on the device go to the frame's own storage unless a test hands over another.
  const deviceStorage =
    game.seams?.deviceStorage ??
    (typeof window === 'undefined' ? undefined : liveDeviceStorage(window, game.hosting.gameId))
  const settingsService = createSettings(game.settings, rawSettings, hosting.saves, deviceStorage)

  // Step 4: content hash verification
  const actualHash = contentHashOf(game.content.data)
  if (actualHash !== game.content.hash) {
    return refused(new ContentHashMismatch({ expected: game.content.hash, actual: actualHash }))
  }

  // Step 5: load assets and fonts under the stall rule
  const meter = createLoadMeter(clock)
  const slowTimer = clock.setTimeout(() => loaderHandle.setSlow(true), SLOW_MS)
  owned.add(() => clock.clearTimeout(slowTimer))

  const screenFonts: Record<string, readonly string[]> = {}
  for (const screen of game.screens) {
    if (screen.fonts) screenFonts[screen.id] = screen.fonts
  }

  const fontFaces = game.seams?.fonts ?? (typeof document !== 'undefined' ? document.fonts : undefined)
  const preloadScreens =
    game.content.data.game?.preload_screens !== undefined && game.content.data.game.preload_screens.length > 0
      ? game.content.data.game.preload_screens
      : [game.content.data.flow.entry]

  const assets = createAssets({
    assets: withPreload(game.content.data.assets, preloadScreens[0], game.preload),
    fonts: screenFonts,
    ...(game.seams?.fetch !== undefined ? { fetch: game.seams.fetch } : {}),
    ...(fontFaces !== undefined ? { fontFaces } : {}),
    meter,
  })

  for (const screenId of preloadScreens) {
    const loaded = await assets.load(screenId, (fraction) => loaderHandle.setProgress(fraction), signal)
    if (signal.aborted) return ok(undefined)
    if (!loaded.ok) return refused(loaded.reason)
  }

  // Step 6: renderer factory. The bus exists first so the renderer can publish render facts.
  const bus = createPresentationBus()
  owned.add(() => bus.dispose())
  const renderTarget: RenderTarget = {
    host: layers.stage,
    geometry,
    assets,
    bus,
    reportLost: (retry) => {
      const dismiss = layers.showError({
        code: 'context-lost',
        message: game.copy?.contextLost ?? CONTEXT_LOST_COPY_EN,
        actions: [
          {
            id: 'retry',
            label: game.copy?.retry ?? 'Try again',
            kind: 'primary',
            onSelect: () => {
              dismiss()
              retry()
            },
          },
        ],
      })
      return dismiss
    },
  }
  const built = await game.renderer(renderTarget)
  if (!built.ok) return refused(built.reason)
  const renderer = built.value
  owned.add(() => renderer.dispose())
  if (signal.aborted) return ok(undefined)

  // Step 7: ready guarded by stall rule, runtime services, extensions and flow start
  // A ready that stalls is the host timing out: the panel offers Try again, as for any retryable refusal.
  const ready = await meter
    .guard(() => hosting.ready, { url: 'session.ready', onSlow: () => loaderHandle.setSlow(true) }, signal)
    .catch((error: unknown) => {
      if (error instanceof LoadStalled) return refuse('TIMEOUT', true, 'ready')
      throw error
    })
  if (signal.aborted) return ok(undefined)
  if (!ready.ok) return refused(new HostError(ready.reason))

  // Ready resolved: close loader overlay and set state ready
  loaderHandle.close()
  layers.setState('ready')

  const time = createTime(bus)

  // The locale is negotiated, and <html lang dir> set, before the first screen enters.
  const locale = await createLocale({
    def: game.locale ?? singleLocale(game.content.data.game?.source_language ?? 'en'),
    hosting,
    browser: game.seams?.languages ?? browserLanguages(win.navigator),
    bus,
    element: doc.documentElement,
  })
  if (signal.aborted) return ok(undefined)

  // Built now and silent until the first gesture after ready.
  const audio = createAudio({
    hosting,
    assets,
    bus,
    window: win,
    document: doc,
    ...(game.seams?.createAudioContext === undefined ? {} : { createContext: game.seams.createAudioContext }),
    ...(game.seams?.fetch === undefined ? {} : { fetch: game.seams.fetch }),
  })
  owned.add(() => audio.dispose())
  if (game.sounds !== undefined) owned.add(playEventSounds(bus, audio, game.sounds))
  const leaderboards = createLeaderboards(hosting, bus)
  if (game.scores !== undefined) owned.add(submitEventScores(bus, leaderboards, game.scores))

  // What a game keeps across screens, handed to each as `ScreenContext.runtime`. Added here, before the save, because
  // teardown runs last-in, first-out: at shutdown it closes after the current screen and the save's last flush (which
  // may still read what it holds), and before the renderer is destroyed and Hosting closes.
  const keptAcrossScreens = disposables()
  owned.add(() => keptAcrossScreens.dispose())

  // The game's save: its slots read from the host now, its triggers and its exit flush live for the session. A refusal
  // here is the host's, and boots to the failure panel like a refused settings read.
  const savesOpened = await createSaves(game.saves, {
    contentHash: game.content.hash,
    hosting,
    bus,
    clock,
    ...(game.seams?.now === undefined ? {} : { now: game.seams.now }),
  })
  if (!savesOpened.ok) return refused(new HostError(savesOpened.reason))
  const openedSaves = savesOpened.value
  owned.add(() => openedSaves.dispose())
  const saves = { key: openedSaves.key, save: openedSaves.save }
  if (signal.aborted) return ok(undefined)

  const veil = createVeil({ overlay: layers.overlay, reducedMotion: () => reducedMotion(win), clock })
  owned.add(() => veil.dispose())

  // Built once every service exists (the flow is one of them); a screen reads them when it enters.
  let services: RuntimeServices | undefined

  const flowHandle = createFlow({
    graph: game.content.data.flow,
    screens: game.screens,
    layers,
    assets,
    time,
    bus,
    geometry,
    veil,
    ...(game.copy !== undefined ? { copy: game.copy } : {}),
    services: () => {
      if (services === undefined) throw new Error('A screen entered before the runtime services were built')
      return services
    },
    runtime: keptAcrossScreens,
    onFailure: (cause) => notifyFailure(game.seams, cause),
    ...(import.meta.env?.DEV
      ? {
          logUnmatched: (screen: string, event: string) =>
            console.warn(`Unmatched event '${event}' on screen '${screen}'`),
        }
      : {}),
  })
  // Leaving the current screen comes before the save's last flush and `keptAcrossScreens` (teardown runs last first).
  owned.add(() => flowHandle.dispose())

  owned.add(hosting.onMenuRequest(() => flowHandle.flow.openMenu()))

  owned.add(
    watchLifecycle({
      hosting,
      time,
      pauseBehavior: game.hosting.pauseBehavior,
      document: doc,
      openMenu: () => flowHandle.flow.openMenu(),
    }),
  )

  const appLoop = createAppLoop({
    frames,
    renderer,
    time,
    bus,
    onFault: (cause) => {
      flowHandle.reportFailure({ _tag: 'ScreenFailed', screen: flowHandle.flow.current ?? '', cause })
      notifyFailure(game.seams, cause)
    },
  })
  owned.add(() => appLoop.dispose())

  services = {
    hosting,
    bus,
    clock,
    time,
    flow: flowHandle.flow,
    settings: settingsService,
    saves,
    appLoop,
    assets,
    renderer,
    locale,
    audio,
    leaderboards,
    haptics: game.seams?.haptics ?? browserHaptics(win),
  }

  options.onFlow?.(flowHandle.flow)
  await flowHandle.start(options.startAt)
  if (signal.aborted) return ok(undefined)

  // The landscape gate (standalone) and the rotate hint, over every screen for the session.
  const display = createDisplayPolicy({
    orientation: game.orientation ?? 'any',
    rotateHint: game.rotateHint ?? 'block',
    hosted: hosting.kind !== 'standalone',
    win,
    geometry,
    layer: layers.overlay,
    time,
  })
  owned.add(() => display.dispose())
  return ok(undefined)
}
