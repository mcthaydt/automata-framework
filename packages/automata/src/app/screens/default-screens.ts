import '../../shared/ui/theme.css'
import './screens.css'
import { createSim, type PluginDef, type Sim } from '@mcthaydt/automata-sim'
import { Effect, Scope, SubscriptionRef } from 'effect'
import { Audio } from '../../features/audio/audio.manager.ts'
import { AudioBuses } from '../../features/audio/audio-buses.ts'
import type { ExtensionDef } from '../../features/extension/define-extension.ts'
import { resolveExtensions } from '../../features/extension/resolve-extensions.ts'
import {
  type CameraSettings,
  cameraSettingsSchema,
} from '../../features/input/analog/camera-settings.schema.ts'
import { analogReading } from '../../features/input/analog-reading.ts'
import { inputSettingsSchema } from '../../features/input/bindings/input-settings.schema.ts'
import { CameraDragTracker } from '../../features/input/gestures/camera-drag-tracker.ts'
import { SwipeTracker } from '../../features/input/gestures/swipe-tracker.ts'
import { Haptics } from '../../features/input/haptics/haptics.manager.ts'
import { makeInput } from '../../features/input/input.manager.ts'
import type { InputMap } from '../../features/input/keys.ts'
import { Leaderboards } from '../../features/leaderboards/leaderboards.manager.ts'
import { Locale } from '../../features/locale/locale.manager.ts'
import { saveOf } from '../../features/saves/saves.manager.ts'
import { displaySettingsSchema, type QualityTier } from '../../shared/runtime/display-settings.schema.ts'
import { AppLoop } from '../../shared/runtime/loop/app-loop.manager.ts'
import { PresentationBus } from '../../shared/runtime/presentation/presentation-bus.manager.ts'
import { Settings } from '../../shared/runtime/settings/settings.manager.ts'
import { Time } from '../../shared/runtime/time/time.manager.ts'
import { InputMethodTracker } from '../../shared/ui/browser/input-method.svelte.ts'
import { sendBack } from '../../shared/ui/focus/back-gesture.ts'
import { CursorRunner } from '../../shared/ui/focus/cursor-policy.ts'
import type { GameSaves } from '../define-game.ts'
import { Flow } from '../flow/flow.manager.ts'
import type { ScreenDef } from '../flow/screen.ts'
import PausedScreen from './PausedScreen.svelte'
import PlayScreen from './PlayScreen.svelte'
import { pausedSaves } from './saves/saves-paused.ts'
import type { SavesStart } from './saves/saves-start.ts'
import { titleSaves } from './saves/saves-title.ts'
import {
  backGesture,
  driveMenu,
  hostInput,
  listen,
  NO_BINDINGS,
  noticeChangedElsewhere,
  noticeUnsupportedPads,
  plain,
  show,
  windowOf,
} from './screen-kit.ts'
import { type LiveScreensCopy, screensCopy } from './screens-copy.svelte.ts'
import type { ScreensCopyInput } from './screens-copy.ts'
import { applyAudio, changeAudio, savedAudio } from './settings/audio-settings.ts'
import { savedHaptics } from './settings/haptics-settings.ts'
import { settingsScreen } from './settings/settings-screen.svelte.ts'
import TitleScreen from './TitleScreen.svelte'

/** What the default screens need from the game. */
export interface ScreensGame {
  readonly title: string
  readonly sim: {
    readonly plugins: readonly PluginDef[]
    readonly seed: number
    readonly setup?: ((sim: Sim) => void) | undefined
    readonly content?: unknown
  }
  readonly input?: InputMap | undefined
  /** Told the sim play runs, and `undefined` when the title drops it: the draw layer reads it. */
  readonly watchSim?: ((sim: Sim | undefined) => void) | undefined
  /** The board paused shows: the game's first scored board. None: paused shows no board. */
  readonly board?: string | undefined
  /** Applies the player's graphics quality to the stage: the saved one at the title, then each choice. */
  readonly setQuality?: ((tier: QualityTier) => void) | undefined
  /** The game's save: the title lists its slots and play keeps the loaded one saved. None: no slot list. */
  readonly saves?: GameSaves<unknown> | undefined
  /** The game's extensions: play draws their `hud.overlay` components, Settings shows their `settings.sections`. */
  readonly extensions?: readonly ExtensionDef[] | undefined
  /** The game's words for these screens (`GameSpec.copy.screens`), over the English defaults. */
  readonly copy?: ScreensCopyInput | undefined
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {}

/**
 * The title, play, paused and settings screens over the default content's flow
 * (`title → play ⇄ paused → title`, `paused ⇄ settings`).
 *
 * The screens share one sim: play creates it on first entry (seed, plugins, content, then `setup`),
 * paused keeps it, and the title drops it, so Quit to title and Play start again at tick 0. A runtime that shuts
 * down with the sim alive drops it too, whichever screen is current. Returning
 * from paused re-sends the whole state to the renderer (G-5): `AppLoop.run` resets the renderer, so
 * play restores the sim's own snapshot, which makes the next step a resync.
 */
export function defaultScreens(game: ScreensGame): ScreenDef[] {
  /** The screens' words in the player's language, re-read on each change, for as long as the screen is open. */
  const words: Effect.Effect<LiveScreensCopy, never, Locale | Scope.Scope> = Effect.flatMap(
    Locale,
    (locale) => screensCopy(game.copy, locale),
  )
  // The pads already told they are not supported, for the whole session.
  const toldPads = new Set<string>()
  let sim: Sim | undefined
  let playFlow: Flow | undefined
  /** Set when play paused because the pad in use was unplugged (M4-D9); Resume or Quit clears it. */
  let reconnect = false

  const dropSim = (): void => {
    game.watchSim?.(undefined)
    sim?.dispose()
    sim = undefined
  }

  /** The run whose shutdown drops the sim: each run of the runtime (a retried boot, a second `runGame`) has its own. */
  let droppedWith: Scope.Scope | undefined
  /**
   * Drops the sim when the run's `runtime` scope closes, which is after the current screen and the save's last
   * flush have read it. Once per run: `dropSim` forgets the sim it disposes, so one the title dropped is not disposed
   * again, and a shutdown on the title disposes nothing.
   */
  const dropSimOnShutdown = (runtime: Scope.Scope): Effect.Effect<void> =>
    Effect.suspend(() => {
      if (droppedWith === runtime) return Effect.void
      droppedWith = runtime
      return Scope.addFinalizer(runtime, Effect.sync(dropSim))
    })

  /** A sim set up from the game's seed, plugins, content and `setup`, at tick 0. */
  const freshSim = async (): Promise<Sim> => {
    const { plugins, seed, content, setup } = game.sim
    const created = await createSim({ plugins: [...plugins], seed, content })
    setup?.(created)
    return created
  }

  const title: ScreenDef = {
    id: 'title',
    enter: ({ layer }) =>
      Effect.gen(function* () {
        const flow = yield* Flow
        // Quit to title: progress play kept is written while the sim that holds it still lives.
        if (game.saves !== undefined) yield* (yield* saveOf(game.saves.def)).flushPending
        dropSim()
        // The player's saved quality reaches the stage before play draws anything.
        const { store } = yield* Settings
        // And the saved mix reaches the audio, so the first sound is at the player's levels.
        applyAudio({ audio: yield* Audio, buses: yield* AudioBuses }, savedAudio(store))
        ;(yield* Haptics).setEnabled(savedHaptics(store))
        if (game.setQuality !== undefined && store !== undefined)
          game.setQuality(
            displaySettingsSchema
              .catch(() => ({ quality: 'high' as const }))
              .parse(asRecord(store.get()).display).quality,
          )
        const target = windowOf(layer)
        const play = (): void => void flow.dispatch('play')
        // A game with a save has no Play: the slot list starts play, with the sim its slot made.
        const saves =
          game.saves === undefined
            ? undefined
            : yield* titleSaves(game.saves, {
                fresh: freshSim,
                play: (started) => {
                  sim = started
                  play()
                },
              } satisfies SavesStart)
        const copy = yield* words
        yield* show(TitleScreen, layer, { title: game.title, onPlay: play, saves, copy })
        // Enter or Space anywhere on the title plays; on a focused button the button's own click does.
        if (saves === undefined)
          yield* listen(target, 'keydown', (event) => {
            if (!plain(event) || (event.code !== 'Enter' && event.code !== 'Space')) return
            if (event.target instanceof HTMLButtonElement) return
            event.preventDefault()
            play()
          })
        // Nothing on the title takes Back, so a back step leaves the game.
        yield* backGesture(target, () => sendBack(layer.ownerDocument))
        yield* driveMenu(target)
        yield* noticeUnsupportedPads(layer, toldPads, () => copy.current.padUnsupported)
      }),
  }

  const play: ScreenDef = {
    id: 'play',
    kind: 'gameplay',
    openMenu: () => playFlow?.dispatch('pause') ?? false,
    enter: ({ layer }) =>
      Effect.gen(function* () {
        const flow = yield* Flow
        const appLoop = yield* AppLoop
        const target = windowOf(layer)
        playFlow = flow
        yield* Effect.addFinalizer(() =>
          Effect.sync(() => {
            playFlow = undefined
          }),
        )

        let current = sim
        if (current === undefined) {
          // Kept the moment it is made. A runtime that shuts down while it is being made interrupts this enter, which
          // aborts the signal: the run no longer holds a sim to drop, so the late one is disposed here.
          // Waiting for it instead would hold shutdown on a plugin's engine setup.
          current = yield* Effect.promise((signal) =>
            freshSim().then((made) => {
              if (signal.aborted) made.dispose()
              else sim = made
              return made
            }),
          )
        } else {
          current.restore(current.snapshot())
        }

        // The Input service for this play session: sampled once per fixed step, closed with the screen.
        const map = game.input
        const bus = yield* PresentationBus
        // The player's bindings and touch mode, from the settings.
        const { store } = yield* Settings
        const input = yield* makeInput({
          target,
          profile: map?.profile ?? NO_BINDINGS,
          bus,
          settings: store,
          hostInput: yield* hostInput,
        })
        const bindsCameraDrag = Object.values(map?.profile.bindings ?? {}).some(
          (binding) => binding.gesture?.includes('camera-drag') === true,
        )
        // The player's camera choices, read each tick so a change in Settings applies at once.
        const camera = (): CameraSettings => cameraSettingsSchema.parse(asRecord(store?.get()).camera)
        const touchMode = inputSettingsSchema.parse(asRecord(store?.get()).input).touchMode ?? map?.touchMode
        const running = current
        game.watchSim?.(running)
        // The slot play was started from is kept saved: each tick says what the progress is, and the save's own
        // triggers (leaving play, a round's end, the page going to the background) write it.
        const save = game.saves === undefined ? undefined : yield* saveOf(game.saves.def)
        const keep = (): unknown => game.saves?.capture(running)
        // An idle pointer hides while playing; leaving play detaches it and shows the pointer again.
        const cursor = new CursorRunner(layer, { kind: () => 'gameplay' })
        const detachCursor = cursor.attach(target)
        yield* Effect.addFinalizer(() => Effect.sync(detachCursor))
        const copy = yield* words
        yield* noticeUnsupportedPads(layer, toldPads, () => copy.current.padUnsupported)
        if (game.saves !== undefined)
          yield* noticeChangedElsewhere(layer, game.saves.def.key, copy.current.saves.changedElsewhereToast)
        appLoop.run({
          sim: running,
          commands: (tick) => {
            cursor.tick()
            save?.touch(keep)
            if (map === undefined) return []
            input.poll()
            return map.toCommand(input.held(), tick, analogReading(input, camera()))
          },
        })
        yield* Effect.addFinalizer(() => Effect.sync(() => appLoop.stop()))

        const pause = (): void => void flow.dispatch('pause')
        // The pad in use unplugged mid-play pauses with a reconnect message (M4-D9), under the `input` reason so
        // nothing else resumes the sim behind the player's back. Another pad or the keyboard in use: play on.
        const time = yield* Time
        yield* Effect.acquireRelease(
          Effect.sync(() =>
            bus.subscribe('input.pad.disconnected', (pad) => {
              if (!pad.wasActive || Effect.runSync(SubscriptionRef.get(input.device)).device !== 'gamepad')
                return
              reconnect = true
              time.pause('input')
              pause()
            }),
          ),
          (stop) => Effect.sync(stop),
        )
        // Escape and the pad's Start are the Input's pause edge; KeyP is the default screens' own extra.
        yield* Effect.acquireRelease(
          Effect.sync(() => input.onPress('pause', pause)),
          (stop) => Effect.sync(stop),
        )
        yield* listen(target, 'keydown', (event) => {
          if (!plain(event) || event.code !== 'KeyP') return
          event.preventDefault()
          pause()
        })
        yield* backGesture(target, () => {
          pause()
          return true
        })

        const tracker = new InputMethodTracker()
        const detach = tracker.attach(target)
        yield* Effect.addFinalizer(() => Effect.sync(detach))
        yield* show(PlayScreen, layer, {
          copy,
          onPause: pause,
          tracker,
          touchButtons: game.input?.touch === false ? [] : (game.input?.touchButtons ?? []),
          onHold: (id: string) => input.hold(id),
          onRelease: (id: string) => input.release(id),
          swipe: touchMode === 'swipe' ? new SwipeTracker(input.gesture) : undefined,
          drag: bindsCameraDrag ? new CameraDragTracker(input.drag) : undefined,
          stick:
            map?.touchStick === true
              ? {
                  onstick: (x: number, y: number) => input.touchStick.set(x, y),
                  onstickend: () => input.touchStick.release(),
                }
              : undefined,
          hud: resolveExtensions(game.extensions ?? []).slots('hud.overlay'),
        })
      }),
  }

  const paused: ScreenDef = {
    id: 'paused',
    pausesSim: true,
    enter: ({ layer }) =>
      Effect.gen(function* () {
        const flow = yield* Flow
        const time = yield* Time
        const target = windowOf(layer)
        // Any device that reaches Resume or Quit lets the game go on (a pad plugged in mid-game included).
        const clearReconnect = (): void => {
          reconnect = false
          time.resume('input')
        }
        const resume = (): void => {
          clearReconnect()
          flow.dispatch('resume')
        }
        const quit = (): void => {
          clearReconnect()
          flow.dispatch('quit')
        }
        const boards = yield* Leaderboards
        // Read from the host each time paused opens: what the host says, never a copy kept here.
        const board =
          game.board === undefined
            ? undefined
            : { load: () => Effect.runPromise(boards.readBoard(game.board as string)) }
        const settings = (): void => void flow.dispatch('settings')
        // Load newer replaces the sim with the other device's progress and plays on from it.
        const saves =
          game.saves === undefined
            ? undefined
            : yield* pausedSaves(game.saves, {
                fresh: freshSim,
                play: (next) => {
                  dropSim()
                  sim = next
                  resume()
                },
              } satisfies SavesStart)
        // Mute is the Audio group's setting, as FloorFifty's pause has it.
        const { store } = yield* Settings
        const targets = { audio: yield* Audio, buses: yield* AudioBuses }
        const copy = yield* words
        yield* show(PausedScreen, layer, {
          copy,
          onResume: resume,
          onQuit: quit,
          onSettings: settings,
          muted: savedAudio(store).muted,
          onMute: (muted: boolean) => changeAudio(targets, store, { ...savedAudio(store), muted }),
          reconnect,
          board,
          saves,
        })
        // Escape is the dialog's (Modal): it steps back from the Quit confirm, and from the menu it resumes.
        yield* backGesture(target, () => sendBack(layer.ownerDocument))
        yield* driveMenu(target)
        yield* noticeUnsupportedPads(layer, toldPads, () => copy.current.padUnsupported)
      }),
  }

  // Every screen ties the sim to the run before its own enter, so a flow that starts anywhere still drops it.
  return [title, play, paused, settingsScreen(game, toldPads)].map(
    (screen): ScreenDef => ({
      ...screen,
      enter: (context) => Effect.zipRight(dropSimOnShutdown(context.runtime), screen.enter(context)),
    }),
  )
}
