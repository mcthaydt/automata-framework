import '@mcthaydt/automata-ui/theme.css'
import './screens.css'
import { AppLoop, Flow, type ScreenDef } from '@mcthaydt/automata-runtime'
import { createSim, type PluginDef, type Sim } from '@mcthaydt/automata-sim'
import { InputMethodTracker } from '@mcthaydt/automata-ui'
import { Effect, type Scope } from 'effect'
import { type Component, flushSync, mount, unmount } from 'svelte'
import type { InputMap } from '../input/keys.ts'
import { menuPad } from './menu-pad.ts'
import PausedScreen from './PausedScreen.svelte'
import PlayScreen from './PlayScreen.svelte'
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
}

/** Mounts a screen component into the screen's layer for as long as the screen is open. */
function show<Props extends Record<string, unknown>>(
  component: Component<Props>,
  target: HTMLElement,
  props: Props,
): Effect.Effect<void, never, Scope.Scope> {
  return Effect.acquireRelease(
    Effect.sync(() => {
      const instance = mount(component, { target, props })
      // Rendered now, so the flow's focus step (runtime flow step 7) finds the primary action.
      flushSync()
      return instance
    }),
    (instance) => Effect.promise(() => unmount(instance)),
  ).pipe(Effect.asVoid)
}

/** A window listener for as long as the screen is open. */
function listen(
  target: Window,
  type: 'keydown',
  listener: (event: KeyboardEvent) => void,
): Effect.Effect<void, never, Scope.Scope> {
  return Effect.acquireRelease(
    Effect.sync(() => target.addEventListener(type, listener)),
    () => Effect.sync(() => target.removeEventListener(type, listener)),
  )
}

/** Polls the pads each animation frame while a menu is open (G-8). */
function pollMenuPad(target: Window): Effect.Effect<void, never, Scope.Scope> {
  return Effect.acquireRelease(
    Effect.sync(() => {
      if (typeof target.requestAnimationFrame !== 'function') return undefined
      const pad = menuPad(() => target.navigator.getGamepads?.() ?? [])
      let frame = 0
      const poll = (): void => {
        pad.poll()
        frame = target.requestAnimationFrame(poll)
      }
      frame = target.requestAnimationFrame(poll)
      return () => target.cancelAnimationFrame(frame)
    }),
    (stop) => Effect.sync(() => stop?.()),
  )
}

const windowOf = (layer: HTMLElement): Window => layer.ownerDocument.defaultView ?? window

/** A plain key press, not one held down repeating, nor one with a modifier the browser may own. */
const plain = (event: KeyboardEvent): boolean =>
  !event.repeat && !event.altKey && !event.ctrlKey && !event.metaKey

/**
 * The title, play and paused screens (DX spec §7) over the default content's flow
 * (`title → play ⇄ paused → title`).
 *
 * The screens share one sim: play creates it on first entry (seed, plugins, content, then `setup`),
 * paused keeps it, and the title drops it, so Quit to title and Play start again at tick 0. Returning
 * from paused re-sends the whole state to the renderer (G-5): `AppLoop.run` resets the renderer, so
 * play restores the sim's own snapshot, which makes the next step a resync.
 */
export function defaultScreens(game: ScreensGame): ScreenDef[] {
  let sim: Sim | undefined
  let playFlow: Flow | undefined

  const dropSim = (): void => {
    sim?.dispose()
    sim = undefined
  }

  const title: ScreenDef = {
    id: 'title',
    enter: ({ layer }) =>
      Effect.gen(function* () {
        dropSim()
        const flow = yield* Flow
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
        yield* pollMenuPad(target)
      }),
  }

  const play: ScreenDef = {
    id: 'play',
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

        const input = game.input?.attach(target)
        yield* Effect.addFinalizer(() => Effect.sync(() => input?.dispose()))
        const running = current
        appLoop.run({ sim: running, commands: (tick) => input?.commands(tick) ?? [] })
        yield* Effect.addFinalizer(() => Effect.sync(() => appLoop.stop()))

        const pause = (): void => void flow.dispatch('pause')
        yield* listen(target, 'keydown', (event) => {
          if (!plain(event) || (event.code !== 'Escape' && event.code !== 'KeyP')) return
          event.preventDefault()
          pause()
        })

        const tracker = new InputMethodTracker()
        const detach = tracker.attach(target)
        yield* Effect.addFinalizer(() => Effect.sync(detach))
        yield* show(PlayScreen, layer, {
          onPause: pause,
          tracker,
          touchButtons: game.input?.touch === false ? [] : (game.input?.touchButtons ?? []),
          onHold: (id: string) => input?.hold(id),
          onRelease: (id: string) => input?.release(id),
        })
      }),
  }

  const paused: ScreenDef = {
    id: 'paused',
    pausesSim: true,
    enter: ({ layer }) =>
      Effect.gen(function* () {
        const flow = yield* Flow
        const target = windowOf(layer)
        const resume = (): void => void flow.dispatch('resume')
        yield* show(PausedScreen, layer, { onResume: resume, onQuit: () => void flow.dispatch('quit') })
        yield* listen(target, 'keydown', (event) => {
          if (event.code !== 'Escape' || event.repeat) return
          event.preventDefault()
          resume()
        })
        yield* pollMenuPad(target)
      }),
  }

  return [title, play, paused]
}
