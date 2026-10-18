import '@mcthaydt/automata-ui/theme.css'
import './screens.css'
import {
  AppLoop,
  displaySettingsSchema,
  Flow,
  inputSettingsSchema,
  Leaderboards,
  makeInput,
  PresentationBus,
  type QualityTier,
  type ScreenDef,
  Settings,
  SwipeTracker,
  Time,
} from '@mcthaydt/automata-runtime'
import { type ExtensionDef, resolveExtensions } from '@mcthaydt/automata-runtime/extension'
import { createSim, type PluginDef, type Sim } from '@mcthaydt/automata-sim'
import { CursorRunner, InputMethodTracker, type LeaderboardCopy, sendBack } from '@mcthaydt/automata-ui'
import { Effect, SubscriptionRef } from 'effect'
import type { InputMap } from '../input/keys.ts'
import PausedScreen from './PausedScreen.svelte'
import PlayScreen from './PlayScreen.svelte'
import {
  backGesture,
  driveMenu,
  hostInput,
  listen,
  NO_BINDINGS,
  noticeUnsupportedPads,
  plain,
  show,
  windowOf,
} from './screen-kit.ts'
import { settingsScreen } from './settings-screen.svelte.ts'
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
  /** Told the sim play runs, and `undefined` when the title drops it: the draw layer reads it (PRODUCT.2). */
  readonly watchSim?: ((sim: Sim | undefined) => void) | undefined
  /** The board paused shows: the game's first scored board (M5.7). None: paused shows no board. */
  readonly board?: string | undefined
  /** Applies the player's graphics quality to the stage (M4.4): the saved one at the title, then each choice. */
  readonly setQuality?: ((tier: QualityTier) => void) | undefined
  /** The game's extensions: play draws their `hud.overlay` components (M4.7), Settings shows their `settings.sections` (M4.4). */
  readonly extensions?: readonly ExtensionDef[] | undefined
}

/** The board's words on the default paused screen. English, like the other default screens' words (02 follow-up). */
const BOARD_COPY: LeaderboardCopy = {
  title: 'Scores',
  loading: 'Loading scores…',
  empty: 'No scores yet',
  unavailable: "Scores aren't available here",
  offline: "You're offline",
  you: 'You',
  more: (count) => `+${count} more`,
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {}

/**
 * The title, play, paused and settings screens (DX spec §7, M4.4) over the default content's flow
 * (`title → play ⇄ paused → title`, `paused ⇄ settings`).
 *
 * The screens share one sim: play creates it on first entry (seed, plugins, content, then `setup`),
 * paused keeps it, and the title drops it, so Quit to title and Play start again at tick 0. Returning
 * from paused re-sends the whole state to the renderer (G-5): `AppLoop.run` resets the renderer, so
 * play restores the sim's own snapshot, which makes the next step a resync.
 */
export function defaultScreens(game: ScreensGame): ScreenDef[] {
  // The pads already told they are not supported (M4 spec §6), for the whole session.
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

  const title: ScreenDef = {
    id: 'title',
    enter: ({ layer }) =>
      Effect.gen(function* () {
        dropSim()
        const flow = yield* Flow
        // The player's saved quality reaches the stage before play draws anything (M4.4).
        const { store } = yield* Settings
        if (game.setQuality !== undefined && store !== undefined)
          game.setQuality(
            displaySettingsSchema
              .catch(() => ({ quality: 'high' as const }))
              .parse(asRecord(store.get()).display).quality,
          )
        const target = windowOf(layer)
        const play = (): void => void flow.dispatch('play')
        yield* show(TitleScreen, layer, { title: game.title, onPlay: play })
        // Enter or Space anywhere on the title plays; on a focused button the button's own click does.
        yield* listen(target, 'keydown', (event) => {
          if (!plain(event) || (event.code !== 'Enter' && event.code !== 'Space')) return
          if (event.target instanceof HTMLButtonElement) return
          event.preventDefault()
          play()
        })
        // Nothing on the title takes Back, so a back step leaves the game.
        yield* backGesture(target, () => sendBack(layer.ownerDocument))
        yield* driveMenu(target)
        yield* noticeUnsupportedPads(layer, toldPads)
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
          const { plugins, seed, content, setup } = game.sim
          current = yield* Effect.promise(() => createSim({ plugins: [...plugins], seed, content }))
          setup?.(current)
          sim = current
        } else {
          current.restore(current.snapshot())
        }

        // The Input service for this play session (M4 spec §4.2): sampled once per fixed step, closed with the screen.
        const map = game.input
        const bus = yield* PresentationBus
        // The player's bindings and touch mode, from the settings (M4.4).
        const { store } = yield* Settings
        const input = yield* makeInput({
          target,
          profile: map?.profile ?? NO_BINDINGS,
          bus,
          settings: store,
          hostInput: yield* hostInput,
        })
        const touchMode = inputSettingsSchema.parse(asRecord(store?.get()).input).touchMode ?? map?.touchMode
        const running = current
        game.watchSim?.(running)
        // An idle pointer hides while playing (M4 spec §4.7); leaving play detaches it and shows the pointer again.
        const cursor = new CursorRunner(layer, { kind: () => 'gameplay' })
        const detachCursor = cursor.attach(target)
        yield* Effect.addFinalizer(() => Effect.sync(detachCursor))
        yield* noticeUnsupportedPads(layer, toldPads)
        appLoop.run({
          sim: running,
          commands: (tick) => {
            cursor.tick()
            if (map === undefined) return []
            input.poll()
            return map.toCommand(input.held(), tick)
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
          onPause: pause,
          tracker,
          touchButtons: game.input?.touch === false ? [] : (game.input?.touchButtons ?? []),
          onHold: (id: string) => input.hold(id),
          onRelease: (id: string) => input.release(id),
          swipe: touchMode === 'swipe' ? new SwipeTracker(input.gesture) : undefined,
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
        const message = reconnect ? 'Reconnect your controller' : undefined
        // Any device that reaches Resume or Quit lets the game go on (M4 spec §5, pad hot-plug).
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
        // Read from the host each time paused opens: what the host says, never a copy kept here (M5 spec §4.8).
        const board =
          game.board === undefined
            ? undefined
            : { copy: BOARD_COPY, load: () => Effect.runPromise(boards.readBoard(game.board as string)) }
        const settings = (): void => void flow.dispatch('settings')
        yield* show(PausedScreen, layer, {
          onResume: resume,
          onQuit: quit,
          onSettings: settings,
          message,
          board,
        })
        yield* listen(target, 'keydown', (event) => {
          if (event.code !== 'Escape' || event.repeat) return
          event.preventDefault()
          resume()
        })
        yield* backGesture(target, () => sendBack(layer.ownerDocument))
        yield* driveMenu(target)
        yield* noticeUnsupportedPads(layer, toldPads)
      }),
  }

  return [title, play, paused, settingsScreen(game, toldPads)]
}
