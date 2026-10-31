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
import { CameraHeading } from '@mcthaydt/automata-render-pixi3d/sim'
import { Flow, Locale, PresentationBus, type ScreenDef, Settings } from '@mcthaydt/automata-runtime'
import { resolveExtensions } from '@mcthaydt/automata-runtime/extension'
import type { Sim } from '@mcthaydt/automata-sim'
import { interceptBackGesture } from '@mcthaydt/automata-ui'
import { Effect, type Scope } from 'effect'
import { flushSync, mount, unmount } from 'svelte'
import { Hero } from '../components.ts'
import { TICK_HZ } from '../constants/index.ts'
import { AreaEntered, AreaExit, EmberTaken, HeroDefeated } from '../events.ts'
import { Location } from '../resources.ts'
import { continueWith3Hearts } from '../state/index.ts'
import { type Base3dSave, newGame } from '../state/save.ts'
import type { World } from '../systems/index.ts'
import { areaFade } from './area-fade.ts'
import { followLocale } from './copy.svelte.ts'
import EndScreen from './EndScreen.svelte'
import GameOverScreen from './GameOverScreen.svelte'
import { hudInPlay, type ItemName } from './hud.ts'
import ItemsScreen from './ItemsScreen.svelte'
import type { LockInput } from './lock-input.ts'
import MapScreen from './MapScreen.svelte'
import { mapOf } from './map.ts'
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

/** The keys that equip in play (DESIGN.md §14.2): 1, 2 and 3. */
const EQUIP_KEYS: Readonly<Record<string, ItemName>> = {
  Digit1: 'sling',
  Digit2: 'bombs',
  Digit3: 'hookchain',
}

/** A key press with no modifier and no auto-repeat: the game's own one-shot keys (I, 1, 2, 3). */
const plainPress = (event: KeyboardEvent): boolean =>
  !event.repeat && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey

/** The game's words (copy.ts) kept in the player's language for as long as the screen is open (DX.2d's way). */
const followTheLocale: Effect.Effect<void, never, Scope.Scope | Locale> = Effect.gen(function* () {
  const locale = yield* Locale
  yield* Effect.acquireRelease(
    Effect.sync(() => followLocale(locale)),
    (stop) => Effect.sync(stop),
  )
})

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
export function base3dScreens(
  game: ScreensGame & { readonly input: LockInput; readonly world?: World | undefined },
): ScreenDef[] {
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
      hudInPlay.sim = sim
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
        const target = context.layer.ownerDocument.defaultView ?? window
        // I opens the Items screen and M the map, as the HUD's buttons do; 1, 2 and 3 equip (§14.2). The sim
        // ignores an item Wick does not own.
        yield* followTheLocale
        const openItems = (): void => void flow.dispatch('items')
        const openMap = (): void => void flow.dispatch('map')
        yield* Effect.acquireRelease(
          Effect.sync(() => {
            hudInPlay.openItems = openItems
            hudInPlay.openMap = game.world === undefined ? undefined : openMap
          }),
          () =>
            Effect.sync(() => {
              hudInPlay.openItems = undefined
              hudInPlay.openMap = undefined
            }),
        )
        yield* listen(target, 'keydown', (event) => {
          if (!plainPress(event)) return
          const item = EQUIP_KEYS[event.code]
          if (item !== undefined) game.input.equip(item)
          else if (event.code === 'KeyI') openItems()
          else if (event.code === 'KeyM' && game.world !== undefined) openMap()
          else return
          event.preventDefault()
        })
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
            if (running !== undefined && entrance !== undefined) {
              running.restore(entrance)
              continueWith3Hearts(running)
            }
            flow.dispatch('continue')
          },
          onQuit: () => void flow.dispatch('quit'),
        })
      }),
  }

  // The Items screen (§9.3) over the paused sim: the save as play would write it now (the heart pieces and the kiln
  // are only there), and a choice queued as `equip` for play's first tick. Escape, the corner Back and the system
  // back return to play.
  const items: ScreenDef = {
    id: 'items',
    pausesSim: true,
    enter: ({ layer }) =>
      Effect.gen(function* () {
        const flow = yield* Flow
        const hosting = yield* Hosting
        const target = layer.ownerDocument.defaultView ?? window
        const back = (): void => void flow.dispatch('back')
        yield* followTheLocale
        const save = (
          running !== undefined && game.saves !== undefined ? game.saves.capture(running) : newGame()
        ) as Base3dSave
        yield* show(ItemsScreen, layer, {
          save,
          onEquip: (item: ItemName) => game.input.equip(item),
          onBack: back,
        })
        yield* listen(target, 'keydown', (event) => {
          if (event.code !== 'Escape') return
          event.preventDefault()
          back()
        })
        // Hosted, the host owns system back (M4-D10).
        if (hosting.kind === 'standalone')
          yield* Effect.acquireRelease(
            Effect.sync(() =>
              interceptBackGesture(target, () => {
                back()
                return true
              }),
            ),
            (stop) => Effect.sync(stop),
          )
      }),
  }

  // The Map screen (§9.4) over the paused sim: the plan of the area Wick is in, from its compiled geometry, his place
  // and facing, the camera's heading, and the visits and the map as the save holds them. Escape and the corner Close
  // return to play.
  const map: ScreenDef = {
    id: 'map',
    pausesSim: true,
    enter: ({ layer }) =>
      Effect.gen(function* () {
        const flow = yield* Flow
        const target = layer.ownerDocument.defaultView ?? window
        const close = (): void => void flow.dispatch('close')
        yield* followTheLocale
        const area = running === undefined ? undefined : game.world?.areas[running.resource(Location).area]
        const wick = running?.query(Hero, CameraHeading)[0]
        if (running === undefined || area === undefined || wick === undefined) {
          close()
          return
        }
        const save = (game.saves?.capture(running) ?? newGame()) as Base3dSave
        const { x, z, facing } = wick.get(Hero)
        const plan = mapOf(area, {
          x,
          z,
          facing,
          heading: wick.get(CameraHeading).heading,
          visited: save.kiln.visited,
          hasMap: save.kiln.map,
        })
        yield* show(MapScreen, layer, { plan, onClose: close })
        yield* listen(target, 'keydown', (event) => {
          if (event.code !== 'Escape' && event.code !== 'KeyM') return
          event.preventDefault()
          close()
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
    items,
    map,
    ...defaults.filter((screen) => !replaced.includes(screen)),
    end,
  ]
}
