// The build's publish target picks the adapter: Ruken by default, the web adapter under `automata-web`.
import { makeHosting } from '@mcthaydt/automata/target'
import { canonicalJson, hex64, utf8, xxhash64 } from '@mcthaydt/automata-sim/hash'
import { Context, Duration, Effect, ExecutionStrategy, Layer, Scope, Stream } from 'effect'
import { Audio, makeAudio } from '../../features/audio/audio.manager.js'
import { AudioBuses } from '../../features/audio/audio-buses.js'
import { playEventSounds } from '../../features/audio/event-sounds.js'
import { createDisplayPolicy } from '../../features/display/display-policy.svelte.js'
import { resolveExtensions } from '../../features/extension/resolve-extensions.js'
import { browserHaptics, Haptics } from '../../features/input/haptics/haptics.manager.js'
import { submitEventScores } from '../../features/leaderboards/event-scores.js'
import { Leaderboards, makeLeaderboards } from '../../features/leaderboards/leaderboards.manager.js'
import { browserLanguages, createLocale, singleLocale } from '../../features/locale/locale.manager.js'
import { savesKept } from '../../features/saves/save.manager.js'
import { makeSaves, Saves } from '../../features/saves/saves.manager.js'
import type { HostingSeams } from '../../features/targets/ruken/hosting-ruken.ts'
import { plainSaves } from '../../shared/host/effect-bridge.ts'
import { HostError } from '../../shared/host/errors.ts'
import { Hosting, type HostingOptions } from '../../shared/host/hosting.ts'
import { Assets, makeAssets } from '../../shared/runtime/assets.manager.js'
import { BootDefect, type BootError, ContentHashMismatch } from '../../shared/runtime/boot-error.js'
import { makeLoadMeter, SLOW_MS } from '../../shared/runtime/load-meter.js'
import { AppLoop, makeAppLoop } from '../../shared/runtime/loop/app-loop.manager.js'
import { liveFrames } from '../../shared/runtime/loop/frames.js'
import type { LoaderControls, PageLayers } from '../../shared/runtime/page-layers.svelte.js'
import { createPageLayers } from '../../shared/runtime/page-layers.svelte.js'
import {
  makePresentationBus,
  PresentationBus,
} from '../../shared/runtime/presentation/presentation-bus.manager.js'
import { type GameRenderer, Renderer, type RenderTarget } from '../../shared/runtime/render/renderer.js'
import { liveDeviceStorage } from '../../shared/runtime/settings/device-storage.js'
import { createSettings } from '../../shared/runtime/settings/settings.manager.js'
import { makeTime, Time, watchLifecycle } from '../../shared/runtime/time/time.manager.js'
import { installGlobalErrorHandlers } from '../../shared/ui/browser/global-errors.ts'
import { lockOverscroll } from '../../shared/ui/browser/lock-overscroll.ts'
import { reducedMotion } from '../../shared/ui/browser/reduced-motion.ts'
import { suppressPageGestures } from '../../shared/ui/browser/suppress-page-gestures.ts'
import { createGeometryOwner } from '../../shared/ui/geometry/geometry-owner.svelte.ts'
import { Flow, makeFlow } from '../flow/flow.manager.js'
import type { RuntimeServices } from '../flow/screen.js'
import { makeVeil } from '../flow/veil.js'
import { Locale, Settings } from './effect-tags.ts'
import type { CompiledContentData, GameDefinition } from './game-definition.js'
import { notifyFailure } from './notify-failure.js'

/**
 * The content hash formula: hex64(xxhash64(utf8(canonicalJson(data)))).
 * Matches @mcthaydt/automata-content's contentHash formula, pinned by tests.
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
 * Ruken's save key pattern (/^[A-Za-z0-9._:-]{1,128}$/, sdk/src/save-map.ts).
 * Refused keys fail with HostError{code: 'INVALID_PAYLOAD', operation: 'saves.get'}.
 */
const SAVE_KEY_RE = /^[A-Za-z0-9._:-]{1,128}$/

export interface BootProgramOptions {
  readonly skipSettingsRead?: boolean
  readonly onHosting?: (hosting: Hosting) => void
  readonly onLayers?: (layers: PageLayers) => void
  readonly onLoader?: (loader: LoaderControls) => void
}

/**
 * Builds the Context<RuntimeServices> containing all 14 runtime tags (`Audio` and
 * `AudioBuses` are one service). Its own function so RuntimeTest reuses the exact service wiring.
 */
export function buildRuntimeServices(services: {
  readonly hosting: Hosting
  readonly bus: PresentationBus
  readonly time: Time
  readonly flow: Flow
  readonly settings: Settings
  readonly saves: Saves
  readonly appLoop: AppLoop
  readonly assets: Assets
  readonly renderer: GameRenderer
  readonly locale: Locale
  readonly audio: Audio & AudioBuses
  readonly leaderboards: Leaderboards
  readonly haptics: Haptics
}): Context.Context<RuntimeServices> {
  return Context.empty().pipe(
    Context.add(Hosting, services.hosting),
    Context.add(PresentationBus, services.bus),
    Context.add(Time, services.time),
    Context.add(Flow, services.flow),
    Context.add(Settings, services.settings),
    Context.add(Saves, services.saves),
    Context.add(AppLoop, services.appLoop),
    Context.add(Assets, services.assets),
    Context.add(Renderer, services.renderer),
    Context.add(Locale, services.locale),
    Context.add(Audio, services.audio),
    Context.add(AudioBuses, services.audio),
    Context.add(Leaderboards, services.leaderboards),
    Context.add(Haptics, services.haptics),
  ) as Context.Context<RuntimeServices>
}

/**
 * Executes the boot sequence, its seven steps in order.
 * Errors are typed in BootError; unexpected defects are caught and mapped to BootDefect.
 */
export function bootProgram<S>(
  game: GameDefinition<S>,
  options?: BootProgramOptions,
): Effect.Effect<void, BootError, Scope.Scope> {
  const program = Effect.gen(function* () {
    // Step 1: page layers, geometry owner, ui hygiene, loader overlay, and wait one frame
    const doc = game.seams?.document ?? game.root.ownerDocument ?? document
    const win = doc.defaultView ?? window
    const frames = game.seams?.frames ?? liveFrames()

    const layers = createPageLayers(game.root, doc)
    options?.onLayers?.(layers)
    yield* Effect.addFinalizer(() => Effect.sync(() => layers.dispose()))
    layers.setState('loading')

    const geometry = createGeometryOwner({ window: win, root: doc.documentElement })
    yield* Effect.addFinalizer(() => Effect.sync(() => geometry.dispose()))

    const uninstallErrors = installGlobalErrorHandlers(win, (cls) => {
      // Uncaught errors reported by class name only
      void Effect.runFork(Effect.logError(`Global error: ${cls}`))
    })
    yield* Effect.addFinalizer(() => Effect.sync(uninstallErrors))

    const uninstallGestures = suppressPageGestures(doc)
    yield* Effect.addFinalizer(() => Effect.sync(uninstallGestures))

    const lock = lockOverscroll(doc.documentElement)
    yield* Effect.addFinalizer(() => Effect.sync(() => lock.destroy()))

    const loaderHandle = layers.showLoader({
      label: game.copy?.loading ?? 'Loading…',
      slowLabel: game.copy?.slow ?? 'Taking a while…',
    })
    options?.onLoader?.(loaderHandle)
    yield* Effect.addFinalizer(() => Effect.sync(() => loaderHandle.close()))

    // Wait one display frame so host lifts its cover onto the game's loader
    yield* Effect.async<void>((resume) => {
      const handle = frames.request(() => resume(Effect.void))
      return Effect.sync(() => frames.cancel(handle))
    })

    // Step 2: host session over Hosting
    const disclosedEvents = game.content.data.game?.custom_events
    const hostingOptions: HostingOptions = {
      ...game.hosting,
      ...(disclosedEvents !== undefined ? { disclosedEvents } : {}),
    }
    const hosting = yield* game.seams?.hosting !== undefined
      ? game.seams.hosting(hostingOptions)
      : Effect.suspend(() => {
          const sdkEnv = game.seams?.sdkEnv?.()
          const hostingSeams: HostingSeams = sdkEnv !== undefined ? { env: sdkEnv } : {}
          return makeHosting(hostingOptions, hostingSeams)
        })
    options?.onHosting?.(hosting)

    const initialDisplay = yield* hosting.display.get
    geometry.setHostDisplay(initialDisplay)
    yield* Effect.forkScoped(
      Stream.runForEach(hosting.display.changes, (metrics) =>
        Effect.sync(() => geometry.setHostDisplay(metrics)),
      ),
    )

    // Step 3: storage and settings
    let rawSettings: string | null = null
    if (game.settings !== undefined && !options?.skipSettingsRead) {
      if (!SAVE_KEY_RE.test(game.settings.key)) {
        return yield* Effect.fail(
          new HostError({
            code: 'INVALID_PAYLOAD',
            retryable: false,
            operation: 'saves.get',
          }),
        )
      }
      // A target that does not grant saves (a web page with storage blocked) boots on the defaults and says so on the
      // paused screen; reading would fail DENIED and stop a game that can run.
      if (savesKept(hosting)) rawSettings = yield* hosting.saves.get(game.settings.key)
    }
    // Fields a game keeps on the device go to the frame's own storage unless a test hands over another.
    const deviceStorage =
      game.seams?.deviceStorage ??
      (typeof window === 'undefined' ? undefined : liveDeviceStorage(window, game.hosting.gameId))
    const settingsService = createSettings(
      game.settings,
      rawSettings,
      plainSaves(hosting.saves),
      deviceStorage,
    )

    // Step 4: content hash verification
    const actualHash = contentHashOf(game.content.data)
    if (actualHash !== game.content.hash) {
      return yield* Effect.fail(new ContentHashMismatch({ expected: game.content.hash, actual: actualHash }))
    }

    // Step 5: load assets and fonts under the stall rule
    const meter = yield* makeLoadMeter
    yield* Effect.forkScoped(
      Effect.sleep(Duration.millis(SLOW_MS)).pipe(
        Effect.andThen(Effect.sync(() => loaderHandle.setSlow(true))),
      ),
    )

    const screenFonts: Record<string, readonly string[]> = {}
    for (const screen of game.screens) {
      if (screen.fonts) screenFonts[screen.id] = screen.fonts
    }

    const fontFaces = game.seams?.fonts ?? (typeof document !== 'undefined' ? document.fonts : undefined)
    const preloadScreens =
      game.content.data.game?.preload_screens !== undefined &&
      game.content.data.game.preload_screens.length > 0
        ? game.content.data.game.preload_screens
        : [game.content.data.flow.entry]

    const assets = yield* makeAssets({
      assets: withPreload(game.content.data.assets, preloadScreens[0], game.preload),
      fonts: screenFonts,
      ...(game.seams?.fetch !== undefined ? { fetch: game.seams.fetch } : {}),
      ...(fontFaces !== undefined ? { fontFaces } : {}),
      meter,
    })

    for (const screenId of preloadScreens) {
      yield* assets.load(screenId, (fraction) => loaderHandle.setProgress(fraction))
    }

    // Step 6: renderer factory. The bus exists first so the renderer can publish render facts.
    const bus = yield* makePresentationBus()
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
    const renderer = yield* game.renderer(renderTarget)

    // Step 7: ready guarded by stall rule, runtime services, extensions and flow start
    yield* meter
      .guard(hosting.ready, {
        url: 'session.ready',
        onSlow: () => loaderHandle.setSlow(true),
      })
      .pipe(
        Effect.catchTag('LoadStalled', () =>
          Effect.fail(new HostError({ code: 'TIMEOUT', retryable: true, operation: 'ready' })),
        ),
      )

    // Ready resolved: close loader overlay and set state ready
    loaderHandle.close()
    layers.setState('ready')

    const time = makeTime(bus)

    // The locale is negotiated, and <html lang dir> set, before the first screen enters.
    const locale = yield* Effect.promise(() =>
      createLocale({
        def: game.locale ?? singleLocale(game.content.data.game?.source_language ?? 'en'),
        hosting: { kind: hosting.kind, locale: hosting.locale, saves: plainSaves(hosting.saves) },
        browser: game.seams?.languages ?? browserLanguages(win.navigator),
        bus,
        element: doc.documentElement,
      }),
    )

    // Built now and silent until the first gesture after ready.
    const audio = yield* makeAudio({
      hosting,
      assets,
      bus,
      window: win,
      document: doc,
      ...(game.seams?.createAudioContext === undefined
        ? {}
        : { createContext: game.seams.createAudioContext }),
      ...(game.seams?.fetch === undefined ? {} : { fetch: game.seams.fetch }),
    })
    if (game.sounds !== undefined) {
      const stopSounds = playEventSounds(bus, audio, game.sounds)
      yield* Effect.addFinalizer(() => Effect.sync(stopSounds))
    }
    const leaderboards = yield* makeLeaderboards.pipe(
      Effect.provideService(Hosting, hosting),
      Effect.provideService(PresentationBus, bus),
    )
    if (game.scores !== undefined) {
      const stopScores = submitEventScores(bus, leaderboards, game.scores)
      yield* Effect.addFinalizer(() => Effect.sync(stopScores))
    }

    // What a game keeps across screens, handed to each as `ScreenContext.runtime`. Forked here, before the
    // save, because finalizers run last-in, first-out: at shutdown it closes after the current screen and the save's
    // last flush (which may still read what it holds), and before the renderer is destroyed and Hosting closes.
    const keptAcrossScreens = yield* Scope.fork(yield* Scope.Scope, ExecutionStrategy.sequential)

    // The game's save: its slots read from the host now, its triggers and its exit flush
    // live for the session. A failure here is the host's, and boots to the failure panel like a refused settings read.
    const saves = yield* makeSaves(game.saves, { contentHash: game.content.hash }).pipe(
      Effect.provideService(Hosting, hosting),
      Effect.provideService(PresentationBus, bus),
    )

    const veil = yield* makeVeil({
      overlay: layers.overlay,
      reducedMotion: () => reducedMotion(win),
    })

    let runtimeContext: Context.Context<RuntimeServices> = Context.empty() as Context.Context<RuntimeServices>

    const flowHandle = yield* makeFlow({
      graph: game.content.data.flow,
      screens: game.screens,
      layers,
      assets,
      time,
      bus,
      geometry,
      veil,
      ...(game.copy !== undefined ? { copy: game.copy } : {}),
      services: () => runtimeContext,
      runtime: keptAcrossScreens,
      onFailure: (cause) => notifyFailure(game.seams, cause),
      ...(import.meta.env?.DEV
        ? {
            logUnmatched: (screen: string, event: string) =>
              console.warn(`Unmatched event '${event}' on screen '${screen}'`),
          }
        : {}),
    })

    yield* hosting.onMenuRequest(() => flowHandle.flow.openMenu())

    yield* watchLifecycle({
      hosting,
      time,
      pauseBehavior: game.hosting.pauseBehavior,
      document: doc,
      openMenu: () => flowHandle.flow.openMenu(),
    })

    const appLoop = yield* makeAppLoop({
      frames,
      renderer,
      time,
      bus,
      onFault: (cause) => {
        flowHandle.reportFailure({
          _tag: 'ScreenFailed',
          screen: flowHandle.flow.current ?? '',
          cause,
        })
        notifyFailure(game.seams, cause)
      },
    })

    runtimeContext = buildRuntimeServices({
      hosting,
      bus,
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
    })

    if (game.extensions && game.extensions.length > 0) {
      const resolved = resolveExtensions(game.extensions)
      yield* Layer.build(resolved.layer).pipe(Effect.provide(runtimeContext))
    }

    yield* flowHandle.start()

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
    yield* Effect.addFinalizer(() => Effect.sync(() => display.dispose()))
  })

  return program.pipe(
    Effect.catchAllDefect((defect) =>
      Effect.logError('Boot defect', defect).pipe(
        Effect.zipRight(Effect.fail(new BootDefect({ cause: defect }))),
      ),
    ),
  )
}
