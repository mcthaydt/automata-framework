// base-3d's screens (M3 spec §4.7, DESIGN.md §13): the default screens (`defaultScreens`) for the menu, the room,
// paused and Settings, so play keeps the Input service, the touch overlay and the player's settings, and two of the
// game's own around them: the splash and the end. BASE3D_FLOW says which follows which.
//
// Play is the default play screen with two additions: the sim's `ember.taken` ends the round as complete and moves
// on to the end screen, and its `hero.defeated` ends it as failed and moves on to the game over. The round starts
// when play is entered from the menu or the game over's Continue, and ends as `quit` when Quit leaves paused for the
// menu. Continue plays on from the area entrance: the sim as it stood when play entered the area, restored.
import { defaultScreens, type ScreensGame } from '@mcthaydt/automata-game'
import { Hosting } from '@mcthaydt/automata-host'
import { Flow, PresentationBus, type ScreenDef, Settings } from '@mcthaydt/automata-runtime'
import { resolveExtensions } from '@mcthaydt/automata-runtime/extension'
import type { Sim } from '@mcthaydt/automata-sim'
import { Effect, type Scope } from 'effect'
import { flushSync, mount, unmount } from 'svelte'
import { TICK_HZ } from '../constants.ts'
import { AreaEntered, AreaExit, EmberTaken, HeroDefeated } from '../events.ts'
import { areaFade } from './area-fade.ts'
import EndScreen from './EndScreen.svelte'
import GameOverScreen from './GameOverScreen.svelte'
import type { LockInput } from './lock-input.ts'
import SplashScreen from './SplashScreen.svelte'
import { lockModeOf, settingsInPlay } from './settings.ts'

/** How long the splash shows before moving on by itself. */
export const SPLASH_MS = 1500

/** Mounts a panel in the screen's layer for as long as the screen is open, rendered now for the flow's focus step. */
function show<Props extends Record<string, unknown>>(
  component: Parameters<typeof mount<Props, Record<string, never>>>[0],
  target: HTMLElement,
  props: Props,
): Effect.Effect<void, never, Scope.Scope> {
  return Effect.acquireRelease(
    Effect.sync(() => {
      const instance = mount(component, { target, props })
      flushSync()
      return instance
    }),
    (instance) => Effect.promise(() => unmount(instance)),
  ).pipe(Effect.asVoid)
}

/** A window listener for as long as the screen is open. */
function listen<K extends keyof WindowEventMap>(
  target: Window,
  type: K,
  listener: (event: WindowEventMap[K]) => void,
): Effect.Effect<void, never, Scope.Scope> {
  return Effect.acquireRelease(
    Effect.sync(() => target.addEventListener(type, listener)),
    () => Effect.sync(() => target.removeEventListener(type, listener)),
  )
}

const byId = (screens: readonly ScreenDef[], id: string): ScreenDef => {
  const screen = screens.find((candidate) => candidate.id === id)
  if (screen === undefined) throw new Error(`base-3d: the default screens have no "${id}"`)
  return screen
}

/**
 * The seven screens BASE3D_FLOW names, over the default screens for `game`. Play gives `game.input` the player's
 * saved Lock mode on entry, and Settings on its way out (lock-input.ts).
 */
export function base3dScreens(game: ScreensGame & { readonly input: LockInput }): ScreenDef[] {
  // The sim play runs, told by the default screens (`watchSim`): the end screen's time is its tick.
  let running: Sim | undefined
  // The running sim as it stood at the area entrance, which the game over's Continue restores: taken when play gets
  // a new sim (from the menu's slot list, or paused's Load newer) and when the sim swaps to another area.
  let entrance: ReturnType<Sim['snapshot']> | undefined
  let seconds = 0
  const defaults = defaultScreens({
    ...game,
    // The sim `defineGame` runs: the game's plugins, then its extensions' (render3dExtension's camera heading), as
    // `defineGame` gives its own default screens; a game that passes its screens passes the sim they make.
    sim: {
      ...game.sim,
      plugins: [...game.sim.plugins, ...resolveExtensions(game.extensions ?? []).simPlugins],
    },
    watchSim: (sim) => {
      if (sim !== running) entrance = sim?.snapshot()
      running = sim
      game.watchSim?.(sim)
    },
  })
  const title = byId(defaults, 'title')
  const play = byId(defaults, 'play')
  const defaultSettings = byId(defaults, 'settings')

  const splash: ScreenDef = {
    id: 'splash',
    enter: ({ layer }) =>
      Effect.gen(function* () {
        const flow = yield* Flow
        const target = layer.ownerDocument.defaultView ?? window
        yield* show(SplashScreen, layer, { title: game.title })
        const next = (): void => void flow.dispatch('continue')
        yield* listen(target, 'keydown', next)
        yield* listen(target, 'pointerdown', next)
        yield* Effect.acquireRelease(
          Effect.sync(() => target.setTimeout(next, SPLASH_MS)),
          (timer) => Effect.sync(() => target.clearTimeout(timer)),
        )
      }),
  }

  const menu: ScreenDef = {
    ...title,
    enter: (context) =>
      Effect.gen(function* () {
        if (context.from === 'paused') yield* (yield* Hosting).round.end('quit')
        yield* title.enter(context)
      }),
  }

  const room: ScreenDef = {
    ...play,
    enter: (context) =>
      Effect.gen(function* () {
        const flow = yield* Flow
        const hosting = yield* Hosting
        const bus = yield* PresentationBus
        if (context.from === 'title' || context.from === 'game-over') yield* hosting.round.start
        game.input.mode = lockModeOf((yield* Settings).store?.get())
        const fade = yield* areaFade(context.layer)
        yield* Effect.acquireRelease(
          Effect.sync(() =>
            bus.subscribe('sim.events', (events) => {
              if (events.some((event) => event.type === AreaExit.id)) fade.out()
              if (events.some((event) => event.type === AreaEntered.id)) {
                fade.in()
                // The game over's Continue starts from this area's entrance.
                entrance = running?.snapshot()
              }
              if (events.some((event) => event.type === EmberTaken.id)) {
                seconds = (running?.tick ?? 0) / TICK_HZ
                Effect.runFork(hosting.round.end('complete'))
                flow.dispatch('ember')
              } else if (events.some((event) => event.type === HeroDefeated.id)) {
                Effect.runFork(hosting.round.end('fail'))
                flow.dispatch('defeated')
              }
            }),
          ),
          (stop) => Effect.sync(stop),
        )
        yield* play.enter(context)
      }),
  }

  const end: ScreenDef = {
    id: 'end',
    enter: ({ layer }) =>
      Effect.gen(function* () {
        const flow = yield* Flow
        yield* show(EndScreen, layer, {
          time: `${seconds.toFixed(2)} s`,
          onMenu: () => void flow.dispatch('quit'),
        })
      }),
  }

  // Settings hands its store to the game's own section (`settingsInPlay`) before it mounts, and takes it back on exit.
  const settings: ScreenDef = {
    ...defaultSettings,
    enter: (context) =>
      Effect.gen(function* () {
        const { store } = yield* Settings
        yield* Effect.acquireRelease(
          Effect.sync(() => {
            settingsInPlay.store = store
          }),
          () =>
            Effect.sync(() => {
              settingsInPlay.store = undefined
              game.input.mode = lockModeOf(store?.get())
            }),
        )
        yield* defaultSettings.enter(context)
      }),
  }

  const gameOver: ScreenDef = {
    id: 'game-over',
    enter: ({ layer }) =>
      Effect.gen(function* () {
        const flow = yield* Flow
        yield* show(GameOverScreen, layer, {
          onContinue: () => {
            if (running !== undefined && entrance !== undefined) running.restore(entrance)
            flow.dispatch('continue')
          },
          onQuit: () => void flow.dispatch('quit'),
        })
      }),
  }

  const replaced = [title, play, defaultSettings]
  return [
    splash,
    menu,
    room,
    settings,
    gameOver,
    ...defaults.filter((screen) => !replaced.includes(screen)),
    end,
  ]
}
